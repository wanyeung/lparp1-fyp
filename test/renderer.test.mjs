import assert from 'node:assert/strict';
import test from 'node:test';
import Render, { render, model } from '../library/Render.mjs';

const table = (id = 'source') => ['table', id, 'Actual source title', ['label', 'value'], [['Ada', 2], ['Grace', '3']]];
const text = id => ['text', id, id, `Body of ${id}`];
const chart = (kind = 'bar', source = table(), id = kind) => [kind, id, `${kind} title`, source, 'label', 'value'];
const group = (id, children) => ['group', id, `${id} title`, children];
const htmlIds = html => [...html.matchAll(/<(?:article|section) class="(?:item|group)" id="([^"]+)"/g)].map(match => match[1]);

test('default and named exports expose the same functions', () => {
  assert.equal(Render.render, render);
  assert.equal(Render.model, model);
});

test('author order, nested groups and actual descriptor source provenance are preserved', () => {
  const source = table();
  const root = group('root', [chart('bar', source), group('nested', [text('note'), source]), chart('pie', source)]);
  const result = model(root);
  assert.deepEqual(result.order, ['bar', 'note', 'source', 'pie']);
  assert.deepEqual(result.items.map(item => item.id), result.order);
  assert.deepEqual(result.groups, [
    { id: 'root', name: 'root title', itemIds: ['bar', 'pie'] },
    { id: 'nested', name: 'nested title', itemIds: ['note', 'source'], parentId: 'root' },
  ]);
  assert.equal(result.items[0].kind, 'chart');
  assert.equal(result.items[0].sourceTableId, source[1]);
  assert.equal(result.items[0].sourceName, source[2]);
  assert.equal(result.items[0].groupId, 'root');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  const html = render(root);
  assert.deepEqual(htmlIds(html), ['root', 'bar', 'nested', 'note', 'source', 'pie']);
  assert.match(html, /<section class="group"/);
  assert.equal((html.match(/href="#source"/g) || []).length, 2);
});

test('source-only tables are not duplicated into the layout or order', () => {
  const source = table();
  const result = model(group('g', [chart('bar', source), chart('pie', source)]));
  assert.deepEqual(result.order, ['bar', 'pie']);
  assert.equal(result.items.filter(item => item.kind === 'table').length, 0);
  const html = render(chart('bar', source));
  assert.doesNotMatch(html, /<table|href="#source"/);
  assert.match(html, /Actual source title \(not displayed\)/);
});

test('explicit order reorders sibling leaves, leaves groups in place, and matches HTML', () => {
  const root = group('root', [text('a'), group('nested', [text('c'), text('d')]), text('b')]);
  const order = ['d', 'b', 'c'];
  const result = model(root, order);
  assert.deepEqual(result.order, ['b', 'd', 'c', 'a']);
  assert.deepEqual(result.groups[0].itemIds, ['b', 'a']);
  assert.deepEqual(result.groups[1].itemIds, ['d', 'c']);
  assert.deepEqual(htmlIds(render(root, order)), ['root', 'b', 'nested', 'd', 'c', 'a']);
  assert.deepEqual(model(root).order, ['a', 'c', 'd', 'b']);
  assert.deepEqual(root[3].map(node => node[1]), ['a', 'nested', 'b']);
});

test('root siblings support partial order, without moving leaves between groups', () => {
  const root = [group('first', [text('a'), text('b')]), group('second', [text('c'), text('d')])];
  assert.deepEqual(model(root, ['d', 'b']).order, ['b', 'a', 'd', 'c']);
  assert.deepEqual(model([text('a'), text('b'), text('c')], ['c']).order, ['c', 'a', 'b']);
});

test('invalid, duplicate, group, or source-only ordering IDs are rejected', () => {
  const root = group('g', [text('a'), chart()]);
  for (const order of [['missing'], ['g'], ['source'], ['a', 'a'], [1], 'a']) {
    assert.throws(() => model(root, order), /order/);
    assert.throws(() => render(root, order), /order/);
  }
});

