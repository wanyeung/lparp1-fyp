// End-to-end check of: parse notebook -> assemble prefix -> real runner -> events -> cell mapping.
// Needs the real compiler bundle:  node test/e2e.mjs [path/to/MLscript.mjs]
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseImlsnb } from '../out/notebook/format.js'
import { assemblePrefix, locate, CELL_MARK } from '../out/notebook/assemble.js'
import { startRunner } from '../out/notebook/runnerClient.js'
import { patchGridSource } from '../out/notebook/gridPatch.js'
import { buildGridModel } from '../out/core/structure.js'
import { applyGridOp } from '../out/core/sourceEdit.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const bundle = process.argv[2] ?? path.join(here, '..', '..', 'sheetbook-poc', 'build', 'MLscript.mjs')
const stdDir = path.join(path.dirname(bundle), '..', 'vendors', 'std')
const runnerPath = path.join(here, '..', 'runner', 'run.mjs')

function run(cells) {
  const asm = assemblePrefix(cells)
  const events = []
  const h = startRunner({ nodeBinary: process.execPath, electronAsNode: false, runnerPath, bundle, stdDir, source: asm.source, timeoutMs: 60000 }, e => events.push(e))
  return h.finished.then(() => ({ asm, events }))
}
// attribute logs to cells exactly like controller.ts does
function attribute(events, first) {
  let cur = first; const out = {}
  for (const e of events) if (e.t === 'log') {
    const a0 = e.args[0]
    if (typeof a0 === 'string' && a0.startsWith(CELL_MARK)) { cur = Number(a0.slice(CELL_MARK.length)); continue }
    ;(out[cur] ??= []).push(e.args)
  }
  return out
}

// 1. the sample notebook runs, and grid/chart land on the right cells
const nb = parseImlsnb(fs.readFileSync(path.join(here, '..', 'sample', 'demo.imlsnb'), 'utf8'))
const cells = nb.map((c, i) => ({ index: i, source: c.source }))
let { events } = await run(cells)
assert.ok(events.find(e => e.t === 'done' && e.ok), 'run should finish ok: ' + JSON.stringify(events.filter(e => e.t !== 'log')))
let by = attribute(events, 0)
assert.deepEqual(by[0][0], ['loaded', 3, 'rows'])
assert.equal(by[0][1][0].kind, 'grid'); assert.equal(by[0][1][0].rows.length, 3)
assert.equal(by[1][0][0].kind, 'chart'); assert.equal(by[1][0][0].spec.data.values.length, 3)
assert.equal(by[2][0][0].rows.length, 4); assert.equal(by[2][0][0].rows[1].product, 'Coffee')   // table B differs from table A
assert.equal(by[3][0][0].spec.data.values.length, 4)
console.log('1. sample notebook (A and B pairs): OK')

// 2. grid edit -> patched source -> re-run shows the new value (the whole "edits patch the code" loop)
cells[0].source = patchGridSource(cells[0].source, 1, 'value', '99')
;({ events } = await run(cells)); by = attribute(events, 0)
assert.equal(by[0][1][0].rows[1].value, 99)
assert.equal(by[1][0][0].spec.data.values[1].value, 99, 'chart must follow the patched code')
console.log('2. grid edit patches code and re-run updates grid + chart: OK')

// 3. a compile error is mapped back to the right cell + line
const bad = [{ index: 0, source: 'let a = 1' }, { index: 1, source: 'let b = 2\nlet c = undefinedName + 1' }]
let r = await run(bad)
const diag = r.events.find(e => e.t === 'diagnostics').items.find(d => d.kind === 'error')
assert.ok(diag, 'expected an error diagnostic')
const where = locate(r.asm, bad, diag.start)
assert.equal(where.index, 1); assert.equal(where.line, 2)
assert.ok(r.events.find(e => e.t === 'done' && e.ok === false))
console.log('3. compile error mapped to cell', where.index, 'line', where.line, ': OK  ->', diag.message)

// 4. a runtime error is reported and attributed to the cell that was running
r = await run([{ index: 0, source: 'console.log("ok")' }, { index: 1, source: 'throw Error("boom")' }])
const err = r.events.find(e => e.t === 'error')
assert.equal(err.message, 'boom')
assert.equal(Object.keys(attribute(r.events, 0)).join(), '0')
console.log('4. runtime error: OK')

