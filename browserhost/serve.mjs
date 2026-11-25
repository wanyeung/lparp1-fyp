import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const port = Number(process.env.PORT ?? 8080)
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv' }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/browserhost/index.html' : url.pathname))
  if (!file.startsWith(root)) { res.writeHead(403).end(); return }
  try {
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`http://localhost:${port}/`))
