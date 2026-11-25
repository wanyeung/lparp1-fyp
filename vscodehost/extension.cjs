const vscode = require('vscode')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')
const { pathToFileURL } = require('node:url')

const repo = path.resolve(__dirname, '..')
const library = (name) => import(pathToFileURL(path.join(repo, 'build', 'library', name)).href).then((m) => m.default)

let view
let current
let latest
let shown

const setting = (name, fallback) => vscode.workspace.getConfiguration('mlstudio').get(name, fallback)

const run = (file) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(__dirname, 'run.mjs'), file], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  }, (error, stdout) => {
    const line = stdout.trim().split('\n').pop()
    try { resolve(JSON.parse(line)) } catch { resolve({ ok: false, error: error ? error.message : 'The build produced no result.' }) }
  })
})

const names = async (editor) => {
  if (!setting('followCursor', true) || !latest || !latest.ok) return []
  const Controller = await library('controller/Controller.mjs')
  const source = editor.document.getText()
  const offset = editor.document.offsetAt ? editor.document.offsetAt(editor.selection.active) : 0
  return Controller.focus(source, offset, latest.sheet.primitives.map((p) => p.name))
}

const getHtmlForWebview = async (result, focus) => {
  const Html = await library('service/Html.mjs')
  const Document = await library('model/Document.mjs')
  const charts = fs.readFileSync(path.join(repo, 'build', 'library', 'service', 'Charts.js'), 'utf8')
  const nonce = crypto.randomBytes(16).toString('hex')
  if (!result.ok) return Html.failure(result.error, nonce)
  const items = Document.focus(Document.resolve(result.document, result.sheet.primitives), focus)
  return Html.generateHtml(items, nonce, charts)
}

let paints = 0

const paint = async (editor) => {
  if (!view) return
  const ticket = ++paints
  const focus = await names(editor)
  if (ticket !== paints) return
  const key = JSON.stringify([current && current.fileName, focus])
  if (key === shown) return
  const html = await getHtmlForWebview(latest, focus)
  if (ticket !== paints || !view) return
  shown = key
  view.webview.html = html
}

const untrusted = 'This folder is not trusted yet, so the Document View does not build your .mls files. Choose Trust in the prompt, or run Workspaces: Manage Workspace Trust.'

const build = async (editor) => {
  if (!view) return
  current = editor.document
  latest = vscode.workspace.isTrusted === false ? { ok: false, error: untrusted } : await run(editor.document.fileName)
  shown = undefined
  await paint(editor)
}

let running = Promise.resolve()
let wanted

const refresh = (editor) => {
  wanted = editor
  running = running.catch(() => {}).then(() => (wanted === editor ? build(editor) : undefined))
  return running
}

const replaceMinimal = async (document, next) => {
  const before = document.getText()
  let head = 0
  while (head < before.length && head < next.length && before[head] === next[head]) head++
  let tail = 0
  while (tail < before.length - head && tail < next.length - head && before[before.length - 1 - tail] === next[next.length - 1 - tail]) tail++
  const edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, new vscode.Range(document.positionAt(head), document.positionAt(before.length - tail)), next.slice(head, next.length - tail))
  await vscode.workspace.applyEdit(edit)
  await document.save()
}

const onMessage = async (message) => {
  if (message.type !== 'edit' || !current) return
  const Controller = await library('controller/Controller.mjs')
  const result = Controller.edit({ ...message, source: current.getText() })
  if (!result.ok) {
    vscode.window.showErrorMessage(result.error)
    const editor = vscode.window.activeTextEditor
    if (editor) await refresh(editor)
    return
  }
  await replaceMinimal(current, result.source)
}

const isMls = (editor) => Boolean(editor) && editor.document.fileName.endsWith('.mls')

const reveal = async (editor) => {
  await vscode.commands.executeCommand('workbench.view.extension.mlstudio')
  if (editor && vscode.window.showTextDocument) await vscode.window.showTextDocument(editor.document, editor.viewColumn)
}

const open = async () => {
  const editor = vscode.window.activeTextEditor
  if (!isMls(editor)) {
    vscode.window.showInformationMessage('Open an .mls file first.')
    return
  }
  await reveal(editor)
  try {
    await refresh(editor)
  } catch (error) {
    vscode.window.showErrorMessage(`MLscript Document View: ${error.message}`)
  }
}

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
    if (!isMls(editor) || !view) return
    clearTimeout(timer)
    timer = setTimeout(() => paint(editor).catch(() => {}), 80)
  }
  const provider = {
    resolveWebviewView(next) {
      view = next
      shown = undefined
      view.webview.options = { enableScripts: true }
      view.webview.onDidReceiveMessage(onMessage)
      view.onDidDispose(() => { view = undefined })
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
      if (view && editor && editor.document === document && isMls(editor)) refresh(editor)
    }),
  )
  show(vscode.window.activeTextEditor)
}

exports.deactivate = () => {}
