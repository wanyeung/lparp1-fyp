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
| `name`     | the `val` name or record key. What the cursor picks. List positions are `"0"`, `"1"` |
| `title`    | what the page shows. Equals `name` unless a document renames it |
| `path`     | the address of its literal in the source, e.g. `["inventory","stock"]` |
| `headers`, `rows` | the grid of a leaf |
| `children` | the nodes inside a block or a list of records |

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

## Path: the address that makes editing work

`path` walks from the `val` down to the literal. `Primitive.cellPath` adds the cell:

```
table  stock   click "45"  (row 1, col 1)   →  ["inventory", "stock", 2, 1]     row + 1 skips the header
list   tags    click "bulk" (row 1)         →  ["inventory", "tags", 1]
atom   floor                                →  ["inventory", "owner", "floor"]
```

`Source.locate(source, path)` finds that literal's span in the text and `SourceEdit.at` rewrites just that span. That is the whole loop: edit a cell, patch one literal, run again, redraw.

## Primitive: values into nodes

`Primitive.make(name, value)` looks at the value once and decides:

```
Array ── all rows are arrays of scalars?  yes → table
      └─ all items scalar?                yes → list (leaf)
      └─ otherwise                            → list (container): every item becomes a child
{}    ── has chart: "Bar" | "Line" | "Pie"?   → chart
      └─ otherwise                            → block: every field becomes a child
string── starts with # or has "\n"?            → text
else                                          → atom
```

It never changes the value. It only describes it.

## Document: what to show

A `Document` is a list of **entries**. `Document.tree(document, primitives)` turns it into the root node.

```
Document.use("stock")                  show node "stock" (searched at any depth)
Document.useAs("stock", "Inventory")   same, with another title
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

There is no chart vocabulary in the model: `chart` is just a string, and `Marks.js` knows which families exist.

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
| `Primitive.mls` | value → node, `cellPath`, `find` by name |
| `Document.mls`  | entries, `tree`, chart resolution, `names`, `focus` |

Everything else (`Source`, `SourceEdit`, `Scope`, `Html`, `Controller`) lives in `service/` and `controller/` and only reads this tree.
