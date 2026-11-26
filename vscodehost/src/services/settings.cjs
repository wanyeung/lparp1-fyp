// Reads the mlstudio.* settings from VS Code.
const vscode = require('vscode')

exports.setting = (name, fallback) => vscode.workspace.getConfiguration('mlstudio').get(name, fallback)
