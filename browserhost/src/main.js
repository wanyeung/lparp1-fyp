// Browser entry: a home screen of saved documents and a document screen, wired to the same commands and services as the VS Code extension.
import { state, paint, refresh, hooks } from './services/panel.js'
import { onMessage } from './services/edits.js'
import { get, list, save } from './services/store.js'
import { home, show, side } from './services/screens.js'
import { chooseMls, importCsv } from './commands/openFile.js'
import { saveMls, saveHtml } from './commands/download.js'

const $ = (id) => document.getElementById(id)
const editor = $('source')
const view = $('view')
const status = $('status')

const starter = `val notes = "# Sales\\nMonthly sales of tea and coffee. Edit a cell and the chart follows."

val sales = [
  ["month", "tea", "coffee"],
  ["Jan", 30, 20],
  ["Feb", 45, 25],
  ["Mar", 38, 31]
]

val trend = { chart: "Line", source: "sales", x: "month", ys: ["tea", "coffee"] }
`

const openDocument = (name) => {
  const doc = get(name)
  if (!doc) return
  state.name = name
  editor.value = doc.source
  status.textContent = ''
  $('doc').classList.remove('src')
  side(name, doc.source, undefined)
  show('doc')
  refresh(editor, view)
}

const goHome = () => {
  home()
  show('home')
}

hooks.after = (result) => {
  save(state.name, editor.value)
  side(state.name, editor.value, result)
}

let typing
let following
editor.addEventListener('input', () => {
  clearTimeout(typing)
  typing = setTimeout(() => refresh(editor, view), 400)
})
document.addEventListener('selectionchange', () => {
  if (document.activeElement !== editor) return
  clearTimeout(following)
  following = setTimeout(() => paint(editor, view), 80)
})
window.addEventListener('message', (event) => {
  if (event.source === view.contentWindow) onMessage(event.data, editor, view, status)
})
document.addEventListener('click', (event) => {
  const open = event.target.closest('[data-open]')
  const go = event.target.closest('[data-go]')
  if (open) { event.preventDefault(); openDocument(open.dataset.open) }
  else if (go) { event.preventDefault(); goHome() }
})
$('importCsv').addEventListener('click', () => $('csvFile').click())
$('chooseMls').addEventListener('click', () => $('mlsFile').click())
$('csvFile').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  event.target.value = ''
  if (file) { await importCsv(file); home() }
})
$('mlsFile').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  event.target.value = ''
  if (file) openDocument(await chooseMls(file))
})
$('viewSource').addEventListener('click', () => $('doc').classList.toggle('src'))
$('saveMls').addEventListener('click', () => saveMls(editor))
$('saveHtml').addEventListener('click', saveHtml)

const preload = async () => {
  try {
    const files = await (await fetch('/usecases.json')).json()
    for (const file of files) {
      const name = file.replace(/\.mls$/, '').replace(/[^A-Za-z0-9_]/g, '_')
      if (!get(name)) save(name, await (await fetch(`/test/fixtures/usecases/${file}`)).text())
    }
  } catch { return }
}

await preload()
if (!list().length) save('sample', starter)
goHome()
