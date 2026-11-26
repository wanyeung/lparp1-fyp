import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const root = path.resolve(import.meta.dirname, '..')
const exec = promisify(execFile)

test('the vscode host runner prints the document tree of a saved file', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'host-'))
  const file = path.join(dir, 'demo.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'table.mls'), file)
  const { stdout } = await exec(process.execPath, [path.join(root, 'vscodehost', 'src', 'services', 'worker.mjs'), file])
  const result = JSON.parse(stdout.trim().split('\n').pop())
  assert.ok(result.ok)
  assert.deepEqual(result.tree.children.map((n) => [n.key, n.kind]), [['sales', 'table'], ['teams', 'list'], ['total', 'atom']])
  assert.equal(result.tree.file, file)
})

test('the vscode host runner reports compile errors instead of crashing', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'host-'))
  const file = path.join(dir, 'broken.mls')
  await writeFile(file, 'val x = [1,\n')
  const { stdout } = await exec(process.execPath, [path.join(root, 'vscodehost', 'src', 'services', 'worker.mjs'), file])
  const result = JSON.parse(stdout.trim().split('\n').pop())
  assert.equal(result.ok, false)
  assert.ok(result.error.length > 0)
})

test('every module the browser host imports is served', async () => {
  const seen = new Set()
  const missing = []
  const server = (await import('node:child_process')).spawn(process.execPath, [path.join(root, 'browserhost', 'serve.mjs')], { env: { ...process.env, PORT: '18081' } })
  await new Promise((resolve) => server.stdout.once('data', resolve))
  const visit = async (url) => {
    if (seen.has(url)) return
    seen.add(url)
    const res = await fetch(url)
    if (!res.ok) { missing.push(url); return }
    const text = await res.text()
    for (const m of text.matchAll(/(?:from|import)\s*["'](\.[^"']+\.m?js)["']/g)) await visit(new URL(m[1], url).href)
  }
  await visit('http://localhost:18081/browserhost/src/main.js')
  for (const extra of ['runtime/compiler/MLscript.mjs', 'runtime/std/Prelude.mls', 'runtime/std/Runtime.mls', 'runtime/std/Runtime.mjs', 'build/library/controller/D3Manipulation/Marks.js']) assert.ok((await fetch(`http://localhost:18081/${extra}`)).ok, extra)
  server.kill()
  assert.deepEqual(missing, [])
  assert.ok(seen.size > 8)
})
