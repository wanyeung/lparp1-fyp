# MLscript Studio — hkmc2 compiler extension

This is a **desktop VS Code extension** that compiles `.mls` files with the real hkmc2 compiler from the [HKUST TACO MLscript repository](https://github.com/hkust-taco/mlscript/tree/hkmc2). It also provides a lightweight split Studio Workspace: editable MLscript source on the left and its ordered table-and-chart document view on the right.

## What it does

- Registers `.mls` as MLscript.
- Compiles with the bundled hkmc2 Scala.js compiler when a local `.mls` file is saved.
- Publishes hkmc2 errors and warnings as normal VS Code diagnostics, so they appear inline and in **Problems**.
- Creates the compiler's generated `.mjs` file beside a saved `.mls` source file on a successful compilation.
- Compiles unsaved editor changes by using a temporary sibling source file, then removes that temporary `.mls` and `.mjs` pair.
- Shows compiler activity and detailed messages in **View → Output → MLscript hkmc2**.
- Opens a two-pane **MLscript Studio Workspace** with editable source and a live document projection.
- Renders source-backed tables plus bar and pie charts with explicit table-to-chart provenance links.
- Lets a user drag document artifacts to change their presentation order; the new order is written to source as an `@order` comment.

The extension does not execute compiled code. The document layer is presentation metadata; hkmc2 still owns MLscript parsing, checking, diagnostics, and JavaScript generation.

## Use it

Open a local `.mls` file in desktop VS Code. Compile it with any of the following:

- **MLscript: Compile Current File** from the Command Palette.
- The Run button in the editor title bar.
- `Ctrl+Alt+M` on Windows/Linux, or `Cmd+Option+M` on macOS.
- Save the document. This is enabled by default.

Example:

```mlscript
module Main with
  fun hello() = "hello"
```

An error is shown inline immediately:

```mlscript
module Main with
  fun hello() = missingName
```

Change the `mlscriptStudio.compileOnSave` setting to `false` if you only want manual compilation. `mlscriptStudio.showSuccessNotification` is `false` by default to keep the native editor unobtrusive.

## Studio Workspace and provenance

Use **MLscript: Open Studio Workspace**, or choose **Reopen Editor With... → MLscript Studio Workspace**. The left pane edits the actual `.mls` text. The right pane renders document artifacts in their source-backed order.

Tables are declared as ordinary line comments, so the hkmc2 compiler ignores the presentation data and still compiles the MLscript program itself:

```mlscript
module Report with
  fun total(a, b) = a + b

// @order table:employees, table:teams, chart:headcount-by-team

// @table Employees
// id,name,team
// 1,Ada,Engineering
// 2,Leila,Design
// @endtable

// @table Teams
// team,headcount
// Engineering,2
// Design,1
// @endtable

// @chart Headcount by team
// type: bar
// source: Teams
// x: team
// y: headcount
// @endchart
```

The `@table` and `@chart` directives are ordinary line comments, not upstream hkmc2 table syntax. The source file remains the source of truth. Clicking a chart's **From [table]** link highlights the table it refers to. Dragging an artifact updates only the `@order` directive, so it changes presentation order without modifying the program or severing chart provenance.

## hkmc2 runtime

The packaged compiler is an hkmc2 Scala.js build from the `hkmc2` branch of `hkust-taco/mlscript`, commit `1a86e1c` (2026-09-02). It includes a small `NotebookCompiler` adapter that constructs hkmc2's Scala compiler context with the extension's bundled standard library. The adapter does not parse or type-check MLscript itself; all actual compilation is done inside hkmc2.

The adapter's source is at `tools/NotebookCompiler.scala`; runtime provenance is recorded in `runtime/VERSION.md`.

## Desktop VS Code only

This build deliberately targets VS Code's Node.js extension host. The current hkmc2 JavaScript compiler uses Node's filesystem module, so it cannot run unchanged inside the browser worker used by `vscode.dev`. Supporting VS Code for the Web later requires a browser-ready hkmc2 filesystem implementation or a remote compiler service.

## Develop and package

Requirements: Node.js 20+ and desktop VS Code.

```bash
npm install
npm test
```

Press **F5** in VS Code to open an Extension Development Host, then create or open a local `.mls` file.

Create an installable VSIX:

```bash
npm run package
```

## Refresh hkmc2

The current compiler runtime is bundled so normal users do not need Scala or sbt. To refresh it from upstream, install Java and sbt, then run:

```bash
./scripts/update-hkmc2.sh
npm test
npm run package
```

The script checks out `hkust-taco/mlscript` branch `hkmc2`, inserts the adapter only into that local build checkout, runs `hkmc2JS/fastLinkJS`, stages the compiler and standard library under `runtime/`, and validates the standard library with the real compiler.
