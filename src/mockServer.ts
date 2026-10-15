/**
 * MOCK MLscript type-inference backend.
 *
 * Everything the rest of the extension knows about "the compiler" is the two
 * exports below. To go real later, replace the body of `requestTypeInfo`
 * (e.g. spawn the MLscript compiler / language server and speak JSON-RPC) and
 * keep the signature; extension.ts and the webview do not change.
 */
import { Bound, HierarchyNode, MlsType, TypeResolutionResult } from './types';

// --- tiny builders to keep the fixtures readable ---------------------------
const prim = (name: string): MlsType => ({ kind: 'prim', name });
const lit = (value: string): MlsType => ({ kind: 'lit', value });
const ref = (name: string, role?: 'trait' | 'mixin' | 'class'): MlsType => ({ kind: 'ref', name, role });
const rec = (fields: Record<string, MlsType>): MlsType => ({
  kind: 'record',
  fields: Object.entries(fields).map(([name, type]) => ({ name, type })),
});
const fun = (params: MlsType[], ret: MlsType): MlsType => ({ kind: 'fun', params, ret });
const union = (...members: MlsType[]): MlsType => ({ kind: 'union', members });
const inter = (...members: MlsType[]): MlsType => ({ kind: 'inter', members });
const lower = (variable: string, type: MlsType): Bound => ({ variable, relation: 'lower', type });
const upper = (variable: string, type: MlsType): Bound => ({ variable, relation: 'upper', type });

// --- fixtures: one per spec line -------------------------------------------

/** Line 1: function definition  `{ x: int } -> { y: string }` */
function functionFixture(line: number): TypeResolutionResult {
  return {
    line,
    label: 'Function definition',
    type: fun([rec({ x: prim('int') })], rec({ y: prim('string') })),
    bounds: [
      lower('α', prim('int')),   // α :> int
      upper('α', prim('num')),   // α <: num
      lower('β', prim('string')),
    ],
    hierarchy: null,
    diagnostics: [],
  };
}

/** Line 2: union of intersections  `int & { tag: "success" } | string & { tag: "error" }` */
function unionFixture(line: number): TypeResolutionResult {
  const ok = inter(prim('int'), rec({ tag: lit('"success"') }));
  const err = inter(prim('string'), rec({ tag: lit('"error"') }));
  return {
    line,
    label: 'Union of intersections',
    type: union(ok, err),
    bounds: [
      lower('γ', ok),
      lower('γ', err),
      upper('γ', rec({ tag: prim('string') })),
    ],
    hierarchy: null,
    diagnostics: [],
  };
}

/** Line 3: trait composition  `BaseTrait & MixinA & MixinB` */
function traitFixture(line: number): TypeResolutionResult {
  const hierarchy: HierarchyNode = {
    name: 'BaseTrait', kind: 'trait', members: ['id', 'describe'],
    children: [{
      name: 'MixinA', kind: 'mixin', members: ['log'],
      children: [{ name: 'MixinB', kind: 'mixin', members: ['cache', 'invalidate'], children: [] }],
    }],
  };
  return {
    line,
    label: 'Trait / mixin composition',
    type: inter(ref('BaseTrait', 'trait'), ref('MixinA', 'mixin'), ref('MixinB', 'mixin')),
    bounds: [
      upper('δ', ref('BaseTrait', 'trait')),
      upper('δ', ref('MixinA', 'mixin')),
      upper('δ', ref('MixinB', 'mixin')),
    ],
    hierarchy,
    diagnostics: [],
  };
}

/** Anything else: pick a fixture from keywords in the code, else say "unknown". */
function fallback(line: number, code: string): TypeResolutionResult {
  let r: TypeResolutionResult;
  if (/\b(trait|mixin|class)\b/.test(code)) {
    r = traitFixture(line);
  } else if (/->|\bfun\b/.test(code)) {
    r = functionFixture(line);
  } else if (/[|&]/.test(code) || /\btag\b/.test(code)) {
    r = unionFixture(line);
  } else {
    return {
      line, label: 'Unknown expression', type: { kind: 'prim', name: '⊤' },
      bounds: [], hierarchy: null,
      diagnostics: [`Mock server has no data for line ${line}.`],
    };
  }
  r.diagnostics.push(`Mock server has no fixture for line ${line}; guessed from keywords.`);
  return r;
}

/**
 * Synchronous "inference" core.
 * @param line 1-based line number (matches the numbering in the spec)
 * @param code text of the active expression
 */
export function getStructuralTypeInfo(line: number, code: string): TypeResolutionResult {
  switch (line) {
    case 1: return functionFixture(line);
    case 2: return unionFixture(line);
    case 3: return traitFixture(line);
    default: return fallback(line, code);
  }
}

/**
 * RPC-style entry point used by the extension host. Async + artificial latency
 * so the "pending" state and stale-response handling are exercised for real.
 * A real backend would do `await connection.sendRequest('mls/typeAt', params)`.
 */
export async function requestTypeInfo(
  params: { line: number; code: string },
  delayMs = 40 + Math.random() * 80,
): Promise<TypeResolutionResult> {
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return getStructuralTypeInfo(params.line, params.code);
}
