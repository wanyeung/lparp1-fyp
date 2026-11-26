export const state = { editing: false, post: (message) => console.log(message) };

const SLICE_COLORS = ['#3794ff', '#3fb950', '#e5a119', '#f14c4c', '#a371f7', '#39c5cf', '#d18616', '#73c991', '#db61a2', '#8b949e'];
const CATEGORY_TYPES = ['bar', 'column', 'pie', 'donut', 'radar'];
const SERIES_TYPES = ['line', 'area', 'step', 'scatter', 'lollipop'];
const TYPES = [...CATEGORY_TYPES, ...SERIES_TYPES];

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

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, String(attrs[key])));
  return node;
}

function svgText(x, y, anchor, text) {
  const node = svgEl('text', { x, y, 'text-anchor': anchor, 'font-size': 10, fill: 'currentColor' });
  node.textContent = text;
  return node;
}

function tooltip(text) {
  const node = svgEl('title', {});
  node.textContent = text;
  return node;
}

function shown(value) {
  return value == null ? '—' : String(value);
}

function rounded(value) {
  return String(Math.round(value * 100) / 100);
}

function chartScale(chart) {
  const values = chart.bars.map((bar) => Math.abs(bar.value || 0));
  return Math.max(1, ...values, 0) * 1.25;
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

function isNumber(label) {
  return String(label).trim() !== '' && Number.isFinite(Number(label));
}

function seriesFrame(chart) {
  const width = 640;
  const height = 250;
  const left = 48;
  const right = 18;
  const top = 16;
  const bottom = 30;
  const labels = chart.series[0].bars.map((bar) => bar.label);
  const numeric = labels.length > 0 && labels.every(isNumber);
  const xs = labels.map((label, index) => (numeric ? Number(label) : index));
  const values = chart.series.flatMap((entry) => entry.bars.map((bar) => bar.value)).filter((value) => value != null);
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const ymax = high > 0 ? high * 1.25 : 1;
  const ymin = low < 0 ? low * 1.25 : 0;
  let xmin = Math.min(...xs);
  let xmax = Math.max(...xs);
  if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
  return {
    width, height, left, right, top, bottom, labels, numeric, xs, xmin, xmax, ymin, ymax,
    px: (x) => left + ((x - xmin) / (xmax - xmin)) * (width - left - right),
    py: (y) => height - bottom - ((y - ymin) / (ymax - ymin)) * (height - top - bottom),
  };
}

function seriesGrid(svg, frame) {
  [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
    const value = frame.ymin + fraction * (frame.ymax - frame.ymin);
    const y = frame.py(value);
    svg.append(svgEl('line', { x1: frame.left, y1: y, x2: frame.width - frame.right, y2: y, class: 'grid' }));
    svg.append(svgText(frame.left - 6, y + 3, 'end', rounded(value)));
  });
  svg.append(svgEl('line', { x1: frame.left, y1: frame.py(0), x2: frame.width - frame.right, y2: frame.py(0), class: 'zero' }));
  if (frame.numeric) {
    [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
      const value = frame.xmin + fraction * (frame.xmax - frame.xmin);
      svg.append(svgText(frame.px(value), frame.height - 8, 'middle', rounded(value)));
    });
  } else {
    frame.labels.forEach((label, index) => svg.append(svgText(frame.px(frame.xs[index]), frame.height - 8, 'middle', String(label))));
  }
}

function renderSeries(chart, type) {
  const frame = seriesFrame(chart);
  const svg = svgEl('svg', { viewBox: '0 0 ' + frame.width + ' ' + frame.height, class: 'series', role: 'img', 'aria-label': chart.title });
  seriesGrid(svg, frame);
  const baseline = frame.py(0);
  chart.series.forEach((entry, order) => {
    const color = SLICE_COLORS[order % SLICE_COLORS.length];
    const points = entry.bars
      .map((bar, index) => ({ bar, x: frame.px(frame.xs[index]), y: bar.value == null ? null : frame.py(bar.value) }))
      .filter((point) => point.y !== null);
    const line = polylinePoints(points, type === 'step');
    if (type === 'area' && points.length) {
      const area = points[0].x + ',' + baseline + ' ' + line + ' ' + points[points.length - 1].x + ',' + baseline;
      svg.append(svgEl('polygon', { points: area, class: 'area', fill: color }));
    }
    if (type === 'lollipop') {
      points.forEach((point) => {
        svg.append(svgEl('line', { x1: point.x, y1: baseline, x2: point.x, y2: point.y, class: 'stem', stroke: color }));
      });
    }
    if ((type === 'line' || type === 'area' || type === 'step') && line) {
      svg.append(svgEl('polyline', { points: line, class: 'line', stroke: color }));
    }
    points.forEach((point) => {
      const dot = svgEl('circle', {
        cx: point.x,
        cy: point.y,
        r: point.bar.editable ? 5 : 3.5,
        class: point.bar.editable ? 'dot edit' : 'dot',
        fill: color,
      });
      if (point.bar.editable) bindPointDrag(svg, dot, point.bar, frame);
      dot.append(tooltip(entry.name + ' · ' + point.bar.label + ': ' + point.bar.value));
      svg.append(dot);
    });
  });
  return el('div', {}, [svg, seriesLegend(chart)]);
}

