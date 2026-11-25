# Design the Future of Spreadsheets and Notebooks

COMP4981 Final Year Project, HKUST. Built on [MLscript](https://github.com/hkust-taco/mlscript).

Project notes: [COMP4981 FYP on Notion](https://app.notion.com/p/wanyeung/COMP4981-FYP-39b5d246eb7780a18015fe4e3b402a7a?source=copy_link)

## MLscript Studio

**The grid is a live view of your code.**

Spreadsheets are easy to use but hard to check. Code is easy to check but hard to see. MLscript Studio brings the two together: write your data and logic in VS Code, see them beside your code as live grids, charts and documentation, and share your spread-code with non-technical colleagues, who can open it in MLscript Studio Online. No install, no code.

### ⌨️ CodeView

*Write it once, in code.*

- 🎯 **Code is the single source of truth.** Your data, formulas and charts all live in ordinary `.mls` source. Nothing sits in a hidden cell or a binary file. What you read is what runs, and every grid, chart and document is generated from it.
- 🧠 **Write data in whatever shape you need.** Inspired by Cellery (UIST ‘26). Write a list, a table, a nested record or a single value as a plain MLscript literal, without designing a spreadsheet first. DocumentView works out the shape and draws the right grid, including multi-level headers for nested data.
- 💾 **Save to run.** Press Ctrl+S and your code compiles and runs, and every view beside it updates. There’s no Run button to remember and no stale results.
- ⚡ **Real compiler, safe execution.** Code is compiled with the actual MLscript compiler and runs in its own process. A runaway loop can’t freeze your editor, and errors point to the exact line and column.

### 📖 DocumentView

*See your code as a document: grids, charts and prose, all rendered from source.*

- 🔄 **Always in sync.** Change a number in the code and every table, chart and paragraph that uses it updates. No more copying figures into Word, or wondering whether the slide matches the data.
- 🗂️ **One codebase, many documents.** Use the same source for whatever each reader needs:
  - **Live view**: shows whatever your cursor is on. A module shows its group of outputs, a table shows its grid and chart, and a value shows just that value.
  - **Reference**: one document per `.mls` file, showing everything in the file and always in sync with the code. You can also generate a single Reference for a selected module that spans several files.
  - **HTML D3 Report**: your own selection. Right-click a snippet and choose Add to Report, or drag in parts of other documents, then arrange them freely. The report is saved as its own `.mls` file, so it stays in sync and under version control. Inspired by StickyLand (CHI ‘22).
- ▦ **GridView: edit the grid, and the code changes too.** Rather type into a table than edit code? Click a cell, type a value and press Enter. MLscript Studio writes the change back into your source, keeps your formatting, and re-runs. Add or delete rows the same way.
- 🔍 **Sort and filter.** Sort by any column, or filter with queries like `units>40` or `item=Tea`. Bidirectional with the source.
- 📊 **ChartView: charts that update as you edit.** Bar, line, scatter, area and more, drawn with D3. Charts redraw the moment their data changes and stay paired with their tables. Related work: [Visualization by Demonstration](https://ieeexplore.ieee.org/document/7539327) (Saket, Kim, Brown and Endert, IEEE TVCG 2017; code: [BahadorSaket/VbD](https://github.com/BahadorSaket/VbD)).
- 📝 **Rich text with LaTeX math (secondary).** Write doc comments in Markdown, with equations, and see them typeset beside your code. The live panel is inspired by Lean’s InfoView.
- 🧱 **Layout written in code, too.** Group outputs and style them in MLscript, for example by extending a displayable component with a color. Groups can be nested, so a document can have sections inside sections.
- 🔗 **Jump back to the source.** Click any table or chart in a document to open its definition in the code.
- 🔒 **Computed values stay honest.** Values calculated from other data are shown read-only, with a link to the data they come from. Change the source, and they follow.

### 🤝 Collaboration

*Built by developers, readable by everyone.*

- 🌐 **Share with MLscript Studio Online.** Send a link, and colleagues open your documents in the browser as grids, charts and reports. They don’t need VS Code or any code knowledge.
- 🔀 **Git-native.** Your work is plain source code, so every change gets reviewed, versioned and diffed like any other pull request. Nobody has to ask which copy is final.
- 🧩 **Works with your VS Code setup.** Live Share for pairing, Copilot for writing code, GitLens for history, LaTeX and Markdown extensions for writing up results.
- 🪄 **SafeWizardIO: data in and out, under control.** Every way data enters or leaves your code goes through one controlled gateway:
  - **CSV → code**: mount a CSV file and use it as a typed table in your code. The file stays where it is and nothing is copied into your source. Columns and types are checked when it loads, so a renamed or missing column shows up as an error, not a wrong number.
  - **Live source → code**: pull prices, rates or a database query into a data cell. It fetches only when you press Refresh, always returns a table of a fixed type, and shows when it last fetched.
  - **Document → code**: edits made in a grid or report are written back into your source as normal code changes. Bidirectional (additional feature).
  - **Code → document**: everything else is pure calculation, so the same inputs always give the same results.

### Out of scope

- Cell formulas: typing `=` expressions into a grid cell, and Alt+click cell references. Computation stays in code.

## Features

1. Version 0.0.0, minimum loop: the core is written in MLscript and compiled to JavaScript. It decides whether a value is a single value, a list or a table (now `Primitive`).
2. Version 0.1.0, clean skeleton: the table-to-code loop, demonstrated end to end with minimal manual effort and without AI. Save an `.mls` file, it compiles and runs in its own process, each top-level `val` appears as a grid, and editing a cell patches that literal in the source and runs again. Tables are arrays of rows with a header row. A CSV opens in the browser host and exports as `.mls` or `.html`. Charts (bar, column, pie, donut, radar, line, area, step, scatter, lollipop) are drawn with plain SVG; TODO: switch to D3. Excel import comes next.

## Installation Instructions

1. Install Node.js 22 (the version this was tested on).
2. Clone this repository.
3. Run `npm test`. It compiles `library/` into `build/library` and runs the tests, including the whole loop without any editor. There is nothing else to install.

## Usage

- VS Code: run `npm run vscode` (needs the `code` command on your PATH). It copies `test/fixtures` to `build/demo` and opens that folder, with `demo.mls`, in an Extension Development Host. Opening an `.mls` file opens the **Document View** in the Secondary Side Bar on the right (the MLscript icon there) by itself, and it never replaces the Explorer; the button at the right of the editor title bar, next to the other editor icons, or **MLscript: Open Document View** brings it back. The panel follows the cursor: on a variable or inside its table it shows that table, inside a function it shows the tables the function uses, and on a blank line or outside any declaration it shows the whole file. It needs VS Code 1.104 or newer. Settings `mlstudio.autoOpen` and `mlstudio.followCursor` turn the two behaviours off. If VS Code asks whether you trust the folder, choose Trust: the extension runs the code in your `.mls` files, so VS Code keeps it disabled in Restricted Mode. Edit a green cell and press Enter: the source is patched, saved and run again.
- Browser: run `npm run browser` and open http://localhost:8080/. It starts with a small CSV table. Open your own CSV, edit cells, download the `.mls` or the `.html`, or pick a view from **View Documentations**.

Demo video: https://youtu.be/dAxtzRr72uA

## Layout

- `runtime/`: the MLscript compiler bundle and standard library, `VERSION.md` for the commit, `Doc.md` for what is in it, and `compile.mjs`, which builds `library/` into `build/library/`.
- `library/`: the loop itself, written in MLscript.
  - `model/`: `Primitive` is a table, a list, an atom or a block. `Sheet` holds primitives and records the `.mls` file it references and whether it is derived from other sheets. `Document` describes what to show: a sequence of imported primitives (optionally renamed) and Markdown text. One `.mls` file can have many documents. `Chart` lists Bar, Line and Pie, and a Document can chart columns of a table.
  - `controller/`: receives a host's payload, builds the sheet and the default document of a saved file, and applies edits. `D3Manipulation/` holds chart drag code and a TODO, see its README.
  - `service/`: `Html.generateHtml` renders items for a webview, `Charts.js` draws the charts in the page (plain SVG, ported from ggongtaek's `media/webview.js`), `Source` finds things in the source text (a declaration, a table cell, the word under the cursor), `SourceEdit` rewrites one literal there, and `Scope` picks which tables the cursor is on.
  - `io/`: `Csv` reads CSV, `Export` writes `.mls` and `.html`.
- `vscodehost/`: the VS Code extension, a thin host over `library/`.
- `browserhost/`: the website, a thin host over `library/`.
- `test/`: tests, and `fixtures/`: `demo.mls`, Owen's `usecases/` and ggongtaek's `examples/` (two entry points sharing one module). The use cases and examples are not wired in yet: the bundled compiler fails on three of the use cases, and the examples import builders from ggongtaek's `Studio.mls`, which is not here.

## Credits & Contact

- Wan Yeung: Overview & System Design (mwyeungad@connect.ust.hk, lowanyeung@gmail.com)
- Owen Chung: Literature Survey (lchengas@connect.ust.hk)
- Peter Yeontaek Oh: Feasibility Study, Streamlit (yohae@connect.ust.hk)
- Eunseo Lee: Planning & UI Design (eleean@connect.ust.hk)
