import { test } from 'node:test'
import assert from 'node:assert/strict'
import Primitive from '../build/library/model/Primitive.mjs'
import Sheet from '../build/library/model/Sheet.mjs'
import Document from '../build/library/model/Document.mjs'
import Chart from '../build/library/model/Chart.mjs'
import Source from '../build/library/service/Source.mjs'
import SourceEdit from '../build/library/service/SourceEdit.mjs'
import Html from '../build/library/service/Html.mjs'
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
  assert.deepEqual(block.children.map((c) => [c.name, c.kind]), [['total', 'atom'], ['rows', 'table'], ['inner', 'block']])
})

test('rename changes the title and keeps the source name', () => {
  const renamed = Primitive.rename(Primitive.make('sales', [['a'], [1]]), 'Revenue')
  assert.equal(renamed.title, 'Revenue')
  assert.equal(renamed.name, 'sales')
})

test('sheet records the file it references and whether it is derived', () => {
  const base = Sheet.make('base', 'a.mls', [Primitive.make('x', 1)])
  assert.deepEqual(base.meta, { file: 'a.mls', derived: false, sources: [] })
  const derived = Sheet.derive('view', 'b.mls', ['base'], [])
  assert.deepEqual(derived.meta, { file: 'b.mls', derived: true, sources: ['base'] })
})

test('a file can have several documents, and imports can rename and add text', () => {
  const available = [Primitive.make('sales', [['a'], [1]]), Primitive.make('total', 9)]
  const all = Document.ofFile('a.mls', available)
  const renamed = Document.custom('B', 'a.mls', [Document.useAs('sales', 'Revenue')])
  const report = Document.custom('C', 'a.mls', [Document.text('# Report'), Document.use('total'), Document.use('gone')])
  assert.deepEqual(Document.forFile([all, renamed, report, Document.custom('D', 'b.mls', [])], 'a.mls').map((d) => d.name), ['a.mls', 'B', 'C'])
  assert.deepEqual(Document.resolve(all, available).map((p) => p.title), ['sales', 'total'])
  assert.equal(Document.resolve(renamed, available)[0].title, 'Revenue')
  assert.deepEqual(Document.resolve(report, available).map((p) => p.kind), ['markdown', 'atom', 'missing'])
  assert.equal(Document.ofSheet(Sheet.make('s', 'a.mls', available)).file, 'a.mls')
})

test('chart lists the chart types', () => {
  assert.deepEqual([Chart.Bar, Chart.Line, Chart.Pie], ['Bar', 'Line', 'Pie'])
  assert.deepEqual(Chart.all, ['Bar', 'Line', 'Pie'])
})

test('source locates a cell and skips commas inside strings', () => {
  const [from, to] = Source.locate(source, 'sales', 2, 0)
  assert.equal(source.slice(from, to), '"Coffee, hot"')
  assert.equal(Source.locate(source, 'sales', 9, 0), null)
  assert.equal(Source.locate(source, 'missing', 0, 0), null)
})

test('source ignores a binding that only appears in a comment', () => {
  const text = '// val sales = [[1]]\n' + source
  const [from, to] = Source.locate(text, 'sales', 1, 1)
  assert.equal(text.slice(from, to), '30')
})

test('source edit keeps the literal type', () => {
  assert.equal(SourceEdit.setCell(source, 'sales', 1, 1, '31').source, source.replace('30', '31'))
  assert.equal(SourceEdit.setCell(source, 'sales', 1, 0, 'Matcha').source, source.replace('"Tea"', '"Matcha"'))
  assert.equal(SourceEdit.setCell(source, 'sales', 1, 1, 'abc').ok, false)
  assert.equal(SourceEdit.setCell(source, 'sales', 1, 1, '').ok, false)
})

