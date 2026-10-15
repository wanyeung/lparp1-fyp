/**
 * Notebook kernel for MLscript.
 *
 * Running a cell == recompile + re-run of cells [0..N] as one file (the PoC's
 * only execution primitive), in a child process (runner/run.mjs):
 *
 *   execute(cells) ─▶ assemblePrefix ─▶ startRunner ─▶ events:
 *        diagnostics → error/warning output on the owning cell
 *        log         → stdout on the cell that was running (via @@mls-cell markers)
 *        log {kind:"grid"|"chart"} → GridView / ChartView tabs (nothing under the cell)
 *        done/error  → end the cell executions
 */
import * as vscode from 'vscode';
import * as path from 'node:path';
import { assemblePrefix, Assembled, CELL_MARK, locate } from './assemble';
import { locateCompiler } from './compilerLocator';
import { ViewModel } from './viewModel';
import { ViewHub } from './views';
import { RunHandle, RunnerEvent, startRunner } from './runnerClient';

interface ActiveRun {
  handle: RunHandle;
  executions: Map<number, vscode.NotebookCellExecution>;
  cancel(): void;
}

export class MlsKernel {
  private readonly controller: vscode.NotebookController;
  private readonly runs = new Map<string, ActiveRun>();
  private order = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    notebookType: string,
    id: string,
    private readonly hub: ViewHub,
    private readonly out: vscode.OutputChannel,
  ) {
    this.controller = vscode.notebooks.createNotebookController(id, notebookType, 'MLscript (hkmc2)');
    this.controller.supportedLanguages = ['mlscript'];
    this.controller.supportsExecutionOrder = true;
    this.controller.description = 'Compiles cells with the hkmc2 compiler bundle and runs them in Node';
    this.controller.executeHandler = (cells, notebook) => this.execute(cells, notebook);
    this.controller.interruptHandler = notebook => { this.runs.get(notebook.uri.toString())?.cancel(); };
    context.subscriptions.push(this.controller);
  }

  private async execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument): Promise<void> {
    await this.runThrough(notebook, Math.max(...cells.map(c => c.index)));
  }

  /** Re-run cells [0..upto]. Public so grid edits can trigger it. */
  async runThrough(notebook: vscode.NotebookDocument, upto: number): Promise<void> {
    const key = notebook.uri.toString();
    this.runs.get(key)?.cancel(); // a newer run supersedes the old one

    const cells = notebook.getCells().filter(c => c.kind === vscode.NotebookCellKind.Code && c.index <= upto);
    if (cells.length === 0) return;

    const executions = new Map<number, vscode.NotebookCellExecution>();
    for (const c of cells) {
      const ex = this.controller.createNotebookCellExecution(c);
      ex.executionOrder = ++this.order;
      ex.start(Date.now());
      void ex.clearOutput();
      executions.set(c.index, ex);
    }

    const compiler = locateCompiler(this.context);
    if (!compiler) {
      const last = executions.get(cells[cells.length - 1].index)!;
      void last.appendOutput(errorOutput('CompilerNotFound',
        'Could not find MLscript.mjs. Set "mls.compilerBundle" to the path of sheetbook-poc/build/MLscript.mjs.'));
      for (const ex of executions.values()) ex.end(ex === last ? false : undefined, Date.now());
      return;
    }

    const snapshot = cells.map(c => ({ index: c.index, source: c.document.getText() }));
    const assembled = assemblePrefix(snapshot);

    const cfg = vscode.workspace.getConfiguration('mls');
    const customNode = cfg.get<string>('nodePath', '').trim();
    const model = new ViewModel();
    const state = new RunState(executions, snapshot, assembled, cells[0].index, model, m => this.hub.commit(notebook, m), this.out);

    const handle = startRunner({
      nodeBinary: customNode || process.execPath,
      electronAsNode: !customNode,
      runnerPath: path.join(this.context.extensionPath, 'runner', 'run.mjs'),
      bundle: compiler.bundle,
      stdDir: compiler.stdDir,
      source: assembled.source,
      timeoutMs: cfg.get<number>('runTimeoutMs', 60000),
    }, ev => state.handle(ev));

    const run: ActiveRun = {
      handle, executions,
      cancel: () => { handle.kill(); state.finish('cancelled'); },
    };
    this.runs.set(key, run);
    for (const ex of executions.values()) ex.token.onCancellationRequested(() => run.cancel());

    await handle.finished;
    state.finish('closed');
    if (this.runs.get(key) === run) this.runs.delete(key);
  }
}

