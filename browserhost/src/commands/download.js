// The "Download" commands: saves the source as .mls, or the current Document View as a standalone .html page.
import { state, html } from '../services/panel.js'

export const saveText = (name, text, type) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type }))
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export const saveMls = (editor) => saveText(`${state.name}.mls`, editor.value, 'text/plain')

export const saveHtml = () => {
  if (state.latest) saveText(`${state.name}.html`, html(state.latest, state.latest.tree), 'text/html')
}
