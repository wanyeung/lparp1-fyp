/**
 * GridView + ChartView UI, bundled by esbuild into media/panel.js.
 *
 * The grid is drawn from a GridModel (core/structure.ts) built in the extension
 * host: the host knows the cell's source, so it decides the shape (list, table,
 * hierarchical, block ...), which cells are editable, and which are formulas.
 * This file only draws it, and keeps VIEW state (sort, filter) that never
 * touches the code. Anything that changes the code is posted to the host as an
 * intent: set a value, add a row, delete a row.
 */
import vegaEmbed from 'vega-embed';
import { expressionInterpreter } from 'vega-interpreter';
import type { GridOp } from '../src/core/sourceEdit';
import { GridModel, Row, referenceFor } from '../src/core/structure';

export interface GridPayload { kind: 'grid'; cellId: string; model: GridModel; _cell?: number }
export interface ChartPayload { kind: 'chart'; cellId: string; spec: Record<string, unknown>; _cell?: number }
export type GridIntent = { type: 'grid'; cellId: string; cell?: number; varName: string } & GridOp;

const CSS = `
.mls-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 12px; }
.mls-kind { padding: 1px 8px; border-radius: 10px; border: 1px solid var(--vscode-focusBorder, #09f); color: var(--vscode-foreground); }
.mls-bar input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #555);
                 padding: 2px 6px; border-radius: 2px; min-width: 190px; font: inherit; }
.mls-bar button, .mls-act button { background: transparent; color: var(--vscode-textLink-foreground, #3794ff); border: 1px solid var(--vscode-panel-border, #666);
                 border-radius: 2px; cursor: pointer; font: inherit; padding: 1px 8px; }
.mls-bar button:hover, .mls-act button:hover { background: var(--vscode-toolbar-hoverBackground, #333); }
.mls-flash { color: var(--vscode-charts-green, #3fb950); }
.mls-ro { color: var(--vscode-descriptionForeground, #888); }
.mls-grid { border-collapse: collapse; font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px); min-width: 40%; }
.mls-grid th, .mls-grid td { border: 1px solid var(--vscode-panel-border, #666); padding: 3px 10px; text-align: left; white-space: pre-wrap; }
.mls-grid th { background: var(--vscode-editor-inactiveSelectionBackground, #333); font-weight: 600; }
.mls-grid th.sortable { cursor: pointer; user-select: none; }
.mls-grid th.sortable:hover { background: var(--vscode-list-hoverBackground, #444); }
.mls-grid th.rh { font-weight: 400; color: var(--vscode-descriptionForeground, #888); white-space: nowrap; min-width: 34px; }
.mls-grid .mls-act { display: none; margin-left: 6px; }
.mls-grid tr:hover .mls-act { display: inline; }
.mls-grid td[contenteditable]:focus { outline: 1px solid var(--vscode-focusBorder, #09f); background: var(--vscode-editor-background); }
.mls-grid td.dirty { background: color-mix(in srgb, var(--vscode-charts-orange, #d29922) 25%, transparent); }
.mls-grid td.empty { background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--vscode-foreground) 8%, transparent) 5px 10px); min-width: 48px; }
.mls-grid td.empty:focus { background: var(--vscode-editor-background); }
.mls-grid td.ro { color: var(--vscode-descriptionForeground, #888); }
.mls-grid td.fx::before { content: "ƒ"; font-style: italic; color: var(--vscode-charts-blue, #3794ff); margin-right: 6px; }
.mls-grid td.fx:focus::before { content: ""; margin: 0; }
.mls-empty { color: var(--vscode-descriptionForeground, #888); font-style: italic; padding: 4px 0; }
.mls-chart { background: #fff; display: inline-block; padding: 8px; border-radius: 4px; }
.mls-note { font-size: 11px; color: var(--vscode-descriptionForeground, #888); margin-top: 6px; }
`;

function makeStyle(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = CSS;
  return style;
}

const KIND_LABEL: Record<GridModel['kind'], string> = { atom: 'Atom', list: 'List', table: 'Table', hierarchical: 'Hierarchical table', block: 'Block' };

// VIEW state, kept across re-renders (the host re-sends the grid after every run)
interface ViewState { sort?: { col: number; dir: 1 | -1 }; filter: string }
const views = new Map<string, ViewState>();

const num = (t: string) => (t.trim() !== '' && !Number.isNaN(Number(t)) ? Number(t) : undefined);

