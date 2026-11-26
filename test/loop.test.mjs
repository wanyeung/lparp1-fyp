import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { compileFile, importFresh } from '../runtime/compile.mjs'
import Controller from '../build/library/controller/Controller.mjs'

const root = path.resolve(import.meta.dirname, '..')

test('save, run, show, edit, patch, run again', async () => {
  const dir = await mkdtemp(path.join(root, 'build', 'loop-'))
  const file = path.join(dir, 'demo.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'table.mls'), file)

  const run = async () => {
    const compiled = await compileFile(file)
    assert.ok(compiled.ok)
    const exports = await importFresh(file.replace(/\.mls$/, '.mjs'))
    return Controller.primitives({ exports, source: await readFile(file, 'utf8'), file }).find((g) => g.key === 'sales')
  }

  const before = await run()
  assert.deepEqual(before.headers, ['item', 'units', 'price'])
  assert.equal(before.rows[0][1], 30)

  const source = await readFile(file, 'utf8')
  const edit = Controller.edit({ source, path: ['sales'], kind: 'table', row: 0, col: 1, text: '99' })
  assert.ok(edit.ok)
  await writeFile(file, edit.source)

  const after = await run()
  assert.equal(after.rows[0][1], 99)
  assert.equal(edit.source, source.replace('30', '99'))
})
