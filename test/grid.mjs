// Pure tests for the grid core: structure inference, the model, and source edits. No VS Code, no compiler.
import assert from 'node:assert/strict'
import { inferKind, buildGridModel, referenceFor, cellText } from '../out/core/structure.js'
import { applyGridOp, parse, valueSource } from '../out/core/sourceEdit.js'

const ok = r => { assert.ok('source' in r, JSON.stringify(r)); return r.source }

// ── inference ────────────────────────────────────────────────────────────────
assert.equal(inferKind(5), 'atom'); assert.equal(inferKind('x'), 'atom'); assert.equal(inferKind(null), 'atom')
assert.equal(inferKind([1, 2, 3]), 'list'); assert.equal(inferKind([]), 'list'); assert.equal(inferKind([1, 'a', null]), 'list')
assert.equal(inferKind([[1, 2], [3]]), 'table')
assert.equal(inferKind([{ a: 1 }, { b: 2 }]), 'table')                       // ragged records are still a table
assert.equal(inferKind([{ a: { b: 1 } }]), 'hierarchical')
assert.equal(inferKind({ a: 1 }), 'block')
assert.equal(inferKind([{ a: 1 }, 5]), 'list')                                // mixed -> list, shown as JSON, read-only
console.log('1. shape inference: OK')

// ── model: the starter notebook's shapes ────────────────────────────────────
const rowsB = 'let rowsB = [\n  mut { id: 1, product: "Tea", units: 40 },\n  mut { id: 2, product: "Coffee", units: 65 }\n]'
const tableD = 'let rowsD = [\n  mut { id: 1, item: "Tea", note: "bestseller", units: rowsB.0.units },\n  mut { id: 2, item: "Coffee", units: rowsB.1.units * 2 },\n  mut { id: 3, item: "Cocoa" }\n]'
const dVal = [{ id: 1, item: 'Tea', note: 'bestseller', units: 40 }, { id: 2, item: 'Coffee', units: 130 }, { id: 3, item: 'Cocoa' }]
let m = buildGridModel(dVal, tableD, 'rowsD')
assert.equal(m.kind, 'table'); assert.equal(m.rows.length, 3); assert.deepEqual(m.columns.map(c => c.label), ['id', 'item', 'note', 'units'])
const at = (r, label) => m.rows[r].cells[m.columns.findIndex(c => c.label === label)]
assert.equal(at(0, 'units').formula, 'rowsB.0.units'); assert.equal(at(1, 'units').formula, 'rowsB.1.units * 2')
assert.equal(at(0, 'units').text, '40')                                        // shows the value, remembers the expression
assert.equal(at(2, 'units').empty, true); assert.equal(at(2, 'units').editable, true)   // empty cell: can be filled in
assert.equal(at(1, 'note').empty, true); assert.equal(at(0, 'id').formula, undefined)
assert.ok(m.editable && m.canAddRows)
m = buildGridModel(['a'].map(() => 1), 'let xs = [72, 85]', 'xs')
assert.equal(m.kind, 'list'); assert.equal(m.rowHead, 'index')
m = buildGridModel({ title: 'Q', weeks: 6, target: { score: 80 } }, 'let s = mut { title: "Q", weeks: 6, target: mut { score: 80 } }', 's')
assert.equal(m.kind, 'block'); assert.deepEqual(m.rows.map(r => r.head), ['title', 'weeks', 'target.score']); assert.equal(m.canAddRows, false)
const sales = [{ region: 'N', q1: { tea: 1, coffee: 2 }, q2: { tea: 3, coffee: 4 } }]
m = buildGridModel(sales, 'let s = [mut { region: "N", q1: mut { tea: 1, coffee: 2 }, q2: mut { tea: 3, coffee: 4 } }]', 's')
assert.equal(m.kind, 'hierarchical'); assert.deepEqual(m.columns.map(c => c.label), ['region', 'q1.tea', 'q1.coffee', 'q2.tea', 'q2.coffee'])
assert.deepEqual(m.headers.map(l => l.map(h => [h.label, h.span, h.rowspan])), [[['region', 1, 2], ['q1', 2, 1], ['q2', 2, 1]], [['tea', 1, 1], ['coffee', 1, 1], ['tea', 1, 1], ['coffee', 1, 1]]])
m = buildGridModel([[1, 2, 3], [4, 5]], 'let g = [[1, 2, 3], [4, 5]]', 'g')
assert.equal(m.kind, 'table'); assert.deepEqual(m.columns.map(c => c.label), ['A', 'B', 'C']); assert.equal(m.rows[1].cells[2].empty, true)
// computed values show but are read-only, with a reason
m = buildGridModel([1, 2], 'let xs = base.filter(x => x > 0)', 'xs')
assert.equal(m.editable, false); assert.ok(m.reason); assert.equal(m.rows[0].cells[0].editable, false); assert.equal(m.canAddRows, false)
m = buildGridModel([1, 2, 3], 'let xs = [1, 2]', 'xs')                          // literal and value disagree
assert.equal(m.canAddRows, false)
assert.equal(referenceFor('rowsB', 2, ['units']), 'rowsB.2.units'); assert.equal(referenceFor('xs', 1, []), 'xs.1')
assert.equal(referenceFor('cfg', -1, ['target', 'score']), 'cfg.target.score'); assert.equal(referenceFor('g', 0, [2]), 'g.0.2')
assert.equal(cellText(null), ''); assert.equal(cellText(false), 'false'); assert.equal(cellText({ a: 1 }), '{"a":1}')
console.log('2. grid model (kinds, empty cells, formulas, read-only): OK')

