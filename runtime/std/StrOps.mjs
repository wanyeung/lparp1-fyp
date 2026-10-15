const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
let StrOps1;
(class StrOps {
  static {
    StrOps1 = this
  }
  static concat2(a, b) {
    return a + b
  }
  static concat(...xs) {
    return runtime.safeCall(xs.join(""))
  }
  static from(value) {
    return runtime.safeCall(globalThis.String(value))
  }
  static parenthesizedIf(x, cond) {
    let tmp;
    if (cond === true) {
      tmp = "(" + x;
      return tmp + ")"
    }
    return x;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "StrOps"];
});
export { StrOps1 as _$_modulePrivate_$_StrOps };
let StrOps = StrOps1; export default StrOps;
