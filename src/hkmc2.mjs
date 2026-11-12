import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

let compilerPromise;

function stripComments(source) {
  let out = '';
  let index = 0;
  while (index < source.length) {
    if (source[index] === '"') {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== '"') index += source[index] === '\\' ? 2 : 1;
      index += 1;
      out += source.slice(start, index);
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    out += source[index];
    index += 1;
  }
  return out;
}

function collapseBraces(source) {
  let out = '';
  let depth = 0;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"') {
      const start = index;
      index += 1;
      while (index < source.length && source[index] !== '"') index += source[index] === '\\' ? 2 : 1;
      index += 1;
      out += source.slice(start, index);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth = Math.max(0, depth - 1);
    out += char === '\n' && depth > 0 ? ' ' : char;
    index += 1;
  }
  return out;
}

// hkmc2 evaluates `val` and one-line records. The file the author edits
// stays a list of `let` bindings. Nothing here introduces CreateCell,
// CreateGroup, DeriveCell, or CreateText.
export function translateForCompiler(source) {
  return collapseBraces(stripComments(source))
    .replace(/(^|\n)([ \t]*)let([ \t]+)/g, '$1$2val$3')
    .replace(/\bmut[ \t]*\{/g, '{');
}

async function compilerFor(root) {
  if (!compilerPromise) {
    const file = path.join(root, 'runtime', 'compiler', 'MLscript.mjs');
    compilerPromise = import(pathToFileURL(file).href).then((loaded) => {
      if (!loaded.NotebookCompiler) throw new Error('The bundled hkmc2 runtime does not export NotebookCompiler.');
      return new loaded.NotebookCompiler(root.replace(/\\/g, '/'));
    });
  }
  return compilerPromise;
}

function plainValues(exported) {
  const values = {};
  if (!exported) return values;
  for (const key of Object.getOwnPropertyNames(exported)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    const value = exported[key];
    if (typeof value === 'function' || value == null) continue;
    values[key] = JSON.parse(JSON.stringify(value));
  }
  return values;
}

export async function compileModule(source, root) {
  const directory = await mkdtemp(path.join(tmpdir(), 'mlscript-hkmc2-'));
  try {
    const file = path.join(directory, 'module.mls');
    await writeFile(file, translateForCompiler(source));
    const compiler = await compilerFor(root);
    const diagnostics = Array.from(compiler.compile(file.replace(/\\/g, '/')) ?? []);
    const errors = diagnostics.flatMap((entry) => (entry.diagnostics ?? [])
      .filter((item) => item.kind === 'error')
      .map((item) => item.mainMessage || 'hkmc2 error'));
    if (errors.length) return { ok: false, errors, values: null };
    const generated = file.replace(/\.mls$/, '.mjs');
    const runtimeUrl = pathToFileURL(path.join(root, 'runtime', 'std', 'Runtime.mjs')).href;
    const code = (await readFile(generated, 'utf8'))
      .replace(/import runtime from "[^"]+"/, `import runtime from ${JSON.stringify(runtimeUrl)}`);
    const fixed = path.join(directory, 'module.fixed.mjs');
    await writeFile(fixed, code);
    const namespace = await import(`${pathToFileURL(fixed).href}?t=${Date.now()}`);
    const exported = Object.values(namespace).find((value) => typeof value === 'function');
    return { ok: true, errors: [], values: plainValues(exported) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const lines = readline.createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    const request = JSON.parse(line);
    compileModule(request.source, request.root).then((result) => {
      process.stdout.write(`${JSON.stringify({ id: request.id, ...result })}\n`);
    }).catch((error) => {
      process.stdout.write(`${JSON.stringify({
        id: request.id,
        ok: false,
        errors: [error instanceof Error ? error.message : String(error)],
        values: null,
      })}\n`);
    });
  });
}
