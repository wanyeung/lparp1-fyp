// A tiny in-memory stand-in for node's fs, so the MLscript compiler bundle can run inside the page.
export const files = new Map()

const missing = (path) => Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })

export const readFileSync = (path) => {
  if (!files.has(String(path))) throw missing(path)
  return files.get(String(path))
}

export const writeFileSync = (path, content) => { files.set(String(path), String(content)) }

export const lstatSync = (path) => {
  if (!files.has(String(path))) throw missing(path)
  return { mtime: { getTime: () => 0 } }
}

export default { readFileSync, writeFileSync, lstatSync }
