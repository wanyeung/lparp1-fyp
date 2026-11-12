'use strict';

const vscodeApi = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : { postMessage(message) { console.log(message); } };

const kind = document.body.dataset.kind || 'grid';
const root = document.getElementById('root');
let model = null;
let cursor = null;
const sorts = {};
const filters = {};
let editing = false;
let pending = null;
let pickedChartId = null;
let followedTableId = null;
const chartTypes = {};

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  const props = attrs || {};
  Object.keys(props).forEach((key) => {
    const value = props[key];
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'value') node.value = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  const list = Array.isArray(children) ? children : children == null ? [] : [children];
  list.forEach((child) => {
    if (child == null || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function reveal(start, end) {
  if (start == null || end == null) return;
  vscodeApi.postMessage({ type: 'reveal', start, end });
}

function currentTable() {
  if (!model || !model.tables || !model.tables.length) return null;
  let nearest = null;
  for (let index = 0; index < model.tables.length; index += 1) {
    const table = model.tables[index];
    if (cursor != null && table.start <= cursor && cursor <= table.end) return table;
    if (cursor != null && table.start <= cursor) nearest = table;
  }
  return nearest || model.tables[0];
}

function chartsFor(table) {
  if (!table) return [];
  return (model.charts || []).filter((chart) => chart.source === table.id);
}

function displayedRows(table) {
  const filter = String(filters[table.id] || '').trim().toLowerCase();
  let rows = table.rows.slice();
  if (filter) {
    rows = rows.filter((row) => row.cells.some((cell) => String(cell.display).toLowerCase().indexOf(filter) >= 0));
  }
  const sort = sorts[table.id];
  if (sort && sort.column) {
    const direction = sort.direction === 'desc' ? -1 : 1;
    rows.sort((a, b) => direction * compareCells(findCell(a, sort.column), findCell(b, sort.column)));
  }
  return rows;
}

function findCell(row, key) {
  return row.cells.find((cell) => cell.key === key);
}

function compareCells(a, b) {
  if (a && b && a.numeric != null && b.numeric != null) return a.numeric - b.numeric;
  return String(a ? a.display : '').localeCompare(String(b ? b.display : ''));
}

function render() {
  const scroll = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
  root.textContent = '';
  if (!model) {
    root.append(el('p', { class: 'muted', text: 'Open a .mls file.' }));
    return;
  }
  if (model.compiler === 'hkmc2') {
    root.append(el('p', { class: 'muted', text: 'hkmc2 computed these values from the let bindings.' }));
  }
  if (kind === 'info') root.append(renderInfo());
  else if (kind === 'chart') root.append(renderCharts());
  else root.append(renderGrid());
  if (document.scrollingElement) document.scrollingElement.scrollTop = scroll;
}

function renderInfo() {
  const table = currentTable();
  if (!table) return el('p', { class: 'muted', text: 'Move the cursor into a let.' });
  const errors = (model.errors || []).filter((error) => error.start >= table.start && error.start <= table.end);
  return el('div', {}, [
    el('h1', { text: table.title }),
    el('p', { class: 'muted mono', text: 'line ' + table.line }),
    ...caseNotes(table),
    el('h2', { text: 'Fields' }),
    el('table', {}, [
      el('tbody', {}, table.columns.map((column) => {
        const sample = table.rows.map((row) => findCell(row, column.key)).find((cell) => cell && cell.expr);
        const literal = table.rows.every((row) => {
          const cell = findCell(row, column.key);
          return !cell || cell.editable || !cell.expr;
        });
        return el('tr', {}, [
          el('td', { text: column.label }),
          el('td', { class: 'mono', text: literal ? 'literal' : sample.expr }),
        ]);
      })),
    ]),
    errors.length ? el('div', {}, errors.map((error) => el('p', { class: 'missing', text: error.message }))) : null,
    el('p', {}, [
      el('button', { class: 'link', type: 'button', onclick: () => reveal(table.start, table.end), text: 'Show in editor' }),
    ]),
  ]);
}

function casePaths(table) {
  const documents = model.documents || [];
  const paths = [];
  function search(document, stack) {
    if (!document || stack.some((item) => item.id === document.id)) return;
    const next = stack.concat(document);
    let direct = false;
    document.blocks.forEach((block) => {
      if (block.kind === 'table' && block.id === table.id) direct = true;
      if (block.kind === 'document') search(documents.find((item) => item.id === block.id), next);
    });
    if (direct) paths.push(next);
  }
  const roots = documents.filter((document) => !documents.some((other) => other.blocks.some((block) => block.kind === 'document' && block.id === document.id)));
  roots.forEach((root) => search(root, []));
  return paths;
}

function caseNotes(table) {
  const notes = [];
  casePaths(table).forEach((path) => {
    notes.push(el('p', { class: 'muted', text: path.map((document) => document.title).join(' / ') }));
    const leaf = path[path.length - 1];
    leaf.blocks.forEach((block) => {
      if (block.kind !== 'doc') return;
      const doc = (model.docs || []).find((item) => item.id === block.id);
      if (!doc) return;
      notes.push(el('h2', { text: doc.title }));
      doc.body.split('\n').filter((line) => line.trim()).forEach((line) => {
        notes.push(el('p', { text: line }));
      });
    });
  });
  return notes;
}

function renderGrid() {
  const table = currentTable();
  if (!table) return el('p', { class: 'muted', text: 'Move the cursor into a let.' });
  const rows = displayedRows(table);
  const sort = sorts[table.id];
  return el('div', {}, [
    el('h1', { text: table.title }),
    el('input', {
      class: 'filter',
      type: 'search',
      placeholder: 'Filter',
      value: filters[table.id] || '',
      oninput: (event) => { filters[table.id] = event.target.value; render(); },
    }),
    el('table', {}, [
      el('thead', {}, [el('tr', {}, table.columns.map((column) => {
        const mark = sort && sort.column === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
        return el('th', {}, [el('button', {
          class: 'sort',
          type: 'button',
          onclick: () => {
            const current = sorts[table.id];
            if (!current || current.column !== column.key) sorts[table.id] = { column: column.key, direction: 'asc' };
            else if (current.direction === 'asc') sorts[table.id] = { column: column.key, direction: 'desc' };
            else delete sorts[table.id];
            render();
          },
          text: column.label + mark,
        })]);
      }))]),
      el('tbody', {}, rows.length
        ? rows.map((row) => el('tr', {}, row.cells.map((cell) => renderCell(cell))))
        : [el('tr', {}, [el('td', { colspan: String(table.columns.length || 1), text: 'No rows' })])]),
    ]),
  ]);
}

function renderCell(cell) {
  const formula = !cell.editable && cell.expr && /[+\-*/()]/.test(cell.expr);
  const body = [el('span', { text: cell.display })];
  if (!cell.editable && cell.expr) body.push(el('span', { class: 'tag', text: 'computed' }));
  if (formula) {
    (cell.refs || []).slice(0, 3).forEach((ref) => {
      body.push(el('button', {
        class: 'chip',
        type: 'button',
        onclick: (event) => { event.stopPropagation(); reveal(ref.start, ref.end); },
        text: ref.path,
      }));
    });
  }
  return el('td', {
    class: cell.editable ? 'edit' : 'computed',
    title: cell.editable ? 'Literal. Click to edit.' : (cell.expr || 'Computed'),
    onclick: (event) => {
      if (cell.editable) beginEdit(event.currentTarget, cell);
      else reveal(cell.revealStart, cell.revealEnd);
    },
  }, body);
}

function beginEdit(td, cell) {
  if (editing || !td) return;
  editing = true;
  const input = el('input', { class: 'editor', type: 'text', value: cell.display });
  td.textContent = '';
  td.append(input);
  input.focus();
  input.select();
  let settled = false;
  const finish = (commit) => {
    if (settled) return;
    settled = true;
    editing = false;
    if (commit && input.value !== cell.display) {
      vscodeApi.postMessage({
        type: 'patch',
        start: cell.start,
        end: cell.end,
        value: input.value,
        expected: cell.expected,
      });
      return;
    }
    render();
    flushPending();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function chosenChart() {
  const charts = model.charts || [];
  const table = currentTable();
  const tableId = table ? table.id : null;
  if (tableId !== followedTableId) {
    followedTableId = tableId;
    const match = chartsFor(table)[0];
    pickedChartId = match ? match.id : (charts[0] ? charts[0].id : null);
  }
  return charts.find((chart) => chart.id === pickedChartId) || charts[0] || null;
}

const CHART_TYPES = [
  ['bar', 'Bar'],
  ['column', 'Column'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['step', 'Step'],
  ['scatter', 'Scatter'],
  ['lollipop', 'Lollipop'],
  ['pie', 'Pie'],
  ['donut', 'Donut'],
  ['radar', 'Radar'],
];
const SLICE_COLORS = ['#3794ff', '#3fb950', '#e5a119', '#f14c4c', '#a371f7', '#39c5cf', '#d18616', '#73c991', '#db61a2', '#8b949e'];

function displayType(chart) {
  const chosen = chartTypes[chart.id];
  if (chosen) return chosen;
  return CHART_TYPES.some((item) => item[0] === chart.type) ? chart.type : 'bar';
}

function chartScale(chart) {
  const values = chart.bars.map((bar) => Math.abs(bar.value || 0));
  return Math.max(1, ...values, 0) * 1.25;
}

function renderCharts() {
  const charts = model.charts || [];
  if (!charts.length) return el('p', { class: 'muted', text: 'This file has no charts.' });
  const selected = chosenChart();
  const picker = el('select', {
    class: 'filter',
    'aria-label': 'Chart',
    onchange: (event) => { pickedChartId = event.target.value; render(); },
  });
  charts.forEach((chart) => {
    const option = el('option', { value: chart.id, text: chart.title });
    if (selected && chart.id === selected.id) option.selected = true;
    picker.append(option);
  });
  const currentType = selected ? displayType(selected) : 'bar';
  const types = el('div', { class: 'type-row', role: 'radiogroup', 'aria-label': 'Chart type' });
  CHART_TYPES.forEach((item) => {
    types.append(el('button', {
      type: 'button',
      class: item[0] === currentType ? 'on' : '',
      role: 'radio',
      'aria-checked': item[0] === currentType ? 'true' : 'false',
      onclick: () => {
        if (!selected) return;
        chartTypes[selected.id] = item[0];
        render();
      },
    }, item[1]));
  });
  return el('div', {}, [
    el('h2', { text: 'Chart type' }),
    types,
    el('div', { class: 'controls' }, [
      el('label', {}, ['Chart', picker]),
    ]),
    selected ? renderChart(selected, currentType) : null,
  ]);
}

function renderChart(chart, type) {
  if (chart.error) return el('p', { class: 'missing', text: chart.error });
  const scale = chartScale(chart);
  let plot;
  if (type === 'bar') plot = chart.bars.map((bar) => renderBar(bar, scale));
  else if (type === 'column') plot = [renderColumns(chart, scale)];
  else if (type === 'pie' || type === 'donut') plot = [renderPie(chart, type)];
  else if (type === 'radar') plot = [renderRadar(chart)];
  else plot = [renderSeries(chart, type, scale)];
  return el('section', {}, [
    el('h1', { text: chart.title }),
    el('p', { class: 'muted mono', text: chart.source + '.' + chart.y }),
    ...plot,
  ]);
}

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, String(attrs[key])));
  return node;
}

function seriesPoints(chart, scale, width, height, pad) {
  const count = chart.bars.length;
  const step = count <= 1 ? 0 : (width - pad * 2) / (count - 1);
  return chart.bars.map((bar, index) => ({
    x: pad + index * step,
    y: height - pad - (Math.max(0, bar.value || 0) / scale) * (height - pad * 2),
    bar,
  }));
}

function polylinePoints(points, stepped) {
  if (!points.length) return '';
  if (!stepped) return points.map((point) => point.x + ',' + point.y).join(' ');
  const parts = [points[0].x + ',' + points[0].y];
  for (let index = 1; index < points.length; index += 1) {
    parts.push(points[index].x + ',' + points[index - 1].y);
    parts.push(points[index].x + ',' + points[index].y);
  }
  return parts.join(' ');
}

function renderSeries(chart, type, scale) {
  const width = 640;
  const height = 220;
  const pad = 24;
  const points = seriesPoints(chart, scale, width, height, pad);
  const stepped = type === 'step';
  const line = polylinePoints(points, stepped);
  const baseline = height - pad;
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, class: 'series', role: 'img', 'aria-label': chart.title });
  if (type === 'area' && points.length) {
    const area = points[0].x + ',' + baseline + ' ' + line + ' ' + points[points.length - 1].x + ',' + baseline;
    svg.append(svgEl('polygon', { points: area, class: 'area' }));
  }
  if (type === 'lollipop') {
    points.forEach((point) => {
      svg.append(svgEl('line', { x1: point.x, y1: baseline, x2: point.x, y2: point.y, class: 'stem' }));
    });
  }
  if ((type === 'line' || type === 'area' || type === 'step') && line) {
    svg.append(svgEl('polyline', { points: line, class: 'line' }));
  }
  points.forEach((point) => {
    const dot = svgEl('circle', {
      cx: point.x,
      cy: point.y,
      r: point.bar.editable ? 5 : 3.5,
      class: point.bar.editable ? 'dot edit' : 'dot',
    });
    if (point.bar.editable) bindPointDrag(svg, dot, point.bar, scale, height, pad);
    svg.append(dot);
  });
  return el('div', {}, [
    svg,
    el('div', { class: 'ticks' }, points.map((point) => el('span', { text: point.bar.label }))),
  ]);
}

function renderColumns(chart, scale) {
  return el('div', { class: 'columns' }, chart.bars.map((bar) => {
    const height = bar.value == null ? 0 : Math.max(0, Math.min(100, (Math.max(0, bar.value) / scale) * 100));
    const track = el('div', { class: bar.editable ? 'col-track edit' : 'col-track' });
    const fill = el('div', { class: 'col-fill' });
    fill.style.height = height + '%';
    track.append(fill);
    const value = el('span', { class: 'col-value', text: bar.value == null ? '—' : String(bar.value) });
    if (bar.editable) bindColumnDrag(track, fill, value, bar, scale);
    return el('div', { class: 'column' }, [
      value,
      track,
      el('span', { class: 'col-label', text: bar.label }),
    ]);
  }));
}

function bindColumnDrag(track, fill, valueNode, bar, scale) {
  track.addEventListener('pointerdown', (event) => {
    if (editing) return;
    event.preventDefault();
    try { track.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let shown = bar.value;
    const move = (pointer) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.height <= 0 ? 0 : Math.min(1, Math.max(0, 1 - (pointer.clientY - rect.top) / rect.height));
      const factor = 10 ** (bar.decimals || 0);
      shown = Math.round(ratio * scale * factor) / factor;
      fill.style.height = Math.max(0, Math.min(100, (shown / scale) * 100)) + '%';
      valueNode.textContent = String(shown);
    };
    const stop = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', stop);
      postPatch(bar, shown);
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', stop);
    move(event);
  });
}

function renderPie(chart, type) {
  const width = 320;
  const height = 320;
  const cx = 160;
  const cy = 150;
  const outer = 110;
  const inner = type === 'donut' ? 62 : 0;
  const parts = chart.bars.map((bar) => Math.max(0, bar.value || 0));
  const total = parts.reduce((sum, value) => sum + value, 0);
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, class: 'series square', role: 'img', 'aria-label': chart.title });
  if (total <= 0) {
    return el('p', { class: 'muted', text: 'This chart needs a positive value before a pie can be drawn.' });
  }
  let angle = -Math.PI / 2;
  chart.bars.forEach((bar, index) => {
    const sweep = (parts[index] / total) * Math.PI * 2;
    if (sweep <= 0) return;
    const end = angle + Math.min(sweep, Math.PI * 2 - 0.0001);
    const path = svgEl('path', {
      d: slicePath(cx, cy, outer, inner, angle, end),
      fill: SLICE_COLORS[index % SLICE_COLORS.length],
    });
    svg.append(path);
    angle += sweep;
  });
  return el('div', {}, [svg, legend(chart)]);
}

