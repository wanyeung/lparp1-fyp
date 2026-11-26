import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import Controller from '../build/library/controller/Controller.mjs'

const exec = promisify(execFile)
const root = path.resolve(import.meta.dirname, '..')
const worker = path.join(root, 'vscodehost', 'src', 'services', 'worker.mjs')
const dir = await mkdtemp(path.join(root, 'build', 'fixtures-'))
await cp(path.join(root, 'test', 'fixtures'), dir, { recursive: true })

const walk = async (folder) => (await Promise.all((await readdir(folder, { withFileTypes: true })).map((e) => e.isDirectory() ? walk(path.join(folder, e.name)) : [path.join(folder, e.name)]))).flat()
const files = (await walk(dir)).filter((f) => f.endsWith('.mls'))

const run = async (file) => {
  const { stdout } = await exec(process.execPath, [worker, file])
  return JSON.parse(stdout.trim().split('\n').pop())
}

const flat = (node) => [node, ...(node.children ?? []).flatMap(flat)]

test('every fixture builds, shows no missing node and has no NaN', async () => {
  for (const file of files) {
    const result = await run(file)
    assert.ok(result.ok, `${path.relative(dir, file)}: ${result.error}`)
    for (const node of flat(result.tree)) {
      assert.notEqual(node.kind, 'missing', `${path.relative(dir, file)}: ${node.key}`)
      assert.ok(!JSON.stringify(node.rows ?? []).includes('null'), `${path.relative(dir, file)}: ${node.key} has NaN or null`)
    }
  }
})

const node = async (file, name) => flat((await run(path.join(dir, file))).tree).find((n) => n.key === name)

test('the use cases compute the numbers their text promises', async () => {
  assert.deepEqual((await node('usecases/student-learning.mls', 'grades')).rows.map((r) => r[4]), [78, 78, 91.4])
  assert.deepEqual((await node('usecases/business-model.mls', 'contributions')).rows.map((r) => r[2]), [3120, 1760, 780])
  assert.equal((await node('usecases/business-model.mls', 'summary')).rows[0][3], 1660)
  assert.deepEqual((await node('usecases/algorithm-benchmark.mls', 'comparison')).rows.map((r) => r[3]), [1, 15.5, 12400 / 300, 1, 128000 / 1100, 320])
  assert.equal((await node('usecases/financial-analysis.mls', 'cashflow')).rows.at(-1)[4], 15000)
  assert.deepEqual((await node('usecases/financial-analysis.mls', 'reconciled')).rows[0], [46600, 46600])
  assert.ok(Math.abs((await node('usecases/experiment-measurements.mls', 'summary')).rows[0][1] - 102.4) < 1e-9)
})

test('case 03 reads shared tables as read-only imports that name their source file', async () => {
  const ending = await node('complex-usecases/case03/Analysis.mls', 'endingFigures')
  assert.equal(ending.origin, './shared/Portfolio.mls')
  assert.equal(ending.rows.length, 3)
  const chart = await node('complex-usecases/case03/Summary.mls', 'cumulativeChart')
  assert.equal(chart.series.length, 3)
  assert.equal(chart.series[0].paths[0], null)
})

test('case 03: the analysis has numbered sections and the brief states a conclusion from the data', async () => {
  for (const [key, heading] of [['inputsHeading', '# 1. Inputs'], ['monthlyHeading', '# 2. Monthly returns'], ['growthHeading', '# 3. Growth'], ['riskHeading', '# 4. Risk'], ['resultsHeading', '# 5. Results']]) {
    assert.ok((await node('complex-usecases/case03/Analysis.mls', key)).text.startsWith(heading), key)
  }
  const brief = await node('complex-usecases/case03/Summary.mls', 'briefFigures')
  assert.deepEqual(brief.headers, ['Allocation', 'Ending value (USD)', 'Cumulative return (%)', 'Worst drop from peak (%)'])
  assert.deepEqual(brief.rows.at(-1), ['Growth', 112940.24, 12.94, -8.31])
  const conclusion = (await node('complex-usecases/case03/Summary.mls', 'conclusion')).text
  assert.ok(conclusion.includes('Growth ended highest at USD 112,940.24'), conclusion)
  assert.ok(conclusion.includes('Growth had the worst drop from its peak: -8.31%'), conclusion)
  const cumulative = await node('complex-usecases/case03/Analysis.mls', 'cumulativeReturns')
  assert.deepEqual([cumulative.rows[0][0], cumulative.rows[1][0], cumulative.rows.at(-1)[0]], ['Start', 'Jan 2025', 'Jun 2026'])
  assert.deepEqual(cumulative.rows.at(-1), ['Jun 2026', 8.17, 11.41, 12.94])
  const assumptions = await node('complex-usecases/case03/Analysis.mls', 'assumptions')
  assert.deepEqual(assumptions.rows.map((r) => r[0]), ['Starting capital (USD)', 'Monthly cost (percentage points per month)'])
})