/** `units>40`, `item=Tea`, `note:best`, or plain text matched against every cell. */
export function makeFilter(query: string, columns: { label: string }[]): (cells: string[], head: string) => boolean {
  const q = query.trim();
  if (!q) return () => true;
  const m = /^([^\s<>=!:]+)\s*(>=|<=|!=|>|<|=|:)\s*(.+)$/.exec(q);
  const col = m ? columns.findIndex(c => c.label.toLowerCase() === m[1].toLowerCase()) : -1;
  if (m && col >= 0) {
    const [, , op, rhs] = m;
    return cells => {
      const a = cells[col] ?? '';
      const an = num(a), bn = num(rhs);
      const cmp = an !== undefined && bn !== undefined ? an - bn : a.toLowerCase().localeCompare(rhs.toLowerCase());
      switch (op) {
        case '>': return cmp > 0; case '<': return cmp < 0; case '>=': return cmp >= 0; case '<=': return cmp <= 0;
        case '=': return cmp === 0 && a !== ''; case '!=': return cmp !== 0;
        default: return a.toLowerCase().includes(rhs.toLowerCase());
      }
    };
  }
  const needle = q.toLowerCase();
  return (cells, head) => head.toLowerCase().includes(needle) || cells.some(c => c.toLowerCase().includes(needle));
}

/** Empty cells sort last in either direction; numbers numerically; everything else as text. */
export function compareCells(a: string, b: string, dir: 1 | -1): number {
  if (a === '' && b === '') return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  const an = num(a), bn = num(b);
  const c = an !== undefined && bn !== undefined ? an - bn : a.localeCompare(b);
  return c * dir;
}