function seriesLegend(chart) {
  return el('div', { class: 'legend' }, chart.series.map((entry, index) => el('span', {}, [swatch(index), entry.name])));
}

function bindPointDrag(svg, dot, bar, frame) {
  dot.addEventListener('pointerdown', (event) => {
    if (state.editing) return;
    event.preventDefault();
    try { dot.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let value = bar.value;
    const move = (pointer) => {
      const rect = svg.getBoundingClientRect();
      const y = rect.height <= 0 ? frame.py(bar.value) : ((pointer.clientY - rect.top) / rect.height) * frame.height;
      const ratio = Math.min(1, Math.max(0, (frame.height - frame.bottom - y) / (frame.height - frame.top - frame.bottom)));
      const factor = 10 ** (bar.decimals || 0);
      value = Math.round((frame.ymin + ratio * (frame.ymax - frame.ymin)) * factor) / factor;
      dot.setAttribute('cy', String(frame.py(value)));
    };
    const stop = () => {
      dot.removeEventListener('pointermove', move);
      dot.removeEventListener('pointerup', stop);
      postPatch(bar, value);
    };
    dot.addEventListener('pointermove', move);
    dot.addEventListener('pointerup', stop);
    move(event);
  });
}

function renderColumns(chart, scale) {
  return el('div', { class: 'columns' }, chart.bars.map((bar) => {
    const height = bar.value == null ? 0 : Math.max(0, Math.min(100, (Math.max(0, bar.value) / scale) * 100));
    const track = el('div', { class: bar.editable ? 'col-track edit' : 'col-track' });
    const fill = el('div', { class: 'col-fill' });
    fill.style.height = height + '%';
    track.append(fill);
    const value = el('span', { class: 'col-value', text: shown(bar.value) });
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
    if (state.editing) return;
    event.preventDefault();
    try { track.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let value = bar.value;
    const move = (pointer) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.height <= 0 ? 0 : Math.min(1, Math.max(0, 1 - (pointer.clientY - rect.top) / rect.height));
      const factor = 10 ** (bar.decimals || 0);
      value = Math.round(ratio * scale * factor) / factor;
      fill.style.height = Math.max(0, Math.min(100, (value / scale) * 100)) + '%';
      valueNode.textContent = String(value);
    };
    const stop = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', stop);
      postPatch(bar, value);
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
    path.append(tooltip(bar.label + ': ' + shown(bar.value)));
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
    svg.append(svgText(edge.x, edge.y, 'middle', bar.label));
    return { bar, at, index };
  });
  const outline = dots.map((dot) => dot.at.x + ',' + dot.at.y).join(' ');
  svg.append(svgEl('polygon', { points: outline, class: 'area', fill: SLICE_COLORS[0] }));
  svg.append(svgEl('polygon', { points: outline, class: 'line', stroke: SLICE_COLORS[0] }));
  dots.forEach((dot) => {
    const mark = svgEl('circle', {
      cx: dot.at.x,
      cy: dot.at.y,
      r: dot.bar.editable ? 5 : 3.5,
      class: dot.bar.editable ? 'dot edit' : 'dot',
      fill: SLICE_COLORS[0],
    });
    if (dot.bar.editable) bindRadarDrag(svg, mark, dot.bar, scale, cx, cy, radius, dot.index, count);
    mark.append(tooltip(dot.bar.label + ': ' + shown(dot.bar.value)));
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
    if (state.editing) return;
    event.preventDefault();
    try { mark.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let value = bar.value;
    const move = (pointer) => {
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      const px = ((pointer.clientX - rect.left) / rect.width) * box.width;
      const py = ((pointer.clientY - rect.top) / rect.height) * box.height;
      const projection = (px - cx) * spoke.x + (py - cy) * spoke.y;
      const ratio = Math.min(1, Math.max(0, projection / radius));
      const factor = 10 ** (bar.decimals || 0);
      value = Math.round(ratio * scale * factor) / factor;
      const at = polar(cx, cy, radius * ratio, index, count);
      mark.setAttribute('cx', String(at.x));
      mark.setAttribute('cy', String(at.y));
    };
    const stop = () => {
      mark.removeEventListener('pointermove', move);
      mark.removeEventListener('pointerup', stop);
      postPatch(bar, value);
    };
    mark.addEventListener('pointermove', move);
    mark.addEventListener('pointerup', stop);
    move(event);
  });
}

function swatch(index) {
  const node = el('span', { class: 'swatch' });
  node.style.background = SLICE_COLORS[index % SLICE_COLORS.length];
  return node;
}

function legend(chart) {
  return el('div', { class: 'legend' }, chart.bars.map((bar, index) => el('span', {}, [
    swatch(index),
    bar.label + ' ' + shown(bar.value),
  ])));
}

function postPatch(bar, value) {
  if (String(value) !== String(bar.expected) && String(value) !== String(bar.value)) {
    state.post({
      type: 'patch',
      path: bar.path,
      start: bar.start,
      end: bar.end,
      value: String(value),
      expected: bar.expected,
    });
  }
}

function renderBar(bar, scale) {
  const width = bar.value == null ? 0 : Math.max(0, Math.min(100, (bar.value / scale) * 100));
  const track = el('div', { class: bar.editable ? 'track edit' : 'track computed' });
  const fill = el('div', { class: 'fill' });
  fill.style.width = width + '%';
  track.append(fill);
  const value = el('span', { class: 'bar-value', text: shown(bar.value) });
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
    if (state.editing) return;
    event.preventDefault();
    try { track.setPointerCapture(event.pointerId); } catch (error) { /* the pointer can still move */ }
    let value = bar.value;
    const move = (pointer) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (pointer.clientX - rect.left) / rect.width));
      const factor = 10 ** (bar.decimals || 0);
      value = Math.round(ratio * scale * factor) / factor;
      fill.style.width = Math.max(0, Math.min(100, (value / scale) * 100)) + '%';
      valueNode.textContent = String(value);
    };
    const stop = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', stop);
      postPatch(bar, value);
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', stop);
    move(event);
  });
}

