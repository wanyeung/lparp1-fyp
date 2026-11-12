// Pure, dependency-free rendering for Studio's MLscript array descriptors.
const MAX_DEPTH = 64, MAX_NODES = 10000, MAX_CELLS = 1000000;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = message => { throw new TypeError(`Studio Render: ${message}`); };
const string = (value, label) => typeof value === 'string' ? value : fail(`${label} must be a string`);
const array = (value, label) => Array.isArray(value) ? value : fail(`${label} must be an array`);
const scalar = value => value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const numeric = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) && Number.isFinite(Number(value))) return Number(value);
  return fail('chart values must be finite numbers (or numeric strings)');
};

/** Flatten displayed leaves in author order; source-only tables are never inserted. */
export function model(root, order = []) {
  const items = [], groups = [], ids = new Map(), sources = [], tables = new WeakMap(), active = new WeakSet();
  const activeTables = new WeakSet();
  let nodes = 0, cells = 0;
  const count = () => { if (++nodes > MAX_NODES) fail(`node count exceeds ${MAX_NODES}`); };
  const metadata = descriptor => {
    array(descriptor, 'descriptor');
    const [kind, id, name] = descriptor;
    string(kind, 'kind'); string(id, 'id'); string(name, 'title');
    if (!id || /[\s\u0000-\u001f\u007f]/u.test(id)) fail('id must be nonempty and contain no whitespace or control characters');
    if (/\p{Surrogate}/u.test(id)) fail('id must contain valid Unicode');
    const lengths = { group: 4, table: 5, derived: 6, bar: 6, pie: 6, line: 6, text: 4 };
    if (!Object.hasOwn(lengths, kind)) fail(`unknown descriptor kind: ${kind}`);
    if (descriptor.length !== lengths[kind]) fail(`${kind} descriptor has an invalid length`);
    return { kind, id, name };
  };
  const table = descriptor => {
    if (tables.has(descriptor)) return tables.get(descriptor);
    if (activeTables.has(descriptor)) fail('cycle detected in derived-table provenance');
    activeTables.add(descriptor);
    const meta = metadata(descriptor);
    if (meta.kind !== 'table' && meta.kind !== 'derived') fail('chart source must be a table descriptor');
    const headers = array(descriptor[3], 'table headers');
    const rows = array(descriptor[4], 'table rows');
    if (headers.length > MAX_CELLS || rows.length > MAX_CELLS || (cells += headers.length * rows.length) > MAX_CELLS) fail(`cell count exceeds ${MAX_CELLS}`);
    const seen = new Set();
    const copiedHeaders = Array.from(headers, header => {
      string(header, 'column name');
      if (!header.trim() || seen.has(header)) fail('column names must be nonempty and unique');
      seen.add(header); return header;
    });
    const copiedRows = Array.from(rows, (row, index) => {
      array(row, `row ${index + 1}`);
      if (row.length !== headers.length) fail(`row ${index + 1} width does not match headers`);
      return Array.from(row, value => scalar(value) ? value : fail('table cells must be scalar values; numbers must be finite'));
    });
    const result = { ...meta, kind: 'table', headers: copiedHeaders, rows: copiedRows };
    if (meta.kind === 'derived') {
      count();
      const source = table(descriptor[5]);
      sources.push([descriptor[5], source.id]);
      result.sourceTableId = source.id;
      result.sourceName = source.name;
      result.derived = true;
    }
    tables.set(descriptor, result);
    activeTables.delete(descriptor);
    return result;
  };
  const visit = (descriptor, depth, parentId) => {
    if (depth > MAX_DEPTH) fail(`group depth exceeds ${MAX_DEPTH}`);
    if (active.has(descriptor)) fail('cycle detected in group descriptors');
    const meta = metadata(descriptor);
    if (ids.has(meta.id)) fail(`duplicate displayed id: ${meta.id}`);
    ids.set(meta.id, descriptor); count(); active.add(descriptor);
    let node;
    if (meta.kind === 'group') {
      const children = array(descriptor[3], 'group children');
      const group = { id: meta.id, name: meta.name, itemIds: [], ...(parentId === undefined ? {} : { parentId }) };
      groups.push(group);
      node = { ...meta, children: Array.from(children, child => visit(child, depth + 1, meta.id)) };
    } else {
      if (meta.kind === 'table' || meta.kind === 'derived') node = table(descriptor);
      else if (meta.kind === 'text') node = { ...meta, text: string(descriptor[3], 'text') };
      else {
        const sourceDescriptor = descriptor[3];
        if (!tables.has(sourceDescriptor)) count();
        const source = table(sourceDescriptor);
        sources.push([sourceDescriptor, source.id]);
        const x = string(descriptor[4], 'x column');
        if (meta.kind === 'line') {
          const ys = array(descriptor[5], 'line y columns');
          if (!ys.length || new Set(ys).size !== ys.length) fail('line chart needs nonempty unique y columns');
          const xi = source.headers.indexOf(x);
          if (xi < 0) fail(`unknown chart column: ${x}`);
          const series = ys.map(y => {
            string(y, 'y column');
            const yi = source.headers.indexOf(y);
            if (yi < 0) fail(`unknown chart column: ${y}`);
            return { name: y, points: source.rows.map(row => ({ x: numeric(row[xi]), y: numeric(row[yi]) })).sort((a, b) => a.x - b.x) };
          });
          node = { id: meta.id, kind: 'chart', name: meta.name, chartType: 'line', sourceTableId: source.id, sourceName: source.name, x, y: ys, series };
        } else {
        const y = string(descriptor[5], 'y column');
        const xi = source.headers.indexOf(x), yi = source.headers.indexOf(y);
        if (xi < 0 || yi < 0) fail(`unknown chart column: ${xi < 0 ? x : y}`);
        const data = source.rows.map(row => {
          const value = numeric(row[yi]);
          if (meta.kind === 'pie' && value < 0) fail('pie values must not be negative');
          return { label: row[xi] === null ? '' : String(row[xi]), value };
        });
        node = { id: meta.id, kind: 'chart', name: meta.name, chartType: meta.kind, sourceTableId: source.id, sourceName: source.name, x, y, data };
        }
      }
      if (parentId !== undefined) node = { ...node, groupId: parentId };
      items.push(node);
    }
    active.delete(descriptor);
    return node;
  };
  const roots = Array.isArray(root) && (root.length === 0 || typeof root[0] !== 'string') ? root : [root];
  let tree = Array.from(roots, descriptor => visit(descriptor, 0));
  for (const [descriptor, id] of sources) {
    if (ids.has(id) && ids.get(id) !== descriptor) fail(`source table id conflicts with a displayed descriptor: ${id}`);
  }
  const known = new Set(items.map(item => item.id)), priority = new Map();
  for (const id of array(order, 'order')) {
    string(id, 'order id');
    if (!known.has(id)) fail(`unknown order id: ${id}`);
    if (priority.has(id)) fail(`duplicate order id: ${id}`);
    priority.set(id, priority.size);
  }
  const groupById = new Map(groups.map(group => [group.id, group]));
  const reorder = children => {
    const leaves = children.filter(child => child.kind !== 'group').sort((a, b) => (priority.get(a.id) ?? Infinity) - (priority.get(b.id) ?? Infinity));
    let index = 0;
    return children.map(child => {
      if (child.kind !== 'group') return leaves[index++];
      child.children = reorder(child.children);
      groupById.get(child.id).itemIds = child.children.filter(item => item.kind !== 'group').map(item => item.id);
      return child;
    });
  };
  tree = reorder(tree);
  items.length = 0;
  const flatten = children => children.forEach(child => child.kind === 'group' ? flatten(child.children) : items.push(child));
  flatten(tree);
  return { items, order: items.map(item => item.id), groups, tree };
}

