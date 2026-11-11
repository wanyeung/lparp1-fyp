#!/usr/bin/env node
/** Compile real MLscript, evaluate its `document` export, and save the HTML.
 * Execution is for trusted code only. A child process is not a security sandbox.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeProvenance } from "./provenance.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export class CompileFailure extends Error {
  constructor(diagnostics) {
    super("hkmc2 compilation failed");
    this.diagnostics = diagnostics;
  }
}

// Normalize generated ESM imports in-memory, including the Windows hkmc2 path
// defect and hkmc2's bare `runtime/std/...` specifiers. Node treats bare C:/
// paths as an unsupported URL protocol, and a bare `runtime` package is not
// installed; both must become file URLs before the generated graph is loaded.
export function normalizeImports(code, root) {
  let result = code.replace(/((?:\bfrom\s*|\bimport\s*)["'])([A-Za-z]:[\\/][^"'\r\n]+)(["'])/g,
    (_, prefix, specifier, quote) => prefix + "file:///" + specifier.replace(/\\/g, "/").split("/")
      .map((part, index) => index === 0 ? part : encodeURIComponent(part)).join("/") + quote);
  if (root) {
    const runtimeBase = pathToFileURL(path.join(path.resolve(root), "runtime", "std") + path.sep);
    result = result.replace(/((?:\bfrom\s*|\bimport\s*)["'])runtime\/std\/([^"'\r\n]+)(["'])/g,
      (_, prefix, specifier, quote) => prefix + new URL(specifier, runtimeBase).href + quote);
  }
  return result;
}

export async function buildDocument(sourcePath, { root = defaultRoot, output } = {}) {
  const source = path.resolve(sourcePath);
  if (!source.endsWith(".mls")) throw new Error("Choose an .mls source file.");
  const htmlFile = path.resolve(output ?? source.replace(/\.mls$/, ".html"));
  if (htmlFile === source) throw new Error("The output path must not overwrite the source file.");
  const compilerFile = path.join(root, "runtime/compiler/MLscript.mjs");
  const { NotebookCompiler } = await import(pathToFileURL(compilerFile).href);
  const compiler = new NotebookCompiler(root.replace(/\\/g, "/"));
  const visited = new Set();
  const generated = [];
  const diagnostics = [];

  // hkmc2 elaborates imports but does not necessarily emit their .mjs files.
  // Compile dependencies explicitly, once each, before the entry module.
  async function compile(file) {
    file = path.resolve(file);
    if (visited.has(file)) return;
    visited.add(file);
    if (visited.size > 100) throw new Error("Document build exceeds 100 MLscript modules.");
    const code = await fs.readFile(file, "utf8");
    const imports = [...code.matchAll(/^\s*import\s+["']([^"'\r\n]+\.mls)["']/gm)];
    for (const [, specifier] of imports) {
      await compile(path.resolve(path.dirname(file), specifier));
    }
    const result = Array.from(compiler.compile(file.replace(/\\/g, "/")) ?? []);
    diagnostics.push(...result);
    if (result.some(perFile => (perFile.diagnostics ?? []).some(item => item.kind === "error"))) {
      throw new CompileFailure(diagnostics);
    }
    generated.push(file.replace(/\.mls$/, ".mjs"));
  }
  await compile(source);

  // Follow generated .mjs imports too (including the bundled standard runtime).
  // Rewrite leaked Windows absolute import specifiers on disk before Node loads
  // the graph. Only .mjs modules reachable from this program are touched.
  const normalized = new Set();
  async function prepare(file) {
    if (normalized.has(file)) return;
    normalized.add(file);
    if (normalized.size > 200) throw new Error("Document module graph exceeds 200 JavaScript modules.");
    const raw = await fs.readFile(file, "utf8");
    const code = normalizeImports(raw, root);
    if (code !== raw) await fs.writeFile(file, code);
    for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"'\r\n]+\.mjs)["']/g)) {
      const specifier = match[1];
      const target = specifier.startsWith("file:") ? fileURLToPath(specifier)
        : specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : null;
      if (target) await prepare(target);
    }
  }
  for (const file of generated) await prepare(file);

  const namespace = await import(pathToFileURL(source.replace(/\.mls$/, ".mjs")).href);
  // The hkmc2 filename/module-name convention may expose a default export or
  // a named _$_modulePrivate_$_Name export. Support both without guessing names.
  const candidates = [...new Set(Object.values(namespace))].filter(value => value &&
    (typeof value === "object" || typeof value === "function") &&
    Object.prototype.hasOwnProperty.call(value, "document"));
  let report;
  if (candidates.length === 1) {
    report = candidates[0];
  } else if (candidates.length === 0) {
    // hkmc2 also exports top-level values directly (for example
    // `_$_modulePrivate_$_document`). Accept that shape too.
    const documentEntry = Object.entries(namespace).find(([key, value]) =>
      /(?:^|_)document$/.test(key) && typeof value === "string" && /^<!doctype html>/i.test(value.trim()));
    if (!documentEntry) throw new Error("Export `val document = Display(report)` (and optionally `val model = Model(report)`).");
    const modelEntry = Object.entries(namespace).find(([key]) => /(?:^|_)model$/.test(key));
    report = { document: documentEntry[1], model: modelEntry ? modelEntry[1] : null };
  } else {
    throw new Error("Export exactly one `document` value from Display; multiple document modules were found.");
  }
  const html = report.document;
  if (typeof html !== "string" || !/^<!doctype html>/i.test(html.trim())) {
    throw new Error("The exported `document` must be the HTML string returned by Display.");
  }
  const model = Object.prototype.hasOwnProperty.call(report, "model") ? report.model : null;
  let provenance = null;
  if (model) {
    try {
      provenance = await analyzeProvenance({ entryFile: source, dependencies: Array.from(visited), model });
    } catch (error) {
      // Provenance is an editing aid, not a build requirement. A parser bug
      // must not prevent the executed document from being displayed.
      provenance = {
        version: 1,
        entryFile: source,
        files: [],
        tables: {},
        charts: {},
        warnings: [`Provenance analysis failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
  await fs.mkdir(path.dirname(htmlFile), { recursive: true });
  await fs.writeFile(htmlFile, html, "utf8");
  if (model) await fs.writeFile(htmlFile.replace(/\.html$/i, "") + ".document.json", JSON.stringify(model, null, 2) + "\n");
  return { ok: true, sourceFile: source, outputFile: htmlFile, html, model, provenance, diagnostics, dependencies: Array.from(visited) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [source, ...args] = process.argv.slice(2);
  const readOption = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const json = args.includes("--json");
  const stdout = process.stdout.write.bind(process.stdout);
  // MLscript console output must not corrupt the CLI's JSON result channel.
  console.log = (...values) => process.stderr.write(values.map(String).join(" ") + "\n");
  try {
    if (!source) throw new Error("Usage: node scripts/build_document.mjs file.mls [--root extension-folder] [--out file.html] [--json]");
    const result = await buildDocument(source, { root: readOption("--root"), output: readOption("--out") });
    stdout(json ? JSON.stringify(result) + "\n" : `Built ${result.outputFile}\n`);
  } catch (error) {
    const result = { ok: false, error: error instanceof Error ? error.message : String(error), diagnostics: error.diagnostics ?? [] };
    stdout(json ? JSON.stringify(result) + "\n" : `${result.error}\n${JSON.stringify(result.diagnostics, null, 2)}\n`);
    process.exitCode = 1;
  }
}