/** Render a grid. Code-changing actions go through `send`; sort and filter stay here. */
export function renderGrid(host: HTMLElement, p: GridPayload | null, send: (i: GridIntent) => void): void {
  host.replaceChildren(makeStyle());
  if (!p || !p.model) {
    const d = document.createElement('div');
    d.className = 'mls-empty';
    d.textContent = 'No grid output yet. Run a cell that logs { kind: "grid", value: ... }.';
    host.append(d);
    return;
  }
  const m = p.model;
  const key = `${p.cellId}:${m.varName}`;
  const state = views.get(key) ?? { filter: '' };
  views.set(key, state);
  const intent = (op: GridOp): GridIntent => ({ type: 'grid', cellId: p.cellId, cell: p._cell, varName: m.varName, ...op });

  // toolbar
  const bar = document.createElement('div');
  bar.className = 'mls-bar';
  const badge = document.createElement('span');
  badge.className = 'mls-kind';
  badge.textContent = `${KIND_LABEL[m.kind]} · ${m.summary}`;
  bar.append(badge);
  let filterInput: HTMLInputElement | undefined;
  if (m.kind !== 'atom') {
    filterInput = document.createElement('input');
    filterInput.placeholder = m.kind === 'block' ? 'filter' : 'filter: text, or units>40, item=Tea';
    filterInput.value = state.filter;
    filterInput.setAttribute('aria-label', 'Filter rows');
    bar.append(filterInput);
  }
  if (m.canAddRows) {
    const add = document.createElement('button');
    add.textContent = m.kind === 'list' ? '+ Item' : '+ Row';
    add.title = 'Append to the literal in the cell source';
    add.addEventListener('click', () => send(intent({ op: 'add' })));
    bar.append(add);
  }
  const flash = document.createElement('span');
  flash.className = 'mls-flash';
  bar.append(flash);
  if (m.reason) { const r = document.createElement('span'); r.className = 'mls-ro'; r.textContent = 'read-only: ' + m.reason; bar.append(r); }
  host.append(bar);

  // table
  const table = document.createElement('table');
  table.className = 'mls-grid';
  const thead = table.createTHead();
  const sortable = m.kind !== 'atom' && m.kind !== 'block';
  m.headers.forEach((level, li) => {
    const tr = thead.insertRow();
    if (li === 0 && m.rowHead !== 'none') {
      const corner = document.createElement('th');
      corner.rowSpan = m.headers.length;
      corner.className = 'rh';
      corner.textContent = m.rowHead === 'key' ? 'field' : '#';
      tr.append(corner);
    }
    for (const h of level) {
      const th = document.createElement('th');
      th.colSpan = h.span; th.rowSpan = h.rowspan;
      const arrow = state.sort && h.col === state.sort.col ? (state.sort.dir === 1 ? ' ▲' : ' ▼') : '';
      th.textContent = h.label + arrow;
      if (sortable && h.col !== undefined) {
        th.className = 'sortable';
        th.title = 'Click to sort ascending, descending, off (view only: the code keeps its order)';
        const col = h.col;
        th.addEventListener('click', () => {
          const s = state.sort;
          state.sort = !s || s.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : undefined;
          paintAll();
        });
      }
      tr.append(th);
    }
  });
  const tbody = table.createTBody();
  host.append(table);

  const note = document.createElement('div');
  note.className = 'mls-note';
  note.textContent = m.editable
    ? 'Edit a cell and press Enter: the cell’s source is patched and re-run. Start with = to write MLscript (=rowsB.1.units * 2). Alt+click copies a cell’s reference.'
    : 'Sort and filter still work; changing values means editing the code.';
  host.append(note);

  const say = (t: string) => { flash.textContent = t; };

  function paintBody(): void {
    const match = makeFilter(state.filter, m.columns);
    let rows: Row[] = m.rows.filter(r => match(r.cells.map(c => c.text), m.rowHead === 'key' ? r.head : ''));
    const s = state.sort;
    if (s && sortable) rows = rows.map((r, i) => ({ r, i })).sort((a, b) => compareCells(a.r.cells[s.col]?.text ?? '', b.r.cells[s.col]?.text ?? '', s.dir) || a.i - b.i).map(x => x.r);
    tbody.replaceChildren();
    if (rows.length === 0) {
      const tr = tbody.insertRow(); const td = tr.insertCell();
      td.colSpan = m.columns.length + 1; td.className = 'mls-empty';
      td.textContent = m.rows.length === 0 ? 'No rows' : 'No rows match the filter';
    }
    for (const row of rows) {
      const tr = tbody.insertRow();
      if (m.rowHead !== 'none') {
        const th = document.createElement('th');
        th.className = 'rh';
        th.append(document.createTextNode(row.head));
        if (m.canAddRows && row.src >= 0) {
          const act = document.createElement('span');
          act.className = 'mls-act';
          const ins = document.createElement('button'); ins.textContent = '+'; ins.title = 'Insert a row below';
          ins.addEventListener('click', () => send(intent({ op: 'add', after: row.src })));
          const del = document.createElement('button'); del.textContent = '×'; del.title = 'Delete this row from the code';
          del.addEventListener('click', () => send(intent({ op: 'delete', row: row.src })));
          act.append(ins, del);
          th.append(act);
        }
        tr.append(th);
      }
      for (const cell of row.cells) {
        const td = tr.insertCell();
        const shown = cell.text;
        const original = cell.formula !== undefined ? '=' + cell.formula : shown;
        td.textContent = shown;
        if (cell.empty) td.classList.add('empty');
        if (cell.formula !== undefined) { td.classList.add('fx'); td.title = '= ' + cell.formula; }
        if (!cell.editable) td.classList.add('ro');
        else {
          td.contentEditable = 'plaintext-only';
          td.spellcheck = false;
          td.addEventListener('focus', () => { if (cell.formula !== undefined) td.textContent = original; });
          td.addEventListener('input', () => td.classList.toggle('dirty', td.textContent !== original));
          td.addEventListener('blur', () => {
            const value = td.textContent ?? '';
            td.classList.remove('dirty');
            if (value === original || (cell.formula === undefined && value === shown)) { td.textContent = shown; return; }
            send(intent({ op: 'set', row: row.src, path: cell.path, value }));
          });
          td.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') { ev.preventDefault(); td.blur(); }
            if (ev.key === 'Escape') { td.textContent = shown; td.classList.remove('dirty'); td.blur(); }
          });
        }
        // Alt+click: copy this cell's reference, to paste into a formula in another table
        td.addEventListener('mousedown', ev => {
          if (!ev.altKey) return;
          ev.preventDefault();
          const ref = referenceFor(m.varName, row.src, cell.path);
          void navigator.clipboard?.writeText(ref).catch(() => undefined);
          say(`Copied ${ref}` + (m.kind === 'atom' ? '' : ' · paste it into a formula in a later table (a table cannot reference itself)'));
        });
      }
    }
  }
  function paintAll(): void { renderGrid(host, p, send); }   // sort/filter state lives in `views`, so a full redraw keeps it
  filterInput?.addEventListener('input', () => { state.filter = filterInput!.value; paintBody(); });
  paintBody();
}

/** Render a Vega-Lite spec. Uses the AST interpreter so no `eval` is needed (webview CSP). */
export async function renderChart(host: HTMLElement, p: ChartPayload | null): Promise<void> {
  host.replaceChildren(makeStyle());
  if (!p) {
    const d = document.createElement('div');
    d.className = 'mls-empty';
    d.textContent = 'No chart output yet. Run a cell that logs { kind: "chart", ... }.';
    host.append(d);
    return;
  }
  const box = document.createElement('div');
  box.className = 'mls-chart';
  host.append(box);
  try {
    await vegaEmbed(box, { width: 360, height: 220, ...p.spec } as never, { mode: 'vega-lite', actions: false, renderer: 'svg', ast: true, expr: expressionInterpreter } as never);
  } catch (e) {
    host.replaceChildren(makeStyle());
    const d = document.createElement('div');
    d.className = 'mls-empty';
    d.textContent = 'Chart render failed: ' + (e instanceof Error ? e.message : String(e));
    host.append(d);
  }
}