function slicePath(cx, cy, outer, inner, start, end) {
  const large = end - start > Math.PI ? 1 : 0;
  const ox0 = cx + outer * Math.cos(start);
  const oy0 = cy + outer * Math.sin(start);
  const ox1 = cx + outer * Math.cos(end);
  const oy1 = cy + outer * Math.sin(end);
  if (inner <= 0) {
    return 'M ' + cx + ' ' + cy + ' L ' + ox0 + ' ' + oy0 + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + ox1 + ' ' + oy1 + ' Z';
  }
  const ix0 = cx + inner * Math.cos(start);
  const iy0 = cy + inner * Math.sin(start);
  const ix1 = cx + inner * Math.cos(end);
  const iy1 = cy + inner * Math.sin(end);
  return 'M ' + ox0 + ' ' + oy0
    + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + ox1 + ' ' + oy1
    + ' L ' + ix1 + ' ' + iy1
    + ' A ' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + ix0 + ' ' + iy0
    + ' Z';
}

function renderRadar(chart) {
  const size = 320;
  const cx = 160;
  const cy = 150;
  const radius = 108;
  const count = chart.bars.length;
  const scale = Math.max(1, ...chart.bars.map((bar) => Math.max(0, bar.value || 0)));
  const svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'series square', role: 'img', 'aria-label': chart.title });
  if (!count) return el('p', { class: 'muted', text: 'This chart has no points.' });
  [0.25, 0.5, 0.75, 1].forEach((ring) => {
    const ringPoints = chart.bars.map((_, index) => {
      const at = polar(cx, cy, radius * ring, index, count);
      return at.x + ',' + at.y;
    }).join(' ');
    svg.append(svgEl('polygon', { points: ringPoints, class: 'grid' }));
  });
  const dots = chart.bars.map((bar, index) => {
    const ratio = Math.max(0, bar.value || 0) / scale;
    const at = polar(cx, cy, radius * ratio, index, count);
    const edge = polar(cx, cy, radius, index, count);
    svg.append(svgEl('line', { x1: cx, y1: cy, x2: edge.x, y2: edge.y, class: 'grid' }));
    const label = svgEl('text', { x: edge.x, y: edge.y, fill: 'currentColor', 'font-size': 11, 'text-anchor': 'middle' });
    label.textContent = bar.label;
    svg.append(label);
    return { bar, at, index };
  });
  svg.append(svgEl('polygon', {
    points: dots.map((dot) => dot.at.x + ',' + dot.at.y).join(' '),
    class: 'area',
  }));
  svg.append(svgEl('polygon', {
    points: dots.map((dot) => dot.at.x + ',' + dot.at.y).join(' '),
    class: 'line',
  }));
  dots.forEach((dot) => {
    const mark = svgEl('circle', {
      cx: dot.at.x,
      cy: dot.at.y,
      r: dot.bar.editable ? 5 : 3.5,
      class: dot.bar.editable ? 'dot edit' : 'dot',
    });
    if (dot.bar.editable) bindRadarDrag(svg, mark, dot.bar, scale, cx, cy, radius, dot.index, count);
    svg.append(mark);
  });
  return el('div', {}, [svg, legend(chart)]);
}

