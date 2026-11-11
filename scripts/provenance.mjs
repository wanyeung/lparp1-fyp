/**
 * Static source provenance for Studio documents.
 *
 * hkmc2 executes the program and Render.model() returns the displayed values.
 * Those values no longer know which source literal produced them. This module
 * recovers that link for the small, deliberate Studio construction API:
 *
 *   val teams = CreateCell("teams", "Teams", ["team", "headcount"], [
 *     ["Engineering", 1 + 1],
 *     ["Design", 1]
 *   ])
 *
 * It parses every .mls module in the build, resolves module-qualified bindings
 * and simple record/list paths, and records the exact range of each editable
 * literal. Computed cells keep references to the literals they read.
 *
 * The analyzer never evaluates arbitrary MLscript. It only understands values,
 * lists, records, paths, calls and raw expressions. If anything is uncertain,
 * the cell is reported as read-only instead of being guessed at.
 */
import fs from "node:fs/promises";
import path from "node:path";

const TABLE_FUNCTIONS = {
  CreateCell: { id: 0, title: 1, headers: 2, rows: 3, derived: false },
  CreatCell: { id: 0, title: 1, headers: 2, rows: 3, derived: false },
  DeriveCell: { id: 0, title: 1, source: 2, headers: 3, rows: 4, derived: true },
};

const DIRECT_LITERAL = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$|^"(?:[^"\\]|\\.)*"$|^(?:true|false|null)$/;
const NUMBER_LITERAL = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const MAX_REFS = 40;
const MAX_DEPTH = 8;

export function isDirectLiteralText(text) {
  return DIRECT_LITERAL.test(String(text).trim());
}

export function decodeString(raw) {
  const text = String(raw);
  if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
    try { return JSON.parse(text); } catch { /* fall through */ }
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (text.length >= 2 && text[0] === "'" && text[text.length - 1] === "'") {
    return text.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }
  return text;
}

export function decimalsIn(text) {
  const match = /\.(\d+)/.exec(String(text).trim());
  return match ? match[1].length : 0;
}

/** A small MLscript-aware tokenizer. Comments are skipped; newlines are kept. */
export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const push = (type, start, end, value, raw) => {
    tokens.push({ type, start, end, line, value, raw: raw ?? source.slice(start, end) });
  };
  while (i < source.length) {
    const char = source[i];
    if (char === "\n") {
      push("newline", i, i + 1, "\n");
      i += 1;
      line += 1;
      continue;
    }
    if (char === "\r") { i += 1; continue; }
    if (char === " " || char === "\t" || char === "\f") { i += 1; continue; }
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const startLine = line;
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i = Math.min(source.length, i + 2);
      if (line !== startLine) {
        // Keep one newline token so value parsing still sees a line boundary.
        push("newline", i, i, "\n");
      }
      continue;
    }
    if (char === '"' && source.startsWith('"""', i)) {
      const start = i;
      i += 3;
      while (i < source.length && !source.startsWith('"""', i)) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i = Math.min(source.length, i + 3);
      const raw = source.slice(start, i);
      push("string", start, i, raw.slice(3, -3), raw);
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) { i += 1; break; }
        if (source[i] === "\n") break;
        i += 1;
      }
      const raw = source.slice(start, i);
      push("string", start, i, decodeString(raw), raw);
      continue;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i));
    if (number) {
      const start = i;
      i += number[0].length;
      push("number", start, i, Number(number[0]), number[0]);
      continue;
    }
    const ident = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(i));
    if (ident) {
      const start = i;
      i += ident[0].length;
      push("ident", start, i, ident[0], ident[0]);
      continue;
    }
    const multi = /^(?:\.\.\.|=>|->|==|!=|<=|>=|&&|\|\||::)/.exec(source.slice(i));
    if (multi) {
      const start = i;
      i += multi[0].length;
      push("punct", start, i, multi[0], multi[0]);
      continue;
    }
    const start = i;
    i += 1;
    push("punct", start, i, char, char);
  }
  tokens.push({ type: "eof", start: source.length, end: source.length, line, value: "", raw: "" });
  return tokens;
}

const OPERATORS = new Set(["+", "-", "*", "/", "%", "<", ">", "==", "!=", "<=", ">=", "&&", "||", "=>", "->", "::"]);
const CONTINUATION = new Set(["then", "else", "and", "or", "is"]);

class ValueParser {
  constructor(source, filePath, tokens, index) {
    this.source = source;
    this.filePath = filePath;
    this.tokens = tokens;
    this.i = index;
  }

  raw(offset = 0) { return this.tokens[this.i + offset] ?? this.tokens[this.tokens.length - 1]; }

  skipNewlines() {
    while (this.raw().type === "newline") this.i += 1;
  }

  significant(offset = 0) {
    let index = this.i;
    let seen = 0;
    while (index < this.tokens.length) {
      const token = this.tokens[index];
      if (token.type !== "newline") {
        if (seen === offset) return token;
        seen += 1;
      }
      index += 1;
    }
    return this.tokens[this.tokens.length - 1];
  }

