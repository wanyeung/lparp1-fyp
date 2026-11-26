// Owns the Document View panel: runs the source, picks what the cursor is on and paints the page in the iframe.
import { Controller, Html, marks } from './library.js'
import { run } from './runner.js'
import { theme } from './theme.js'

export const state = { name: 'untitled', latest: undefined, shown: undefined }

export const hooks = { after: () => {} }

const nonce = () => Array.from(crypto.getRandomValues(new Uint32Array(4))).join('')

export const html = (result, tree) => {
  const key = nonce()
  const page = result.ok ? Html.generateHtml(tree, key, marks) : Html.failure(result.error, key)
  return page.replaceAll(' contenteditable="true"', '').replace('</head>', theme(key) + '</head>')
}

export const paint = (editor, view) => {
  const result = state.latest
  const scope = result && result.ok ? Controller.scope(result.tree, editor.value, editor.selectionStart) : { names: [], tree: undefined }
  const key = JSON.stringify([state.name, scope.names])
  if (key === state.shown) return
  state.shown = key
  view.srcdoc = html(result ?? { ok: false, error: 'Nothing has run yet.' }, scope.tree)
}

let runs = 0

export const refresh = async (editor, view) => {
  const ticket = ++runs
  const result = await run(state.name, editor.value)
  if (ticket !== runs) return
  state.latest = result
  state.shown = undefined
  paint(editor, view)
  hooks.after(result)
}
