const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
import fs from "fs";
import process from "process";
import path from "path";
import url from "url";
import Predef from "./Predef.mjs";
import StrOps from "./StrOps.mjs";
let Term2, lambda, lambda1, lambda2, lambda3, lambda4, lambda$, lambda$1, lambda$2, lambda$3, lambda$4;
lambda$4 = (undefined, function (Term3, fullpath) {
  return (s) => {
    let tmp;
    tmp = runtime.safeCall(path.dirname(fullpath));
    return Term3.genImport(tmp, s)
  }
});
lambda4 = (undefined, function (Term3, fullpath, s) {
  let tmp, tmp1, tmp2, tmp3, xs;
  tmp = runtime.safeCall(path.dirname(fullpath));
  tmp1 = runtime.safeCall(url.fileURLToPath(s));
  tmp2 = runtime.safeCall(path.relative(tmp, tmp1));
  tmp3 = runtime.safeCall(tmp2.slice(0, -4));
  xs = [
    "import \"./",
    tmp3,
    ".mls\""
  ];
  return runtime.safeCall(xs.join(""))
});
lambda$3 = (undefined, function (Term3, ctx) {
  return (t) => {
    return Term3.paren_showSplit_show(2, t, ctx, undefined)
  }
});
lambda$2 = (undefined, function (nest) {
  return (s) => {
    return runtime.safeCall(nest.add(s))
  }
});
lambda$1 = (undefined, function (Term3, nest) {
  return (s) => {
    return Term3.showStmt(s, nest)
  }
});
lambda1 = (undefined, function (Term3, ctx, t) {
  return Term3.paren_showSplit_show(2, t, ctx, undefined)
});
lambda2 = (undefined, function (nest, s) {
  return runtime.safeCall(nest.add(s))
});
lambda3 = (undefined, function (Term3, nest, s) {
  return Term3.showStmt(s, nest)
});
lambda$ = (undefined, function (ind) {
  return (s) => {
    let xs;
    xs = [
      ind,
      s
    ];
    return runtime.safeCall(xs.join(""))
  }
});
lambda = (undefined, function (ind, s) {
  let xs;
  xs = [
    ind,
    s
  ];
  return runtime.safeCall(xs.join(""))
});
(class Term {
  static {
    Term2 = this
  }
  static {
    Term.Symbol = function Symbol(name) {
      return globalThis.Object.freeze(new Symbol.class(name));
    };
    (class Symbol {
      static {
        Term.Symbol.class = this
      }
      constructor(name) {
        this.name = name;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Symbol", ["name"]];
    });
    (class Pattern {
      static {
        Term.Pattern = this
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Pattern"];
    });
    Term.LitPattern = function LitPattern(lit) {
      return globalThis.Object.freeze(new LitPattern.class(lit));
    };
    (class LitPattern extends Term.Pattern {
      static {
        Term.LitPattern.class = this
      }
      constructor(lit) {
        super();
        this.lit = lit;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "LitPattern", ["lit"]];
    });
    Term.Var = function Var(sym) {
      return globalThis.Object.freeze(new Var.class(sym));
    };
    (class Var extends Term.Pattern {
      static {
        Term.Var.class = this
      }
      constructor(sym) {
        super();
        this.sym = sym;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Var", ["sym"]];
    });
    Term.ClassLike = function ClassLike(sym, trm, parameters) {
      return globalThis.Object.freeze(new ClassLike.class(sym, trm, parameters));
    };
    (class ClassLike extends Term.Pattern {
      static {
        Term.ClassLike.class = this
      }
      constructor(sym, trm, parameters) {
        super();
        this.sym = sym;
        this.trm = trm;
        this.parameters = parameters;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "ClassLike", ["sym", "trm", "parameters"]];
    });
    Term.Tuple = function Tuple(size, inf) {
      return globalThis.Object.freeze(new Tuple.class(size, inf));
    };
    (class Tuple extends Term.Pattern {
      static {
        Term.Tuple.class = this
      }
      constructor(size, inf) {
        super();
        this.size = size;
        this.inf = inf;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Tuple", ["size", "inf"]];
    });
    Term.Record = function Record(entities) {
      return globalThis.Object.freeze(new Record.class(entities));
    };
    (class Record extends Term.Pattern {
      static {
        Term.Record.class = this
      }
      constructor(entities) {
        super();
        this.entities = entities;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Record", ["entities"]];
    });
    Term.Branch = function Branch(scrutinee, ptrn, continuation) {
      return globalThis.Object.freeze(new Branch.class(scrutinee, ptrn, continuation));
    };
    (class Branch {
      static {
        Term.Branch.class = this
      }
      constructor(scrutinee, ptrn, continuation) {
        this.scrutinee = scrutinee;
        this.ptrn = ptrn;
        this.continuation = continuation;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Branch", ["scrutinee", "ptrn", "continuation"]];
    });
    (class Split {
      static {
        Term.Split = this
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Split"];
    });
    Term.Cons = function Cons(head, tail) {
      return globalThis.Object.freeze(new Cons.class(head, tail));
    };
    (class Cons extends Term.Split {
      static {
        Term.Cons.class = this
      }
      constructor(head, tail) {
        super();
        this.head = head;
        this.tail = tail;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Cons", ["head", "tail"]];
    });
    Term.Let = function Let(sym, term, tail) {
      return globalThis.Object.freeze(new Let.class(sym, term, tail));
    };
    (class Let extends Term.Split {
      static {
        Term.Let.class = this
      }
      constructor(sym, term, tail) {
        super();
        this.sym = sym;
        this.term = term;
        this.tail = tail;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Let", ["sym", "term", "tail"]];
    });
    Term.Else = function Else(default1) {
      return globalThis.Object.freeze(new Else.class(default1));
    };
    (class Else extends Term.Split {
      static {
        Term.Else.class = this
      }
      constructor(default1) {
        super();
        this.default = default1;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Else", ["default"]];
    });
    (class End extends Term.Split {
      static {
        Term.End = this
      }
      constructor() {
        super();
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "End"];
    });
    Term.LetSplit = function LetSplit(sym, body, tail) {
      return globalThis.Object.freeze(new LetSplit.class(sym, body, tail));
    };
    (class LetSplit extends Term.Split {
      static {
        Term.LetSplit.class = this
      }
      constructor(sym, body, tail) {
        super();
        this.sym = sym;
        this.body = body;
        this.tail = tail;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "LetSplit", ["sym", "body", "tail"]];
    });
    Term.UseSplit = function UseSplit(sym) {
      return globalThis.Object.freeze(new UseSplit.class(sym));
    };
    (class UseSplit extends Term.Split {
      static {
        Term.UseSplit.class = this
      }
      constructor(sym) {
        super();
        this.sym = sym;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "UseSplit", ["sym"]];
    });
    (class Keyword {
      static {
        Term.Keyword = this
      }
      static {
        (class If {
          static {
            new this
          }
          constructor() {
            Keyword.If = this;
            Object.defineProperty(this, "class", {
              value: If
            });
            globalThis.Object.freeze(this);
          }
          toString() { return runtime.render(this); }
          static [definitionMetadata] = ["object", "If"];
        });
        (class While {
          static {
            new this
          }
          constructor() {
            Keyword.While = this;
            Object.defineProperty(this, "class", {
              value: While
            });
            globalThis.Object.freeze(this);
          }
          toString() { return runtime.render(this); }
          static [definitionMetadata] = ["object", "While"];
        });
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Keyword"];
    });
    (class Statement {
      static {
        Term.Statement = this
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Statement"];
    });
    Term.LetDecl = function LetDecl(sym) {
      return globalThis.Object.freeze(new LetDecl.class(sym));
    };
    (class LetDecl extends Term.Statement {
      static {
        Term.LetDecl.class = this
      }
      constructor(sym) {
        super();
        this.sym = sym;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "LetDecl", ["sym"]];
    });
    Term.DefineVar = function DefineVar(sym, rhs) {
      return globalThis.Object.freeze(new DefineVar.class(sym, rhs));
    };
    (class DefineVar extends Term.Statement {
      static {
        Term.DefineVar.class = this
      }
      constructor(sym, rhs) {
        super();
        this.sym = sym;
        this.rhs = rhs;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "DefineVar", ["sym", "rhs"]];
    });
    (class Term1 {
      static {
        Term.Term = this
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Term"];
    });
    Term.Lit = function Lit(lit) {
      return globalThis.Object.freeze(new Lit.class(lit));
    };
    (class Lit extends Term.Term {
      static {
        Term.Lit.class = this
      }
      constructor(lit) {
        super();
        this.lit = lit;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Lit", ["lit"]];
    });
    Term.Builtin = function Builtin(name) {
      return globalThis.Object.freeze(new Builtin.class(name));
    };
    (class Builtin extends Term.Term {
      static {
        Term.Builtin.class = this
      }
      constructor(name) {
        super();
        this.name = name;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Builtin", ["name"]];
    });
    Term.Ref = function Ref(sym) {
      return globalThis.Object.freeze(new Ref.class(sym));
    };
    (class Ref extends Term.Term {
      static {
        Term.Ref.class = this
      }
      constructor(sym) {
        super();
        this.sym = sym;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Ref", ["sym"]];
    });
    Term.CSRef = function CSRef(sym, base, file) {
      return globalThis.Object.freeze(new CSRef.class(sym, base, file));
    };
    (class CSRef extends Term.Term {
      static {
        Term.CSRef.class = this
      }
      constructor(sym, base, file) {
        super();
        this.sym = sym;
        this.base = base;
        this.file = file;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "CSRef", ["sym", "base", "file"]];
    });
    Term.App = function App(lhs, rhs) {
      return globalThis.Object.freeze(new App.class(lhs, rhs));
    };
    (class App extends Term.Term {
      static {
        Term.App.class = this
      }
      constructor(lhs, rhs) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "App", ["lhs", "rhs"]];
    });
    Term.Sel = function Sel(prefix, nme) {
      return globalThis.Object.freeze(new Sel.class(prefix, nme));
    };
    (class Sel extends Term.Term {
      static {
        Term.Sel.class = this
      }
      constructor(prefix, nme) {
        super();
        this.prefix = prefix;
        this.nme = nme;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Sel", ["prefix", "nme"]];
    });
    Term.DynSel = function DynSel(prefix, fld, arrayIdx) {
      return globalThis.Object.freeze(new DynSel.class(prefix, fld, arrayIdx));
    };
    (class DynSel extends Term.Term {
      static {
        Term.DynSel.class = this
      }
      constructor(prefix, fld, arrayIdx) {
        super();
        this.prefix = prefix;
        this.fld = fld;
        this.arrayIdx = arrayIdx;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "DynSel", ["prefix", "fld", "arrayIdx"]];
    });
    Term.Tup = function Tup(fields) {
      return globalThis.Object.freeze(new Tup.class(fields));
    };
    (class Tup extends Term.Term {
      static {
        Term.Tup.class = this
      }
      constructor(fields) {
        super();
        this.fields = fields;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Tup", ["fields"]];
    });
    Term.IfLike = function IfLike(kw, desugared) {
      return globalThis.Object.freeze(new IfLike.class(kw, desugared));
    };
    (class IfLike extends Term.Term {
      static {
        Term.IfLike.class = this
      }
      constructor(kw, desugared) {
        super();
        this.kw = kw;
        this.desugared = desugared;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "IfLike", ["kw", "desugared"]];
    });
    Term.Lam = function Lam(params, body) {
      return globalThis.Object.freeze(new Lam.class(params, body));
    };
    (class Lam extends Term.Term {
      static {
        Term.Lam.class = this
      }
      constructor(params, body) {
        super();
        this.params = params;
        this.body = body;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Lam", ["params", "body"]];
    });
    Term.Blk = function Blk(stats, res) {
      return globalThis.Object.freeze(new Blk.class(stats, res));
    };
    (class Blk extends Term.Term {
      static {
        Term.Blk.class = this
      }
      constructor(stats, res) {
        super();
        this.stats = stats;
        this.res = res;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Blk", ["stats", "res"]];
    });
    Term.New = function New(cls, args) {
      return globalThis.Object.freeze(new New.class(cls, args));
    };
    (class New extends Term.Term {
      static {
        Term.New.class = this
      }
      constructor(cls, args) {
        super();
        this.cls = cls;
        this.args = args;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "New", ["cls", "args"]];
    });
    Term.Region = function Region(name, body) {
      return globalThis.Object.freeze(new Region.class(name, body));
    };
    (class Region extends Term.Term {
      static {
        Term.Region.class = this
      }
      constructor(name, body) {
        super();
        this.name = name;
        this.body = body;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Region", ["name", "body"]];
    });
    Term.RegRef = function RegRef(reg, value) {
      return globalThis.Object.freeze(new RegRef.class(reg, value));
    };
    (class RegRef extends Term.Term {
      static {
        Term.RegRef.class = this
      }
      constructor(reg, value) {
        super();
        this.reg = reg;
        this.value = value;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "RegRef", ["reg", "value"]];
    });
    Term.Assgn = function Assgn(lhs, rhs) {
      return globalThis.Object.freeze(new Assgn.class(lhs, rhs));
    };
    (class Assgn extends Term.Term {
      static {
        Term.Assgn.class = this
      }
      constructor(lhs, rhs) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Assgn", ["lhs", "rhs"]];
    });
    Term.Deref = function Deref(ref) {
      return globalThis.Object.freeze(new Deref.class(ref));
    };
    (class Deref extends Term.Term {
      static {
        Term.Deref.class = this
      }
      constructor(ref) {
        super();
        this.ref = ref;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Deref", ["ref"]];
    });
    Term.SetRef = function SetRef(ref, value) {
      return globalThis.Object.freeze(new SetRef.class(ref, value));
    };
    (class SetRef extends Term.Term {
      static {
        Term.SetRef.class = this
      }
      constructor(ref, value) {
        super();
        this.ref = ref;
        this.value = value;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "SetRef", ["ref", "value"]];
    });
    Term.Ret = function Ret(result) {
      return globalThis.Object.freeze(new Ret.class(result));
    };
    (class Ret extends Term.Term {
      static {
        Term.Ret.class = this
      }
      constructor(result) {
        super();
        this.result = result;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Ret", ["result"]];
    });
    Term.Throw = function Throw(result) {
      return globalThis.Object.freeze(new Throw.class(result));
    };
    (class Throw extends Term.Term {
      static {
        Term.Throw.class = this
      }
      constructor(result) {
        super();
        this.result = result;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Throw", ["result"]];
    });
    Term.Try = function Try(body, finallyDo) {
      return globalThis.Object.freeze(new Try.class(body, finallyDo));
    };
    (class Try extends Term.Term {
      static {
        Term.Try.class = this
      }
      constructor(body, finallyDo) {
        super();
        this.body = body;
        this.finallyDo = finallyDo;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Try", ["body", "finallyDo"]];
    });
    Term.Context = function Context(names, bindings, dependencies, printOnly) {
      return globalThis.Object.freeze(new Context.class(names, bindings, dependencies, printOnly));
    };
    (class Context {
      static {
        Term.Context.class = this
      }
      constructor(names, bindings, dependencies, printOnly) {
        this.names = names;
        this.bindings = bindings;
        this.dependencies = dependencies;
        this.printOnly = printOnly;
      }
      get(sym) {
        let scrut, scrut1;
        scrut = runtime.safeCall(this.bindings.has(sym));
        if (scrut === true) {
          return runtime.safeCall(this.bindings.get(sym))
        }
        scrut1 = this.printOnly;
        if (scrut1 === true) {
          return sym.name
        }
        {
          let xs, inlinedVal;
          xs = [
            "Invalid binding name ",
            sym.name
          ];
          inlinedVal = runtime.safeCall(xs.join(""));
          throw runtime.safeCall(globalThis.Error(inlinedVal));
        }
      }
      get nest() {
        let tmp;
        tmp = globalThis.Object.freeze(new globalThis.Map(this.bindings));
        return Term.Context(this.names, tmp, this.dependencies, this.printOnly);
      }
      add(sym) {
        let fn;
        fn = this.freshName(sym.name);
        runtime.safeCall(this.bindings.set(sym, fn));
        return fn
      }
      depends(d) {
        return runtime.safeCall(this.dependencies.add(d))
      }
      freshName(name) {
        let scrut, i, tmp, tmp1, tmp2, xs;
        tmp = runtime.safeCall(this.names.has(name));
        scrut = ! tmp;
        if (scrut === true) {
          runtime.safeCall(this.names.set(name, 0));
        }
        i = runtime.safeCall(this.names.get(name));
        tmp1 = i + 1;
        runtime.safeCall(this.names.set(name, tmp1));
        tmp2 = runtime.safeCall(i.toString());
        xs = [
          name,
          "_",
          tmp2
        ];
        return runtime.safeCall(xs.join(""))
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Context", ["names", "bindings", "dependencies", "printOnly"]];
    });
  }
  static paren_showSplit_show(id, param0, param1, param2) {
    loopLabel: while (true) {
      switch (id) {
        case 0:
          {
            let tmp;
            if (param0 instanceof Term.Ref.class) {
              id = 2;
              continue loopLabel
            } else if (param0 instanceof Term.CSRef.class) {
              id = 2;
              continue loopLabel
            } else if (param0 instanceof Term.Lit.class) {
              id = 2;
              continue loopLabel
            } else if (param0 instanceof Term.Sel.class) {
              id = 2;
              continue loopLabel
            }
            {
              let xs;
              tmp = Term.paren_showSplit_show(2, param0, param1, undefined);
              xs = [
                "(",
                tmp,
                ")"
              ];
              return runtime.safeCall(xs.join(""));
            }
          }
        case 1:
          {
            let nest, freshName, nest1, freshName1, arg$UseSplit$0$, arg$LetSplit$0$, arg$LetSplit$1$, arg$LetSplit$2$, arg$Else$0$, arg$Let$0$, arg$Let$1$, arg$Let$2$, arg$Cons$0$, arg$Cons$1$, arg$Branch$0$, arg$Branch$1$, arg$Branch$2$, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10;
            if (param0 instanceof Term.Cons.class) {
              arg$Cons$0$ = param0.head;
              arg$Cons$1$ = param0.tail;
              if (arg$Cons$0$ instanceof Term.Branch.class) {
                let xs;
                arg$Branch$0$ = arg$Cons$0$.scrutinee;
                arg$Branch$1$ = arg$Cons$0$.ptrn;
                arg$Branch$2$ = arg$Cons$0$.continuation;
                tmp = Term.paren_showSplit_show(2, arg$Branch$0$, param1, undefined);
                tmp1 = Term.showPattern(arg$Branch$1$, param1);
                tmp2 = Term.paren_showSplit_show(1, arg$Branch$2$, param1, true);
                tmp3 = Term.paren_showSplit_show(1, arg$Cons$1$, param1, false);
                xs = [
                  tmp,
                  " is ",
                  tmp1,
                  " then ",
                  tmp2,
                  "\n",
                  tmp3
                ];
                return runtime.safeCall(xs.join(""))
              }
              throw globalThis.Object.freeze(new globalThis.Error("match error"));
            } else if (param0 instanceof Term.Let.class) {
              let xs;
              arg$Let$0$ = param0.sym;
              arg$Let$1$ = param0.term;
              arg$Let$2$ = param0.tail;
              nest = param1.nest;
              freshName = runtime.safeCall(nest.add(arg$Let$0$));
              tmp4 = Term.paren_showSplit_show(2, arg$Let$1$, nest, undefined);
              tmp5 = Term.paren_showSplit_show(1, arg$Let$2$, nest, false);
              xs = [
                "let ",
                freshName,
                " = ",
                tmp4,
                "\n",
                tmp5
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.Else.class) {
              arg$Else$0$ = param0.default;
              if (param2 === true) {
                param0 = arg$Else$0$;
                id = 2;
                continue loopLabel
              }
              {
                let xs;
                tmp6 = Term.paren_showSplit_show(2, arg$Else$0$, param1, undefined);
                xs = [
                  "else ",
                  tmp6
                ];
                return runtime.safeCall(xs.join(""));
              }
            } else if (param0 instanceof Term.End) {
              return ""
            } else if (param0 instanceof Term.LetSplit.class) {
              let xs;
              arg$LetSplit$0$ = param0.sym;
              arg$LetSplit$1$ = param0.body;
              arg$LetSplit$2$ = param0.tail;
              nest1 = param1.nest;
              freshName1 = runtime.safeCall(nest1.add(arg$LetSplit$0$));
              tmp7 = Term.paren_showSplit_show(1, arg$LetSplit$1$, nest1, false);
              tmp8 = Term.indent(tmp7, "  ", true);
              tmp9 = Term.paren_showSplit_show(1, arg$LetSplit$2$, nest1, false);
              xs = [
                "let split ",
                freshName1,
                " =\n",
                tmp8,
                "\n",
                tmp9
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.UseSplit.class) {
              let xs;
              arg$UseSplit$0$ = param0.sym;
              tmp10 = runtime.safeCall(param1.get(arg$UseSplit$0$));
              xs = [
                "$",
                tmp10
              ];
              return runtime.safeCall(xs.join(""))
            }
            throw globalThis.Object.freeze(new globalThis.Error("match error"));
          }
        case 2:
          {
            let nest, freshParams, nest1, arg$IfLike$0$, arg$IfLike$1$, arg$Blk$0$, arg$Blk$1$, arg$Lam$0$, arg$Lam$1$, arg$Tup$0$, arg$App$0$, arg$App$1$, arg$Sel$0$, arg$Sel$1$, arg$Lit$0$, arg$CSRef$0$, arg$CSRef$1$, arg$CSRef$2$, arg$Symbol$0$, arg$Ref$0$, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10, tmp11, tmp12, tmp13, tmp14, lambda$here, lambda$here1, lambda$here2;
            if (param0 instanceof Term.Ref.class) {
              arg$Ref$0$ = param0.sym;
              return runtime.safeCall(param1.get(arg$Ref$0$))
            } else if (param0 instanceof Term.CSRef.class) {
              arg$CSRef$0$ = param0.sym;
              arg$CSRef$1$ = param0.base;
              arg$CSRef$2$ = param0.file;
              if (arg$CSRef$0$ instanceof Term.Symbol.class) {
                arg$Symbol$0$ = arg$CSRef$0$.name;
                if (arg$CSRef$2$ === undefined) {
                  runtime.safeCall(param1.depends(arg$CSRef$1$));
                  return arg$Symbol$0$
                }
                tmp = runtime.safeCall(path.dirname(arg$CSRef$1$));
                tmp1 = runtime.safeCall(path.join(tmp, arg$CSRef$2$));
                runtime.safeCall(param1.depends(tmp1));
                return arg$Symbol$0$;
              }
              throw globalThis.Object.freeze(new globalThis.Error("match error"));
            } else if (param0 instanceof Term.Lit.class) {
              arg$Lit$0$ = param0.lit;
              return runtime.safeCall(arg$Lit$0$.toString())
            } else if (param0 instanceof Term.Builtin.class) {
              return param0.name
            } else if (param0 instanceof Term.Sel.class) {
              let xs;
              arg$Sel$0$ = param0.prefix;
              arg$Sel$1$ = param0.nme;
              tmp2 = Term.paren_showSplit_show(0, arg$Sel$0$, param1, undefined);
              xs = [
                tmp2,
                ".",
                arg$Sel$1$
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.App.class) {
              let xs;
              arg$App$0$ = param0.lhs;
              arg$App$1$ = param0.rhs;
              tmp3 = Term.paren_showSplit_show(0, arg$App$0$, param1, undefined);
              tmp4 = Term.paren_showSplit_show(2, arg$App$1$, param1, undefined);
              xs = [
                tmp3,
                tmp4
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.Tup.class) {
              let xs;
              arg$Tup$0$ = param0.fields;
              lambda$here = lambda$3(Term, param1);
              tmp5 = runtime.safeCall(arg$Tup$0$.map(lambda$here));
              tmp6 = runtime.safeCall(tmp5.join(", "));
              xs = [
                "(",
                tmp6,
                ")"
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.Lam.class) {
              let xs;
              arg$Lam$0$ = param0.params;
              arg$Lam$1$ = param0.body;
              nest = param1.nest;
              lambda$here1 = lambda$2(nest);
              freshParams = runtime.safeCall(arg$Lam$0$.map(lambda$here1));
              tmp7 = runtime.safeCall(freshParams.join(", "));
              tmp8 = Term.paren_showSplit_show(2, arg$Lam$1$, nest, undefined);
              tmp9 = Term.indent(tmp8, "  ", true);
              xs = [
                "(",
                tmp7,
                ") =>\n",
                tmp9
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.Blk.class) {
              let xs;
              arg$Blk$0$ = param0.stats;
              arg$Blk$1$ = param0.res;
              nest1 = param1.nest;
              lambda$here2 = lambda$1(Term, nest1);
              tmp10 = runtime.safeCall(arg$Blk$0$.map(lambda$here2));
              tmp11 = runtime.safeCall(tmp10.join("\n"));
              tmp12 = Term.paren_showSplit_show(2, arg$Blk$1$, nest1, undefined);
              xs = [
                tmp11,
                "\n",
                tmp12
              ];
              return runtime.safeCall(xs.join(""))
            } else if (param0 instanceof Term.IfLike.class) {
              arg$IfLike$0$ = param0.kw;
              arg$IfLike$1$ = param0.desugared;
              if (arg$IfLike$0$ instanceof Term.Keyword.If.class) {
                let xs;
                tmp13 = Term.paren_showSplit_show(1, arg$IfLike$1$, param1, false);
                tmp14 = Term.indent(tmp13, "  ", true);
                xs = [
                  "if \n",
                  tmp14
                ];
                return runtime.safeCall(xs.join(""))
              }
              throw globalThis.Object.freeze(new globalThis.Error("match error"));
            }
            throw globalThis.Object.freeze(new globalThis.Error("match error"));
          }
      }
      break;
    }
  }
  static indent(str, ind, keepLeading) {
    let res, tmp, tmp1, lambda$here;
    tmp = runtime.safeCall(str.split("\n"));
    lambda$here = lambda$(ind);
    tmp1 = runtime.safeCall(tmp.map(lambda$here));
    res = runtime.safeCall(tmp1.join("\n"));
    if (keepLeading === true) {
      return res
    }
    return runtime.safeCall(res.substring(ind.length));
  }
  static showStmt(s, ctx) {
    let freshName, arg$DefineVar$0$, arg$DefineVar$1$, arg$LetDecl$0$, tmp, tmp1;
    if (s instanceof Term.LetDecl.class) {
      let xs;
      arg$LetDecl$0$ = s.sym;
      freshName = runtime.safeCall(ctx.add(arg$LetDecl$0$));
      xs = [
        "let ",
        freshName
      ];
      return runtime.safeCall(xs.join(""))
    } else if (s instanceof Term.DefineVar.class) {
      let xs;
      arg$DefineVar$0$ = s.sym;
      arg$DefineVar$1$ = s.rhs;
      tmp = runtime.safeCall(ctx.get(arg$DefineVar$0$));
      tmp1 = Term.show(arg$DefineVar$1$, ctx);
      xs = [
        tmp,
        " = ",
        tmp1
      ];
      return runtime.safeCall(xs.join(""))
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  static showPattern(p, ctx) {
    let arg$LitPattern$0$;
    if (p instanceof Term.LitPattern.class) {
      arg$LitPattern$0$ = p.lit;
      return runtime.safeCall(arg$LitPattern$0$.toString())
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  static paren(t, ctx) {
    return Term.paren_showSplit_show(0, t, ctx, undefined)
  }
  static showSplit(s, ctx, isCont) {
    return Term.paren_showSplit_show(1, s, ctx, isCont)
  }
  static show(t, ctx) {
    return Term.paren_showSplit_show(2, t, ctx, undefined)
  }
  static print(t) {
    let ctx, tmp, tmp1, tmp2, tmp3;
    tmp = globalThis.Object.freeze(new globalThis.Map());
    tmp1 = globalThis.Object.freeze(new globalThis.Map());
    tmp2 = globalThis.Object.freeze(new globalThis.Set());
    ctx = Term.Context(tmp, tmp1, tmp2, true);
    tmp3 = Term.show(t, ctx);
    return runtime.safeCall(globalThis.console.log(tmp3))
  }
  static genImport(base, p) {
    let tmp, tmp1, tmp2, xs;
    tmp = runtime.safeCall(url.fileURLToPath(p));
    tmp1 = runtime.safeCall(path.relative(base, tmp));
    tmp2 = runtime.safeCall(tmp1.slice(0, -4));
    xs = [
      "import \"./",
      tmp2,
      ".mls\""
    ];
    return runtime.safeCall(xs.join(""))
  }
  static codegen(t, file) {
    let ctx, moduleName, fullpath, dependencies, scrut, originData, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, lambda$here, xs, inlinedVal, xs1, inlinedVal1, inlinedVal2, tmp10;
    tmp = globalThis.Object.freeze(new globalThis.Map());
    tmp1 = globalThis.Object.freeze(new globalThis.Map());
    tmp2 = globalThis.Object.freeze(new globalThis.Set());
    ctx = Term.Context(tmp, tmp1, tmp2, false);
    tmp3 = runtime.safeCall(path.parse(file));
    moduleName = tmp3.name;
    tmp4 = runtime.safeCall(process.cwd());
    fullpath = runtime.safeCall(path.join(tmp4, file));
    tmp5 = Term.show(t, ctx);
    tmp6 = Term.indent(tmp5, "  ", true);
    xs = [
      "module ",
      moduleName,
      " with ...\nfun res =\n",
      tmp6,
      "\n"
    ];
    inlinedVal = runtime.safeCall(xs.join(""));
    tmp7 = runtime.safeCall(globalThis.Array.from(ctx.dependencies));
    lambda$here = lambda$4(Term, fullpath);
    dependencies = runtime.safeCall(tmp7.map(lambda$here));
    tmp8 = runtime.safeCall(fs.existsSync(file));
    scrut = ! tmp8;
    if (scrut === true) {
      runtime.safeCall(fs.writeFileSync(file, "", "utf8"));
    }
    originData = runtime.safeCall(fs.readFileSync(file, "utf8"));
    tmp9 = runtime.safeCall(dependencies.join("\n"));
    xs1 = [
      tmp9,
      "\n",
      inlinedVal
    ];
    inlinedVal1 = runtime.safeCall(xs1.join(""));
    tmp10 = Predef.equals(inlinedVal1, originData);
    inlinedVal2 = ! tmp10;
    if (inlinedVal2 === true) {
      runtime.safeCall(fs.writeFileSync(file, inlinedVal1, "utf8"));
      return runtime.Unit
    }
    return runtime.Unit;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Term"];
});
export { Term2 as _$_modulePrivate_$_Term };
export { lambda as _$_modulePrivate_$_lambda };
export { lambda1 as _$_modulePrivate_$_lambda1 };
export { lambda2 as _$_modulePrivate_$_lambda2 };
export { lambda3 as _$_modulePrivate_$_lambda3 };
export { lambda4 as _$_modulePrivate_$_lambda4 };
export { lambda$ as _$_modulePrivate_$_lambda$ };
export { lambda$1 as _$_modulePrivate_$_lambda$1 };
export { lambda$2 as _$_modulePrivate_$_lambda$2 };
export { lambda$3 as _$_modulePrivate_$_lambda$3 };
export { lambda$4 as _$_modulePrivate_$_lambda$4 };
let Term = Term2; export default Term;