  indexOfOffset(offset) {
    for (let index = 0; index < this.tokens.length; index += 1) {
      if (this.tokens[index].start >= offset) return index;
    }
    return this.tokens.length - 1;
  }

  parseValue(stops = new Set(), stopAtNewline = false) {
    this.skipNewlines();
    const startToken = this.raw();
    const startIndex = this.i;
    const start = startToken.start;
    let node;
    if (startToken.type === "punct" && startToken.value === "[") node = this.parseArray();
    else if (startToken.type === "punct" && startToken.value === "{") node = this.parseRecord(false);
    else if (startToken.type === "ident" && startToken.value === "mut" && this.significant(1).value === "{") {
      this.i += 1;
      node = this.parseRecord(true);
    } else if (startToken.type === "punct" && startToken.value === "(") node = this.parseParen();
    else if (startToken.type === "string" || startToken.type === "number") node = this.parseAtom();
    else if (startToken.type === "ident" && (startToken.value === "true" || startToken.value === "false" || startToken.value === "null")) node = this.parseAtom();
    else if (startToken.type === "punct" && startToken.value === "-" && this.significant(1).type === "number") node = this.parseAtom();
    else if (startToken.type === "ident") node = this.parsePathOrCall();
    else return this.parseRaw(start, stops, stopAtNewline);

    // A primary followed by an operator is a computed expression. Reset and
    // scan the whole expression so its source range is exact.
    const next = this.significant();
    if (next.type !== "eof" && !stops.has(next.value) && next.type !== "newline") {
      if (next.type === "punct" && next.value === "." && node.kind === "path") {
        node = this.parsePathContinuation(node);
      } else if (next.type === "punct" && next.value === "(" && node.kind === "path") {
        node = this.parseCall(node);
      } else if (OPERATORS.has(next.value) || CONTINUATION.has(next.value)) {
        this.i = startIndex;
        return this.parseRaw(start, stops, stopAtNewline);
      }
    }
    if (stopAtNewline && this.raw().type === "newline") return node;
    return node;
  }

  parseAtom() {
    const first = this.raw();
    const start = first.start;
    let sign = 1;
    if (first.type === "punct" && first.value === "-") {
      sign = -1;
      this.i += 1;
      this.skipNewlines();
    }
    const token = this.raw();
    if (token.type === "number") {
      this.i += 1;
      const raw = this.source.slice(start, token.end);
      return { kind: "literal", value: sign * Number(token.value), raw, start, end: token.end, literalType: "number" };
    }
    if (token.type === "string") {
      this.i += 1;
      const raw = this.source.slice(start, token.end);
      return { kind: "literal", value: token.value, raw, start, end: token.end, literalType: "string" };
    }
    if (token.type === "ident" && (token.value === "true" || token.value === "false" || token.value === "null")) {
      this.i += 1;
      const raw = this.source.slice(start, token.end);
      const value = token.value === "null" ? null : token.value === "true";
      return { kind: "literal", value, raw, start, end: token.end, literalType: token.value === "null" ? "null" : "boolean" };
    }
    this.i = this.indexOfOffset(start);
    return this.parseRaw(start, new Set(), false);
  }

  parsePathOrCall() {
    const startToken = this.raw();
    if (startToken.type !== "ident") return this.parseRaw(startToken.start, new Set(), false);
    this.i += 1;
    const node = {
      kind: "path",
      segments: [{ kind: "ident", name: startToken.value }],
      start: startToken.start,
      end: startToken.end,
      text: startToken.value,
    };
    this.parsePathContinuation(node);
    const next = this.significant();
    if (next.type === "punct" && next.value === "(") return this.parseCall(node);
    return node;
  }

  parsePathContinuation(node) {
    for (;;) {
      const next = this.significant();
      if (!(next.type === "punct" && next.value === ".")) break;
      this.i = this.tokens.indexOf(next) + 1;
      const segment = this.raw();
      if (segment.type === "number") {
        node.segments.push({ kind: "index", index: Number(segment.value) });
        node.end = segment.end;
        this.i += 1;
      } else if (segment.type === "ident" && segment.value === "at" && this.significant(1).value === "(") {
        this.i += 1;
        const open = this.raw();
        this.i += 1;
        const index = this.raw();
        if (index.type === "number") {
          node.segments.push({ kind: "index", index: Number(index.value) });
          this.i += 1;
        } else {
          node.segments.push({ kind: "dynamic" });
          break;
        }
        const close = this.raw();
        if (close.type === "punct" && close.value === ")") this.i += 1;
        node.end = close.end;
      } else if (segment.type === "ident") {
        node.segments.push({ kind: "field", name: segment.value });
        node.end = segment.end;
        this.i += 1;
      } else {
        break;
      }
      node.text = this.source.slice(node.start, node.end);
    }
    return node;
  }

