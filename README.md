# MLscript Studio 0.7.1

A desktop VS Code extension and MLscript document library built on the bundled HKUST TACO **hkmc2** compiler. The Studio Workspace keeps the real source on the left and the executed document on the right. Tables and charts are produced by running `Display`/`Model`, not by parsing comments.

0.7.x combines two earlier lines of work:

- the library-based execution engine (`CreateCell`, `CreateGroup`, `Display`, `Model`) from 0.5.x; and
- the bidirectional table/chart interaction prototype from 0.6.x.

The result is a workspace where editing a table cell or dragging a chart bar patches the **exact source literal**, saves the module, recompiles with hkmc2, and refreshes both the source and document views.

## Quick start

1. Install `mlscript-studio-0.7.1.vsix` through Extensions → `...` → **Install from VSIX...**.
2. Open a local workspace folder.
3. Run **MLscript: Add Document Library to Workspace**. This creates:
   - `studio/Studio.mls` and `studio/Render.mjs`;
   - `studio-demo.mls` (single-file tables and charts);
   - `studio-subscription/Subscription.mls` and `studio-subscription/SubscriptionReport.mls` (multi-file imported provenance and an editable chart);
   - `studio-usecases/` with the six worked cases and `studio-usecases/README.md`.
4. Open a demo or one of the six cases and run **MLscript: Build HTML Document**.
5. Run **MLscript: Open Studio Workspace**, or **Reopen Editor With... → MLscript Studio Workspace**.

The build creates `.mjs`, `.html`, and (when `model` is exported) `.document.json` files next to the entry. The standalone HTML needs no server, external scripts, or network access.

## The combined workspace

The custom editor is split into two panes.

**Source pane (left).** The file selector lists the entry module and every imported `.mls` module in the build. Editing the textarea writes to the real VS Code `TextDocument`. `Ctrl+S`/`Cmd+S` saves the selected module. The status shows whether the selected module has unsaved changes.

**Document pane (right).** This is the executed `Display` output, reconstructed from the `Model` tree. It supports:

- tables with filtering and column sorting;
- table-cell editing (green cells);
- bar, column, pie, donut and radar views of categorical data;
- line, area, step, scatter and lollipop views of numeric series;
- dragging editable chart bars and line points;
- computed-value provenance chips;
- drag-and-drop reordering within a group;
- source references that jump to the exact literal or expression in the left pane.

**Green** means the displayed value comes from one editable source literal. **Grey** means the value is computed, derived, ambiguous, stale, or otherwise not safe to overwrite. Click a grey cell or a chip to reveal the literals or expression it depends on.

## Bidirectional editing

### Table cells

Click a green cell, type a value, and press Enter (or leave the field). The extension:

1. resolves the cell to a source range recorded by the build's provenance index;
2. checks that the source still contains exactly the literal that was compiled;
3. validates the replacement against the original literal type (number stays number, string stays string, boolean stays boolean);
4. applies a one-literal `WorkspaceEdit`, saves the module, and rebuilds;
5. posts the new model and provenance so both panes refresh.

`Escape` cancels. A read-only cell does not open an editor. A computed cell such as `price * seats` is never replaced by its displayed result; clicking it reveals `price` and `seats` instead.

### Chart bars and points

Dragging a green bar edits the **y-column literal in the source table**, then rebuilds. For a categorical bar/column/radar chart, the bar's row determines the source table row; for a pie/donut chart, use the editable legend value or edit the table cell. For a numeric series, dragging a green point edits the corresponding y literal.

A chart whose y column is computed (for example a contribution column) is intentionally read-only. Its bars show a lock/fx affordance and expose their dependency literals. This prevents a drag from silently overwriting a formula.

### Source edits

Editing the textarea sends a full-text update to the extension host. With `mlscriptStudio.livePreview` enabled in a trusted workspace, saved edits rebuild automatically after a short debounce. Without live preview, select **Build** to compile and refresh. If the source changed after the last build, the document is marked stale and all value editing is disabled until it is rebuilt.

### Reordering

Drag the handle of a card within its group. The extension rewrites the single `val displayOrder = [...]` literal (in the entry module or an imported model), saves, and rebuilds. Moving items across groups is not supported by drag-and-drop; edit the `CreateGroup` children in source instead.

