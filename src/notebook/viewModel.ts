/**
 * What the GridView / ChartView show, as plain data (vscode-free, unit-tested).
 *
 * A run produces grid and chart records (console.log({kind:"grid"|"chart"}))
 * attributed to notebook cells. Each one is titled after the variable its cell
 * defines: `let chartB = ...` -> "Chart B", `let rowsB = ...` -> "Rows B".
 * `select(cell)` answers "which grid + chart go with the cell the cursor is on?".
 */
import { GridModel, buildGridModel } from '../core/structure';

/** What the extension host gets from the run: any value under `value` (or `rows`), not just a list of records. */
/** (`data` is a keyword in MLscript, so the key is `value`; `rows` is still accepted, as the first notebooks used it.) */
export interface GridLog { kind: 'grid'; cellId: string; value?: unknown; rows?: unknown; data?: unknown; title?: string }
/** What the GridView webview receives: the inferred grid, ready to draw. */
export interface GridPayload { kind: 'grid'; cellId: string; model: GridModel; title?: string; _cell?: number }
export interface ChartPayload { kind: 'chart'; cellId: string; spec: Record<string, unknown>; title?: string; _cell?: number }

export interface GridEntry { cell: number; title: string; varName: string; payload: GridPayload }
export interface ChartEntry { cell: number; title: string; /** variable of the grid this chart reads */ gridVar?: string; payload: ChartPayload }

/** First `let name` in a cell. */
export function firstLetVar(source: string): string | undefined {
  return /^\s*let\s+([A-Za-z_][A-Za-z0-9_']*)/m.exec(source)?.[1];
}

/** chartB -> "Chart B", rows_a -> "Rows A", chartSpec -> "Chart Spec" */
export function prettify(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-']+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The variable a grid log call shows: `console.log(mut { kind: "grid", rows: rowsB })` -> rowsB. */
export function loggedVar(source: string): string | undefined {
  const call = /console\.log\(([^)]*kind\s*:\s*"grid"[^)]*)\)/s.exec(source)?.[1];
  return call ? /(?:rows|value|data)\s*:\s*([A-Za-z_][A-Za-z0-9_']*)\s*(?:,|$|\})/.exec(call)?.[1] : undefined;
}

export function identifiers(source: string): Set<string> {
  return new Set(source.match(/[A-Za-z_][A-Za-z0-9_']*/g) ?? []);
}

export class ViewModel {
  readonly grids: GridEntry[] = [];
  readonly charts: ChartEntry[] = [];

  get isEmpty(): boolean { return this.grids.length === 0 && this.charts.length === 0; }

  addGrid(cell: number, source: string, log: GridLog): GridEntry {
    const varName = loggedVar(source) ?? firstLetVar(source) ?? log.cellId;
    const model = buildGridModel(log.value ?? log.rows ?? log.data, source, varName);
    const payload: GridPayload = { kind: 'grid', cellId: log.cellId, model, title: log.title, _cell: cell };
    const entry: GridEntry = { cell, varName, title: log.title ?? prettify(varName), payload };
    this.grids.push(entry);
    return entry;
  }

  addChart(cell: number, source: string, payload: ChartPayload): ChartEntry {
    const varName = firstLetVar(source) ?? payload.cellId;
    const ids = identifiers(source);
    const gridVar = [...this.grids].reverse().find(g => ids.has(g.varName))?.varName;
    const entry: ChartEntry = { cell, gridVar, title: payload.title ?? prettify(varName), payload: { ...payload, _cell: cell } };
    this.charts.push(entry);
    return entry;
  }

  /** The grid + chart that belong with notebook cell `cell` (the one under the cursor). */
  select(cell: number): { grid?: GridEntry; chart?: ChartEntry } {
    const cellsWithOutput = [...new Set([...this.grids.map(g => g.cell), ...this.charts.map(c => c.cell)])].sort((a, b) => a - b);
    // the cursor's own cell, else the closest one above it, else the first one
    const anchor = [...cellsWithOutput].reverse().find(c => c <= cell) ?? cellsWithOutput[0];
    if (anchor === undefined) return {};

    let grid = this.grids.find(g => g.cell === anchor);
    let chart = this.charts.find(c => c.cell === anchor);
    if (grid && !chart) chart = this.charts.find(c => c.gridVar === grid!.varName);
    if (chart && !grid) {
      grid = chart.gridVar
        ? this.grids.find(g => g.varName === chart!.gridVar)
        : [...this.grids].reverse().find(g => g.cell < chart!.cell);
    }
    return { grid, chart };
  }
}