  parseCall(callee) {
    const open = this.significant();
    this.i = this.tokens.indexOf(open) + 1;
    const args = [];
    for (;;) {
      this.skipNewlines();
      const token = this.raw();
      if (token.type === "eof") break;
      if (token.type === "punct" && token.value === ")") { this.i += 1; break; }
      args.push(this.parseValue(new Set([",", ")"]), false));
      this.skipNewlines();
      const separator = this.raw();
      if (separator.type === "punct" && separator.value === ",") { this.i += 1; continue; }
      if (separator.type === "punct" && separator.value === ")") { this.i += 1; break; }
      break;
    }
    const end = this.tokens[Math.max(0, this.i - 1)].end;
    return {
      kind: "call",
      callee,
      args,
      start: callee.start,
      end,
      text: this.source.slice(callee.start, end),
    };
  }

  parseArray() {
    const open = this.raw();
    this.i += 1;
    const items = [];
    let dynamic = false;
    for (;;) {
      this.skipNewlines();
      const token = this.raw();
      if (token.type === "eof") break;
      if (token.type === "punct" && token.value === "]") { this.i += 1; break; }
      if (token.type === "punct" && token.value === "...") {
        const spread = this.parseRaw(token.start, new Set([",", "]"]), false);
        items.push({ ...spread, kind: "spread" });
        dynamic = true;
      } else {
        items.push(this.parseValue(new Set([",", "]"]), false));
      }
      this.skipNewlines();
      const separator = this.raw();
      if (separator.type === "punct" && separator.value === ",") { this.i += 1; continue; }
      if (separator.type === "punct" && separator.value === "]") { this.i += 1; break; }
      break;
    }
    const end = this.tokens[Math.max(0, this.i - 1)].end;
    return { kind: "array", items, dynamic, start: open.start, end, text: this.source.slice(open.start, end) };
  }

  parseRecord(mutable) {
    const open = this.raw();
    this.i += 1;
    const fields = [];
    for (;;) {
      this.skipNewlines();
      const token = this.raw();
      if (token.type === "eof") break;
      if (token.type === "punct" && token.value === "}") { this.i += 1; break; }
      let key;
      let keyStart = token.start;
      let keyEnd = token.end;
      if (token.type === "string") { key = token.value; this.i += 1; }
      else if (token.type === "ident") { key = token.value; this.i += 1; }
      else break;
      this.skipNewlines();
      const colon = this.raw();
      if (colon.type === "punct" && colon.value === ":") this.i += 1;
      const value = this.parseValue(new Set([",", "}"]), false);
      fields.push({ key, keyStart, keyEnd, value });
      this.skipNewlines();
      const separator = this.raw();
      if (separator.type === "punct" && separator.value === ",") { this.i += 1; continue; }
      if (separator.type === "punct" && separator.value === "}") { this.i += 1; break; }
      break;
    }
    const end = this.tokens[Math.max(0, this.i - 1)].end;
    return { kind: "record", fields, mutable, start: open.start, end, text: this.source.slice(open.start, end) };
  }

  parseParen() {
    const open = this.raw();
    this.i += 1;
    const inner = this.parseValue(new Set([")"]), false);
    this.skipNewlines();
    const close = this.raw();
    if (close.type === "punct" && close.value === ")") this.i += 1;
    return { ...inner, parenthesized: true, outerStart: open.start, outerEnd: close.end };
  }

  parseRaw(start, stops, stopAtNewline) {
    const startIndex = this.indexOfOffset(start);
    this.i = startIndex;
    let depth = 0;
    let last = start;
    let previous = null;
    while (this.i < this.tokens.length) {
      const token = this.raw();
      if (token.type === "eof") break;
      if (token.type === "newline") {
        if (depth === 0 && stopAtNewline) {
          const next = this.significant();
          const continues = previous && OPERATORS.has(previous.value)
            || next && (OPERATORS.has(next.value) || next.value === "." || CONTINUATION.has(next.value));
          if (!continues) break;
        }
        this.i += 1;
        continue;
      }
      if (depth === 0 && stops.has(token.value)) break;
      if (token.type === "punct") {
        if (token.value === "(" || token.value === "[" || token.value === "{") depth += 1;
        else if (token.value === ")" || token.value === "]" || token.value === "}") {
          if (depth === 0) break;
          depth -= 1;
        }
      }
      last = token.end;
      previous = token;
      this.i += 1;
    }
    const text = this.source.slice(start, last).trim();
    const end = start + text.length;
    return { kind: "expr", text, start, end };
  }
}

function lineData(source) {
  const lines = [];
  let start = 0;
  const parts = source.split("\n");
  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index].replace(/\r$/, "");
    lines.push({ text, start, end: start + text.length, indent: (/^[ \t]*/.exec(text) ?? [""])[0].length });
    start += parts[index].length + 1;
  }
  return lines;
}

function isBlankOrComment(text) {
  return /^\s*(?:\/\/.*)?$/.test(text);
}