test('controller turns exports into primitives, a sheet and a document, and shifts past the header row', () => {
  const payload = { exports: { _$_modulePrivate_$_sales: [['a'], [1]], other: 1 }, source, file: 'a.mls' }
  assert.deepEqual(Controller.primitives(payload).map((p) => p.name), ['sales'])
  assert.equal(Controller.sheet(payload).meta.file, 'a.mls')
  assert.deepEqual(Controller.document(payload).entries.map((e) => e.name), ['sales'])
  const ordered = Controller.primitives({ exports: { _$_modulePrivate_$_b: 1, _$_modulePrivate_$_a: 2 }, source: 'val b = 1\nval a = 2\n' })
  assert.deepEqual(ordered.map((p) => p.name), ['b', 'a'])
  const edit = Controller.edit({ source, name: 'sales', kind: 'table', row: 0, col: 1, text: '99' })
  assert.equal(edit.source, source.replace('30', '99'))
})

test('html escapes values, carries the nonce, shows titles, and keeps blocks and markdown read-only', () => {
  const page = Html.generateHtml([Primitive.make('t', [['<b>'], ['a&b']])], 'abc', '')
  assert.ok(page.includes('&lt;b&gt;'))
  assert.ok(page.includes('a&amp;b'))
  assert.ok(page.includes('nonce="abc"'))
  assert.ok(!page.includes('<b>'))
  const items = [Primitive.rename(Primitive.make('t', [['a'], [1]]), 'Shown'), Primitive.make('b', { x: [['h'], [2]] }), { kind: 'markdown', text: '# Head\nbody <i>' }, { kind: 'missing', name: 'gone' }]
  const html = Html.generateHtml(items, 'n', '')
  assert.ok(html.includes('Shown'))
  assert.ok(html.includes('data-name="t"'))
  assert.ok(!html.includes('data-name="x"'))
  assert.ok(html.includes('<h2>Head</h2>'))
  assert.ok(html.includes('body &lt;i&gt;'))
  assert.ok(html.includes('Not found: gone'))
})

test('grid treats an empty array as an empty list', () => {
  assert.deepEqual(Primitive.make('e', []).rows, [])
})

test('a document can chart columns of a table, and the page carries the chart script', () => {
  const sales = Primitive.make('sales', [['month', 'a', 'b'], [1, 10, 20], [2, 30, 40]])
  const doc = Document.custom('D', 'a.mls', [Document.chart(Chart.Line, 'Both', 'sales', 'month', ['a', 'b']), Document.chart(Chart.Bar, 'Bad', 'sales', 'nope', ['a']), Document.chart(Chart.Bar, 'Lost', 'gone', 'month', ['a'])])
  const [chart, bad, lost] = Document.resolve(doc, [sales])
  assert.deepEqual([chart.kind, chart.chart, chart.labels], ['chart', 'Line', [1, 2]])
  assert.deepEqual(chart.series, [{ name: 'a', values: [10, 30] }, { name: 'b', values: [20, 40] }])
  assert.deepEqual([bad.kind, lost.kind], ['missing', 'missing'])
  const page = Html.generateHtml([chart], 'n', 'window.MlsCharts = 1')
  assert.ok(page.includes('class="chart" data-chart="'))
  assert.ok(page.includes('<script nonce="n">window.MlsCharts = 1</script>'))
})

test('scope picks what the cursor is on: a variable, the binding or function around it, or nothing', () => {
  const src = 'val sales = [\n  ["a"],\n  [1]\n]\n\nval total = 75\n\nfun report(x) =\n  sales.length + x\n'
  const names = ['sales', 'total']
  const at = (s) => Controller.focus(src, src.indexOf(s), names)
  assert.deepEqual(at('sales ='), ['sales'])
  assert.deepEqual(at('[1]'), ['sales'])
  assert.deepEqual(at('75'), ['total'])
  assert.deepEqual(at('x)'), ['sales'])
  assert.deepEqual(Controller.focus('// notes\nval total = 1\n', 2, ['total']), [])
  assert.deepEqual(at('\n\nval total').length, 1)
  assert.deepEqual(Controller.focus(src, src.indexOf('\n\nval total') + 1, names), [])
  assert.deepEqual(Controller.focus('\n', 0, names), [])
  const items = [{ name: 'sales', kind: 'table' }, { name: 'C', kind: 'chart', source: 'sales' }, { name: 'total', kind: 'atom' }]
  assert.deepEqual(Document.focus(items, ['sales']).map((i) => i.name), ['sales', 'C'])
  assert.equal(Document.focus(items, []).length, 3)
  assert.equal(Document.focus(items, ['nothing']).length, 3)
})
