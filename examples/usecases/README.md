# Six MLscript Studio use cases

These are the six worked scenarios, adapted from the library-based notebook
prototype to the combined Studio workspace. They use the real `CreateCell`,
`DeriveCell`, `CreateGroup`, `Display` and chart constructors from
`library/Studio.mls`; nothing is parsed from comments.

Every dataset and financial figure is a synthetic illustrative demo input, not
live market, experimental or historical data. The examples are educational and
are not forecasts, investment advice or production risk models.

## Entry points

| Case | Entry point | Suggested edit |
| --- | --- | --- |
| 1. Compound interest | `case01/CompoundInterest.mls` | Edit `annualRate` from `0.03` to `0.06`, or `years` from `10` to `30`. |
| 2. Cooling experiment | `case02/CoolingExperiment.mls` | Edit a raw observed temperature or `coolingCoefficientPerMinute`; drag the raw-temperature bar. |
| 3. Portfolio, two documents | `case03/Analysis.mls` and `case03/Summary.mls` | Edit an asset return or allocation weight in `case03/shared/Portfolio.mls`; both documents rebuild. |
| 4. Subscription price | `case04/SubscriptionReport.mls` | Drag the first **Assumption values** bar, which edits `Subscription.price` in `case04/shared/Subscription.mls`. |
| 5. Cleaning experiment data | `case05/Experiment.mls`; optionally `case05/Report.mls` | Edit a raw reading or assumption; drag a raw-temperature bar. The report imports the same experiment group. |
| 6. Risk formula review | `case06/RiskReview.mls` | Toggle `useBuggyDenominator`; the selected-formula check fails and the toy estimates shrink. |

There are eight entry documents for six scenarios: case 3 deliberately has an
`Analysis` and a `Summary` document sharing one calculation module, and case 5
deliberately has an `Experiment` document plus a `Report` document that imports
its group without copying results.

## Run the examples from the extension

1. Install the VSIX and open a trusted workspace folder.
2. Run **MLscript: Add Document Library to Workspace**. This creates `studio/`,
   `studio-demo.mls`, `studio-subscription/`, and the six-case tree under
   `studio-usecases/`.
3. Open one of the entry points above, select **Build**, then run
   **MLscript: Open Studio Workspace** (or **Reopen Editor With... → MLscript
   Studio Workspace**).
4. In the document view, green table cells and green chart bars/points are
   editable. Grey cells are computed, derived, ambiguous or stale and are
   read-only; clicking one reveals the source literals it depends on.
5. Use the source pane to edit the entry module or an imported module directly.
   Ctrl+S saves the selected module. With `mlscriptStudio.livePreview` enabled,
   saved changes rebuild automatically; otherwise select **Build** again.

## What the combined editor changes in these cases

The original use-case notebooks were written for source-only editing. In the
combined workspace:

- a green cell edit resolves to the exact literal in the owning `.mls` file,
  applies a narrow `WorkspaceEdit`, saves the file, recompiles with hkmc2 and
  refreshes the document;
- dragging a green bar or point uses the same provenance patch path;
- a computed or derived cell remains read-only, but its provenance chips jump
  to the literals that feed it;
- card drag-and-drop reorders leaves within their existing group by rewriting
  the `displayOrder` literal;
- if the source changes after the last build, the document is marked stale and
  value editing is refused until it is rebuilt.

Case 1 has no directly editable chart because its annual balances are computed;
edit its green assumption cells instead. Case 3's Summary is a compact manager
brief, so edit the shared assumptions or returns from Analysis (or the source
pane) and reopen Summary. Case 5's raw table is direct and editable, while the
status, excluded, cleaned and statistics tables are computed.

## Source layout

```text
examples/usecases/
  case01/CompoundInterest.mls
  case02/CoolingExperiment.mls
  case03/Analysis.mls
  case03/Summary.mls
  case03/shared/Portfolio.mls
  case04/SubscriptionReport.mls
  case04/shared/Subscription.mls
  case05/Experiment.mls
  case05/Report.mls
  case06/RiskReview.mls
```

The files import `library/Studio.mls` when run from the extension source tree.
The installer rewrites those imports to the generated `studio/Studio.mls`
library. Keep the module names and file names in sync: hkmc2 resolves imported
module names from their filenames.
