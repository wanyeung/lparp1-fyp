// The "Open Document View" command: shows the side panel for the active .mls file.
const vscode = require('vscode')
const { refresh } = require('../services/panel.cjs')

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

exports.isMls = isMls
exports.reveal = reveal
exports.open = open
