// Child process: compiles one .mls file and the files it imports, runs it, and prints the document tree as the last line of output.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { compileFile, importFresh } from '../../../runtime/compile.mjs'
import Controller from '../../../build/library/controller/Controller.mjs'

const file = path.resolve(process.argv[2])
const emit = (value) => process.stdout.write('\n' + JSON.stringify(value) + '\n')

const imports = async (from, seen = new Set()) => {
  const text = await readFile(from, 'utf8').catch(() => '')
  const found = [...text.matchAll(/^import "(\.[^"]+\.mls)"/gm)].map((m) => path.resolve(path.dirname(from), m[1]))
  const nested = []
  for (const dep of found) if (!seen.has(dep)) { seen.add(dep); nested.push(...await imports(dep, seen), dep) }
  return nested
}

const failed = []
for (const dep of await imports(file)) {
  const built = await compileFile(dep)
  if (!built.ok) failed.push(...built.diagnostics)
}
const compiled = failed.length ? { ok: false, diagnostics: failed } : await compileFile(file)
if (!compiled.ok) {
  emit({ ok: false, error: compiled.diagnostics.map((d) => d.message).join('\n') })
} else {
  const exports = await importFresh(file.replace(/\.mls$/, '.mjs'))
  const payload = { exports, source: await readFile(file, 'utf8'), file }
  emit({ ok: true, tree: Controller.tree(Controller.document(payload), Controller.primitives(payload)) })
}
