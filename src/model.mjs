/**
 * Project an MLscript file into tables, charts, and documents.
 *
 * The .mls text stays the source of truth. This module only reads it and
 * splices a literal when a view edits one. It understands the subset the
 * studio use cases need:
 *
 *   let name = 10
 *   let name = mut { field: expr, ... }
 *   let name = [ mut { field: expr, ... }, ... ]
 *
 * Expressions may use numbers, strings, names, `.field` / `.0` paths,
 * parentheses, and + - * /. A cell is editable only when its own text is a
 * literal. A path or a formula is computed: the view can show it and jump
 * back to the literals it reads, and it cannot overwrite the formula.
 */

export function prettify(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, '');
}

export function isDirectLiteral(text) {
  const raw = String(text).trim();
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)
    || /^"(?:[^"\\]|\\.)*"$/.test(raw)
    || /^(true|false)$/.test(raw);
}

export function decimalsIn(text) {
  const match = /\.(\d+)/.exec(String(text).trim());
  return match ? match[1].length : 0;
}

/** What the user typed in a grid cell, as MLscript source. */
export function replacementFor(raw) {
  const text = String(raw).trim();
  if (text === '') return { error: 'Enter a value.' };
  if (/^(true|false)$/.test(text)) return { text };
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) {
    return { text: text.replace(/^\+/, '') };
  }
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      JSON.parse(text);
      return { text };
    } catch {
      /* treat the rest as plain text */
    }
  }
  return { text: JSON.stringify(text) };
}

export function applyReplacement(source, start, end, raw) {
  const next = replacementFor(raw);
  if (next.error) return next;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > source.length || start > end) {
    return { error: 'That cell is no longer at the same place in the file.' };
  }
  return { source: source.slice(0, start) + next.text + source.slice(end), text: next.text };
}

/**
 * Sort and filter a table for display. The input rows and the source are
 * left untouched: this is a view, not an edit.
 */
export function viewRows(rows, options = {}) {
  const filter = String(options.filter ?? '').trim().toLowerCase();
  let out = rows.slice();
  if (filter) {
    out = out.filter((row) => row.cells.some((cell) => String(cell.display).toLowerCase().includes(filter)));
  }
  if (options.column && options.direction) {
    const direction = options.direction === 'desc' ? -1 : 1;
    const column = options.column;
    out.sort((a, b) => direction * compareCells(cellByKey(a, column), cellByKey(b, column)));
  }
  return out;
}

export function focusId(model, offset) {
  let nearest = null;
  for (const table of model.tables) {
    if (table.start <= offset && offset <= table.end) return table.id;
    if (table.start <= offset) nearest = table.id;
  }
  return nearest;
}

