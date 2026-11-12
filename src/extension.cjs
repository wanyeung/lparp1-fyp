const vscode = require('vscode');
const path = require('path');
const { spawn } = require('node:child_process');
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
  let compileTimer;
  let compiling = false;
  let queuedCompile = null;
  /** @type {{ hash: string, values: Record<string, unknown> | null, errors: string[] } | undefined} */
  let compiled;
  const compiler = startCompiler(context.extensionPath);
  context.subscriptions.push({ dispose: () => compiler.stop() });

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
    const text = document.getText();
    const projected = model.parseStudio(text, {
      fallbackTitle: path.basename(document.fileName),
    });
    if (compiled && compiled.hash === text && compiled.values) model.overlayCompiled(projected, compiled.values);
    const markers = projected.errors.map((error) => new vscode.Diagnostic(
      new vscode.Range(
        document.positionAt(error.start),
        document.positionAt(Math.min(document.getText().length, Math.max(error.end, error.start + 1))),
      ),
      error.message,
      vscode.DiagnosticSeverity.Error,
    ));
    if (compiled && compiled.hash === text && compiled.errors.length) {
      markers.push(new vscode.Diagnostic(
        new vscode.Range(document.positionAt(0), document.positionAt(0)),
        `hkmc2: ${compiled.errors[0]}`,
        vscode.DiagnosticSeverity.Warning,
      ));
    }
    diagnostics.set(document.uri, markers);
    if (!compiled || compiled.hash !== text) scheduleCompile(text);
    const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === currentUri);
    const offset = editor ? document.offsetAt(editor.selection.active) : 0;
    open.forEach((panel) => panel.webview.postMessage({ type: 'state', model: projected, cursor: offset }));
  }

  function schedule() {
    clearTimeout(timer);
    const wait = vscode.workspace.getConfiguration('mlscriptStudio').get('debounceMs');
    timer = setTimeout(() => { refresh(); }, typeof wait === 'number' ? wait : 120);
  }

  let compileHash;
  function scheduleCompile(text) {
    if (compileHash === text) return;
    compileHash = text;
    clearTimeout(compileTimer);
    compileTimer = setTimeout(() => { runCompile(text); }, 200);
  }

  function runCompile(text) {
    queuedCompile = text;
    if (compiling) return;
    compiling = true;
    status.text = '$(sync~spin) MLscript';
    const step = () => {
      const source = queuedCompile;
      queuedCompile = null;
      if (source == null) {
        compiling = false;
        status.text = '$(check) MLscript';
        return;
      }
      compiler.request(source).then((result) => {
        compiled = {
          hash: source,
          values: result && result.ok ? result.values : null,
          errors: result && result.ok ? [] : [result && result.errors && result.errors[0] || 'hkmc2 did not return a result'],
        };
        refresh();
        step();
      }).catch((error) => {
        compiled = { hash: source, values: null, errors: [error instanceof Error ? error.message : String(error)] };
        refresh();
        step();
      });
    };
    step();
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

function startCompiler(extensionPath) {
  let child;
  let buffer = '';
  let sequence = 0;
  /** @type {Map<number, (message: any) => void>} */
  const pending = new Map();

  function launch() {
    child = spawn(process.execPath, ['--stack-size=16384', path.join(extensionPath, 'src', 'hkmc2.mjs')], {
      cwd: extensionPath,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          const resolve = pending.get(message.id);
          if (resolve) {
            pending.delete(message.id);
            resolve(message);
          }
        } catch (error) {
          /* compiler chatter is not a result */
        }
      }
    });
    child.on('exit', () => {
      for (const resolve of pending.values()) resolve({ ok: false, errors: ['hkmc2 stopped'] });
      pending.clear();
      child = undefined;
    });
  }

  return {
    request(source) {
      if (!child || child.killed) launch();
      const id = sequence + 1;
      sequence = id;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        child.stdin.write(`${JSON.stringify({ id, root: extensionPath, source })}\n`);
      });
    },
    stop() {
      if (child && !child.killed) child.kill();
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
