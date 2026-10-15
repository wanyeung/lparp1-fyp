/**
 * Read and edit the literal a grid shows, directly in a cell's MLscript source.
 * Pure (no vscode, no DOM) so it can move into mls-core and be shared by the
 * browser app and the extension.
 *
 * The grid is a view of the code: every operation here is a minimal text
 * splice on one literal (`let rowsB = [ mut { ... }, ... ]`), so the rest of
 * the cell keeps its formatting. It understands just enough syntax to find
 * values — arrays, records (`mut { k: v }` / `{ k: v }`), and "atoms" (any
 * other expression, scanned to the next top-level comma or closer). Anything
 * else (spreads, shorthand fields, a computed initializer) makes `parse`
 * return null, and the grid then shows the value read-only.
 */
export type Path = (string | number)[];

export type Node = AtomNode | ArrayNode | RecordNode;
export interface AtomNode { kind: 'atom'; start: number; end: number }
export interface ArrayNode { kind: 'array'; start: number; end: number; open: number; close: number; items: Node[] }
export interface RecordNode { kind: 'record'; start: number; end: number; open: number; close: number; mut: boolean; fields: Field[] }
export interface Field { key: string; keyStart: number; keyEnd: number; value: Node }

export interface Tree { source: string; root: Node }

export type GridOp =
  | { op: 'set'; row: number; path: Path; value: string }
  | { op: 'add'; after?: number }
  | { op: 'delete'; row: number };

export type EditResult = { source: string } | { error: string };

// ───────────────────────────── parsing ─────────────────────────────

class Parser {
  i = 0;
  constructor(readonly s: string, start: number) { this.i = start; }

  fail(msg: string): never { throw new Error(msg + ' at ' + this.i); }

  ws(): void {
    const s = this.s;
    for (;;) {
      const c = s[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.i++;
      else if (c === '/' && s[this.i + 1] === '/') { while (this.i < s.length && s[this.i] !== '\n') this.i++; }
      else if (c === '/' && s[this.i + 1] === '*') { const e = s.indexOf('*/', this.i + 2); this.i = e < 0 ? s.length : e + 2; }
      else return;
    }
  }

  value(top: boolean): Node {
    this.ws();
    const s = this.s, start = this.i;
    let mut = false;
    if (/^mut\s*\{/.test(s.slice(this.i, this.i + 24))) { mut = true; this.i += 3; this.ws(); }
    if (s[this.i] === '[') return this.array(start);
    if (s[this.i] === '{') return this.record(start, mut);
    if (mut) this.fail('mut without record');
    return this.atom(start, top);
  }

  array(start: number): ArrayNode {
    const open = this.i; this.i++;
    const items: Node[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === ']') break;
      items.push(this.value(false));
      this.ws();
      if (this.s[this.i] === ',') this.i++;
      else if (this.s[this.i] !== ']') this.fail('expected , or ]');
    }
    const close = this.i; this.i++;
    return { kind: 'array', start, end: this.i, open, close, items };
  }

  record(start: number, mut: boolean): RecordNode {
    const open = this.i; this.i++;
    const fields: Field[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === '}') break;
      const keyStart = this.i;
      let key: string;
      if (this.s[this.i] === '"') { const e = this.stringEnd(this.i); key = JSON.parse(this.s.slice(this.i, e)); this.i = e; }
      else {
        const m = /^[A-Za-z_'][A-Za-z0-9_']*/.exec(this.s.slice(this.i));
        if (!m) this.fail('expected field name');
        key = m[0]; this.i += key.length;
      }
      const keyEnd = this.i;
      this.ws();
      if (this.s[this.i] !== ':') this.fail('shorthand fields are not supported');
      this.i++;
      const value = this.value(false);
      fields.push({ key, keyStart, keyEnd, value });
      this.ws();
      if (this.s[this.i] === ',') this.i++;
      else if (this.s[this.i] !== '}') this.fail('expected , or }');
    }
    const close = this.i; this.i++;
    return { kind: 'record', start, end: this.i, open, close, mut, fields };
  }

  stringEnd(from: number): number {
    let j = from + 1;
    while (j < this.s.length && this.s[j] !== '"') j += this.s[j] === '\\' ? 2 : 1;
    if (j >= this.s.length) this.fail('unterminated string');
    return j + 1;
  }