export function parseStudio(source, options = {}) {
  const text = String(source);
  const lines = splitLines(text);
  const directives = parseDirectives(lines);
  const bindings = [];
  const errors = directives.errors.slice();

  for (const line of lines) {
    const match = /^[ \t]*let[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(?!=)/.exec(line.text);
    if (!match) continue;
    const name = match[1];
    const valueAt = line.start + match[0].length;
    if (bindings.some((binding) => binding.name === name)) {
      errors.push({ message: `Duplicate let ${name}`, start: line.start, end: line.end });
      continue;
    }
    try {
      const parser = new ValueParser(text, valueAt);
      const node = parser.value(true);
      bindings.push({ name, node, start: line.start, end: node.end });
    } catch (error) {
      errors.push({
        message: `${name}: ${error.message}`,
        start: line.start,
        end: line.end,
      });
    }
  }

  const env = new Map();
  const evaluated = [];
  for (const binding of bindings) {
    const value = evalNode(binding.node, env, text);
    env.set(binding.name, value);
    evaluated.push({ ...binding, value });
  }

  const tables = evaluated.map((binding) => buildTable(binding, text));
  const docs = directives.docs;
  const charts = directives.charts.map((chart) => buildChart(chart, tables));
  for (const chart of charts) {
    if (chart.error) errors.push({ message: chart.error, start: chart.start, end: chart.end });
  }

  const documents = directives.documents.length
    ? directives.documents
    : [implicitDocument(directives.order, tables, charts, docs, text)];

  validateDocuments(documents, tables, charts, docs, errors);

  return {
    title: directives.studio || options.fallbackTitle || 'MLscript Studio',
    documents,
    tables,
    charts,
    docs,
    errors,
  };
}

function validateDocuments(documents, tables, charts, docs, errors) {
  for (const document of documents) walkDocument(document, []);

  function walkDocument(document, stack) {
    if (stack.includes(document.id)) {
      errors.push({
        message: `Document ${document.id} includes itself`,
        start: document.start,
        end: document.end,
      });
      return;
    }
    const next = stack.concat(document.id);
    for (const block of document.blocks) {
      if (block.kind === 'document') {
        const child = documents.find((candidate) => candidate.id === block.id);
        if (!child) {
          errors.push({
            message: `Missing document ${block.id}`,
            start: document.start,
            end: document.end,
          });
        } else {
          walkDocument(child, next);
        }
      } else if (!artifact(block, tables, charts, docs)) {
        errors.push({
          message: `Missing ${block.kind} ${block.id}`,
          start: document.start,
          end: document.end,
        });
      }
    }
  }
}

function artifact(block, tables, charts, docs) {
  if (block.kind === 'table') return tables.find((table) => table.id === block.id);
  if (block.kind === 'chart') return charts.find((chart) => chart.id === block.id);
  if (block.kind === 'doc') return docs.find((doc) => doc.id === block.id);
  return null;
}

function implicitDocument(order, tables, charts, docs, source) {
  return {
    id: 'document',
    title: 'Document',
    start: 0,
    end: source.length,
    blocks: order.length ? order : interleave(tables, charts, docs),
  };
}

function interleave(tables, charts, docs) {
  return [
    ...docs.map((doc) => ({ kind: 'doc', id: doc.id, start: doc.start })),
    ...tables.map((table) => ({ kind: 'table', id: table.id, start: table.start })),
    ...charts.map((chart) => ({ kind: 'chart', id: chart.id, start: chart.start })),
  ]
    .sort((a, b) => a.start - b.start)
    .map(({ kind, id }) => ({ kind, id }));
}

function buildTable(binding, source) {
  const { name, node, value, start, end } = binding;
  const table = {
    kind: 'table',
    id: name,
    title: prettify(name),
    start,
    end,
    line: lineAt(source, start),
    layout: 'scalar',
    columns: [],
    rows: [],
  };

  if (value.type === 'arr' && node.kind === 'array') {
    const items = node.items;
    if (items.length === 0) {
      table.layout = 'records';
      return table;
    }
    if (items.every((item) => item.kind === 'record')) {
      table.layout = 'records';
      const columns = [];
      for (const item of items) {
        for (const field of item.fields) {
          if (!columns.includes(field.key)) columns.push(field.key);
        }
      }
      table.columns = columns.map((key) => ({ key, label: prettify(key) }));
      table.rows = items.map((item, index) => ({
        index,
        cells: columns.map((key) => {
          const field = item.fields.find((candidate) => candidate.key === key);
          if (!field) return emptyCell(key);
          const evaluated = value.items[index]?.fields.find((candidate) => candidate.key === key)?.value;
          return { ...cellFrom(field.value, evaluated, source), key };
        }),
      }));
      return table;
    }
    table.layout = 'list';
    table.columns = [{ key: 'value', label: 'Value' }];
    table.rows = items.map((item, index) => ({
      index,
      cells: [{ ...cellFrom(item, value.items[index], source), key: 'value' }],
    }));
    return table;
  }

  if (value.type === 'rec' && node.kind === 'record') {
    table.layout = 'object';
    table.columns = [
      { key: 'field', label: 'Field' },
      { key: 'value', label: 'Value' },
    ];
    table.rows = node.fields.map((field, index) => ({
      index,
      fieldKey: field.key,
      cells: [
        {
          key: 'field',
          display: prettify(field.key),
          editable: false,
          numeric: null,
          refs: [],
          revealStart: field.keyStart,
          revealEnd: field.keyEnd,
        },
        { ...cellFrom(field.value, value.fields[index]?.value, source), key: 'value' },
      ],
    }));
    return table;
  }

  table.layout = 'scalar';
  table.columns = [{ key: 'value', label: 'Value' }];
  table.rows = [{ index: 0, cells: [{ ...cellFrom(node, value, source), key: 'value' }] }];
  return table;
}

function emptyCell(key) {
  return { key, display: '', editable: false, numeric: null, refs: [] };
}

function cellFrom(node, value, source) {
  const evaluated = value ?? { type: 'err', message: 'missing value', refs: [] };
  const revealStart = node?.start;
  const revealEnd = node?.end;
  const expr = node && node.kind === 'atom' ? source.slice(node.start, node.end).trim() : evaluated.expr;
  const editable = node?.kind === 'atom' && isDirectLiteral(expr) && evaluated.type !== 'err';
  const numeric = evaluated.type === 'num' ? evaluated.value : null;
  const shown = editable
    ? (evaluated.type === 'str' || evaluated.type === 'bool' ? formatValue(evaluated) : expr)
    : (evaluated.type === 'err' ? expr || evaluated.message : formatValue(evaluated));
  return {
    key: undefined,
    display: shown,
    editable,
    numeric,
    decimals: editable ? decimalsIn(expr) : undefined,
    expected: editable ? expr : undefined,
    start: editable ? node.start : undefined,
    end: editable ? node.end : undefined,
    revealStart,
    revealEnd,
    expr: editable ? undefined : expr,
    refs: editable ? [] : literalRefs(evaluated),
    error: evaluated.type === 'err' ? evaluated.message : undefined,
  };
}

function buildChart(chart, tables) {
  const base = {
    kind: 'chart',
    id: chart.id,
    title: chart.title,
    type: chart.type || 'bar',
    source: chart.source,
    x: chart.x,
    y: chart.y,
    start: chart.start,
    end: chart.end,
    bars: [],
  };
  if (base.type !== 'bar') return { ...base, error: `${chart.title}: only bar charts are in this prototype` };
  const table = tables.find((candidate) => candidate.id === chart.source);
  if (!table) return { ...base, error: `${chart.title}: unknown table ${chart.source}` };
  if (!chart.x || !chart.y) return { ...base, error: `${chart.title}: name both x and y columns` };
  const xIndex = table.columns.findIndex((column) => column.key === chart.x);
  const yIndex = table.columns.findIndex((column) => column.key === chart.y);
  if (xIndex < 0 || yIndex < 0) {
    return { ...base, error: `${chart.title}: ${chart.source} has no column ${xIndex < 0 ? chart.x : chart.y}` };
  }
  base.bars = table.rows.map((row) => {
    const x = { ...row.cells[xIndex], key: chart.x };
    const y = { ...row.cells[yIndex], key: chart.y };
    return {
      label: x.display,
      value: y.numeric,
      editable: Boolean(y.editable) && y.numeric != null,
      decimals: y.decimals ?? 0,
      start: y.start,
      end: y.end,
      expected: y.expected,
      expr: y.expr,
      refs: y.refs || [],
      revealStart: y.revealStart,
      revealEnd: y.revealEnd,
    };
  });
  return base;
}

function literalRefs(value) {
  if (!value) return [];
  if (value.directLiteral && Number.isInteger(value.start)) {
    return [{ path: value.expr, start: value.start, end: value.end }];
  }
  return value.refs || [];
}

function formatValue(value) {
  if (!value) return '';
  if (value.type === 'num') return formatNumber(value.value);
  if (value.type === 'str') return value.value;
  if (value.type === 'bool') return String(value.value);
  if (value.type === 'arr') return `[${value.items.length} rows]`;
  if (value.type === 'rec') return '{…}';
  if (value.type === 'err') return value.message;
  return '';
}

function evalNode(node, env, source) {
  if (node.kind === 'array') {
    return { type: 'arr', items: node.items.map((item) => evalNode(item, env, source)) };
  }
  if (node.kind === 'record') {
    return {
      type: 'rec',
      fields: node.fields.map((field) => ({ key: field.key, value: evalNode(field.value, env, source) })),
    };
  }
  return evalExpr(source.slice(node.start, node.end), node.start, node.end, env);
}

function evalExpr(text, absStart, absEnd, env) {
  const expr = text.trim();
  try {
    const parser = new ExprParser(text, env);
    const value = parser.parseExpr();
    parser.skip();
    if (parser.i < text.length) throw new Error(`unexpected ${text.slice(parser.i).trim()}`);
    return {
      ...value,
      expr,
      start: absStart,
      end: absEnd,
      directLiteral: isDirectLiteral(text),
    };
  } catch (error) {
    return {
      type: 'err',
      message: error.message,
      expr,
      start: absStart,
      end: absEnd,
      directLiteral: false,
      refs: [],
    };
  }
}

function cellByKey(row, key) {
  return row.cells.find((cell) => cell.key === key);
}

function compareCells(a, b) {
  if (a?.numeric != null && b?.numeric != null) return a.numeric - b.numeric;
  return String(a?.display ?? '').localeCompare(String(b?.display ?? ''));
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function splitLines(source) {
  const lines = [];
  let start = 0;
  const parts = source.split('\n');
  for (let index = 0; index < parts.length; index++) {
    const text = parts[index].replace(/\r$/, '');
    const end = start + parts[index].length;
    lines.push({ text, start, end });
    start = end + 1;
  }
  return lines;
}

function parseDirectives(lines) {
  const docs = [];
  const charts = [];
  const documents = [];
  const errors = [];
  let studio = '';
  let order = [];
  let index = 0;

  while (index < lines.length) {
    const header = directive(lines[index].text);
    if (!header) {
      index += 1;
      continue;
    }
    if (header.name === 'studio') {
      studio = header.rest.trim();
      index += 1;
      continue;
    }
    if (header.name === 'order') {
      order = parseIncludes(header.rest);
      index += 1;
      continue;
    }
    if (header.name === 'doc' || header.name === 'chart' || header.name === 'document') {
      const endName = `end${header.name}`;
      const start = lines[index].start;
      const body = [];
      index += 1;
      let closed = false;
      while (index < lines.length) {
        const next = directive(lines[index].text);
        if (next?.name === endName) {
          closed = true;
          index += 1;
          break;
        }
        if (next) break;
        if (!isComment(lines[index].text) && lines[index].text.trim() !== '') {
          break;
        }
        body.push(uncomment(lines[index].text));
        index += 1;
      }
      const end = lines[Math.min(index, lines.length) - 1]?.end ?? start;
      if (!closed) errors.push({ message: `Unclosed @${header.name}`, start, end });
      const block = finishDirective(header, body, start, end);
      if (header.name === 'doc') docs.push(block);
      else if (header.name === 'chart') charts.push(block);
      else documents.push(block);
      continue;
    }
    index += 1;
  }

  return { studio, order, docs, charts, documents, errors };
}

function finishDirective(header, body, start, end) {
  if (header.name === 'doc') {
    const fields = takeFields(body, ['id']);
    const prose = fields.rest.map((line) => line.trimEnd());
    while (prose.length && prose[0].trim() === '') prose.shift();
    while (prose.length && prose[prose.length - 1].trim() === '') prose.pop();
    const title = header.rest.trim() || 'Note';
    return {
      kind: 'doc',
      id: fields.id || slug(title),
      title,
      body: prose.join('\n'),
      start,
      end,
    };
  }
  if (header.name === 'chart') {
    const fields = takeFields(body, ['id', 'type', 'source', 'x', 'y']);
    const title = header.rest.trim() || 'Chart';
    return {
      kind: 'chart',
      id: fields.id || slug(title),
      title,
      type: (fields.type || 'bar').trim(),
      source: (fields.source || '').trim(),
      x: (fields.x || '').trim(),
      y: (fields.y || '').trim(),
      start,
      end,
    };
  }
  const fields = takeFields(body, ['id', 'includes']);
  const title = header.rest.trim() || 'Document';
  return {
    kind: 'document',
    id: fields.id || slug(title),
    title,
    blocks: parseIncludes(fields.includes || ''),
    start,
    end,
  };
}

function takeFields(lines, allowed) {
  const fields = { rest: [] };
  for (const line of lines) {
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (match && allowed.includes(match[1]) && fields[match[1]] == null && fields.rest.length === 0) {
      fields[match[1]] = match[2];
    } else {
      fields.rest.push(line);
    }
  }
  return fields;
}

function parseIncludes(text) {
  return text.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = /^(doc|table|chart|document):([A-Za-z0-9_-]+)$/.exec(part);
    if (!match) return { kind: 'doc', id: part };
    return { kind: match[1], id: match[2] };
  });
}

