const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
import Iter from "./Iter.mjs";
import { _$_modulePrivate_$_lambda$17 as lambda$ } from "./Iter.mjs";
let nextf, Splice1, sliceHelper, enforceArray, concatHelper, normIdx, LazyArray1, View1, SpliceMarker1, LazyArr1, normIdxSlice, lambda, lambda1, Capture$scope161, lambda$1, Capture$scope61, nextf$;
(class Capture$scope6 {
  static {
    Capture$scope61 = this
  }
  constructor(idx$0, uitr$1) {
    this.uitr$1 = uitr$1;
    this.idx$0 = idx$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope6"];
});
nextf$ = function nextf$(scope6$cap, Splice2) {
  return () => {
    return nextf(scope6$cap, Splice2)
  }
};
nextf = function nextf(scope6$cap, Splice2) {
  loopLabel: while (true) {
    let scrut, scrut1, scrut2, n, scrut3, value, tmp, tmp1, tmp2, tmp3;
    scrut = scope6$cap.idx$0 < Splice2.bits.length;
    if (scrut === true) {
      scrut1 = Splice2.bits.at(scope6$cap.idx$0);
      if (scrut1 instanceof SpliceMarker1.class) {
        scrut2 = scope6$cap.uitr$1 === null;
        if (scrut2 === true) {
          tmp = scope6$cap.idx$0 + 1;
          tmp1 = runtime.safeCall(Splice2.bits.at(tmp)[globalThis.Symbol.iterator]());
          scope6$cap.uitr$1 = tmp1;
        }
        n = runtime.safeCall(scope6$cap.uitr$1.next());
        scrut3 = n.done;
        if (scrut3 === true) {
          scope6$cap.uitr$1 = null;
          tmp2 = scope6$cap.idx$0 + 2;
          scope6$cap.idx$0 = tmp2;
          continue loopLabel
        }
        return n;
      }
      value = Splice2.bits.at(scope6$cap.idx$0);
      tmp3 = scope6$cap.idx$0 + 1;
      scope6$cap.idx$0 = tmp3;
      return Iter.Result.Next(value);
    }
    return Iter.Result.Done;
  }
};
(class Capture$scope16 {
  static {
    Capture$scope161 = this
  }
  constructor(idx$0) {
    this.idx$0 = idx$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope16"];
});
lambda$1 = (undefined, function (scope16$cap, View2, until) {
  return () => {
    return lambda(scope16$cap, View2, until)
  }
});
lambda = (undefined, function (scope16$cap, View2, until) {
  let scrut, next, tmp;
  scrut = scope16$cap.idx$0 < until;
  if (scrut === true) {
    next = runtime.safeCall(View2.underlying.at(scope16$cap.idx$0));
    tmp = scope16$cap.idx$0 + 1;
    scope16$cap.idx$0 = tmp;
    return Iter.Result.Next(next)
  }
  return Iter.Result.Done;
});
lambda1 = (undefined, function (caseScrut) {
  let tmp, tmp1;
  if (caseScrut instanceof LazyArr1) {
    return caseScrut
  } else if (caseScrut instanceof globalThis.Array) {
    return caseScrut
  } else if (caseScrut instanceof globalThis.String) {
    return caseScrut
  } else if (typeof caseScrut === 'string') {
    return caseScrut
  } else if (globalThis.ArrayBuffer.isView(caseScrut) && !(caseScrut instanceof globalThis.DataView)) {
    return caseScrut
  }
  tmp = runtime.safeCall(caseScrut.toString());
  tmp1 = "Expected an Array, got: " + tmp;
  throw runtime.safeCall(globalThis.Error(tmp1));
});
normIdx = function normIdx(i, len) {
  let scrut;
  scrut = i < 0;
  if (scrut === true) {
    return len + i
  }
  return i;
};
enforceArray = function enforceArray() {
  return lambda1
};
concatHelper = function concatHelper(a, l, ...args) {
  let idx, init_len, tmp, tmp1;
  idx = 0;
  init_len = a.length;
  tmp = args.length * 2;
  tmp1 = init_len + tmp;
  a.length = tmp1;
  lbl: while (true) {
    let scrut, x, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9;
    scrut = idx < args.length;
    if (scrut === true) {
      x = args.at(idx);
      tmp2 = idx * 2;
      tmp3 = init_len + tmp2;
      a[tmp3] = SpliceMarker1;
      tmp4 = idx * 2;
      tmp5 = init_len + tmp4;
      tmp6 = tmp5 + 1;
      tmp7 = runtime.safeCall(lambda1(x));
      a[tmp6] = tmp7;
      tmp8 = l + x.length;
      l = tmp8;
      tmp9 = idx + 1;
      idx = tmp9;
      continue lbl
    }
    break;
  }
  return Splice1(a, l)
};
normIdxSlice = function normIdxSlice(i, len) {
  let scrut, scrut1, tmp;
  scrut = i < 0;
  if (scrut === true) {
    tmp = - len;
    scrut1 = i >= tmp;
    if (scrut1 === true) {
      return len + i
    }
    return 0;
  }
  return i;
};
sliceHelper = function sliceHelper(beg, fin, arr) {
  let len, scrut, scrut1, scrut2, tmp, tmp1, arg$View$0$, arg$View$1$, arg$View$2$, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, inlinedVal, inlinedVal1, scrut3, scrut4, tmp9, scrut5, scrut6, tmp10;
  len = arr.length;
  scrut5 = beg < 0;
  if (scrut5 === true) {
    tmp10 = - len;
    scrut6 = beg >= tmp10;
    if (scrut6 === true) {
      inlinedVal = len + beg;
    } else {
      inlinedVal = 0;
    }
  } else {
    inlinedVal = beg;
  }
  scrut3 = fin < 0;
  if (scrut3 === true) {
    tmp9 = - len;
    scrut4 = fin >= tmp9;
    if (scrut4 === true) {
      inlinedVal1 = len + fin;
    } else {
      inlinedVal1 = 0;
    }
  } else {
    inlinedVal1 = fin;
  }
  fin = inlinedVal1;
  scrut = inlinedVal >= len;
  if (scrut === true) {
    tmp = globalThis.Object.freeze([]);
    return View1(tmp, 0, 0)
  }
  scrut1 = inlinedVal1 >= len;
  if (scrut1 === true) {
    fin = len;
  }
  scrut2 = fin <= inlinedVal;
  if (scrut2 === true) {
    tmp1 = globalThis.Object.freeze([]);
    return View1(tmp1, 0, 0)
  }
  if (arr instanceof View1.class) {
    arg$View$0$ = arr.underlying;
    arg$View$1$ = arr.start;
    arg$View$2$ = arr.end;
    tmp2 = arg$View$1$ + inlinedVal;
    tmp3 = len - fin;
    tmp4 = arg$View$2$ + tmp3;
    return View1(arg$View$0$, tmp2, tmp4)
  } else if (arr instanceof Splice1.class) {
    tmp5 = runtime.safeCall(arr.materialize());
    tmp6 = runtime.safeCall(tmp5.slice(inlinedVal, fin));
    return View1(tmp6, 0, 0)
  }
  tmp7 = runtime.safeCall(lambda1(arr));
  tmp8 = arr.length - fin;
  return View1(tmp7, inlinedVal, tmp8);
};
(class LazyArr extends Iter.IterableBase {
  static {
    LazyArr1 = this
  }
  constructor() {
    super();
  }
  toString() {
    let tmp, inlinedVal, iterator, next, scrut, tmp1, lambda$here;
    iterator = Iter.getIterator(this);
    next = runtime.safeCall(iterator.next());
    scrut = next.done;
    if (scrut === true) {
      inlinedVal = "";
    } else {
      runtime.safeCall(globalThis.String(", "));
      tmp1 = runtime.safeCall(globalThis.String(next.value));
      lambda$here = lambda$(", ");
      inlinedVal = Iter.foldingImpl(iterator, tmp1, lambda$here);
    }
    tmp = "[" + inlinedVal;
    return tmp + "]"
  }
  concat(...args) {
    let tmp;
    tmp = [
      SpliceMarker1,
      this
    ];
    return concatHelper(tmp, this.length, ...args)
  }
  [prettyPrint]() { return this.toString(); }
  static [definitionMetadata] = ["class", "LazyArr"];
});
View1 = function View(underlying, start, end) {
  return globalThis.Object.freeze(new View.class(underlying, start, end));
};
(class View extends LazyArr1 {
  static {
    View1.class = this
  }
  constructor(underlying, start, end) {
    super();
    let tmp, tmp1;
    this.underlying = underlying;
    this.start = start;
    this.end = end;
    tmp = this.underlying.length - this.start;
    tmp1 = tmp - this.end;
    this.len = tmp1;
  }
  iterator() {
    let until, scope16$cap, lambda$here;
    scope16$cap = new Capture$scope161(undefined);
    scope16$cap.idx$0 = this.start;
    until = this.underlying.length - this.end;
    lambda$here = lambda$1(scope16$cap, this, until);
    return Iter.Iterator(lambda$here)
  }
  materialize() {
    let tmp;
    tmp = this.underlying.length - this.end;
    return runtime.safeCall(this.underlying.slice(this.start, tmp))
  }
  at(i) {
    let tmp, tmp1, tmp2, tmp3;
    tmp = - this.length;
    tmp1 = i < tmp;
    if (tmp1 === false) {
      tmp2 = i >= this.length;
      if (tmp2 === true) {
        throw runtime.safeCall(globalThis.RangeError("View.at: Index out of bounds"))
      }
      {
        let len, inlinedVal, scrut;
        len = this.length;
        scrut = i < 0;
        if (scrut === true) {
          inlinedVal = len + i;
        } else {
          inlinedVal = i;
        }
        tmp3 = inlinedVal + this.start;
        return runtime.safeCall(this.underlying.at(tmp3));
      }
    }
    throw runtime.safeCall(globalThis.RangeError("View.at: Index out of bounds"));
  }
  slice(beg, fin) {
    return sliceHelper(beg, fin, this)
  }
  get length() {
    return this.len;
  }
  toString() {
    let tmp, inlinedVal, iterator, next, scrut, tmp1, lambda$here;
    iterator = Iter.getIterator(this);
    next = runtime.safeCall(iterator.next());
    scrut = next.done;
    if (scrut === true) {
      inlinedVal = "";
    } else {
      runtime.safeCall(globalThis.String(", "));
      tmp1 = runtime.safeCall(globalThis.String(next.value));
      lambda$here = lambda$(", ");
      inlinedVal = Iter.foldingImpl(iterator, tmp1, lambda$here);
    }
    tmp = "[" + inlinedVal;
    return tmp + "]"
  }
  [prettyPrint]() { return this.toString(); }
  static [definitionMetadata] = ["class", "View", ["underlying", "start", "end"]];
});
(class SpliceMarker {
  static {
    new this
  }
  constructor() {
    SpliceMarker1 = this;
    Object.defineProperty(this, "class", {
      value: SpliceMarker
    });
    globalThis.Object.freeze(this);
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["object", "SpliceMarker"];
});
Splice1 = function Splice(bits, len) {
  return globalThis.Object.freeze(new Splice.class(bits, len));
};
(class Splice extends LazyArr1 {
  static {
    Splice1.class = this
  }
  constructor(bits, len) {
    super();
    this.bits = bits;
    this.len = len;
    this.#materialized = null;
  }
  #materialized;
  iterator() {
    let scope6$cap, nextf$here;
    scope6$cap = new Capture$scope61(undefined, undefined);
    scope6$cap.idx$0 = 0;
    scope6$cap.uitr$1 = null;
    nextf$here = nextf$(scope6$cap, this);
    return Iter.Iterator(nextf$here)
  }
  get reify() {
    let counter, arr, stack, tmp;
    counter = 0;
    arr = new globalThis.Array(this.len);
    stack = [];
    tmp = globalThis.Object.freeze([
      0,
      this.bits
    ]);
    runtime.safeCall(stack.push(tmp));
    lbl: while (true) {
      let scrut, e, idx, vals, scrut1, scrut2, tmp1, tmp2, tmp3, tmp4, tmp5;
      scrut = stack.length > 0;
      if (scrut === true) {
        e = runtime.safeCall(stack.pop());
        idx = e.at(0);
        vals = e.at(1);
        if (vals instanceof Splice1.class) {
          vals = vals.bits;
        }
        lbl1: while (true) {
          let scrut3, scrut4, tmp6, tmp7, tmp8;
          scrut3 = idx < vals.length;
          if (scrut3 === true) {
            scrut4 = runtime.safeCall(vals.at(idx));
            if (scrut4 instanceof SpliceMarker1.class) {} else {
              tmp6 = runtime.safeCall(vals.at(idx));
              arr[counter] = tmp6;
              tmp7 = counter + 1;
              counter = tmp7;
              tmp8 = idx + 1;
              idx = tmp8;
              continue lbl1
            }
          }
          break;
        }
        scrut1 = idx < vals.length;
        if (scrut1 === true) {
          scrut2 = runtime.safeCall(vals.at(idx));
          if (scrut2 instanceof SpliceMarker1.class) {
            tmp1 = idx + 2;
            tmp2 = globalThis.Object.freeze([
              tmp1,
              vals
            ]);
            runtime.safeCall(stack.push(tmp2));
            tmp3 = idx + 1;
            tmp4 = runtime.safeCall(vals.at(tmp3));
            tmp5 = globalThis.Object.freeze([
              0,
              tmp4
            ]);
            runtime.safeCall(stack.push(tmp5));
            continue lbl
          }
          continue lbl;
        }
        continue lbl;
      }
      break;
    }
    return arr;
  }
  materialize() {
    let scrut;
    scrut = this.#materialized === null;
    if (scrut === true) {
      this.#materialized = this.reify;
      return this.#materialized
    }
    return this.#materialized;
  }
  at(i) {
    let tmp;
    tmp = this.materialize();
    return runtime.safeCall(tmp.at(i))
  }
  slice(beg, fin) {
    return sliceHelper(beg, fin, this)
  }
  concat(...args) {
    let scrut, tmp, tmp1;
    scrut = this.#materialized === null;
    if (scrut === true) {
      tmp = [
        SpliceMarker1,
        this
      ];
      return concatHelper(tmp, this.len, ...args)
    }
    tmp1 = [
      SpliceMarker1,
      this.#materialized
    ];
    return concatHelper(tmp1, this.len, ...args);
  }
  get length() {
    return this.len;
  }
  toString() {
    let tmp, tmp1, inlinedVal, iterator, next, scrut, tmp2, lambda$here;
    tmp = this.materialize();
    iterator = Iter.getIterator(tmp);
    next = runtime.safeCall(iterator.next());
    scrut = next.done;
    if (scrut === true) {
      inlinedVal = "";
    } else {
      runtime.safeCall(globalThis.String(", "));
      tmp2 = runtime.safeCall(globalThis.String(next.value));
      lambda$here = lambda$(", ");
      inlinedVal = Iter.foldingImpl(iterator, tmp2, lambda$here);
    }
    tmp1 = "[" + inlinedVal;
    return tmp1 + "]"
  }
  [prettyPrint]() { return this.toString(); }
  static [definitionMetadata] = ["class", "Splice", ["bits", "len"]];
});
(class LazyArray {
  static {
    LazyArray1 = this
  }
  static {
    LazyArray.__split = SpliceMarker1;
  }
  static mk(...args) {
    return View1(args, 0, 0)
  }
  static concat(...args) {
    let tmp;
    tmp = [];
    return concatHelper(tmp, 0, ...args)
  }
  static dropLeftRight(beg, fin) {
    return (xs) => {
      let tmp, tmp1, tmp2, tmp3, tmp4;
      tmp = beg < 0;
      if (tmp === false) {
        tmp1 = fin < 0;
      } else {
        tmp1 = true;
      }
      if (tmp1 === true) {
        throw runtime.safeCall(globalThis.RangeError("LazyArray.dropLeftRight: indices must be non-negative"))
      }
      tmp2 = beg > xs.length;
      if (tmp2 === false) {
        tmp3 = fin > xs.length;
      } else {
        tmp3 = true;
      }
      if (tmp3 === true) {
        throw runtime.safeCall(globalThis.RangeError("LazyArray.dropLeftRight: indices out of bounds"))
      }
      tmp4 = xs.length - fin;
      return sliceHelper(beg, tmp4, xs);
    }
  }
  static equals(xs, ys) {
    let idx, tmp;
    tmp = xs.length === ys.length;
    if (tmp === true) {
      idx = 0;
      lbl: while (true) {
        let scrut, scrut1, tmp1, tmp2, tmp3;
        scrut = idx < xs.length;
        if (scrut === true) {
          tmp1 = runtime.safeCall(xs.at(idx));
          tmp2 = runtime.safeCall(ys.at(idx));
          scrut1 = tmp1 !== tmp2;
          if (scrut1 === true) {
            return false
          }
          tmp3 = idx + 1;
          idx = tmp3;
          continue lbl;
        }
        break;
      }
      return true
    }
    return false;
  }
  static __concat(...args) {
    let len, idx;
    len = 0;
    idx = 0;
    lbl: while (true) {
      let scrut, scrut1, tmp, tmp1, tmp2, tmp3, tmp4, tmp5;
      scrut = idx < args.length;
      if (scrut === true) {
        scrut1 = args.at(idx);
        if (scrut1 instanceof SpliceMarker1.class) {
          tmp = idx + 1;
          tmp1 = runtime.safeCall(lambda1(args.at(tmp)));
          tmp2 = len + tmp1.length;
          len = tmp2;
          tmp3 = idx + 2;
          idx = tmp3;
          continue lbl
        }
        tmp4 = len + 1;
        len = tmp4;
        tmp5 = idx + 1;
        idx = tmp5;
        continue lbl;
      }
      break;
    }
    return Splice1(args, len)
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "LazyArray"];
});
export { nextf as _$_modulePrivate_$_nextf };
export { Splice1 as _$_modulePrivate_$_Splice };
export { sliceHelper as _$_modulePrivate_$_sliceHelper };
export { enforceArray as _$_modulePrivate_$_enforceArray };
export { concatHelper as _$_modulePrivate_$_concatHelper };
export { normIdx as _$_modulePrivate_$_normIdx };
export { LazyArray1 as _$_modulePrivate_$_LazyArray };
export { View1 as _$_modulePrivate_$_View };
export { SpliceMarker1 as _$_modulePrivate_$_SpliceMarker };
export { LazyArr1 as _$_modulePrivate_$_LazyArr };
export { normIdxSlice as _$_modulePrivate_$_normIdxSlice };
export { lambda as _$_modulePrivate_$_lambda };
export { lambda1 as _$_modulePrivate_$_lambda1 };
export { Capture$scope161 as _$_modulePrivate_$_Capture$scope16 };
export { lambda$1 as _$_modulePrivate_$_lambda$ };
export { Capture$scope61 as _$_modulePrivate_$_Capture$scope6 };
export { nextf$ as _$_modulePrivate_$_nextf$ };
let LazyArray = LazyArray1; export default LazyArray;
