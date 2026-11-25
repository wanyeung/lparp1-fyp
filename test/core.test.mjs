import { test } from 'node:test'
import assert from 'node:assert/strict'
import Primitive from '../build/library/model/Primitive.mjs'

const source = 'val sales = [\n  ["item", "units"],\n  ["Tea", 30],\n  ["Coffee, hot", 45.5]\n]\n'

test('primitive tells tables, lists, atoms and blocks apart', () => {
  assert.equal(Primitive.make('t', [['a'], [1]]).kind, 'table')
  assert.equal(Primitive.make('l', [1, 2]).kind, 'list')
  assert.equal(Primitive.make('e', []).kind, 'list')
  assert.equal(Primitive.make('n', 5).kind, 'atom')
  assert.equal(Primitive.make('s', 'x').kind, 'atom')
  const block = Primitive.make('b', { total: 3, rows: [[1], [2]], inner: { x: 1 } })
  assert.equal(block.kind, 'block')
  assert.deepEqual(block.children.map((c) => [c.name, c.kind]), [['total', 'atom'], ['rows', 'table'], ['inner', 'block']])
})

test('rename changes the title and keeps the source name', () => {
  const renamed = Primitive.rename(Primitive.make('sales', [['a'], [1]]), 'Revenue')
  assert.equal(renamed.title, 'Revenue')
  assert.equal(renamed.name, 'sales')
})

test('grid treats an empty array as an empty list', () => {
  assert.deepEqual(Primitive.make('e', []).rows, [])
})

