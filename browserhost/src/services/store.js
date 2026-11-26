// Saved documents kept in this browser: a name, its .mls source and when it was last viewed.
const key = 'mlstudio.documents'

const read = () => {
  try { return JSON.parse(localStorage.getItem(key)) ?? [] } catch { return [] }
}

const write = (docs) => {
  try { localStorage.setItem(key, JSON.stringify(docs)) } catch { return }
}

export const list = () => read().sort((a, b) => b.viewed - a.viewed)

export const get = (name) => read().find((d) => d.name === name)

export const save = (name, source) => write([...read().filter((d) => d.name !== name), { name, source, viewed: Date.now() }])
