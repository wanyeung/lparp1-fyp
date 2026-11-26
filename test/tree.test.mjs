import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { compileFile, importFresh } from '../runtime/compile.mjs'
import Primitive from '../build/library/model/Primitive.mjs'
import Document from '../build/library/model/Document.mjs'
import Source from '../build/library/service/Source.mjs'
import SourceEdit from '../build/library/service/SourceEdit.mjs'
import Html from '../build/library/service/Html.mjs'
import Controller from '../build/library/controller/Controller.mjs'

const root = path.resolve(import.meta.dirname, '..')
const text = await readFile(path.join(root, 'test', 'fixtures', 'nested.mls'), 'utf8')

const inventory = { title: 'Warehouse', stock: [['item', 'units'], ['Tea', 30], ['Coffee', 45]], tags: ['fresh', 'bulk'], owner: { name: 'Ann', floor: 2 } }
const teams = [{ name: 'Engineering', size: 12 }, { name: 'Design', size: 4 }]
const payload = {
  exports: { _$_modulePrivate_$_inventory: inventory, _$_modulePrivate_$_teams: teams, _$_modulePrivate_$_total: 75, _$_modulePrivate_$_report: () => 0 },
  source: text,
  file: 'n.mls',
}
const primitives = Controller.primitives(payload)
const tree = Controller.tree(Controller.document(payload), primitives)
const shape = (nodes) => nodes.map((n) => [n.key, n.kind])
const at = (needle, delta = 0) => Controller.scope(tree, text, text.indexOf(needle) + delta)

test('primitive nests: a block holds tables, lists, atoms and blocks, and a list can hold blocks', () => {
  assert.deepEqual(primitives.map((p) => p.key), ['inventory', 'teams', 'total'])
  const [inv, people] = primitives
  assert.deepEqual(inv.children.map((c) => [c.key, c.kind]), [['title', 'atom'], ['stock', 'table'], ['tags', 'list'], ['owner', 'block']])
  assert.deepEqual(inv.children[1].path, ['inventory', 'stock'])
  assert.deepEqual(inv.children[3].children.map((c) => c.path), [['inventory', 'owner', 'name'], ['inventory', 'owner', 'floor']])
  assert.equal(people.kind, 'list')
  assert.deepEqual(people.rows, [])
  assert.deepEqual(people.children.map((c) => [c.key, c.kind]), [['0', 'block'], ['1', 'block']])
  assert.deepEqual(people.children[0].path, ['teams', 0])
  assert.deepEqual(people.children[0].children[1].path, ['teams', 0, 'size'])
})

test('primitive keeps flat lists and tables as leaves, and nests anything with a structure in a cell', () => {
  assert.deepEqual(Primitive.make('l', [1, 2]).children, [])
  assert.equal(Primitive.make('t', [['a'], [1]]).children.length, 0)
  const mixed = Primitive.make('x', [[1, { a: 1 }]])
  assert.equal(mixed.kind, 'list')
  assert.equal(mixed.children[0].kind, 'list')
  assert.deepEqual(mixed.children[0].children.map((c) => c.kind), ['atom', 'block'])
})

test('primitive finds a nested node by name', () => {
  assert.equal(Primitive.find(primitives, 'stock')[0].kind, 'table')
  assert.deepEqual(Primitive.find(primitives, 'floor')[0].rows, [[2]])
  assert.equal(Primitive.find(primitives, 'inventory')[0].kind, 'block')
  assert.deepEqual(Primitive.find(primitives, 'nope'), [])
})

test('controller leaves functions out of the primitives', () => {
  assert.ok(!primitives.some((p) => p.key === 'report'))
})