function renderCategory(chart, type) {
  const scale = chartScale(chart);
  let plot;
  if (type === 'column') plot = [renderColumns(chart, scale)];
  else if (type === 'pie' || type === 'donut') plot = [renderPie(chart, type)];
  else if (type === 'radar') plot = [renderRadar(chart)];
  else plot = chart.bars.map((bar) => renderBar(bar, scale));
  return el('div', {}, [el('h1', { text: chart.title }), ...plot]);
}

function renderChart(chart, type) {
  if (chart.error) return el('p', { class: 'missing', text: chart.error });
  const series = chart.series.filter((entry) => entry.bars.length);
  if (!series.length) return el('p', { class: 'muted', text: 'No chart data.' });
  const plot = SERIES_TYPES.includes(type)
    ? [renderSeries({ ...chart, series }, type)]
    : series.map((entry) => renderCategory({ title: entry.name, bars: entry.bars }, type));
  return el('section', {}, [
    el('p', { class: 'muted mono', text: chart.source + ' · ' + series.map((entry) => entry.name).join(', ') }),
    ...plot,
  ]);
}

function initialType(name) {
  const type = String(name).toLowerCase();
  return TYPES.includes(type) ? type : 'bar';
}

function decimalsOf(values) {
  return Math.max(0, ...values.map((value) => (String(value).split('.')[1] || '').length));
}

function barsOf(series, labels) {
  const decimals = decimalsOf(series.values);
  return labels.map((label, index) => {
    const value = Number(series.values[index]);
    const finite = series.values[index] !== null && Number.isFinite(value);
    return {
      label: String(label),
      value: finite ? value : null,
      expected: finite ? value : null,
      editable: finite && Array.isArray(series.paths[index]),
      path: series.paths[index],
      decimals,
    };
  });
}

function toEdit(message) {
  return { type: 'edit', path: message.path, kind: 'atom', header: false, row: 0, col: 0, text: message.value };
}

function mountChart(host, node) {
  const model = {
    title: node.title,
    source: node.source,
    series: node.series.map((series) => ({ name: series.name, bars: barsOf(series, node.labels) })),
  };
  let type = initialType(node.chart);
  const draw = () => {
    const buttons = TYPES.map((name) => el('button', {
      type: 'button',
      class: name === type ? 'on' : '',
      text: name,
      onclick: () => { type = name; draw(); },
    }));
    host.replaceChildren(el('div', { class: 'type-row' }, buttons), renderChart(model, type));
  };
  draw();
}

function mount(root) {
  root.querySelectorAll('.chart[data-chart]').forEach((host) => mountChart(host, JSON.parse(host.getAttribute('data-chart'))));
}

if (typeof document !== 'undefined' && document.querySelectorAll) {
  state.post = (message) => api.postMessage(toEdit(message));
  mount(document);
}

export { svgEl, chartScale, polylinePoints, seriesFrame, renderSeries, renderColumns, bindColumnDrag, renderPie, slicePath, renderRadar, polar, bindRadarDrag, legend, postPatch, bindPointDrag, renderBar, bindDrag, renderChart, initialType, barsOf, toEdit, mount, TYPES };
