/**
 * Decide what shape a value is, and describe it as a grid.
 *
 * Cellery's taxonomy (Atom, Label, List, Table, Hierarchical, Block, Template)
 * asks the user to declare structure; here the shape is INFERRED from the
 * evaluated value, so an unstructured or half-empty value still lands as a
 * list, table or block. Pure (no vscode, no DOM): destined for mls-core.
 *
 *   scalar                                  -> atom
 *   array of scalars                        -> list
 *   array of arrays                         -> table (columns A, B, C ...)
 *   array of records                        -> table (a missing field = an empty cell)
 *   array of records with nested records    -> hierarchical (nesting = header levels)
 *   one record                              -> block (field / value)
 *   Label = the `let` name (done in viewModel); Template: not inferred yet.
 *
 * Editing needs the literal in the source, so the model also records, per
 * cell, whether it can be edited and whether it is a formula (an expression
 * rather than a literal).
 */
import { Path, Tree, cellSource, parse } from './sourceEdit';

export type Kind = 'atom' | 'list' | 'table' | 'hierarchical' | 'block';
export type ColType = 'number' | 'string' | 'boolean' | 'mixed' | 'empty';

export interface HeaderCell { label: string; span: number; rowspan: number; /** index into `columns` when this header names a single column (sortable) */ col?: number }
export interface Column { path: Path; label: string; type: ColType }
export interface Cell { text: string; path: Path; empty: boolean; editable: boolean; formula?: string }
export interface Row { /** index in the source array; -1 when the value is not an array */ src: number; head: string; cells: Cell[] }

export interface GridModel {
  kind: Kind;
  varName: string;
  /** the literal could be parsed, so cells can be edited and rows added/removed */
  editable: boolean;
  canAddRows: boolean;
  /** why it is read-only, when it is */
  reason?: string;
  headers: HeaderCell[][];
  columns: Column[];
  rows: Row[];
  rowHead: 'index' | 'key' | 'none';
  summary: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isScalar = (v: unknown) => v === null || v === undefined || ['number', 'string', 'boolean'].includes(typeof v);
const isEmpty = (v: unknown) => v === null || v === undefined;

export function cellText(v: unknown): string {
  if (isEmpty(v)) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function inferKind(value: unknown): Kind {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isObj)) {
      return (value as Obj[]).some(r => Object.values(r).some(isObj)) ? 'hierarchical' : 'table';
    }
    if (value.length > 0 && value.every(Array.isArray)) return 'table';
    return 'list';
  }
  return isObj(value) ? 'block' : 'atom';
}

