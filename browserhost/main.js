import Csv from '../build/library/io/Csv.mjs'
import Export from '../build/library/io/Export.mjs'
import Primitive from '../build/library/model/Primitive.mjs'
import Doc from '../build/library/model/Document.mjs'
import Chart from '../build/library/model/Chart.mjs'
import Html from '../build/library/service/Html.mjs'
import Controller from '../build/library/controller/Controller.mjs'

const charts = await (await fetch('../build/library/service/Charts.js')).text()
const $ = (id) => document.getElementById(id)
const state = { name: 'data', view: 'A' }
const nonce = () => Array.from(crypto.getRandomValues(new Uint32Array(4))).join('')
const primitives = () => [Primitive.make(state.name, JSON.parse($('source').value.slice($('source').value.indexOf('['))))]

const documents = () => {
  const file = `${state.name}.mls`
  const headers = primitives()[0].headers
  return {
    A: Doc.ofFile(file, primitives()),
    B: Doc.custom('DocumentView B', file, [Doc.useAs(state.name, 'Renamed table')]),
    C: Doc.custom('DocumentView C', file, [Doc.text('# Report\nThe table below is imported from the source.'), Doc.use(state.name), Doc.chart(Chart.Bar, 'Chart', state.name, headers[0], headers.slice(1, 2))]),
  }
}

const items = () => Doc.resolve(documents()[state.view], primitives())

const render = () => {
  try {
    $('view').srcdoc = Html.generateHtml(items(), nonce(), charts)
    $('status').textContent = ''
  } catch {
    $('status').textContent = 'The source is not a plain table literal.'
  }
}

const load = (name, text) => {
  state.name = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g, '_')
  $('source').value = Export.mls(state.name, Csv.parse(text))
  render()
}

const save = (name, text, type) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type }))
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

$('file').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  if (file) load(file.name, await file.text())
})
$('docs').addEventListener('change', (event) => {
  state.view = event.target.value
  render()
})
$('source').addEventListener('input', render)
$('saveMls').addEventListener('click', () => save(`${state.name}.mls`, $('source').value, 'text/plain'))
$('saveHtml').addEventListener('click', () => save(`${state.name}.html`, Html.generateHtml(items(), nonce(), charts), 'text/html'))

window.addEventListener('message', (event) => {
  if (event.source !== $('view').contentWindow || event.data?.type !== 'edit') return
  const result = Controller.edit({ ...event.data, source: $('source').value })
  if (result.ok) {
    $('source').value = result.source
    render()
  } else {
    $('status').textContent = result.error
  }
})

load('sales.csv', 'item,units,price\nTea,30,2.5\nCoffee,45,3\n')
