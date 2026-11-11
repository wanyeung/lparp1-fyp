#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// hkmc2's ScalaJS VirtualPath uses POSIX separators. Node's filesystem accepts
// C:/... paths on Windows, so use this form at the compiler boundary.
function toHkmc2Path(filePath) {
  return filePath.replace(/\\/g, "/");
}

const projectRoot = path.resolve(process.argv[2] || ".");
const compilerPath = path.join(projectRoot, "runtime", "compiler", "MLscript.mjs");
const standardLibrary = path.join(projectRoot, "runtime", "std");

if (!fs.existsSync(compilerPath)) {
  throw new Error(`Missing compiler bundle: ${compilerPath}`);
}

const { NotebookCompiler } = await import(pathToFileURL(compilerPath).href);
const compiler = new NotebookCompiler(toHkmc2Path(projectRoot));

// The hkmc2 test standard library has cyclic runtime relationships. Compiling
// each source module emits its JavaScript counterpart in-place; the final
// Predef compilation refreshes its imports after Term has been emitted.
const modules = [
  "StrOps.mls",
  "Option.mls",
  "Stack.mls",
  "Iter.mls",
  "LazyArray.mls",
  "Rendering.mls",
  "Runtime.mls",
  "Predef.mls",
  "Term.mls",
  "Predef.mls",
];

function formatDiagnostics(perFile) {
  return Array.from(perFile.diagnostics || []).map((diagnostic) => {
    const details = Array.from(diagnostic.allMessages || [])
      .map((entry) => Array.from(entry.messageBits || []).map((bit) => bit.text || "").join(""))
      .filter(Boolean)
      .join("; ");
    return `${perFile.path || "source"}: ${diagnostic.mainMessage || details}`;
  });
}

for (const moduleName of modules) {
  const filePath = path.join(standardLibrary, moduleName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing standard-library source: ${filePath}`);
  }
  const diagnostics = Array.from(compiler.compile(toHkmc2Path(filePath)));
  const errors = diagnostics.filter((perFile) =>
    Array.from(perFile.diagnostics || []).some((diagnostic) => diagnostic.kind === "error"),
  );
  if (errors.length) {
    throw new Error(`Could not compile ${moduleName}:\n${errors.flatMap(formatDiagnostics).join("\n")}`);
  }
  process.stdout.write(`Compiled ${moduleName}\n`);
}

for (const required of ["Predef.mjs", "Runtime.mjs", "Rendering.mjs", "Term.mjs"]) {
  if (!fs.existsSync(path.join(standardLibrary, required))) {
    throw new Error(`Bootstrap did not produce ${required}`);
  }
}
process.stdout.write("hkmc2 standard library is ready.\n");
