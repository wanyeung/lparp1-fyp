# MLscript Studio

COMP4981 final-year project, HKUST. This branch is a VS Code extension with three panels beside the editor: InfoView, GridView, and ChartView. The `.mls` file stays the source of truth. The cursor picks which `let` those panels show.

The add-in does not call a model. It reads the file you are editing.

## What is already on the other branches

| Branch | What it contains |
| --- | --- |
| `master` | An empty commit. |
| `feature/mvp-loop` | The hkmc2 compiler bundle, the standard library, and a first `inferKind` check for atoms, lists, and tables. |
| `prototype/vscode-ext` | A notebook UI. `.imlsnb` and `// %%` cells run through the compiler, then a grid edit rewrites a `mut { ... }` literal. |
| `VScode-extension---Not-Notebook-UI` | The studio write-up and extension manifest from 29 October. The commit does not include the extension source. |

This branch starts from that studio write-up and fills in the add-in plus five use cases. Notebook execution stays on `prototype/vscode-ext`. The compiler bundle stays on `feature/mvp-loop`.

## Use cases

Each file is one demonstration. It has two cases, and each case contains subcases. The subcases are the notes, tables, and charts for one part of the question. Every case still reads the same `let` bindings.

| File | Scenario | Edit this | This stays read-only |
| --- | --- | --- | --- |
| `usecases/student-learning.mls` | Course grade book with a pass mark | Component scores, weights, pass mark | Weighted total, pass margin, class mean |
| `usecases/financial-analysis.mls` | Household year with tax and a loan | Salary, side income, living costs, tax rate, loan terms, categories | Tax, cash balance, loan balance, emergency cover |
| `usecases/business-model.mls` | Café break-even for one month | Price, units, ingredient cost, waste, overheads, card fee, target profit | Contribution, break-even revenue, and break-even units |
| `usecases/experiment-measurements.mls` | Spring calibration and stiffness | Mass, raw length, temperature, zero offset | Force, stiffness, variance, residual |
| `usecases/algorithm-benchmark.mls` | Search timings at three sizes | Measured microseconds | Speedup, time per thousand keys, tenfold growth |

A document is a comment block (`// @document`) that picks tables, charts, and notes by id. The data lives in `let` bindings, so both documents change when one literal changes.

## Editing rules

- A cell is editable only when its own text is a number, string, or boolean literal. The edit rewrites that literal and nothing around it.
- A path such as `students.0.quiz`, or any formula, is computed. The cell shows the value and links back to the literals it reads. It is not rewritten.
- Dragging a bar is allowed only when the bar's value is a literal. The drag writes that same literal, then the table and the other chart refresh.
- Sorting and filtering change the open view only. They do not reorder the file.
- The projection refreshes as you edit (`mlscriptStudio.debounceMs`, default 120). This is not an hkmc2 compile. Whether a full compile should also run on save is unchanged from Meeting 6, and the compiler still lives on `feature/mvp-loop`.

Charts are drawn with SVG. Meeting 6 recommended D3.js for the draggable bar, and left the wider chart-library choice open. The drag gesture is the one from that meeting: drag a bar, update the source value, refresh the table and chart.

## Run it

Requirements: desktop VS Code and Node.js 20 or newer. There is no install step beyond the editor.

1. Open this folder in VS Code.
2. Press F5 (`Run MLscript Studio`). An Extension Development Host opens on `usecases/`.
3. Open a `.mls` file and run **MLscript: Open Info, Grid, and Chart**, or press `Cmd+Option+M` (`Ctrl+Alt+M`).
4. **MLscript: Open Use Case** lists the five demonstrations.

The editor is the code. InfoView, GridView, and ChartView are three separate panels. Move the cursor into another `let` and all three follow it. ChartView has a menu of every chart in the file. Under the heading Chart type, a row of buttons switches that chart among bar, column, line, area, step, scatter, lollipop, pie, donut, and radar. Click a source chip to select that text in the editor.

Computed numbers are not produced by the comment directives. After an edit, the extension runs the bundled hkmc2 compiler (`runtime/compiler/MLscript.mjs`, HKUST TACO hkmc2 at `1a86e1c`) on the same `let` bindings and shows that result. There is no Build button and no second document language. A table is a `let`. A chart comment only chooses which binding to draw. Authors do not write `CreateGroup`, `CreateCell`, `DeriveCell`, or `CreateText`.

```bash
npm test
```

## Outside this MVP

Spreadsheet formulas typed into a grid cell, sorting that rewrites the source, rich text, and LaTeX are out of scope. The expression reader covers numbers, strings, names, `.field` and `.0`, parentheses, and `+ - * /`.
