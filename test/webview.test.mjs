import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";

const entryPath = "/workspace/report.mls";
const sharedPath = "/workspace/shared/Model.mls";
const entrySource = `import "./shared/Model.mls"\nimport "./library/Studio.mls"\nval document = Display(CreateCell("comparison", "Comparison", ["Scenario", "Price", "Seats", "Revenue"], [["Baseline", 60, 10, 600]]))`;
const sharedSource = `module Model with\n  val price = 60\n  val seats = 10\n  val max = 100`;

function cell(overrides) {
  return Object.assign({ editable: false, refs: [] }, overrides);
}

function workspaceState() {
  const items = [
    { id: "comparison", kind: "table", name: "Comparison", headers: ["Scenario", "Price", "Seats", "Revenue"], rows: [["Baseline", 60, 10, 600]], groupId: "main" },
    { id: "direct", kind: "table", name: "Direct", headers: ["Name", "Value"], rows: [["Alpha", 7], ["Beta", 2.5]], groupId: "main" },
    { id: "assumptions", kind: "table", name: "Assumptions", headers: ["Item", "Value"], rows: [["Price", 60], ["Max", 100]], groupId: "main" },
    { id: "revenue", kind: "chart", name: "Revenue", chartType: "bar", sourceTableId: "comparison", sourceName: "Comparison", x: "Scenario", y: "Revenue", data: [{ label: "Baseline", value: 600 }], groupId: "main" },
    { id: "simple", kind: "chart", name: "Simple", chartType: "bar", sourceTableId: "assumptions", sourceName: "Assumptions", x: "Item", y: "Value", data: [{ label: "Price", value: 60 }, { label: "Max", value: 100 }], groupId: "main" },
    { id: "note", kind: "text", name: "Note", text: "Hello", groupId: "main" },
  ];
  return {
    type: "workspace",
    fileName: "report.mls",
    entryFile: entryPath,
    files: [
      { path: entryPath, label: "report.mls", source: entrySource, isEntry: true },
      { path: sharedPath, label: "shared/Model.mls", source: sharedSource, isEntry: false },
    ],
    model: { items: items, order: items.map((item) => item.id), groups: [{ id: "main", name: "Main", itemIds: items.map((item) => item.id) }] },
    provenance: {
      version: 1,
      entryFile: entryPath,
      files: [],
      warnings: [],
      tables: {
        comparison: {
          id: "comparison", title: "Comparison", file: entryPath, headers: ["Scenario", "Price", "Seats", "Revenue"],
          rows: [[
            cell({ editable: true, file: entryPath, start: 0, end: 10, expected: '"Baseline"', literalValue: "Baseline", literalType: "string", decimals: 0, expr: '"Baseline"' }),
            cell({ editable: true, file: sharedPath, start: 0, end: 2, expected: "60", literalValue: 60, literalType: "number", decimals: 0, expr: "price", via: "price" }),
            cell({ editable: true, file: sharedPath, start: 10, end: 12, expected: "10", literalValue: 10, literalType: "number", decimals: 0, expr: "seats", via: "seats" }),
            cell({ editable: false, expr: "price * seats", targetKind: "expr", refs: [
              { file: sharedPath, start: 0, end: 2, text: "60", value: 60, literalType: "number" },
              { file: sharedPath, start: 10, end: 12, text: "10", value: 10, literalType: "number" },
            ] }),
          ]],
        },
        direct: {
          id: "direct", title: "Direct", file: entryPath, headers: ["Name", "Value"],
          rows: [
            [cell({ editable: true, file: entryPath, start: 20, end: 27, expected: '"Alpha"', literalValue: "Alpha", literalType: "string", decimals: 0 }), cell({ editable: true, file: entryPath, start: 29, end: 30, expected: "7", literalValue: 7, literalType: "number", decimals: 0 })],
            [cell({ editable: true, file: entryPath, start: 34, end: 40, expected: '"Beta"', literalValue: "Beta", literalType: "string", decimals: 0 }), cell({ editable: true, file: entryPath, start: 42, end: 45, expected: "2.5", literalValue: 2.5, literalType: "number", decimals: 1 })],
          ],
        },
        assumptions: {
          id: "assumptions", title: "Assumptions", file: entryPath, headers: ["Item", "Value"],
          rows: [
            [cell({ editable: true, file: entryPath, start: 50, end: 57, expected: '"Price"', literalValue: "Price", literalType: "string" }), cell({ editable: true, file: sharedPath, start: 0, end: 2, expected: "60", literalValue: 60, literalType: "number", decimals: 0 })],
            [cell({ editable: true, file: entryPath, start: 60, end: 65, expected: '"Max"', literalValue: "Max", literalType: "string" }), cell({ editable: false, expr: "max", refs: [] })],
          ],
        },
      },
      charts: {
        revenue: {
          id: "revenue", title: "Revenue", chartType: "bar", sourceTableId: "comparison", x: "Scenario", y: "Revenue",
          bars: [cell({ editable: false, expr: "price * seats", refs: [{ file: sharedPath, start: 0, end: 2, text: "60" }, { file: sharedPath, start: 10, end: 12, text: "10" }], label: "Baseline", value: 600, index: 0 })],
          series: [], warnings: [],
        },
        simple: {
          id: "simple", title: "Simple", chartType: "bar", sourceTableId: "assumptions", x: "Item", y: "Value",
          bars: [
            cell({ editable: true, file: sharedPath, start: 0, end: 2, expected: "60", literalValue: 60, literalType: "number", decimals: 0, label: "Price", value: 60, index: 0 }),
            cell({ editable: false, expr: "max", refs: [], label: "Max", value: 100, index: 1 }),
          ],
          series: [], warnings: [],
        },
      },
    },
    libraryMode: true,
    livePreview: false,
    buildError: null,
    stale: false,
    dirtyFiles: [],
    status: "Built in 10 ms",
    diagnostics: [],
    trusted: true,
  };
}

