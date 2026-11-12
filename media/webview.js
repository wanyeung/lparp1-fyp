(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const app = document.getElementById('app');
  const DEFAULT_STATE = {
    fileName: '',
    entryFile: '',
    files: [],
    model: { items: [], order: [], groups: [] },
    provenance: null,
    libraryMode: false,
    livePreview: false,
    buildError: null,
    stale: true,
    dirtyFiles: [],
    status: '',
    diagnostics: [],
    trusted: true,
  };
  let state = Object.assign({}, DEFAULT_STATE);
  let selectedFile = null;
  let sourceTimer = null;
  let editing = null;
  let draggingBar = false;
  let pendingState = null;
  let draggedId = null;
  const sorts = {};
  const filters = {};
  const chartViews = {};
  const palette = ['#3794ff', '#3fb950', '#e5a119', '#f14c4c', '#a371f7', '#39c5cf', '#d18616', '#73c991', '#db61a2', '#8b949e'];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value == null ? '' : value);
    return String(Math.round(value * 1e6) / 1e6);
  }

  function formatCell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return formatNumber(value);
    return String(value);
  }

  function trimQuotes(text) {
    const value = String(text == null ? '' : text).trim();
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      try { return JSON.parse(value); } catch (error) { return value.slice(1, -1); }
    }
    return value;
  }

  function fileByPath(file) {
    return state.files.find(function (candidate) { return candidate.path === file; }) || null;
  }

  function fileLabel(file) {
    const found = fileByPath(file);
    return found ? found.label : String(file || '').split(/[\\/]/).pop();
  }

  function sourceFor(file) {
    const found = fileByPath(file);
    return found ? found.source : '';
  }

  function currentTextarea() {
    return app.querySelector('#source');
  }

  function currentSource() {
    const textarea = currentTextarea();
    if (textarea && selectedFile) return textarea.value;
    return sourceFor(selectedFile);
  }

  function entrySource() {
    const textarea = currentTextarea();
    if (textarea && selectedFile === state.entryFile) return textarea.value;
    return sourceFor(state.entryFile);
  }

  function flushSourceEdit(expectedSource) {
    const textarea = currentTextarea();
    if (!textarea || !selectedFile || !sourceTimer) return;
    const value = textarea.value;
    clearTimeout(sourceTimer);
    sourceTimer = null;
    if (typeof expectedSource === 'string' && value === expectedSource) return;
    post({ type: state.livePreview ? 'saveSource' : 'updateSource', file: selectedFile, source: value });
  }

  function post(message) {
    vscode.postMessage(message);
  }

  function lineOf(source, offset) {
    return String(source || '').slice(0, Math.max(0, offset)).split('\n').length;
  }

  function sameFiles(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index].path !== right[index].path || left[index].source !== right[index].source || left[index].isEntry !== right[index].isEntry) return false;
    }
    return true;
  }

  function sameExceptSelectedSource(left, right, selected) {
    if (!left || !right || left.length !== right.length) return false;
    const textarea = currentTextarea();
    if (!textarea) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index].path !== right[index].path || left[index].isEntry !== right[index].isEntry) return false;
      if (right[index].path === selected) {
        if (right[index].source !== textarea.value) return false;
      } else if (left[index].source !== right[index].source) return false;
    }
    return true;
  }

  function orderedItems() {
    const items = (state.model && state.model.items) || [];
    const byId = new Map(items.map(function (item) { return [item.id, item]; }));
    const order = (state.model && state.model.order && state.model.order.length)
      ? state.model.order
      : items.map(function (item) { return item.id; });
    return order.map(function (id) { return byId.get(id); }).filter(Boolean);
  }

  function tableById(id) {
    return ((state.model && state.model.items) || []).find(function (item) { return item.id === id && item.kind === 'table'; });
  }

  function provenanceTable(id) {
    return state.provenance && state.provenance.tables ? state.provenance.tables[id] : null;
  }

  function provenanceChart(id) {
    return state.provenance && state.provenance.charts ? state.provenance.charts[id] : null;
  }

  function canEdit() {
    return state.libraryMode && !state.stale && state.trusted;
  }

  function reveal(file, start, end) {
    if (!file) return;
    if (!fileByPath(file)) {
      post({ type: 'revealExternal', file: file, start: start, end: end });
      return;
    }
    flushSourceEdit();
    selectedFile = file;
    renderSourcePane();
    const textarea = currentTextarea();
    if (!textarea) return;
    const safeStart = Math.max(0, Math.min(Number(start) || 0, textarea.value.length));
    const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, textarea.value.length));
    textarea.focus();
    textarea.setSelectionRange(safeStart, safeEnd);
    const line = lineOf(textarea.value, safeStart);
    textarea.scrollTop = Math.max(0, (line - 4) * 18);
    textarea.classList.add('flash');
    setTimeout(function () { textarea.classList.remove('flash'); }, 1000);
  }

  function renderWorkspace() {
    const active = document.activeElement;
    const wasSource = active && active.id === 'source';
    const selectionStart = wasSource ? active.selectionStart : 0;
    const selectionEnd = wasSource ? active.selectionEnd : 0;
    const scrollTop = wasSource ? active.scrollTop : 0;
    const documentPane = app.querySelector('.document-pane');
    const documentScroll = documentPane ? documentPane.scrollTop : 0;
    app.innerHTML = '<div class="workspace"><section class="source-pane"></section><section class="document-pane"></section></div>';
    renderSourcePane();
    renderDocument();
    const nextDocument = app.querySelector('.document-pane');
    if (nextDocument) nextDocument.scrollTop = documentScroll;
    if (wasSource) {
      const next = currentTextarea();
      if (next) {
        next.focus();
        next.setSelectionRange(selectionStart, selectionEnd);
        next.scrollTop = scrollTop;
        syncGutter();
      }
    }
  }

  function renderSourcePane() {
    if (!selectedFile || !fileByPath(selectedFile)) selectedFile = state.entryFile || (state.files[0] && state.files[0].path) || null;
    const pane = app.querySelector('.source-pane');
    if (!pane) return;
    const selected = fileByPath(selectedFile);
    const dirty = state.dirtyFiles.indexOf(selectedFile) >= 0;
    const options = state.files.map(function (file) {
      return '<option value="' + escapeHtml(file.path) + '"' + (file.path === selectedFile ? ' selected' : '') + '>' + escapeHtml(file.label) + (file.isEntry ? ' (entry)' : '') + '</option>';
    }).join('');
    pane.innerHTML =
      '<div class="pane-header"><div class="source-tools"><span class="pane-title">' + escapeHtml(state.fileName || 'source.mls') + '</span>' +
      '<select id="file-select" aria-label="Source module" title="Entry file and imported MLscript modules">' + options + '</select></div>' +
      '<span class="source-status">' + (dirty ? 'Unsaved' : 'Saved') + ' · ' + escapeHtml(selected ? selected.label : '') + '</span></div>' +
      '<div class="source-body"><pre class="line-gutter" id="gutter" aria-hidden="true"></pre><textarea id="source" wrap="off" spellcheck="false" autocomplete="off" aria-label="MLscript source"></textarea></div>';
    const textarea = currentTextarea();
    const select = pane.querySelector('#file-select');
    if (textarea) {
      textarea.value = selected ? selected.source : '';
      updateGutter();
      textarea.addEventListener('input', function () {
        updateGutter();
        clearTimeout(sourceTimer);
        const file = selectedFile;
        sourceTimer = setTimeout(function () {
          sourceTimer = null;
          post({ type: state.livePreview ? 'saveSource' : 'updateSource', file: file, source: textarea.value });
        }, 450);
      });
      textarea.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          clearTimeout(sourceTimer);
          sourceTimer = null;
          post({ type: 'saveSource', file: selectedFile, source: textarea.value });
        }
      });
      textarea.addEventListener('scroll', syncGutter);
    }
    if (select) {
      select.addEventListener('change', function (event) {
        flushSourceEdit();
        clearTimeout(sourceTimer);
        sourceTimer = null;
        selectedFile = event.target.value;
        vscode.setState({ selectedFile: selectedFile });
        renderSourcePane();
      });
    }
  }

  function updateGutter() {
    const textarea = currentTextarea();
    const gutter = app.querySelector('#gutter');
    if (!textarea || !gutter) return;
    const lines = textarea.value.split('\n').length;
    let text = '';
    for (let index = 1; index <= lines; index += 1) text += index + '\n';
    gutter.textContent = text;
    syncGutter();
  }

  function syncGutter() {
    const textarea = currentTextarea();
    const gutter = app.querySelector('#gutter');
    if (textarea && gutter) gutter.scrollTop = textarea.scrollTop;
  }

  function renderDocument(options) {
    const settings = options || {};
    const pane = app.querySelector('.document-pane');
    if (!pane) return;
    const scrollTop = pane.scrollTop;
    const items = orderedItems();
    let lastGroup = null;
    const artifacts = items.length ? items.map(function (item) {
      let heading = '';
      if (item.groupId && item.groupId !== lastGroup) {
        const group = ((state.model && state.model.groups) || []).find(function (candidate) { return candidate.id === item.groupId; });
        heading = '<h2 class="group-heading">' + escapeHtml(group ? group.name : item.groupId) + '</h2>';
        lastGroup = item.groupId;
      }
      return heading + renderArtifact(item);
    }).join('') : '<div class="empty">' + (state.libraryMode ? 'Select <strong>Build</strong> to compile the modules with hkmc2 and execute <code>Display</code>. Table values and chart bars are produced by your MLscript program.' : 'No document artifacts found. Add the Studio library and a <code>val document = Display(report)</code> export.') + '</div>';
    pane.innerHTML =
      '<div class="pane-header"><span class="pane-title">Document view</span><span class="pane-detail">' + items.length + ' artifact' + (items.length === 1 ? '' : 's') + ' · ' + (state.libraryMode ? 'hkmc2' : 'metadata') + '</span></div>' +
      '<div class="document-content">' +
      '<div class="document-intro"><div><h1>' + escapeHtml(state.fileName || 'MLscript workspace') + '</h1>' +
      '<p>' + (state.libraryMode ? 'Executed by hkmc2 from <code>CreateCell</code>, <code>CreateGroup</code> and <code>Display</code>. Green values are source literals; grey values are computed.' : 'Legacy metadata preview read from <code>@table</code>/<code>@chart</code> comments. Values are read-only.') + '</p></div>' +
      '<div class="actions">' + (state.libraryMode ? '<button id="build" class="primary">Build</button>' : '') + '<button id="refresh">Refresh</button></div></div>' +
      renderBanners() +
      '<p class="status-line">' + escapeHtml(state.status || '') + '</p>' +
      '<div class="artifact-list">' + artifacts + '</div></div>';
    bindDocument();
    pane.scrollTop = scrollTop;
    if (settings.focus) {
      const target = pane.querySelector(settings.focus.selector);
      if (target) {
        target.focus();
        if (typeof settings.focus.start === 'number' && target.setSelectionRange) target.setSelectionRange(settings.focus.start, settings.focus.start);
      }
    }
  }

  function renderBanners() {
    let html = '';
    if (!state.trusted) html += '<div class="banner warn">This workspace is not trusted. Building and executing MLscript documents is disabled until you trust the workspace.</div>';
    if (!state.libraryMode) html += '<div class="banner info">Legacy <code>@table</code>/<code>@chart</code> metadata mode. Values are read-only. Add the Studio library and a <code>Display</code> export to enable bidirectional source editing.</div>';
    if (state.buildError) {
      const diagnostics = (state.diagnostics || []).slice(0, 12).map(function (diagnostic) {
        const line = diagnostic.start != null ? lineOf(sourceFor(diagnostic.file), diagnostic.start) : null;
        const where = diagnostic.label + (line ? ':' + line : '');
        return '<li><button class="link" data-diagnostic="' + escapeHtml(diagnostic.file) + '" data-start="' + escapeHtml(diagnostic.start == null ? '' : diagnostic.start) + '" data-end="' + escapeHtml(diagnostic.end == null ? '' : diagnostic.end) + '">' + escapeHtml(where) + '</button> ' + escapeHtml(diagnostic.message) + '</li>';
      }).join('');
      html += '<div class="banner error"><strong>Build failed.</strong> ' + escapeHtml(state.buildError) + (diagnostics ? '<ul>' + diagnostics + '</ul>' : '') + '</div>';
    } else if (state.stale) {
      html += '<div class="banner warn">' + (state.livePreview ? 'Source changed. A live rebuild follows saved edits.' : 'Source changed after the last build. Select <strong>Build</strong> before editing values.') + '</div>';
    }
    const warnings = (state.provenance && state.provenance.warnings) || [];
    if (warnings.length) {
      html += '<div class="banner info"><strong>Provenance notes.</strong><ul>' + warnings.slice(0, 5).map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul></div>';
    }
    return html;
  }

  function renderArtifact(item) {
    const count = item.kind === 'table' ? item.rows.length + ' rows' : item.kind === 'text' ? 'text' : (item.chartType || 'chart') + ' chart';
    let content = '';
    if (item.kind === 'table') content = renderTable(item);
    else if (item.kind === 'text') content = '<div class="text-content">' + escapeHtml(item.text) + '</div>';
    else content = renderChart(item);
    const handle = state.libraryMode && !state.stale && canEdit()
      ? '<span class="drag-handle" draggable="true" data-id="' + escapeHtml(item.id) + '" title="Drag to change document order">⠿</span>'
      : '<span class="drag-handle" title="Build a current document to reorder">⠿</span>';
    const derived = item.derived ? ' · derived' : '';
    return '<section class="artifact" data-id="' + escapeHtml(item.id) + '" data-group="' + escapeHtml(item.groupId || '') + '">' +
      '<div class="artifact-head"><div class="artifact-title">' + handle + '<strong>' + escapeHtml(item.name) + '</strong>' +
      '<span class="badge">' + escapeHtml(item.kind + derived) + '</span><span class="pane-detail">' + escapeHtml(count) + '</span></div></div>' +
      content + '</section>';
  }

  function renderTable(item) {
    const tableProv = provenanceTable(item.id);
    const rows = item.rows.map(function (row, rowIndex) {
      return {
        index: rowIndex,
        cells: row.map(function (value, columnIndex) {
          return { value: value, prov: tableProv && tableProv.rows ? tableProv.rows[rowIndex] && tableProv.rows[rowIndex][columnIndex] : null };
        }),
      };
    });
    const filter = String(filters[item.id] || '').trim().toLowerCase();
    let visible = rows.filter(function (row) {
      if (!filter) return true;
      return row.cells.some(function (cell) { return formatCell(cell.value).toLowerCase().indexOf(filter) >= 0; });
    });
    const sort = sorts[item.id];
    if (sort) {
      visible = visible.slice().sort(function (left, right) {
        const a = left.cells[sort.column];
        const b = right.cells[sort.column];
        if (!a || !b) return 0;
        let comparison;
        if (typeof a.value === 'number' && typeof b.value === 'number') comparison = a.value - b.value;
        else comparison = formatCell(a.value).localeCompare(formatCell(b.value));
        return sort.direction === 'desc' ? -comparison : comparison;
      });
    }
    const editableCount = tableProv && tableProv.rows ? tableProv.rows.reduce(function (total, row) {
      return total + row.filter(function (cell) { return cell && cell.editable; }).length;
    }, 0) : 0;
    const head = item.headers.map(function (header, index) {
      const mark = sort && sort.column === index ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
      return '<th><button class="sort" data-table="' + escapeHtml(item.id) + '" data-column="' + index + '">' + escapeHtml(header) + mark + '</button></th>';
    }).join('');
    const body = visible.length ? visible.map(function (row) {
      return '<tr>' + row.cells.map(function (cell, columnIndex) {
        return renderCell(item, row.index, columnIndex, cell);
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + Math.max(1, item.headers.length) + '" class="pane-detail">No rows match the filter.</td></tr>';
    const noteText = tableProv && (tableProv.reason || (tableProv.warnings && tableProv.warnings[0]));
    const note = noteText
      ? '<div class="banner warn" style="margin:8px 10px 0">' + escapeHtml(noteText) + '</div>'
      : '';
    return note +
      '<div class="table-tools"><input class="filter" data-table="' + escapeHtml(item.id) + '" type="search" placeholder="Filter rows" value="' + escapeHtml(filters[item.id] || '') + '" />' +
      '<span class="pane-detail">' + visible.length + ' of ' + rows.length + ' rows · ' + editableCount + ' editable literal' + (editableCount === 1 ? '' : 's') + '</span></div>' +
      '<div class="table-scroll"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function renderCell(item, rowIndex, columnIndex, cell) {
    const prov = cell.prov;
    const editable = Boolean(prov && prov.editable) && canEdit();
    const title = editable
      ? 'Editable source literal' + (prov.via ? ' via ' + prov.via : '') + ' · click to edit'
      : (prov && prov.reason ? prov.reason : (prov && prov.expr ? 'Computed: ' + prov.expr : 'Computed value'));
    const chips = !editable && prov && prov.refs ? prov.refs.slice(0, 3).map(function (ref) {
      return '<button class="chip" data-file="' + escapeHtml(ref.file) + '" data-start="' + escapeHtml(ref.start) + '" data-end="' + escapeHtml(ref.end) + '" title="Reveal ' + escapeHtml(ref.text) + ' in ' + escapeHtml(fileLabel(ref.file)) + '">' + escapeHtml(trimQuotes(ref.text)) + '</button>';
    }).join('') : '';
    const fx = state.libraryMode && !editable ? '<span class="fx">fx</span>' : '';
    const display = formatCell(cell.value);
    return '<td class="' + (editable ? 'editable' : 'computed') + '" data-table="' + escapeHtml(item.id) + '" data-row="' + rowIndex + '" data-column="' + columnIndex + '" title="' + escapeHtml(title) + '">' +
      '<span>' + (display === '' ? '&nbsp;' : escapeHtml(display)) + '</span>' + fx + chips + '</td>';
  }

  function legacyBars(item) {
    const table = tableById(item.sourceTableId);
    if (!table) return [];
    const xIndex = table.headers.indexOf(item.x);
    const yIndex = table.headers.indexOf(item.y);
    if (xIndex < 0 || yIndex < 0) return [];
    return table.rows.map(function (row, index) {
      const value = Number(String(row[yIndex] == null ? '' : row[yIndex]).replace(/[^0-9.eE+-]/g, ''));
      return { label: row[xIndex] == null ? '' : String(row[xIndex]), value: Number.isFinite(value) ? value : null, index: index, editable: false, refs: [] };
    });
  }

  function legacySeries(item) {
    return (item.series || []).map(function (series, seriesIndex) {
      return {
        name: series.name,
        y: series.name,
        points: (series.points || []).map(function (point, pointIndex) {
          return { x: point.x, y: point.y, pointIndex: pointIndex, seriesIndex: seriesIndex, editable: false, refs: [] };
        }),
      };
    });
  }

  function renderChart(item) {
    const chartProv = provenanceChart(item.id);
    const bars = chartProv && chartProv.bars && chartProv.bars.length ? chartProv.bars : legacyBars(item);
    const series = chartProv && chartProv.series && chartProv.series.length ? chartProv.series : legacySeries(item);
    const hasSeries = series.length > 0;
    const types = hasSeries ? ['line', 'area', 'step', 'scatter', 'lollipop'] : ['bar', 'column', 'pie', 'donut', 'radar'];
    let type = chartViews[item.id];
    if (types.indexOf(type) < 0) type = item.chartType === 'line' ? 'line' : item.chartType === 'pie' ? 'pie' : 'bar';
    if (types.indexOf(type) < 0) type = types[0];
    const table = tableById(item.sourceTableId);
    const source = table
      ? '<button class="provenance" data-source="' + escapeHtml(table.id) + '">From ' + escapeHtml(table.name) + '</button>'
      : '<span class="source">Source: ' + escapeHtml(item.sourceName || 'not displayed') + ' · ' + escapeHtml(item.x) + ' / ' + escapeHtml(Array.isArray(item.y) ? item.y.join(', ') : item.y) + '</span>';
    const typeRow = '<div class="type-row" role="radiogroup" aria-label="Chart view type">' + types.map(function (candidate) {
      return '<button type="button" data-chart-type="' + escapeHtml(candidate) + '" data-chart="' + escapeHtml(item.id) + '" class="' + (candidate === type ? 'on' : '') + '">' + escapeHtml(candidate) + '</button>';
    }).join('') + '</div>';
    const canvas = hasSeries ? renderSeriesChart(item.id, series, type) : renderCategoryChart(item.id, bars, type);
    const legend = renderLegend(item.id, bars, series, type, hasSeries);
    const warnings = chartProv && chartProv.warnings && chartProv.warnings.length
      ? '<ul class="warning-list">' + chartProv.warnings.map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul>'
      : '';
    return '<div class="chart-content"><div class="chart-meta"><span>' + source + '</span>' + typeRow + '</div>' + canvas + legend + warnings + '</div>';
  }

  function chartRange(bars) {
    const values = bars.map(function (bar) { return Number(bar.value); }).filter(function (value) { return Number.isFinite(value); });
    if (!values.length) return null;
    let min = Math.min(0, Math.min.apply(null, values));
    let max = Math.max(0, Math.max.apply(null, values));
    if (min === max) { min -= 1; max += 1; }
    return { min: min, max: max, range: max - min, zero: (0 - min) / (max - min) };
  }

  function renderCategoryChart(chartId, bars, type) {
    const range = chartRange(bars);
    if (!range || !bars.length) return '<div class="chart-empty">No chart data.</div>';
    if (type === 'pie' || type === 'donut') return renderPie(chartId, bars, type);
    if (type === 'radar') return renderRadar(chartId, bars);
    if (type === 'column') {
      return '<div class="columns">' + bars.map(function (bar, index) {
        const value = Number(bar.value);
        const finite = Number.isFinite(value);
        const zero = range.zero * 100;
        const bottom = finite && value >= 0 ? zero : zero + (finite ? value / range.range : 0) * 100;
        const height = finite ? Math.abs(value) / range.range * 100 : 0;
        const editable = Boolean(bar.editable) && canEdit();
        return '<div class="column"><span class="col-value" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '">' + (finite ? escapeHtml(formatNumber(value)) : '—') + '</span>' +
          '<div class="col-track' + (editable ? ' editable' : '') + '" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '" title="' + escapeHtml(barTitle(bar)) + '">' +
          '<div class="col-zero" style="bottom:' + zero + '%"></div><div class="col-fill" style="bottom:' + bottom + '%;height:' + Math.max(0.6, height) + '%"></div></div>' +
          '<span class="col-label" title="' + escapeHtml(bar.label) + '">' + escapeHtml(bar.label) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="bar-rows">' + bars.map(function (bar, index) {
      const value = Number(bar.value);
      const finite = Number.isFinite(value);
      const left = finite && value >= 0 ? range.zero * 100 : range.zero * 100 + (finite ? value / range.range : 0) * 100;
      const width = finite ? Math.abs(value) / range.range * 100 : 0;
      const editable = Boolean(bar.editable) && canEdit();
      return '<div class="bar-row"><span class="bar-label" title="' + escapeHtml(bar.label) + '">' + escapeHtml(bar.label) + '</span>' +
        '<div class="track' + (editable ? ' editable' : '') + '" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '" title="' + escapeHtml(barTitle(bar)) + '">' +
        '<div class="zero-line" style="left:' + (range.zero * 100) + '%"></div><div class="fill" style="left:' + left + '%;width:' + Math.max(0.6, width) + '%"></div></div>' +
        '<span class="bar-value" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '">' + (finite ? escapeHtml(formatNumber(value)) : '—') + '</span></div>';
    }).join('') + '</div>';
  }

  function barTitle(bar) {
    if (bar.editable) return 'Drag to edit the source literal' + (bar.via ? ' via ' + bar.via : '');
    if (bar.expr) return 'Computed: ' + bar.expr;
    return 'Computed value';
  }

  function renderPie(chartId, bars, type) {
    const positive = bars.map(function (bar) { return Math.max(0, Number(bar.value) || 0); });
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
      const editable = Boolean(bar.editable) && canEdit();
      return '<path d="' + path + '" fill="' + palette[index % palette.length] + '" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '" class="' + (editable ? 'editable' : '') + '"><title>' + escapeHtml(bar.label + ': ' + formatNumber(Number(bar.value))) + '</title></path>';
    }).join('');
    const center = type === 'donut' ? '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="18" fill="currentColor">' + escapeHtml(formatNumber(total)) + '</text><text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="10" fill="currentColor">total</text>' : '';
    return '<div class="pie-layout"><svg class="pie-svg" viewBox="0 0 190 190" role="img" aria-label="Pie chart">' + slices + center + '</svg><div class="legend">' + bars.map(function (bar, index) {
      return '<span class="legend-row"><span class="swatch" style="background:' + palette[index % palette.length] + '"></span>' + escapeHtml(bar.label) + ' <span class="legend-value' + (bar.editable && canEdit() ? ' editable' : '') + '" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '">' + escapeHtml(formatNumber(Number(bar.value))) + '</span></span>';
    }).join('') + '</div></div>';
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

  function renderRadar(chartId, bars) {
    const count = bars.length;
    if (!count) return '<div class="chart-empty">No chart data.</div>';
    const cx = 160;
    const cy = 145;
    const radius = 106;
    const scale = Math.max(1, Math.max.apply(null, bars.map(function (bar) { return Math.max(0, Number(bar.value) || 0); })));
    const rings = [0.25, 0.5, 0.75, 1].map(function (ring) {
      const points = bars.map(function (_, index) { const at = polar(cx, cy, radius * ring, index, count); return at.x + ',' + at.y; }).join(' ');
      return '<polygon points="' + points + '" class="grid" />';
    }).join('');
    const spokes = bars.map(function (_, index) {
      const edge = polar(cx, cy, radius, index, count);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + edge.x + '" y2="' + edge.y + '" class="grid" />';
    }).join('');
    const dots = bars.map(function (bar, index) {
      const ratio = Math.max(0, Number(bar.value) || 0) / scale;
      const at = polar(cx, cy, radius * ratio, index, count);
      const editable = Boolean(bar.editable) && canEdit();
      return '<circle cx="' + at.x + '" cy="' + at.y + '" r="' + (editable ? 5 : 3.5) + '" fill="' + palette[index % palette.length] + '" class="dot' + (editable ? ' editable' : '') + '" data-chart="' + escapeHtml(chartId) + '" data-bar="' + index + '"><title>' + escapeHtml(bar.label + ': ' + formatNumber(Number(bar.value))) + '</title></circle>';
    }).join('');
    const polygon = bars.map(function (bar, index) {
      const at = polar(cx, cy, radius * Math.max(0, Number(bar.value) || 0) / scale, index, count);
      return at.x + ',' + at.y;
    }).join(' ');
    const labels = bars.map(function (bar, index) {
      const edge = polar(cx, cy, radius + 14, index, count);
      return '<text x="' + edge.x + '" y="' + edge.y + '" text-anchor="middle">' + escapeHtml(bar.label) + '</text>';
    }).join('');
    return '<svg class="series-svg" viewBox="0 0 320 300" role="img" aria-label="Radar chart">' + rings + spokes +
      '<polygon points="' + polygon + '" fill="' + palette[0] + '" fill-opacity="0.18" stroke="' + palette[0] + '" stroke-width="2" />' + dots + labels + '</svg>';
  }

  function polar(cx, cy, radius, index, count) {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle: angle };
  }

  function seriesStepPoints(points) {
    if (!points.length) return [];
    const out = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
      out.push({ x: points[index].x, y: points[index - 1].y });
      out.push({ x: points[index].x, y: points[index].y });
    }
    return out;
  }

  function renderSeriesChart(chartId, series, type) {
    const all = series.flatMap(function (entry) { return entry.points || []; });
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
      const points = (entry.points || []).map(function (point) { return { x: px(point.x), y: py(point.y), point: point }; });
      if (!points.length) return '';
      const draw = type === 'step' ? seriesStepPoints(points) : points;
      const linePoints = draw.map(function (point) { return point.x + ',' + point.y; }).join(' ');
      let shape = '';
      if (type === 'line' || type === 'step') shape += '<polyline class="line" data-series-line="' + seriesIndex + '" points="' + linePoints + '" stroke="' + palette[seriesIndex % palette.length] + '"><title>' + escapeHtml(entry.name) + '</title></polyline>';
      if (type === 'area') {
        const baseline = height - padBottom;
        shape += '<polygon class="area" data-series-area="' + seriesIndex + '" points="' + (points[0].x + ',' + baseline + ' ' + linePoints + ' ' + points[points.length - 1].x + ',' + baseline) + '" fill="' + palette[seriesIndex % palette.length] + '"></polygon>';
        shape += '<polyline class="line" data-series-line="' + seriesIndex + '" points="' + linePoints + '" stroke="' + palette[seriesIndex % palette.length] + '"></polyline>';
      }
      if (type === 'lollipop') {
        shape += points.map(function (point) { return '<line class="stem" x1="' + point.x + '" x2="' + point.x + '" y1="' + (height - padBottom) + '" y2="' + point.y + '" stroke="' + palette[seriesIndex % palette.length] + '"></line>'; }).join('');
        shape += '<polyline class="line" data-series-line="' + seriesIndex + '" points="' + linePoints + '" stroke="' + palette[seriesIndex % palette.length] + '"></polyline>';
      }
      const dots = points.map(function (point, pointIndex) {
        const editable = Boolean(point.point.editable) && canEdit();
        const lineIndex = type === 'step' ? (pointIndex === 0 ? 0 : pointIndex * 2) : pointIndex;
        return '<circle class="dot' + (editable ? ' editable' : '') + '" data-chart="' + escapeHtml(chartId) + '" data-series="' + seriesIndex + '" data-point="' + pointIndex + '" data-line-index="' + lineIndex + '" cx="' + point.x + '" cy="' + point.y + '" r="' + (editable ? 5 : 3.5) + '" fill="' + palette[seriesIndex % palette.length] + '"><title>' + escapeHtml(formatNumber(point.point.x) + ' / ' + formatNumber(point.point.y)) + '</title></circle>';
      }).join('');
      return shape + dots;
    }).join('');
    return '<svg class="series-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Line chart">' + ticks + paths + '<text x="' + (width / 2) + '" y="' + (height - 2) + '" text-anchor="middle">x</text></svg>' +
      '<div class="ticks">' + series.map(function (entry) { return '<span>' + escapeHtml(entry.name) + '</span>'; }).join('') + '</div>';
  }

  function renderLegend(chartId, bars, series, type, hasSeries) {
    if (hasSeries) {
      return '<div class="legend">' + series.map(function (entry, index) {
        return '<span class="legend-row"><span class="swatch" style="background:' + palette[index % palette.length] + '"></span>' + escapeHtml(entry.name) + ' · ' + (entry.points || []).length + ' points</span>';
      }).join('') + '</div>';
    }
    if (type === 'pie' || type === 'donut' || type === 'radar') return '';
    return '<div class="legend">' + bars.map(function (bar, index) {
      return '<span class="legend-row"><span class="swatch" style="background:' + palette[index % palette.length] + '"></span>' + escapeHtml(bar.label) + '</span>';
    }).join('') + '</div>';
  }

  function bindDocument() {
    const pane = app.querySelector('.document-pane');
    if (!pane) return;
    const build = pane.querySelector('#build');
    if (build) build.addEventListener('click', function () { flushSourceEdit(); post({ type: 'build', entrySource: entrySource() }); });
    const refresh = pane.querySelector('#refresh');
    if (refresh) refresh.addEventListener('click', function () { flushSourceEdit(); post({ type: 'refresh' }); });
    pane.querySelectorAll('[data-diagnostic]').forEach(function (button) {
      button.addEventListener('click', function () {
        reveal(button.dataset.diagnostic, Number(button.dataset.start), Number(button.dataset.end));
      });
    });
    pane.querySelectorAll('.provenance[data-source]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.source;
        pane.querySelectorAll('.artifact').forEach(function (node) { node.classList.toggle('linked', node.dataset.id === id); });
        const target = pane.querySelector('.artifact[data-id="' + cssEscape(id) + '"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    bindArtifactDrag(pane);
    pane.querySelectorAll('.filter[data-table]').forEach(function (input) {
      input.addEventListener('input', function () {
        filters[input.dataset.table] = input.value;
        renderDocument({ focus: { selector: '.filter[data-table="' + cssEscape(input.dataset.table) + '"]', start: input.selectionStart } });
      });
    });
    pane.querySelectorAll('.sort[data-table]').forEach(function (button) {
      button.addEventListener('click', function () {
        const tableId = button.dataset.table;
        const column = Number(button.dataset.column);
        const current = sorts[tableId];
        if (!current || current.column !== column) sorts[tableId] = { column: column, direction: 'asc' };
        else if (current.direction === 'asc') sorts[tableId] = { column: column, direction: 'desc' };
        else delete sorts[tableId];
        renderDocument();
      });
    });
    pane.querySelectorAll('td[data-table]').forEach(function (cell) {
      cell.addEventListener('click', function (event) {
        if (event.target.closest('.chip')) return;
        const tableId = cell.dataset.table;
        const row = Number(cell.dataset.row);
        const column = Number(cell.dataset.column);
        const table = provenanceTable(tableId);
        const prov = table && table.rows ? table.rows[row] && table.rows[row][column] : null;
        if (prov && prov.editable && canEdit()) beginCellEdit(cell, tableId, row, column, prov);
        else if (prov && prov.file) reveal(prov.file, prov.start, prov.end);
        else if (prov && prov.refs && prov.refs.length) reveal(prov.refs[0].file, prov.refs[0].start, prov.refs[0].end);
      });
    });
    pane.querySelectorAll('.chip[data-file]').forEach(function (chip) {
      chip.addEventListener('click', function (event) {
        event.stopPropagation();
        reveal(chip.dataset.file, Number(chip.dataset.start), Number(chip.dataset.end));
      });
    });
    pane.querySelectorAll('[data-chart-type]').forEach(function (button) {
      button.addEventListener('click', function () {
        chartViews[button.dataset.chart] = button.dataset.chartType;
        renderDocument();
      });
    });
    bindCharts(pane);
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function bindArtifactDrag(pane) {
    pane.querySelectorAll('.drag-handle[draggable="true"]').forEach(function (handle) {
      handle.addEventListener('dragstart', function (event) {
        draggedId = handle.dataset.id;
        const card = handle.closest('.artifact');
        if (card) card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        try { event.dataTransfer.setData('text/plain', draggedId); } catch (error) { /* some hosts restrict data */ }
      });
      handle.addEventListener('dragend', function () {
        draggedId = null;
        pane.querySelectorAll('.artifact').forEach(function (node) { node.classList.remove('dragging', 'drop-target'); });
      });
    });
    pane.querySelectorAll('.artifact').forEach(function (card) {
      card.addEventListener('dragover', function (event) {
        if (!draggedId || draggedId === card.dataset.id) return;
        if (state.libraryMode && state.model.items.find(function (item) { return item.id === draggedId; }) && state.model.items.find(function (item) { return item.id === draggedId; }).groupId !== state.model.items.find(function (item) { return item.id === card.dataset.id; }).groupId) return;
        event.preventDefault();
        card.classList.add('drop-target');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('drop-target'); });
      card.addEventListener('drop', function (event) {
        event.preventDefault();
        card.classList.remove('drop-target');
        const targetId = card.dataset.id;
        if (!draggedId || !targetId || draggedId === targetId) return;
        const dragged = state.model.items.find(function (item) { return item.id === draggedId; });
        const target = state.model.items.find(function (item) { return item.id === targetId; });
        if (state.libraryMode && dragged && target && dragged.groupId !== target.groupId) return;
        const next = state.model.order.filter(function (id) { return id !== draggedId; });
        const targetIndex = next.indexOf(targetId);
        next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedId);
        state.model.order = next;
        renderDocument();
        flushSourceEdit();
        post({ type: 'reorder', order: next, entrySource: entrySource() });
      });
    });
  }

  function bindCharts(pane) {
    pane.querySelectorAll('.track.editable[data-chart]').forEach(function (track) {
      const chartId = track.dataset.chart;
      const barIndex = Number(track.dataset.bar);
      const chart = provenanceChart(chartId);
      const bar = chart && chart.bars ? chart.bars[barIndex] : null;
      if (!bar) return;
      bindTrackDrag(track, chartId, barIndex, bar, 'horizontal');
    });
    pane.querySelectorAll('.col-track.editable[data-chart]').forEach(function (track) {
      const chartId = track.dataset.chart;
      const barIndex = Number(track.dataset.bar);
      const chart = provenanceChart(chartId);
      const bar = chart && chart.bars ? chart.bars[barIndex] : null;
      if (!bar) return;
      bindTrackDrag(track, chartId, barIndex, bar, 'vertical');
    });
    pane.querySelectorAll('circle.dot.editable[data-chart]').forEach(function (dot) {
      const chartId = dot.dataset.chart;
      const chart = provenanceChart(chartId);
      if (!chart) return;
      if (dot.dataset.series != null) {
        const series = chart.series && chart.series[Number(dot.dataset.series)];
        const point = series && series.points ? series.points[Number(dot.dataset.point)] : null;
        if (point) bindPointDrag(dot, chartId, Number(dot.dataset.series), Number(dot.dataset.point), point);
      } else if (dot.dataset.bar != null) {
        const bar = chart.bars && chart.bars[Number(dot.dataset.bar)];
        if (bar) bindRadarDrag(dot, chartId, Number(dot.dataset.bar), bar);
      }
    });
    pane.querySelectorAll('.legend-value.editable[data-chart]').forEach(function (value) {
      value.addEventListener('click', function () {
        const chartId = value.dataset.chart;
        const chart = provenanceChart(chartId);
        const barIndex = Number(value.dataset.bar);
        const bar = chart && chart.bars ? chart.bars[barIndex] : null;
        if (bar) beginValueEdit(value, chartId, barIndex, bar);
      });
    });
    pane.querySelectorAll('path[data-chart][data-bar]').forEach(function (slice) {
      slice.addEventListener('click', function () {
        const chart = provenanceChart(slice.dataset.chart);
        const bar = chart && chart.bars ? chart.bars[Number(slice.dataset.bar)] : null;
        if (bar && bar.file) reveal(bar.file, bar.start, bar.end);
      });
    });
  }

  function roundTo(value, decimals) {
    const factor = Math.pow(10, Math.max(0, Math.min(8, decimals || 0)));
    return Math.round(value * factor) / factor;
  }

  function bindTrackDrag(track, chartId, barIndex, bar, orientation) {
    track.addEventListener('pointerdown', function (event) {
      if (editing || state.stale) return;
      event.preventDefault();
      draggingBar = true;
      try { track.setPointerCapture(event.pointerId); } catch (error) { /* pointer still works */ }
      const rect = track.getBoundingClientRect();
      const fill = track.querySelector('.fill') || track.querySelector('.col-fill');
      const valueNode = app.querySelector('.bar-value[data-chart="' + cssEscape(chartId) + '"][data-bar="' + barIndex + '"]') || app.querySelector('.col-value[data-chart="' + cssEscape(chartId) + '"][data-bar="' + barIndex + '"]');
      const chart = provenanceChart(chartId);
      const range = chartRange(chart.bars);
      if (!range) { draggingBar = false; return; }
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let shown = Number(bar.value);
      let changed = false;
      const move = function (pointer) {
        if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) > 2) moved = true;
        const ratio = orientation === 'horizontal'
          ? Math.min(1, Math.max(0, (pointer.clientX - rect.left) / Math.max(1, rect.width)))
          : Math.min(1, Math.max(0, 1 - (pointer.clientY - rect.top) / Math.max(1, rect.height)));
        shown = roundTo(range.min + ratio * range.range, bar.decimals || 0);
        changed = moved && Math.abs(shown - Number(bar.value)) > 1e-9;
        if (valueNode) valueNode.textContent = formatNumber(shown);
        if (fill) {
          if (orientation === 'horizontal') {
            const left = shown >= 0 ? range.zero : range.zero + shown / range.range;
            fill.style.left = (left * 100) + '%';
            fill.style.width = Math.max(0.6, Math.abs(shown) / range.range * 100) + '%';
          } else {
            const bottom = shown >= 0 ? range.zero : range.zero + shown / range.range;
            fill.style.bottom = (bottom * 100) + '%';
            fill.style.height = Math.max(0.6, Math.abs(shown) / range.range * 100) + '%';
          }
        }
      };
      const stop = function (commit) {
        track.removeEventListener('pointermove', move);
        track.removeEventListener('pointerup', up);
        track.removeEventListener('pointercancel', cancel);
        draggingBar = false;
        if (commit && changed) postBarPatch(chartId, barIndex, shown);
        else flushPending();
      };
      const up = function () { stop(true); };
      const cancel = function () { stop(false); };
      track.addEventListener('pointermove', move);
      track.addEventListener('pointerup', up);
      track.addEventListener('pointercancel', cancel);
      move(event);
    });
  }

  function bindPointDrag(dot, chartId, seriesIndex, pointIndex, point) {
    const svg = dot.ownerSVGElement;
    if (!svg) return;
    dot.addEventListener('pointerdown', function (event) {
      if (editing || state.stale) return;
      event.preventDefault();
      draggingBar = true;
      try { dot.setPointerCapture(event.pointerId); } catch (error) { /* pointer still works */ }
      const viewBox = svg.viewBox.baseVal;
      const rect = svg.getBoundingClientRect();
      const padLeft = 48;
      const padRight = 18;
      const padTop = 16;
      const padBottom = 30;
      const all = (provenanceChart(chartId).series || []).flatMap(function (entry) { return entry.points || []; });
      let xmin = Math.min.apply(null, all.map(function (candidate) { return candidate.x; }));
      let xmax = Math.max.apply(null, all.map(function (candidate) { return candidate.x; }));
      let ymin = Math.min.apply(null, all.map(function (candidate) { return candidate.y; }));
      let ymax = Math.max.apply(null, all.map(function (candidate) { return candidate.y; }));
      if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
      if (ymin === ymax) { ymin -= 0.5; ymax += 0.5; }
      const xPad = (xmax - xmin) * 0.06;
      const yPad = (ymax - ymin) * 0.1;
      xmin -= xPad; xmax += xPad; ymin -= yPad; ymax += yPad;
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let shown = point.y;
      let changed = false;
      const move = function (pointer) {
        if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) > 2) moved = true;
        const svgY = ((pointer.clientY - rect.top) / Math.max(1, rect.height)) * viewBox.height;
        const ratio = Math.min(1, Math.max(0, (viewBox.height - padBottom - svgY) / Math.max(1, viewBox.height - padTop - padBottom)));
        shown = roundTo(ymin + ratio * (ymax - ymin), point.decimals || 0);
        changed = moved && Math.abs(shown - point.y) > 1e-9;
        const cy = viewBox.height - padBottom - (shown - ymin) / (ymax - ymin) * (viewBox.height - padTop - padBottom);
        dot.setAttribute('cy', String(cy));
        const line = svg.querySelector('[data-series-line="' + seriesIndex + '"]');
        if (line) {
          const points = Array.from(line.points.baseVal || []);
          const lineIndex = Number(dot.dataset.lineIndex == null ? pointIndex : dot.dataset.lineIndex);
          if (points[lineIndex]) {
            points[lineIndex].y = cy;
            while (line.points.numberOfItems) line.points.removeItem(0);
            points.forEach(function (candidate) { line.points.appendItem(candidate); });
          }
        }
      };
      const stop = function (commit) {
        dot.removeEventListener('pointermove', move);
        dot.removeEventListener('pointerup', up);
        dot.removeEventListener('pointercancel', cancel);
        draggingBar = false;
        if (commit && changed) postPointPatch(chartId, seriesIndex, pointIndex, shown);
        else flushPending();
      };
      const up = function () { stop(true); };
      const cancel = function () { stop(false); };
      dot.addEventListener('pointermove', move);
      dot.addEventListener('pointerup', up);
      dot.addEventListener('pointercancel', cancel);
      move(event);
    });
  }

  function bindRadarDrag(dot, chartId, barIndex, bar) {
    const svg = dot.ownerSVGElement;
    if (!svg) return;
    dot.addEventListener('pointerdown', function (event) {
      if (editing || state.stale) return;
      event.preventDefault();
      draggingBar = true;
      try { dot.setPointerCapture(event.pointerId); } catch (error) { /* pointer still works */ }
      const chart = provenanceChart(chartId);
      const count = chart.bars.length;
      const cx = 160;
      const cy = 145;
      const radius = 106;
      const scale = Math.max(1, Math.max.apply(null, chart.bars.map(function (candidate) { return Math.max(0, Number(candidate.value) || 0); })));
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      const spoke = polar(0, 0, 1, barIndex, count);
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let shown = Number(bar.value);
      let changed = false;
      const move = function (pointer) {
        if (Math.abs(pointer.clientX - startX) + Math.abs(pointer.clientY - startY) > 2) moved = true;
        const px = ((pointer.clientX - rect.left) / Math.max(1, rect.width)) * box.width;
        const py = ((pointer.clientY - rect.top) / Math.max(1, rect.height)) * box.height;
        const projection = (px - cx) * spoke.x + (py - cy) * spoke.y;
        const ratio = Math.min(1, Math.max(0, projection / radius));
        shown = roundTo(ratio * scale, bar.decimals || 0);
        changed = moved && Math.abs(shown - Number(bar.value)) > 1e-9;
        const at = polar(cx, cy, radius * ratio, barIndex, count);
        dot.setAttribute('cx', String(at.x));
        dot.setAttribute('cy', String(at.y));
      };
      const stop = function (commit) {
        dot.removeEventListener('pointermove', move);
        dot.removeEventListener('pointerup', up);
        dot.removeEventListener('pointercancel', cancel);
        draggingBar = false;
        if (commit && changed) postBarPatch(chartId, barIndex, shown);
        else flushPending();
      };
      const up = function () { stop(true); };
      const cancel = function () { stop(false); };
      dot.addEventListener('pointermove', move);
      dot.addEventListener('pointerup', up);
      dot.addEventListener('pointercancel', cancel);
      move(event);
    });
  }

  function postBarPatch(chartId, barIndex, value) {
    state.status = 'Applying source edit…';
    renderDocument();
    flushSourceEdit();
    post({ type: 'patch', target: { kind: 'chart', itemId: chartId, barIndex: barIndex }, value: String(value), entrySource: entrySource() });
    flushPending();
  }

  function postPointPatch(chartId, seriesIndex, pointIndex, value) {
    state.status = 'Applying source edit…';
    renderDocument();
    flushSourceEdit();
    post({ type: 'patch', target: { kind: 'chart', itemId: chartId, seriesIndex: seriesIndex, pointIndex: pointIndex }, value: String(value), entrySource: entrySource() });
    flushPending();
  }

  function inputValueFor(value, prov) {
    if (prov && prov.literalType === 'string') return String(value == null ? '' : value);
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function beginCellEdit(cell, tableId, row, column, prov) {
    if (editing || state.stale) return;
    editing = { type: 'cell' };
    const item = state.model.items.find(function (candidate) { return candidate.id === tableId; });
    const value = item && item.rows[row] ? item.rows[row][column] : null;
    const original = inputValueFor(value, prov);
    const input = document.createElement('input');
    input.className = 'cell-input';
    input.value = original;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    let settled = false;
    const finish = function (commit) {
      if (settled) return;
      settled = true;
      const next = input.value;
      editing = null;
      if (commit && next !== original) {
        state.status = 'Applying source edit…';
        renderDocument();
        flushSourceEdit();
        post({ type: 'patch', target: { kind: 'table', itemId: tableId, row: row, column: column }, value: next, entrySource: entrySource() });
        flushPending();
      } else {
        renderDocument();
        flushPending();
      }
    };
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function beginValueEdit(element, chartId, barIndex, bar) {
    if (editing || state.stale) return;
    editing = { type: 'value' };
    const original = element.textContent;
    const input = document.createElement('input');
    input.className = 'cell-input';
    input.value = original;
    input.style.width = '64px';
    element.textContent = '';
    element.appendChild(input);
    input.focus();
    input.select();
    let settled = false;
    const finish = function (commit) {
      if (settled) return;
      settled = true;
      const next = input.value;
      editing = null;
      if (commit && next !== original) {
        state.status = 'Applying source edit…';
        renderDocument();
        flushSourceEdit();
        post({ type: 'patch', target: { kind: 'chart', itemId: chartId, barIndex: barIndex }, value: next, entrySource: entrySource() });
        flushPending();
      } else {
        renderDocument();
        flushPending();
      }
    };
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function flushPending() {
    if (!pendingState || editing || draggingBar) return;
    const next = pendingState;
    pendingState = null;
    applyState(next);
  }

  function applyState(next) {
    if (!next || next.type !== 'workspace') return;
    if (editing || draggingBar) { pendingState = next; return; }
    const previous = state;
    const previousSelected = selectedFile;
    const filesChanged = !sameFiles(previous.files, next.files);
    const selectedStillPresent = (next.files || []).some(function (file) { return file.path === selectedFile; });
    const modeChanged = (next.libraryMode ?? false) !== previous.libraryMode || (next.livePreview ?? false) !== previous.livePreview || (next.trusted ?? true) !== previous.trusted;
    if (filesChanged || !selectedStillPresent || modeChanged) {
      const expected = (next.files || []).find(function (file) { return file.path === selectedFile; });
      flushSourceEdit(expected ? expected.source : undefined);
    }
    state = Object.assign({}, DEFAULT_STATE, next);
    state.files = Array.isArray(state.files) ? state.files : [];
    state.dirtyFiles = Array.isArray(state.dirtyFiles) ? state.dirtyFiles : [];
    state.diagnostics = Array.isArray(state.diagnostics) ? state.diagnostics : [];
    if (!state.model || typeof state.model !== 'object') state.model = { items: [], order: [], groups: [] };
    if (!state.files.some(function (file) { return file.path === selectedFile; })) {
      selectedFile = state.entryFile || (state.files[0] && state.files[0].path) || null;
    }
    vscode.setState({ selectedFile: selectedFile });
    const selectionChanged = previousSelected !== selectedFile;
    const onlySelectedEcho = filesChanged && sameExceptSelectedSource(previous.files, state.files, selectedFile);
    if (!app.querySelector('.workspace') || (filesChanged && !onlySelectedEcho) || selectionChanged || modeChanged) renderWorkspace();
    else {
      const pane = app.querySelector('.source-pane');
      if (pane) {
        const status = pane.querySelector('.source-status');
        if (status) {
          const selected = fileByPath(selectedFile);
          const dirty = state.dirtyFiles.indexOf(selectedFile) >= 0;
          status.textContent = (dirty ? 'Unsaved' : 'Saved') + ' · ' + (selected ? selected.label : '');
        }
      }
      renderDocument();
    }
  }

  window.addEventListener('blur', function () { flushSourceEdit(); });
  window.addEventListener('message', function (event) { applyState(event.data); });
  const saved = vscode.getState && vscode.getState();
  if (saved && saved.selectedFile) selectedFile = saved.selectedFile;
  renderWorkspace();
  post({ type: 'ready' });

  // Exposed for small, deterministic tests of the pure display helpers.
  window.__studio = {
    escapeHtml: escapeHtml,
    formatNumber: formatNumber,
    formatCell: formatCell,
    chartRange: chartRange,
    slicePath: slicePath,
  };
})();
