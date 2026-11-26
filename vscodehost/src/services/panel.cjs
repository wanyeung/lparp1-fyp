// Owns the Document View panel: builds the open .mls file, picks what the cursor is on and paints the page.
const vscode = require('vscode')
const crypto = require('node:crypto')
const { load, marks } = require('./library.cjs')
const { setting } = require('./settings.cjs')

const state = { view: undefined, current: undefined, latest: undefined, shown: undefined }
const untrusted = 'This folder is not trusted yet, so the Document View does not build your .mls files. Choose Trust in the prompt, or run Workspaces: Manage Workspace Trust.'

const run = (file) => import('./runner.mjs').then((m) => m.run(file))

const scoped = async (editor) => {
  if (!state.latest || !state.latest.ok) return { names: [], tree: undefined }
  if (!setting('followCursor', true)) return { names: [], tree: state.latest.tree }
  const Controller = await load('controller/Controller.mjs')
  const source = editor.document.getText()
  const offset = editor.document.offsetAt ? editor.document.offsetAt(editor.selection.active) : 0
  return Controller.scope(state.latest.tree, source, offset)
}

const getHtmlForWebview = async (result, tree) => {
  const Html = await load('service/Html.mjs')
  const nonce = crypto.randomBytes(16).toString('hex')
  if (!result.ok) return Html.failure(result.error, nonce)
  return Html.generateHtml(tree, nonce, marks())
}

let paints = 0

const paint = async (editor) => {
  if (!state.view) return
  const ticket = ++paints
  const scope = await scoped(editor)
  if (ticket !== paints) return
  const key = JSON.stringify([state.current && state.current.fileName, scope.names])
  if (key === state.shown) return
  const html = await getHtmlForWebview(state.latest, scope.tree)
  if (ticket !== paints || !state.view) return
  state.shown = key
  state.view.webview.html = html
}

const build = async (editor) => {
  if (!state.view) return
  state.current = editor.document
  state.latest = vscode.workspace.isTrusted === false ? { ok: false, error: untrusted } : await run(editor.document.fileName)
  state.shown = undefined
  await paint(editor)
}

let running = Promise.resolve()
let wanted

const refresh = (editor) => {
  wanted = editor
  running = running.catch(() => {}).then(() => (wanted === editor ? build(editor) : undefined))
  return running
}

exports.state = state
exports.paint = paint
exports.refresh = refresh
