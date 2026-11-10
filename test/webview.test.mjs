import assert from 'node:assert/strict';
import test from 'node:test';
import { viewHtml } from '../src/webview.mjs';

test('each view is its own panel, not a document page', () => {
  for (const kind of ['info', 'grid', 'chart']) {
    const html = viewHtml({ kind, nonce: 'abc123', cspSource: 'vscode-webview:' });
    assert.match(html, /script-src 'nonce-abc123'/);
    assert.match(html, new RegExp(`data-kind="${kind}"`));
    assert.doesNotMatch(html, /This page is a reading/);
    if (kind === 'chart') {
      assert.match(html, /aria-label': 'Chart'/);
      assert.match(html, /aria-label': 'Chart type'/);
      for (const label of ['Bar', 'Column', 'Line', 'Area', 'Step', 'Scatter', 'Lollipop', 'Pie', 'Donut', 'Radar']) {
        assert.match(html, new RegExp(label));
      }
    }
    assert.doesNotMatch(html, /window\.__MLS_BOOT__ =/);
  }
});

test('a preview model is embedded without breaking the script tag', () => {
  const html = viewHtml({
    kind: 'grid',
    nonce: 'preview',
    cspSource: 'preview',
    bootstrap: { title: 'A </script> title', documents: [], tables: [], charts: [], docs: [], errors: [] },
  });
  assert.match(html, /\\u003c\/script>/);
  assert.equal(html.includes('<script>'), false);
});
