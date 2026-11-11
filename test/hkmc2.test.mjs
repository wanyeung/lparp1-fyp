import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compilerFile = path.join(root, "runtime", "compiler", "MLscript.mjs");

test("bundled hkmc2 compiles valid MLscript and reports source offsets for invalid MLscript", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "mlscript-studio-test-"));
  try {
    const valid = path.join(sandbox, "valid.mls");
    const invalid = path.join(sandbox, "invalid.mls");
    await mkdir(path.join(sandbox, "runtime"), { recursive: true });
    await writeFile(valid, 'module Main with\n  fun hello() = "hello"\n', "utf8");
    await writeFile(invalid, "module Main with\n  fun hello() = missingName\n", "utf8");

    const { NotebookCompiler } = await import(pathToFileURL(compilerFile).href);
    const compiler = new NotebookCompiler(root.replace(/\\/g, "/"));
    const validDiagnostics = compiler.compile(valid.replace(/\\/g, "/"));
    assert.deepEqual(validDiagnostics, []);

    const invalidDiagnostics = compiler.compile(invalid.replace(/\\/g, "/"));
    const diagnostic = invalidDiagnostics[0].diagnostics[0];
    assert.equal(diagnostic.kind, "error");
    assert.match(diagnostic.mainMessage, /Name not found: missingName/);
    assert.equal(typeof diagnostic.allMessages[0].location.start, "number");
    assert.equal(typeof diagnostic.allMessages[0].location.end, "number");
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
