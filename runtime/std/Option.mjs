const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
let Option1;
(class Option {
  static {
    Option1 = this
  }
  static {
    Option.Some = function Some(value) {
      return globalThis.Object.freeze(new Some.class(value));
    };
    (class Some {
      static {
        Option.Some.class = this
      }
      constructor(value) {
        this.value = value;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Some", ["value"]];
    });
    (class None {
      static {
        new this
      }
      constructor() {
        Option.None = this;
        Object.defineProperty(this, "class", {
          value: None
        });
        globalThis.Object.freeze(this);
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["object", "None"];
    });
    Option.Both = function Both(fst, snd) {
      return globalThis.Object.freeze(new Both.class(fst, snd));
    };
    (class Both {
      static {
        Option.Both.class = this
      }
      constructor(fst, snd) {
        this.fst = fst;
        this.snd = snd;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Both", ["fst", "snd"]];
    });
    (class unsafe {
      static {
        Option.unsafe = this
      }
      static get(opt) {
        if (opt instanceof Option.Some.class) {
          return opt.value
        } else if (opt instanceof Option.None.class) {
          throw runtime.safeCall(globalThis.Error("None.get"))
        }
        throw globalThis.Object.freeze(new globalThis.Error("match error"));
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "unsafe"];
    });
  }
  static isDefined(x) {
    if (x instanceof Option.Some.class) {
      return true
    } else if (x instanceof Option.None.class) {
      return false
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  static getOrElse(opt, default1) {
    if (opt instanceof Option.Some.class) {
      return opt.value
    } else if (opt instanceof Option.None.class) {
      return default1
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  static flatMap(opt, f) {
    let arg$Some$0$;
    if (opt instanceof Option.Some.class) {
      arg$Some$0$ = opt.value;
      return runtime.safeCall(f(arg$Some$0$))
    } else if (opt instanceof Option.None.class) {
      return Option.None
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Option"];
});
export { Option1 as _$_modulePrivate_$_Option };
let Option = Option1; export default Option;
