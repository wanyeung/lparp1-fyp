import assert from 'node:assert/strict'
import { parseImlsnb, serializeImlsnb, parsePercent, serializePercent } from '../out/notebook/format.js'
import { assemblePrefix, locate, CELL_MARK } from '../out/notebook/assemble.js'
import { patchGridSource } from '../out/notebook/gridPatch.js'

// .imlsnb round trip
const nb = JSON.stringify({version:1,cells:[{id:'data',title:'data',source:'let rows = []'},{id:'x',title:'t',source:'1'}]})
const cells = parseImlsnb(nb); assert.equal(cells.length,2)
assert.deepEqual(parseImlsnb(serializeImlsnb(cells)), cells)
assert.deepEqual(parseImlsnb(''), [])

// percent format
const pct = parsePercent('// %% data\nlet rows = [\n  1\n]\n\n// %% chart\nlet c = 2\n')
assert.deepEqual(pct.map(c=>[c.id,c.source]), [['data','let rows = [\n  1\n]'],['chart','let c = 2']])
assert.equal(parsePercent('let a = 1\nlet b = 2\n').length, 1)               // no markers -> one cell
assert.equal(serializePercent(parsePercent('let a = 1\n')), 'let a = 1\n')   // plain file stays plain
assert.deepEqual(parsePercent(serializePercent(pct)), pct)                    // round trip
assert.equal(parsePercent('before\n// %% a\nx\n').length, 2)                  // preamble kept as a cell
assert.equal(parsePercent('')[0].source, '')

// assemble + locate
const cs = [{index:0,source:'let a = 1'},{index:2,source:'let b =\n  undefinedName'}]
const asm = assemblePrefix(cs)
assert.ok(asm.source.includes(CELL_MARK+'0') && asm.source.includes(CELL_MARK+'2'))
const off = asm.source.indexOf('undefinedName')
assert.deepEqual(locate(asm, cs, off), {index:2,line:2,column:3})
assert.equal(locate(asm, cs, 3), undefined)  // inside the preamble

// grid patch
const src = 'let rows = [\n  mut { id: 1, label: "Alpha", value: 10 },\n  mut { id: 2, label: "Beta", value: 20 }\n]\n\nconsole.log(mut { kind: "grid", cellId: "data", rows: rows })'
assert.ok(patchGridSource(src,1,'value','99').includes('value: 99 }'))
assert.ok(patchGridSource(src,0,'label','Zed').includes('label: "Zed"'))
assert.ok(patchGridSource(src,0,'value','abc').includes('value: "abc"'))
assert.equal(patchGridSource(src,5,'value','1'), src)        // no such row
assert.ok(patchGridSource(src,0,'nope','1').includes('value: 10, nope: 1 }'))   // a missing field is inserted (ragged rows are allowed)
assert.ok(!patchGridSource(src,0,'id','7').includes('id: 1')) // doesn't touch other fields
assert.ok(patchGridSource(src,0,'id','7').includes('value: 10'))
console.log('unit tests passed')

// ---- viewModel ----------------------------------------------------------------
import { ViewModel, prettify, firstLetVar } from '../out/notebook/viewModel.js'
assert.equal(prettify('chartB'), 'Chart B'); assert.equal(prettify('rowsB'), 'Rows B')
assert.equal(prettify('rows'), 'Rows'); assert.equal(prettify('my_table'), 'My Table'); assert.equal(prettify('chartSpec'), 'Chart Spec')
assert.equal(firstLetVar('// c\nlet rowsB = [\n]'), 'rowsB')
const vm = new ViewModel()
const g = (cellId) => ({ kind: 'grid', cellId, rows: [{ a: 1 }] }), ch = (cellId) => ({ kind: 'chart', cellId, spec: {} })
vm.addGrid(0, 'let rowsA = []', g('dataA')); vm.addChart(1, 'let chartA = mut { values: rowsA }', ch('chartA'))
vm.addGrid(2, 'let rowsB = []', g('dataB')); vm.addChart(3, 'let chartB = mut { values: rowsB }', ch('chartB'))
const t = (sel) => [sel.grid?.title, sel.chart?.title]
assert.deepEqual(t(vm.select(0)), ['Rows A', 'Chart A'])   // cursor on rowsA
assert.deepEqual(t(vm.select(1)), ['Rows A', 'Chart A'])   // cursor on chartA
assert.deepEqual(t(vm.select(2)), ['Rows B', 'Chart B'])   // cursor on rowsB
assert.deepEqual(t(vm.select(3)), ['Rows B', 'Chart B'])   // cursor on chartB
assert.deepEqual(t(vm.select(7)), ['Rows B', 'Chart B'])   // an empty cell below -> closest above
assert.deepEqual(t(new ViewModel().select(0)), [undefined, undefined])
assert.equal(vm.grids[2 - 1].payload._cell, 2)             // edits know their cell
console.log('viewModel tests passed')
// the logged variable is found whichever key carries it
import { loggedVar } from '../out/notebook/viewModel.js'
assert.equal(loggedVar('let a = 1\nconsole.log(mut { kind: "grid", cellId: "x", value: scoresC })'), 'scoresC')
assert.equal(loggedVar('console.log(mut { kind: "grid", rows: rowsB })'), 'rowsB')
assert.equal(loggedVar('console.log(mut { kind: "grid", cellId: "x", rows: f(1) })'), undefined)
console.log('loggedVar tests passed')