const palette = index => `series-${index % 8}`;
const number = value => String(Math.round(value * 1000) / 1000);
const empty = message => `<p class="empty">${escape(message)}</p>`;
function tableHtml(item) {
  const head = item.headers.map(header => `<th scope="col">${escape(header)}</th>`).join('');
  const rows = item.rows.map(row => `<tr>${row.map(value => `<td>${value === null ? '' : escape(value)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><caption>${escape(item.name)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${item.rows.length ? '' : empty('No rows.')}`;
}
function barSvg(item) {
  if (!item.data.length) return empty('No chart data.');
  const max = item.data.reduce((m, datum) => Math.max(m, Math.abs(datum.value)), 0);
  if (!max) return empty('All values are zero.');
  const values = item.data.map(datum => datum.value / max);
  const min = values.reduce((m, value) => Math.min(m, value), 0), high = values.reduce((m, value) => Math.max(m, value), 0);
  const y = value => 20 + (high - value) / (high - min) * 190;
  const base = y(0), step = 540 / values.length;
  const bars = item.data.map((datum, i) => {
    const top = y(values[i]), height = Math.abs(top - base);
    return `<rect class="${palette(i)}" x="${number(45 + i * step + step * 0.1)}" y="${number(Math.min(top, base))}" width="${number(step * 0.8)}" height="${number(height)}"><title>${escape(datum.label)}: ${escape(datum.value)}</title></rect>`;
  }).join('');
  return `<svg class="chart bar" viewBox="0 0 620 245" role="img" aria-label="${escape(item.name)}"><title>${escape(item.name)} — ${escape(item.x)} / ${escape(item.y)}</title><line class="axis" x1="45" x2="585" y1="${number(base)}" y2="${number(base)}"/>${bars}<text x="45" y="235">${escape(item.x)}</text></svg>${legend(item.data)}`;
}
function legend(data) {
  return `<ul class="legend">${data.map((datum, i) => `<li><span class="swatch ${palette(i)}" aria-hidden="true"></span>${escape(datum.label)}: ${escape(datum.value)}</li>`).join('')}</ul>`;
}
function lineSvg(item) {
  const points = item.series.flatMap(series => series.points);
  if (!points.length) return empty('No chart data.');
  const scaleX = points.reduce((m, p) => Math.max(m, Math.abs(p.x)), 1);
  const scaleY = points.reduce((m, p) => Math.max(m, Math.abs(p.y)), 1);
  const xs = points.map(p => p.x / scaleX), ys = points.map(p => p.y / scaleY);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
  if (ymin === ymax) { ymin -= 0.5; ymax += 0.5; }
  const x = value => 70 + (value / scaleX - xmin) / (xmax - xmin) * 500;
  const y = value => 220 - (value / scaleY - ymin) / (ymax - ymin) * 180;
  const paths = item.series.map((series, i) => `<polyline class="${palette(i)} curve" points="${series.points.map(p => `${number(x(p.x))},${number(y(p.y))}`).join(' ')}"><title>${escape(series.name)}</title></polyline>`).join('');
  const fmt = value => Number(value.toPrecision(5));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => `<text x="${number(70 + f * 500)}" y="240" text-anchor="middle">${escape(fmt((xmin + f * (xmax - xmin)) * scaleX))}</text><text x="62" y="${number(224 - f * 180)}" text-anchor="end">${escape(fmt((ymin + f * (ymax - ymin)) * scaleY))}</text>`).join('');
  const key = `<ul class="legend">${item.series.map((series, i) => `<li><span class="swatch ${palette(i)}"></span>${escape(series.name)}</li>`).join('')}</ul>`;
  return `<svg class="chart line" viewBox="0 0 620 275" role="img" aria-label="${escape(item.name)}"><title>${escape(item.name)}</title><line class="axis" x1="70" x2="570" y1="220" y2="220"/><line class="axis" x1="70" x2="70" y1="40" y2="220"/>${ticks}${paths}<text x="320" y="268" text-anchor="middle">${escape(item.x)}</text></svg>${key}`;
}
function pieSvg(item) {
  if (!item.data.length) return empty('No chart data.');
  const max = item.data.reduce((m, datum) => Math.max(m, datum.value), 0);
  if (!max) return empty('All values are zero.');
  const total = item.data.reduce((sum, datum) => sum + datum.value / max, 0);
  const positive = item.data.filter(datum => datum.value > 0).length;
  let angle = -Math.PI / 2;
  const slices = item.data.map((datum, i) => {
    if (!datum.value) return '';
    const title = `<title>${escape(datum.label)}: ${escape(datum.value)}</title>`;
    if (positive === 1) return `<circle class="${palette(i)}" cx="160" cy="135" r="110">${title}</circle>`;
    const next = angle + (datum.value / max / total) * Math.PI * 2;
    const point = a => `${number(160 + Math.cos(a) * 110)} ${number(135 + Math.sin(a) * 110)}`;
    const path = `M 160 135 L ${point(angle)} A 110 110 0 ${next - angle > Math.PI ? 1 : 0} 1 ${point(next)} Z`;
    angle = next;
    return `<path class="${palette(i)}" d="${path}">${title}</path>`;
  }).join('');
  return `<svg class="chart pie" viewBox="0 0 320 270" role="img" aria-label="${escape(item.name)}"><title>${escape(item.name)}</title>${slices}</svg>${legend(item.data)}`;
}

const CSS = `
:root{color-scheme:light dark;font-family:var(--vscode-font-family,system-ui,sans-serif);color:var(--vscode-editor-foreground,#333);background:var(--vscode-editor-background,#fff)}
body{margin:0;padding:24px;line-height:1.5}main{max-width:1100px;margin:auto}h1,h2,h3,h4,h5,h6{line-height:1.25}h1{font-size:1.65rem}.group{border-left:3px solid var(--vscode-panel-border,#d5d5d5);padding-left:18px;margin:24px 0}.item{margin:22px 0;padding:16px;border:1px solid var(--vscode-panel-border,#d5d5d5);border-radius:5px}.item h2,.item h3,.item h4,.item h5,.item h6{margin-top:0}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}caption{text-align:left;font-weight:600;margin-bottom:8px}th,td{padding:7px 10px;border-bottom:1px solid var(--vscode-panel-border,#ddd)}th{background:var(--vscode-editor-inactiveSelectionBackground,#eee)}a{color:var(--vscode-textLink-foreground,#006ab1)}.text{white-space:pre-wrap;overflow-wrap:anywhere}.provenance,.empty{color:var(--vscode-descriptionForeground,#666);font-size:.9rem}.chart{display:block;max-width:100%;height:auto}.bar{width:620px}.pie{width:320px}.chart text{fill:var(--vscode-editor-foreground,#333);font-size:13px}.axis{stroke:var(--vscode-editor-foreground,#777);stroke-width:1}.legend{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 20px}.legend li{overflow-wrap:anywhere}.swatch{display:inline-block;width:10px;height:10px;margin-right:6px}.series-0{fill:#4477aa;background:#4477aa}.series-1{fill:#ee6677;background:#ee6677}.series-2{fill:#228833;background:#228833}.series-3{fill:#ccbb44;background:#ccbb44}.series-4{fill:#66ccee;background:#66ccee}.series-5{fill:#aa3377;background:#aa3377}.series-6{fill:#bbbbbb;background:#bbbbbb}.series-7{fill:#ee9933;background:#ee9933}
@media(prefers-color-scheme:dark){:root{color:var(--vscode-editor-foreground,#ddd);background:var(--vscode-editor-background,#1e1e1e)}th{background:var(--vscode-editor-inactiveSelectionBackground,#333)}.provenance,.empty{color:var(--vscode-descriptionForeground,#aaa)}}
`;

/** Return a full offline document, with no scripts, external resources, or inline style attributes. */
export function render(root, order = []) {
  const document = model(root, order), displayed = new Set(document.items.filter(item => item.kind === 'table').map(item => item.id));
  const nodeHtml = (node, depth = 2) => {
    const heading = Math.min(depth, 6), title = `<h${heading}>${escape(node.name)}</h${heading}>`;
    if (node.kind === 'group') return `<section class="group" id="${escape(node.id)}">${title}${node.children.length ? node.children.map(child => nodeHtml(child, depth + 1)).join('') : empty('This group is empty.')}</section>`;
    let body;
    if (node.kind === 'table') {
      const source = node.sourceTableId ? `<p class="provenance">Derived from: ${displayed.has(node.sourceTableId) ? `<a href="#${escape(encodeURIComponent(node.sourceTableId))}">${escape(node.sourceName)}</a>` : escape(node.sourceName) + ' (not displayed)'}</p>` : '';
      body = source + tableHtml(node);
    }
    else if (node.kind === 'text') body = `<div class="text">${escape(node.text)}</div>`;
    else {
      const source = displayed.has(node.sourceTableId) ? `<a href="#${escape(encodeURIComponent(node.sourceTableId))}">${escape(node.sourceName)}</a>` : `${escape(node.sourceName)} (not displayed)`;
      body = `<p class="provenance">Source: ${source} · ${escape(node.x)} / ${escape(node.y)}</p>${node.chartType === 'pie' ? pieSvg(node) : node.chartType === 'line' ? lineSvg(node) : barSvg(node)}`;
    }
    return `<article class="item" id="${escape(node.id)}">${title}${body}</article>`;
  };
  return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MLscript Studio</title><style>${CSS}\n.line{width:620px}.curve{fill:none;stroke-width:2.5}.curve.series-0{stroke:#4477aa}.curve.series-1{stroke:#ee6677}.curve.series-2{stroke:#228833}.curve.series-3{stroke:#ccbb44}.curve.series-4{stroke:#66ccee}.curve.series-5{stroke:#aa3377}.curve.series-6{stroke:#bbbbbb}.curve.series-7{stroke:#ee9933}</style></head><body><main><h1>MLscript Studio</h1>${document.tree.length ? document.tree.map(node => nodeHtml(node)).join('') : empty('No items to display.')}</main></body></html>`;
}

const Render = Object.freeze({ render, model });
export default Render;