  /** Any other expression: up to a top-level `,` or closing bracket (or end of line at the top level). */
  atom(start: number, top: boolean): AtomNode {
    const s = this.s;
    let depth = 0, last = start;
    while (this.i < s.length) {
      const c = s[this.i];
      if (c === '"') { this.i = this.stringEnd(this.i); last = this.i; continue; }
      if (c === '/' && s[this.i + 1] === '/') { while (this.i < s.length && s[this.i] !== '\n') this.i++; continue; }
      if (c === '/' && s[this.i + 1] === '*') { const e = s.indexOf('*/', this.i + 2); this.i = e < 0 ? s.length : e + 2; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
      else if (c === '\n' && depth === 0 && top) break;
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') last = this.i + 1;
      this.i++;
    }
    if (last === start) this.fail('empty expression');
    if (s.startsWith('...', start)) this.fail('spreads are not supported');
    this.i = last;
    return { kind: 'atom', start, end: last };
  }
}

/** Parse the initializer of `let <varName> = ...`; null if absent or not understood. */
export function parse(source: string, varName: string): Tree | null {
  const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp("(?:^|\\n)[ \\t]*let\\s+" + esc + "\\s*=(?!=)").exec(source);
  if (!m) return null;
  try {
    const p = new Parser(source, m.index + m[0].length);
    return { source, root: p.value(true) };
  } catch {
    return null;
  }
}

// ───────────────────────────── reading ─────────────────────────────

export const isLiteralText = (t: string): boolean =>
  /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) || /^"(?:[^"\\]|\\.)*"$/.test(t) || /^(true|false|undefined|null)$/.test(t);

export const textOf = (tree: Tree, n: Node): string => tree.source.slice(n.start, n.end);

interface Resolved { node: Node; parent?: ArrayNode | RecordNode; key?: string | number; rest: Path }

/** Walk `path` from the root (inside row `row` if the root is an array). `rest` is what could not be found. */
export function resolve(tree: Tree, row: number, path: Path): Resolved {
  let node = tree.root;
  let parent: ArrayNode | RecordNode | undefined;
  let key: string | number | undefined;
  if (node.kind === 'array' && row >= 0) {
    const it = node.items[row];
    if (!it) throw new Error('row ' + row + ' is not in the literal');
    parent = node; key = row; node = it;
  }
  let k = 0;
  for (; k < path.length; k++) {
    const step = path[k];
    if (node.kind === 'record' && typeof step === 'string') {
      const f = node.fields.find(f => f.key === step);
      if (!f) break;
      parent = node; key = step; node = f.value;
    } else if (node.kind === 'array' && typeof step === 'number') {
      const it = node.items[step];
      if (!it) break;
      parent = node; key = step; node = it;
    } else break;
  }
  return { node, parent, key, rest: path.slice(k) };
}

/** The source text at a cell, if the literal has one there. */
export function cellSource(tree: Tree, row: number, path: Path): { text: string; literal: boolean } | undefined {
  try {
    const r = resolve(tree, row, path);
    if (r.rest.length > 0 || r.node.kind !== 'atom') return undefined;
    const text = textOf(tree, r.node);
    return { text, literal: isLiteralText(text) };
  } catch { return undefined; }
}

// ───────────────────────────── writing ─────────────────────────────

const splice = (s: string, a: number, b: number, t: string) => s.slice(0, a) + t + s.slice(b);
const keyText = (k: string) => (/^[A-Za-z_'][A-Za-z0-9_']*$/.test(k) ? k : JSON.stringify(k));

/** What the user typed -> MLscript source. `null` means "clear the cell". */
export function valueSource(raw: string): string | null {
  const t = raw.trim();
  if (t === '') return null;
  if (t.startsWith('=')) { const e = t.slice(1).trim(); return e === '' ? null : e; }   // formula: raw expression
  if (isLiteralText(t) && t !== 'null') return t;                                      // 12, 3.5, "x", true, undefined
  return JSON.stringify(raw);                                                          // plain text -> string
}

/** Separator (comma + whitespace) to put between items, copied from how the literal is already laid out. */
function separator(s: string, open: number, spans: { start: number; end: number }[]): string {
  if (spans.length >= 2) return s.slice(spans[0].end, spans[1].start);
  if (spans.length === 1) {
    const gap = s.slice(open + 1, spans[0].start);
    const nl = gap.lastIndexOf('\n');
    return nl >= 0 ? ',\n' + gap.slice(nl + 1) : ', ';
  }
  return '';
}

const spansOf = (n: ArrayNode | RecordNode) =>
  n.kind === 'array' ? n.items.map(i => ({ start: i.start, end: i.end })) : n.fields.map(f => ({ start: f.keyStart, end: f.value.end }));

