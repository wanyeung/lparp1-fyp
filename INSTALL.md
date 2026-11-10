# Install MLscript Studio

This add-in runs in desktop VS Code from the repository. It does not need a VSIX for development.

## Extension Development Host

1. Install Node.js 20 or newer and desktop VS Code.
2. Open the repository folder.
3. Press F5 and choose **Run MLscript Studio**.
4. In the new window, open a file in `usecases/`, or run **MLscript: Open Use Case** from the Command Palette.
5. Run **MLscript: Open Info, Grid, and Chart**, or press `Cmd+Option+M` (`Ctrl+Alt+M`).

Three panels open beside the editor: InfoView, GridView, and ChartView. They follow the `let` under the cursor. A green grid cell rewrites that literal. Grey cells and formula charts stay read-only.

`npm test` checks the five use cases, literal edits, and the three view panels.