async function mount() {
  const script = await fs.readFile(new URL("../media/webview.js", import.meta.url), "utf8");
  const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://studio.test/",
  });
  const messages = [];
  const saved = {};
  dom.window.acquireVsCodeApi = () => ({
    postMessage: (message) => messages.push(message),
    getState: () => saved,
    setState: (value) => Object.assign(saved, value),
  });
  dom.window.Element.prototype.scrollIntoView = function () {};
  dom.window.eval(script);
  const dispatch = (data) => dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data }));
  dispatch(workspaceState());
  return { dom, messages, dispatch };
}

test("renders the source selector, editable cells, computed refs and charts", async () => {
  const { dom } = await mount();
  const document = dom.window.document;
  assert.ok(document.querySelector(".workspace"));
  assert.equal(document.querySelectorAll("#file-select option").length, 2);
  assert.ok(document.querySelector('td[data-table="comparison"][data-row="0"][data-column="1"]').classList.contains("editable"));
  const computed = document.querySelector('td[data-table="comparison"][data-row="0"][data-column="3"]');
  assert.ok(computed.classList.contains("computed"));
  assert.ok(computed.querySelector(".fx"));
  assert.equal(computed.querySelectorAll(".chip").length, 2);
  assert.ok(document.querySelector('.track.editable[data-chart="simple"]'));
  assert.ok(document.querySelector('.track:not(.editable)[data-chart="revenue"]'));
});

test("editing a table cell posts a source patch for the exact cell", async () => {
  const { dom, messages } = await mount();
  const document = dom.window.document;
  const cell = document.querySelector('td[data-table="direct"][data-row="0"][data-column="1"]');
  cell.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const input = cell.querySelector("input.cell-input");
  assert.ok(input);
  input.value = "9";
  input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const patch = messages.find((message) => message.type === "patch");
  assert.deepEqual(JSON.parse(JSON.stringify(patch.target)), { kind: "table", itemId: "direct", row: 0, column: 1 });
  assert.equal(patch.value, "9");
  assert.equal(patch.entrySource, entrySource);
});

test("clicking a computed cell reveals its first source reference", async () => {
  const { dom } = await mount();
  const document = dom.window.document;
  const cell = document.querySelector('td[data-table="comparison"][data-row="0"][data-column="3"]');
  cell.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const textarea = document.querySelector("#source");
  assert.equal(textarea.value, sharedSource);
  assert.equal(textarea.selectionStart, 0);
  assert.equal(textarea.selectionEnd, 2);
});

test("dragging an editable chart bar posts a numeric source patch", async () => {
  const { dom, messages } = await mount();
  const document = dom.window.document;
  const track = document.querySelector('.track.editable[data-chart="simple"][data-bar="0"]');
  track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 20, right: 200, bottom: 20 });
  track.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 10 }));
  track.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 13 }));
  track.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 13 }));
  const patch = messages.find((message) => message.type === "patch");
  assert.deepEqual(JSON.parse(JSON.stringify(patch.target)), { kind: "chart", itemId: "simple", barIndex: 0 });
  assert.equal(patch.value, "50");
});

test("clicking an editable bar without moving does not patch the source", async () => {
  const { dom, messages } = await mount();
  const document = dom.window.document;
  const track = document.querySelector('.track.editable[data-chart="simple"][data-bar="0"]');
  track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 20, right: 200, bottom: 20 });
  track.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 10 }));
  track.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 10 }));
  assert.equal(messages.some((message) => message.type === "patch"), false);
});

test("chart type switching renders a pie from the same provenance bars", async () => {
  const { dom } = await mount();
  const document = dom.window.document;
  const pieButton = document.querySelector('[data-chart-type="pie"][data-chart="simple"]');
  pieButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.ok(document.querySelector('.pie-svg'));
  assert.ok(document.querySelector('.pie-svg path[data-chart="simple"]'));
});

test("dragging a card within its group posts a displayOrder patch", async () => {
  const { dom, messages } = await mount();
  const document = dom.window.document;
  const handle = document.querySelector('.drag-handle[draggable="true"][data-id="direct"]');
  const card = document.querySelector('.artifact[data-id="comparison"]');
  const dataTransfer = { effectAllowed: "", setData: () => {} };
  const start = new dom.window.Event("dragstart", { bubbles: true });
  Object.defineProperty(start, "dataTransfer", { value: dataTransfer });
  handle.dispatchEvent(start);
  const drop = new dom.window.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
  card.dispatchEvent(drop);
  const reorder = messages.find((message) => message.type === "reorder");
  assert.deepEqual(reorder.order, ["direct", "comparison", "assumptions", "revenue", "simple", "note"]);
});

test("switching the source module changes the textarea and build uses the entry source", async () => {
  const { dom, messages } = await mount();
  const document = dom.window.document;
  const select = document.querySelector("#file-select");
  select.value = sharedPath;
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(document.querySelector("#source").value, sharedSource);
  document.querySelector("#build").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const build = messages.find((message) => message.type === "build");
  assert.equal(build.entrySource, entrySource);
});
