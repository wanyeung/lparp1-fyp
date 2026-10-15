/** vscode glue around format.ts: turns files into NotebookData and back. */
import * as vscode from 'vscode';
import { CellModel, parseImlsnb, parsePercent, serializeImlsnb, serializePercent } from './format';

export const IMLSNB_TYPE = 'mls-notebook';
export const PERCENT_TYPE = 'mls-percent-notebook';

function toData(cells: CellModel[]): vscode.NotebookData {
  return new vscode.NotebookData(cells.map(c => {
    const cell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, c.source, 'mlscript');
    cell.metadata = { id: c.id, title: c.title };
    return cell;
  }));
}

function fromData(data: vscode.NotebookData): CellModel[] {
  return data.cells
    .filter(c => c.kind === vscode.NotebookCellKind.Code)
    .map((c, i) => {
      const md = (c.metadata ?? {}) as { id?: string; title?: string };
      return { id: md.id ?? `cell-${i}`, title: md.title ?? 'untitled', source: c.value };
    });
}

const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const encode = (s: string) => new TextEncoder().encode(s);

/** `.imlsnb` — the Sheetbook PoC document format. */
export class ImlsnbSerializer implements vscode.NotebookSerializer {
  deserializeNotebook(content: Uint8Array): vscode.NotebookData { return toData(parseImlsnb(decode(content))); }
  serializeNotebook(data: vscode.NotebookData): Uint8Array { return encode(serializeImlsnb(fromData(data))); }
}

/** `.mls` / `.mlscript` opened "with" the notebook editor; cells split on `// %% title`. */
export class PercentSerializer implements vscode.NotebookSerializer {
  deserializeNotebook(content: Uint8Array): vscode.NotebookData { return toData(parsePercent(decode(content))); }
  serializeNotebook(data: vscode.NotebookData): Uint8Array { return encode(serializePercent(fromData(data))); }
}