const report = 'complex-usecases/case04/SubscriptionReport.mls'

test('case 04: one file, units in the column names, and a draggable current vs proposed price chart', async () => {
  assert.equal((await node(report, 'assumptions')).origin, '')
  const comparison = await node(report, 'comparison')
  assert.deepEqual(comparison.headers, ['Scenario', 'Price (USD per subscriber per month)', 'Drink cost (USD per subscriber per month)', 'Contribution (USD per subscriber per month)'])
  assert.deepEqual(comparison.rows, [['Current', 60, 50, 10], ['Proposed', 75, 50, 25]])
  const chart = await node(report, 'currentVsProposedPrice')
  assert.deepEqual(chart.labels, ['Current', 'Proposed'])
  assert.deepEqual(chart.series[0].values, [60, 75])
  assert.deepEqual(chart.series[0].paths, [['assumptions', 1, 1], ['assumptions', 2, 1]])
  assert.equal(await node(report, 'assumptionsChart'), undefined)
})

test('case 04: editing the proposed price rewrites the literal and changes the comparison', async () => {
  const file = path.join(dir, report)
  const before = await readFile(file, 'utf8')
  const assumptions = await node(report, 'assumptions')
  const typed = Controller.edit({ source: before, path: assumptions.path, kind: assumptions.kind, header: false, row: 1, col: 1, text: '80' })
  assert.ok(typed.ok, typed.error)
  assert.ok(typed.source.includes('["Proposed", 80, 2.5, 20]'))
  assert.equal(typed.source.length, before.length)
  const dragged = Controller.edit({ source: before, path: (await node(report, 'currentVsProposedPrice')).series[0].paths[1], kind: 'atom', header: false, row: 0, col: 0, text: '80' })
  assert.equal(dragged.source, typed.source)
  try {
    await writeFile(file, typed.source)
    const comparison = flat((await run(file)).tree).find((n) => n.key === 'comparison')
    assert.deepEqual(comparison.rows[1], ['Proposed', 80, 50, 30])
  } finally {
    await writeFile(file, before)
  }
})

// Tries every header and cell of a table in its own file: only literal inputs may be rewritten.
const editable = async (file, key) => {
  const source = await readFile(path.join(dir, file), 'utf8')
  const table = await node(file, key)
  const tries = [
    ...table.headers.map((h, col) => ({ header: true, row: 0, col, text: 'x' })),
    ...table.rows.flatMap((row, r) => row.map((v, col) => ({ header: false, row: r, col, text: typeof v === 'string' ? 'x' : '1' }))),
  ]
  return tries.filter((t) => Controller.edit({ ...t, source, path: table.path, kind: table.kind }).ok).length
}

test('case 03 and 04: calculated tables cannot be typed over, literal inputs can', async () => {
  const portfolio = 'complex-usecases/case03/shared/Portfolio.mls'
  for (const key of ['portfolioReturnsTable', 'cumulativeReturnsTable', 'drawdownTable', 'endingFiguresTable', 'briefFiguresTable']) assert.equal(await editable(portfolio, key), 0, key)
  for (const key of ['monthlyAssetReturnsPercent', 'assumptionsTable', 'allocations']) assert.ok(await editable(portfolio, key) > 0, key)
  for (const key of ['comparison', 'change', 'sensitivity']) assert.equal(await editable(report, key), 0, key)
  assert.equal(await editable(report, 'assumptions'), 12)
})
