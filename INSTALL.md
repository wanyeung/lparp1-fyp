# Install MLscript Studio

## Install the VSIX

1. Download `mlscript-studio-0.4.0.vsix`.
2. In desktop VS Code, open the Extensions view.
3. Choose `...` → **Install from VSIX...**.
4. Select the downloaded file.
5. Open or create a local `.mls` file.

Run **MLscript: Compile Current File** from the Command Palette, click the Run button in the editor title bar, or press `Ctrl+Alt+M` (`Cmd+Option+M` on macOS).

Compiler errors appear under the relevant source code and in VS Code's **Problems** panel. Detailed compiler output is available in **View → Output → MLscript hkmc2**.

## Open Studio Workspace

Open a local `.mls` file, then run **MLscript: Open Studio Workspace** from the Command Palette. Alternatively, select **Reopen Editor With... → MLscript Studio Workspace**.

The left pane edits the actual `.mls` source. The right pane displays `// @table` blocks, `// @chart` blocks, and their source-backed order. Drag a table or chart in the right pane to update the `// @order` comment in source. A chart's **From [table]** link highlights the table it uses.

## Extension development

```bash
npm install
npm test
```

Open the project folder in desktop VS Code and press **F5**. In the Extension Development Host, open a local `.mls` file and compile it.

Create a VSIX with:

```bash
npm run package
```

## Host requirement

This version requires desktop VS Code. Its real hkmc2 compiler bundle uses Node's filesystem APIs and therefore does not run in vscode.dev unchanged.
