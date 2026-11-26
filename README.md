# Design the Future of Spreadsheets and Notebooks

COMP4981 Final Year Project, HKUST. Built on [MLscript](https://github.com/hkust-taco/mlscript).

Project notes: [COMP4981 FYP on Notion](https://app.notion.com/p/wanyeung/COMP4981-FYP-39b5d246eb7780a18015fe4e3b402a7a?source=copy_link)

Demo video: https://youtu.be/dAxtzRr72uA

## MLscript Studio

**The grid is a live view of your code.**

Spreadsheets are easy to use but hard to check. Code is easy to check but hard to see. MLscript Studio brings the two together: write your data and logic in VS Code, see them beside your code as live grids, charts and documentation, and share your spread-code with non-technical colleagues, who can open it in MLscript Studio Online. No install, no code.

### ⌨️ CodeView

_Write it once, in code._

- 🎯 **Code is the single source of truth.** Your data, formulas and charts all live in ordinary `.mls` source. Nothing sits in a hidden cell or a binary file. What you read is what runs, and every grid, chart and document is generated from it.
- 🧠 **Write data in whatever shape you need.** Inspired by Cellery (UIST ‘26). Write a list, a table, a nested record or a single value as a plain MLscript literal, without designing a spreadsheet first. DocumentView works out the shape and draws the right grid, including multi-level headers for nested data.
- 💾 **Save to run.** Press Ctrl+S and your code compiles and runs, and every view beside it updates. There’s no Run button to remember and no stale results.
- ⚡ **Real compiler, safe execution.** Code is compiled with the actual MLscript compiler and runs in its own process. A runaway loop can’t freeze your editor, and errors point to the exact line and column.

### 📖 DocumentView

_See your code as a document: grids, charts and prose, all rendered from source._

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

_Built by developers, readable by everyone._

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

## Installation Instructions

1. Install Node.js 22 (the version this was tested on).
2. Clone this repository.
3. Run `npm test`. It compiles `library/` into `build/library` and runs the tests, including the whole loop without any editor. There is nothing else to install.

## Usage

- VS Code: run `npm run vscode` (needs the `code` command on your PATH). It opens `build/demo`, a copy of `test/fixtures`, in an Extension Development Host. Open an `.mls` file and the Document View appears in the Secondary Side Bar, following your cursor. Choose Trust if VS Code asks, because the extension runs your `.mls` code. Needs VS Code 1.104 or newer.
- Browser: run `npm run browser` and open the address it prints (http://localhost:8080/ by default). Open an `.mls` or import a CSV, read the document, change the data in View source, and download the `.mls` or `.html`. The use cases in `test/fixtures/usecases/` are preloaded.

## Layout

- `runtime/`: the MLscript compiler and standard library, and `compile.mjs`, which builds `library/` into `build/library/`.
- `library/`: the loop itself, written in MLscript.
  - `model/`: `Primitive` (a table, list, atom or block) and `Document` (the tree to show). See `Doc.md`.
  - `controller/`: takes a host's payload, builds the tree and applies edits. `D3Manipulation/Marks.js` draws the charts.
  - `service/`: renders HTML, finds and rewrites literals in the source, and picks what the cursor is on.
  - `io/`: reads CSV and writes `.mls` and `.html`.
- `vscodehost/`: the VS Code extension, a thin host over `library/`.
- `browserhost/`: the website, a thin host over `library/` that compiles in the page.
- `test/`: the tests, and `fixtures/` with the sample `.mls` files.

## Histories

1. Version 0.0.0, minimum loop: the core is written in MLscript and compiled to JavaScript, and tells a single value, a list and a table apart (now `Primitive`).
2. Version 0.1.0, clean MVC skeleton: split into model, controller and service layers, with a VS Code extension and a browser host that imports a CSV and exports `.mls` or `.html`.
   - Init: save the file, it compiles and runs, then `Controller` calls `Primitive.make` to decide the kind of every `val` and `Document` decides what to show, as an ordered array of items.
   - Render: `Html.generateHtml` turns the items into a page.
   - Edit: a cell is found in the text of the file with `Source.locate` and rewritten with `SourceEdit.at`, then the file is written back and rendered again.
3. Version 0.2.0, the document is a tree instead of an ordered array: a `.mls` file is a document by itself, with no function to call and no program entrance, so any `.mls` file can be opened. Excel import comes next.
   - Init: `Document.ofFile` decides what to show and `Document.tree` forms the tree. Render: `Document.focus` takes the part of the tree under the cursor before `Html.generateHtml`.
   - Every node remembers its `path`, for example `["variableNameA", "listNameB", 0, 0]`. `Source.locate` follows that path through the text of the file and `SourceEdit` rewrites the one value it finds.
   - A `val` that is a record (`val x = { ... }`) is a block, a group of nodes, with no extra code. A block can hold tables, lists, values and more blocks.
   - A value imported from another file is read only and links to its source. A name that starts with `_`, such as `_dataA`, is not shown but charts can still read it. The top-level values can be reordered.
   - Chart editing is mostly unchanged; the duplicated chart code is removed and everything goes through `Marks.js` (mostly Owen's, with parts of Peter's version): `Marks.js` → `Controller.edit` → `Source.locate` → `SourceEdit.at` → write back to the file → render again.
   - Both hosts follow the same layout. The VS Code host is split into commands and services. The browser host now compiles in the page, has a home screen of saved documents with the use cases preloaded, and shows documents read only.
   - See `library/model/Doc.md` for how the tree works.

## Credits & Contact

- Wan Yeung: Overview & System Design (mwyeungad@connect.ust.hk, lowanyeung@gmail.com)
- Owen Chung: Literature Survey (lchengas@connect.ust.hk)
- Peter Yeontaek Oh: Feasibility Study, Streamlit (yohae@connect.ust.hk)
- Eunseo Lee: Planning & UI Design (eleean@connect.ust.hk)
