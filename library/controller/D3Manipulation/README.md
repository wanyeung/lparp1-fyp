# D3Manipulation

Direct manipulation of charts: dragging a bar, point or slice changes the value behind it.

## Marks.js

Chart drawing and drag handlers from `src/webview-client.js` on `owen/mvp-studio` (commit `ee757c3`, Owen Chung), without the panel, grid and message plumbing. It is not wired into a host yet.

- It draws with plain SVG, not D3.
- A drag posts `{ type: 'patch', start, end, value, expected }`, offsets from Owen's provenance model. This loop edits with `{ name, kind, row, col, text }`, so a drag still has to be turned into that message.

## TODO

- Switch the chart drawing in `library/service/Charts.js` to D3. It draws plain SVG, ported from ggongtaek's `media/webview.js`.
- Clone [recomEngine.js](https://github.com/BahadorSaket/VbD/blob/master/js/Recommendations/recomEngine.js) from BahadorSaket/VbD into this folder.
