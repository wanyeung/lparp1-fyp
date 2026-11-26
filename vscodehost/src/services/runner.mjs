// Builds and runs one .mls file in a child process, and returns { ok, tree } or { ok: false, error }.
import { execFile } from 'node:child_process'
import path from 'node:path'

export const run = (file) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(import.meta.dirname, 'worker.mjs'), file], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  }, (error, stdout) => {
    const line = stdout.trim().split('\n').pop()
    try { resolve(JSON.parse(line)) } catch { resolve({ ok: false, error: error ? error.message : 'The build produced no result.' }) }
  })
})
