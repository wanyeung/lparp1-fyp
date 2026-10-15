const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
import Option from "./Option.mjs";
import Stack from "./Stack.mjs";
let skipEmptyIterables, go, Iter1, lambda, lambda1, lambda2, lambda3, lambda4, lambda5, lambda6, lambda7, lambda8, lambda9, lambda10, lambda11, lambda12, lambda13, lambda14, lambda15, lambda16, lambda17, lambda18, lambda19, lambda$, lambda$1, lambda$2, lambda$3, lambda$4, Capture$scope171, lambda$5, lambda$6, lambda$7, lambda$8, Capture$taking1, lambda$9, lambda$10, Capture$leaving1, lambda$11, lambda$12, Capture$scope311, lambda$13, lambda$14, Capture$scope361, lambda$15, lambda$16, lambda$17, lambda$18, Capture$scope541, lambda$19;
(class Capture$scope54 {
  static {
    Capture$scope541 = this
  }
  constructor(current$0) {
    this.current$0 = current$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope54"];
});
lambda$19 = (undefined, function (scope54$cap, Iter2) {
  return () => {
    return lambda11(scope54$cap, Iter2)
  }
});
lambda11 = (undefined, function (scope54$cap, Iter2) {
  let arg$Cons$0$, arg$Cons$1$;
  if (scope54$cap.current$0 instanceof Stack.Cons.class) {
    arg$Cons$0$ = scope54$cap.current$0.head;
    arg$Cons$1$ = scope54$cap.current$0.tail;
    scope54$cap.current$0 = arg$Cons$1$;
    return Iter2.Result.Next(arg$Cons$0$)
  } else if (scope54$cap.current$0 instanceof Stack.Nil.class) {
    return Iter2.Result.Done
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
lambda$18 = (undefined, function (Iter2, stack) {
  return () => {
    return lambda12(Iter2, stack)
  }
});
lambda12 = (undefined, function (Iter2, stack) {
  let scope54$cap, lambda$here;
  scope54$cap = new Capture$scope541(undefined);
  scope54$cap.current$0 = stack;
  lambda$here = lambda$19(scope54$cap, Iter2);
  return Iter2.Iterator(lambda$here)
});
lambda$17 = (undefined, function (sep) {
  return (acc, x) => {
    return lambda10(sep, acc, x)
  }
});
lambda10 = (undefined, function (sep, acc, x) {
  let tmp, tmp1;
  tmp = acc + sep;
  tmp1 = runtime.safeCall(globalThis.String(x));
  return tmp + tmp1
});
go = function go(z, op, iterator) {
  let next, scrut, tmp;
  next = runtime.safeCall(iterator.next());
  scrut = next.done;
  if (scrut === true) {
    return z
  }
  tmp = go(z, op, iterator);
  return runtime.safeCall(op(next.value, tmp));
};
lambda$16 = (undefined, function (Iter2, xs) {
  return (_0) => {
    let lambda$here;
    lambda$here = lambda$14(Iter2, _0, xs);
    return Iter2.Iterable(lambda$here)
  }
});
lambda19 = (undefined, function (Iter2, xs, _0) {
  let lambda$here;
  lambda$here = lambda$14(Iter2, _0, xs);
  return Iter2.Iterable(lambda$here)
});
(class Capture$scope36 {
  static {
    Capture$scope361 = this
  }
  constructor(currentIterator$0) {
    this.currentIterator$0 = currentIterator$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope36"];
});
lambda$15 = (undefined, function (scope36$cap, Iter2, ys, xsIterator) {
  return () => {
    return lambda8(scope36$cap, Iter2, ys, xsIterator)
  }
});
lambda8 = (undefined, function (scope36$cap, Iter2, ys, xsIterator) {
  let next, scrut, scrut1, next1, scrut2, tmp;
  next = runtime.safeCall(scope36$cap.currentIterator$0.next());
  scrut = next.done;
  if (scrut === true) {
    scrut1 = scope36$cap.currentIterator$0 == xsIterator;
    if (scrut1 === true) {
      tmp = Iter2.getIterator(ys);
      scope36$cap.currentIterator$0 = tmp;
      next1 = runtime.safeCall(scope36$cap.currentIterator$0.next());
      scrut2 = next1.done;
      if (scrut2 === true) {
        return Iter2.Result.Done
      }
      return Iter2.Result.Next(next1.value);
    }
    return Iter2.Result.Done;
  }
  return Iter2.Result.Next(next.value);
});
lambda$14 = (undefined, function (Iter2, xs, ys) {
  return () => {
    return lambda9(Iter2, xs, ys)
  }
});
lambda9 = (undefined, function (Iter2, xs, ys) {
  let xsIterator, scope36$cap, lambda$here;
  scope36$cap = new Capture$scope361(undefined);
  xsIterator = Iter2.getIterator(xs);
  scope36$cap.currentIterator$0 = xsIterator;
  lambda$here = lambda$15(scope36$cap, Iter2, ys, xsIterator);
  return Iter2.Iterator(lambda$here)
});
(class Capture$scope31 {
  static {
    Capture$scope311 = this
  }
  constructor(i$0) {
    this.i$0 = i$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope31"];
});
lambda$13 = (undefined, function (scope31$cap) {
  return (x) => {
    return lambda7(scope31$cap, x)
  }
});
lambda7 = (undefined, function (scope31$cap, x) {
  let j, tmp;
  j = scope31$cap.i$0;
  tmp = scope31$cap.i$0 + 1;
  scope31$cap.i$0 = tmp;
  return globalThis.Object.freeze([
    x,
    j
  ])
});
lambda$12 = (undefined, function (Iter2, n) {
  return (_0) => {
    return lambda18(Iter2, n, _0)
  }
});
lambda18 = (undefined, function (Iter2, n, _0) {
  let leaving$cap, op, makeNext, lambda$here;
  leaving$cap = new Capture$leaving1(n);
  op = lambda$11(leaving$cap);
  makeNext = lambda$6(Iter2, op);
  lambda$here = lambda$(Iter2, _0, makeNext);
  return Iter2.Iterable(lambda$here)
});
lambda$11 = (undefined, function (leaving$cap) {
  return (_) => {
    return lambda6(leaving$cap, _)
  }
});
lambda6 = (undefined, function (leaving$cap, _) {
  let tmp;
  tmp = leaving$cap.n$0 - 1;
  leaving$cap.n$0 = tmp;
  return leaving$cap.n$0 < 0
});
(class Capture$leaving {
  static {
    Capture$leaving1 = this
  }
  constructor(n$0) {
    this.n$0 = n$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$leaving"];
});
lambda$10 = (undefined, function (Iter2, n) {
  return (_0) => {
    return lambda17(Iter2, n, _0)
  }
});
lambda17 = (undefined, function (Iter2, n, _0) {
  let taking$cap, op, makeNext, lambda$here;
  taking$cap = new Capture$taking1(n);
  op = lambda$9(taking$cap);
  makeNext = lambda$6(Iter2, op);
  lambda$here = lambda$(Iter2, _0, makeNext);
  return Iter2.Iterable(lambda$here)
});
lambda$9 = (undefined, function (taking$cap) {
  return (_) => {
    return lambda5(taking$cap, _)
  }
});
lambda5 = (undefined, function (taking$cap, _) {
  let tmp;
  tmp = taking$cap.n$0 - 1;
  taking$cap.n$0 = tmp;
  return taking$cap.n$0 >= 0
});
(class Capture$taking {
  static {
    Capture$taking1 = this
  }
  constructor(n$0) {
    this.n$0 = n$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$taking"];
});
lambda$8 = (undefined, function (Iter2, op) {
  return (_0) => {
    return lambda16(Iter2, op, _0)
  }
});
lambda16 = (undefined, function (Iter2, op, _0) {
  let makeNext, lambda$here;
  makeNext = lambda$6(Iter2, op);
  lambda$here = lambda$(Iter2, _0, makeNext);
  return Iter2.Iterable(lambda$here)
});
lambda$7 = (undefined, function (Iter2, op, iterator) {
  return () => {
    return lambda15(Iter2, op, iterator)
  }
});
lambda15 = (undefined, function (Iter2, op, iterator) {
  let next, scrut;
  next = runtime.safeCall(iterator.next());
  lbl: while (true) {
    let scrut1, scrut2, tmp;
    scrut1 = next.done;
    if (scrut1 === false) {
      scrut2 = runtime.safeCall(op(next.value));
      if (scrut2 === false) {
        tmp = runtime.safeCall(iterator.next());
        next = tmp;
        continue lbl
      }
    }
    break;
  }
  scrut = next.done;
  if (scrut === true) {
    return Iter2.Result.Done
  }
  return Iter2.Result.Next(next.value);
});
lambda$6 = (undefined, function (Iter2, op) {
  return (iterator) => {
    return lambda$7(Iter2, op, iterator)
  }
});
lambda4 = (undefined, function (Iter2, op, iterator) {
  return lambda$7(Iter2, op, iterator)
});
(class Capture$scope17 {
  static {
    Capture$scope171 = this
  }
  constructor(currentIterator$0) {
    this.currentIterator$0 = currentIterator$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope17"];
});
lambda$5 = (undefined, function (scope17$cap, Iter2, iterableIterator) {
  return () => {
    return lambda2(scope17$cap, Iter2, iterableIterator)
  }
});
skipEmptyIterables = function skipEmptyIterables(Iter2, iterableIterator) {
  loopLabel: while (true) {
    let nextIterableResult, scrut, nextIterator, nextResult, scrut1, tmp;
    nextIterableResult = runtime.safeCall(iterableIterator.next());
    scrut = nextIterableResult.done;
    if (scrut === true) {
      return Option.None
    }
    nextIterator = Iter2.getIterator(nextIterableResult.value);
    nextResult = runtime.safeCall(nextIterator.next());
    scrut1 = nextResult.done;
    if (scrut1 === true) {
      continue loopLabel
    }
    tmp = globalThis.Object.freeze([
      nextIterator,
      nextResult.value
    ]);
    return Option.Some(tmp);
  }
};
lambda2 = (undefined, function (scope17$cap, Iter2, iterableIterator) {
  let next, scrut, scrut1, arg$Some$0$, arg$Some$0$1, element1$, element0$, tmp;
  if (scope17$cap.currentIterator$0 instanceof Option.None.class) {
    return Iter2.Result.Done
  } else if (scope17$cap.currentIterator$0 instanceof Option.Some.class) {
    arg$Some$0$ = scope17$cap.currentIterator$0.value;
    next = runtime.safeCall(arg$Some$0$.next());
    scrut = next.done;
    if (scrut === true) {
      scrut1 = skipEmptyIterables(Iter2, iterableIterator);
      if (scrut1 instanceof Option.Some.class) {
        arg$Some$0$1 = scrut1.value;
        if (runtime.Tuple.isArrayLike(arg$Some$0$1) && arg$Some$0$1.length === 2) {
          element0$ = runtime.Tuple.get(arg$Some$0$1, 0);
          element1$ = runtime.Tuple.get(arg$Some$0$1, 1);
          tmp = Option.Some(element0$);
          scope17$cap.currentIterator$0 = tmp;
          return Iter2.Result.Next(element1$)
        }
        return Iter2.Result.Next(next.value);
      } else if (scrut1 instanceof Option.None.class) {
        scope17$cap.currentIterator$0 = Option.None;
        return Iter2.Result.Done
      }
      return Iter2.Result.Next(next.value);
    }
    return Iter2.Result.Next(next.value);
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
lambda$4 = (undefined, function (Iter2, xss) {
  return () => {
    return lambda3(Iter2, xss)
  }
});
lambda3 = (undefined, function (Iter2, xss) {
  let iterableIterator, firstIterableResult, scrut, tmp, tmp1, scope17$cap, lambda$here;
  scope17$cap = new Capture$scope171(undefined);
  iterableIterator = Iter2.getIterator(xss);
  firstIterableResult = runtime.safeCall(iterableIterator.next());
  scrut = firstIterableResult.done;
  if (scrut === true) {
    tmp = Option.None;
  } else {
    tmp1 = Iter2.getIterator(firstIterableResult.value);
    tmp = Option.Some(tmp1);
  }
  scope17$cap.currentIterator$0 = tmp;
  lambda$here = lambda$5(scope17$cap, Iter2, iterableIterator);
  return Iter2.Iterator(lambda$here)
});
lambda$3 = (undefined, function (Iter2, op) {
  return (_0) => {
    return lambda14(Iter2, op, _0)
  }
});
lambda14 = (undefined, function (Iter2, op, _0) {
  let makeNext, lambda$here;
  makeNext = lambda$1(Iter2, op);
  lambda$here = lambda$(Iter2, _0, makeNext);
  return Iter2.Iterable(lambda$here)
});
lambda$2 = (undefined, function (Iter2, op, iterator) {
  return () => {
    return lambda13(Iter2, op, iterator)
  }
});
lambda13 = (undefined, function (Iter2, op, iterator) {
  let next, scrut, tmp;
  next = runtime.safeCall(iterator.next());
  scrut = next.done;
  if (scrut === true) {
    return Iter2.Result.Done
  }
  tmp = runtime.safeCall(op(next.value));
  return Iter2.Result.Next(tmp);
});
lambda$1 = (undefined, function (Iter2, op) {
  return (iterator) => {
    return lambda$2(Iter2, op, iterator)
  }
});
lambda1 = (undefined, function (Iter2, op, iterator) {
  return lambda$2(Iter2, op, iterator)
});
lambda$ = (undefined, function (Iter2, iterable, makeNext) {
  return () => {
    return lambda(Iter2, iterable, makeNext)
  }
});
lambda = (undefined, function (Iter2, iterable, makeNext) {
  let iterator, tmp;
  iterator = Iter2.getIterator(iterable);
  tmp = runtime.safeCall(makeNext(iterator));
  return Iter2.Iterator(tmp)
});
(class Iter {
  static {
    Iter1 = this
  }
  static {
    (class IterableBase {
      static {
        Iter.IterableBase = this
      }
      constructor() {
        this[globalThis.Symbol.iterator] = this.iterator;
        this.#array = null;
      }
      #array;
      iterator() {
        throw globalThis.Object.freeze(new globalThis.Error("Not implemented: iterator()"))
      }
      toArray() {
        return globalThis.Object.freeze([
          ...this
        ])
      }
      get asArray() {
        let tmp, tmp1;
        if (this.#array === null) {
          tmp = this.toArray();
          tmp1 = runtime.safeCall(globalThis.Object.freeze(tmp));
          this.#array = tmp1;
          return this.#array
        }
        return this.#array;
      }
      at(idx) {
        return runtime.safeCall(this.asArray.at(idx))
      }
      concat(...xs) {
        return runtime.safeCall(this.asArray.concat(...xs))
      }
      copyWithin(...args) {
        return runtime.safeCall(this.asArray.copyWithin(...args))
      }
      entries() {
        return runtime.safeCall(this.asArray.entries())
      }
      every(...args) {
        return runtime.safeCall(this.asArray.every(...args))
      }
      filter(...args) {
        return runtime.safeCall(this.asArray.filter(...args))
      }
      find(...args) {
        return runtime.safeCall(this.asArray.find(...args))
      }
      findIndex(...args) {
        return runtime.safeCall(this.asArray.findIndex(...args))
      }
      findLast(...args) {
        return runtime.safeCall(this.asArray.findLast(...args))
      }
      findLastIndex(...args) {
        return runtime.safeCall(this.asArray.findLastIndex(...args))
      }
      flat(...args) {
        return runtime.safeCall(this.asArray.flat(...args))
      }
      flatMap(...args) {
        return runtime.safeCall(this.asArray.flatMap(...args))
      }
      forEach(...args) {
        return runtime.safeCall(this.asArray.forEach(...args))
      }
      includes(...args) {
        return runtime.safeCall(this.asArray.includes(...args))
      }
      indexOf(...args) {
        return runtime.safeCall(this.asArray.indexOf(...args))
      }
      join(...args) {
        return runtime.safeCall(this.asArray.join(...args))
      }
      keys() {
        return runtime.safeCall(this.asArray.keys())
      }
      lastIndexOf(...args) {
        return runtime.safeCall(this.asArray.lastIndexOf(...args))
      }
      map(...args) {
        return runtime.safeCall(this.asArray.map(...args))
      }
      reduce(...args) {
        return runtime.safeCall(this.asArray.reduce(...args))
      }
      reduceRight(...args) {
        return runtime.safeCall(this.asArray.reduceRight(...args))
      }
      slice(...args) {
        return runtime.safeCall(this.asArray.slice(...args))
      }
      some(...args) {
        return runtime.safeCall(this.asArray.some(...args))
      }
      toLocaleString(...args) {
        return runtime.safeCall(this.asArray.toLocaleString(...args))
      }
      toReversed() {
        return runtime.safeCall(this.asArray.toReversed())
      }
      toSorted(...args) {
        return runtime.safeCall(this.asArray.toSorted(...args))
      }
      toSpliced(...args) {
        return runtime.safeCall(this.asArray.toSpliced(...args))
      }
      toString() {
        return runtime.safeCall(this.asArray.toString())
      }
      with(...args) {
        return runtime.safeCall(this.asArray.with(...args))
      }
      fill(...args) {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.fill(...args))
      }
      pop() {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.pop())
      }
      push(...args) {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.push(...args))
      }
      reverse() {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.reverse())
      }
      shift() {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.shift())
      }
      sort(...args) {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.sort(...args))
      }
      splice(...args) {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.splice(...args))
      }
      unshift(...args) {
        let tmp;
        tmp = this.toArray();
        return runtime.safeCall(tmp.unshift(...args))
      }
      get length() {
        return this.asArray.length;
      }
      values() {
        return this.iterator()
      }
      [prettyPrint]() { return this.toString(); }
      static [definitionMetadata] = ["class", "IterableBase"];
    });
    Iter.Iterable = function Iterable(mk) {
      return globalThis.Object.freeze(new Iterable.class(mk));
    };
    (class Iterable extends Iter.IterableBase {
      static {
        Iter.Iterable.class = this
      }
      constructor(mk) {
        super();
        this.#mk = mk;
      }
      #mk;
      iterator() {
        return runtime.safeCall(this.#mk())
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Iterable", [null]];
    });
    Iter.Iterator = function Iterator(next) {
      return globalThis.Object.freeze(new Iterator.class(next));
    };
    (class Iterator {
      static {
        Iter.Iterator.class = this
      }
      constructor(next) {
        this.next = next;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Iterator", ["next"]];
    });
    (class Result {
      static {
        Iter.Result = this
      }
      static {
        Result.Next = function Next(value) {
          return globalThis.Object.freeze(new Next.class(value));
        };
        (class Next {
          static {
            Result.Next.class = this
          }
          constructor(value) {
            this.value = value;
            this.done = false;
          }
          toString() { return runtime.render(this); }
          static [definitionMetadata] = ["class", "Next", ["value"]];
        });
        (class Done {
          static {
            new this
          }
          constructor() {
            Result.Done = this;
            this.done = true;
            Object.defineProperty(this, "class", {
              value: Done
            });
            globalThis.Object.freeze(this);
          }
          toString() { return runtime.render(this); }
          static [definitionMetadata] = ["object", "Done"];
        });
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Result"];
    });
  }
  static getIterator(something) {
    let test, prototype, tmp, tmp1;
    test = something[globalThis.Symbol.iterator];
    if (test === undefined) {
      switch (something) {
        case undefined:
          tmp = "undefined";
          break;
        case null:
          tmp = "null";
          break;
        default:
          prototype = runtime.safeCall(globalThis.Reflect.getPrototypeOf(something));
          if (prototype === null) {
            tmp = "object";
          } else {
            tmp = prototype.constructor.name;
          }
      }
      tmp1 = "Not an iterable: " + tmp;
      throw runtime.safeCall(globalThis.TypeError(tmp1))
    }
    return runtime.safeCall(test.call(something));
  }
  static adaptIterable(iterable, makeNext) {
    let lambda$here;
    lambda$here = lambda$(Iter, iterable, makeNext);
    return Iter.Iterable(lambda$here)
  }
  static mapping(xs, op) {
    let lambda$here;
    lambda$here = lambda$1(Iter, op);
    return Iter.adaptIterable(xs, lambda$here)
  }
  static withMap(op) {
    return lambda$3(Iter, op)
  }
  static flattening(xss) {
    let lambda$here;
    lambda$here = lambda$4(Iter, xss);
    return Iter.Iterable(lambda$here)
  }
  static filtering(xs, op) {
    let lambda$here;
    lambda$here = lambda$6(Iter, op);
    return Iter.adaptIterable(xs, lambda$here)
  }
  static withFilter(op) {
    return lambda$8(Iter, op)
  }
  static taking(xs, n) {
    let taking$cap, lambda$here;
    taking$cap = new Capture$taking1(n);
    lambda$here = lambda$9(taking$cap);
    return Iter.filtering(xs, lambda$here)
  }
  static withMax(n) {
    return lambda$10(Iter, n)
  }
  static leaving(xs, n) {
    let leaving$cap, lambda$here;
    leaving$cap = new Capture$leaving1(n);
    lambda$here = lambda$11(leaving$cap);
    return Iter.filtering(xs, lambda$here)
  }
  static withoutAtLeast(n) {
    return lambda$12(Iter, n)
  }
  static zippingWithIndex(xs) {
    let scope31$cap, lambda$here;
    scope31$cap = new Capture$scope311(undefined);
    scope31$cap.i$0 = 0;
    lambda$here = lambda$13(scope31$cap);
    return Iter.mapping(xs, lambda$here)
  }
  static foldingImpl(iterator, acc, op) {
    let next;
    next = runtime.safeCall(iterator.next());
    lbl: while (true) {
      let scrut, tmp, tmp1;
      scrut = next.done;
      if (scrut === false) {
        tmp = runtime.safeCall(op(acc, next.value));
        acc = tmp;
        tmp1 = runtime.safeCall(iterator.next());
        next = tmp1;
        continue lbl
      }
      break;
    }
    return acc
  }
  static appended(xs, ys) {
    let lambda$here;
    lambda$here = lambda$14(Iter, xs, ys);
    return Iter.Iterable(lambda$here)
  }
  static withAppended(xs) {
    return lambda$16(Iter, xs)
  }
  static reduced(xs, op) {
    let iterator, next, scrut;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    scrut = next.done;
    if (scrut === true) {
      throw globalThis.Object.freeze(new globalThis.Error("Empty iterator"))
    }
    return Iter.foldingImpl(iterator, next.value, op);
  }
  static folded(xs, z, op) {
    let iterator;
    iterator = Iter.getIterator(xs);
    return Iter.foldingImpl(iterator, z, op)
  }
  static rightFolded(xs, z, op) {
    let iterator;
    iterator = Iter.getIterator(xs);
    return go(z, op, iterator)
  }
  static joined(xs, sep) {
    let iterator, next, scrut, tmp, lambda$here;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    scrut = next.done;
    if (scrut === true) {
      return ""
    }
    runtime.safeCall(globalThis.String(sep));
    tmp = runtime.safeCall(globalThis.String(next.value));
    lambda$here = lambda$17(sep);
    return Iter.foldingImpl(iterator, tmp, lambda$here);
  }
  static firstDefined(xs, op) {
    let iterator, next, result;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    result = Option.None;
    lbl: while (true) {
      let scrut, tmp, tmp1;
      scrut = next.done;
      if (scrut === false) {
        if (result instanceof Option.None.class) {
          tmp = runtime.safeCall(op(next.value));
          result = tmp;
          tmp1 = runtime.safeCall(iterator.next());
          next = tmp1;
          continue lbl
        }
      }
      break;
    }
    return result
  }
  static some(xs, op) {
    let iterator, next;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    lbl: while (true) {
      let scrut, scrut1, tmp;
      scrut = next.done;
      if (scrut === false) {
        scrut1 = runtime.safeCall(op(next.value));
        if (scrut1 === true) {
          return true
        }
        tmp = runtime.safeCall(iterator.next());
        next = tmp;
        continue lbl;
      }
      break;
    }
    return false
  }
  static every(xs, op) {
    let iterator, next;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    lbl: while (true) {
      let scrut, scrut1, tmp;
      scrut = next.done;
      if (scrut === false) {
        scrut1 = runtime.safeCall(op(next.value));
        if (scrut1 === false) {
          return false
        }
        tmp = runtime.safeCall(iterator.next());
        next = tmp;
        continue lbl;
      }
      break;
    }
    return true
  }
  static each(xs, op) {
    let iterator, next;
    iterator = Iter.getIterator(xs);
    next = runtime.safeCall(iterator.next());
    lbl: while (true) {
      let scrut, tmp;
      scrut = next.done;
      if (scrut === false) {
        runtime.safeCall(op(next.value));
        tmp = runtime.safeCall(iterator.next());
        next = tmp;
        continue lbl
      }
      break;
    }
    return runtime.Unit
  }
  static toArray(view) {
    return runtime.safeCall(globalThis.Array.from(view))
  }
  static fromStack(stack) {
    let lambda$here;
    lambda$here = lambda$18(Iter, stack);
    return Iter.Iterable(lambda$here)
  }
  static toStack(xs) {
    return Iter.rightFolded(xs, Stack.Nil, Stack.Cons)
  }
  static isArrayLike(xs) {
    if (xs instanceof globalThis.Array) {
      return true
    } else if (xs instanceof Iter.IterableBase) {
      return true
    }
    return false;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Iter"];
});
export { skipEmptyIterables as _$_modulePrivate_$_skipEmptyIterables };
export { go as _$_modulePrivate_$_go };
export { Iter1 as _$_modulePrivate_$_Iter };
export { lambda as _$_modulePrivate_$_lambda };
export { lambda1 as _$_modulePrivate_$_lambda1 };
export { lambda2 as _$_modulePrivate_$_lambda2 };
export { lambda3 as _$_modulePrivate_$_lambda3 };
export { lambda4 as _$_modulePrivate_$_lambda4 };
export { lambda5 as _$_modulePrivate_$_lambda5 };
export { lambda6 as _$_modulePrivate_$_lambda6 };
export { lambda7 as _$_modulePrivate_$_lambda7 };
export { lambda8 as _$_modulePrivate_$_lambda8 };
export { lambda9 as _$_modulePrivate_$_lambda9 };
export { lambda10 as _$_modulePrivate_$_lambda10 };
export { lambda11 as _$_modulePrivate_$_lambda11 };
export { lambda12 as _$_modulePrivate_$_lambda12 };
export { lambda13 as _$_modulePrivate_$_lambda13 };
export { lambda14 as _$_modulePrivate_$_lambda14 };
export { lambda15 as _$_modulePrivate_$_lambda15 };
export { lambda16 as _$_modulePrivate_$_lambda16 };
export { lambda17 as _$_modulePrivate_$_lambda17 };
export { lambda18 as _$_modulePrivate_$_lambda18 };
export { lambda19 as _$_modulePrivate_$_lambda19 };
export { lambda$ as _$_modulePrivate_$_lambda$ };
export { lambda$1 as _$_modulePrivate_$_lambda$1 };
export { lambda$2 as _$_modulePrivate_$_lambda$2 };
export { lambda$3 as _$_modulePrivate_$_lambda$3 };
export { lambda$4 as _$_modulePrivate_$_lambda$4 };
export { Capture$scope171 as _$_modulePrivate_$_Capture$scope17 };
export { lambda$5 as _$_modulePrivate_$_lambda$5 };
export { lambda$6 as _$_modulePrivate_$_lambda$6 };
export { lambda$7 as _$_modulePrivate_$_lambda$7 };
export { lambda$8 as _$_modulePrivate_$_lambda$8 };
export { Capture$taking1 as _$_modulePrivate_$_Capture$taking };
export { lambda$9 as _$_modulePrivate_$_lambda$9 };
export { lambda$10 as _$_modulePrivate_$_lambda$10 };
export { Capture$leaving1 as _$_modulePrivate_$_Capture$leaving };
export { lambda$11 as _$_modulePrivate_$_lambda$11 };
export { lambda$12 as _$_modulePrivate_$_lambda$12 };
export { Capture$scope311 as _$_modulePrivate_$_Capture$scope31 };
export { lambda$13 as _$_modulePrivate_$_lambda$13 };
export { lambda$14 as _$_modulePrivate_$_lambda$14 };
export { Capture$scope361 as _$_modulePrivate_$_Capture$scope36 };
export { lambda$15 as _$_modulePrivate_$_lambda$15 };
export { lambda$16 as _$_modulePrivate_$_lambda$16 };
export { lambda$17 as _$_modulePrivate_$_lambda$17 };
export { lambda$18 as _$_modulePrivate_$_lambda$18 };
export { Capture$scope541 as _$_modulePrivate_$_Capture$scope54 };
export { lambda$19 as _$_modulePrivate_$_lambda$19 };
let Iter = Iter1; export default Iter;
