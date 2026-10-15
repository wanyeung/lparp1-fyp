/**
 * Pure (vscode-free) notebook file formats, so they can be unit-tested in plain Node.
 *
 *  - `.imlsnb`  : the Sheetbook PoC format  { version:1, cells:[{id,title,source}] }
 *  - `.mls`     : "percent" format, like Jupytext:   `// %% title` starts a cell
 */

export interface CellModel {
  id: string;
  title: string;
  source: string;
}

// ---- .imlsnb ----------------------------------------------------------------

export function parseImlsnb(text: string): CellModel[] {
  if (text.trim() === '') return [];
  const doc = JSON.parse(text);
  if (!doc || !Array.isArray(doc.cells)) throw new Error('Not a valid .imlsnb document');
  return doc.cells.map((c: Partial<CellModel>, i: number) => ({
    id: c.id ?? `cell-${i}`,
    title: c.title ?? c.id ?? 'untitled',
    source: c.source ?? '',
  }));
}

export function serializeImlsnb(cells: CellModel[]): string {
  return JSON.stringify({ version: 1, cells }, null, 2) + '\n';
}

// ---- percent format ---------------------------------------------------------

const MARKER = /^\s*\/\/\s*%%\s*(.*?)\s*$/;

export function parsePercent(text: string): CellModel[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cells: CellModel[] = [];
  let title: string | undefined;
  let buf: string[] = [];
  let started = false;

  const flush = () => {
    const source = buf.join('\n').replace(/^\n+|\n+$/g, '');
    // skip an empty "preamble" before the first marker
    if (started || source !== '') {
      const index = cells.length;
      const t = title && title !== '' ? title : undefined;
      cells.push({ id: t ?? `cell-${index}`, title: t ?? 'untitled', source });
    }
  };

  for (const line of lines) {
    const m = MARKER.exec(line);
    if (m) {
      if (started || buf.some(l => l.trim() !== '')) flush();
      title = m[1];
      buf = [];
      started = true;
    } else {
      buf.push(line);
    }
  }
  flush();
  return cells.length > 0 ? cells : [{ id: 'cell-0', title: 'untitled', source: '' }];
}

export function serializePercent(cells: CellModel[]): string {
  // one untitled cell == a plain .mls file, keep it free of markers
  if (cells.length === 1 && (cells[0].title === 'untitled' || cells[0].title === '')) {
    return cells[0].source.replace(/\n*$/, '\n');
  }
  return cells
    .map(c => `// %% ${c.title === 'untitled' ? '' : c.title}`.trimEnd() + '\n' + c.source.replace(/\n*$/, '\n'))
    .join('\n');
}
