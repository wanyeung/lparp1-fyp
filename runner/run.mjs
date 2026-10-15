// MLscript notebook runner — a child process, so a runaway cell can be killed
// and the extension host stays responsive.
//
// Same job as sheetbook-poc's Compiler Worker + Execution Worker, but in Node:
//   stdin  : one JSON line  { bundle, source }
//   stdout : NDJSON events, each line prefixed with MARK:
//              {t:'diagnostics', items:[{kind, message, path}]}
//              {t:'log', level, args:[...]}      (console.log/warn/error of the cell code)
//              {t:'done'} | {t:'error', name, message, stack}
//
// 1. compile `source` with the real hkmc2 compiler bundle (build/MLscript.mjs)
// 2. write the produced .mjs graph to a temp dir
// 3. import it, with console.* redirected into events

import { pathToFileURL } from 'node:url'
import { mkdtemp, mkdir, writeFile, rm, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import util from 'node:util'

const MARK = '\u0001MLS '
const realWrite = process.stdout.write.bind(process.stdout)
const emit = (ev) => realWrite(MARK + JSON.stringify(ev) + '\n')

// ---- helpers ----------------------------------------------------------------

async function readStdin() {
  let s = ''
  for await (const chunk of process.stdin) s += chunk
  return JSON.parse(s)
}

// The bundle sometimes embeds absolute host paths in cross-module imports
// (e.g. from "C:\Users\...\Runtime.mjs"). Rewrite them to the virtual path of
// the file with the same basename. (Same fix as sheetbook-poc execution worker.)
const LEAKED = /(\b(?:from|import)\s+)(["'])([^"']*[\\/]([A-Za-z0-9_.]+\.mjs))\2/g
function fixLeakedPaths(files) {
  const byBase = {}
  for (const p of Object.keys(files)) {
    const b = p.split('/').pop()
    if (!(b in byBase) || p.split('/').length < byBase[b].split('/').length) byBase[b] = p
  }
  const out = {}
  for (const [p, src] of Object.entries(files)) {
    out[p] = typeof src !== 'string' ? src : src.replace(LEAKED, (whole, kw, q, spec, base) => {
      if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) return whole
      const target = byBase[base]
      if (!target) return whole
      // make it relative to the importing file so plain Node ESM can resolve it
      const rel = path.posix.relative(path.posix.dirname(p), target)
      return `${kw}${q}${rel.startsWith('.') ? rel : './' + rel}${q}`
    })
  }
  return out
}

function safe(a) {
  if (a === undefined) return null
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean' || a === null) return a
  try { return JSON.parse(JSON.stringify(a)) } catch { return util.inspect(a, { depth: 4 }) }
}

async function copyMissing(dir, files, prefix) {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isFile()) continue
    const vp = prefix + e.name
    if (!(vp in files)) files[vp] = await readFile(path.join(dir, e.name), 'utf8')
  }
}

// ---- compile ------------------------------------------------------------------

async function compile(bundle, source) {
  const mod = await import(pathToFileURL(bundle).href)
  const MLscript = mod.default ?? mod

  const files = { '/std/Prelude.mls': MLscript.std.prelude }
  for (const [p, content] of MLscript.std.files) files[p] = content
  files['/notebook.mls'] = source

  const store = files
  const modified = new Set()
  const stamps = Object.fromEntries(Object.keys(store).map((p) => [p, 0]))
  let clock = 0
  const vfs = {
    read: (p) => { if (p in store) return store[p]; throw new Error('File not found: ' + p) },
    write: (p, c) => { store[p] = c; stamps[p] = ++clock; modified.add(p) },
    exists: (p) => p in store,
    getLastChangedTimestamp: (p) => stamps[p] ?? 0,
  }
  const fs = new MLscript.DummyFileSystem(vfs)
  const paths = new MLscript.Paths('/std/Prelude.mls', '/std/Runtime.mjs', '/std/Runtime.mls', '/std/Term.mjs', '/std')
  const compiler = new MLscript.BrowserCompiler(fs, paths)
  const diagnostics = compiler.compile('/notebook.mls')

  const changes = {}
  for (const p of modified) changes[p] = store[p]
  return { diagnostics, files: { ...files, ...changes } }
}

function flattenDiagnostics(perFile) {
  const items = []
  for (const f of perFile || []) {
    for (const d of f.diagnostics || []) {
      items.push({ kind: d.kind, message: d.mainMessage ?? String(d.message ?? 'diagnostic'), path: f.path, raw: d })
    }
  }
  return items
}

// ---- main ---------------------------------------------------------------------

const { bundle, source, stdDir } = await readStdin()
let tmp
try {
  const { diagnostics, files: rawFiles } = await compile(bundle, source)
  const items = flattenDiagnostics(diagnostics)
  emit({ t: 'diagnostics', items: items.map(({ raw, ...rest }) => ({ ...rest, ...offsets(raw) })) })
  if (items.some((d) => d.kind === 'error' || d.kind === 'internal')) {
    emit({ t: 'done', ok: false })
    process.exit(0)
  }

  const files = fixLeakedPaths(rawFiles)
  if (stdDir) await copyMissing(stdDir, files, '/std/')

  tmp = await mkdtemp(path.join(tmpdir(), 'mls-nb-'))
  for (const [vp, content] of Object.entries(files)) {
    if (typeof content !== 'string' || !/\.(mjs|js)$/.test(vp)) continue
    const dest = path.join(tmp, ...vp.split('/').filter(Boolean))
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, content, 'utf8')
  }

  const level = (lv) => (...args) => emit({ t: 'log', level: lv, args: args.map(safe) })
  console.log = level('log'); console.info = level('log'); console.debug = level('log')
  console.warn = level('warn'); console.error = level('error')

  await import(pathToFileURL(path.join(tmp, 'notebook.mjs')).href)
  emit({ t: 'done', ok: true })
} catch (e) {
  emit({ t: 'error', name: e?.name ?? 'Error', message: e?.message ?? String(e), stack: e?.stack ?? '' })
} finally {
  if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {})
  process.exit(0)
}

// The compiler reports character offsets into the source it was given.
function offsets(d) {
  const loc = d?.allMessages?.[0]?.location
  return loc && typeof loc.start === 'number' ? { start: loc.start, end: loc.end } : {}
}
