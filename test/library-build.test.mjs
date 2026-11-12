import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { normalizeImports } from "../scripts/build_document.mjs";
import { rewriteDisplayOrder } from "../dist/document.mjs";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts/build_document.mjs");
const build = (source) => exec(process.execPath, [runner, source, "--root", root, "--json"], { timeout: 20000, maxBuffer: 4 * 1024 * 1024 });

async function workspace() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "studio-build-"));
  await fs.cp(path.join(root, "library"), path.join(temp, "library"), { recursive: true, filter: (file) => !file.endsWith("Studio.mjs") });
  return temp;
}

test("normalizes Windows ESM imports without corrupting path encoding", () => {
  assert.equal(normalizeImports('import R from "C:/FYP folder/#demo/Runtime.mjs";'), 'import R from "file:///C:/FYP%20folder/%23demo/Runtime.mjs";');
  assert.equal(normalizeImports('import R from "./Runtime.mjs";'), 'import R from "./Runtime.mjs";');
  assert.match(normalizeImports('import runtime from "../../../runtime/std/Runtime.mjs";', root), /^import runtime from "file:.*\/runtime\/std\/Runtime\.mjs";$/);
});

test("hkmc2-compiled program computes table values; Display writes HTML and retains provenance", { timeout: 50000 }, async () => {
  const temp = await workspace();
  try {
    const entry = path.join(temp, "Report.mls");
    const example = (await fs.readFile(path.join(root, "examples/library-report.mls"), "utf8")).replace('../library/Studio.mls', './library/Studio.mls');
    await fs.writeFile(entry, example);
    const first = JSON.parse((await build(entry)).stdout);
    assert.equal(first.ok, true);
    assert.equal(first.model.items.filter(i => i.kind === "table").length, 3);
    assert.equal(first.model.items.find(i => i.id === "teams").rows[0][1], 2);
    assert.equal(first.model.items.find(i => i.id === "budget-chart").sourceTableId, "projects");
    assert.match(first.html, /<table>/);
    assert.match(first.html, /<svg/);
    assert.match(first.html, /50000/);
    assert.match(await fs.readFile(first.outputFile, "utf8"), /DOCTYPE html/i);

    const changed = example.replace("1 + 1", "1 + 2").replace("15000 * 2", "15000 * 3");
    const reordered = rewriteDisplayOrder(changed, ["headcount-chart", "teams", "budget-chart", "projects", "totals"]);
    await fs.writeFile(entry, reordered);
    const second = JSON.parse((await build(entry)).stdout);
    assert.equal(second.model.items.find(i => i.id === "teams").rows[0][1], 3);
    assert.equal(second.model.items.find(i => i.id === "projects").rows[1][1], 45000);
    assert.deepEqual(second.model.order, ["headcount-chart", "teams", "budget-chart", "projects", "totals"]);
    assert.match(second.html, /45000/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("simple Display(root) works and compilation errors stop HTML generation", { timeout: 50000 }, async () => {
  const temp = await workspace();
  try {
    const entry = path.join(temp, "Tiny.mls");
    const source = 'import "./library/Studio.mls"\nopen Studio\nmodule Tiny with\n  val values = CreatCell("numbers", "Numbers", ["n"], [[1 + 1]])\n  val report = CreateGroup("main", "My document", [values])\n  val document = Display(report)\n';
    await fs.writeFile(entry, source);
    const result = JSON.parse((await build(entry)).stdout);
    assert.match(result.html, /<td>2<\/td>/);
    assert.equal(result.model, null); // Model export is optional for CLI HTML builds.
    const broken = path.join(temp, "Broken.mls");
    await fs.writeFile(broken, source.replace("module Tiny", "module Broken").replace("1 + 1", "missingNumber"));
    await assert.rejects(build(broken), error => {
      const result = JSON.parse(error.stdout);
      assert.equal(result.ok, false);
      assert.match(JSON.stringify(result.diagnostics), /Name not found: missingNumber/);
      return true;
    });
    await assert.rejects(fs.stat(path.join(temp, "Broken.html")), { code: "ENOENT" });
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