## How provenance is established

hkmc2 executes the program and `Render.model()` returns displayed values. Those values no longer know which source text produced them. The build therefore emits a separate provenance index alongside the model.

The analyzer (`scripts/provenance.mjs`) parses every `.mls` module in the build graph and understands the deliberate Studio construction API:

```mlscript
val teams = CreateCell("teams", "Teams", ["team", "headcount"], [
  ["Engineering", 1 + 1],
  ["Design", 1]
])
val chart = BarChart("headcount-chart", "Headcount", teams, "team", "headcount")
val document = Display(report)
val model = Model(report)
```

It resolves:

- direct literals (`"Design"`, `1`, `2.5`, `true`, `null`);
- simple aliases (`val budget = 50000`; a cell that says `budget`);
- module-qualified imported values (`Subscription.price`);
- list and record paths (`students.0.quiz`, `config.rows`);
- computed expressions and calls, keeping references to the literals they read.

A cell is editable only when **all** of these hold:

- exactly one `CreateCell`/`DeriveCell` construction has that table id;
- the source table headers and row count match the executed table;
- the cell is a direct literal or resolves through aliases/paths to one literal;
- the executed value equals that literal's value;
- the last build is current.

Otherwise the cell is read-only. Duplicate ids, header drift, ambiguous module bindings, runtime/source mismatches, computed values and stale builds fail closed rather than guessing. The UI shows a provenance note when the analyzer cannot establish a unique link.

The analyzer never evaluates arbitrary MLscript. It only parses values, lists, records, paths, calls and raw expressions. The executed model remains the source of truth for displayed values.

## Library API

| Function | Arguments | Result |
| --- | --- | --- |
| `CreateGroup` | `id, title, children` | Nested group descriptor; children retain list order |
| `CreateCell` | `id, title, headers, rows` | Table descriptor; rows are lists of scalar values |
| `CreatCell` | Same as `CreateCell` | Alias supporting the original spelling |
| `CreateText` | `id, title, text` | Plain-text block |
| `BarChart` | `id, title, table, x, y` | Bar chart linked to the table value |
| `PieChart` | Same as `BarChart` | Pie chart linked to the table value |
| `LineChart` | `id, title, table, x, yColumns` | Overlay numeric series from one source table |
| `DeriveCell` | `id, title, sourceTable, headers, rows` | Computed table with a provenance link to the source |
| `Display` | `root` | Complete HTML string in group-child order |
| `Model` | `root` | Serializable document tree, groups, items, order and provenance |
| `DisplayOrdered` | `root, order` | HTML with explicitly ordered sibling items |
| `ModelOrdered` | `root, order` | The corresponding ordered model |

IDs must be unique. Rows must match the header width; cells may contain finite numbers, strings, booleans, or null. Charts require existing x/y columns and finite numerical y values. Negative pie values are rejected. Validation errors stop the HTML build.

The tree follows the **evaluated child lists**, not physical declaration line numbers. Groups can be nested. Reusing a table as a chart source does not duplicate it in the layout.

## Multi-file example

`examples/subscription/SubscriptionReport.mls` imports `Subscription.mls` and uses `DeriveCell`, `BarChart` and `LineChart`. The source assumptions table contains green cells whose literals live in the imported module. Dragging the first bar of **Assumption values** edits `Subscription.price`, rebuilds, and updates the comparison table and charts. The contribution columns are computed and remain read-only, with chips linking to `price`, `drinkCost` and `expectedRedemptions`.

The entry also defines:

```mlscript
val displayOrder = ["subscription-context", "subscription-workflow", ...]
val document = DisplayOrdered(report, displayOrder)
val model = ModelOrdered(report, displayOrder)
```

so drag reordering works in the multi-file demo too.
## Six use-case notebooks
`examples/usecases/` contains six worked scenarios adapted to the combined workspace. Each entry exposes `displayOrder`, so card reordering works, and its editable cells/bars use the same provenance patch path as the rest of the extension.

