import { pathToFileURL } from 'node:url'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const bundle = path.resolve(process.env.MLS_BUNDLE ?? path.join(root, 'runtime', 'compiler', 'MLscript.mjs'))
const srcDir = path.join(root, 'src', 'main', 'mls')
const outDir = path.join(root, 'build', 'main')
const posix = (p) => p.replace(/\\/g, '/')

const { NotebookCompiler } = await import(pathToFileURL(bundle).href).catch((e) => {
  console.error(`Cannot load the compiler bundle at ${bundle}\n${e.message}`); process.exit(2)
})
const compiler = new NotebookCompiler(posix(root))

await mkdir(outDir, { recursive: true })
const sources = (await readdir(srcDir)).filter((f) => f.endsWith('.mls'))
for (const f of sources) await writeFile(path.join(outDir, f), await readFile(path.join(srcDir, f), 'utf8'))

let failed = false
for (const f of sources) {
  for (const file of Array.from(compiler.compile(posix(path.join(outDir, f))))) {
    for (const d of Array.from(file.diagnostics ?? [])) {
      console.error(`${f}: ${d.kind}: ${d.mainMessage}`)
      if (d.kind === 'error' || d.kind === 'internal') failed = true
    }
  }
}
if (failed) process.exit(1)

if (process.platform === 'win32') {
  for (const f of sources) {
    const out = path.join(outDir, f.replace(/\.mls$/, '.mjs'))
    const code = await readFile(out, 'utf8')
    const fixed = code.replace(/(\bfrom\s+)(["'])([A-Za-z]:[\\/][^"']+)\2/g, (_m, kw, q, abs) => {
      const rel = path.relative(path.dirname(out), abs).replace(/\\/g, '/')
      return `${kw}${q}${rel.startsWith('.') ? rel : './' + rel}${q}`
    })
    if (fixed !== code) await writeFile(out, fixed, 'utf8')
  }
}
console.log(`built ${sources.length} module(s) → build/main/`)