function directive(text) {
  const match = /^[ \t]*\/\/[ \t]*@([A-Za-z]+)[ \t]*(.*)$/.exec(text);
  if (!match) return null;
  return { name: match[1], rest: match[2] };
}

function isComment(text) {
  return /^[ \t]*\/\//.test(text);
}

function uncomment(text) {
  return text.replace(/^[ \t]*\/\/ ?/, '');
}

function slug(value) {
  const text = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return text || 'item';
}

class ValueParser {
  constructor(source, start) {
    this.s = source;
    this.i = start;
  }

  fail(message) {
    throw new Error(`${message} at ${this.i}`);
  }

  ws() {
    const source = this.s;
    for (;;) {
      const char = source[this.i];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') this.i += 1;
      else if (char === '/' && source[this.i + 1] === '/') {
        while (this.i < source.length && source[this.i] !== '\n') this.i += 1;
      } else if (char === '/' && source[this.i + 1] === '*') {
        const end = source.indexOf('*/', this.i + 2);
        this.i = end < 0 ? source.length : end + 2;
      } else return;
    }
  }

  value(top) {
    this.ws();
    const source = this.s;
    const start = this.i;
    let mutable = false;
    if (/^mut\b/.test(source.slice(this.i)) && /^\s*\{/.test(source.slice(this.i + 3))) {
      mutable = true;
      this.i += 3;
      this.ws();
    }
    if (source[this.i] === '[') return this.array(start);
    if (source[this.i] === '{') return this.record(start, mutable);
    if (mutable) this.fail('mut without a record');
    return this.atom(start, top);
  }

  array(start) {
    const open = this.i;
    this.i += 1;
    const items = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === ']') break;
      items.push(this.value(false));
      this.ws();
      if (this.s[this.i] === ',') this.i += 1;
      else if (this.s[this.i] !== ']') this.fail('expected , or ]');
    }
    const close = this.i;
    this.i += 1;
    return { kind: 'array', start, end: this.i, open, close, items };
  }

  record(start, mutable) {
    const open = this.i;
    this.i += 1;
    const fields = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === '}') break;
      const keyStart = this.i;
      let key;
      if (this.s[this.i] === '"') {
        const end = this.stringEnd(this.i);
        key = JSON.parse(this.s.slice(this.i, end));
        this.i = end;
      } else {
        const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.s.slice(this.i));
        if (!match) this.fail('expected a field name');
        key = match[0];
        this.i += key.length;
      }
      const keyEnd = this.i;
      this.ws();
      if (this.s[this.i] !== ':') this.fail('expected : after a field name');
      this.i += 1;
      const value = this.value(false);
      fields.push({ key, keyStart, keyEnd, value });
      this.ws();
      if (this.s[this.i] === ',') this.i += 1;
      else if (this.s[this.i] !== '}') this.fail('expected , or }');
    }
    const close = this.i;
    this.i += 1;
    return { kind: 'record', start, end: this.i, open, close, mut: mutable, fields };
  }

  stringEnd(from) {
    let index = from + 1;
    while (index < this.s.length && this.s[index] !== '"') index += this.s[index] === '\\' ? 2 : 1;
    if (index >= this.s.length) this.fail('unterminated string');
    return index + 1;
  }

  atom(start, top) {
    const source = this.s;
    let depth = 0;
    let last = start;
    while (this.i < source.length) {
      const char = source[this.i];
      if (char === '"') {
        this.i = this.stringEnd(this.i);
        last = this.i;
        continue;
      }
      if (char === '/' && source[this.i + 1] === '/') {
        while (this.i < source.length && source[this.i] !== '\n') this.i += 1;
        continue;
      }
      if (char === '/' && source[this.i + 1] === '*') {
        const end = source.indexOf('*/', this.i + 2);
        this.i = end < 0 ? source.length : end + 2;
        continue;
      }
      if (char === '(' || char === '[' || char === '{') depth += 1;
      else if (char === ')' || char === ']' || char === '}') {
        if (depth === 0) break;
        depth -= 1;
      } else if (char === ',' && depth === 0) break;
      else if (char === '\n' && depth === 0 && top) break;
      if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') last = this.i + 1;
      this.i += 1;
    }
    if (last === start) this.fail('empty expression');
    this.i = last;
    return { kind: 'atom', start, end: last };
  }
}