// 6. every grid shape in the sample notebook runs, and the inferred model matches the code
{
  const cs = parseImlsnb(fs.readFileSync(path.join(here, '..', 'sample', 'demo.imlsnb'), 'utf8')).map((c, i) => ({ index: i, source: c.source }))
  const { events: ev } = await run(cs)
  assert.ok(ev.find(e => e.t === 'done' && e.ok), 'sample must run: ' + JSON.stringify(ev.filter(e => e.t === 'diagnostics')))
  const b = attribute(ev, 0)
  const model = (i, v) => buildGridModel(b[i][0][0].value, cs[i].source, v)
  assert.equal(model(4, 'scoresC').kind, 'list')
  const d = model(5, 'rowsD')
  assert.equal(d.kind, 'table')
  const cell = (m, r, label) => m.rows[r].cells[m.columns.findIndex(c => c.label === label)]
  assert.equal(cell(d, 0, 'units').text, '40'); assert.equal(cell(d, 0, 'units').formula, 'rowsB.0.units')   // value from rowsB, expression kept
  assert.equal(cell(d, 1, 'units').text, '130'); assert.equal(cell(d, 2, 'units').empty, true)               // formula * 2; ragged row
  assert.equal(model(6, 'settingsE').kind, 'block')
  assert.equal(model(7, 'salesF').kind, 'hierarchical')
  assert.equal(model(8, 'matrixG').kind, 'table')
  console.log('6. sample shapes (list, ragged table + formulas, block, hierarchical, 2D) run and are inferred: OK')
}

// 7. grid operations produce code the real compiler accepts, and the re-run shows the effect
{
  const base = parseImlsnb(fs.readFileSync(path.join(here, '..', 'sample', 'demo.imlsnb'), 'utf8')).map((c, i) => ({ index: i, source: c.source }))
  const edit = (cs, i, v, op) => { const r = applyGridOp(cs[i].source, v, op); assert.ok('source' in r, JSON.stringify(r)); cs = cs.map(c => ({ ...c })); cs[i].source = r.source; return cs }
  const data = async (cs, i) => { const { events: ev } = await run(cs); assert.ok(ev.find(e => e.t === 'done' && e.ok), 'run failed: ' + JSON.stringify(ev.filter(e => e.t === 'diagnostics' || e.t === 'error')) + '\n' + cs[i].source); const g = attribute(ev, 0)[i][0][0]; return g.value ?? g.rows }

  let cs = edit(base, 2, 'rowsB', { op: 'add' })                                         // add a row to a table
  assert.equal((await data(cs, 2)).length, 5)
  cs = edit(base, 2, 'rowsB', { op: 'delete', row: 1 })                                   // delete the second
  assert.deepEqual((await data(cs, 2)).map(r => r.product), ['Tea', 'Cocoa', 'Matcha'])
  cs = edit(base, 5, 'rowsD', { op: 'add' })                                              // add to the ragged table
  assert.equal((await data(cs, 5)).length, 4)
  cs = edit(base, 5, 'rowsD', { op: 'set', row: 2, path: ['units'], value: '=rowsB.2.units + 1' })   // fill an empty cell with a formula
  assert.equal((await data(cs, 5))[2].units, 26)
  cs = edit(base, 5, 'rowsD', { op: 'set', row: 0, path: ['note'], value: '' })           // clear a cell: the field goes away
  assert.equal('note' in (await data(cs, 5))[0], false)
  cs = edit(base, 4, 'scoresC', { op: 'add' }); assert.equal((await data(cs, 4)).length, 5)
  cs = edit(base, 4, 'scoresC', { op: 'set', row: 1, path: [], value: '=total(rowsB)' })  // a formula calling a function defined in an earlier cell
  cs[0].source = 'fun total(rs) = rs.map(r => r.units).reduce((a, b) => a + b, 0)\n' + cs[0].source
  assert.equal((await data(cs, 4))[1], 185)
  cs = edit(base, 7, 'salesF', { op: 'add' }); assert.equal((await data(cs, 7)).length, 3)
  cs = edit(base, 7, 'salesF', { op: 'set', row: 0, path: ['q1', 'tea'], value: '99' }); assert.equal((await data(cs, 7))[0].q1.tea, 99)
  cs = edit(base, 8, 'matrixG', { op: 'add' }); assert.deepEqual((await data(cs, 8))[2], [0, 0, 0])
  cs = edit(base, 6, 'settingsE', { op: 'set', row: -1, path: ['target', 'score'], value: '95' }); assert.equal((await data(cs, 6)).target.score, 95)
  console.log('7. add / delete / set / clear / formula edits compile and re-run correctly: OK')

  // the documented limit: a table cannot reference itself (no recursive let)
  const self = edit(base, 2, 'rowsB', { op: 'set', row: 1, path: ['units'], value: '=rowsB.0.units + 1' })
  const { events: ev, asm: a2 } = await run(self)
  const dg = ev.find(e => e.t === 'diagnostics')?.items.find(d => d.kind === 'error')
  assert.ok(dg && /not found/i.test(dg.message), 'self-reference should fail to compile')
  assert.equal(locate(a2, self, dg.start).index, 2)
  console.log('   self-reference is a compile error on the right cell: OK ->', dg.message)
}

// 5. infinite loop is stopped by the timeout
const t0 = Date.now()
const asm = assemblePrefix([{ index: 0, source: 'while true do ()' }])
const evs = []
await startRunner({ nodeBinary: process.execPath, electronAsNode: false, runnerPath, bundle, stdDir, source: asm.source, timeoutMs: 1500 }, e => evs.push(e)).finished
console.log('5. timeout:', evs.filter(e => e.t === 'error').map(e => e.name).join() || '(none)', Date.now() - t0, 'ms')
console.log('e2e passed')
