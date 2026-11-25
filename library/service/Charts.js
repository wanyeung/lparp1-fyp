(function () {
  const palette = ['#3794ff', '#3fb950', '#e5a119', '#f14c4c', '#a371f7', '#39c5cf', '#d18616', '#73c991', '#db61a2', '#8b949e'];
  const seriesTypes = ['line', 'area', 'step', 'scatter', 'lollipop'];
  const categoryTypes = ['bar', 'column', 'pie', 'donut', 'radar'];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value == null ? '' : value);
    return String(Math.round(value * 1e6) / 1e6);
  }

  function css(rules) {
    return ' data-css="' + escapeHtml(rules) + '"';
  }

  function defaultType(chart) {
    return chart.chart === 'Line' ? 'line' : chart.chart === 'Pie' ? 'pie' : 'bar';
  }

  function barsOf(chart) {
    const values = (chart.series[0] && chart.series[0].values) || [];
    return chart.labels.map(function (label, index) {
      const value = Number(values[index]);
      return { label: String(label), value: Number.isFinite(value) ? value : null };
    });
  }

  function seriesOf(chart) {
    return chart.series.map(function (entry) {
      const points = entry.values.map(function (value, index) {
        const x = Number(chart.labels[index]);
        return { x: Number.isFinite(x) ? x : index, y: Number(value) };
      }).filter(function (point) { return Number.isFinite(point.y); });
      return { name: entry.name, points: points };
    });
  }

  function chartRange(bars) {
    const values = bars.map(function (bar) { return bar.value; }).filter(function (value) { return value !== null; });
    if (!values.length) return null;
    let min = Math.min(0, Math.min.apply(null, values));
    let max = Math.max(0, Math.max.apply(null, values));
    if (min === max) { min -= 1; max += 1; }
    return { min: min, max: max, range: max - min, zero: (0 - min) / (max - min) };
  }

  function renderCategoryChart(bars, type) {
    const range = chartRange(bars);
    if (!range || !bars.length) return '<div class="chart-empty">No chart data.</div>';
    if (type === 'pie' || type === 'donut') return renderPie(bars, type);
    if (type === 'radar') return renderRadar(bars);
    if (type === 'column') {
      return '<div class="columns">' + bars.map(function (bar) {
        const finite = bar.value !== null;
        const zero = range.zero * 100;
        const bottom = finite && bar.value >= 0 ? zero : zero + (finite ? bar.value / range.range : 0) * 100;
        const height = finite ? Math.abs(bar.value) / range.range * 100 : 0;
        return '<div class="column"><span class="col-value">' + (finite ? escapeHtml(formatNumber(bar.value)) : '—') + '</span>' +
          '<div class="col-track"><div class="col-zero"' + css('bottom:' + zero + '%') + '></div><div class="col-fill"' + css('bottom:' + bottom + '%;height:' + Math.max(0.6, height) + '%') + '></div></div>' +
          '<span class="col-label" title="' + escapeHtml(bar.label) + '">' + escapeHtml(bar.label) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="bar-rows">' + bars.map(function (bar) {
      const finite = bar.value !== null;
      const left = finite && bar.value >= 0 ? range.zero * 100 : range.zero * 100 + (finite ? bar.value / range.range : 0) * 100;
      const width = finite ? Math.abs(bar.value) / range.range * 100 : 0;
      return '<div class="bar-row"><span class="bar-label" title="' + escapeHtml(bar.label) + '">' + escapeHtml(bar.label) + '</span>' +
        '<div class="track"><div class="zero-line"' + css('left:' + range.zero * 100 + '%') + '></div><div class="fill"' + css('left:' + left + '%;width:' + Math.max(0.6, width) + '%') + '></div></div>' +
        '<span class="bar-value">' + (finite ? escapeHtml(formatNumber(bar.value)) : '—') + '</span></div>';
    }).join('') + '</div>';
  }

  function renderPie(bars, type) {
    const positive = bars.map(function (bar) { return Math.max(0, bar.value || 0); });
    const total = positive.reduce(function (sum, value) { return sum + value; }, 0);
    if (total <= 0) return '<div class="chart-empty">This pie needs a positive value.</div>';
    const cx = 95;
    const cy = 95;
    const outer = 82;
    const inner = type === 'donut' ? 46 : 0;
    let angle = -Math.PI / 2;
    const slices = bars.map(function (bar, index) {
      const sweep = positive[index] / total * Math.PI * 2;
      if (sweep <= 0) return '';
      const end = angle + Math.min(sweep, Math.PI * 2 - 0.0001);
      const path = slicePath(cx, cy, outer, inner, angle, end);
      angle += sweep;
      return '<path d="' + path + '" fill="' + palette[index % palette.length] + '"><title>' + escapeHtml(bar.label + ': ' + formatNumber(bar.value)) + '</title></path>';
    }).join('');
    const center = type === 'donut' ? '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="16" fill="currentColor">' + escapeHtml(formatNumber(total)) + '</text>' : '';
    return '<div class="pie-layout"><svg class="pie-svg" viewBox="0 0 190 190" role="img" aria-label="Pie chart">' + slices + center + '</svg>' + renderLegend(bars, [], false, true) + '</div>';
  }

  function slicePath(cx, cy, outer, inner, start, end) {
    const large = end - start > Math.PI ? 1 : 0;
    const ox0 = cx + outer * Math.cos(start);
    const oy0 = cy + outer * Math.sin(start);
    const ox1 = cx + outer * Math.cos(end);
    const oy1 = cy + outer * Math.sin(end);
    if (inner <= 0) return 'M ' + cx + ' ' + cy + ' L ' + ox0 + ' ' + oy0 + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + ox1 + ' ' + oy1 + ' Z';
    const ix0 = cx + inner * Math.cos(start);
    const iy0 = cy + inner * Math.sin(start);
    const ix1 = cx + inner * Math.cos(end);
    const iy1 = cy + inner * Math.sin(end);
    return 'M ' + ox0 + ' ' + oy0 + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + ox1 + ' ' + oy1 + ' L ' + ix1 + ' ' + iy1 + ' A ' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + ix0 + ' ' + iy0 + ' Z';
  }

  function polar(cx, cy, radius, index, count) {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function renderRadar(bars) {
    const count = bars.length;
    const cx = 160;
    const cy = 145;
    const radius = 106;
    const scale = Math.max(1, Math.max.apply(null, bars.map(function (bar) { return Math.max(0, bar.value || 0); })));
    const rings = [0.25, 0.5, 0.75, 1].map(function (ring) {
      const points = bars.map(function (_, index) { const at = polar(cx, cy, radius * ring, index, count); return at.x + ',' + at.y; }).join(' ');
      return '<polygon points="' + points + '" class="grid" fill="none" />';
    }).join('');
    const spokes = bars.map(function (_, index) {
      const edge = polar(cx, cy, radius, index, count);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + edge.x + '" y2="' + edge.y + '" class="grid" />';
    }).join('');
    const at = bars.map(function (bar, index) { return polar(cx, cy, radius * Math.max(0, bar.value || 0) / scale, index, count); });
    const dots = at.map(function (point, index) {
      return '<circle cx="' + point.x + '" cy="' + point.y + '" r="3.5" fill="' + palette[index % palette.length] + '" class="dot"><title>' + escapeHtml(bars[index].label + ': ' + formatNumber(bars[index].value)) + '</title></circle>';
    }).join('');
    const polygon = at.map(function (point) { return point.x + ',' + point.y; }).join(' ');
    const labels = bars.map(function (bar, index) {
      const edge = polar(cx, cy, radius + 14, index, count);
      return '<text x="' + edge.x + '" y="' + edge.y + '" text-anchor="middle">' + escapeHtml(bar.label) + '</text>';
    }).join('');
    return '<svg class="series-svg" viewBox="0 0 320 300" role="img" aria-label="Radar chart">' + rings + spokes +
      '<polygon points="' + polygon + '" fill="' + palette[0] + '" fill-opacity="0.18" stroke="' + palette[0] + '" stroke-width="2" />' + dots + labels + '</svg>';
  }

  function stepPoints(points) {
    if (!points.length) return [];
    const out = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
      out.push({ x: points[index].x, y: points[index - 1].y });
      out.push({ x: points[index].x, y: points[index].y });
    }
    return out;
  }

  function renderSeriesChart(series, type) {
    const all = series.flatMap(function (entry) { return entry.points; });
    if (!all.length) return '<div class="chart-empty">No chart data.</div>';
    const width = 640;
    const height = 250;
    const padLeft = 48;
    const padRight = 18;
    const padTop = 16;
    const padBottom = 30;
    let xmin = Math.min.apply(null, all.map(function (point) { return point.x; }));
    let xmax = Math.max.apply(null, all.map(function (point) { return point.x; }));
    let ymin = Math.min.apply(null, all.map(function (point) { return point.y; }));
    let ymax = Math.max.apply(null, all.map(function (point) { return point.y; }));
    if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
    if (ymin === ymax) { ymin -= 0.5; ymax += 0.5; }
    const xPad = (xmax - xmin) * 0.06;
    const yPad = (ymax - ymin) * 0.1;
    xmin -= xPad; xmax += xPad; ymin -= yPad; ymax += yPad;
    const px = function (value) { return padLeft + (value - xmin) / (xmax - xmin) * (width - padLeft - padRight); };
    const py = function (value) { return height - padBottom - (value - ymin) / (ymax - ymin) * (height - padTop - padBottom); };
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(function (fraction) {
      const x = padLeft + fraction * (width - padLeft - padRight);
      const y = height - padBottom - fraction * (height - padTop - padBottom);
      return '<line class="grid" x1="' + x + '" x2="' + x + '" y1="' + padTop + '" y2="' + (height - padBottom) + '" />' +
        '<line class="grid" x1="' + padLeft + '" x2="' + (width - padRight) + '" y1="' + y + '" y2="' + y + '" />' +
        '<text x="' + x + '" y="' + (height - 8) + '" text-anchor="middle">' + escapeHtml(formatNumber(xmin + fraction * (xmax - xmin))) + '</text>' +
        '<text x="' + (padLeft - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + escapeHtml(formatNumber(ymin + fraction * (ymax - ymin))) + '</text>';
    }).join('');
    const paths = series.map(function (entry, seriesIndex) {
      const color = palette[seriesIndex % palette.length];
      const points = entry.points.map(function (point) { return { x: px(point.x), y: py(point.y) }; });
      if (!points.length) return '';
      const draw = type === 'step' ? stepPoints(points) : points;
      const linePoints = draw.map(function (point) { return point.x + ',' + point.y; }).join(' ');
      let shape = '';
      if (type === 'line' || type === 'step') shape += '<polyline class="line" points="' + linePoints + '" stroke="' + color + '"><title>' + escapeHtml(entry.name) + '</title></polyline>';
      if (type === 'area') {
        const baseline = height - padBottom;
        shape += '<polygon class="area" points="' + points[0].x + ',' + baseline + ' ' + linePoints + ' ' + points[points.length - 1].x + ',' + baseline + '" fill="' + color + '"></polygon>';
        shape += '<polyline class="line" points="' + linePoints + '" stroke="' + color + '"></polyline>';
      }
      if (type === 'lollipop') {
        shape += points.map(function (point) { return '<line class="stem" x1="' + point.x + '" x2="' + point.x + '" y1="' + (height - padBottom) + '" y2="' + point.y + '" stroke="' + color + '"></line>'; }).join('');
      }
      const dots = points.map(function (point, index) {
        return '<circle class="dot" cx="' + point.x + '" cy="' + point.y + '" r="3.5" fill="' + color + '"><title>' + escapeHtml(entry.name + ' (' + formatNumber(entry.points[index].x) + ', ' + formatNumber(entry.points[index].y) + ')') + '</title></circle>';
      }).join('');
      return shape + dots;
    }).join('');
    return '<svg class="series-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Line chart">' + ticks + paths + '</svg>';
  }

  function renderLegend(bars, series, hasSeries, always) {
    if (hasSeries) {
      return '<div class="legend">' + series.map(function (entry, index) {
        return '<span class="legend-row"><span class="swatch"' + css('background:' + palette[index % palette.length]) + '></span>' + escapeHtml(entry.name) + ' · ' + entry.points.length + ' points</span>';
      }).join('') + '</div>';
    }
    if (!always) return '';
    return '<div class="legend">' + bars.map(function (bar, index) {
      return '<span class="legend-row"><span class="swatch"' + css('background:' + palette[index % palette.length]) + '></span>' + escapeHtml(bar.label) + ' <span class="legend-value">' + escapeHtml(formatNumber(bar.value)) + '</span></span>';
    }).join('') + '</div>';
  }

  function draw(chart, requested) {
    const hasSeries = chart.chart === 'Line';
    const types = hasSeries ? seriesTypes : categoryTypes;
    const type = types.indexOf(requested) < 0 ? defaultType(chart) : requested;
    const bars = hasSeries ? [] : barsOf(chart);
    const series = hasSeries ? seriesOf(chart) : [];
    const buttons = types.map(function (candidate) {
      return '<button type="button" data-type="' + candidate + '" class="' + (candidate === type ? 'on' : '') + '">' + candidate + '</button>';
    }).join('');
    const canvas = hasSeries ? renderSeriesChart(series, type) : renderCategoryChart(bars, type);
    const legend = hasSeries ? renderLegend(bars, series, true, false) : (type === 'pie' || type === 'donut' || type === 'radar' ? '' : renderLegend(bars, series, false, true));
    return '<div class="chart-content"><div class="chart-meta"><span class="source">From ' + escapeHtml(chart.source) + ' · ' + escapeHtml(chart.x) + '</span><div class="type-row">' + buttons + '</div></div>' + canvas + legend + '</div>';
  }

  function mount(root) {
    root.querySelectorAll('.chart[data-chart]').forEach(function (host) {
      const chart = JSON.parse(host.getAttribute('data-chart'));
      let type = defaultType(chart);
      const paint = function () {
        host.innerHTML = draw(chart, type);
        host.querySelectorAll('[data-css]').forEach(function (node) { node.style.cssText = node.getAttribute('data-css'); });
      };
      host.addEventListener('click', function (event) {
        const button = event.target.closest && event.target.closest('button[data-type]');
        if (button) { type = button.getAttribute('data-type'); paint(); }
      });
      paint();
    });
  }

  globalThis.MlsCharts = { draw: draw, mount: mount, defaultType: defaultType, seriesTypes: seriesTypes, categoryTypes: categoryTypes };
  if (typeof document !== 'undefined' && document.querySelectorAll) mount(document);
})();
