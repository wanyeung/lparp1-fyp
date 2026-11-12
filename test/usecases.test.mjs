import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(extensionRoot, "scripts/build_document.mjs");

const cases = [
  {
    name: "case 1 compound interest",
    entry: "examples/usecases/case01/CompoundInterest.mls",
    editableTables: { "ci-assumptions": 1 },
  },
  {
    name: "case 2 cooling experiment",
    entry: "examples/usecases/case02/CoolingExperiment.mls",
    editableTables: { "cooling-assumptions": 1, "cooling-raw": 1 },
    editableChartBars: { "cooling-raw-chart": 1 },
  },
  {
    name: "case 3 portfolio analysis",
    entry: "examples/usecases/case03/Analysis.mls",
    editableTables: { "c03-assumptions": 1, "c03-asset-returns": 1 },
  },
  {
    name: "case 3 portfolio summary",
    entry: "examples/usecases/case03/Summary.mls",
  },
  {
    name: "case 4 subscription report",
    entry: "examples/usecases/case04/SubscriptionReport.mls",
    editableTables: { "subscription-assumptions": 1 },
    editableChartBars: { "subscription-assumptions-chart": 1 },
  },
  {
    name: "case 5 experiment",
    entry: "examples/usecases/case05/Experiment.mls",
    editableTables: { "case05-assumptions": 1, "case05-raw": 1 },
    editableChartBars: { "case05-raw-chart": 1 },
  },
  {
    name: "case 5 report",
    entry: "examples/usecases/case05/Report.mls",
    editableTables: { "case05-raw": 1 },
    editableChartBars: { "case05-raw-chart": 1 },
  },
  {
    name: "case 6 risk review",
    entry: "examples/usecases/case06/RiskReview.mls",
    editableTables: { "rr-assumptions": 1, "rr-known-inputs": 1 },
  },
];

function editableCells(table) {
  return (table.rows || []).reduce((total, row) => total + row.filter((cell) => cell && cell.editable).length, 0);
}

for (const item of cases) {
  test(`${item.name} builds and exposes the expected editable provenance`, async () => {
    const entry = path.join(extensionRoot, item.entry);
    const { stdout } = await run(process.execPath, [runner, entry, "--root", extensionRoot, "--json"], {
      cwd: extensionRoot,
      maxBuffer: 32 * 1024 * 1024,
    });
    const payload = JSON.parse(stdout);
    assert.equal(payload.ok, true, payload.error || "build failed");
    assert.ok((payload.model?.items || []).length > 0, "document has no items");
    assert.deepEqual(payload.provenance?.warnings || [], []);

    for (const [tableId, minimum] of Object.entries(item.editableTables || {})) {
      const table = payload.provenance?.tables?.[tableId];
      assert.ok(table, `missing table ${tableId}`);
      assert.ok(editableCells(table) >= minimum, `${tableId} has no editable cells`);
    }
    for (const [chartId, minimum] of Object.entries(item.editableChartBars || {})) {
      const chart = payload.provenance?.charts?.[chartId];
      assert.ok(chart, `missing chart ${chartId}`);
      const editable = (chart.bars || []).filter((bar) => bar.editable).length;
      assert.ok(editable >= minimum, `${chartId} has no editable bars`);
    }
  });
}
