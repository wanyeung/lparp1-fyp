/** GridView / ChartView webview script (one bundle; <body data-kind="grid|chart"> picks the view). */
import { ChartPayload, GridPayload, renderChart, renderGrid } from './gridchart';

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const kind = document.body.dataset.kind;

window.addEventListener('message', ev => {
  const m = ev.data as { type: string; title: string | null; payload: GridPayload | ChartPayload | null };
  if (m.type !== 'state') return;
  const heading = document.getElementById('title')!;
  heading.textContent = m.title ?? '';
  const view = document.getElementById('view')!;
  if (kind === 'grid') renderGrid(view, m.payload as GridPayload | null, edit => vscode.postMessage(edit));
  else void renderChart(view, m.payload as ChartPayload | null);
});

vscode.postMessage({ type: 'ready' });
