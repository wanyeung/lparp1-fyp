import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const root = path.resolve(import.meta.dirname, '..')
const exec = promisify(execFile)

test('the vscode host runner prints the sheet and document of a saved file', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'host-'))
  const file = path.join(dir, 'demo.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'demo.mls'), file)
  const { stdout } = await exec(process.execPath, [path.join(root, 'vscodehost', 'run.mjs'), file])
  const result = JSON.parse(stdout.trim().split('\n').pop())
  assert.ok(result.ok)
  assert.deepEqual(result.sheet.primitives.map((g) => [g.name, g.kind]), [['sales', 'table'], ['teams', 'list'], ['total', 'atom']])
  assert.equal(result.sheet.meta.file, file)
  assert.equal(result.document.file, file)
})

test('the vscode host runner reports compile errors instead of crashing', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'host-'))
  const file = path.join(dir, 'broken.mls')
  await writeFile(file, 'val x = [1,\n')
  const { stdout } = await exec(process.execPath, [path.join(root, 'vscodehost', 'run.mjs'), file])
  const result = JSON.parse(stdout.trim().split('\n').pop())
  assert.equal(result.ok, false)
  assert.ok(result.error.length > 0)
})

