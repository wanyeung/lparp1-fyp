const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
let go, Stack1, lambda, lambda$;
lambda$ = (undefined, function (Stack2, heads, tails) {
  return (caseScrut) => {
    return lambda(Stack2, heads, tails, caseScrut)
  }
});
lambda = (undefined, function (Stack2, heads, tails, caseScrut) {
  let arg$Cons$0$, arg$Cons$1$, arg$Cons$0$1, arg$Cons$1$1, tmp, tmp1, baseCall, baseCall1, baseCall2, tmp2;
  if (caseScrut instanceof Stack2.Cons.class) {
    arg$Cons$0$ = caseScrut.head;
    arg$Cons$1$ = caseScrut.tail;
    if (arg$Cons$0$ instanceof Stack2.Cons.class) {
      arg$Cons$0$1 = arg$Cons$0$.head;
      arg$Cons$1$1 = arg$Cons$0$.tail;
      tmp = Stack2.Cons(arg$Cons$0$1, heads);
      tmp1 = Stack2.Cons(arg$Cons$1$1, tails);
      baseCall = go(Stack2, tmp, tmp1);
      return runtime.safeCall(baseCall(arg$Cons$1$))
    } else if (arg$Cons$0$ instanceof Stack2.Nil.class) {
      baseCall1 = go(Stack2, heads, tails);
      return runtime.safeCall(baseCall1(arg$Cons$1$))
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  } else if (caseScrut instanceof Stack2.Nil.class) {
    if (heads instanceof Stack2.Nil.class) {
      if (tails instanceof Stack2.Nil.class) {
        return Stack2.Nil
      }
      return runtime.safeCall(runtime.assertFail("runtime/std/Stack.mls", "47"));
    }
    {
      let inlinedVal, inlinedVal1, inlinedVal2;
      inlinedVal2 = Stack2.reverseAndAppend(heads, Stack2.Nil);
      inlinedVal = Stack2.toReverseArray(inlinedVal2);
      baseCall2 = go(Stack2, Stack2.Nil, Stack2.Nil);
      inlinedVal1 = Stack2.reverseAndAppend(tails, Stack2.Nil);
      tmp2 = runtime.safeCall(baseCall2(inlinedVal1));
      return Stack2.Cons(inlinedVal, tmp2);
    }
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
go = function go(Stack2, heads, tails) {
  return lambda$(Stack2, heads, tails)
};
(class Stack {
  static {
    Stack1 = this
  }
  static {
    Stack.Cons = function Cons(head, tail) {
      return globalThis.Object.freeze(new Cons.class(head, tail));
    };
    (class Cons {
      static {
        Stack.Cons.class = this
      }
      constructor(head, tail) {
        this.head = head;
        this.tail = tail;
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["class", "Cons", ["head", "tail"]];
    });
    (class Nil {
      static {
        new this
      }
      constructor() {
        Stack.Nil = this;
        Object.defineProperty(this, "class", {
          value: Nil
        });
        globalThis.Object.freeze(this);
      }
      toString() { return runtime.render(this); }
      static [definitionMetadata] = ["object", "Nil"];
    });
  }
  static isEmpty(xs) {
    if (xs instanceof Stack.Nil.class) {
      return true
    }
    return false;
  }
  static reverseAndAppend(xs, tail) {
    loopLabel: while (true) {
      let arg$Cons$0$, arg$Cons$1$, tmp;
      if (xs instanceof Stack.Cons.class) {
        arg$Cons$0$ = xs.head;
        arg$Cons$1$ = xs.tail;
        tmp = Stack.Cons(arg$Cons$0$, tail);
        xs = arg$Cons$1$;
        tail = tmp;
        continue loopLabel
      } else if (xs instanceof Stack.Nil.class) {
        return tail
      }
      throw globalThis.Object.freeze(new globalThis.Error("match error"));
    }
  }
  static reverse(xs) {
    return Stack.reverseAndAppend(xs, Stack.Nil)
  }
  static fromArray(arr) {
    let ls, i;
    ls = Stack.Nil;
    i = arr.length - 1;
    lbl: while (true) {
      let scrut, tmp, tmp1;
      scrut = i >= 0;
      if (scrut === true) {
        tmp = runtime.safeCall(arr.at(i));
        ls = Stack.Cons(tmp, ls);
        tmp1 = i - 1;
        i = tmp1;
        continue lbl
      }
      break;
    }
    return ls
  }
  static toArray(xs) {
    let tmp;
    tmp = Stack.reverse(xs);
    return Stack.toReverseArray(tmp)
  }
  static toReverseArray(xs) {
    let arr;
    arr = [];
    lbl: while (true) {
      let arg$Cons$0$, arg$Cons$1$;
      if (xs instanceof Stack.Cons.class) {
        arg$Cons$0$ = xs.head;
        arg$Cons$1$ = xs.tail;
        runtime.safeCall(arr.push(arg$Cons$0$));
        xs = arg$Cons$1$;
        continue lbl
      }
      break;
    }
    return arr
  }
  static zip(...xss) {
    let baseCall, tmp;
    baseCall = go(Stack, Stack.Nil, Stack.Nil);
    tmp = Stack.fromArray(xss);
    return runtime.safeCall(baseCall(tmp))
  }
  static concat(xs, ys) {
    let result, current, rest, arg$Cons$0$, arg$Cons$1$;
    if (ys instanceof Stack.Nil.class) {
      return xs
    }
    if (xs instanceof Stack.Nil.class) {
      return ys
    } else if (xs instanceof Stack.Cons.class) {
      arg$Cons$0$ = xs.head;
      arg$Cons$1$ = xs.tail;
      result = new Stack.Cons.class(arg$Cons$0$, ys);
      current = result;
      rest = arg$Cons$1$;
      lbl: while (true) {
        let next, arg$Cons$0$1, arg$Cons$1$1;
        if (rest instanceof Stack.Cons.class) {
          arg$Cons$0$1 = rest.head;
          arg$Cons$1$1 = rest.tail;
          next = new Stack.Cons.class(arg$Cons$0$1, ys);
          current.tail = next;
          runtime.safeCall(globalThis.Object.freeze(current));
          current = next;
          rest = arg$Cons$1$1;
          continue lbl
        }
        break;
      }
      return runtime.safeCall(globalThis.Object.freeze(result))
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  static append(xs, y) {
    let tmp;
    tmp = Stack.Cons(y, Stack.Nil);
    return Stack.concat(xs, tmp)
  }
  static filter(xs, f) {
    loopLabel: while (true) {
      let scrut, arg$Cons$0$, arg$Cons$1$, tmp;
      if (xs instanceof Stack.Cons.class) {
        arg$Cons$0$ = xs.head;
        arg$Cons$1$ = xs.tail;
        scrut = runtime.safeCall(f(arg$Cons$0$));
        if (scrut === true) {
          tmp = Stack.filter(arg$Cons$1$, f);
          return Stack.Cons(arg$Cons$0$, tmp)
        }
        xs = arg$Cons$1$;
        continue loopLabel;
      } else if (xs instanceof Stack.Nil.class) {
        return Stack.Nil
      }
      throw globalThis.Object.freeze(new globalThis.Error("match error"));
    }
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Stack"];
});
export { go as _$_modulePrivate_$_go };
export { Stack1 as _$_modulePrivate_$_Stack };
export { lambda as _$_modulePrivate_$_lambda };
export { lambda$ as _$_modulePrivate_$_lambda$ };
let Stack = Stack1; export default Stack;
