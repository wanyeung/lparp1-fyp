import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(extensionRoot, "scripts/build_document.mjs");

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-e2e-"));
  await fs.mkdir(path.join(root, "studio"), { recursive: true });
  await fs.mkdir(path.join(root, "shared"), { recursive: true });
  await fs.copyFile(path.join(extensionRoot, "library/Studio.mls"), path.join(root, "studio/Studio.mls"));
  await fs.copyFile(path.join(extensionRoot, "library/Render.mjs"), path.join(root, "studio/Render.mjs"));
  const shared = path.join(root, "shared/Inputs.mls");
  const report = path.join(root, "report.mls");
  await fs.writeFile(shared, `module Inputs with
  val price = 60
  val seats = 10
  val max = 100
  val comparisonRows = [
    ["Baseline", price, seats, price * seats]
  ]
`, "utf8");
  await fs.writeFile(report, `import "./studio/Studio.mls"
import "./shared/Inputs.mls"
open Studio
open Inputs

val comparison = CreateCell("comparison", "Comparison", ["Scenario", "Price", "Seats", "Revenue"], Inputs.comparisonRows)
val assumptions = CreateCell("assumptions", "Assumptions", ["Item", "Value"], [["Price", price], ["Max", max]])
val chart = BarChart("chart", "Price chart", assumptions, "Item", "Value")
val root = CreateGroup("main", "Main", [comparison, assumptions, chart])
val order = ["comparison", "assumptions", "chart"]
val document = Display(root)
val model = Model(root)
`, "utf8");
  return { root, shared, report };
}

async function build(report, output) {
  let stdout;
  try {
    ({ stdout } = await run(process.execPath, [runner, report, "--root", extensionRoot, "--out", output, "--json"], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30000,
      env: { ...process.env },
    }));
  } catch (error) {
    console.error("BUILD STDERR:", error.stderr, "BUILD STDOUT:", error.stdout);
    throw error;
  }
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true, result.error || "build failed");
  return result;
}

async function patch(result, cell, replacement, report, output) {
  const source = await fs.readFile(cell.file, "utf8");
  assert.equal(source.slice(cell.start, cell.end), cell.expected, "source range must still match the built provenance");
  await fs.writeFile(cell.file, source.slice(0, cell.start) + replacement + source.slice(cell.end), "utf8");
  return build(report, output);
}

test("a table cell edit patches an imported literal and refreshes the model and chart", async () => {
  const { root, shared, report } = await fixture();
  const output = path.join(root, "report.html");
  const first = await build(report, output);
  assert.equal(first.provenance.tables.comparison.rows[0][1].editable, true);
  assert.equal(first.provenance.tables.comparison.rows[0][1].file, shared);
  assert.equal(first.model.items.find((item) => item.id === "comparison").rows[0][1], 60);
  assert.equal(first.provenance.charts.chart.bars[0].value, 60);

  const cell = first.provenance.tables.comparison.rows[0][1];
  const second = await patch(first, cell, "80", report, output);
  const comparison = second.model.items.find((item) => item.id === "comparison");
  const assumptions = second.model.items.find((item) => item.id === "assumptions");
  const chart = second.model.items.find((item) => item.id === "chart");
  assert.equal(comparison.rows[0][1], 80);
  assert.equal(comparison.rows[0][3], 800);
  assert.equal(assumptions.rows[0][1], 80);
  assert.equal(chart.data[0].value, 80);
  assert.equal(second.provenance.tables.comparison.rows[0][1].expected, "80");
  assert.equal((await fs.readFile(shared, "utf8")).slice(second.provenance.tables.comparison.rows[0][1].start, second.provenance.tables.comparison.rows[0][1].end), "80");
});

test("a chart bar drag patches the y-column literal and updates the displayed bar", async () => {
  const { root, report } = await fixture();
  const output = path.join(root, "chart.html");
  const first = await build(report, output);
  const bar = first.provenance.charts.chart.bars[0];
  assert.equal(bar.editable, true);
  const second = await patch(first, bar, "50", report, output);
  const chart = second.model.items.find((item) => item.id === "chart");
  assert.equal(chart.data[0].value, 50);
  assert.equal(second.provenance.charts.chart.bars[0].value, 50);
  assert.equal(second.provenance.charts.chart.bars[0].expected, "50");
});

test("editing a string label updates both the table and the chart category", async () => {
  const { root, report } = await fixture();
  const output = path.join(root, "label.html");
  const first = await build(report, output);
  const label = first.provenance.tables.assumptions.rows[0][0];
  assert.equal(label.editable, true);
  const second = await patch(first, label, '"Worst"', report, output);
  assert.equal(second.model.items.find((item) => item.id === "assumptions").rows[0][0], "Worst");
  assert.equal(second.model.items.find((item) => item.id === "chart").data[0].label, "Worst");
  assert.equal(second.model.items.find((item) => item.id === "comparison").rows[0][0], "Baseline");
});

test("a source edit after a build invalidates the old range and is rejected by verification", async () => {
  const { root, shared, report } = await fixture();
  const output = path.join(root, "stale.html");
  const first = await build(report, output);
  const cell = first.provenance.tables.comparison.rows[0][1];
  const source = await fs.readFile(shared, "utf8");
  await fs.writeFile(shared, source.replace("val price = 60", "val price = 61"), "utf8");
  assert.notEqual((await fs.readFile(shared, "utf8")).slice(cell.start, cell.end), cell.expected);
});
