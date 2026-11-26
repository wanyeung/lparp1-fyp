// Opens imported files, and turns a cell, header, chart-drag or reorder message from the page into a minimal edit of the .mls file, then saves it.
const vscode = require('vscode')
const path = require('node:path')
const { load } = require('./library.cjs')
const { state, refresh } = require('./panel.cjs')

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

exports.onMessage = async (message) => {
  if (!state.current) return
  if (message.type === 'open') {
    const target = path.resolve(path.dirname(state.current.fileName), message.file)
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target))
    return
  }
  if (message.type !== 'edit' && message.type !== 'move') return
  const Controller = await load('controller/Controller.mjs')
  const result = (message.type === 'move' ? Controller.move : Controller.edit)({ ...message, source: state.current.getText() })
  if (!result.ok) {
    vscode.window.showErrorMessage(result.error)
    const editor = vscode.window.activeTextEditor
    if (editor) await refresh(editor)
    return
  }
  await replaceMinimal(state.current, result.source)
}
