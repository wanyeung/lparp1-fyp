// Browser host server: serves the repo as static files so the page can load the library and the compiler.
import http from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv' }

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/usecases.json') {
    const names = (await readdir(path.join(root, 'test', 'fixtures', 'usecases')).catch(() => [])).filter((n) => n.endsWith('.mls'))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(names))
    return
  }
  const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/browserhost/index.html' : url.pathname))
  if (!file.startsWith(root)) { res.writeHead(403).end(); return }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}

const listen = (port) => {
  const server = http.createServer(handler)
  server.once('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error
    listen(port + 1)
  })
  server.listen(port, () => console.log(`http://localhost:${port}/`))
}

listen(Number(process.env.PORT ?? 8080))
