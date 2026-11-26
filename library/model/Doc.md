# How the model works

One idea: **every value in your `.mls` file becomes a node, and the page is a tree of nodes.**

A table is a node. A record is a node that holds more nodes. A chart is a node. The whole document is the root node. There is no second tree and no second node type: `Primitive` makes the nodes, `Document` picks and arranges them.

## The picture

```
 nested.mls                          the tree the page shows
 ----------                          -----------------------

 val inventory = {                   document  "nested.mls"
   title: "Warehouse",               ├─ block   inventory            ← a record: only groups
   stock: [                          │   ├─ atom   title             ← "Warehouse"
     ["item", "units"],              │   ├─ table  stock             ← rows of scalars
     ["Tea", 30],                    │   ├─ list   tags              ← flat list
     ["Coffee", 45]                  │   └─ block  owner
   ],                                │       ├─ atom  name
   tags: ["fresh", "bulk"],          │       └─ atom  floor
   owner: { name: "Ann",             ├─ list    teams               ← list of records: groups
            floor: 2 }               │   ├─ block  0
 }                                   │   │   ├─ atom name
                                     │   │   └─ atom size
 val teams = [ {...}, {...} ]        │   └─ block  1 ...
 val total = 75                      └─ atom    total
 fun report(x) = ...                 (functions are not nodes)
```

Leaves (table, flat list, atom) are drawn as a grid. Everything with children is drawn as a section that nests.

## The node

Every node has the same fields, whatever its kind:

| field      | meaning |
|------------|---------|
| `kind`     | what it is, see below |
| `key`      | which node it is: the `val` name at the top, the record key below it, or the list position (`"0"`, `"1"`). The cursor, charts and `Document.use` look nodes up by `key` |
| `name`     | what the page shows. Equals `key` unless a document renames it |
| `path`     | the address of its literal in the source, e.g. `["inventory","stock"]` |
| `headers`, `rows` | the grid of a leaf: `headers` are the column names (the first row of a table), `rows` are the data rows below it |
| `children` | the nodes inside a block or a list of records |
| `origin`   | the import path of the file that defines it, e.g. `"./table.mls"`, or `""` if it is defined here. An imported node is read only |

| kind       | made from | has children | drawn as |
|------------|-----------|--------------|----------|
| `table`    | an array of arrays of scalars. The first row is the header | no | grid |
| `list`     | a flat array (leaf), or an array that holds records or arrays (container) | only the container | grid, or section |
| `atom`     | a number, boolean or short string | no | one-cell grid |
| `block`    | a record | yes | section |
| `text`     | a string that starts with `#` or has a line break | no | Markdown |
| `chart`    | a record `{ chart: "Bar", source, x, ys }`, or `Document.chart(...)` | no | chart |
| `missing`  | an import or chart that points at nothing | no | red "Not found" |
| `document` | the root | yes | the page |

A leaf grid's header is blank for `list` and `atom` (they have no column name yet). Typing one turns the value into a one-column table.

## Path: where a value lives

Every node knows where its value is written in your file. That address is its `path`: the `val` name, then one step for each level down.

```
val inventory = {
  stock: [ ["item", "units"], ["Tea", 30], ["Coffee", 45] ]
}

the 45 is at:  inventory → stock → third row → second column
its path:      ["inventory", "stock", 2, 1]       (the header is row 0)
```

When you edit that cell, the system takes the path, finds the matching text in the file, replaces only that text with your new value, and runs the file again. A list ends at its index, and an atom ends at its field name.

## Why `path` alone is not enough

`path` is an address in the **value**: which field, which row. The source is **text**, and a running value does not remember where in the text it came from. So two more steps are needed:

- `Source.locate(source, path)` walks the text to find the literal that `path` names, and `SourceEdit` rewrites only that span, keeping your formatting.
- `Scope` goes the other way. The cursor is a position in the text, so it finds which declaration or field that position is inside and returns its names. `Document.focus` then prunes the tree by those names.

`kind` cannot do either job: it says what a node is, not where it is.

## Why `kind`

`kind` is decided once, by `Primitive.make`, so nobody downstream has to look at the shape of a value again:

- the page chooses how to draw by `kind`: grid, section, chart, Markdown or error
- an edit chooses how to build the cell path by `kind`: a table skips its header row, a list uses the index, an atom has none
- focus uses it too, for example a chart is kept when its source is picked

