import { cpSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const demo = path.join(root, 'build', 'demo')
cpSync(path.join(root, 'test', 'fixtures'), demo, { recursive: true })
const args = ['--new-window', `--extensionDevelopmentPath=${path.join(root, 'vscodehost')}`, demo, path.join(demo, 'demo.mls')]
spawn('code', args.map((a) => `"${a}"`), { shell: true, stdio: 'inherit' })
