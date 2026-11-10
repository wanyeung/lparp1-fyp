const vscode = require('vscode');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');

/** @type {Promise<{ model: any, view: any }> | undefined} */
let corePromise;

function core() {
  if (!corePromise) {
    corePromise = Promise.all([
      import(pathToFileURL(path.join(__dirname, 'model.mjs')).href),
      import(pathToFileURL(path.join(__dirname, 'webview.mjs')).href),
    ]).then(([model, view]) => ({ model, view }));
  }
  return corePromise;
}

function isMls(document) {
  if (!document) return false;
  return document.languageId === 'mlscript' || document.fileName.endsWith('.mls');
}

const VIEWS = {
  info: { title: 'MLscript InfoView', column: vscode.ViewColumn.Beside },
  grid: { title: 'MLscript GridView', column: vscode.ViewColumn.Three },
  chart: { title: 'MLscript ChartView', column: vscode.ViewColumn.Three },
};

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection('mlscript-studio');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'mlscriptStudio.openViews';
  status.text = '$(table) MLscript';
  context.subscriptions.push(diagnostics, status);

  /** @type {Record<string, vscode.WebviewPanel | undefined>} */
  const panels = { info: undefined, grid: undefined, chart: undefined };
  /** @type {string | undefined} */
  let currentUri;
  let timer;

  function documentByUri(uri) {
    if (!uri) return undefined;
    return vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri);
  }

  function mlsDocument() {
    const active = vscode.window.activeTextEditor?.document;
    if (isMls(active)) return active;
    const visible = vscode.window.visibleTextEditors.find((editor) => isMls(editor.document));
    if (visible) return visible.document;
    return documentByUri(currentUri);
  }

  function updateStatus() {
    if (mlsDocument()) status.show();
    else status.hide();
  }

  async function openView(kind, reveal) {
    const existing = panels[kind];
    if (existing) {
      if (reveal) existing.reveal(VIEWS[kind].column, true);
      return existing;
    }
    const { view } = await core();
    const panel = vscode.window.createWebviewPanel(
      `mlscriptStudio.${kind}`,
      VIEWS[kind].title,
      { viewColumn: VIEWS[kind].column, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    const nonce = randomBytes(16).toString('hex');
    panel.webview.html = view.viewHtml({ kind, nonce, cspSource: panel.webview.cspSource });
    panel.onDidDispose(() => { panels[kind] = undefined; });
    panel.webview.onDidReceiveMessage((message) => { handle(message); });
    panels[kind] = panel;
    return panel;
  }

  async function openAll() {
    await openView('info', false);
    await openView('chart', false);
    await openView('grid', true);
    await refresh();
  }

  async function refresh() {
    const open = Object.values(panels).filter(Boolean);
    if (!open.length) return;
    let model;
    try {
      ({ model } = await core());
    } catch (error) {
      vscode.window.showErrorMessage('MLscript views failed to load.');
      console.error(error);
      return;
    }
    const document = mlsDocument();
    if (!document || !isMls(document)) {
      currentUri = undefined;
      diagnostics.clear();
      open.forEach((panel) => panel.webview.postMessage({ type: 'state', model: null, cursor: 0 }));
      return;
    }
    currentUri = document.uri.toString();
    const projected = model.parseStudio(document.getText(), {
      fallbackTitle: path.basename(document.fileName),
    });
    const markers = projected.errors.map((error) => new vscode.Diagnostic(
      new vscode.Range(
        document.positionAt(error.start),
        document.positionAt(Math.min(document.getText().length, Math.max(error.end, error.start + 1))),
      ),
      error.message,
      vscode.DiagnosticSeverity.Error,
    ));
    diagnostics.set(document.uri, markers);
    const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === currentUri);
    const offset = editor ? document.offsetAt(editor.selection.active) : 0;
    open.forEach((panel) => panel.webview.postMessage({ type: 'state', model: projected, cursor: offset }));
  }

  function schedule() {
    clearTimeout(timer);
    const wait = vscode.workspace.getConfiguration('mlscriptStudio').get('debounceMs');
    timer = setTimeout(() => { refresh(); }, typeof wait === 'number' ? wait : 120);
  }

  async function handle(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      await refresh();
      return;
    }
    const document = documentByUri(currentUri);
    if (!document) return;
    if (message.type === 'reveal') {
      const range = new vscode.Range(document.positionAt(message.start), document.positionAt(message.end));
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        selection: range,
        preview: false,
      });
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      return;
    }
    if (message.type === 'patch') {
      const { model } = await core();
      const range = new vscode.Range(document.positionAt(message.start), document.positionAt(message.end));
      if (document.getText(range) !== message.expected) {
        vscode.window.showWarningMessage('MLscript skipped that edit because the source changed.');
        await refresh();
        return;
      }
      const next = model.replacementFor(message.value);
      if (next.error) {
        vscode.window.showWarningMessage(next.error);
        await refresh();
        return;
      }
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, next.text);
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        vscode.window.showWarningMessage('MLscript could not update the source.');
        await refresh();
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('mlscriptStudio.openInfoView', async () => { await openView('info', true); await refresh(); }),
    vscode.commands.registerCommand('mlscriptStudio.openGridView', async () => { await openView('grid', true); await refresh(); }),
    vscode.commands.registerCommand('mlscriptStudio.openChartView', async () => { await openView('chart', true); await refresh(); }),
    vscode.commands.registerCommand('mlscriptStudio.openViews', openAll),
    vscode.commands.registerCommand('mlscriptStudio.openUseCase', async () => {
      const folder = path.join(context.extensionPath, 'usecases');
      let names;
      try {
        names = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folder));
      } catch (error) {
        vscode.window.showErrorMessage('Could not read the use cases folder.');
        return;
      }
      const files = names.filter((entry) => entry[1] === vscode.FileType.File && entry[0].endsWith('.mls'));
      const pick = await vscode.window.showQuickPick(files.map(([name]) => name), {
        title: 'MLscript use cases',
        placeHolder: 'Choose a demonstration',
      });
      if (!pick) return;
      const document = await vscode.workspace.openTextDocument(path.join(folder, pick));
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      await openAll();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatus();
      if (Object.values(panels).some(Boolean)) schedule();
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!Object.values(panels).some(Boolean) || !isMls(event.textEditor.document)) return;
      if (currentUri && event.textEditor.document.uri.toString() !== currentUri) return;
      schedule();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!Object.values(panels).some(Boolean) || !isMls(event.document)) return;
      if (event.document.uri.toString() !== currentUri) return;
      schedule();
    }),
  );

  updateStatus();
}

function deactivate() {}

module.exports = { activate, deactivate };
