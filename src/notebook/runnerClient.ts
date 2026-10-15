/**
 * Spawns runner/run.mjs and turns its NDJSON stdout into typed events.
 * (vscode-free so it can be tested from plain Node.)
 */
import { spawn, ChildProcess } from 'node:child_process';

const MARK = '\u0001MLS ';

export interface RunnerDiagnostic {
  kind: string;
  message: string;
  path?: string;
  start?: number;
  end?: number;
}

export type RunnerEvent =
  | { t: 'diagnostics'; items: RunnerDiagnostic[] }
  | { t: 'log'; level: 'log' | 'warn' | 'error'; args: unknown[] }
  | { t: 'done'; ok: boolean }
  | { t: 'error'; name: string; message: string; stack: string };

export interface RunOptions {
  /** `node`, or the editor binary when `electronAsNode` is true */
  nodeBinary: string;
  electronAsNode: boolean;
  runnerPath: string;
  bundle: string;
  stdDir?: string;
  source: string;
  timeoutMs: number;
}

export interface RunHandle {
  finished: Promise<void>;
  kill(): void;
}

export function startRunner(opts: RunOptions, onEvent: (e: RunnerEvent) => void): RunHandle {
  const env = { ...process.env };
  if (opts.electronAsNode) env.ELECTRON_RUN_AS_NODE = '1';
  const child: ChildProcess = spawn(opts.nodeBinary, [opts.runnerPath], { env, stdio: ['pipe', 'pipe', 'pipe'] });

  let sawEnd = false;
  let killed = false;
  let stderr = '';
  let buffer = '';

  const handleLine = (line: string) => {
    if (line === '') return;
    if (line.startsWith(MARK)) {
      try {
        const ev = JSON.parse(line.slice(MARK.length)) as RunnerEvent;
        if (ev.t === 'done' || ev.t === 'error') sawEnd = true;
        onEvent(ev);
      } catch { /* ignore malformed line */ }
    } else {
      onEvent({ t: 'log', level: 'log', args: [line] }); // stray stdout
    }
  };

  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      handleLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  });
  child.stderr!.setEncoding('utf8');
  child.stderr!.on('data', (c: string) => { stderr += c; });

  const timer = setTimeout(() => { killed = true; child.kill(); onEvent({ t: 'error', name: 'Timeout', message: `Run exceeded ${opts.timeoutMs} ms and was stopped.`, stack: '' }); sawEnd = true; }, opts.timeoutMs);

  const finished = new Promise<void>(resolve => {
    child.on('error', err => {
      if (!sawEnd) { sawEnd = true; onEvent({ t: 'error', name: 'SpawnError', message: String(err), stack: '' }); }
      clearTimeout(timer); resolve();
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (buffer) handleLine(buffer);
      if (!sawEnd && !killed) {
        onEvent({ t: 'error', name: 'RunnerExit', message: `Runner exited with code ${code}.\n${stderr}`.trim(), stack: '' });
      }
      resolve();
    });
  });

  child.stdin!.end(JSON.stringify({ bundle: opts.bundle, stdDir: opts.stdDir, source: opts.source }));

  return { finished, kill: () => { killed = true; clearTimeout(timer); child.kill(); } };
}
