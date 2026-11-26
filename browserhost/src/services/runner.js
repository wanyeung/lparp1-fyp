// Compiles and runs .mls source inside the page with the MLscript compiler bundle, and returns { ok, tree } or { ok: false, error }.
import { files } from './memfs.js'
import { Controller } from './library.js'

const root = '/mls'
const base = new URL('../../../', import.meta.url)
const std = ['runtime/std/Prelude.mls', 'runtime/std/Runtime.mls']

let compiler

const load = async () => {
  if (compiler) return compiler
  for (const name of std) files.set(`${root}/${name}`, (await (await fetch(new URL(name, base))).text()).replace(/\r\n/g, '\n'))
  const { NotebookCompiler } = await import(new URL('runtime/compiler/MLscript.mjs', base).href)
  compiler = new NotebookCompiler(root)
  return compiler
}

export const run = async (name, source) => {
  try {
    const compile = await load()
    const file = `${root}/online/${name}.mls`
    files.set(file, source)
    const errors = []
    for (const unit of Array.from(compile.compile(file))) {
      for (const d of Array.from(unit.diagnostics ?? [])) if (d.kind === 'error' || d.kind === 'internal') errors.push(d.mainMessage)
    }
    if (errors.length) return { ok: false, error: errors.join('\n') }
    const code = files.get(file.replace(/\.mls$/, '.mjs')).replaceAll(`${root}/runtime/std/`, new URL('runtime/std/', base).href).replace(/(["'])(?:\.\/)?\.\.\/runtime\/std\//g, `$1${new URL('runtime/std/', base).href}`)
    const exports = await import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })))
    const payload = { exports, source, file }
    return { ok: true, tree: Controller.tree(Controller.document(payload), Controller.primitives(payload)) }
  } catch (error) {
    return { ok: false, error: String(error.message ?? error) }
  }
}
