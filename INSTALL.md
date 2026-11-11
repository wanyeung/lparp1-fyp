# Install MLscript Studio 0.7.1

1. In desktop VS Code, open Extensions → `...` → **Install from VSIX...**.
2. Choose `mlscript-studio-0.7.1.vsix` and reload if prompted.
3. Open a local workspace folder.
4. Run **MLscript: Add Document Library to Workspace**.
5. Open the created `studio-demo.mls`, the multi-file demo `studio-subscription/SubscriptionReport.mls`, or one of the six cases under `studio-usecases/` (start with `studio-usecases/README.md`).
6. Run **MLscript: Build HTML Document**. It compiles with hkmc2, runs the compiled code, and creates the document model and HTML.
7. Run **MLscript: Open Studio Workspace** to see source on the left and the executed tables/charts on the right.

Only run the build on code and imports you trust. The extension blocks execution in untrusted workspaces. Compilation alone does not execute code.

## Editing in the combined workspace

- The left file selector lists the entry module and imported `.mls` modules. The textarea edits the real source file.
- Click a **green** table cell to edit its source literal. Press Enter to apply; Escape cancels. The extension patches the literal, saves the module, rebuilds with hkmc2, and refreshes both panes.
- Drag a **green** chart bar or line point to change the y-column literal. The chart, source table and document update after the rebuild.
- **Grey** cells are computed or not uniquely attributable. Click one, or a dependency chip, to reveal the source expression or literals. They are intentionally read-only.
- If the source changed after the last build, the document is stale. Build before editing values.
- Drag a card handle within its group to rewrite the single `val displayOrder = [...]` literal and rebuild.

The multi-file demo demonstrates imported provenance: editing a green assumption cell in `SubscriptionReport.mls` patches the literal in `Subscription.mls`, then updates the comparison table and both charts.

## Six worked use cases
`studio-usecases/` contains the six adapted scenarios: compound interest, a cooling experiment, a two-document portfolio, a subscription price review, cleaned experiment data, and a risk-formula review. Each entry exposes `displayOrder` for card reordering and uses the same green-cell/green-bar provenance editing described above. Case 3 opens either `case03/Analysis.mls` or `case03/Summary.mls`; case 5 opens `case05/Experiment.mls` or `case05/Report.mls`. All inputs are synthetic illustrative data.

## Live preview

Set `mlscriptStudio.livePreview` to `true` in a trusted workspace. Open Studio views rebuild automatically after saved source or imported-model edits. This executes code. Standalone browser pages do not auto-reload; reopen or refresh them after a rebuild.

## Developing the extension

```bash
npm install
npm run check
npm test
npm run package
```

Build a demo directly from the source repository:

```bash
npm run build:document -- examples/subscription/SubscriptionReport.mls
```

The README explains the provenance rules, the library API, supported chart types, reordering and execution restrictions.
