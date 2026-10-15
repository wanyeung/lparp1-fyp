/**
 * The InfoView webview document, as one isolated HTML string.
 *
 * Stage 4 of the pipeline:
 *   Host `postMessage({type:'update', result})`  ──▶  `window 'message'` handler
 *   ──▶ render()  ──▶  printType() turns the JSON type AST into readable,
 *   colourised signatures (with correct parenthesisation).
 *
 * The script below runs in the webview sandbox (plain JS, no `vscode` import).
 * All DOM is built with createElement/textContent, never innerHTML, so text
 * coming from the document can't inject markup.
 */
export function getInfoViewHtml(nonce: string, cspSource: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MLscript InfoView</title>
<style nonce="${nonce}">
  :root { --gap: 14px; }
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
         color: var(--vscode-foreground); padding: 8px 14px 24px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 600;
       color: var(--vscode-descriptionForeground); margin: var(--gap) 0 6px; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .muted { color: var(--vscode-descriptionForeground); }
  .hidden { display: none; }

  /* header: where the cursor is + the expression under it */
  .cursor-bar { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; }
  .pill { padding: 1px 8px; border-radius: 10px; font-size: 11px;
          background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .expr { margin-top: 6px; padding: 6px 8px; border-radius: 4px; cursor: pointer; white-space: pre-wrap;
          background: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textBlockQuote-border); }
  .expr:hover { outline: 1px solid var(--vscode-focusBorder); }

  /* the signature */
  .signature { padding: 8px 10px; border-radius: 4px; line-height: 1.6; overflow-x: auto;
               background: var(--vscode-editor-background);
               border: 1px solid var(--vscode-panel-border, transparent); }
  .t-prim  { color: var(--vscode-symbolIcon-classForeground, #4ec9b0); }
  .t-lit   { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
  .t-var   { color: var(--vscode-symbolIcon-variableForeground, #9cdcfe); font-style: italic; }
  .t-ref   { color: var(--vscode-symbolIcon-interfaceForeground, #4fc1ff); font-weight: 600; }
  .t-field { color: var(--vscode-symbolIcon-fieldForeground, #9cdcfe); }
  .t-op    { color: var(--vscode-symbolIcon-keywordForeground, #c586c0); font-weight: 700; padding: 0 2px; }
  .t-punct { color: var(--vscode-descriptionForeground); }

  /* bounds table */
  .bounds { display: grid; grid-template-columns: auto auto 1fr; gap: 4px 10px; align-items: baseline; }
  .rel { font-weight: 700; text-align: center; padding: 0 6px; border-radius: 3px; }
  .rel.lower { background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 25%, transparent); }
  .rel.upper { background: color-mix(in srgb, var(--vscode-charts-orange, #d29922) 25%, transparent); }

  /* hierarchy */
  ul.tree, ul.tree ul { list-style: none; margin: 0; padding-left: 18px;
                        border-left: 1px dashed var(--vscode-panel-border, #888); }
  ul.tree { padding-left: 0; border-left: 0; }
  .node { margin: 3px 0; }
  .kind { font-size: 10px; text-transform: uppercase; margin-right: 6px; opacity: .8; }
  .chip { display: inline-block; margin: 0 4px 0 0; padding: 0 6px; font-size: 11px; border-radius: 8px;
          border: 1px solid var(--vscode-panel-border, #888); }

  details { margin-top: 6px; }
  summary { cursor: pointer; color: var(--vscode-descriptionForeground); font-size: 11px; }
  pre { margin: 4px 0 0; overflow-x: auto; }

  .trace { margin-top: 18px; font-size: 11px; color: var(--vscode-descriptionForeground); }
  .diag  { color: var(--vscode-editorWarning-foreground); }
  .stale { opacity: .45; transition: opacity .15s; }
</style>
</head>
<body>
  <div id="empty" class="muted">Place the cursor on a line in an <code>.mls</code> file.</div>

  <div id="main" class="hidden">
    <div class="cursor-bar mono">
      <span class="pill" id="pos"></span>
      <span class="pill" id="off"></span>
      <span class="muted" id="label"></span>
    </div>
    <div class="expr mono" id="expr" title="Click to focus the editor"></div>

    <h2>Inferred type</h2>
    <div class="signature mono" id="signature"></div>
    <details><summary>Raw type AST (JSON from the type server)</summary><pre class="mono" id="json"></pre></details>

    <h2>Local constraints</h2>
    <div class="bounds mono" id="bounds"></div>
    <div class="muted hidden" id="no-bounds">No bounds in scope.</div>

    <div id="hier-section">
      <h2>Mixin / component hierarchy</h2>
      <ul class="tree mono" id="hierarchy"></ul>
    </div>

    <div id="diags"></div>
    <div class="trace mono" id="trace"></div>
  </div>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  // ---- tiny DOM helper -----------------------------------------------------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---- JSON type AST -> readable signature ---------------------------------
  // Precedence (low -> high): fun 0, union 1, inter 2, atom 3.
  // A child is parenthesised when it binds looser than its context requires.
  function prec(t) {
    switch (t.kind) {
      case 'fun': return 0;
      case 'union': return 1;
      case 'inter': return 2;
      default: return 3;
    }
  }

  function printType(t, minPrec) {
    const frag = document.createDocumentFragment();
    const needParens = prec(t) < (minPrec || 0);
    if (needParens) frag.append(el('span', 't-punct', '('));

    switch (t.kind) {
      case 'prim': frag.append(el('span', 't-prim', t.name)); break;
      case 'lit':  frag.append(el('span', 't-lit', t.value)); break;
      case 'var':  frag.append(el('span', 't-var', t.name)); break;
      case 'ref':  frag.append(refNode(t)); break;
      case 'record':
        frag.append(el('span', 't-punct', t.fields.length ? '{ ' : '{}'));
        t.fields.forEach((f, i) => {
          if (i > 0) frag.append(el('span', 't-punct', ', '));
          frag.append(el('span', 't-field', f.name), el('span', 't-punct', ': '), printType(f.type, 0));
        });
        if (t.fields.length) frag.append(el('span', 't-punct', ' }'));
        break;
      case 'fun':
        // params must bind tighter than '->'; the return type may itself be a function (right-assoc)
        t.params.forEach((p, i) => {
          if (i > 0) frag.append(el('span', 't-punct', ', '));
          frag.append(printType(p, 1));
        });
        frag.append(el('span', 't-op', ' -> '), printType(t.ret, 0));
        break;
      case 'union': join(frag, t.members, ' | ', 2); break;  // members: inter or atom
      case 'inter': join(frag, t.members, ' & ', 3); break;  // members: atoms only
      default: frag.append(el('span', 'muted', '<?>'));
    }
    if (needParens) frag.append(el('span', 't-punct', ')'));
    return frag;
  }

  function refNode(t) {
    const n = el('span', 't-ref', t.name);
    if (t.role) n.title = t.role;
    return n;
  }

  function join(frag, members, sep, childPrec) {
    members.forEach((m, i) => {
      if (i > 0) frag.append(el('span', 't-op', sep));
      frag.append(printType(m, childPrec));
    });
  }

  // ---- renderers for each panel section ------------------------------------
  function renderBounds(bounds) {
    const box = $('bounds');
    box.replaceChildren();
    $('no-bounds').classList.toggle('hidden', bounds.length > 0);
    for (const b of bounds) {
      box.append(
        el('span', 't-var', b.variable),
        el('span', 'rel ' + b.relation, b.relation === 'lower' ? ':>' : '<:'),
        wrap(printType(b.type, 0)),
      );
    }
  }

  function wrap(frag) { const s = el('span'); s.append(frag); return s; }

  function renderHierarchy(root) {
    $('hier-section').classList.toggle('hidden', !root);
    const ul = $('hierarchy');
    ul.replaceChildren();
    if (root) ul.append(hierNode(root));
  }

  function hierNode(n) {
    const li = el('li', 'node');
    li.append(el('span', 'kind', n.kind), el('span', 't-ref', n.name), document.createTextNode(' '));
    (n.members || []).forEach((m) => li.append(el('span', 'chip', m)));
    if (n.children && n.children.length) {
      const ul = el('ul');
      n.children.forEach((c) => ul.append(hierNode(c)));
      li.append(ul);
    }
    return li;
  }

  // ---- message handling -----------------------------------------------------
  let currentRequestId = 0;

  function showMain(show) {
    $('main').classList.toggle('hidden', !show);
    $('empty').classList.toggle('hidden', show);
  }

  function renderCursor(c) {
    $('pos').textContent = 'Ln ' + (c.line + 1) + ', Col ' + (c.character + 1);
    $('off').textContent = 'offset ' + c.offset;
    $('expr').textContent = c.expr.text;
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'empty':
        showMain(false);
        $('empty').textContent = msg.reason;
        break;

      case 'pending':
        // Cursor moved, answer not here yet: update the header, dim the old answer.
        currentRequestId = msg.requestId;
        showMain(true);
        renderCursor(msg.cursor);
        $('main').classList.add('stale');
        break;

      case 'update': {
        if (msg.requestId !== currentRequestId && currentRequestId !== 0) return; // stale reply
        const r = msg.result;
        showMain(true);
        $('main').classList.remove('stale');
        renderCursor(msg.cursor);
        $('label').textContent = r.label;

        const sig = $('signature');
        sig.replaceChildren();
        if (r.type) sig.append(printType(r.type, 0)); else sig.append(el('span', 'muted', 'no type'));
        $('json').textContent = JSON.stringify(r.type, null, 2);

        renderBounds(r.bounds);
        renderHierarchy(r.hierarchy);

        const diags = $('diags');
        diags.replaceChildren();
        r.diagnostics.forEach((d) => diags.append(el('div', 'diag', '⚠ ' + d)));

        $('trace').textContent =
          'selection → host → mock server (' + Math.round(msg.latencyMs) + ' ms) → view   [req #' + msg.requestId + ']';
        break;
      }
    }
  });

  $('expr').addEventListener('click', () => vscode.postMessage({ type: 'reveal' }));

  // Handshake: tell the host the listener above is installed, so it can flush
  // whatever it queued while the webview was still loading.
  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
