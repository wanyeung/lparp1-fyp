import { test } from 'node:test'
import assert from 'node:assert/strict'
import Primitive from '../build/library/model/Primitive.mjs'
import Document from '../build/library/model/Document.mjs'
import Source from '../build/library/service/Source.mjs'
import SourceEdit from '../build/library/service/SourceEdit.mjs'
import Scope from '../build/library/service/Scope.mjs'
import Html from '../build/library/service/Html.mjs'
import Csv from '../build/library/io/Csv.mjs'
import Export from '../build/library/io/Export.mjs'
import Controller from '../build/library/controller/Controller.mjs'

const source = 'val sales = [\n  ["item", "units"],\n  ["Tea", 30],\n  ["Coffee, hot", 45.5]\n]\n'

test('primitive tells tables, lists, atoms and blocks apart', () => {
  assert.equal(Primitive.make('t', [['a'], [1]]).kind, 'table')
  assert.equal(Primitive.make('l', [1, 2]).kind, 'list')
  assert.equal(Primitive.make('e', []).kind, 'list')
  assert.equal(Primitive.make('n', 5).kind, 'atom')
  assert.equal(Primitive.make('s', 'x').kind, 'atom')
  const block = Primitive.make('b', { total: 3, rows: [[1], [2]], inner: { x: 1 } })
  assert.equal(block.kind, 'block')
  assert.deepEqual(block.children.map((c) => [c.key, c.kind]), [['total', 'atom'], ['rows', 'table'], ['inner', 'block']])
})

test('a file can have several documents, and imports can rename and add text', () => {
  const available = [Primitive.make('sales', [['a'], [1]]), Primitive.make('total', 9)]
  const all = Document.ofFile('a.mls', available)
  const renamed = Document.custom('B', 'a.mls', [Document.useAs('sales', 'Revenue')])
  const report = Document.custom('C', 'a.mls', [Document.text('# Report'), Document.use('total'), Document.use('gone')])
  const children = (d) => Document.tree(d, available).children
  assert.deepEqual(Document.forFile([all, renamed, report, Document.custom('D', 'b.mls', [])], 'a.mls').map((d) => d.name), ['a.mls', 'B', 'C'])
  assert.deepEqual(children(all).map((p) => p.name), ['sales', 'total'])
  assert.equal(children(renamed)[0].name, 'Revenue')
  assert.deepEqual(children(report).map((p) => p.kind), ['text', 'atom', 'missing'])
  assert.equal(Document.tree(all, available).file, 'a.mls')
})

test('source locates a cell and skips commas inside strings', () => {
  const [from, to] = Source.locate(source, ['sales', 2, 0])
  assert.equal(source.slice(from, to), '"Coffee, hot"')
  assert.equal(Source.locate(source, ['sales', 9, 0]), null)
  assert.equal(Source.locate(source, ['missing', 0, 0]), null)
})

test('source ignores a binding that only appears in a comment', () => {
  const text = '// val sales = [[1]]\n' + source
  const [from, to] = Source.locate(text, ['sales', 1, 1])
  assert.equal(text.slice(from, to), '30')
})

test('source edit keeps the literal type', () => {
  assert.equal(SourceEdit.at(source, ['sales', 1, 1], '31').source, source.replace('30', '31'))
  assert.equal(SourceEdit.at(source, ['sales', 1, 0], 'Matcha').source, source.replace('"Tea"', '"Matcha"'))
  assert.equal(SourceEdit.at(source, ['sales', 1, 1], 'abc').ok, false)
  assert.equal(SourceEdit.at(source, ['sales', 1, 1], '').ok, false)
})

test('controller turns exports into primitives and a document, and shifts past the header row', () => {
  const payload = { exports: { _$_modulePrivate_$_sales: [['a'], [1]], other: 1 }, source, file: 'a.mls' }
  assert.deepEqual(Controller.primitives(payload).map((p) => p.key), ['sales'])
  assert.deepEqual(Controller.document(payload).entries.map((e) => e.key), ['sales'])
  const ordered = Controller.primitives({ exports: { _$_modulePrivate_$_b: 1, _$_modulePrivate_$_a: 2 }, source: 'val b = 1\nval a = 2\n' })
  assert.deepEqual(ordered.map((p) => p.key), ['b', 'a'])
  const edit = Controller.edit({ source, path: ['sales'], kind: 'table', row: 0, col: 1, text: '99' })
  assert.equal(edit.source, source.replace('30', '99'))
})