/** Parse modules, value bindings, and imports from one MLscript file. */
export function parseModuleFile(source, filePath) {
  const tokens = tokenize(source);
  const lines = lineData(source);
  const modules = [];
  const warnings = [];

  // Module headers are indentation-based in MLscript.
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([ \t]*)module\s+([A-Za-z_$][\w$]*)\s+with\s*(?:\/\/.*)?$/.exec(lines[index].text);
    if (!match) continue;
    const indent = match[1].length;
    let endLine = lines.length;
    for (let scan = index + 1; scan < lines.length; scan += 1) {
      if (isBlankOrComment(lines[scan].text)) continue;
      if (lines[scan].indent <= indent) { endLine = scan; break; }
    }
    let bodyIndent = null;
    for (let scan = index + 1; scan < endLine; scan += 1) {
      if (isBlankOrComment(lines[scan].text)) continue;
      bodyIndent = lines[scan].indent;
      break;
    }
    modules.push({
      name: match[2],
      file: filePath,
      start: lines[index].start,
      end: endLine < lines.length ? lines[endLine].start : source.length,
      startLine: index,
      endLine,
      indent,
      bodyIndent,
      bindings: [],
    });
  }

  const moduleAt = (offset) => {
    let found = null;
    for (const module of modules) {
      if (module.start <= offset && offset < module.end) {
        if (!found || module.indent > found.indent) found = module;
      }
    }
    return found;
  };

  const imports = [];
  for (const line of lines) {
    const match = /^\s*import\s+["']([^"'\r\n]+\.mls)["']/.exec(line.text);
    if (match) imports.push({ specifier: match[1], file: path.resolve(path.dirname(filePath), match[1]) });
  }

  // Value bindings. Only accept the body indentation of a module (or column 0
  // at top level) so `val`s nested inside functions are not treated as data.
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^([ \t]*)(val|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\r\n]+)?=\s*/.exec(line.text);
    if (!match) continue;
    const indent = match[1].length;
    const module = moduleAt(line.start);
    const expected = module ? module.bodyIndent : 0;
    if (expected == null || indent !== expected) continue;
    const valueStart = line.start + match[0].length;
    const parser = new ValueParser(source, filePath, tokens, 0);
    const tokenIndex = parser.indexOfOffset(valueStart);
    const valueParser = new ValueParser(source, filePath, tokens, tokenIndex);
    let node;
    try {
      node = valueParser.parseValue(new Set(), true);
    } catch (error) {
      warnings.push(`${path.basename(filePath)}:${index + 1}: could not parse val ${match[3]}: ${error.message}`);
      continue;
    }
    const binding = {
      name: match[3],
      file: filePath,
      module: module ? module.name : "",
      node,
      start: line.start,
      end: node.end,
      line: index + 1,
    };
    if (module) module.bindings.push(binding);
    else {
      // Top-level bindings are kept in a synthetic module named "".
      let top = modules.find((candidate) => candidate.name === "" && candidate.file === filePath);
      if (!top) {
        top = { name: "", file: filePath, start: 0, end: source.length, indent: -1, bodyIndent: 0, bindings: [] };
        modules.push(top);
      }
      top.bindings.push(binding);
    }
  }

  return { filePath, source, modules, imports, warnings };
}

function sameValue(left, right) {
  if (typeof left === "number" && typeof right === "number") return left === right || (Number.isNaN(left) && Number.isNaN(right));
  return left === right;
}

function literalFromNode(node) {
  if (!node) return null;
  if (node.kind === "literal") return node;
  if (node.kind === "expr" && isDirectLiteralText(node.text)) {
    const text = node.text.trim();
    let value;
    let literalType;
    if (NUMBER_LITERAL.test(text)) { value = Number(text); literalType = "number"; }
    else if (text === "true" || text === "false") { value = text === "true"; literalType = "boolean"; }
    else if (text === "null") { value = null; literalType = "null"; }
    else if (text.startsWith('"') || text.startsWith("'")) { value = decodeString(text); literalType = "string"; }
    else return null;
    return { kind: "literal", value, raw: text, start: node.start, end: node.start + text.length, literalType };
  }
  return null;
}

function refFor(node, file) {
  return {
    file,
    start: node.start,
    end: node.end,
    text: node.raw,
    value: node.value,
    literalType: node.literalType,
  };
}

const EXPR_KEYWORDS = new Set(["if", "then", "else", "true", "false", "null", "and", "or", "is", "mut"]);

function literalFromToken(token, node) {
  if (token.type === "number") {
    return { kind: "literal", value: Number(token.value), raw: token.raw, start: node.start + token.start, end: node.start + token.end, literalType: "number" };
  }
  if (token.type === "string") {
    return { kind: "literal", value: token.value, raw: token.raw, start: node.start + token.start, end: node.start + token.end, literalType: "string" };
  }
  if (token.type === "ident" && (token.value === "true" || token.value === "false" || token.value === "null")) {
    return {
      kind: "literal",
      value: token.value === "null" ? null : token.value === "true",
      raw: token.raw,
      start: node.start + token.start,
      end: node.start + token.end,
      literalType: token.value === "null" ? "null" : "boolean",
    };
  }
  return null;
}