Without it, `Html`, the edits and `Scope` would each guess from the value and could disagree.

## Key and name

`key` says which node it is. The cursor, charts (`source: "sales"`) and `Document.use("sales")` all find nodes by `key`. `name` is only the text the page prints. It starts equal to `key`, and `Document.useAs("sales", "Inventory")` changes just the name, so nothing that points at `sales` breaks.

## Primitive: values into nodes

`Primitive.make(name, value)` looks at the value once and decides:

```
Array ── all rows are arrays of scalars?  yes → table
      └─ all items scalar?                yes → list (leaf)
      └─ otherwise                            → list (container): every item becomes a child
{}    ── has chart: "<family>"?               → chart
      └─ otherwise                            → block: every field becomes a child
string── starts with # or has "\n"?            → text
else                                          → atom
```

It never changes the value. It only describes it.

## Document: what to show

A `Document` is a list of **entries**. `Document.tree(document, primitives)` turns it into the root node.

```
Document.use("stock")                  show node "stock" (searched at any depth)
Document.useAs("stock", "Inventory")   same, with another name
Document.text("# Report")              a Markdown node that is not in the source
Document.chart(Bar, "Units", "stock", "item", ["units"])
```

- `Document.ofFile(file, primitives)` is the default: `use` every top-level value. This is what VS Code shows.
- One file can have several documents, each with its own entries. `forFile` picks the ones for a file.
- An entry that points at nothing becomes a `missing` node. The page still renders.

## Chart: a node that reads another node

A chart does not hold data. It names a table and two kinds of column:

```
val sales = [["month","tea","coffee"], ["Jan",30,20], ...]       ← a table node
val bars  = { chart: "Bar", source: "sales", x: "month", ys: ["tea"] }

Document.chartNode  finds the table "sales", then builds
    labels  = the "month" column                    ["Jan","Feb","Mar"]
    series  = one per y: { name, values, paths }    paths = each value's cell path
```

`paths` is what lets the page drag a bar: the drop writes the new number to `paths[i]` through the same edit as a cell. A chart whose table or `x` column is missing becomes `missing`.

There is no chart vocabulary in the model: `chart` is just a string, and `Marks.js` knows which families exist. It has ten, in two groups, and an unknown name falls back to `bar`:

- one value per label: `bar`, `column`, `pie`, `donut`, `radar`
- a value along an axis: `line`, `area`, `step`, `scatter`, `lollipop`

Several `ys` draw several series in one graph. Negative values and a numeric `x` are drawn too. The page also lets the reader switch the family; that choice is not written back to the source.

## Imported, hidden and reordered

- **Imported is read only.** `val sales = table.grid` takes a value from another file. Its node gets `origin: "./table.mls"`, its cells are not editable and the chart `paths` over it are `null`, because the literal lives in the other file. The page offers to open that file instead.
- **A name that starts with `_` is not shown.** `Document.ofFile` skips it, but it is still in the list of available nodes, so `source: "_sales"` in a chart still works. Use it for helper values.
- **Top-level values can be reordered.** `SourceEdit.move(source, name, dir)` swaps a `val` with its neighbour in the text. Functions are skipped and stay where they are.

## Focus: following the cursor

`Document.names(tree)` lists every nameable node. `Scope.names` turns the cursor into some of those names. `Document.focus(tree, names)` prunes the tree:

```
cursor on  floor: 2                         cursor on  stock: [
document                                    document
└─ block inventory      ← kept as parent    └─ block inventory
   └─ block owner       ← kept as parent       └─ table stock
      └─ atom floor     ← the match
```

- A match keeps its ancestors, so you see where it lives.
- A match on a block keeps everything under it.
- A chart is kept when its **source** is picked, so editing a table shows its charts.
- Nothing picked, or nothing matched, shows the whole tree.

## Files

| file | job |
|------|-----|
| `Primitive.mls` | value → node, `cellPath`, `find` by name, `imported`, `withOrigin` |
| `Document.mls`  | entries, `tree`, chart resolution, hidden names, `names`, `focus` |

Everything else (`Source`, `SourceEdit`, `Scope`, `Html`, `Controller`) lives in `service/` and `controller/` and only reads this tree.
