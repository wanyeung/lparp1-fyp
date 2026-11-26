import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

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

test('the complex cases read shared tables as read-only imports that name their source file', async () => {
  const ending = await node('complex-usecases/case03/Analysis.mls', 'endingFigures')
  assert.equal(ending.origin, './shared/Portfolio.mls')
  assert.equal(ending.rows.length, 3)
  const chart = await node('complex-usecases/case03/Summary.mls', 'cumulativeChart')
  assert.equal(chart.series.length, 3)
  assert.equal(chart.series[0].paths[0], null)
  assert.equal((await node('complex-usecases/case04/SubscriptionReport.mls', 'comparison')).rows[0][4], 10)
})
