import { pathToFileURL } from 'node:url'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const bundle = path.resolve(process.env.MLS_BUNDLE ?? path.join(root, 'runtime', 'compiler', 'MLscript.mjs'))
const posix = (p) => p.replace(/\\/g, '/')

let compiler
const load = async () => {
  if (!compiler) {
    const { NotebookCompiler } = await import(pathToFileURL(bundle).href)
    compiler = new NotebookCompiler(posix(root))
  }
  return compiler
}

const relativizeWindowsImports = async (file) => {
  const out = file.replace(/\.mls$/, '.mjs')
  const code = await readFile(out, 'utf8')
  const fixed = code.replace(/(\bfrom\s+)(["'])([A-Za-z]:[\\/][^"']+)\2/g, (_m, kw, q, abs) => {
    const rel = path.relative(path.dirname(out), abs).replace(/\\/g, '/')
    return `${kw}${q}${rel.startsWith('.') ? rel : './' + rel}${q}`
  })
  if (fixed !== code) await writeFile(out, fixed, 'utf8')
}

export const compileFile = async (file) => {
  const compiler = await load()
  const diagnostics = []
  for (const unit of Array.from(compiler.compile(posix(file)))) {
    for (const d of Array.from(unit.diagnostics ?? [])) {
      diagnostics.push({ file: unit.path ?? file, kind: d.kind, message: d.mainMessage })
    }
  }
  const failed = diagnostics.some((d) => d.kind === 'error' || d.kind === 'internal')
  if (!failed && process.platform === 'win32') await relativizeWindowsImports(file)
  return { ok: !failed, diagnostics }
}

export const importFresh = (file) => import(`${pathToFileURL(file).href}?v=${Date.now()}`)

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  return nested.flat()
}

export const build = async (src, out) => {
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })
  await cp(src, out, { recursive: true })
  const sources = (await walk(out)).filter((f) => f.endsWith('.mls'))
  let failed = false
  for (const f of sources) {
    const result = await compileFile(f)
    for (const d of result.diagnostics) console.error(`${path.relative(out, f)}: ${d.kind}: ${d.message}`)
    if (!result.ok) failed = true
  }
  return { count: sources.length, failed }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [src, out] = process.argv.slice(2).map((p) => path.resolve(p))
  const { count, failed } = await build(src, out)
  if (failed) process.exit(1)
  console.log(`built ${count} module(s) → ${path.relative(root, out)}`)
}
