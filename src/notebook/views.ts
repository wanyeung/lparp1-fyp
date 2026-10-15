/**
 * GridView and ChartView: two separate webview tabs, kept in sync with the
 * notebook cell under the cursor.
 *
 *   run finishes ──▶ ViewHub.commit(notebook, model) ──▶ open tabs, show selected cell's grid/chart
 *   cursor moves to another cell ──▶ ViewHub.select(cell) ──▶ both tabs switch to that cell's grid + chart
 *   grid edited ──▶ host patches the cell source and re-runs (index.ts)
 */
import * as vscode from 'vscode';
import { ChartEntry, GridEntry, ViewModel } from './viewModel';

import { GridOp } from '../core/sourceEdit';

/** A grid intent from the webview: edit a value, add a row, or delete one. `varName` says which literal. */
export type GridEditMessage = { type: 'grid'; cellId: string; cell?: number; varName: string } & GridOp;

type Kind = 'grid' | 'chart';

class ViewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private ready = false;
  private last: GridEntry | ChartEntry | null = null;

  constructor(
    private readonly kind: Kind,
    private readonly context: vscode.ExtensionContext,
    private readonly column: vscode.ViewColumn,
    private readonly onEdit: (m: GridEditMessage) => void,
  ) {}

  get isOpen(): boolean { return !!this.panel; }

  open(reveal = false): void {
    if (this.panel) { if (reveal) this.panel.reveal(undefined, true); return; }
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const title = this.kind === 'grid' ? 'MLscript GridView' : 'MLscript ChartView';
    this.panel = vscode.window.createWebviewPanel(
      `mls${this.kind}View`, title,
      { viewColumn: this.column, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] },
    );
    this.ready = false;
    this.panel.webview.html = this.html(this.panel.webview, media);
    this.panel.webview.onDidReceiveMessage((m: { type: string }) => {
      if (m.type === 'ready') { this.ready = true; this.push(); }
      else if (m.type === 'grid') this.onEdit(m as unknown as GridEditMessage);
    }, undefined, this.context.subscriptions);
    this.panel.onDidDispose(() => { this.panel = undefined; this.ready = false; }, undefined, this.context.subscriptions);
  }

  show(entry: GridEntry | ChartEntry | null): void { this.last = entry; this.push(); }

  private push(): void {
    if (!this.panel || !this.ready) return;
    void this.panel.webview.postMessage({
      type: 'state',
      title: this.last?.title ?? null,
      payload: this.last?.payload ?? null,
    });
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(media, 'panel.js'));
    return /* html */ `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MLscript ${this.kind === 'grid' ? 'GridView' : 'ChartView'}</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px 14px 24px; }
  h2 { font-size: 13px; font-weight: 600; margin: 8px 0 10px; }
  h2 small { font-weight: 400; color: var(--vscode-descriptionForeground); margin-left: 8px; }
</style></head>
<body data-kind="${this.kind}">
  <h2 id="title"></h2>
  <div id="view"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body></html>`;
  }
}

/** Owns both tabs plus the per-notebook models; decides what each tab shows. */
export class ViewHub {
  private readonly gridPanel: ViewPanel;
  private readonly chartPanel: ViewPanel;
  private readonly models = new Map<string, ViewModel>();

  constructor(context: vscode.ExtensionContext, onEdit: (m: GridEditMessage) => void) {
    // Column Three keeps the InfoView (beside the notebook) visible next to them.
    this.gridPanel = new ViewPanel('grid', context, vscode.ViewColumn.Three, onEdit);
    this.chartPanel = new ViewPanel('chart', context, vscode.ViewColumn.Three, onEdit);
  }

  openGrid(): void { this.gridPanel.open(true); this.refresh(vscode.window.activeNotebookEditor); }
  openChart(): void { this.chartPanel.open(true); this.refresh(vscode.window.activeNotebookEditor); }
  openBoth(): void { this.chartPanel.open(); this.gridPanel.open(true); this.refresh(vscode.window.activeNotebookEditor); }

  /** A run finished: store its model, open the tabs that have something to show, refresh. */
  commit(notebook: vscode.NotebookDocument, model: ViewModel): void {
    this.models.set(notebook.uri.toString(), model);
    if (model.charts.length > 0) this.chartPanel.open();
    if (model.grids.length > 0) this.gridPanel.open();
    this.refresh(vscode.window.visibleNotebookEditors.find(e => e.notebook === notebook));
  }

  /** The cursor moved (or the active notebook changed): show that cell's grid + chart. */
  refresh(editor: vscode.NotebookEditor | undefined): void {
    if (!editor) return;
    const model = this.models.get(editor.notebook.uri.toString());
    if (!model) return;
    const cell = editor.selection?.start ?? 0;
    const { grid, chart } = model.select(cell);
    this.gridPanel.show(grid ?? null);
    this.chartPanel.show(chart ?? null);
  }
}