// ── what the user typed -> source ────────────────────────────────────────────
assert.equal(valueSource('12'), '12'); assert.equal(valueSource('-3.5'), '-3.5'); assert.equal(valueSource('true'), 'true')
assert.equal(valueSource('Tea'), '"Tea"'); assert.equal(valueSource('"007"'), '"007"'); assert.equal(valueSource(''), null)
assert.equal(valueSource('=rowsB.1.units * 2'), 'rowsB.1.units * 2'); assert.equal(valueSource('='), null); assert.equal(valueSource(' undefined'), 'undefined')

// ── edits ────────────────────────────────────────────────────────────────────
// set
assert.ok(ok(applyGridOp(rowsB, 'rowsB', { op: 'set', row: 1, path: ['units'], value: '99' })).includes('units: 99 }'))
assert.ok(ok(applyGridOp(rowsB, 'rowsB', { op: 'set', row: 0, path: ['product'], value: 'Green tea' })).includes('product: "Green tea"'))
let s2 = ok(applyGridOp(rowsB, 'rowsB', { op: 'set', row: 0, path: ['units'], value: '=total(rowsA)' }))
assert.ok(s2.includes('units: total(rowsA) }'), s2); assert.equal(parse(s2, 'rowsB') !== null, true)
// a formula cell is edited as an expression, and can go back to a literal
s2 = ok(applyGridOp(tableD, 'rowsD', { op: 'set', row: 1, path: ['units'], value: '7' })); assert.ok(s2.includes('units: 7 }'))
// empty cell: the field is inserted; cleared cell: the field is removed
s2 = ok(applyGridOp(tableD, 'rowsD', { op: 'set', row: 2, path: ['units'], value: '5' })); assert.ok(s2.includes('mut { id: 3, item: "Cocoa", units: 5 }'), s2)
s2 = ok(applyGridOp(tableD, 'rowsD', { op: 'set', row: 0, path: ['note'], value: '' })); assert.ok(s2.includes('mut { id: 1, item: "Tea", units: rowsB.0.units }'), s2)
assert.equal(ok(applyGridOp(tableD, 'rowsD', { op: 'set', row: 2, path: ['units'], value: '' })), tableD)   // clearing an empty cell: nothing
// lists, 2D, block, hierarchical
const xs = 'let xs = [72, 85, 90]'
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'set', row: 1, path: [], value: '86' })), 'let xs = [72, 86, 90]')
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'set', row: 1, path: [], value: '' })), 'let xs = [72, undefined, 90]')
assert.equal(ok(applyGridOp('let g = [[1, 2], [3, 4]]', 'g', { op: 'set', row: 1, path: [0], value: '9' })), 'let g = [[1, 2], [9, 4]]')
const blk = 'let s = mut { title: "Q", target: mut { score: 80 } }'
assert.equal(ok(applyGridOp(blk, 's', { op: 'set', row: -1, path: ['target', 'score'], value: '90' })), 'let s = mut { title: "Q", target: mut { score: 90 } }')
assert.equal(ok(applyGridOp(blk, 's', { op: 'set', row: -1, path: ['weeks'], value: '6' })), 'let s = mut { title: "Q", target: mut { score: 80 }, weeks: 6 }')
assert.equal(ok(applyGridOp(blk, 's', { op: 'set', row: -1, path: ['extra', 'a'], value: '1' })), 'let s = mut { title: "Q", target: mut { score: 80 }, extra: mut { a: 1 } }')
assert.equal(ok(applyGridOp('let n = 5\nconsole.log(n)', 'n', { op: 'set', row: -1, path: [], value: '6' })), 'let n = 6\nconsole.log(n)')
console.log('3. set / clear / formula edits: OK')

