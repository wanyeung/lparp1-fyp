# D3Manipulation

Direct manipulation of charts: dragging a bar, point or slice changes the value behind it.

## Marks.js

Chart drawing and drag handlers from `src/webview-client.js` on `owen/mvp-studio` (commit `ee757c3`, Owen Chung), without the panel, grid and message plumbing. Both hosts load it as the chart script of the page (`Html.generateHtml(tree, nonce, marksSource)`), and it mounts every `.chart[data-chart]` in the page.

- It draws with plain SVG, not D3.
- A drag posts `{ type: 'patch', path, start, end, value, expected }`. `path` is the literal behind the point (the chart node's series carry one per value); `toEdit` turns the patch into the same `{ type: 'edit', path, kind, row, col, text }` message a cell edit sends, so the host needs no second code path. `start`, `end` and `expected` come from Owen's provenance model and this loop does not use them.
- A chart with several series draws one Marks chart per series.

## TODO

- Draw with D3 instead of plain SVG.
- Clone [recomEngine.js](https://github.com/BahadorSaket/VbD/blob/master/js/Recommendations/recomEngine.js) from BahadorSaket/VbD into this folder.
