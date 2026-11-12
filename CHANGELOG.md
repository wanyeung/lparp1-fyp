# Changelog

## 0.7.1 — Six use-case notebooks
- Added `examples/usecases/` with all six worked scenarios: compound interest, cooling measurements, a shared two-document portfolio, subscription pricing, cleaned experiment data, and risk-formula review.
- Adapted the cases to the combined workspace: green assumption/raw cells and chart bars are editable, computed/derived values stay read-only with provenance links, and every entry has a `displayOrder` for card reordering.
- Added a direct raw-readings table and draggable raw-temperature chart to case 5, and exposed the portfolio allocation weights as editable assumption cells in case 3.
- Added a `studio-usecases/` copy step to **MLscript: Add Document Library to Workspace**, with source imports rewritten to the generated `studio/Studio.mls` library.
- Added build/provenance tests for all eight use-case entry points.

## 0.7.0 — Combined workspace

- Combined the library-based hkmc2 execution engine (`CreateCell`, `CreateGroup`, `Display`, `Model`) with the bidirectional drag-and-drop table/chart prototype.
- Added a static provenance index to the build result. It resolves direct literals, aliases, module-qualified imported values, list/record paths and computed-expression references across every `.mls` module in the build graph.
- Table cells can now be edited in the document pane. A successful edit patches one exact source literal, saves the module, recompiles with hkmc2 and refreshes both panes.
- Chart bars and numeric series points can be dragged to patch their y-column literal. Computed, ambiguous, stale or mismatched values remain read-only and expose their dependency literals instead.
- Added a source-pane file selector for the entry module and imported models, plus reveal-in-source links for computed cells.
- Added chart view switching: bar, column, pie, donut and radar for categorical data; line, area, step, scatter and lollipop for numeric series.
- Preserved `displayOrder` drag reordering, including when the literal lives in an imported model.
- Added top-level `document`/`model` export support to the build runner, alongside module exports.
- Added the multi-file `examples/subscription` demo with imported provenance and an editable bar chart.
- Added jsdom interaction tests, provenance unit tests, and end-to-end patch → hkmc2 rebuild tests.

## 0.6.x — Interaction prototype

- Prototype table/chart grid interactions, chart type switching, bar dragging, keyboard cell editing and provenance fragments.
- See the referenced prototype task for the standalone webview experiments.

## 0.5.1 — Library execution

- Real MLscript `Studio.mls` API executed by hkmc2.
- `Display`/`Model` HTML and document model generation.
- Source-backed `displayOrder` reordering, derived tables, multi-series line charts and live preview.
