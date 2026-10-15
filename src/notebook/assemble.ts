/**
 * "Prefix" assembly, same idea as sheetbook-poc/kernel.js: running cell N
 * recompiles + re-runs the concatenation of cells 0..N as ONE MLscript file.
 *
 * Differences from the PoC:
 *  - a marker statement is emitted before each cell, so console output can be
 *    attributed to the cell that produced it;
 *  - the character span of each cell is recorded, so compiler diagnostics
 *    (which are offsets into the whole file) can be mapped back to
 *    cell + line.
 */
export const PREAMBLE = 'import "./std/Predef.mls"\n\nopen Predef\n\n';
export const CELL_MARK = '@@mls-cell:';

export interface CellSpan {
  /** notebook cell index */
  index: number;
  start: number;
  end: number;
}

export interface Assembled {
  source: string;
  spans: CellSpan[];
}

export function assemblePrefix(cells: { index: number; source: string }[]): Assembled {
  let source = PREAMBLE;
  const spans: CellSpan[] = [];
  for (const c of cells) {
    source += `console.log("${CELL_MARK}${c.index}")\n`;
    const start = source.length;
    source += c.source;
    spans.push({ index: c.index, start, end: source.length });
    source += '\n\n';
  }
  return { source, spans };
}

/** Map a whole-file offset to the cell + 1-based line/column inside that cell. */
export function locate(
  assembled: Assembled,
  cells: { index: number; source: string }[],
  offset: number | undefined,
): { index: number; line: number; column: number } | undefined {
  if (offset === undefined) return undefined;
  const span = assembled.spans.find(s => offset >= s.start && offset <= s.end);
  if (!span) return undefined;
  const text = assembled.source.slice(span.start, offset);
  const lines = text.split('\n');
  return { index: span.index, line: lines.length, column: lines[lines.length - 1].length + 1 };
}
