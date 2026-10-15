# vscode-mls — MLscript for VS Code (MVP)

Three features, all driven by the same MLscript cells as `../sheetbook-poc`:

1. **InfoView** — cursor-driven side panel (types, bounds, mixin chain) backed by a *mock* type server.
2. **Notebooks** — `.imlsnb` files open as VS Code notebooks; any `.mls` can be opened as a notebook (cells split on `// %% title`).
   Cells run through the **real hkmc2 compiler** (`../sheetbook-poc/build/MLscript.mjs`) in a child Node process.
3. **GridView + ChartView** — a cell that logs `{ kind: "grid" | "chart", ... }` shows up as a table / Vega-Lite chart in two separate tabs that follow the cell under the cursor.
   **Editing a grid cell patches the owning cell's source and re-runs** — the grid is a view of the code.

## Run
```
npm run compile      # media/ and out/ are prebuilt; `npm install` only needed to rebuild media/
code --extensionDevelopmentPath="<abs path to vscode-mls>" "<abs path to vscode-mls>\sample"
```
In the Extension Development Host window:

| Do this | Result |
|---|---|
| open `sample/demo.imlsnb` (or any `.mls`) | the **InfoView** opens beside it automatically (`mls.infoView.autoOpen`) |
| notebook: pick the **MLscript (hkmc2)** kernel, **Run All** | **GridView** and **ChartView** open as two tabs (column three); nothing is printed under the cells for grids/charts |
| click into another cell | both tabs switch to that cell's grid and chart (e.g. cursor on `rowsB`/`chartB` → **Rows B** / **Chart B**) |
| edit a value in GridView, press Enter | the `mut { … }` literal in the cell is rewritten, everything re-runs, grid + chart update |
| open `sample/notebook.mls` → **MLscript: Open as Notebook** (or Explorer right-click, or "Reopen Editor With…") | same cells stored as plain `.mls` (`// %% name` per cell) |
| **MLscript: New Notebook** | four starter cells (rowsA, chartA, rowsB, chartB) |

Titles come from the variable the cell defines: `let chartB = …` → "Chart B", `let rowsB = …` → "Rows B".
A chart is paired with the grid whose variable it reads (`values: rowsB`), so the cursor on either cell shows the pair.

## How a run works (same model as the PoC's kernel)
Running cell *N* recompiles and re-runs cells `[0..N]` as **one** file (`assemblePrefix`). A `console.log("@@mls-cell:i")` marker is
inserted before each cell so output goes to the cell that printed it, and compiler errors (character offsets) map back to *cell + line*.
The run happens in `runner/run.mjs`, a child process, so **Interrupt** and the timeout (`mls.runTimeoutMs`) can kill a runaway cell.

Cells talk to the views the PoC's way: `console.log(mut { kind: "grid", cellId: "data", rows: rows })`.
`cellId` is matched to the cell whose id/title is `data` (in `// %% data` markers the title is the id); if none matches, the cell that logged it is patched.

## Settings
- `mls.compilerBundle` — path to `MLscript.mjs` (default: `../sheetbook-poc/build/MLscript.mjs`, then `<workspace>/sheetbook-poc/build`, `<workspace>/build`)
- `mls.infoView.autoOpen` — open the InfoView when a `.mls` or MLscript notebook is opened (default true)
- `mls.nodePath` — Node binary for the runner (default: the editor's built-in Node)
- `mls.runTimeoutMs` — default 60000

## Layout
```
src/extension.ts            InfoView + calls activateNotebooks()
src/notebook/format.ts      .imlsnb + "// %%" parsers/serializers (pure)
src/notebook/assemble.ts    prefix assembly, offset -> cell/line
src/notebook/gridPatch.ts   grid edit -> source patch (pure)
src/notebook/runnerClient.ts  spawns runner/run.mjs, NDJSON events
src/notebook/controller.ts  NotebookController: events -> cell outputs
src/notebook/viewModel.ts   which grid/chart goes with which cell (pure)
src/notebook/views.ts       GridView / ChartView tabs + cursor-follow
src/notebook/index.ts       serializers, commands, grid-edit -> patch -> re-run
media-src/                  grid + chart UI (esbuild -> media/panel.js)
runner/run.mjs              compile with MLscript.mjs, run, emit events
test/                       unit.mjs (pure), e2e.mjs (needs the real compiler bundle)
```

## Known limits
- Whole-prefix re-run, like the PoC: not minimal, never wrong. A real dependency graph would only change `runThrough`.
- Grid patching is line-anchored (`mut { … }` rows with numeric/string literals), not a parser-level edit.
- Outputs are not saved in `.imlsnb` (the format has none); they are re-created by running.
- If the official MLscript extension is installed too, both claim `.mls`; disable one while testing.
