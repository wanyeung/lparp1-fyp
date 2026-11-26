// The browser look of a rendered document: paper background, serif titles, hairline rules and a quiet table, laid over the shared page style.
export const theme = (nonce) => `<style nonce="${nonce}">
body{background:#faf9f6;color:#1a1a1a;font:14px/1.55 system-ui,sans-serif;margin:0;padding:0}
section{border-top:1px solid #222;padding:18px 20px 22px;margin:0}
section section{border-top:1px solid #0002;padding:14px 0 0}
h2{font:600 26px Georgia,"Times New Roman",serif;display:flex;align-items:baseline;gap:14px;margin:0 0 12px}
h2 small{order:-1;font:600 10px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#555}
h3{font:600 18px Georgia,"Times New Roman",serif;margin:14px 0 6px}
p{color:#1a1a1a}
table{width:100%;border-collapse:collapse;margin-top:6px}
th{font:400 11px system-ui,sans-serif;color:#555;text-align:right;border:0;border-bottom:1px solid #222;padding:6px 8px;background:transparent}
td{padding:8px;border:0;border-bottom:1px solid #0002;text-align:right}
th:first-child,td:first-child{text-align:left}
.muted{color:#555}
.track.edit,.col-track.edit,.dot.edit{pointer-events:none}
.move button{border-color:#222;color:#1a1a1a}
</style>`
