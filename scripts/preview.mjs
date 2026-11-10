import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStudio } from '../src/model.mjs';
import { viewHtml } from '../src/webview.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2] || 'student-learning.mls';
const kind = process.argv[3] || 'grid';
const source = await readFile(path.join(root, 'usecases', name), 'utf8');
const model = parseStudio(source, { fallbackTitle: name });
const html = viewHtml({
  kind,
  nonce: 'preview',
  cspSource: 'preview',
  bootstrap: model,
});
const dir = path.join(root, 'preview');
await mkdir(dir, { recursive: true });
const out = path.join(dir, name.replace(/\.mls$/, '.html'));
await writeFile(out, html);
console.log(out);