function polar(cx, cy, radius, index, count) {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle };
}

function bindRadarDrag(svg, mark, bar, scale, cx, cy, radius, index, count) {
  const spoke = polar(0, 0, 1, index, count);
  mark.addEventListener('pointerdown', (event) => {
    if (editing) return;
    event.preventDefault();
    try { mark.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let shown = bar.value;
    const move = (pointer) => {
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      const px = ((pointer.clientX - rect.left) / rect.width) * box.width;
      const py = ((pointer.clientY - rect.top) / rect.height) * box.height;
      const projection = (px - cx) * spoke.x + (py - cy) * spoke.y;
      const ratio = Math.min(1, Math.max(0, projection / radius));
      const factor = 10 ** (bar.decimals || 0);
      shown = Math.round(ratio * scale * factor) / factor;
      const at = polar(cx, cy, radius * ratio, index, count);
      mark.setAttribute('cx', String(at.x));
      mark.setAttribute('cy', String(at.y));
    };
    const stop = () => {
      mark.removeEventListener('pointermove', move);
      mark.removeEventListener('pointerup', stop);
      postPatch(bar, shown);
    };
    mark.addEventListener('pointermove', move);
    mark.addEventListener('pointerup', stop);
    move(event);
  });
}

function legend(chart) {
  return el('div', { class: 'legend' }, chart.bars.map((bar, index) => el('span', {}, [
    el('span', { class: 'swatch', style: 'background:' + SLICE_COLORS[index % SLICE_COLORS.length] }),
    bar.label + ' ' + (bar.value == null ? '—' : bar.value),
  ])));
}

function postPatch(bar, shown) {
  if (String(shown) !== String(bar.expected) && String(shown) !== String(bar.value)) {
    vscodeApi.postMessage({
      type: 'patch',
      start: bar.start,
      end: bar.end,
      value: String(shown),
      expected: bar.expected,
    });
  }
}

function bindPointDrag(svg, dot, bar, scale, height, pad) {
  dot.addEventListener('pointerdown', (event) => {
    if (editing) return;
    event.preventDefault();
    try { dot.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let shown = bar.value;
    const move = (pointer) => {
      const rect = svg.getBoundingClientRect();
      const span = rect.height * ((height - pad * 2) / height);
      const top = rect.top + rect.height * (pad / height);
      const ratio = span <= 0 ? 0 : Math.min(1, Math.max(0, 1 - (pointer.clientY - top) / span));
      const factor = 10 ** (bar.decimals || 0);
      shown = Math.round(ratio * scale * factor) / factor;
      const cy = height - pad - (shown / scale) * (height - pad * 2);
      dot.setAttribute('cy', String(cy));
    };
    const stop = () => {
      dot.removeEventListener('pointermove', move);
      dot.removeEventListener('pointerup', stop);
      if (String(shown) !== String(bar.expected) && String(shown) !== String(bar.value)) {
        vscodeApi.postMessage({
          type: 'patch',
          start: bar.start,
          end: bar.end,
          value: String(shown),
          expected: bar.expected,
        });
      }
    };
    dot.addEventListener('pointermove', move);
    dot.addEventListener('pointerup', stop);
    move(event);
  });
}

function renderBar(bar, scale) {
  const width = bar.value == null ? 0 : Math.max(0, Math.min(100, (bar.value / scale) * 100));
  const track = el('div', { class: bar.editable ? 'track edit' : 'track computed' });
  const fill = el('div', { class: 'fill' });
  fill.style.width = width + '%';
  track.append(fill);
  const value = el('span', { class: 'bar-value', text: bar.value == null ? '—' : String(bar.value) });
  if (bar.editable) {
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', 'Drag ' + bar.label);
    bindDrag(track, fill, value, bar, scale);
  }
  return el('div', { class: 'bar-row' }, [
    el('span', { class: 'bar-label', text: bar.label }),
    track,
    value,
  ]);
}

function bindDrag(track, fill, valueNode, bar, scale) {
  track.addEventListener('pointerdown', (event) => {
    if (editing) return;
    event.preventDefault();
    try { track.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let shown = bar.value;
    const move = (pointer) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (pointer.clientX - rect.left) / rect.width));
      const factor = 10 ** (bar.decimals || 0);
      shown = Math.round(ratio * scale * factor) / factor;
      fill.style.width = Math.max(0, Math.min(100, (shown / scale) * 100)) + '%';
      valueNode.textContent = String(shown);
    };
    const stop = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', stop);
      if (String(shown) !== String(bar.expected) && String(shown) !== String(bar.value)) {
        vscodeApi.postMessage({
          type: 'patch',
          start: bar.start,
          end: bar.end,
          value: String(shown),
          expected: bar.expected,
        });
      }
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', stop);
    move(event);
  });
}

function applyModel(next, offset) {
  model = next;
  if (offset != null) cursor = offset;
  render();
}

function flushPending() {
  if (!pending || editing) return;
  const next = pending;
  pending = null;
  applyModel(next.model, next.cursor);
}

function onMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'state') {
    if (editing) pending = message;
    else applyModel(message.model, message.cursor);
  }
}

window.addEventListener('message', (event) => onMessage(event.data));
if (window.__MLS_BOOT__) applyModel(window.__MLS_BOOT__, 0);
vscodeApi.postMessage({ type: 'ready' });
