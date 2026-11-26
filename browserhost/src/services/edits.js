// Handles messages from the page: a reorder is written into the source text and run again; cells and charts are read only here, so edits are ignored.
import { Controller } from './library.js'
import { refresh } from './panel.js'

export const onMessage = async (message, editor, view, status) => {
  if (message.type === 'open') {
    status.textContent = `${message.file} is a separate file; open it with the Open button.`
    return
  }
  if (message.type !== 'move') return
  const result = Controller.move({ ...message, source: editor.value })
  if (!result.ok) {
    status.textContent = result.error
    await refresh(editor, view)
    return
  }
  status.textContent = ''
  editor.value = result.source
  await refresh(editor, view)
}