/**
 * Reads a dotted/indexed path from the expression token stream, so computed
 * references such as `Subscription.price` and `students.0.quiz` resolve to
 * their actual bindings instead of being mistaken for bare identifiers.
 */
function pathFromTokens(tokens, startIndex, node) {
  const first = tokens[startIndex];
  if (!first || first.type !== "ident") return null;
  const segments = [{ kind: "ident", name: first.value }];
  let index = startIndex + 1;
  let last = first;
  while (true) {
    let dot = index;
    while (tokens[dot] && tokens[dot].type === "newline") dot += 1;
    if (!tokens[dot] || tokens[dot].type !== "punct" || tokens[dot].value !== ".") break;
    let next = dot + 1;
    while (tokens[next] && tokens[next].type === "newline") next += 1;
    const field = tokens[next];
    if (!field) break;
    if (field.type === "ident") {
      segments.push({ kind: "field", name: field.value });
      last = field;
      index = next + 1;
      continue;
    }
    if (field.type === "number") {
      segments.push({ kind: "index", index: Number(field.value) });
      last = field;
      index = next + 1;
      continue;
    }
    break;
  }
  if (segments.length === 1) return null;
  const text = node.text.slice(first.start, last.end);
  return {
    node: { kind: "path", segments, start: node.start + first.start, end: node.start + last.end, text },
    nextIndex: index,
  };
}

function dedupeRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.file}:${ref.start}:${ref.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

class Resolver {
  constructor(parsedFiles) {
    this.parsedFiles = parsedFiles;
    this.modules = new Map();
    this.topBindings = new Map();
    this.warnings = [];
    for (const parsed of parsedFiles) {
      for (const module of parsed.modules) {
        if (!this.modules.has(module.name)) this.modules.set(module.name, []);
        this.modules.get(module.name).push({ module, parsed });
        for (const binding of module.bindings) {
          if (!module.name) {
            if (!this.topBindings.has(binding.name)) this.topBindings.set(binding.name, []);
            this.topBindings.get(binding.name).push(binding);
          }
        }
      }
    }
  }

  moduleFor(name) {
    const candidates = this.modules.get(name) || [];
    const unique = candidates.filter((candidate, index) => candidates.findIndex((other) => other.module.file === candidate.module.file) === index);
    return unique.length === 1 ? unique[0] : null;
  }

  bindingIn(moduleName, name) {
    const module = this.moduleFor(moduleName);
    if (!module) return null;
    return module.module.bindings.find((binding) => binding.name === name) || null;
  }

  resolveName(name, contextModule) {
    if (contextModule) {
      const local = this.bindingIn(contextModule, name);
      if (local) return local;
    }
    const top = this.topBindings.get(name) || [];
    if (top.length === 1) return top[0];
    const all = [];
    for (const candidates of this.modules.values()) {
      for (const { module } of candidates) {
        const found = module.bindings.find((binding) => binding.name === name);
        if (found) all.push(found);
      }
    }
    const unique = all.filter((binding, index) => all.findIndex((other) => other.file === binding.file && other.start === binding.start) === index);
    return unique.length === 1 ? unique[0] : null;
  }

  resolvePath(node, context = {}) {
    if (!node || node.kind !== "path") return { node, file: context.file, module: context.module || "" };
    const segments = node.segments;
    if (!segments.length || segments[0].kind !== "ident") return null;
    let binding;
    let index = 1;
    const qualified = segments.length >= 2 && segments[1].kind === "field" && this.moduleFor(segments[0].name);
    if (qualified) {
      binding = this.bindingIn(segments[0].name, segments[1].name);
      index = 2;
    } else {
      binding = this.resolveName(segments[0].name, context.module || "");
    }
    if (!binding) return null;
    let current = binding.node;
    let file = binding.file;
    let module = binding.module;
    let currentBinding = binding;
    const follow = () => {
      let guard = 0;
      while (current && current.kind === "path" && guard < MAX_DEPTH) {
        const next = this.resolvePath(current, { file, module });
        if (!next || next.node === current) break;
        current = next.node;
        file = next.file;
        module = next.module;
        currentBinding = next.binding || currentBinding;
        guard += 1;
      }
    };
    follow();
    for (; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.kind === "field" && current.kind === "record") {
        const field = current.fields.find((candidate) => candidate.key === segment.name);
        if (!field) return null;
        current = field.value;
      } else if (segment.kind === "index" && current.kind === "array") {
        const item = current.items[segment.index];
        if (!item) return null;
        current = item;
      } else if (segment.kind === "dynamic") {
        return null;
      } else {
        return null;
      }
      follow();
    }
    return { node: current, file, module, binding: currentBinding };
  }

  collectRefs(node, context = {}, depth = 0, seen = new Set()) {
    if (!node || depth > MAX_DEPTH) return [];
    if (node.kind === "literal") {
      const ref = refFor(node, context.file);
      return [ref];
    }
    if (node.kind === "path") {
      const resolved = this.resolvePath(node, context);
      if (!resolved) return [];
      const key = `${resolved.file}:${resolved.node.start}:${resolved.node.end}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return this.collectRefs(resolved.node, { file: resolved.file, module: resolved.module }, depth + 1, seen).slice(0, MAX_REFS);
    }
    if (node.kind === "expr") {
      const refs = [];
      const tokens = tokenize(node.text);
      let previous = null;
      let index = 0;
      while (index < tokens.length) {
        const token = tokens[index];
        if (token.type === "newline") { index += 1; continue; }
        const literal = literalFromToken(token, node);
        if (literal) {
          if (!(previous && previous.type === "punct" && previous.value === ".")) refs.push(refFor(literal, context.file));
          previous = token;
          index += 1;
          continue;
        }
        if (token.type === "ident" && !EXPR_KEYWORDS.has(token.value) && !(previous && previous.type === "punct" && previous.value === ".")) {
          const path = pathFromTokens(tokens, index, node);
          const resolved = path ? this.resolvePath(path.node, context) : null;
          if (path && resolved) {
            const key = `${resolved.file}:${resolved.node.start}:${resolved.node.end}`;
            if (!seen.has(key)) {
              seen.add(key);
              if (resolved.node.kind === "literal") refs.push(refFor(resolved.node, resolved.file));
              else refs.push(...this.collectRefs(resolved.node, { file: resolved.file, module: resolved.module }, depth + 1, seen));
            }
            index = path.nextIndex;
            previous = tokens[path.nextIndex - 1] || token;
            continue;
          }
          const binding = this.resolveName(token.value, context.module || "");
          if (binding) {
            const key = `${binding.file}:${binding.start}:${binding.end}`;
            if (!seen.has(key)) {
              seen.add(key);
              refs.push(...this.collectRefs(binding.node, { file: binding.file, module: binding.module }, depth + 1, seen));
            }
          }
        }
        previous = token;
        index += 1;
      }
      return dedupeRefs(refs).slice(0, MAX_REFS);
    }
    if (node.kind === "array") {
      return node.items.flatMap((item) => this.collectRefs(item, context, depth + 1, seen)).slice(0, MAX_REFS);
    }
    if (node.kind === "record") {
      return node.fields.flatMap((field) => this.collectRefs(field.value, context, depth + 1, seen)).slice(0, MAX_REFS);
    }
    if (node.kind === "call") {
      return node.args.flatMap((arg) => this.collectRefs(arg, context, depth + 1, seen)).slice(0, MAX_REFS);
    }
    return [];
  }

  cellProvenance(node, context) {
    const direct = literalFromNode(node);
    if (direct) {
      return {
        editable: true,
        file: context.file,
        start: direct.start,
        end: direct.end,
        expected: direct.raw,
        literalValue: direct.value,
        literalType: direct.literalType,
        decimals: direct.literalType === "number" ? decimalsIn(direct.raw) : 0,
        expr: direct.raw,
        refs: [],
      };
    }
    if (node.kind === "path") {
      const resolved = this.resolvePath(node, context);
      if (resolved) {
        const target = literalFromNode(resolved.node);
        if (target) {
          return {
            editable: true,
            file: resolved.file,
            start: target.start,
            end: target.end,
            expected: target.raw,
            literalValue: target.value,
            literalType: target.literalType,
            decimals: target.literalType === "number" ? decimalsIn(target.raw) : 0,
            expr: node.text,
            via: node.text,
            refs: [],
          };
        }
        return {
          editable: false,
          expr: resolved.node.kind === "expr" ? resolved.node.text : node.text,
          targetKind: resolved.node.kind,
          refs: this.collectRefs(resolved.node, { file: resolved.file, module: resolved.module }),
        };
      }
      return { editable: false, expr: node.text, refs: [] };
    }
    return {
      editable: false,
      expr: node.text,
      targetKind: node.kind,
      refs: this.collectRefs(node, context),
    };
  }
}

function resolveArray(resolver, node, context) {
  const resolved = node && node.kind === "path" ? resolver.resolvePath(node, context) : { node, file: context.file, module: context.module };
  if (!resolved || !resolved.node || resolved.node.kind !== "array") return null;
  const items = [];
  for (const item of resolved.node.items) {
    if (item.kind === "spread") return null;
    const row = item.kind === "path" ? resolver.resolvePath(item, { file: resolved.file, module: resolved.module }) : { node: item, file: resolved.file, module: resolved.module };
    if (!row || !row.node || row.node.kind !== "array") return null;
    if (row.node.items.some((cell) => cell.kind === "spread")) return null;
    items.push({
      file: row.file,
      module: row.module,
      cells: row.node.items.map((cell) => ({ node: cell, file: row.file, module: row.module })),
    });
  }
  return { file: resolved.file, module: resolved.module, rows: items };
}

/** Resolve a path to a list value without requiring every item to be a row. */
function resolveList(resolver, node, context) {
  const resolved = node && node.kind === "path" ? resolver.resolvePath(node, context) : { node, file: context.file, module: context.module };
  if (!resolved || !resolved.node || resolved.node.kind !== "array") return null;
  return { node: resolved.node, file: resolved.file, module: resolved.module };
}

function stringLiteral(resolver, node, context) {
  const resolved = node && node.kind === "path" ? resolver.resolvePath(node, context) : { node, file: context.file, module: context.module };
  if (!resolved || !resolved.node) return null;
  const literal = literalFromNode(resolved.node);
  return literal && literal.literalType === "string" ? { value: literal.value, file: resolved.file, node: literal } : null;
}

/** Find every Studio table constructor in the parsed module graph. */
export function collectTableSites(parsedFiles) {
  const resolver = new Resolver(parsedFiles);
  const sites = [];
  for (const parsed of parsedFiles) {
    const tokens = tokenize(parsed.source);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type !== "ident" || !Object.hasOwn(TABLE_FUNCTIONS, token.value)) continue;
      let nextIndex = index + 1;
      while (tokens[nextIndex] && tokens[nextIndex].type === "newline") nextIndex += 1;
      const next = tokens[nextIndex];
      if (!next || next.value !== "(") continue;
      let previous = null;
      for (let scan = index - 1; scan >= 0; scan -= 1) {
        if (tokens[scan].type !== "newline") { previous = tokens[scan]; break; }
      }
      if (previous && previous.type === "ident" && (previous.value === "fun" || previous.value === "val" || previous.value === "let")) continue;
      const module = parsed.modules.find((candidate) => candidate.start <= token.start && token.start < candidate.end && candidate.name) || null;
      const context = { file: parsed.filePath, module: module ? module.name : "" };
      // Position the parser on the opening parenthesis and parse the arguments.
      const callParser = new ValueParser(parsed.source, parsed.filePath, tokens, nextIndex + 1);
      const args = [];
      try {
        for (;;) {
          callParser.skipNewlines();
          const current = callParser.raw();
          if (current.type === "eof") break;
          if (current.type === "punct" && current.value === ")") break;
          args.push(callParser.parseValue(new Set([",", ")"]), false));
          callParser.skipNewlines();
          const separator = callParser.raw();
          if (separator.type === "punct" && separator.value === ",") { callParser.i += 1; continue; }
          break;
        }
      } catch (error) {
        continue;
      }
      const spec = TABLE_FUNCTIONS[token.value];
      const id = stringLiteral(resolver, args[spec.id], context);
      const title = stringLiteral(resolver, args[spec.title], context);
      const headersResolved = resolveList(resolver, args[spec.headers], context);
      const rowsResolved = resolveArray(resolver, args[spec.rows], context);
      if (!id || !title || !headersResolved || !rowsResolved) continue;
      const headers = [];
      let headersOk = true;
      for (const item of headersResolved.node.items) {
        const literal = literalFromNode(item);
        if (!literal || literal.literalType !== "string") { headersOk = false; break; }
        headers.push(literal.value);
      }
      if (!headersOk || !headers.length) continue;
      sites.push({
        id: id.value,
        title: title.value,
        file: parsed.filePath,
        module: context.module,
        callStart: token.start,
        callEnd: tokens[callParser.i]?.end ?? token.end,
        headers,
        rows: rowsResolved.rows.map((row) => row.cells),
        rowsFile: rowsResolved.file,
        rowsModule: rowsResolved.module,
        derived: spec.derived,
        resolver,
      });
    }
  }
  return { sites, resolver };
}

function relativeLabel(file, root) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  return relative && !relative.startsWith("..") ? relative : path.basename(file);
}

/**
 * Join the runtime model to source ranges.
 *
 * @param {{entryFile:string, dependencies:string[], model:any}} input
 */
export async function analyzeProvenance({ entryFile, dependencies, model }) {
  const entry = path.resolve(entryFile);
  const files = [...new Set([entry, ...(dependencies || []).map((file) => path.resolve(file))])];
  const parsedFiles = [];
  const warnings = [];
  for (const file of files) {
    try {
      const source = await fs.readFile(file, "utf8");
      const parsed = parseModuleFile(source, file);
      parsedFiles.push(parsed);
      warnings.push(...parsed.warnings);
    } catch (error) {
      warnings.push(`Could not read ${path.basename(file)}: ${error.message}`);
    }
  }
  const { sites, resolver } = collectTableSites(parsedFiles);
  const byId = new Map();
  for (const site of sites) {
    if (!byId.has(site.id)) byId.set(site.id, []);
    byId.get(site.id).push(site);
  }
  const siteFor = (id) => {
    const candidates = byId.get(id) || [];
    return candidates.length === 1 ? candidates[0] : null;
  };

  const tableSites = new Map();
  for (const [id, candidates] of byId) {
    if (candidates.length !== 1) {
      warnings.push(`Table id "${id}" is constructed ${candidates.length} times; its cells stay read-only.`);
      continue;
    }
    const site = candidates[0];
    const rows = site.rows.map((row, rowIndex) => row.map((cell, columnIndex) => ({
      ...resolver.cellProvenance(cell.node, { file: cell.file, module: cell.module }),
      row: rowIndex,
      column: columnIndex,
    })));
    tableSites.set(id, {
      id,
      title: site.title,
      file: site.file,
      module: site.module,
      headers: site.headers,
      rows,
      derived: site.derived,
      rowsFile: site.rowsFile,
    });
  }

  const tables = {};
  const runtimeTables = new Map((model?.items || []).filter((item) => item.kind === "table").map((item) => [item.id, item]));
  for (const item of model?.items || []) {
    if (item.kind !== "table") continue;
    const site = tableSites.get(item.id);
    if (!site) {
      tables[item.id] = {
        id: item.id,
        title: item.name,
        editable: false,
        reason: "No unique CreateCell source was found for this table.",
        headers: item.headers,
        rows: item.rows.map((row, rowIndex) => row.map((_, columnIndex) => ({ row: rowIndex, column: columnIndex, editable: false, refs: [] }))),
      };
      continue;
    }
    const headerMatches = site.headers.length === item.headers.length && site.headers.every((header, index) => header === item.headers[index]);
    const rowMatches = site.rows.length === item.rows.length;
    const rows = site.rows.map((row, rowIndex) => row.map((cell, columnIndex) => {
      const runtime = item.rows[rowIndex]?.[columnIndex];
      if (!headerMatches || !rowMatches) {
        return { ...cell, editable: false, reason: "Source table shape does not match the executed model.", refs: cell.refs || [] };
      }
      if (cell.editable && !sameValue(cell.literalValue, runtime)) {
        return { ...cell, editable: false, reason: "The executed value does not match this source literal.", refs: [] };
      }
      return cell;
    }));
    tables[item.id] = {
      id: item.id,
      title: item.name,
      file: site.file,
      module: site.module,
      headers: item.headers,
      rows,
      derived: site.derived,
      warnings: headerMatches && rowMatches ? [] : ["Source table shape does not match the executed model."],
    };
  }

  const charts = {};
  for (const item of model?.items || []) {
    if (item.kind !== "chart") continue;
    const site = tableSites.get(item.sourceTableId);
    const chart = {
      id: item.id,
      title: item.name,
      chartType: item.chartType,
      sourceTableId: item.sourceTableId,
      sourceName: item.sourceName,
      x: item.x,
      y: item.y,
      bars: [],
      series: [],
      warnings: [],
    };
    if (!site) {
      chart.warnings.push("The chart source table has no unique CreateCell source.");
      if (item.data) chart.bars = item.data.map((datum, index) => ({ label: datum.label, value: datum.value, index, editable: false, refs: [] }));
      charts[item.id] = chart;
      continue;
    }
    const xIndex = site.headers.indexOf(item.x);
    const yIndex = site.headers.indexOf(item.y);
    const runtimeTable = runtimeTables.get(item.sourceTableId);
    if (item.chartType === "line") {
      const columns = Array.isArray(item.y) ? item.y : [item.y];
      for (const [seriesIndex, series] of (item.series || []).entries()) {
        const column = columns[seriesIndex];
        const columnIndex = site.headers.indexOf(column);
        const points = (series.points || []).map((point, pointIndex) => {
          let cell = null;
          if (runtimeTable && xIndex >= 0 && columnIndex >= 0) {
            const matches = [];
            runtimeTable.rows.forEach((row, rowIndex) => {
              if (Number(row[xIndex]) === point.x && Number(row[columnIndex]) === point.y) matches.push(rowIndex);
            });
            if (matches.length === 1) cell = site.rows[matches[0]]?.[columnIndex] ?? null;
          }
          return {
            x: point.x,
            y: point.y,
            pointIndex,
            seriesIndex,
            row: cell?.row,
            column: cell?.column,
            editable: Boolean(cell?.editable),
            ...(cell || { refs: [] }),
          };
        });
        chart.series.push({ name: series.name, y: column, points });
      }
      charts[item.id] = chart;
      continue;
    }
    const data = item.data || [];
    if (xIndex < 0 || yIndex < 0) chart.warnings.push("Chart x/y columns are not present in the source table.");
    chart.bars = data.map((datum, index) => {
      const cell = site.rows[index]?.[yIndex];
      if (!cell) return { label: datum.label, value: datum.value, index, editable: false, refs: [] };
      if (cell.editable && !sameValue(cell.literalValue, datum.value)) {
        return { ...cell, label: datum.label, value: datum.value, index, editable: false, reason: "The executed value does not match this source literal.", refs: [] };
      }
      return { ...cell, label: datum.label, value: datum.value, index };
    });
    charts[item.id] = chart;
  }

  return {
    version: 1,
    entryFile: entry,
    files: files.map((file) => ({ path: file, label: relativeLabel(file, path.dirname(entry)), isEntry: file === entry })),
    tables,
    charts,
    warnings: [...new Set(warnings)].slice(0, 50),
  };
}
