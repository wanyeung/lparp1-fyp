/**
 * MLscript InfoView — Extension Host side.
 *
 * Data pipeline (follow the numbered comments):
 *
 *   [1] onDidChangeTextEditorSelection        (VS Code event)
 *   [2] buildCursorContext()                  (offset + active expression range)
 *   [3] requestTypeInfo()                     (mock server, async "RPC")
 *   [4] panel.webview.postMessage(...)        (host -> webview)
 *   [5] webview render()                      (see infoViewHtml.ts)
 */
import * as vscode from 'vscode';
import { getInfoViewHtml } from './infoViewHtml';
import { requestTypeInfo } from './mockServer';
import { activateNotebooks, NOTEBOOK_TYPES } from './notebook';
import { CursorContext, HostToWebview, WebviewToHost } from './types';

const LANGUAGE_ID = 'mlscript';

/** Everything that lives for the lifetime of the extension. */
let panel: vscode.WebviewPanel | undefined;   // the single InfoView (reused if already open)
let webviewReady = false;                      // true once the webview sent {type:'ready'}
let queued: HostToWebview | undefined;         // newest message waiting for the webview to load
let requestSeq = 0;                            // monotonically increasing request id
let debounce: NodeJS.Timeout | undefined;
let lastEditor: vscode.TextEditor | undefined; // editor the InfoView currently describes
let log: vscode.OutputChannel;
let exprDecoration: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext): void {
  activateNotebooks(context);
  log = vscode.window.createOutputChannel('MLscript InfoView');
  exprDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
    borderRadius: '2px',
  });

  context.subscriptions.push(
    log,
    exprDecoration,

    vscode.commands.registerCommand('mls.openInfoView', () => {
      openInfoView(context);
      refreshNow(vscode.window.activeTextEditor);
    }),
    vscode.commands.registerCommand('mls.refreshInfoView', () => refreshNow(vscode.window.activeTextEditor)),

    // [1] The entry point of the whole pipeline.
    vscode.window.onDidChangeTextEditorSelection(e => scheduleRefresh(e.textEditor)),
    vscode.window.onDidChangeActiveTextEditor(ed => scheduleRefresh(ed)),
    // Opening a .mls text file or a notebook brings the InfoView up with it.
    vscode.window.onDidChangeActiveTextEditor(ed => {
      if (ed && ed.document.languageId === LANGUAGE_ID && ed.document.uri.scheme !== 'vscode-notebook-cell') autoOpen(context, ed.document.uri);
    }),
    vscode.window.onDidChangeActiveNotebookEditor(ed => {
      if (ed && NOTEBOOK_TYPES.includes(ed.notebook.notebookType)) autoOpen(context, ed.notebook.uri);
    }),
    // Typing changes the expression without always moving the "selection" in a way we'd notice.
    vscode.workspace.onDidChangeTextDocument(e => {
      const ed = vscode.window.activeTextEditor;
      if (ed && ed.document === e.document) scheduleRefresh(ed);
    }),
  );

  // The file that triggered activation is already open: handle it too.
  const t = vscode.window.activeTextEditor;
  const n = vscode.window.activeNotebookEditor;
  if (t && t.document.languageId === LANGUAGE_ID && t.document.uri.scheme !== 'vscode-notebook-cell') autoOpen(context, t.document.uri);
  if (n && NOTEBOOK_TYPES.includes(n.notebook.notebookType)) autoOpen(context, n.notebook.uri);
}

export function deactivate(): void {
  if (debounce) clearTimeout(debounce);
}

const autoOpened = new Set<string>();

/** Open the InfoView the first time a given file/notebook is opened (setting: mls.infoView.autoOpen). */
function autoOpen(context: vscode.ExtensionContext, uri: vscode.Uri): void {
  if (!vscode.workspace.getConfiguration('mls').get<boolean>('infoView.autoOpen', true)) return;
  const key = uri.toString();
  if (autoOpened.has(key)) return;
  autoOpened.add(key);
  openInfoView(context);
  refreshNow(vscode.window.activeTextEditor);
}

// ---------------------------------------------------------------------------
// Webview panel lifecycle
// ---------------------------------------------------------------------------

