// Fills the two screens of the page: the home list of saved documents and the sidebar of the open document.
import { list } from './store.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const kb = (text) => `${Math.max(1, Math.round(new Blob([text]).size / 1024))} KB`

export const show = (screen) => {
  $('home').hidden = screen !== 'home'
  $('doc').hidden = screen !== 'doc'
  window.scrollTo(0, 0)
}

export const home = () => {
  const docs = list()
  $('count').textContent = docs.length
  $('rows').innerHTML = docs.map((d) => `<div class="row"><span class="mark">.mls</span><div><b>${esc(d.name)}</b><small>MLscript source</small></div><span>${new Date(d.viewed).toLocaleString()}</span><span>${kb(d.source)}</span><a href="#" data-open="${esc(d.name)}">View document</a></div>`).join('') || '<p class="empty">No saved documents yet.</p>'
}

export const side = (name, source, result) => {
  const nodes = result && result.ok ? result.tree.children : []
  const table = nodes.find((n) => n.kind === 'table')
  $('title').textContent = name
  $('crumb').textContent = name
  $('toc').innerHTML = nodes.map((n, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(n.name)}</li>`).join('')
  $('srcname').textContent = `${name}.mls`
  $('srcsize').textContent = `MLscript source · ${kb(source)}`
  $('data').innerHTML = table ? `<b>${esc(table.name)}</b><small>${table.rows.length} rows · ${table.headers.length} columns</small>` : '<small>No table in this document.</small>'
}
