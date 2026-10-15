/**
 * Shared data contract between the three layers:
 *
 *   Extension Host  ──(TypeResolutionResult)──▶  InfoView webview
 *        ▲
 *        └── produced by the type server (mock now, real MLscript compiler later)
 *
 * Types are sent as a small JSON AST (NOT as pre-formatted strings) so the
 * webview can colour, parenthesise and (later) make individual nodes clickable.
 */

/** Structural type AST. `kind` is the discriminant. */
export type MlsType =
  | { kind: 'prim'; name: string }                       // int, string, num ...
  | { kind: 'lit'; value: string }                       // "success", 42
  | { kind: 'var'; name: string }                        // type variable α
  | { kind: 'ref'; name: string; role?: TypeRole }       // BaseTrait, MixinA ...
  | { kind: 'record'; fields: RecordField[] }            // { x: int, y: string }
  | { kind: 'fun'; params: MlsType[]; ret: MlsType }     // A -> B
  | { kind: 'union'; members: MlsType[] }                // A | B
  | { kind: 'inter'; members: MlsType[] };               // A & B

export type TypeRole = 'trait' | 'mixin' | 'class';

export interface RecordField {
  name: string;
  type: MlsType;
}

/** `variable :> type` (lower bound) or `variable <: type` (upper bound). */
export interface Bound {
  variable: string;
  relation: 'lower' | 'upper';
  type: MlsType;
}

/** One node of the mixin / trait composition chain. */
export interface HierarchyNode {
  name: string;
  kind: TypeRole;
  /** Members this component contributes (shown as chips). */
  members?: string[];
  /** Components applied on top of this one. */
  children: HierarchyNode[];
}

/** What `getStructuralTypeInfo` returns; one per cursor position. */
export interface TypeResolutionResult {
  /** 1-based line the answer is about (echoed back by the server). */
  line: number;
  /** Short human label, e.g. "Function definition". */
  label: string;
  /** Inferred type, or null if nothing could be inferred. */
  type: MlsType | null;
  /** Local constraints on type variables in scope. */
  bounds: Bound[];
  /** Mixin/trait composition for the current scope, if any. */
  hierarchy: HierarchyNode | null;
  /** Free-form notes from the server (fallbacks, warnings). */
  diagnostics: string[];
}

// ---------------------------------------------------------------------------
// Messages between Extension Host and Webview (the "RPC" over postMessage)
// ---------------------------------------------------------------------------

/** What the host knows about the cursor when it sends a request. */
export interface CursorContext {
  /** 0-based, as VS Code reports it. */
  line: number;
  character: number;
  /** Absolute character offset into the document. */
  offset: number;
  /** The "active expression": selection if non-empty, else the trimmed line. */
  expr: { text: string; startOffset: number; endOffset: number };
  fileName: string;
}

export type HostToWebview =
  | { type: 'pending'; requestId: number; cursor: CursorContext }
  | { type: 'update'; requestId: number; cursor: CursorContext; result: TypeResolutionResult; latencyMs: number }
  | { type: 'empty'; reason: string };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'reveal' }; // user clicked the expression header -> focus editor
