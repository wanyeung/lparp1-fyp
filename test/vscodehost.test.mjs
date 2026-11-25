import { test } from 'node:test'
import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import { copyFile, mkdtemp, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'vscodehost', 'package.json'), 'utf8'))
const until = async (ok) => {
  for (let i = 0; i < 1200 && !ok(); i++) await new Promise((r) => setTimeout(r, 50))
  assert.ok(ok())
}

const setup = async (trusted = true) => {
  const dir = await mkdtemp(path.join(root, 'build', 'vsx-'))
  const file = path.join(dir, 'demo.mls')
  await copyFile(path.join(root, 'test', 'fixtures', 'demo.mls'), file)
  const text = () => readFileSync(file, 'utf8')
  const document = { fileName: file, uri: file, getText: text, positionAt: (n) => n, offsetAt: (n) => n, save: async () => {} }
  const editor = { document, selection: { active: 0 } }
  const state = { edits: [], commands: {}, executed: [], handlers: {}, view: undefined, editor, document, file, text }
  const fake = {
    ViewColumn: { Beside: 2 },
    Range: class { constructor(start, end) { this.start = start; this.end = end } },
    WorkspaceEdit: class { replace(uri, range, value) { state.edits.push({ range, text: value }) } },
    commands: {
      registerCommand: (id, fn) => { state.commands[id] = fn; return {} },
      executeCommand: async (id) => { state.executed.push(id); if (id === 'workbench.view.extension.mlstudio') state.provider.resolveWebviewView(state.view = { webview: { html: '', onDidReceiveMessage: (fn) => { state.send = fn } }, onDidDispose: () => {} }) },
    },
    workspace: {
      isTrusted: trusted,
      onDidGrantWorkspaceTrust: (fn) => { state.handlers.trust = fn; return {} },
      getConfiguration: () => ({ get: (_, fallback) => fallback }),
      onDidSaveTextDocument: (fn) => { state.handlers.save = fn; return {} },
      applyEdit: async () => true,
    },
    window: {
      activeTextEditor: editor,
      registerWebviewViewProvider: (id, provider) => { state.id = id; state.provider = provider; return {} },
      onDidChangeActiveTextEditor: (fn) => { state.handlers.active = fn; return {} },
      onDidChangeTextEditorSelection: (fn) => { state.handlers.selection = fn; return {} },
      showTextDocument: async () => {},
      showInformationMessage: () => {},
      showErrorMessage: (m) => assert.fail(m),
    },
  }
  const load = Module._load
  Module._load = (request, ...rest) => request === 'vscode' ? fake : load(request, ...rest)
  const require = createRequire(import.meta.url)
  delete require.cache[require.resolve('../vscodehost/extension.cjs')]
  const extension = require('../vscodehost/extension.cjs')
  Module._load = load
  extension.activate({ subscriptions: [] })
  return state
}

test('the manifest puts a button in the editor title bar and a Document View in a side bar', () => {
  const menu = manifest.contributes.menus['editor/title'][0]
  assert.equal(menu.command, 'mlstudio.openDocumentView')
  assert.equal(menu.group, 'navigation@1')
  assert.ok(menu.when.includes('resourceLangId == mlscript'))
  assert.ok(manifest.activationEvents.includes('onLanguage:mlscript'))
  assert.equal(manifest.contributes.views.mlstudio[0].type, 'webview')
  assert.equal(manifest.contributes.views.mlstudio[0].id, 'mlstudio.documentView')
  assert.equal(manifest.contributes.viewsContainers.secondarySidebar[0].id, 'mlstudio')
  assert.equal(manifest.contributes.viewsContainers.activitybar, undefined)
  assert.equal(manifest.contributes.views.explorer, undefined)
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, 'limited')
})

test('opening an .mls file brings up the side panel by itself, showing the binding the cursor starts in', async () => {
  const s = await setup()
  assert.equal(s.id, 'mlstudio.documentView')
  assert.ok(s.executed.includes('workbench.view.extension.mlstudio'))
  await until(() => s.view.webview.html.includes('Coffee') && !s.view.webview.html.includes('Engineering'))
})

test('the panel follows the cursor: a variable, a function, or the whole file', async () => {
  const s = await setup()
  await until(() => s.view.webview.html.includes('Coffee'))
  const at = async (needle, expectHas, expectLacks) => {
    s.editor.selection = { active: s.text().indexOf(needle) }
    s.handlers.selection({ textEditor: s.editor })
    await until(() => s.view.webview.html.includes(expectHas) && !s.view.webview.html.includes(expectLacks))
  }
  await at('Coffee', 'Coffee', 'Engineering')
  await at('Design', 'Engineering', 'Coffee')
  await at('val total', 'total', 'Engineering')
  s.editor.selection = { active: s.text().indexOf('\n\nval teams') + 1 }
  s.handlers.selection({ textEditor: s.editor })
  await until(() => s.view.webview.html.includes('Coffee') && s.view.webview.html.includes('Engineering'))
})

test('an edit made in the panel is written back to the file', async () => {
  const s = await setup()
  await until(() => s.view.webview.html.includes('Coffee'))
  await s.send({ type: 'edit', name: 'sales', kind: 'table', row: 0, col: 1, text: '99' })
  assert.equal(s.edits.length, 1)
  assert.equal(s.edits[0].text, '99')
  assert.equal((await readFile(s.file, 'utf8')).slice(s.edits[0].range.start, s.edits[0].range.end), '30')
})

test('the title bar button reveals the panel on demand', async () => {
  const s = await setup()
  s.executed.length = 0
  await s.commands['mlstudio.openDocumentView']()
  assert.deepEqual(s.executed, ['workbench.view.extension.mlstudio'])
})

test('in a folder that is not trusted the panel asks for trust and builds nothing', async () => {
  const s = await setup(false)
  await until(() => s.view.webview.html.includes('not trusted'))
  assert.ok(!s.view.webview.html.includes('Coffee'))
})