test('html escapes values, carries the nonce, shows titles, and renders markdown and missing imports', () => {
  const tableOnly = (value) => Document.tree(Document.ofFile('a.mls', [Primitive.make('t', value)]), [Primitive.make('t', value)])
  const page = Html.generateHtml(tableOnly([['<b>'], ['a&b']]), 'abc', '')
  assert.ok(page.includes('&lt;b&gt;'))
  assert.ok(page.includes('a&amp;b'))
  assert.ok(page.includes('nonce="abc"'))
  assert.ok(!page.includes('<b>'))
  const available = [Primitive.make('t', [['a'], [1]])]
  const document = Document.custom('D', 'a.mls', [Document.useAs('t', 'Shown'), Document.text('# Head\nbody <i>'), Document.use('gone')])
  const html = Html.generateHtml(Document.tree(document, available), 'n', '')
  assert.ok(html.includes('Shown'))
  assert.ok(html.includes('data-path="[&quot;t&quot;]"'))
  assert.ok(html.includes('<h2>Head</h2>'))
  assert.ok(html.includes('body &lt;i&gt;'))
  assert.ok(html.includes('Not found: gone'))
})

test('csv parses quotes and numbers, export writes mls back', () => {
  const rows = Csv.parse('item,units\n"Tea, green",30\nCoffee,4.5\n')
  assert.deepEqual(rows, [['item', 'units'], ['Tea, green', 30], ['Coffee', 4.5]])
  assert.equal(Export.mls('sales', rows), 'val sales = [\n  ["item", "units"],\n  ["Tea, green", 30],\n  ["Coffee", 4.5]\n]\n')
})

test('grid treats an empty array as an empty list', () => {
  assert.deepEqual(Primitive.make('e', []).rows, [])
})

test('a document can chart columns of a table, and the page carries the chart script', () => {
  const sales = Primitive.make('sales', [['month', 'a', 'b'], [1, 10, 20], [2, 30, 40]])
  const doc = Document.custom('D', 'a.mls', [Document.chart('Line', 'Both', 'sales', 'month', ['a', 'b']), Document.chart('Bar', 'Bad', 'sales', 'nope', ['a']), Document.chart('Bar', 'Lost', 'gone', 'month', ['a'])])
  const root = Document.tree(doc, [sales])
  const [chart, bad, lost] = root.children
  assert.deepEqual([chart.kind, chart.chart, chart.labels], ['chart', 'Line', [1, 2]])
  assert.deepEqual(chart.series, [{ name: 'a', values: [10, 30], paths: [['sales', 1, 1], ['sales', 2, 1]] }, { name: 'b', values: [20, 40], paths: [['sales', 1, 2], ['sales', 2, 2]] }])
  assert.deepEqual([bad.kind, lost.kind], ['missing', 'missing'])
  const page = Html.generateHtml({ children: [chart] }, 'n', 'window.marks = 1')
  assert.ok(page.includes('class="chart" data-chart="'))
  assert.ok(page.includes('<script type="module" nonce="n">window.marks = 1</script>'))
})

test('scope picks what the cursor is on: a variable, the binding or function around it, or nothing', () => {
  const src = 'val sales = [\n  ["a"],\n  [1]\n]\n\nval total = 75\n\nfun report(x) =\n  sales.length + x\n'
  const names = ['sales', 'total']
  const at = (s) => Scope.names(src, src.indexOf(s), names)
  assert.deepEqual(at('sales ='), ['sales'])
  assert.deepEqual(at('[1]'), ['sales'])
  assert.deepEqual(at('75'), ['total'])
  assert.deepEqual(at('x)'), ['sales'])
  assert.deepEqual(Scope.names('// notes\nval total = 1\n', 2, ['total']), [])
  assert.deepEqual(at('\n\nval total').length, 1)
  assert.deepEqual(Scope.names(src, src.indexOf('\n\nval total') + 1, names), [])
  assert.deepEqual(Scope.names('\n', 0, names), [])
  const root = { kind: 'document', children: [{ kind: 'table', key: 'sales' }, { kind: 'chart', key: 'C', source: 'sales' }, { kind: 'atom', key: 'total' }] }
  assert.deepEqual(Document.focus(root, ['sales']).children.map((i) => i.key), ['sales', 'C'])
  assert.equal(Document.focus(root, []).children.length, 3)
  assert.equal(Document.focus(root, ['nothing']).children.length, 3)
})