test('document tree: sheets are the leaves, blocks and lists of structures are sections', () => {
  assert.equal(tree.kind, 'document')
  assert.equal(tree.file, 'n.mls')
  assert.deepEqual(shape(tree.children), [['inventory', 'block'], ['teams', 'list'], ['total', 'atom']])
  const inv = tree.children[0]
  assert.deepEqual(shape(inv.children), [['title', 'atom'], ['stock', 'table'], ['tags', 'list'], ['owner', 'block']])
  assert.deepEqual(shape(inv.children[3].children), [['name', 'atom'], ['floor', 'atom']])
  const first = tree.children[1].children[0]
  assert.deepEqual([first.key, first.kind], ['0', 'block'])
  assert.deepEqual(shape(first.children), [['name', 'atom'], ['size', 'atom']])
})

test('document tree: every sheet knows its path and the literal each cell maps to', () => {
  const stock = tree.children[0].children[1]
  const tags = tree.children[0].children[2]
  const floor = tree.children[0].children[3].children[1]
  assert.deepEqual(stock.path, ['inventory', 'stock'])
  assert.deepEqual(Primitive.cellPath(stock, 1, 1), ['inventory', 'stock', 2, 1])
  assert.deepEqual(Primitive.cellPath(tags, 1, 0), ['inventory', 'tags', 1])
  assert.deepEqual(Primitive.cellPath(floor, 0, 0), ['inventory', 'owner', 'floor'])
})

const declared = Document.custom('D', 'n.mls', [
  Document.text('# Report'),
  Document.useAs('stock', 'Stock'),
  Document.chart('Bar', 'Units', 'stock', 'item', ['units']),
  Document.use('owner'),
  Document.use('gone'),
])
const declaredTree = Document.tree(declared, primitives)

test('document tree: a document imports nested nodes by name and charts nested tables', () => {
  assert.deepEqual(declaredTree.children.map((n) => n.kind), ['text', 'table', 'chart', 'block', 'missing'])
  assert.equal(declaredTree.children[1].name, 'Stock')
  assert.deepEqual(declaredTree.children[1].path, ['inventory', 'stock'])
  assert.deepEqual(declaredTree.children[2].labels, ['Tea', 'Coffee'])
  assert.deepEqual(declaredTree.children[2].series, [{ name: 'units', values: [30, 45], paths: [['inventory', 'stock', 1, 1], ['inventory', 'stock', 2, 1]] }])
  assert.deepEqual(shape(declaredTree.children[3].children), [['name', 'atom'], ['floor', 'atom']])
})

test('document names list every nameable node and skip list positions', () => {
  const names = Document.names(tree)
  for (const name of ['inventory', 'stock', 'owner', 'floor', 'teams', 'size', 'total']) assert.ok(names.includes(name), name)
  assert.ok(!names.includes('0'))
  assert.ok(!names.includes('1'))
  assert.ok(!names.includes(''))
})

test('focus keeps the parents of a match, and a match on a block keeps everything under it', () => {
  const only = (names) => Document.focus(tree, names)
  const stock = only(['stock'])
  assert.equal(stock.kind, 'document')
  assert.deepEqual(shape(stock.children), [['inventory', 'block']])
  assert.deepEqual(shape(stock.children[0].children), [['stock', 'table']])
  const owner = only(['owner'])
  assert.deepEqual(shape(owner.children[0].children), [['owner', 'block']])
  assert.equal(owner.children[0].children[0].children.length, 2)
  assert.equal(only(['inventory']).children[0].children.length, 4)
  assert.deepEqual(shape(only(['total']).children), [['total', 'atom']])
  assert.equal(only([]).children.length, 3)
  assert.equal(only(['nothing']).children.length, 3)
  assert.equal(tree.children.length, 3)
})

test('focus follows a chart to its table and keeps markdown out', () => {
  const focused = Document.focus(declaredTree, ['stock'])
  assert.deepEqual(focused.children.map((n) => n.kind), ['table', 'chart'])
})