| Case | Entry point | Suggested edit |
| --- | --- | --- |
| 1. Compound interest | `case01/CompoundInterest.mls` | Change `annualRate` from `0.03` to `0.06`, or `years` from `10` to `30`. |
| 2. Cooling experiment | `case02/CoolingExperiment.mls` | Edit a raw observed temperature or `coolingCoefficientPerMinute`; drag the raw-temperature bar. |
| 3. Portfolio, two documents | `case03/Analysis.mls` and `case03/Summary.mls` | Edit an asset return or allocation weight in `case03/shared/Portfolio.mls`; both documents rebuild. |
| 4. Subscription price | `case04/SubscriptionReport.mls` | Drag the first **Assumption values** bar; it patches `Subscription.price` in `case04/shared/Subscription.mls`. |
| 5. Cleaning experiment data | `case05/Experiment.mls` and `case05/Report.mls` | Edit a raw reading or assumption; drag a raw-temperature bar. The report imports the same experiment group. |
| 6. Risk formula review | `case06/RiskReview.mls` | Toggle `useBuggyDenominator`; the selected-formula check fails and the toy estimates shrink. |

Case 1 has no directly editable chart because its annual balances are computed; its green assumption cells are editable. Case 3's Summary is a compact manager brief; edit the shared inputs from Analysis or the source pane. Case 5's raw table is direct and editable, while its status, excluded, cleaned and statistics tables are computed and read-only. All six use synthetic illustrative data, not live or historical observations.

## CLI

With Node.js 20+:

```bash
npm run build:document -- examples/library-report.mls
```

Or:

```bash
node scripts/build_document.mjs examples/subscription/SubscriptionReport.mls --out report.html
```

The CLI prints a JSON result with `--json`, including `model` and `provenance`. The bundled Scala.js compiler means ordinary users do not need Java or sbt. The builder emits imported MLscript modules explicitly, repairs the known Windows absolute-path ESM import issue, and resolves hkmc2's bare `runtime/std/...` imports to the bundled runtime before execution.

## Legacy metadata mode

Legacy `// @table`, `// @chart`, and `// @order` files remain available; `examples/company-report.mls` is the old metadata-based demo. In legacy mode the document pane is read-only and shows a banner. Add the Studio library and a `Display` export to enable provenance editing.

## Security and limitations

**Building executes code. Only build programs and imports you trust.** The extension refuses execution in untrusted workspaces. Builds run in a separate process with a 30-second timeout and a reduced inherited environment, but this is **not a security sandbox**: trusted code can still access files or the network. The standalone CLI is for trusted code only; callers should impose a timeout for unattended use.

Editing is intentionally narrow. A table cell or chart bar is patched only when it maps to one scalar literal. The extension does not rewrite arbitrary expressions, function bodies, headers, group membership, chart descriptors, or computed formulas. Ambiguous provenance is read-only. Source edits are verified against the compiled literal immediately before the edit; if the file changed, the edit is rejected and the user is asked to rebuild.

Generated HTML escapes labels and values, contains no scripts or external assets, and uses semantic tables plus inline SVG charts. The extension does not execute generated HTML scripts. This version is desktop-only because the compiler uses Node filesystem APIs.

## Development

```bash
npm install
npm run check
npm test
npm run package
```

Tests cover the renderer, legacy metadata, genuine hkmc2 compilation, provenance parsing across imported modules, computed-reference tracking, literal type preservation, webview interactions in jsdom, end-to-end patch → recompile → refreshed table/chart flows, and builds of all eight use-case entry points. Java/sbt are required only to rebuild hkmc2 with `scripts/update-hkmc2.sh`; bundled compiler provenance is in `runtime/VERSION.md`.

Key files:

- `library/Studio.mls` — MLscript document API;
- `library/Render.mjs` — HTML/model renderer;
- `scripts/build_document.mjs` — hkmc2 build, execution and provenance join;
- `scripts/provenance.mjs` — MLscript-aware source provenance analyzer;
- `src/documentBuild.ts` — trusted extension execution service;
- `src/documentView.ts` — combined source/document custom editor;
- `src/edit.ts` — literal validation and replacement;
- `media/webview.js` / `media/webview.css` — tables, charts, drag interactions and source links.
