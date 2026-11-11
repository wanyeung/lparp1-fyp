export type DocumentTable = {
  id: string;
  kind: "table";
  name: string;
  headers: string[];
  rows: string[][];
  startLine: number;
};

export type ChartType = "bar" | "pie";

export type DocumentChart = {
  id: string;
  kind: "chart";
  name: string;
  chartType: ChartType;
  sourceName: string;
  sourceTableId?: string;
  x: string;
  y: string;
  startLine: number;
};

export type DocumentItem = DocumentTable | DocumentChart;

export type DocumentModel = {
  items: DocumentItem[];
  order: string[];
};

/**
 * Reads presentation metadata embedded in normal MLscript comments.
 *
 * The blocks do not affect hkmc2 compilation:
 *
 * // @table Employees
 * // id,name,team
 * // 1,Ada,Engineering
 * // @endtable
 *
 * // @chart Team Headcount
 * // type: bar
 * // source: Teams
 * // x: team
 * // y: headcount
 * // @endchart
 *
 * // @order table:employees, table:teams, chart:team-headcount
 */
export function parseDocumentModel(source: string): DocumentModel {
  const lines = source.split(/\r?\n/);
  const items: DocumentItem[] = [];
  let explicitOrder: string[] = [];
  let table: Omit<DocumentTable, "id" | "kind"> | undefined;
  let chart: Omit<DocumentChart, "id" | "kind" | "chartType" | "sourceName" | "x" | "y"> & Partial<Pick<DocumentChart, "chartType" | "sourceName" | "x" | "y">> | undefined;
  const usedIds = new Set<string>();

  const pushTable = () => {
    if (!table || !table.headers.length) return;
    const id = uniqueId(`table:${slugify(table.name)}`, usedIds);
    items.push({ ...table, id, kind: "table" });
    table = undefined;
  };
  const pushChart = () => {
    if (!chart) return;
    const id = uniqueId(`chart:${slugify(chart.name)}`, usedIds);
    items.push({
      id,
      kind: "chart",
      name: chart.name,
      chartType: chart.chartType === "pie" ? "pie" : "bar",
      sourceName: chart.sourceName ?? "",
      x: chart.x ?? "",
      y: chart.y ?? "",
      startLine: chart.startLine,
    });
    chart = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const comment = lines[index].match(/^\s*\/\/\s?(.*)$/)?.[1] ?? "";
    const order = comment.match(/^@order\s+(.+?)\s*$/i);
    if (order) {
      explicitOrder = order[1].split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }

    const tableStart = comment.match(/^@table\s+(.+?)\s*$/i);
    if (tableStart) {
      pushTable();
      pushChart();
      table = { name: tableStart[1], headers: [], rows: [], startLine: index };
      continue;
    }
    if (/^@endtable\s*$/i.test(comment)) {
      pushTable();
      continue;
    }

    const chartStart = comment.match(/^@chart\s+(.+?)\s*$/i);
    if (chartStart) {
      pushTable();
      pushChart();
      chart = { name: chartStart[1], startLine: index };
      continue;
    }
    if (/^@endchart\s*$/i.test(comment)) {
      pushChart();
      continue;
    }

    if (table && comment.trim()) {
      const values = parseCsvLine(comment);
      if (!table.headers.length) table.headers = values;
      else if (values.length) table.rows.push(values);
      continue;
    }

    if (chart && comment.trim()) {
      const property = comment.match(/^(type|source|x|y)\s*:\s*(.*?)\s*$/i);
      if (property) {
        const key = property[1].toLowerCase();
        const value = property[2];
        if (key === "type") chart.chartType = value.toLowerCase() === "pie" ? "pie" : "bar";
        else if (key === "source") chart.sourceName = value;
        else if (key === "x") chart.x = value;
        else if (key === "y") chart.y = value;
      }
    }
  }

  pushTable();
  pushChart();

  const tables = items.filter((item): item is DocumentTable => item.kind === "table");
  const tableIdByName = new Map(tables.map((item) => [slugify(item.name), item.id]));
  const resolved = items.map((item) => item.kind === "chart"
    ? { ...item, sourceTableId: tableIdByName.get(slugify(item.sourceName)) }
    : item);
  const order = normalizedOrder(explicitOrder, resolved);
  const position = new Map(order.map((id, index) => [id, index]));
  resolved.sort((left, right) => (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(right.id) ?? Number.MAX_SAFE_INTEGER));

  return { items: resolved, order };
}

/** Kept for callers that only need table content. */
export function parseDocumentTables(source: string): DocumentTable[] {
  return parseDocumentModel(source).items.filter((item): item is DocumentTable => item.kind === "table");
}

/**
 * Rewrites only the presentation order directive. The returned text remains
 * valid MLscript because the directive stays inside a line comment.
 */
export function rewriteDocumentOrder(source: string, requestedOrder: string[]): string {
  const model = parseDocumentModel(source);
  const order = normalizedOrder(requestedOrder, model.items);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const directive = `// @order ${order.join(", ")}`;
  const orderLine = lines.findIndex((line) => /^\s*\/\/\s*@order\b/i.test(line));

  if (orderLine >= 0) {
    lines[orderLine] = directive;
  } else {
    const firstArtifact = lines.findIndex((line) => /^\s*\/\/\s*@(table|chart)\b/i.test(line));
    const insertionPoint = firstArtifact >= 0 ? firstArtifact : lines.length;
    lines.splice(insertionPoint, 0, directive, "");
  }
  return lines.join(newline);
}

function normalizedOrder(requestedOrder: string[], items: DocumentItem[]): string[] {
  const known = new Set(items.map((item) => item.id));
  const selected = requestedOrder.filter((id, index) => known.has(id) && requestedOrder.indexOf(id) === index);
  return [...selected, ...items.map((item) => item.id).filter((id) => !selected.includes(id))];
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

/** Library mode data is produced by execution, never extracted from comments. */
export function usesDocumentLibrary(source: string): boolean {
  return /^\s*import\s+["'][^"'\r\n]*Studio\.mls["']/m.test(source)
    || /\b(?:Display|DisplayOrdered|Model|ModelOrdered)\s*\(/.test(source);
}

export function rewriteDisplayOrder(source: string, ids: string[]): string {
  // Intentionally supports one explicit literal, not arbitrary program rewriting.
  const pattern = /(^[ \t]*val[ \t]+displayOrder[ \t]*=[ \t]*)\[(?:[ \t\r\n]*"(?:[^"\\]|\\.)*"[ \t\r\n]*,?)*[ \t\r\n]*\]/gm;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error('To enable reordering, define one `val displayOrder = ["id", ...]` literal and pass it to Display and Model.');
  }
  if (!ids.every(id => typeof id === "string")) throw new Error("Invalid document order.");
  return source.replace(pattern, (_, prefix) => prefix + JSON.stringify([...new Set(ids)]));
}
