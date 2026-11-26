// Extension entry: registers the Document View panel, the open command and the editor listeners.
const vscode = require('vscode')
const { state, paint, refresh } = require('./services/panel.cjs')
const { onMessage } = require('./services/edits.cjs')
const { setting } = require('./services/settings.cjs')
const { isMls, reveal, open } = require('./commands/openDocumentView.cjs')

exports.activate = (context) => {
  let opened = false
  let timer
  const show = (editor) => {
    if (!isMls(editor)) return
    if (!opened && setting('autoOpen', true)) {
      opened = true
      reveal(editor)
    }
    refresh(editor).catch((error) => vscode.window.showErrorMessage(`MLscript Document View: ${error.message}`))
  }
  const follow = (editor) => {
    if (!isMls(editor) || !state.view) return
    clearTimeout(timer)
    timer = setTimeout(() => paint(editor).catch(() => {}), 80)
  }
  const provider = {
    resolveWebviewView(next) {
      state.view = next
      state.shown = undefined
      next.webview.options = { enableScripts: true }
      next.webview.onDidReceiveMessage(onMessage)
      next.onDidDispose(() => { state.view = undefined })
      show(vscode.window.activeTextEditor)
    },
  }
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('mlstudio.documentView', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('mlstudio.openDocumentView', open),
    vscode.window.onDidChangeActiveTextEditor(show),
    vscode.workspace.onDidGrantWorkspaceTrust(() => show(vscode.window.activeTextEditor)),
    vscode.window.onDidChangeTextEditorSelection((event) => follow(event.textEditor)),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const editor = vscode.window.activeTextEditor
      if (state.view && editor && editor.document === document && isMls(editor)) refresh(editor)
    }),
  )
  show(vscode.window.activeTextEditor)
}

exports.deactivate = () => {}
