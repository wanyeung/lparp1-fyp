import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { compileFile, importFresh } from '../runtime/compile.mjs'
import Controller from '../build/library/controller/Controller.mjs'

const file = path.resolve(process.argv[2])
const emit = (value) => process.stdout.write('\n' + JSON.stringify(value) + '\n')

const compiled = await compileFile(file)
if (!compiled.ok) {
  emit({ ok: false, error: compiled.diagnostics.map((d) => d.message).join('\n') })
} else {
  const exports = await importFresh(file.replace(/\.mls$/, '.mjs'))
  const payload = { exports, source: await readFile(file, 'utf8'), file }
  emit({ ok: true, sheet: Controller.sheet(payload), document: Controller.document(payload) })
}