// add / delete keep the literal's own layout
s2 = ok(applyGridOp(rowsB, 'rowsB', { op: 'add' }))
assert.equal(s2, 'let rowsB = [\n  mut { id: 1, product: "Tea", units: 40 },\n  mut { id: 2, product: "Coffee", units: 65 },\n  mut { id: 0, product: "", units: 0 }\n]')
s2 = ok(applyGridOp(rowsB, 'rowsB', { op: 'add', after: 0 }))
assert.equal(s2, 'let rowsB = [\n  mut { id: 1, product: "Tea", units: 40 },\n  mut { id: 0, product: "", units: 0 },\n  mut { id: 2, product: "Coffee", units: 65 }\n]')
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'add' })), 'let xs = [72, 85, 90, 0]')
assert.equal(ok(applyGridOp('let xs = []', 'xs', { op: 'add' })), 'let xs = [0]')
assert.equal(ok(applyGridOp('let g = [[1, 2], [3, 4]]', 'g', { op: 'add' })), 'let g = [[1, 2], [3, 4], [0, 0]]')
// a new row has every field any row has; computed fields are left out (a ragged row), strings default to ""
s2 = ok(applyGridOp(tableD, 'rowsD', { op: 'add' })); assert.ok(s2.includes('mut { id: 0, item: "", note: "" }'), s2)
assert.equal(ok(applyGridOp('let s = [mut { r: "N", q1: mut { t: 1 } }]', 's', { op: 'add' })), 'let s = [mut { r: "N", q1: mut { t: 1 } }, mut { r: "", q1: mut { t: 0 } }]')
// delete: first, middle, last, only
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'delete', row: 0 })), 'let xs = [85, 90]')
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'delete', row: 1 })), 'let xs = [72, 90]')
assert.equal(ok(applyGridOp(xs, 'xs', { op: 'delete', row: 2 })), 'let xs = [72, 85]')
assert.equal(ok(applyGridOp('let xs = [5]', 'xs', { op: 'delete', row: 0 })), 'let xs = []')
s2 = ok(applyGridOp(rowsB, 'rowsB', { op: 'delete', row: 1 })); assert.equal(s2, 'let rowsB = [\n  mut { id: 1, product: "Tea", units: 40 }\n]')
s2 = ok(applyGridOp(rowsB, 'rowsB', { op: 'delete', row: 0 })); assert.equal(s2, 'let rowsB = [\n  mut { id: 2, product: "Coffee", units: 65 }\n]')
assert.ok('error' in applyGridOp(rowsB, 'rowsB', { op: 'delete', row: 9 }))
// other statements in the cell survive
const withLog = rowsB + '\n\nconsole.log(mut { kind: "grid", cellId: "b", data: rowsB })'
assert.ok(ok(applyGridOp(withLog, 'rowsB', { op: 'delete', row: 0 })).endsWith('console.log(mut { kind: "grid", cellId: "b", data: rowsB })'))
console.log('4. add / delete rows keep the literal\'s layout: OK')

// not a literal -> an error, never a wrong edit
assert.ok('error' in applyGridOp('let xs = base.filter(x => x > 0)', 'xs', { op: 'add' }))
assert.ok('error' in applyGridOp('let xs = [...a, 1]', 'xs', { op: 'add' }))
assert.ok('error' in applyGridOp('let a = 1', 'zzz', { op: 'add' }))
// comments, strings with commas and brackets, nested formulas
const tricky = 'let rows = [\n  mut { a: "x, y]", b: f(1, [2, 3]) }, // first\n  mut { a: "z", b: 2 } /* second */\n]'
s2 = ok(applyGridOp(tricky, 'rows', { op: 'set', row: 1, path: ['b'], value: '7' })); assert.ok(s2.includes('b: 7 } /* second */'), s2)
s2 = ok(applyGridOp(tricky, 'rows', { op: 'delete', row: 0 })); assert.ok(s2.includes('mut { a: "z", b: 2 }'), s2)
assert.equal(parse(tricky, 'rows').root.items.length, 2)
console.log('5. non-literals refused, comments/strings/brackets handled: OK')
console.log('grid tests passed')
