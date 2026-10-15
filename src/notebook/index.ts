/** Wires the notebook features into the extension. Called from extension.ts. */
import * as vscode from 'vscode';
import { MlsKernel } from './controller';
import { applyGridOp } from '../core/sourceEdit';
import { IMLSNB_TYPE, ImlsnbSerializer, PERCENT_TYPE, PercentSerializer } from './serializers';
import { GridEditMessage, ViewHub } from './views';

export const NOTEBOOK_TYPES = [IMLSNB_TYPE, PERCENT_TYPE];

/** The starter notebook: two (rows, chart) pairs, then one cell per grid shape (list, ragged table with a formula, block, hierarchical, 2D). */
export const STARTER_CELLS: { id: string; source: string }[] = [
  { id: 'dataA', source: [
    'let rowsA = [',
    '  mut { id: 1, label: "Alpha", value: 10 },',
    '  mut { id: 2, label: "Beta", value: 20 },',
    '  mut { id: 3, label: "Gamma", value: 15 }',
    ']',
    '',
    'console.log(mut { kind: "grid", cellId: "dataA", rows: rowsA })'].join('\n') },
  { id: 'chartA', source: [
    'let chartA = mut { mark: "bar", encoding: mut { x: mut { field: "label", \'type: "nominal" }, y: mut { field: "value", \'type: "quantitative" } }, \'data: mut { values: rowsA } }',
    '',
    'console.log(mut { kind: "chart", cellId: "chartA", spec: chartA })'].join('\n') },
  { id: 'dataB', source: [
    'let rowsB = [',
    '  mut { id: 1, product: "Tea", units: 40 },',
    '  mut { id: 2, product: "Coffee", units: 65 },',
    '  mut { id: 3, product: "Cocoa", units: 25 },',
    '  mut { id: 4, product: "Matcha", units: 55 }',
    ']',
    '',
    'console.log(mut { kind: "grid", cellId: "dataB", rows: rowsB })'].join('\n') },
  { id: 'chartB', source: [
    'let chartB = mut { mark: "bar", encoding: mut { y: mut { field: "product", \'type: "nominal" }, x: mut { field: "units", \'type: "quantitative" } }, \'data: mut { values: rowsB } }',
    '',
    'console.log(mut { kind: "chart", cellId: "chartB", spec: chartB })'].join('\n') },
  { id: 'listC', source: [
    'let scoresC = [72, 85, 90, 64]',
    '',
    'console.log(mut { kind: "grid", cellId: "listC", value: scoresC })'].join('\n') },
  { id: 'tableD', source: [
    'let rowsD = [',
    '  mut { id: 1, item: "Tea", note: "bestseller", units: rowsB.0.units },',
    '  mut { id: 2, item: "Coffee", units: rowsB.1.units * 2 },',
    '  mut { id: 3, item: "Cocoa" }',
    ']',
    '',
    'console.log(mut { kind: "grid", cellId: "tableD", value: rowsD })'].join('\n') },
  { id: 'blockE', source: [
    'let settingsE = mut { title: "Quiz hours", weeks: 6, target: mut { score: 80, hours: 5 } }',
    '',
    'console.log(mut { kind: "grid", cellId: "blockE", value: settingsE })'].join('\n') },
  { id: 'hierF', source: [
    'let salesF = [',
    '  mut { area: "North", q1: mut { tea: 10, coffee: 20 }, q2: mut { tea: 12, coffee: 18 } },',
    '  mut { area: "South", q1: mut { tea: 7, coffee: 25 }, q2: mut { tea: 9, coffee: 22 } }',
    ']',
    '',
    'console.log(mut { kind: "grid", cellId: "hierF", value: salesF })'].join('\n') },
  { id: 'gridG', source: [
    'let matrixG = [[1, 2, 3], [4, 5, 6]]',
    '',
    'console.log(mut { kind: "grid", cellId: "gridG", value: matrixG })'].join('\n') },
];

export function activateNotebooks(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel('MLscript Notebook');
  context.subscriptions.push(out);

  // The notebook that most recently ran / was active — target for GridView edits.
  let lastNotebook: vscode.NotebookDocument | undefined = vscode.window.activeNotebookEditor?.notebook;
  const kernels: Record<string, MlsKernel> = {};
  const kernelFor = (nb: vscode.NotebookDocument) => kernels[nb.notebookType];

  // Grid edit: patch the owning cell's source, then re-run so every view refreshes.
  const applyGridEdit = async (notebook: vscode.NotebookDocument | undefined, m: GridEditMessage) => {
    if (!notebook) { void vscode.window.showWarningMessage('MLscript: no notebook to patch.'); return; }
    const code = notebook.getCells().filter(c => c.kind === vscode.NotebookCellKind.Code);
    const byId = code.find(c => (c.metadata as { id?: string } | undefined)?.id === m.cellId);
    const cell = byId ?? code.find(c => c.index === m.cell);
    if (!cell) { void vscode.window.showWarningMessage(`MLscript: no cell "${m.cellId}" to patch.`); return; }

    const before = cell.document.getText();
    const { type: _t, cellId: _c, cell: _i, varName, ...op } = m;
    const result = applyGridOp(before, varName, op);
    if ('error' in result) { void vscode.window.showWarningMessage('MLscript grid: ' + result.error); return; }
    const after = result.source;
    if (after === before) return;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(cell.document.uri, new vscode.Range(0, 0, cell.document.lineCount, 0), after);
    if (!(await vscode.workspace.applyEdit(edit))) return;
    await kernelFor(notebook)?.runThrough(notebook, code[code.length - 1].index);
  };

  const hub = new ViewHub(context, m => {
    const nb = vscode.window.activeNotebookEditor?.notebook ?? lastNotebook;
    void applyGridEdit(nb, m);
  });
  kernels[IMLSNB_TYPE] = new MlsKernel(context, IMLSNB_TYPE, 'mls-kernel-imlsnb', hub, out);
  kernels[PERCENT_TYPE] = new MlsKernel(context, PERCENT_TYPE, 'mls-kernel-percent', hub, out);

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(IMLSNB_TYPE, new ImlsnbSerializer(), { transientOutputs: true }),
    vscode.workspace.registerNotebookSerializer(PERCENT_TYPE, new PercentSerializer(), { transientOutputs: true }),

    // cursor moves to another cell -> GridView / ChartView show that cell's grid + chart
    vscode.window.onDidChangeNotebookEditorSelection(e => hub.refresh(e.notebookEditor)),
    vscode.window.onDidChangeActiveNotebookEditor(ed => { if (ed) { lastNotebook = ed.notebook; hub.refresh(ed); } }),

    vscode.commands.registerCommand('mls.openGridView', () => hub.openGrid()),
    vscode.commands.registerCommand('mls.openChartView', () => hub.openChart()),
    vscode.commands.registerCommand('mls.openGridChartView', () => hub.openBoth()),

    // Open the current .mls as a notebook (cells split on `// %%`)
    vscode.commands.registerCommand('mls.openAsNotebook', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) return;
      await vscode.commands.executeCommand('vscode.openWith', target, PERCENT_TYPE);
    }),

    vscode.commands.registerCommand('mls.newNotebook', async () => {
      const data = new vscode.NotebookData(STARTER_CELLS.map(({ id, source }) => {
        const c = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, source, 'mlscript');
        c.metadata = { id, title: id };
        return c;
      }));
      const doc = await vscode.workspace.openNotebookDocument(IMLSNB_TYPE, data);
      await vscode.window.showNotebookDocument(doc);
    }),
  );
}