function insertAfter(s: string, n: ArrayNode | RecordNode, index: number | undefined, text: string): string {
  const spans = spansOf(n);
  if (spans.length === 0) return splice(s, n.open + 1, n.close, n.kind === 'record' ? ' ' + text + ' ' : text);
  const i = index === undefined || index < 0 || index >= spans.length ? spans.length - 1 : index;
  return splice(s, spans[i].end, spans[i].end, separator(s, n.open, spans) + text);
}

function removeAt(s: string, n: ArrayNode | RecordNode, index: number): string {
  const spans = spansOf(n);
  if (spans.length === 1) return splice(s, n.open + 1, n.close, n.kind === 'record' ? ' ' : '');
  if (index === spans.length - 1) return splice(s, spans[index - 1].end, spans[index].end, '');
  return splice(s, spans[index].start, spans[index + 1].start, '');
}

const defaultFor = (text: string): string | undefined =>
  /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text) ? '0' : text.startsWith('"') ? '""' : /^(true|false)$/.test(text) ? 'false' : undefined;

/** Source for a new element shaped like the existing ones. Fields that are computed in the sample are left out. */
function templateFor(tree: Tree, n: Node): string | undefined {
  const s = tree.source;
  if (n.kind === 'atom') return defaultFor(s.slice(n.start, n.end));
  if (n.kind === 'array') {
    const parts = n.items.map(i => templateFor(tree, i) ?? 'undefined');
    return '[' + parts.join(', ') + ']';
  }
  const parts = n.fields.flatMap(f => { const t = templateFor(tree, f.value); return t === undefined ? [] : [`${keyText(f.key)}: ${t}`]; });
  return (n.mut ? 'mut ' : '') + '{ ' + parts.join(', ') + (parts.length ? ' ' : '') + '}';
}

/** A new element for an array: every field any row has, in first-seen order, each taking its latest sample. */
function newElement(tree: Tree, arr: ArrayNode): string {
  if (arr.items.length === 0) return '0';
  const records = arr.items.filter((i): i is RecordNode => i.kind === 'record');
  if (records.length === 0) return templateFor(tree, arr.items[arr.items.length - 1]) ?? 'undefined';
  const keys: string[] = [];
  for (const r of records) for (const f of r.fields) if (!keys.includes(f.key)) keys.push(f.key);
  const merged: RecordNode = {
    kind: 'record', start: 0, end: 0, open: 0, close: 0, mut: records.some(r => r.mut),
    fields: keys.map(k => {
      const last = [...records].reverse().map(r => r.fields.find(f => f.key === k)).find(Boolean)!;
      return last;
    }),
  };
  return templateFor(tree, merged) ?? '{}';
}

/** Apply one grid operation to the cell source. */
export function applyGridOp(source: string, varName: string, op: GridOp): EditResult {
  const tree = parse(source, varName);
  if (!tree) return { error: `\`${varName}\` is not a literal the grid can edit` };

  try {
    if (op.op === 'add') {
      if (tree.root.kind !== 'array') return { error: 'only lists and tables have rows' };
      return { source: insertAfter(source, tree.root, op.after, newElement(tree, tree.root)) };
    }
    if (op.op === 'delete') {
      if (tree.root.kind !== 'array' || !tree.root.items[op.row]) return { error: 'no such row' };
      return { source: removeAt(source, tree.root, op.row) };
    }

    const typed = valueSource(op.value);
    const r = resolve(tree, op.row, op.path);

    if (r.rest.length > 0) {                               // the cell is empty: the record has no such field
      const rec = r.node;
      if (rec.kind !== 'record' || typeof r.rest[0] !== 'string') return { error: 'cannot add a value here' };
      if (typed === null) return { source };
      let text = typed;
      for (let k = r.rest.length - 1; k >= 1; k--) text = `${rec.mut ? 'mut ' : ''}{ ${keyText(String(r.rest[k]))}: ${text} }`;
      return { source: insertAfter(source, rec, undefined, `${keyText(String(r.rest[0]))}: ${text}`) };
    }
    if (r.node.kind !== 'atom') return { error: 'this cell holds a nested value; edit it in the code' };
    if (typed === null) {                                  // cleared
      if (r.parent?.kind === 'record') return { source: removeAt(source, r.parent, r.parent.fields.findIndex(f => f.key === r.key)) };
      return { source: splice(source, r.node.start, r.node.end, 'undefined') };
    }
    return { source: splice(source, r.node.start, r.node.end, typed) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
