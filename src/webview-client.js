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
  return el('div', {}, [picker, selected ? renderChart(selected) : null]);
}

function renderChart(chart) {
  if (chart.error) return el('p', { class: 'missing', text: chart.error });
  const values = chart.bars.map((bar) => bar.value).filter((value) => value != null && value > 0);
  const scale = Math.max(1, ...values, 0) * 1.25;
  return el('section', {}, [
    el('h1', { text: chart.title }),
    el('p', { class: 'muted mono', text: chart.source + '.' + chart.y }),
    ...chart.bars.map((bar) => renderBar(bar, scale)),
  ]);
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
