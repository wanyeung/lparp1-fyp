/**
 * Grid -> code patching. The real work is in core/sourceEdit.ts (a small
 * literal scanner, shared with the browser later); this keeps the old
 * one-cell entry point: set `field` of row `rowIndex` in the first `let`.
 */
import { applyGridOp } from '../core/sourceEdit';

export function patchGridSource(source: string, rowIndex: number, field: string, rawValue: unknown, varName?: string): string {
  const name = varName ?? /^\s*let\s+([A-Za-z_][A-Za-z0-9_']*)/m.exec(source)?.[1];
  if (!name) return source;
  const r = applyGridOp(source, name, { op: 'set', row: rowIndex, path: [field], value: String(rawValue) });
  return 'source' in r ? r.source : source;
}
