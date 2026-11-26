import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import Primitive from '../build/library/model/Primitive.mjs'
import Document from '../build/library/model/Document.mjs'
import SourceEdit from '../build/library/service/SourceEdit.mjs'
import Html from '../build/library/service/Html.mjs'
import Controller from '../build/library/controller/Controller.mjs'
import * as Marks from '../build/library/controller/D3Manipulation/Marks.js'

const root = path.resolve(import.meta.dirname, '..')
const exec = promisify(execFile)

test('a list or an atom has a blank column header, and a table keeps its own', () => {
  assert.deepEqual(Primitive.make('l', [1, 2]).headers, [''])
  assert.deepEqual(Primitive.make('a', 5).headers, [''])
  assert.deepEqual(Primitive.make('t', [['x'], [1]]).headers, ['x'])
})

test('every header cell is editable and says so, so the page can send a header edit', () => {
  const grid = Primitive.make('teams', ['a', 'b'])
  const html = Html.generateHtml(Document.tree(Document.ofFile('f.mls', [grid]), [grid]), 'n', '')
  assert.ok(html.includes('<th contenteditable="true" data-path="[&quot;teams&quot;]" data-kind="list" data-row="0" data-col="0" data-header="true" data-old=""></th>'))
  assert.ok(html.includes('data-header="false"'))
  assert.ok(html.includes("header: t.dataset.header === 'true'"))
})

test('naming the blank header turns a list or a single value into a one-column table', () => {
  const list = 'val teams = ["Engineering", "Design"]\nval total = 75\n'
  const fromList = Controller.edit({ source: list, path: ['teams'], kind: 'list', header: true, col: 0, text: 'team' })
  assert.equal(fromList.source, 'val teams = [\n  ["team"],\n  ["Engineering"],\n  ["Design"]\n]\nval total = 75\n')
  const fromAtom = Controller.edit({ source: list, path: ['total'], kind: 'atom', header: true, col: 0, text: 'sum' })
  assert.equal(fromAtom.source, 'val teams = ["Engineering", "Design"]\nval total = [\n  ["sum"],\n  [75]\n]\n')
  assert.equal(Controller.edit({ source: list, path: ['teams'], kind: 'list', header: true, col: 0, text: '  ' }).ok, false)
  const grid = Primitive.make('teams', [['team'], ['Engineering'], ['Design']])
  assert.deepEqual([grid.kind, grid.headers, grid.rows], ['table', ['team'], [['Engineering'], ['Design']]])
})

test('renaming a table header rewrites that string in the source', () => {
  const source = 'val sales = [\n  ["item", "units"],\n  ["Tea", 30]\n]\n'
  const result = SourceEdit.header(source, ['sales'], 'table', 1, 'count')
  assert.equal(result.source, source.replace('"units"', '"count"'))
})

test('a string that starts with # or has a line break is text, shown as markdown', () => {
  assert.equal(Primitive.make('intro', '# Title\nbody').kind, 'text')
  assert.equal(Primitive.make('intro', '# Title').text, '# Title')
  assert.equal(Primitive.make('title', 'Warehouse').kind, 'atom')
  const note = Primitive.make('intro', '# Title\nbody')
  const html = Html.generateHtml(Document.tree(Document.ofFile('f.mls', [note]), [note]), 'n', '')
  assert.ok(html.includes('<h2>Title</h2>'))
  assert.ok(!html.includes('data-path='))
})

test('a record with a chart type is a chart, whatever its name', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'chart-'))
  const file = path.join(dir, 'chart.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'chart.mls'), file)
  await copyFile(path.join(root, 'test', 'fixtures', 'table.mls'), path.join(dir, 'table.mls'))
  const { stdout } = await exec(process.execPath, [path.join(root, 'vscodehost', 'src', 'services', 'worker.mjs'), file])
  const result = JSON.parse(stdout.trim().split('\n').pop())
  assert.ok(result.ok)
  const kids = result.tree.children
  assert.deepEqual(kids.map((n) => [n.key, n.kind]), [['bars', 'chart'], ['trend', 'chart'], ['share', 'chart']])
  assert.deepEqual(kids.map((n) => n.chart), ['Bar', 'Line', 'Pie'])
  assert.deepEqual(kids[1].series.map((s) => s.name), ['units', 'price'])
  assert.deepEqual(kids[1].labels, ['Tea', 'Coffee'])
  assert.equal(kids[0].series[0].paths[0], null)
})

test('a name that starts with an underscore is not shown, but charts can still read it', () => {
  const sales = Primitive.make('_sales', [['m', 'v'], ['a', 1]])
  const spec = Primitive.make('c', { chart: 'Bar', source: '_sales', x: 'm', ys: ['v'] })
  const tree = Document.tree(Document.ofFile('f.mls', [sales, spec]), [sales, spec])
  assert.deepEqual(tree.children.map((n) => [n.key, n.kind]), [['c', 'chart']])
})

test('a chart node follows the cursor like any other, and a missing table shows as not found', () => {
  const sales = Primitive.make('sales', [['m', 'v'], ['a', 1]])
  const spec = Primitive.make('c', { chart: 'Bar', source: 'sales', x: 'm', ys: ['v'] })
  const lost = Primitive.make('d', { chart: 'Bar', source: 'gone', x: 'm', ys: ['v'] })
  const tree = Document.tree(Document.ofFile('f.mls', [sales, spec, lost]), [sales, spec, lost])
  assert.deepEqual(tree.children.map((n) => n.kind), ['table', 'chart', 'missing'])
  assert.deepEqual(Document.names(tree), ['sales', 'c'])
  assert.deepEqual(Document.focus(tree, ['c']).children.map((n) => n.kind), ['chart'])
  assert.deepEqual(Document.focus(tree, ['sales']).children.map((n) => n.kind), ['table', 'chart'])
})

test('a chart point knows the source cell behind it, and a drag becomes an ordinary cell edit', () => {
  const sales = Primitive.make('sales', [['m', 'v'], ['a', 1.5], ['b', 2]])
  const node = Document.tree(Document.custom('D', 'f.mls', [Document.chart('Bar', 'C', 'sales', 'm', ['v'])]), [sales]).children[0]
  const bars = Marks.barsOf(node.series[0], node.labels)
  assert.deepEqual(bars.map((b) => [b.label, b.value, b.editable, b.decimals]), [['a', 1.5, true, 1], ['b', 2, true, 1]])
  assert.deepEqual(bars[1].path, ['sales', 2, 1])
  const edit = Marks.toEdit({ type: 'patch', path: bars[1].path, value: '3' })
  assert.deepEqual(edit, { type: 'edit', path: ['sales', 2, 1], kind: 'atom', header: false, row: 0, col: 0, text: '3' })
  const source = 'val sales = [\n  ["m", "v"],\n  ["a", 1.5],\n  ["b", 2]\n]\n'
  assert.equal(Controller.edit({ ...edit, source }).source, source.replace('["b", 2]', '["b", 3]'))
})

test('a point that is not a number cannot be dragged', () => {
  const bars = Marks.barsOf({ name: 'v', values: [1, null, 'x'], paths: [['t', 1, 1], ['t', 2, 1], ['t', 3, 1]] }, ['a', 'b', 'c'])
  assert.deepEqual(bars.map((b) => [b.value, b.editable]), [[1, true], [null, false], [null, false]])
})
