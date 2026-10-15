const definitionMetadata = globalThis.Symbol.for("mlscript.definitionMetadata");
const prettyPrint = globalThis.Symbol.for("mlscript.prettyPrint");
import runtime from "./Runtime.mjs";
import RuntimeJS from "./RuntimeJS.mjs";
const definitionMetadataSymbol$accessorSymbol = globalThis.Symbol("definitionMetadataSymbol");
const prettyPrintSymbol$accessorSymbol = globalThis.Symbol("prettyPrintSymbol");
const identifierPattern$accessorSymbol = globalThis.Symbol("identifierPattern");
const symbolsForArray$accessorSymbol = globalThis.Symbol("symbolsForArray");
const symbolsForSet$accessorSymbol = globalThis.Symbol("symbolsForSet");
const symbolsForObject$accessorSymbol = globalThis.Symbol("symbolsForObject");
const symbolsForMap$accessorSymbol = globalThis.Symbol("symbolsForMap");
let renderSet, indentText, renderArray, renderMap, renderClassInstance, renderRecordLike, renderObject, renderValue, renderSequence, Rendering1, lambda, lambda1, lambda2, lambda3, lambda4, lambda5, lambda6, lambda7, lambda8, lambda9, lambda10, done, done1, done2, done3, layoutSingleLine, Capture$scope91, layoutSingleLine$, lambda$, Capture$scope151, lambda$1, done$, Capture$scope171, lambda$2, done$1, lambda$3, lambda$4, lambda$5, Capture$scope241, lambda$6, done$2, Capture$scope261, lambda$7, done$3, Capture$scope281, lambda$8, lambda$9, lambda$10;
(class Capture$scope9 {
  static {
    Capture$scope91 = this
  }
  constructor(circularCounter$0) {
    this.circularCounter$0 = circularCounter$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope9"];
});
lambda$10 = (undefined, function (indents) {
  return (line, index, lines) => {
    return lambda(indents, line, index, lines)
  }
});
lambda = (undefined, function (indents, line, index, lines) {
  let scrut, scrut1, tmp, tmp1, tmp2, tmp3;
  tmp = index + 1;
  scrut = tmp === lines.length;
  if (scrut === true) {
    tmp1 = "";
  } else {
    tmp1 = " \\";
  }
  scrut1 = index === 0;
  if (scrut1 === true) {
    tmp2 = "";
  } else {
    tmp2 = indents;
  }
  tmp3 = tmp2 + line;
  return tmp3 + tmp1
});
(class Capture$scope28 {
  static {
    Capture$scope281 = this
  }
  constructor(i$0, emptyItemCount$1) {
    this.emptyItemCount$1 = emptyItemCount$1;
    this.i$0 = i$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope28"];
});
lambda$9 = (undefined, function (scope28$cap, array, length) {
  return () => {
    return lambda1(scope28$cap, array, length)
  }
});
lambda$8 = (undefined, function (scope9$cap, scope28$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array, level, length, itemIndentationLength) {
  return (isFirst, prefixLength) => {
    return lambda2(scope9$cap, scope28$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array, level, length, itemIndentationLength, isFirst, prefixLength)
  }
});
lambda1 = (undefined, function (scope28$cap, array, length) {
  let isDone, tmp;
  isDone = null;
  lbl: while (true) {
    let scrut, scrut1, tmp1, tmp2;
    if (isDone === null) {
      scrut = scope28$cap.i$0 >= length;
      if (scrut === true) {
        isDone = true;
        continue lbl
      }
      scrut1 = runtime.safeCall(globalThis.Reflect.has(array, scope28$cap.i$0));
      if (scrut1 === true) {
        isDone = false;
        continue lbl
      }
      tmp1 = scope28$cap.emptyItemCount$1 + 1;
      scope28$cap.emptyItemCount$1 = tmp1;
      tmp2 = scope28$cap.i$0 + 1;
      scope28$cap.i$0 = tmp2;
      continue lbl;
    }
    break;
  }
  tmp = scope28$cap.emptyItemCount$1 === 0;
  if (tmp === true) {
    if (isDone === null) {
      return true
    }
    return isDone;
  }
  return false;
});
lambda2 = (undefined, function (scope9$cap, scope28$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array, level, length, itemIndentationLength, isFirst, prefixLength) {
  let scrut, emptyItemCount$_, scrut1, prefixLengthIfSameLine, scrut2, valueStr, tmp, tmp1, tmp2, tmp3, tmp4;
  scrut = scope28$cap.emptyItemCount$1 > 0;
  if (scrut === true) {
    emptyItemCount$_ = scope28$cap.emptyItemCount$1;
    scope28$cap.emptyItemCount$1 = 0;
    tmp = "<" + emptyItemCount$_;
    return tmp + " empty items>"
  }
  scrut1 = scope28$cap.i$0 < length;
  if (scrut1 === true) {
    if (isFirst === true) {
      tmp1 = 0;
    } else {
      tmp1 = 2;
    }
    prefixLengthIfSameLine = prefixLength + tmp1;
    scrut2 = prefixLengthIfSameLine <= breakLength;
    if (scrut2 === true) {
      tmp2 = prefixLengthIfSameLine;
    } else {
      tmp2 = itemIndentationLength;
    }
    tmp3 = level + 1;
    valueStr = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array.at(scope28$cap.i$0), tmp3, 0, tmp2);
    tmp4 = scope28$cap.i$0 + 1;
    scope28$cap.i$0 = tmp4;
    return valueStr
  }
  throw globalThis.Object.freeze(new globalThis.Error("All items in this array has been rendered."));
});
(class Capture$scope26 {
  static {
    Capture$scope261 = this
  }
  constructor(peek$0) {
    this.peek$0 = peek$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope26"];
});
done$3 = function done$(scope26$cap) {
  return () => {
    return scope26$cap.peek$0.done
  }
};
lambda$7 = (undefined, function (scope9$cap, scope26$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, theSet, level, keyLength, startPos, iterator, itemIndentationLength) {
  return (isFirst, prefixLength) => {
    return lambda3(scope9$cap, scope26$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, theSet, level, keyLength, startPos, iterator, itemIndentationLength, isFirst, prefixLength)
  }
});
done = function done(scope26$cap) {
  return scope26$cap.peek$0.done
};
lambda3 = (undefined, function (scope9$cap, scope26$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, theSet, level, keyLength, startPos, iterator, itemIndentationLength, isFirst, prefixLength) {
  let prefixLengthIfSameLine, scrut, field_value$, field_done$, tmp, tmp1, tmp2, tmp3, tmp4;
  if (scope26$cap.peek$0 instanceof globalThis.Object) {
    if ("done" in scope26$cap.peek$0) {
      field_done$ = scope26$cap.peek$0.done;
      if ("value" in scope26$cap.peek$0) {
        field_value$ = scope26$cap.peek$0.value;
        if (field_done$ === false) {
          if (isFirst === true) {
            tmp = 0;
          } else {
            tmp = 2;
          }
          prefixLengthIfSameLine = prefixLength + tmp;
          scrut = prefixLengthIfSameLine > breakLength;
          if (scrut === true) {
            tmp1 = itemIndentationLength;
          } else {
            tmp1 = prefixLengthIfSameLine;
          }
          tmp2 = level + 1;
          tmp3 = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, field_value$, tmp2, 0, tmp1);
          tmp4 = runtime.safeCall(iterator.next());
          scope26$cap.peek$0 = tmp4;
          return tmp3
        }
        throw globalThis.Object.freeze(new globalThis.Error("match error"));
      }
      throw globalThis.Object.freeze(new globalThis.Error("match error"));
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
(class Capture$scope24 {
  static {
    Capture$scope241 = this
  }
  constructor(i$0) {
    this.i$0 = i$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope24"];
});
done$2 = function done$(scope24$cap, length) {
  return () => {
    return scope24$cap.i$0 >= length
  }
};
lambda$6 = (undefined, function (scope9$cap, scope24$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, constructorName, fieldNames, instance, level, keyLength, startPos, length, itemIndentationLength) {
  return (isFirst, prefixLength) => {
    return lambda4(scope9$cap, scope24$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, constructorName, fieldNames, instance, level, keyLength, startPos, length, itemIndentationLength, isFirst, prefixLength)
  }
});
done1 = function done(scope24$cap, length) {
  return scope24$cap.i$0 >= length
};
lambda4 = (undefined, function (scope9$cap, scope24$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, constructorName, fieldNames, instance, level, keyLength, startPos, length, itemIndentationLength, isFirst, prefixLength) {
  let scrut, value, prefixLengthIfSameLine, scrut1, tmp, tmp1, tmp2, tmp3;
  scrut = fieldNames.at(scope24$cap.i$0);
  tmp = scope24$cap.i$0 + 1;
  scope24$cap.i$0 = tmp;
  if (scrut === null) {
    return "_"
  } else if (typeof scrut === 'string') {
    value = instance[scrut];
    if (isFirst === true) {
      tmp1 = 0;
    } else {
      tmp1 = 2;
    }
    prefixLengthIfSameLine = prefixLength + tmp1;
    scrut1 = prefixLengthIfSameLine > breakLength;
    if (scrut1 === true) {
      tmp2 = itemIndentationLength;
    } else {
      tmp2 = prefixLengthIfSameLine;
    }
    tmp3 = level + 1;
    return renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, value, tmp3, 0, tmp2)
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
lambda$5 = (undefined, function (symbols, items, parentIndent, itemIdent) {
  return () => {
    return lambda5(symbols, items, parentIndent, itemIdent)
  }
});
lambda$4 = (undefined, function (padding, symbols, items) {
  return () => {
    return lambda6(padding, symbols, items)
  }
});
lambda5 = (undefined, function (symbols, items, parentIndent, itemIdent) {
  let tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7;
  tmp = symbols.start + "\n";
  tmp1 = tmp + itemIdent;
  tmp2 = symbols.separator + "\n";
  tmp3 = tmp2 + itemIdent;
  tmp4 = runtime.safeCall(items.join(tmp3));
  tmp5 = tmp1 + tmp4;
  tmp6 = tmp5 + "\n";
  tmp7 = tmp6 + parentIndent;
  return tmp7 + symbols.end
});
lambda6 = (undefined, function (padding, symbols, items) {
  let scrut, scrut1, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6;
  scrut = symbols.padding;
  if (scrut === true) {
    tmp = padding;
  } else {
    tmp = "";
  }
  tmp1 = symbols.start + tmp;
  tmp2 = symbols.separator + " ";
  tmp3 = runtime.safeCall(items.join(tmp2));
  tmp4 = tmp1 + tmp3;
  scrut1 = symbols.padding;
  if (scrut1 === true) {
    tmp5 = padding;
  } else {
    tmp5 = "";
  }
  tmp6 = tmp4 + tmp5;
  return tmp6 + symbols.end
});
(class Capture$scope17 {
  static {
    Capture$scope171 = this
  }
  constructor(i$0) {
    this.i$0 = i$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope17"];
});
lambda$3 = (undefined, function (scope17$cap, entries, length) {
  return () => {
    return lambda7(scope17$cap, entries, length)
  }
});
done$1 = function done$(scope17$cap, length) {
  return () => {
    return scope17$cap.i$0 >= length
  }
};
lambda$2 = (undefined, function (scope9$cap, scope17$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, subject, level, keyLength, startPos, isRefinement, entries, length, itemIndentationLength, skipNonEnumerable) {
  return (isFirst, prefixLength) => {
    return lambda8(scope9$cap, scope17$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, subject, level, keyLength, startPos, isRefinement, entries, length, itemIndentationLength, skipNonEnumerable, isFirst, prefixLength)
  }
});
lambda7 = (undefined, function (scope17$cap, entries, length) {
  lbl: while (true) {
    let scrut, scrut1, tmp;
    scrut = scope17$cap.i$0 < length;
    if (scrut === true) {
      scrut1 = entries.at(scope17$cap.i$0)[1].enumerable;
      if (scrut1 === false) {
        tmp = scope17$cap.i$0 + 1;
        scope17$cap.i$0 = tmp;
        continue lbl
      }
    }
    break;
  }
  return runtime.Unit
});
done2 = function done(scope17$cap, length) {
  return scope17$cap.i$0 >= length
};
lambda8 = (undefined, function (scope9$cap, scope17$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, subject, level, keyLength, startPos, isRefinement, entries, length, itemIndentationLength, skipNonEnumerable, isFirst, prefixLength) {
  let key, desc, dryRunStartPos, scrut, valueStr, tmp, tmp1, field_set$, field_get$, field_value$, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, inlinedVal;
  key = entries.at(scope17$cap.i$0)[0];
  desc = entries.at(scope17$cap.i$0)[1];
  runtime.safeCall(skipNonEnumerable());
  tmp = scope17$cap.i$0 + 1;
  scope17$cap.i$0 = tmp;
  inlinedVal = runtime.safeCall(Rendering2[identifierPattern$accessorSymbol].test(key));
  if (inlinedVal === true) {
    tmp1 = key;
  } else {
    tmp1 = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, key, 0, 0, 0);
  }
  if (desc instanceof globalThis.Object) {
    if ("value" in desc) {
      field_value$ = desc.value;
      if (isFirst === true) {
        tmp2 = 0;
      } else {
        tmp2 = 2;
      }
      tmp3 = tmp2 + tmp1.length;
      tmp4 = tmp3 + 2;
      dryRunStartPos = prefixLength + tmp4;
      scrut = dryRunStartPos > breakLength;
      if (scrut === true) {
        tmp5 = itemIndentationLength;
      } else {
        tmp5 = dryRunStartPos;
      }
      tmp6 = level + 1;
      tmp7 = tmp1.length + 2;
      valueStr = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, field_value$, tmp6, tmp7, tmp5);
      return globalThis.Object.freeze([
        tmp1,
        valueStr
      ])
    } else if (desc instanceof globalThis.Object) {
      if ("get" in desc) {
        field_get$ = desc.get;
        if ("set" in desc) {
          field_set$ = desc.set;
          if (field_set$ === undefined) {
            return globalThis.Object.freeze([
              tmp1,
              "[Getter]"
            ])
          }
          if (field_get$ === undefined) {
            return globalThis.Object.freeze([
              tmp1,
              "[Setter]"
            ])
          }
          return globalThis.Object.freeze([
            tmp1,
            "[Getter/Setter]"
          ]);
        }
        return globalThis.Object.freeze([
          tmp1,
          "\u2039Non-data property\u203A"
        ]);
      }
      return globalThis.Object.freeze([
        tmp1,
        "\u2039Non-data property\u203A"
      ]);
    }
    return globalThis.Object.freeze([
      tmp1,
      "\u2039Non-data property\u203A"
    ]);
  } else if (desc instanceof globalThis.Object) {
    if ("get" in desc) {
      field_get$ = desc.get;
      if ("set" in desc) {
        field_set$ = desc.set;
        if (field_set$ === undefined) {
          return globalThis.Object.freeze([
            tmp1,
            "[Getter]"
          ])
        }
        if (field_get$ === undefined) {
          return globalThis.Object.freeze([
            tmp1,
            "[Setter]"
          ])
        }
        return globalThis.Object.freeze([
          tmp1,
          "[Getter/Setter]"
        ]);
      }
      return globalThis.Object.freeze([
        tmp1,
        "\u2039Non-data property\u203A"
      ]);
    }
    return globalThis.Object.freeze([
      tmp1,
      "\u2039Non-data property\u203A"
    ]);
  }
  return globalThis.Object.freeze([
    tmp1,
    "\u2039Non-data property\u203A"
  ]);
});
(class Capture$scope15 {
  static {
    Capture$scope151 = this
  }
  constructor(peek$0) {
    this.peek$0 = peek$0;
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Capture$scope15"];
});
done$ = function done$(scope15$cap) {
  return () => {
    return scope15$cap.peek$0.done
  }
};
lambda$1 = (undefined, function (scope9$cap, scope15$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, map, level, keyLength, startPos, iterator, itemIndentationLength) {
  return (isFirst, prefixLength) => {
    return lambda9(scope9$cap, scope15$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, map, level, keyLength, startPos, iterator, itemIndentationLength, isFirst, prefixLength)
  }
});
done3 = function done(scope15$cap) {
  return scope15$cap.peek$0.done
};
lambda9 = (undefined, function (scope9$cap, scope15$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, map, level, keyLength, startPos, iterator, itemIndentationLength, isFirst, prefixLength) {
  let last, keyPrefixLengthIfSameLine, scrut, keyStr, scrut1, valueStr, tmp, field_value$, field_done$, element1$, element0$, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10;
  last = scope15$cap.peek$0;
  tmp = runtime.safeCall(iterator.next());
  scope15$cap.peek$0 = tmp;
  if (last instanceof globalThis.Object) {
    if ("done" in last) {
      field_done$ = last.done;
      if ("value" in last) {
        field_value$ = last.value;
        if (field_done$ === false) {
          if (runtime.Tuple.isArrayLike(field_value$) && field_value$.length === 2) {
            element0$ = runtime.Tuple.get(field_value$, 0);
            element1$ = runtime.Tuple.get(field_value$, 1);
            if (isFirst === true) {
              tmp1 = 0;
            } else {
              tmp1 = 2;
            }
            keyPrefixLengthIfSameLine = prefixLength + tmp1;
            scrut = keyPrefixLengthIfSameLine > breakLength;
            if (scrut === true) {
              tmp2 = itemIndentationLength;
            } else {
              tmp2 = keyPrefixLengthIfSameLine;
            }
            tmp3 = level + 1;
            keyStr = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, element0$, tmp3, 0, tmp2);
            tmp4 = runtime.safeCall(keyStr.indexOf("\n"));
            scrut1 = tmp4 >= 0;
            if (scrut1 === true) {
              tmp5 = itemIndentationLength + keyStr.length;
              tmp6 = runtime.safeCall(keyStr.lastIndexOf("\n"));
              tmp7 = tmp5 - tmp6;
              tmp8 = tmp7 + 5;
            } else {
              tmp9 = tmp2 + keyStr.length;
              tmp8 = tmp9 + 5;
            }
            tmp10 = level + 1;
            valueStr = renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, element1$, tmp10, 0, tmp8);
            return globalThis.Object.freeze([
              keyStr,
              valueStr
            ])
          }
          throw globalThis.Object.freeze(new globalThis.Error("match error"));
        }
        throw globalThis.Object.freeze(new globalThis.Error("match error"));
      }
      throw globalThis.Object.freeze(new globalThis.Error("match error"));
    }
    throw globalThis.Object.freeze(new globalThis.Error("match error"));
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
});
lambda$ = (undefined, function (symbols, items, parentIndent, itemIdent) {
  return () => {
    return lambda10(symbols, items, parentIndent, itemIdent)
  }
});
layoutSingleLine$ = function layoutSingleLine$(symbols, startPadding, endPadding, items) {
  return () => {
    return layoutSingleLine(symbols, startPadding, endPadding, items)
  }
};
lambda10 = (undefined, function (symbols, items, parentIndent, itemIdent) {
  let tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6;
  tmp = symbols.start + "\n";
  tmp1 = tmp + itemIdent;
  tmp2 = ",\n" + itemIdent;
  tmp3 = runtime.safeCall(items.join(tmp2));
  tmp4 = tmp1 + tmp3;
  tmp5 = tmp4 + "\n";
  tmp6 = tmp5 + parentIndent;
  return tmp6 + symbols.end
});
layoutSingleLine = function layoutSingleLine(symbols, startPadding, endPadding, items) {
  let tmp, tmp1, tmp2, tmp3;
  tmp = symbols.start + startPadding;
  tmp1 = runtime.safeCall(items.join(", "));
  tmp2 = tmp + tmp1;
  tmp3 = tmp2 + endPadding;
  return tmp3 + symbols.end
};
indentText = function indentText(indent, text, currentLevel) {
  let indents, tmp, tmp1, tmp2, lambda$here;
  if (indent === null) {
    return text
  }
  tmp = currentLevel + 1;
  indents = runtime.safeCall(indent.repeat(tmp));
  tmp1 = runtime.safeCall(text.split("\n"));
  lambda$here = lambda$10(indents);
  tmp2 = runtime.safeCall(tmp1.map(lambda$here));
  return runtime.safeCall(tmp2.join("\n"));
};
renderArray = function renderArray(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array, level, keyLength, startPos) {
  let length, done4, next, tmp, tmp1, scope28$cap;
  scope28$cap = new Capture$scope281(undefined, undefined);
  scope28$cap.i$0 = 0;
  length = array.length;
  scope28$cap.emptyItemCount$1 = 0;
  if (indent === null) {
    tmp = 0;
  } else {
    tmp1 = level + 1;
    tmp = tmp1 * indent.length;
  }
  done4 = lambda$9(scope28$cap, array, length);
  next = lambda$8(scope9$cap, scope28$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, array, level, length, tmp);
  return renderSequence(indent, breakLength, padding, done4, next, level, keyLength, startPos, Rendering2[symbolsForArray$accessorSymbol])
};
renderSet = function renderSet(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, theSet, level, keyLength, startPos) {
  let iterator, done4, next, tmp, tmp1, tmp2, scope26$cap;
  scope26$cap = new Capture$scope261(undefined);
  iterator = runtime.safeCall(theSet[globalThis.Symbol.iterator]());
  scope26$cap.peek$0 = runtime.safeCall(iterator.next());
  if (indent === null) {
    tmp = 0;
  } else {
    tmp1 = level + 1;
    tmp = tmp1 * indent.length;
  }
  done4 = done$3(scope26$cap);
  next = lambda$7(scope9$cap, scope26$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, theSet, level, keyLength, startPos, iterator, tmp);
  tmp2 = Rendering2[symbolsForSet$accessorSymbol](theSet.size);
  return renderSequence(indent, breakLength, padding, done4, next, level, keyLength, startPos, tmp2)
};
renderClassInstance = function renderClassInstance(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, constructorName, fieldNames, instance, level, keyLength, startPos) {
  let length, done4, next, tmp, tmp1, scope24$cap, inlinedVal, start, empty;
  scope24$cap = new Capture$scope241(undefined);
  length = fieldNames.length;
  scope24$cap.i$0 = 0;
  if (indent === null) {
    tmp = 0;
  } else {
    tmp1 = level + 1;
    tmp = tmp1 * indent.length;
  }
  done4 = done$2(scope24$cap, length);
  next = lambda$6(scope9$cap, scope24$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, constructorName, fieldNames, instance, level, keyLength, startPos, length, tmp);
  start = constructorName + "(";
  empty = constructorName + "()";
  inlinedVal = globalThis.Object.freeze({
    start: start,
    end: ")",
    separator: ",",
    empty: empty,
    padding: false
  });
  return renderSequence(indent, breakLength, padding, done4, next, level, keyLength, startPos, inlinedVal)
};
renderSequence = function renderSequence(indent, breakLength, padding, done4, next, level, keyLength, startPos, symbols) {
  let items, hasMultiline, singleLineLength, scrut, scrut1, scrut2, scrut3, scrut4, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10;
  items = [];
  hasMultiline = false;
  tmp = startPos + symbols.start.length;
  scrut = symbols.padding;
  if (scrut === true) {
    tmp1 = padding.length;
  } else {
    tmp1 = 0;
  }
  singleLineLength = tmp + tmp1;
  if (indent === null) {
    tmp2 = null;
  } else {
    tmp2 = runtime.safeCall(indent.repeat(level));
  }
  if (indent === null) {
    tmp3 = null;
  } else {
    tmp4 = level + 1;
    tmp3 = runtime.safeCall(indent.repeat(tmp4));
  }
  lbl: while (true) {
    let scrut5, item, scrut6, scrut7, scrut8, tmp11, tmp12, tmp13, tmp14, tmp15;
    scrut5 = runtime.safeCall(done4());
    if (scrut5 === false) {
      scrut6 = items.length;
      if (scrut6 === 0) {
        tmp11 = true;
      } else {
        tmp11 = false;
      }
      item = runtime.safeCall(next(tmp11, singleLineLength));
      tmp12 = runtime.safeCall(item.indexOf("\n"));
      scrut7 = tmp12 >= 0;
      if (scrut7 === true) {
        hasMultiline = true;
      }
      scrut8 = items.length;
      if (scrut8 === 0) {
        tmp13 = 0;
      } else {
        tmp13 = symbols.separator.length + 1;
      }
      tmp14 = singleLineLength + tmp13;
      tmp15 = tmp14 + item.length;
      singleLineLength = tmp15;
      runtime.safeCall(items.push(item));
      continue lbl
    }
    break;
  }
  scrut1 = symbols.padding;
  if (scrut1 === true) {
    tmp5 = padding.length;
  } else {
    tmp5 = 0;
  }
  tmp6 = symbols.end.length + tmp5;
  tmp7 = singleLineLength + tmp6;
  scrut2 = items.length;
  if (scrut2 === 0) {
    return symbols.empty
  }
  if (indent === null) {
    return lambda6(padding, symbols, items)
  }
  if (hasMultiline === true) {
    let tmp11, tmp12, tmp13, tmp14, tmp15, tmp16, tmp17, tmp18;
    tmp11 = symbols.start + "\n";
    tmp12 = tmp11 + tmp3;
    tmp13 = symbols.separator + "\n";
    tmp14 = tmp13 + tmp3;
    tmp15 = runtime.safeCall(items.join(tmp14));
    tmp16 = tmp12 + tmp15;
    tmp17 = tmp16 + "\n";
    tmp18 = tmp17 + tmp2;
    return tmp18 + symbols.end
  }
  scrut3 = tmp7 <= breakLength;
  if (scrut3 === true) {
    return lambda6(padding, symbols, items)
  }
  tmp8 = tmp7 - startPos;
  tmp9 = tmp8 + keyLength;
  tmp10 = tmp2.length + tmp9;
  scrut4 = tmp10 <= breakLength;
  if (scrut4 === true) {
    return lambda6(padding, symbols, items)
  }
  {
    let tmp11, tmp12, tmp13, tmp14, tmp15, tmp16, tmp17, tmp18;
    tmp11 = symbols.start + "\n";
    tmp12 = tmp11 + tmp3;
    tmp13 = symbols.separator + "\n";
    tmp14 = tmp13 + tmp3;
    tmp15 = runtime.safeCall(items.join(tmp14));
    tmp16 = tmp12 + tmp15;
    tmp17 = tmp16 + "\n";
    tmp18 = tmp17 + tmp2;
    return tmp18 + symbols.end;
  }
};
renderObject = function renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, subject, level, keyLength, startPos, isRefinement) {
  let entries, length, skipNonEnumerable, done4, next, tmp, tmp1, tmp2, scope17$cap;
  scope17$cap = new Capture$scope171(undefined);
  tmp = runtime.safeCall(globalThis.Object.getOwnPropertyDescriptors(subject));
  entries = runtime.safeCall(globalThis.Object.entries(tmp));
  length = entries.length;
  scope17$cap.i$0 = 0;
  if (indent === null) {
    tmp1 = 0;
  } else {
    tmp2 = level + 1;
    tmp1 = tmp2 * indent.length;
  }
  skipNonEnumerable = lambda$3(scope17$cap, entries, length);
  done4 = done$1(scope17$cap, length);
  next = lambda$2(scope9$cap, scope17$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, subject, level, keyLength, startPos, isRefinement, entries, length, tmp1, skipNonEnumerable);
  lambda7(scope17$cap, entries, length);
  return renderRecordLike(indent, breakLength, padding, done4, next, level, keyLength, startPos, Rendering2[symbolsForObject$accessorSymbol], isRefinement)
};
renderMap = function renderMap(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, map, level, keyLength, startPos) {
  let iterator, done4, next, tmp, tmp1, tmp2, scope15$cap;
  scope15$cap = new Capture$scope151(undefined);
  iterator = runtime.safeCall(map[globalThis.Symbol.iterator]());
  scope15$cap.peek$0 = runtime.safeCall(iterator.next());
  if (indent === null) {
    tmp = 0;
  } else {
    tmp1 = level + 1;
    tmp = tmp1 * indent.length;
  }
  done4 = done$(scope15$cap);
  next = lambda$1(scope9$cap, scope15$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, map, level, keyLength, startPos, iterator, tmp);
  tmp2 = Rendering2[symbolsForMap$accessorSymbol](map.size);
  return renderRecordLike(indent, breakLength, padding, done4, next, level, keyLength, startPos, tmp2, false)
};
renderRecordLike = function renderRecordLike(indent, breakLength, padding, done4, next, level, keyLength, startPos, symbols, isRefinement) {
  let scrut, scrut1, items, hasMultiline, singleLineLength, scrut2, scrut3, lengthIfBreakParent, scrut4, tmp, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9;
  if (isRefinement === true) {
    tmp = " ";
  } else {
    scrut = symbols.padding;
    if (scrut === true) {
      tmp = padding;
    } else {
      tmp = "";
    }
  }
  if (isRefinement === true) {
    tmp1 = " ";
  } else {
    scrut1 = symbols.padding;
    if (scrut1 === true) {
      tmp1 = padding;
    } else {
      tmp1 = "";
    }
  }
  items = [];
  hasMultiline = false;
  tmp2 = startPos + symbols.start.length;
  singleLineLength = tmp2 + tmp.length;
  if (indent === null) {
    tmp3 = null;
  } else {
    tmp3 = runtime.safeCall(indent.repeat(level));
  }
  if (indent === null) {
    tmp4 = null;
  } else {
    tmp5 = level + 1;
    tmp4 = runtime.safeCall(indent.repeat(tmp5));
  }
  lbl: while (true) {
    let scrut5, keyValue, scrut6, key, value, length, scrut7, scrut8, tmp10, tmp11, tmp12, tmp13, tmp14, tmp15, tmp16, tmp17;
    scrut5 = runtime.safeCall(done4());
    if (scrut5 === false) {
      scrut6 = items.length;
      if (scrut6 === 0) {
        tmp10 = true;
      } else {
        tmp10 = false;
      }
      keyValue = runtime.safeCall(next(tmp10, singleLineLength));
      key = keyValue[0];
      value = keyValue[1];
      tmp11 = key.length + 2;
      length = tmp11 + value.length;
      tmp12 = runtime.safeCall(value.indexOf("\n"));
      scrut7 = tmp12 >= 0;
      if (scrut7 === true) {
        hasMultiline = true;
      }
      scrut8 = items.length;
      if (scrut8 === 0) {
        tmp13 = 0;
      } else {
        tmp13 = symbols.entrySeparator.length;
      }
      tmp14 = singleLineLength + tmp13;
      tmp15 = tmp14 + length;
      singleLineLength = tmp15;
      tmp16 = key + symbols.keyValueSeparator;
      tmp17 = tmp16 + value;
      runtime.safeCall(items.push(tmp17));
      continue lbl
    }
    break;
  }
  tmp6 = symbols.end.length + tmp1.length;
  tmp7 = singleLineLength + tmp6;
  scrut2 = items.length;
  if (scrut2 === 0) {
    return symbols.empty
  }
  if (indent === null) {
    let tmp10, tmp11, tmp12, tmp13;
    tmp10 = symbols.start + tmp;
    tmp11 = runtime.safeCall(items.join(", "));
    tmp12 = tmp10 + tmp11;
    tmp13 = tmp12 + tmp1;
    return tmp13 + symbols.end
  }
  if (hasMultiline === true) {
    let tmp10, tmp11, tmp12, tmp13, tmp14, tmp15, tmp16;
    tmp10 = symbols.start + "\n";
    tmp11 = tmp10 + tmp4;
    tmp12 = ",\n" + tmp4;
    tmp13 = runtime.safeCall(items.join(tmp12));
    tmp14 = tmp11 + tmp13;
    tmp15 = tmp14 + "\n";
    tmp16 = tmp15 + tmp3;
    return tmp16 + symbols.end
  }
  scrut3 = tmp7 <= breakLength;
  if (scrut3 === true) {
    let tmp10, tmp11, tmp12, tmp13;
    tmp10 = symbols.start + tmp;
    tmp11 = runtime.safeCall(items.join(", "));
    tmp12 = tmp10 + tmp11;
    tmp13 = tmp12 + tmp1;
    return tmp13 + symbols.end
  }
  tmp8 = tmp7 - startPos;
  tmp9 = tmp8 + keyLength;
  lengthIfBreakParent = tmp3.length + tmp9;
  scrut4 = lengthIfBreakParent <= breakLength;
  if (scrut4 === true) {
    let tmp10, tmp11, tmp12, tmp13;
    tmp10 = symbols.start + tmp;
    tmp11 = runtime.safeCall(items.join(", "));
    tmp12 = tmp10 + tmp11;
    tmp13 = tmp12 + tmp1;
    return tmp13 + symbols.end
  }
  {
    let tmp10, tmp11, tmp12, tmp13, tmp14, tmp15, tmp16;
    tmp10 = symbols.start + "\n";
    tmp11 = tmp10 + tmp4;
    tmp12 = ",\n" + tmp4;
    tmp13 = runtime.safeCall(items.join(tmp12));
    tmp14 = tmp11 + tmp13;
    tmp15 = tmp14 + "\n";
    tmp16 = tmp15 + tmp3;
    return tmp16 + symbols.end;
  }
};
renderValue = function renderValue(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos) {
  let scrut, scrut1, scrut2, scrut3, scrut4, index, desc, scrut5, scrut6, scrut7, scrut8, scrut9, properties, scrut10, scrut11, scrut12, scrut13, scrut14, definitionMetadata1, body, head, scrut15, scrut16, scrut17, result, scrut18, tmp, tmp1, tmp2, element1$, element0$, element2$, tmp3, tmp4, element1$1, element0$1, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10, tmp11, tmp12, tmp13, tmp14, tmp15, tmp16, tmp17, tmp18, tmp19, tmp20;
  if (arg === undefined) {
    return "undefined"
  } else if (arg === null) {
    return "null"
  } else if (typeof arg === 'string') {
    return runtime.safeCall(globalThis.JSON.stringify(arg))
  } else if (typeof arg === 'bigint') {
    tmp = runtime.safeCall(arg.toString());
    return tmp + "n"
  } else if (typeof arg === 'symbol') {
    scrut = arg.description;
    if (scrut === undefined) {
      return "Symbol()"
    }
    tmp1 = "Symbol(\"" + arg.description;
    return tmp1 + "\")";
  } else if (typeof arg === 'number') {
    return runtime.safeCall(arg.toString())
  } else if (arg instanceof globalThis.RegExp) {
    return runtime.safeCall(arg.toString())
  } else if (arg === true) {
    return "true"
  } else if (arg === false) {
    return "false"
  }
  scrut1 = arg === runtime.Unit;
  if (scrut1 === true) {
    return "()"
  }
  scrut2 = runtime.safeCall(visitedObjects.has(arg));
  if (scrut2 === true) {
    if (indent === null) {
      return runtime.safeCall(visitedObjects.get(arg))
    }
  }
  scrut3 = runtime.safeCall(visitingObjects.has(arg));
  if (scrut3 === true) {
    scrut4 = runtime.safeCall(visitingObjects.get(arg));
    if (globalThis.Number.isInteger(scrut4)) {
      return "ref'" + scrut4
    }
    index = scope9$cap.circularCounter$0;
    tmp2 = scope9$cap.circularCounter$0 + 1;
    scope9$cap.circularCounter$0 = tmp2;
    runtime.safeCall(visitingObjects.set(arg, index));
    return "ref'" + index;
  }
  runtime.safeCall(visitingObjects.set(arg, null));
  if (arg instanceof globalThis.Array) {
    tmp3 = renderArray(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos);
  } else if (arg instanceof globalThis.Set) {
    tmp3 = renderSet(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos);
  } else if (arg instanceof globalThis.Map) {
    tmp3 = renderMap(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos);
  } else if (arg instanceof globalThis.WeakSet) {
    tmp3 = "WeakSet { <items unknown> }";
  } else if (arg instanceof globalThis.WeakMap) {
    tmp3 = "WeakMap { <items unknown> }";
  } else if (arg instanceof globalThis.Error) {
    tmp4 = arg.name + ": ";
    tmp3 = tmp4 + arg.message;
  } else if (arg instanceof globalThis.Function) {
    desc = runtime.safeCall(globalThis.Object.getOwnPropertyDescriptor(arg, "prototype"));
    σ$x: {
      if (desc instanceof globalThis.Object) {
        scrut8 = desc.writable;
        if (scrut8 === false) {
          scrut5 = runtime.safeCall(desc.value.constructor.hasOwnProperty(Rendering2[definitionMetadataSymbol$accessorSymbol]));
          σ$x1: {
            if (scrut5 === true) {
              scrut6 = desc.value.constructor[Rendering2[definitionMetadataSymbol$accessorSymbol]];
              if (runtime.Tuple.isArrayLike(scrut6) && scrut6.length >= 2) {
                let tmp21;
                element0$1 = runtime.Tuple.get(scrut6, 0);
                element1$1 = runtime.Tuple.get(scrut6, 1);
                tmp21 = scrut6.length - 0;
                runtime.safeCall(scrut6.slice(2, tmp21));
                tmp8 = element0$1 + " ";
                tmp7 = tmp8 + element1$1;
                break σ$x1
              }
            }
            scrut7 = arg.name;
            if (scrut7 === "") {
              tmp7 = "class";
            } else {
              tmp7 = "class " + arg.name;
            }
          }
          tmp5 = tmp7;
          break σ$x
        }
      }
      scrut9 = arg.name;
      if (scrut9 === "") {
        tmp6 = "";
      } else {
        tmp6 = " " + arg.name;
      }
      tmp5 = "fun" + tmp6;
    }
    tmp9 = startPos + tmp5.length;
    properties = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, tmp9, true);
    if (properties === "{}") {
      tmp10 = "";
    } else {
      tmp10 = " " + properties;
    }
    tmp3 = tmp5 + tmp10;
  } else {
    scrut10 = runtime.safeCall(globalThis.Reflect.getPrototypeOf(arg));
    if (scrut10 === null) {
      tmp3 = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos, false);
    } else {
      scrut11 = scrut10 === globalThis.Object.prototype;
      if (scrut11 === true) {
        tmp3 = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos, false);
      } else {
        scrut12 = scrut10.constructor;
        if (scrut12 instanceof globalThis.Function) {
          scrut13 = runtime.safeCall(scrut10.hasOwnProperty(Rendering2[prettyPrintSymbol$accessorSymbol]));
          if (scrut13 === true) {
            let inlinedVal, indents, tmp21, tmp22, tmp23, lambda$here;
            tmp11 = runtime.safeCall(arg[Rendering2[prettyPrintSymbol$accessorSymbol]]());
            if (indent === null) {
              inlinedVal = tmp11;
            } else {
              tmp21 = level + 1;
              indents = runtime.safeCall(indent.repeat(tmp21));
              tmp22 = runtime.safeCall(tmp11.split("\n"));
              lambda$here = lambda$10(indents);
              tmp23 = runtime.safeCall(tmp22.map(lambda$here));
              inlinedVal = runtime.safeCall(tmp23.join("\n"));
            }
            tmp3 = inlinedVal;
          } else {
            scrut14 = runtime.safeCall(scrut10.constructor.hasOwnProperty(Rendering2[definitionMetadataSymbol$accessorSymbol]));
            σ$x2: {
              if (scrut14 === true) {
                definitionMetadata1 = scrut10.constructor[Rendering2[definitionMetadataSymbol$accessorSymbol]];
                if (runtime.Tuple.isArrayLike(definitionMetadata1) && definitionMetadata1.length === 3) {
                  element0$ = runtime.Tuple.get(definitionMetadata1, 0);
                  element1$ = runtime.Tuple.get(definitionMetadata1, 1);
                  element2$ = runtime.Tuple.get(definitionMetadata1, 2);
                  tmp12 = renderClassInstance(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, element1$, element2$, arg, level, keyLength, startPos);
                  break σ$x2
                } else if (runtime.Tuple.isArrayLike(definitionMetadata1) && definitionMetadata1.length === 2) {
                  element0$ = runtime.Tuple.get(definitionMetadata1, 0);
                  element1$ = runtime.Tuple.get(definitionMetadata1, 1);
                  switch (element0$) {
                    case "class":
                      tmp15 = element1$;
                      break;
                    case "object":
                      tmp15 = element1$;
                      break;
                    default:
                      tmp16 = element0$ + " ";
                      tmp15 = tmp16 + element1$;
                  }
                  tmp17 = startPos + tmp15.length;
                  body = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, tmp17, true);
                  if (body === "{}") {
                    tmp18 = "";
                  } else {
                    tmp18 = " " + body;
                  }
                  tmp12 = tmp15 + tmp18;
                  break σ$x2
                }
              }
              head = scrut10.constructor.name + " ";
              tmp13 = startPos + head.length;
              tmp14 = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, tmp13, true);
              tmp12 = head + tmp14;
            }
            tmp3 = tmp12;
          }
        } else {
          scrut15 = runtime.safeCall(scrut10.hasOwnProperty("toString"));
          if (scrut15 === true) {
            let inlinedVal, indents, tmp21, tmp22, tmp23, lambda$here;
            tmp19 = runtime.safeCall(arg.toString());
            if (indent === null) {
              inlinedVal = tmp19;
            } else {
              tmp21 = level + 1;
              indents = runtime.safeCall(indent.repeat(tmp21));
              tmp22 = runtime.safeCall(tmp19.split("\n"));
              lambda$here = lambda$10(indents);
              tmp23 = runtime.safeCall(tmp22.map(lambda$here));
              inlinedVal = runtime.safeCall(tmp23.join("\n"));
            }
            tmp3 = inlinedVal;
          } else {
            tmp3 = renderObject(scope9$cap, Rendering2, indent, breakLength, padding, visitingObjects, visitedObjects, arg, level, keyLength, startPos, false);
          }
        }
      }
    }
  }
  scrut16 = runtime.safeCall(visitingObjects.has(arg));
  if (scrut16 === true) {
    scrut17 = runtime.safeCall(visitingObjects.get(arg));
    if (globalThis.Number.isInteger(scrut17)) {
      tmp20 = " as ref'" + scrut17;
    } else {
      tmp20 = "";
    }
    result = tmp3 + tmp20;
    scrut18 = tmp20.length > 0;
    if (scrut18 === true) {
      runtime.safeCall(visitedObjects.set(arg, result));
    }
    runtime.safeCall(visitingObjects.delete(arg));
    return result
  }
  throw globalThis.Object.freeze(new globalThis.Error("match error"));
};
(class Rendering {
  static {
    Rendering1 = this
  }
  static #definitionMetadataSymbol;
  static #prettyPrintSymbol;
  static #identifierPattern;
  static #emptyOptions;
  static #DEFAULT_BREAK_LENGTH;
  static #symbolsForArray;
  static #symbolsForObject;
  static get [definitionMetadataSymbol$accessorSymbol]() { return Rendering.#definitionMetadataSymbol; }
  static set [definitionMetadataSymbol$accessorSymbol](value) { Rendering.#definitionMetadataSymbol = value; }
  static get [prettyPrintSymbol$accessorSymbol]() { return Rendering.#prettyPrintSymbol; }
  static set [prettyPrintSymbol$accessorSymbol](value) { Rendering.#prettyPrintSymbol = value; }
  static get [identifierPattern$accessorSymbol]() { return Rendering.#identifierPattern; }
  static set [identifierPattern$accessorSymbol](value) { Rendering.#identifierPattern = value; }
  static get [symbolsForArray$accessorSymbol]() { return Rendering.#symbolsForArray; }
  static set [symbolsForArray$accessorSymbol](value) { Rendering.#symbolsForArray = value; }
  static get [symbolsForObject$accessorSymbol]() { return Rendering.#symbolsForObject; }
  static set [symbolsForObject$accessorSymbol](value) { Rendering.#symbolsForObject = value; }
  static get [symbolsForSet$accessorSymbol]() { return Rendering.#symbolsForSet; }
  static get [symbolsForMap$accessorSymbol]() { return Rendering.#symbolsForMap; }
  static {
    Rendering.#definitionMetadataSymbol = RuntimeJS.symbols.definitionMetadata;
    Rendering.#prettyPrintSymbol = RuntimeJS.symbols.prettyPrint;
    Rendering.#identifierPattern = globalThis.Object.freeze(new globalThis.RegExp("^[\\p{ID_Start}_$][\\p{ID_Continue}$]*$", "u"));
    Rendering.#emptyOptions = globalThis.Object.freeze(new globalThis.Object());
    Rendering.#DEFAULT_BREAK_LENGTH = 80;
    Rendering.#symbolsForArray = globalThis.Object.freeze({
      start: "[",
      end: "]",
      separator: ",",
      empty: "[]",
      padding: true
    });
    Rendering.#symbolsForObject = globalThis.Object.freeze({
      start: "{",
      end: "}",
      entrySeparator: ",",
      keyValueSeparator: ": ",
      empty: "{}",
      padding: true
    });
  }
  static pass1(f) {
    return (...xs) => {
      return runtime.safeCall(f(xs[0]))
    }
  }
  static pass2(f) {
    return (...xs) => {
      return runtime.safeCall(f(xs[0], xs[1]))
    }
  }
  static pass3(f) {
    return (...xs) => {
      return runtime.safeCall(f(xs[0], xs[1], xs[2]))
    }
  }
  static passing(f, ...args) {
    return runtime.safeCall(f.bind(null, ...args))
  }
  static map(f) {
    return (...xs) => {
      let tmp;
      tmp = Rendering.pass1(f);
      return runtime.safeCall(xs.map(tmp))
    }
  }
  static fold(f) {
    return (init, ...rest) => {
      let i, len;
      i = 0;
      len = rest.length;
      lbl: while (true) {
        let scrut, tmp, tmp1, tmp2;
        scrut = i < len;
        if (scrut === true) {
          tmp = runtime.safeCall(rest.at(i));
          tmp1 = runtime.safeCall(f(init, tmp));
          init = tmp1;
          tmp2 = i + 1;
          i = tmp2;
          continue lbl
        }
        break;
      }
      return init
    }
  }
  static interleave(sep) {
    return (...args) => {
      let scrut, res, len, i, tmp, tmp1;
      scrut = args.length === 0;
      if (scrut === true) {
        return globalThis.Object.freeze([])
      }
      tmp = args.length * 2;
      tmp1 = tmp - 1;
      res = runtime.safeCall(globalThis.Array(tmp1));
      len = args.length;
      i = 0;
      lbl: while (true) {
        let scrut1, idx, scrut2, tmp2, tmp3;
        scrut1 = i < len;
        if (scrut1 === true) {
          idx = i * 2;
          res[idx] = args.at(i);
          tmp2 = i + 1;
          i = tmp2;
          scrut2 = tmp2 < len;
          if (scrut2 === true) {
            tmp3 = idx + 1;
            res[tmp3] = sep;
            continue lbl
          }
          continue lbl;
        }
        break;
      }
      return res;
    }
  }
  static #noNeedForQuotes(id) {
    return runtime.safeCall(Rendering.#identifierPattern.test(id))
  }
  static #symbolsForSet(n) {
    let headline, start, empty, tmp;
    tmp = "Set(" + n;
    headline = tmp + ") ";
    start = headline + "{";
    empty = headline + "{}";
    return globalThis.Object.freeze({
      start: start,
      end: "}",
      separator: ",",
      empty: empty,
      padding: true
    })
  }
  static #symbolsForClass(name) {
    let start, empty;
    start = name + "(";
    empty = name + "()";
    return globalThis.Object.freeze({
      start: start,
      end: ")",
      separator: ",",
      empty: empty,
      padding: false
    })
  }
  static #symbolsForMap(n) {
    let headline, start, empty, tmp;
    tmp = "Map(" + n;
    headline = tmp + ")";
    start = headline + " {";
    empty = headline + " {}";
    return globalThis.Object.freeze({
      start: start,
      end: "}",
      entrySeparator: ",",
      keyValueSeparator: " => ",
      empty: empty,
      padding: true
    })
  }
  static render(target, ...args) {
    let scrut, scrut1, visitingObjects, visitedObjects, element0$, tmp, field_indent$, tmp1, field_breakLength$, tmp2, field_padding$, tmp3, scope9$cap;
    scope9$cap = new Capture$scope91(undefined);
    if (runtime.Tuple.isArrayLike(args) && args.length >= 1) {
      let tmp4;
      element0$ = runtime.Tuple.get(args, 0);
      tmp4 = args.length - 0;
      runtime.safeCall(args.slice(1, tmp4));
      tmp = element0$;
    } else {
      tmp = Rendering.#emptyOptions;
    }
    if (tmp instanceof globalThis.Object) {
      if ("indent" in tmp) {
        field_indent$ = tmp.indent;
        if (field_indent$ === true) {
          tmp1 = "  ";
        } else if (globalThis.Number.isInteger(field_indent$)) {
          scrut = field_indent$ > 0;
          if (scrut === true) {
            tmp1 = runtime.safeCall((" ").repeat(field_indent$));
          } else {
            tmp1 = null;
          }
        } else {
          tmp1 = null;
        }
        if (tmp1 === null) {
          tmp2 = globalThis.Number.POSITIVE_INFINITY;
        } else {
          if (tmp instanceof globalThis.Object) {
            if ("breakLength" in tmp) {
              field_breakLength$ = tmp.breakLength;
              if (globalThis.Number.isInteger(field_breakLength$)) {
                scrut1 = field_breakLength$ > 0;
                if (scrut1 === true) {
                  tmp2 = field_breakLength$;
                } else {
                  tmp2 = Rendering.#DEFAULT_BREAK_LENGTH;
                }
              } else {
                tmp2 = Rendering.#DEFAULT_BREAK_LENGTH;
              }
            } else {
              tmp2 = Rendering.#DEFAULT_BREAK_LENGTH;
            }
          } else {
            tmp2 = Rendering.#DEFAULT_BREAK_LENGTH;
          }
        }
      } else {
        tmp1 = null;
        tmp2 = globalThis.Number.POSITIVE_INFINITY;
      }
    } else {
      tmp1 = null;
      tmp2 = globalThis.Number.POSITIVE_INFINITY;
    }
    if (tmp instanceof globalThis.Object) {
      if ("padding" in tmp) {
        field_padding$ = tmp.padding;
        if (field_padding$ === true) {
          tmp3 = " ";
        } else {
          tmp3 = "";
        }
      } else {
        tmp3 = "";
      }
    } else {
      tmp3 = "";
    }
    scope9$cap.circularCounter$0 = 1;
    visitingObjects = globalThis.Object.freeze(new globalThis.WeakMap());
    visitedObjects = globalThis.Object.freeze(new globalThis.WeakMap());
    return renderValue(scope9$cap, Rendering, tmp1, tmp2, tmp3, visitingObjects, visitedObjects, target, 0, 0, 0)
  }
  toString() { return runtime.render(this); }
  static [definitionMetadata] = ["class", "Rendering"];
});
export { renderSet as _$_modulePrivate_$_renderSet };
export { indentText as _$_modulePrivate_$_indentText };
export { renderArray as _$_modulePrivate_$_renderArray };
export { renderMap as _$_modulePrivate_$_renderMap };
export { renderClassInstance as _$_modulePrivate_$_renderClassInstance };
export { renderRecordLike as _$_modulePrivate_$_renderRecordLike };
export { renderObject as _$_modulePrivate_$_renderObject };
export { renderValue as _$_modulePrivate_$_renderValue };
export { renderSequence as _$_modulePrivate_$_renderSequence };
export { Rendering1 as _$_modulePrivate_$_Rendering };
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
export { done as _$_modulePrivate_$_done };
export { done1 as _$_modulePrivate_$_done1 };
export { done2 as _$_modulePrivate_$_done2 };
export { done3 as _$_modulePrivate_$_done3 };
export { layoutSingleLine as _$_modulePrivate_$_layoutSingleLine };
export { Capture$scope91 as _$_modulePrivate_$_Capture$scope9 };
export { layoutSingleLine$ as _$_modulePrivate_$_layoutSingleLine$ };
export { lambda$ as _$_modulePrivate_$_lambda$ };
export { Capture$scope151 as _$_modulePrivate_$_Capture$scope15 };
export { lambda$1 as _$_modulePrivate_$_lambda$1 };
export { done$ as _$_modulePrivate_$_done$ };
export { Capture$scope171 as _$_modulePrivate_$_Capture$scope17 };
export { lambda$2 as _$_modulePrivate_$_lambda$2 };
export { done$1 as _$_modulePrivate_$_done$1 };
export { lambda$3 as _$_modulePrivate_$_lambda$3 };
export { lambda$4 as _$_modulePrivate_$_lambda$4 };
export { lambda$5 as _$_modulePrivate_$_lambda$5 };
export { Capture$scope241 as _$_modulePrivate_$_Capture$scope24 };
export { lambda$6 as _$_modulePrivate_$_lambda$6 };
export { done$2 as _$_modulePrivate_$_done$2 };
export { Capture$scope261 as _$_modulePrivate_$_Capture$scope26 };
export { lambda$7 as _$_modulePrivate_$_lambda$7 };
export { done$3 as _$_modulePrivate_$_done$3 };
export { Capture$scope281 as _$_modulePrivate_$_Capture$scope28 };
export { lambda$8 as _$_modulePrivate_$_lambda$8 };
export { lambda$9 as _$_modulePrivate_$_lambda$9 };
export { lambda$10 as _$_modulePrivate_$_lambda$10 };
let Rendering = Rendering1; export default Rendering;