class ExprParser {
  constructor(text, env) {
    this.text = text;
    this.env = env;
    this.i = 0;
  }

  skip() {
    while (this.i < this.text.length && /\s/.test(this.text[this.i])) this.i += 1;
  }

  peek() {
    this.skip();
    return this.text[this.i];
  }

  parseExpr() {
    let left = this.parseTerm();
    for (;;) {
      const op = this.peek();
      if (op !== '+' && op !== '-') break;
      this.i += 1;
      left = this.apply(op, left, this.parseTerm());
    }
    return left;
  }

  parseTerm() {
    let left = this.parseUnary();
    for (;;) {
      const op = this.peek();
      if (op !== '*' && op !== '/') break;
      this.i += 1;
      left = this.apply(op, left, this.parseUnary());
    }
    return left;
  }

  parseUnary() {
    if (this.peek() === '-') {
      this.i += 1;
      const inner = this.parseUnary();
      if (inner.type !== 'num') throw new Error('negation needs a number');
      return { type: 'num', value: -inner.value, directLiteral: false, refs: inner.refs || [] };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const char = this.peek();
    if (char === '(') {
      this.i += 1;
      const inner = this.parseExpr();
      if (this.peek() !== ')') throw new Error('expected )');
      this.i += 1;
      return { ...inner, directLiteral: false };
    }
    if (char === '"') return this.parseString();
    if (this.isNumber()) return this.parseNumber();
    if (this.isIdent()) return this.parsePath();
    throw new Error('expected a value');
  }

  parseString() {
    const start = this.i;
    let index = start + 1;
    while (index < this.text.length && this.text[index] !== '"') index += this.text[index] === '\\' ? 2 : 1;
    if (index >= this.text.length) throw new Error('unterminated string');
    const raw = this.text.slice(start, index + 1);
    this.i = index + 1;
    return { type: 'str', value: JSON.parse(raw), directLiteral: true, refs: [], expr: raw };
  }

  parseNumber() {
    const match = /^(\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(this.text.slice(this.i));
    if (!match) throw new Error('expected a number');
    this.i += match[0].length;
    return { type: 'num', value: Number(match[0]), directLiteral: true, refs: [], expr: match[0] };
  }

  parsePath() {
    const name = this.readIdent();
    if ((name === 'true' || name === 'false') && this.peek() !== '.') {
      return { type: 'bool', value: name === 'true', directLiteral: true, refs: [], expr: name };
    }
    let current = this.env.get(name);
    if (!current) throw new Error(`unknown name ${name}`);
    let path = name;
    while (this.peek() === '.') {
      this.i += 1;
      if (/^\d/.test(this.text.slice(this.i))) {
        const index = this.readInt();
        path += `.${index}`;
        if (current.type !== 'arr') throw new Error(`${path} is not a list`);
        current = current.items[index];
        if (!current) throw new Error(`${path} is out of range`);
      } else if (this.isIdent()) {
        const field = this.readIdent();
        path += `.${field}`;
        if (current.type !== 'rec') throw new Error(`${path} is not a record`);
        const found = current.fields.find((candidate) => candidate.key === field);
        if (!found) throw new Error(`no field ${path}`);
        current = found.value;
      } else throw new Error(`expected a field after ${path}`);
    }
    const refs = current.directLiteral && Number.isInteger(current.start)
      ? [{ path, start: current.start, end: current.end }]
      : (current.refs || []);
    return {
      type: current.type,
      value: current.value,
      items: current.items,
      fields: current.fields,
      directLiteral: false,
      refs,
      expr: path,
    };
  }

  apply(op, left, right) {
    if (left.type !== 'num' || right.type !== 'num') throw new Error('arithmetic needs numbers');
    if ((op === '/' ) && right.value === 0) throw new Error('division by zero');
    let value;
    if (op === '+') value = left.value + right.value;
    else if (op === '-') value = left.value - right.value;
    else if (op === '*') value = left.value * right.value;
    else value = left.value / right.value;
    return {
      type: 'num',
      value,
      directLiteral: false,
      refs: [...(left.refs || []), ...(right.refs || [])],
    };
  }

  isNumber() {
    return /^\d/.test(this.text.slice(this.i));
  }

  isIdent() {
    return /^[A-Za-z_]/.test(this.text.slice(this.i));
  }

  readIdent() {
    const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.i));
    if (!match) throw new Error('expected a name');
    this.i += match[0].length;
    return match[0];
  }

  readInt() {
    const match = /^\d+/.exec(this.text.slice(this.i));
    if (!match) throw new Error('expected an index');
    this.i += match[0].length;
    return Number(match[0]);
  }
}
