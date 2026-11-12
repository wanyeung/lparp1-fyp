import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeProvenance, parseModuleFile, collectTableSites } from "../scripts/provenance.mjs";
import { replacementFor } from "../dist/edit.mjs";

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-provenance-"));
  const sharedDir = path.join(root, "shared");
  await fs.mkdir(sharedDir, { recursive: true });
  const shared = path.join(sharedDir, "Model.mls");
  const report = path.join(root, "report.mls");
  await fs.writeFile(shared, `module Model with
  val price = 60
  val drinkCost = 2.5
  val seats = 10
  val baselineRows = [
    ["Baseline", price, seats, price * seats]
  ]
  val assumptionsRows = [
    ["Price", price, "USD"],
    ["Drink cost", drinkCost, "USD"]
  ]
`, "utf8");
  await fs.writeFile(report, `import "./shared/Model.mls"
import "./library/Studio.mls"
open Studio
open Model

val comparison = CreateCell("comparison", "Comparison", ["Scenario", "Price", "Seats", "Revenue"], Model.baselineRows)
val assumptions = CreateCell("assumptions", "Assumptions", ["Item", "Value", "Unit"], assumptionsRows)
val direct = CreateCell("direct", "Direct", ["Name", "Value"], [["Alpha", 7], ["Beta", 2.5]])
val qualified = CreateCell("qualified", "Qualified", ["Item", "Value"], [["Double price", Model.price * 2]])
val revenue = BarChart("revenue", "Revenue", comparison, "Scenario", "Revenue")
val order = ["comparison", "assumptions", "direct", "qualified", "revenue"]
val document = Display(CreateGroup("main", "Main", [comparison, assumptions, direct, qualified, revenue]))
`, "utf8");
  const model = {
    items: [
      { id: "comparison", kind: "table", name: "Comparison", headers: ["Scenario", "Price", "Seats", "Revenue"], rows: [["Baseline", 60, 10, 600]] },
      { id: "assumptions", kind: "table", name: "Assumptions", headers: ["Item", "Value", "Unit"], rows: [["Price", 60, "USD"], ["Drink cost", 2.5, "USD"]] },
      { id: "direct", kind: "table", name: "Direct", headers: ["Name", "Value"], rows: [["Alpha", 7], ["Beta", 2.5]] },
      { id: "qualified", kind: "table", name: "Qualified", headers: ["Item", "Value"], rows: [["Double price", 120]] },
      { id: "revenue", kind: "chart", name: "Revenue", chartType: "bar", sourceTableId: "comparison", sourceName: "Comparison", x: "Scenario", y: "Revenue", data: [{ label: "Baseline", value: 600 }] },
    ],
    order: ["comparison", "assumptions", "direct", "qualified", "revenue"],
    groups: [{ id: "main", name: "Main", itemIds: ["comparison", "assumptions", "direct", "qualified", "revenue"] }],
  };
  return { root, shared, report, model };
}

test("parses module bindings and table construction sites", async () => {
  const { shared, report } = await fixture();
  const parsed = parseModuleFile(await fs.readFile(shared, "utf8"), shared);
  assert.deepEqual(parsed.modules.map((module) => module.name), ["Model"]);
  assert.deepEqual(parsed.modules[0].bindings.map((binding) => binding.name), ["price", "drinkCost", "seats", "baselineRows", "assumptionsRows"]);
  const reportParsed = parseModuleFile(await fs.readFile(report, "utf8"), report);
  const { sites } = collectTableSites([parsed, reportParsed]);
  assert.deepEqual(sites.map((site) => site.id), ["comparison", "assumptions", "direct", "qualified"]);
});

test("joins direct, aliased, imported and computed cells to source ranges", async () => {
  const { shared, report, model } = await fixture();
  const provenance = await analyzeProvenance({ entryFile: report, dependencies: [report, shared], model });
  const direct = provenance.tables.direct;
  assert.equal(direct.rows[0][0].editable, true);
  assert.equal(direct.rows[0][0].expected, '"Alpha"');
  assert.equal(direct.rows[1][1].editable, true);
  assert.equal(direct.rows[1][1].expected, "2.5");

  const imported = provenance.tables.assumptions.rows[0][1];
  assert.equal(imported.editable, true);
  assert.equal(imported.file, shared);
  assert.equal((await fs.readFile(shared, "utf8")).slice(imported.start, imported.end), "60");
  assert.equal(imported.via, "price");

  const computed = provenance.tables.comparison.rows[0][3];
  assert.equal(computed.editable, false);
  assert.deepEqual(computed.refs.map((ref) => ref.text), ["60", "10"]);
  assert.ok(computed.refs.every((ref) => ref.file === shared));

  const chart = provenance.charts.revenue;
  assert.equal(chart.bars[0].editable, false);
  assert.deepEqual(chart.bars[0].refs.map((ref) => ref.text), ["60", "10"]);
});

test("computed references resolve module-qualified paths", async () => {
  const { shared, report, model } = await fixture();
  const provenance = await analyzeProvenance({ entryFile: report, dependencies: [report, shared], model });
  const cell = provenance.tables.qualified.rows[0][1];
  assert.equal(cell.editable, false);
  assert.ok(cell.refs.some((ref) => ref.file === shared && ref.text === "60"), JSON.stringify(cell.refs));
});

test("a runtime value that does not match the literal stays read-only", async () => {
  const { shared, report, model } = await fixture();
  model.items.find((item) => item.id === "direct").rows[0][1] = 8;
  const provenance = await analyzeProvenance({ entryFile: report, dependencies: [report, shared], model });
  const cell = provenance.tables.direct.rows[0][1];
  assert.equal(cell.editable, false);
  assert.match(cell.reason, /does not match/);
});

test("duplicate table ids and header drift disable editing instead of guessing", async () => {
  const { shared, report, model } = await fixture();
  const source = await fs.readFile(report, "utf8");
  await fs.writeFile(report, source.replace('val revenue =', 'val duplicate = CreateCell("direct", "Duplicate", ["Name", "Value"], [["Gamma", 3]])\nval revenue ='), "utf8");
  const provenance = await analyzeProvenance({ entryFile: report, dependencies: [report, shared], model });
  assert.equal(provenance.tables.direct.rows[0][1].editable, false);

  const { root } = await fixture();
  const other = path.join(root, "other.mls");
  await fs.writeFile(other, `val table = CreateCell("direct", "Direct", ["Name", "Wrong"], [["Alpha", 7]])`, "utf8");
  const second = await analyzeProvenance({ entryFile: other, dependencies: [other], model: { items: [{ id: "direct", kind: "table", name: "Direct", headers: ["Name", "Value"], rows: [["Alpha", 7]] }] } });
  assert.equal(second.tables.direct.rows[0][1].editable, false);
  assert.ok(second.tables.direct.warnings.length > 0);
});

test("literal replacement preserves the cell type and rejects expressions", () => {
  assert.equal(replacementFor("80", "number").text, "80");
  assert.equal(replacementFor("2.50", "number").text, "2.50");
  assert.equal(replacementFor("Ada", "string").text, '"Ada"');
  assert.equal(replacementFor("80", "string").text, '"80"');
  assert.equal(replacementFor('"Ada"', "string").text, '"Ada"');
  assert.equal(replacementFor("true", "boolean").text, "true");
  assert.equal(replacementFor("null", "null").text, "null");
  assert.match(replacementFor("1 + 1", "number").error, /number/);
  assert.match(replacementFor("", "number").error, /Enter/);
  assert.match(replacementFor("maybe", "boolean").error, /true or false/);
});
