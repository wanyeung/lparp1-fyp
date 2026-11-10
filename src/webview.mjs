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