test('scope on a variable shows its whole subtree, on a field only that field under its parents', () => {
  const onVariable = at('inventory = {')
  assert.deepEqual(onVariable.names, ['inventory'])
  assert.equal(onVariable.tree.children.length, 1)
  assert.equal(onVariable.tree.children[0].children.length, 4)
  const onField = at('stock: [')
  assert.deepEqual(onField.names, ['stock'])
  assert.deepEqual(shape(onField.tree.children), [['inventory', 'block']])
  assert.deepEqual(shape(onField.tree.children[0].children), [['stock', 'table']])
  const deep = at('floor: 2')
  assert.deepEqual(shape(deep.tree.children[0].children), [['owner', 'block']])
  assert.deepEqual(shape(deep.tree.children[0].children[0].children), [['floor', 'atom']])
})

test('scope inside a nested literal falls back to the variable around it', () => {
  const inCell = at('"Coffee"', 2)
  assert.deepEqual(inCell.names, ['inventory'])
  assert.equal(inCell.tree.children[0].children.length, 4)
  const inList = at('size: 4')
  assert.deepEqual(inList.names, ['size'])
  const people = inList.tree.children[0]
  assert.deepEqual(people.children.map((c) => c.key), ['0', '1'])
  assert.deepEqual(people.children.map((c) => c.children.map((x) => x.key)), [['size'], ['size']])
})

test('scope on a function shows what it mentions, and on a blank line the whole tree', () => {
  const inFunction = at('x) =')
  assert.deepEqual(inFunction.names, ['inventory', 'stock'])
  assert.deepEqual(shape(inFunction.tree.children), [['inventory', 'block']])
  const blank = at('\n\nval teams', 1)
  assert.deepEqual(blank.names, [])
  assert.deepEqual(shape(blank.tree.children), shape(tree.children))
  assert.deepEqual(at('val total').names, ['total'])
})

test('source locates literals at any depth, in records, arrays and lists of records', () => {
  const span = (p) => text.slice(...Source.locate(text, p))
  assert.equal(span(['inventory', 'stock', 2, 1]), '45')
  assert.equal(span(['inventory', 'owner', 'name']), '"Ann"')
  assert.equal(span(['inventory', 'tags', 1]), '"bulk"')
  assert.equal(span(['teams', 1, 'size']), '4')
  assert.equal(span(['total']), '75')
  assert.ok(span(['inventory', 'stock']).startsWith('[') && span(['inventory', 'stock']).endsWith(']'))
  assert.equal(Source.locate(text, ['inventory', 'nope']), null)
  assert.equal(Source.locate(text, ['inventory', 'stock', 9, 0]), null)
  assert.equal(Source.locate(text, ['inventory', 0]), null)
  assert.equal(Source.locate(text, ['gone']), null)
})

test('source skips comments, trailing commas and commas inside strings', () => {
  const messy = 'val a = {\n  // note\n  x: [1, 2, // two\n 3,],\n  y: "a, b" // tail\n}\nval b = 5\n'
  const span = (p) => messy.slice(...Source.locate(messy, p))
  assert.equal(span(['a', 'x', 2]), '3')
  assert.equal(span(['a', 'x', 1]), '2')
  assert.equal(span(['a', 'y']), '"a, b"')
  assert.equal(span(['b']), '5')
})

test('source edit rewrites one nested literal and leaves the rest of the file alone', () => {
  assert.equal(SourceEdit.at(text, ['inventory', 'stock', 2, 1], '50').source, text.replace('["Coffee", 45]', '["Coffee", 50]'))
  assert.equal(SourceEdit.at(text, ['inventory', 'owner', 'name'], 'Bo').source, text.replace('"Ann"', '"Bo"'))
  assert.equal(SourceEdit.at(text, ['inventory', 'tags', 0], 'cold').source, text.replace('"fresh"', '"cold"'))
  assert.equal(SourceEdit.at(text, ['teams', 1, 'size'], '9').source, text.replace('size: 4', 'size: 9'))
  assert.equal(SourceEdit.at(text, ['total'], '80').source, text.replace('val total = 75', 'val total = 80'))
  assert.equal(SourceEdit.at(text, ['teams', 0, 'size'], 'many').ok, false)
  assert.equal(SourceEdit.at(text, ['inventory', 'owner'], '1').ok, false)
  assert.equal(SourceEdit.at(text, ['inventory', 'stock'], '1').ok, false)
  assert.equal(SourceEdit.at(text, ['inventory', 'nope'], '1').ok, false)
})