/** Turns runner events into cell outputs; owns "which cell is currently running". */
class RunState {
  private current: number;
  private textOutput = new Map<number, vscode.NotebookCellOutput>();
  private failedCell: number | undefined;
  private blocked = false;
  private ended = false;

  constructor(
    private readonly executions: Map<number, vscode.NotebookCellExecution>,
    private readonly cells: { index: number; source: string }[],
    private readonly assembled: Assembled,
    firstIndex: number,
    private readonly model: ViewModel,
    private readonly commit: (m: ViewModel) => void,
    private readonly out: vscode.OutputChannel,
  ) { this.current = firstIndex; }

  handle(ev: RunnerEvent): void {
    if (this.ended) return;
    switch (ev.t) {
      case 'diagnostics': return this.onDiagnostics(ev.items);
      case 'log': return this.onLog(ev.level, ev.args);
      case 'error': return this.onRuntimeError(ev.name, ev.message, ev.stack);
      case 'done': return this.finish(ev.ok ? 'ok' : 'blocked');
    }
  }

  private onDiagnostics(items: { kind: string; message: string; path?: string; start?: number }[]): void {
    const fallback = this.cells[this.cells.length - 1].index;
    for (const d of items) {
      const where = d.path === '/notebook.mls' ? locate(this.assembled, this.cells, d.start) : undefined;
      const index = where?.index ?? fallback;
      const loc = where ? ` (line ${where.line}, col ${where.column})` : '';
      const blocking = d.kind === 'error' || d.kind === 'internal';
      this.out.appendLine(`[${d.kind}] cell ${index}${loc}: ${d.message}`);
      const ex = this.executions.get(index);
      if (!ex) continue;
      if (blocking) {
        this.blocked = true;
        this.failedCell ??= index;
        void ex.appendOutput(errorOutput('CompileError', d.message + loc));
      } else {
        void ex.appendOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.stderr(`[${d.kind}] ${d.message}${loc}\n`)]));
      }
    }
  }

  private onLog(level: 'log' | 'warn' | 'error', args: unknown[]): void {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith(CELL_MARK)) {
      this.current = Number(first.slice(CELL_MARK.length));
      return;
    }
    const ex = this.executions.get(this.current);
    if (!ex) return;

    // grid / chart records are NOT shown under the cell: they go to GridView / ChartView.
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const rec = first as { kind?: string };
      const source = this.cells.find(c => c.index === this.current)?.source ?? '';
      if (rec.kind === 'grid') { this.model.addGrid(this.current, source, first as never); return; }
      if (rec.kind === 'chart') { this.model.addChart(this.current, source, first as never); return; }
    }

    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
    const item = level === 'log' ? vscode.NotebookCellOutputItem.stdout(line) : vscode.NotebookCellOutputItem.stderr(line);
    const existing = this.textOutput.get(this.current);
    if (existing && level === 'log') void ex.appendOutputItems(item, existing);
    else {
      const out = new vscode.NotebookCellOutput([item]);
      if (level === 'log') this.textOutput.set(this.current, out);
      void ex.appendOutput(out);
    }
  }

  private onRuntimeError(name: string, message: string, stack: string): void {
    const ex = this.executions.get(this.current) ?? [...this.executions.values()].pop();
    this.failedCell = this.current;
    this.out.appendLine(`[runtime] cell ${this.current}: ${name}: ${message}\n${stack}`);
    if (ex) void ex.appendOutput(errorOutput(name, message, stack));
    this.finish('runtime-error');
  }

  /** End every execution exactly once. */
  finish(reason: 'ok' | 'blocked' | 'runtime-error' | 'cancelled' | 'closed'): void {
    if (this.ended) return;
    this.ended = true;
    if ((reason === 'ok' || reason === 'runtime-error') && !this.model.isEmpty) this.commit(this.model);
    const now = Date.now();
    for (const [index, ex] of this.executions) {
      switch (reason) {
        case 'ok': ex.end(true, now); break;
        case 'closed': ex.end(true, now); break;
        case 'cancelled': ex.end(undefined, now); break;
        case 'blocked':
          // nothing ran: only the cell with the error is "failed"
          ex.end(index === this.failedCell ? false : undefined, now); break;
        case 'runtime-error':
          ex.end(index < (this.failedCell ?? Infinity) ? true : index === this.failedCell ? false : undefined, now); break;
      }
    }
  }
}

function errorOutput(name: string, message: string, stack?: string): vscode.NotebookCellOutput {
  const err = new Error(message);
  err.name = name;
  if (stack) err.stack = stack;
  return new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.error(err)]);
}
