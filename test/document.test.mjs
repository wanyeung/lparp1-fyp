import assert from "node:assert/strict";
import test from "node:test";
import { parseDocumentModel, parseDocumentTables, rewriteDocumentOrder } from "../dist/document.mjs";

const source = `module Demo with
  fun add(a, b) = a + b

// @order table:employees, chart:headcount-by-team, table:teams, chart:project-budget, table:projects

// @table Employees
// id,name,team
// 1,Ada,Engineering
// 2,"Marco, Jr.",Engineering
// @endtable

// @table Teams
// team,headcount
// Engineering,2
// Design,1
// Operations,1
// @endtable

// @chart Headcount by team
// type: bar
// source: Teams
// x: team
// y: headcount
// @endchart

// @table Projects
// project,budget
// Compiler refresh,50000
// Document view,30000
// @endtable

// @chart Project budget
// type: pie
// source: Projects
// x: project
// y: budget
// @endchart
`;

test("extracts tables, charts, provenance links, and explicit presentation order", () => {
  const model = parseDocumentModel(source);
  assert.deepEqual(model.order, [
    "table:employees",
    "chart:headcount-by-team",
    "table:teams",
    "chart:project-budget",
    "table:projects",
  ]);
  assert.deepEqual(model.items.map((item) => item.id), model.order);

  const chart = model.items.find((item) => item.id === "chart:headcount-by-team");
  assert.equal(chart.kind, "chart");
  assert.equal(chart.chartType, "bar");
  assert.equal(chart.sourceTableId, "table:teams");

  const tables = parseDocumentTables(source);
  assert.deepEqual(tables[0].rows[1], ["2", "Marco, Jr.", "Engineering"]);
});

test("rewrites only @order after a drag-and-drop reorder", () => {
  const nextOrder = [
    "table:employees",
    "table:teams",
    "chart:headcount-by-team",
    "table:projects",
    "chart:project-budget",
  ];
  const rewritten = rewriteDocumentOrder(source, nextOrder);
  assert.match(rewritten, /\/\/ @order table:employees, table:teams, chart:headcount-by-team, table:projects, chart:project-budget/);
  assert.match(rewritten, /module Demo with/);
  assert.match(rewritten, /\/\/ @chart Project budget/);
  assert.deepEqual(parseDocumentModel(rewritten).order, nextOrder);
});