const colLetter = (i: number): string => {
  let s = '', n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

function typeOf(values: unknown[]): ColType {
  const seen = new Set(values.filter(v => !isEmpty(v)).map(v => typeof v));
  if (seen.size === 0) return 'empty';
  if (seen.size > 1) return 'mixed';
  const t = [...seen][0];
  return t === 'number' || t === 'string' || t === 'boolean' ? t : 'mixed';
}

/** Leaf paths of a set of records. A key is a group only if every value present under it is a record. */
function leafPaths(records: Obj[], prefix: Path = []): Path[] {
  const keys: string[] = [];
  for (const r of records) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  const out: Path[] = [];
  for (const k of keys) {
    const present = records.map(r => r[k]).filter(v => v !== undefined);
    if (present.length > 0 && present.every(isObj)) out.push(...leafPaths(present as Obj[], [...prefix, k]));
    else out.push([...prefix, k]);
  }
  return out;
}

const dig = (v: unknown, path: Path): unknown => {
  let cur: unknown = v;
  for (const step of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[step as string];
  }
  return cur;
};

/** Multi-level header rows with spans, from leaf paths. */
function headerRows(paths: Path[]): HeaderCell[][] {
  const depth = Math.max(1, ...paths.map(p => p.length));
  const levels: HeaderCell[][] = Array.from({ length: depth }, () => []);
  for (let l = 0; l < depth; l++) {
    let k = 0;
    while (k < paths.length) {
      const p = paths[k];
      if (l > p.length - 1) { k++; continue; }                    // covered by a rowspan from above
      if (l === p.length - 1) { levels[l].push({ label: String(p[l]), span: 1, rowspan: depth - l, col: k }); k++; continue; }
      let span = 1;                                               // a group: merge neighbours sharing the prefix
      while (k + span < paths.length && paths[k + span].length > l + 1 && paths[k + span].slice(0, l + 1).join('\u0000') === p.slice(0, l + 1).join('\u0000')) span++;
      levels[l].push({ label: String(p[l]), span, rowspan: 1 });
      k += span;
    }
  }
  return levels;
}

/** Build the grid for `value`, using the cell's source to decide what is editable. */
export function buildGridModel(value: unknown, source: string, varName: string): GridModel {
  const tree: Tree | null = parse(source, varName);
  const kind = inferKind(value);
  const base = { kind, varName, editable: !!tree, canAddRows: false } as const;

  const mk = (path: Path, row: number, v: unknown, rowOk: boolean): Cell => {
    const empty = isEmpty(v);
    const src = tree ? cellSource(tree, row, path) : undefined;
    const scalar = isScalar(v);
    // empty: editable if the row exists (a missing field is inserted); non-empty: needs an atom in the source
    const editable = !!tree && rowOk && scalar && (src !== undefined || empty);
    return { text: cellText(v), path, empty, editable, formula: src && !src.literal ? src.text : undefined };
  };

  const arrayRoot = tree?.root.kind === 'array' ? tree.root : undefined;
  const reason = !tree ? `\`${varName}\` is computed, not written as a literal: edit the code to change it` : undefined;

  if (kind === 'atom') {
    const cells = [mk([], -1, value, true)];
    return { ...base, reason, headers: [[{ label: varName, span: 1, rowspan: 1, col: 0 }]], columns: [{ path: [], label: varName, type: typeOf([value]) }],
      rows: [{ src: -1, head: '', cells }], rowHead: 'none', summary: 'single value' };
  }

  if (kind === 'block') {
    const obj = value as Obj;
    const paths = leafPaths([obj]);
    const rows: Row[] = paths.map(p => ({ src: -1, head: p.join('.'), cells: [mk(p, -1, dig(obj, p), true)] }));
    return { ...base, reason, headers: [[{ label: 'value', span: 1, rowspan: 1, col: 0 }]], columns: [{ path: [], label: 'value', type: 'mixed' }],
      rows, rowHead: 'key', summary: `${rows.length} field${rows.length === 1 ? '' : 's'}` };
  }

  const arr = value as unknown[];
  const rowCountOk = !!arrayRoot && arrayRoot.items.length === arr.length;
  const why = reason ?? (rowCountOk ? undefined : `the literal of \`${varName}\` does not match its value (rows are computed): edit the code`);
  const canAdd = rowCountOk;

  if (kind === 'list') {
    const rows: Row[] = arr.map((v, i) => ({ src: i, head: String(i + 1), cells: [mk([], i, v, rowCountOk)] }));
    return { ...base, editable: rowCountOk, canAddRows: canAdd, reason: why, headers: [[{ label: 'value', span: 1, rowspan: 1, col: 0 }]],
      columns: [{ path: [], label: 'value', type: typeOf(arr) }], rows, rowHead: 'index', summary: `${arr.length} item${arr.length === 1 ? '' : 's'}` };
  }

  if (arr.every(Array.isArray)) {                                  // table of arrays
    const width = Math.max(0, ...arr.map(r => (r as unknown[]).length));
    const paths: Path[] = Array.from({ length: width }, (_, j) => [j]);
    const rows: Row[] = arr.map((r, i) => ({ src: i, head: String(i + 1), cells: paths.map(p => mk(p, i, (r as unknown[])[p[0] as number], rowCountOk)) }));
    const columns: Column[] = paths.map(p => ({ path: p, label: colLetter(p[0] as number), type: typeOf(arr.map(r => (r as unknown[])[p[0] as number])) }));
    return { ...base, editable: rowCountOk, canAddRows: canAdd, reason: why, headers: [columns.map((c, j) => ({ label: c.label, span: 1, rowspan: 1, col: j }))],
      columns, rows, rowHead: 'index', summary: `${arr.length} rows × ${width} columns` };
  }

  const records = arr as Obj[];                                     // table / hierarchical
  const paths = leafPaths(records);
  const rows: Row[] = records.map((r, i) => ({ src: i, head: String(i + 1), cells: paths.map(p => mk(p, i, dig(r, p), rowCountOk)) }));
  const columns: Column[] = paths.map(p => ({ path: p, label: p.join('.'), type: typeOf(records.map(r => dig(r, p))) }));
  return { ...base, kind, editable: rowCountOk, canAddRows: canAdd, reason: why, headers: headerRows(paths), columns, rows, rowHead: 'index',
    summary: `${arr.length} rows × ${paths.length} columns` };
}

/** The MLscript text that refers to a cell, for Alt+click. Positional: `rowsB.2.units`. */
export function referenceFor(varName: string, row: number, path: Path): string {
  return [varName, ...(row >= 0 ? [row] : []), ...path].join('.');
}