/** Create the InfoView beside the editor, or just reveal it if it already exists. */
function openInfoView(context: vscode.ExtensionContext): void {
  if (panel) {
    // Reuse: no second panel, no reload, keep focus in the editor.
    panel.reveal(vscode.ViewColumn.Beside, /* preserveFocus */ true);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'mlsInfoView',
    'MLscript InfoView',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      // Keep DOM + JS state when the tab is hidden, so switching tabs doesn't blank the view.
      retainContextWhenHidden: true,
      localResourceRoots: [],
    },
  );

  webviewReady = false;
  panel.webview.html = getInfoViewHtml(makeNonce(), panel.webview.cspSource);

  // webview -> host messages
  panel.webview.onDidReceiveMessage((msg: WebviewToHost) => {
    switch (msg.type) {
      case 'ready':
        webviewReady = true;
        if (queued) { void panel?.webview.postMessage(queued); queued = undefined; }
        break;
      case 'reveal':
        if (lastEditor) void vscode.window.showTextDocument(lastEditor.document, lastEditor.viewColumn);
        break;
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(() => {
    panel = undefined;
    webviewReady = false;
    queued = undefined;
    for (const ed of vscode.window.visibleTextEditors) ed.setDecorations(exprDecoration, []);
  }, undefined, context.subscriptions);
}

/** Send to the webview now, or park the newest message until it signals ready. */
function post(msg: HostToWebview): void {
  if (!panel) return;
  if (!webviewReady) { queued = msg; return; }
  void panel.webview.postMessage(msg);
}

// ---------------------------------------------------------------------------
// Selection -> context -> mock server -> webview
// ---------------------------------------------------------------------------

function scheduleRefresh(editor: vscode.TextEditor | undefined): void {
  if (!panel) return; // nothing to update: don't do work when the InfoView is closed
  if (debounce) clearTimeout(debounce);
  const delay = vscode.workspace.getConfiguration('mls').get<number>('infoView.debounceMs', 60);
  debounce = setTimeout(() => refreshNow(editor), delay);
}

function refreshNow(editor: vscode.TextEditor | undefined): void {
  if (!panel) return;
  if (!editor || editor.document.languageId !== LANGUAGE_ID) {
    return; // ignore non-MLscript editors; keep showing the last answer
  }
  lastEditor = editor;

  // [2] cursor offset + active expression range
  const cursor = buildCursorContext(editor);
  if (!cursor) {
    editor.setDecorations(exprDecoration, []);
    post({ type: 'empty', reason: 'Cursor is on an empty line.' });
    return;
  }

  const range = new vscode.Range(
    editor.document.positionAt(cursor.expr.startOffset),
    editor.document.positionAt(cursor.expr.endOffset),
  );
  editor.setDecorations(exprDecoration, [range]);

  const requestId = ++requestSeq;
  log.appendLine(`[#${requestId}] 1-2 selection  Ln ${cursor.line + 1}:${cursor.character + 1} offset=${cursor.offset} expr=${JSON.stringify(cursor.expr.text)}`);
  post({ type: 'pending', requestId, cursor });

  // [3] ask the (mock) type server. Spec numbers lines from 1, VS Code from 0.
  const started = Date.now();
  requestTypeInfo({ line: cursor.line + 1, code: cursor.expr.text }).then(result => {
    if (requestId !== requestSeq) {
      log.appendLine(`[#${requestId}] 3   dropped stale response`);
      return; // cursor moved on while we were waiting
    }
    const latencyMs = Date.now() - started;
    log.appendLine(`[#${requestId}] 3   server -> "${result.label}" in ${latencyMs} ms`);
    // [4] host -> webview. [5] happens in the webview's 'message' handler.
    post({ type: 'update', requestId, cursor, result, latencyMs });
    log.appendLine(`[#${requestId}] 4   postMessage(update)`);
  }, err => {
    log.appendLine(`[#${requestId}] 3   server error: ${err}`);
    post({ type: 'empty', reason: `Type server error: ${err}` });
  });
}

/**
 * The "active expression" for the MVP: the selection if there is one,
 * otherwise the trimmed current line. A real implementation would ask the
 * parser for the innermost expression node containing the offset.
 */
function buildCursorContext(editor: vscode.TextEditor): CursorContext | undefined {
  const doc = editor.document;
  const sel = editor.selection;
  const offset = doc.offsetAt(sel.active);

  let startOffset: number;
  let endOffset: number;
  if (!sel.isEmpty) {
    startOffset = doc.offsetAt(sel.start);
    endOffset = doc.offsetAt(sel.end);
  } else {
    const line = doc.lineAt(sel.active.line);
    if (line.isEmptyOrWhitespace) return undefined;
    startOffset = doc.offsetAt(new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex));
    endOffset = doc.offsetAt(line.range.end);
    // drop trailing whitespace
    const trimmed = doc.getText().slice(startOffset, endOffset).trimEnd();
    endOffset = startOffset + trimmed.length;
  }

  return {
    line: sel.active.line,
    character: sel.active.character,
    offset,
    expr: { text: doc.getText().slice(startOffset, endOffset), startOffset, endOffset },
    fileName: doc.fileName,
  };
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