test('HTML and SVG escape every untrusted field, with no executable attributes or scripts', () => {
  const attack = '<script>alert("x")</script><img src=x onerror=alert(1)>&\'';
  const source = ['table', 'table"onfocus="evil', attack, ['<x>', 'value'], [[attack, 1]]];
  const root = ['group', 'group"onclick="evil', attack, [source,
    ['bar', 'chart"onclick="evil', attack, source, '<x>', 'value'],
    ['pie', 'pie"onclick="evil', attack, source, '<x>', 'value'],
    ['text', 'note', attack, attack],
  ]];
  const html = render(root);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&amp;&#39;/);
  assert.match(html, /id="table&quot;onfocus=&quot;evil"/);
  assert.match(html, /href="#table%22onfocus%3D%22evil"/);
  assert.doesNotMatch(html, /<script|<img|<link/i);
  const tags = (html.match(/<[^>]+>/g) || []).join('\n');
  assert.doesNotMatch(tags, /"\s+on(?:click|focus|error)=|\sstyle=/i);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="en">[\s\S]*<\/html>$/);
  assert.match(html, /<svg class="chart bar"/);
  assert.match(html, /<svg class="chart pie"/);
  assert.match(html, /<circle class="series-0"/);
});

test('tables are semantic, bars support negatives, and multi-slice pies use SVG paths', () => {
  const source = table();
  source[4][0][1] = -2;
  const html = render([source, chart('bar', source)]);
  assert.match(html, /<caption>Actual source title<\/caption>/);
  assert.match(html, /<th scope="col">label<\/th>/);
  assert.match(html, /<rect[^>]+height="[0-9.]+"/);
  assert.doesNotMatch(html, /NaN|Infinity|height="-/);
  assert.match(render(chart('pie')), /<path class="series-0" d="M /);
  assert.deepEqual(model(chart()).items[0].data, [{ label: 'Ada', value: 2 }, { label: 'Grace', value: 3 }]);
});

test('unknown chart columns and malformed source descriptors fail explicitly', () => {
  assert.throws(() => model(['bar', 'b', 'Bar', table(), 'missing', 'value']), /unknown chart column: missing/);
  assert.throws(() => model(['pie', 'p', 'Pie', table(), 'label', 'missing']), /unknown chart column: missing/);
  assert.throws(() => model(['bar', 'b', 'Bar', text('a'), 'label', 'value']), /source must be a table/);
});

test('non-finite numbers, non-numeric strings, booleans and null chart values fail', () => {
  for (const value of [NaN, Infinity, -Infinity, 'Infinity', 'NaN', '1x', '', ' ', true, null, {}, 1n]) {
    const source = table(); source[4][0][1] = value;
    assert.throws(() => model(chart('bar', source)), /finite|scalar/);
  }
  const source = table(); source[4][0][1] = -1;
  assert.throws(() => model(chart('pie', source)), /pie values must not be negative/);
});

test('row width, scalar cells, unique headers and descriptor structure are strict', () => {
  const invalid = [
    ['table', 't', 'T', ['x', 'y'], [[1]]],
    ['table', 't', 'T', ['x'], [[{}]]],
    ['table', 't', 'T', ['x', 'x'], []],
    ['table', 't', 'T', [''], []],
    ['table', 't', 'T', [1], []],
    ['text', 't', 'T', 123], ['text', 't', 'T', 'ok', 'extra'],
    ['wat', 'w', 'W'], ['group', 'g', 'G', null],
    ['text', '', 'T', 'ok'], ['text', 'bad id', 'T', 'ok'],
  ];
  for (const root of invalid) assert.throws(() => model(root), /Studio Render:/);
});

test('displayed IDs are unique across leaves, groups and repeated objects', () => {
  const repeated = text('same');
  for (const root of [[repeated, repeated], group('same', [repeated]), [table('same'), repeated], [group('g', []), group('g', [])]]) {
    assert.throws(() => model(root), /duplicate displayed id/);
  }
  assert.throws(() => model([table(), chart('bar', table())]), /source table id conflicts/);
});

test('empty roots, groups, tables, empty charts and zero-only charts are graceful', () => {
  assert.deepEqual(model([]).order, []);
  assert.match(render([]), /No items to display/);
  assert.match(render(group('empty', [])), /This group is empty/);
  const source = ['table', 'empty-table', 'Empty', ['label', 'value'], []];
  assert.match(render(source), /No rows/);
  for (const kind of ['bar', 'pie']) {
    assert.match(render(chart(kind, source)), /No chart data/);
    source[4] = [['A', 0], ['B', '0']];
    const html = render(chart(kind, source));
    assert.match(html, /All values are zero/);
    assert.doesNotMatch(html, /NaN|Infinity|<path|<rect/);
    source[4] = [];
  }
});

test('extreme finite values do not overflow chart geometry or pie totals', () => {
  const source = table(); source[4] = [['A', Number.MAX_VALUE], ['B', Number.MAX_VALUE]];
  assert.doesNotMatch(render(chart('pie', source)), /NaN|Infinity/);
  source[4][1][1] = -Number.MAX_VALUE;
  assert.doesNotMatch(render(chart('bar', source)), /NaN|Infinity/);
});

test('provenance fragment encoding handles reserved characters and Unicode IDs', () => {
  const source = table('table:%20#é');
  assert.match(render([source, chart('bar', source)]), /href="#table%3A%2520%23%C3%A9"/);
  assert.throws(() => model(text('\ud800')), /valid Unicode/);
});

test('table data snapshots are JSON-safe scalars and detached from descriptors', () => {
  const source = ['table', 't', 'T', ['null', 'boolean', 'string'], [[null, false, 'x']]];
  const item = model(source).items[0];
  assert.deepEqual(item.rows, [[null, false, 'x']]);
  item.rows[0][2] = 'changed'; item.headers[0] = 'changed';
  assert.deepEqual(source[4], [[null, false, 'x']]);
  assert.equal(source[3][0], 'null');
});

test('cycles, excessive depth, node count and cell count have bounded failures', () => {
  const cyclic = group('cycle', []); cyclic[3].push(cyclic);
  assert.throws(() => model(cyclic), /cycle detected/);
  let root = text('leaf');
  for (let i = 0; i < 66; i++) root = group(`depth-${i}`, [root]);
  assert.throws(() => model(root), /depth exceeds/);
  assert.throws(() => model(Array.from({ length: 10001 }, (_, i) => text(`n-${i}`))), /node count exceeds/);
  const huge = ['table', 'huge', 'Huge', ['x'], new Array(1000001)];
  assert.throws(() => model(huge), /cell count exceeds/);
});
