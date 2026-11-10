import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('./webview-client.js', import.meta.url), 'utf8');

const styles = `
body {
  margin: 0;
  padding: 8px 14px 24px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
button, input, select { font: inherit; color: inherit; }
h1 { font-size: 13px; font-weight: 600; margin: 4px 0 10px; }
h2 { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;
     color: var(--vscode-descriptionForeground); margin: 14px 0 6px; }
.muted { color: var(--vscode-descriptionForeground); margin: 0 0 8px; }
.mono { font-family: var(--vscode-editor-font-family); }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border, transparent); }
th { color: var(--vscode-descriptionForeground); font-weight: 600; }
button.link, button.sort { background: transparent; border: 0; padding: 0; cursor: pointer; }
button.sort { color: var(--vscode-descriptionForeground); }
td.edit { background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 22%, transparent); cursor: text; }
td.computed { background: color-mix(in srgb, var(--vscode-descriptionForeground, #888) 14%, transparent); }
.tag { margin-left: 6px; font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; }
.chip { margin-left: 6px; border: 1px solid var(--vscode-panel-border, transparent); border-radius: 8px; padding: 0 6px; background: transparent; cursor: pointer; font-size: 11px; }
.filter, .editor, select { border: 1px solid var(--vscode-input-border, transparent); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; padding: 4px 6px; }
.controls { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; margin: 0 0 10px; }
.controls label { display: flex; gap: 6px; align-items: center; color: var(--vscode-descriptionForeground); }
.type-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
.type-row button { border: 1px solid var(--vscode-panel-border, transparent); background: var(--vscode-input-background); border-radius: 4px; padding: 6px 12px; cursor: pointer; }
.type-row button.on { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); }
.series { width: 100%; height: 220px; display: block; }
.series.square { height: 320px; }
.line { fill: none; stroke: var(--vscode-charts-blue, #3794ff); stroke-width: 2; }
.stem { stroke: var(--vscode-charts-blue, #3794ff); stroke-width: 2; }
.area { fill: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 28%, transparent); stroke: none; }
.grid { fill: none; stroke: var(--vscode-panel-border, #888); stroke-width: 1; }
.dot { fill: var(--vscode-charts-blue, #3794ff); }
.dot.edit { fill: var(--vscode-charts-green, #3fb950); cursor: ns-resize; }
.ticks { display: flex; justify-content: space-between; gap: 4px; color: var(--vscode-descriptionForeground); font-size: 11px; }
.columns { display: flex; align-items: stretch; gap: 8px; height: 220px; }
.column { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.col-value, .col-label { font-size: 11px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-value { font-family: var(--vscode-editor-font-family); }
.col-track { flex: 1; width: 100%; max-width: 42px; display: flex; align-items: flex-end; background: color-mix(in srgb, var(--vscode-descriptionForeground, #888) 16%, transparent); border-radius: 4px; }
.col-track.edit { cursor: ns-resize; touch-action: none; }
.col-fill { width: 100%; border-radius: 4px; background: var(--vscode-charts-blue, #3794ff); }
.col-track.edit .col-fill { background: var(--vscode-charts-green, #3fb950); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 8px; }
.swatch { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: middle; }
.filter { width: min(280px, 100%); margin: 0 0 8px; }
.bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.bar-label { width: 7.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { flex: 1; height: 18px; background: color-mix(in srgb, var(--vscode-descriptionForeground, #888) 16%, transparent); border-radius: 4px; }
.track.edit { cursor: ew-resize; touch-action: none; }
.fill { height: 100%; border-radius: 4px; background: var(--vscode-charts-blue, #3794ff); }
.track.edit .fill { background: var(--vscode-charts-green, #3fb950); }
.bar-value { width: 4.5rem; text-align: right; font-family: var(--vscode-editor-font-family); }
.missing { color: var(--vscode-errorForeground); }
`;

export function viewHtml({ kind, nonce, cspSource, bootstrap }) {
  const boot = bootstrap
    ? `window.__MLS_BOOT__ = ${JSON.stringify(bootstrap).replace(/</g, '\\u003c')};`
    : '';
  const title = kind === 'grid' ? 'GridView' : kind === 'chart' ? 'ChartView' : 'InfoView';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>MLscript ${title}</title>
<style>${styles}</style>
</head>
<body data-kind="${kind}">
<div id="root"></div>
<script nonce="${nonce}">
${boot}
${client}
</script>
</body>
</html>`;
}