test('controller maps a cell of a nested sheet to its literal', () => {
  const stock = Primitive.find(primitives, 'stock')[0]
  const table = Controller.edit({ source: text, path: stock.path, kind: stock.kind, row: 1, col: 1, text: '50' })
  assert.equal(table.source, text.replace('["Coffee", 45]', '["Coffee", 50]'))
  const list = Controller.edit({ source: text, path: ['inventory', 'tags'], kind: 'list', row: 1, col: 0, text: 'cold' })
  assert.equal(list.source, text.replace('"bulk"', '"cold"'))
  const atom = Controller.edit({ source: text, path: ['teams', 0, 'size'], kind: 'atom', row: 0, col: 0, text: '13' })
  assert.equal(atom.source, text.replace('size: 12', 'size: 13'))
  const top = Controller.edit({ source: text, path: ['total'], kind: 'atom', row: 0, col: 0, text: '80' })
  assert.equal(top.source, text.replace('val total = 75', 'val total = 80'))
})

test('html renders the tree: sections nest, nested sheets stay editable and carry their path', () => {
  const html = Html.generateHtml(tree, 'n', '')
  assert.equal(html.match(/class="block"/g).length, 5)
  assert.ok(html.includes('<small>block</small>'))
  assert.ok(html.includes('<small>list</small>'))
  assert.ok(html.includes('data-path="[&quot;inventory&quot;,&quot;owner&quot;,&quot;floor&quot;]"'))
  assert.ok(html.includes('data-path="[&quot;inventory&quot;,&quot;stock&quot;]"'))
  assert.ok(html.includes('data-path="[&quot;teams&quot;,1,&quot;size&quot;]"'))
  assert.ok(html.includes('path: JSON.parse(t.dataset.path)'))
  assert.ok(!html.includes('data-name='))
  const imported = Html.generateHtml(declaredTree, 'n', '')
  assert.ok(imported.includes('Stock'))
  assert.ok(imported.includes('Not found: gone'))
  assert.ok(imported.includes('<h2>Report</h2>'))
})

test('a nested cell is edited in the source, and the next run shows it', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'tree-'))
  const file = path.join(dir, 'nested.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'nested.mls'), file)
  const run = async () => {
    const compiled = await compileFile(file)
    assert.ok(compiled.ok)
    const exports = await importFresh(file.replace(/\.mls$/, '.mjs'))
    const source = await readFile(file, 'utf8')
    return { source, primitives: Controller.primitives({ exports, source, file }) }
  }
  const before = await run()
  assert.deepEqual(before.primitives.map((p) => p.key), ['inventory', 'teams', 'total'])
  const stock = Primitive.find(before.primitives, 'stock')[0]
  assert.equal(stock.rows[1][1], 45)
  const first = Controller.edit({ source: before.source, path: stock.path, kind: stock.kind, row: 1, col: 1, text: '50' })
  assert.ok(first.ok)
  await writeFile(file, first.source)
  const middle = await run()
  assert.equal(Primitive.find(middle.primitives, 'stock')[0].rows[1][1], 50)
  const second = Controller.edit({ source: middle.source, path: ['teams', 1, 'size'], kind: 'atom', row: 0, col: 0, text: '9' })
  assert.ok(second.ok)
  await writeFile(file, second.source)
  const after = await run()
  assert.deepEqual(after.primitives[1].children[1].children[1].rows, [[9]])
  assert.equal(second.source, before.source.replace('["Coffee", 45]', '["Coffee", 50]').replace('size: 4', 'size: 9'))
})
