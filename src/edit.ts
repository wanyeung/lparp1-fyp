export type LiteralType = "number" | "string" | "boolean" | "null";

export type EditValue =
  | { text: string; error?: undefined }
  | { text?: undefined; error: string };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const INTEGER = /^[+-]?\d+$/;

/**
 * Turn what the user typed into a single MLscript literal.
 *
 * The original literal type is preserved. A string column stays a string
 * even when the user types 80; a number column rejects text instead of
 * silently turning the value into a string. The result is always one literal,
 * never an arbitrary expression.
 */
export function replacementFor(raw: string, literalType?: LiteralType): EditValue {
  const text = String(raw ?? "").trim();
  if (text === "") return { error: "Enter a value." };

  if (literalType === "number") {
    if (!NUMBER.test(text)) return { error: "Enter a number for this cell." };
    const normalized = text.replace(/^\+/, "");
    if (!Number.isFinite(Number(normalized))) return { error: "That number is not finite." };
    return { text: normalized };
  }
  if (literalType === "boolean") {
    if (text !== "true" && text !== "false") return { error: "Enter true or false." };
    return { text };
  }
  if (literalType === "null") {
    if (text !== "null") return { error: "This cell only accepts null." };
    return { text };
  }
  if (literalType === "string") {
    return { text: JSON.stringify(decodeQuoted(text) ?? text) };
  }

  if (text === "true" || text === "false" || text === "null") return { text };
  if (NUMBER.test(text)) {
    const normalized = text.replace(/^\+/, "");
    if (!Number.isFinite(Number(normalized))) return { error: "That number is not finite." };
    return { text: normalized };
  }
  return { text: JSON.stringify(decodeQuoted(text) ?? text) };
}

/** Decode a quoted string if the user typed one; otherwise return undefined. */
export function decodeQuoted(text: string): string | undefined {
  if (text.length < 2 || text[0] !== '"' || text[text.length - 1] !== '"') return undefined;
  try {
    const value = JSON.parse(text);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The value shown in an editor for a literal of this type. */
export function displayValue(value: unknown, literalType?: LiteralType): string {
  if (value === null || value === undefined) return "";
  if (literalType === "string") return String(value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value);
}

export function isIntegerLiteral(text: string): boolean {
  return INTEGER.test(text.trim());
}
