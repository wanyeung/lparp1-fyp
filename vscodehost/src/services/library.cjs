// Loads the built library modules and the Marks.js chart script for the VS Code host.
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const repo = path.resolve(__dirname, '..', '..', '..')

exports.load = (name) => import(pathToFileURL(path.join(repo, 'build', 'library', name)).href).then((m) => m.default)

exports.marks = () => fs.readFileSync(path.join(repo, 'build', 'library', 'controller', 'D3Manipulation', 'Marks.js'), 'utf8')
