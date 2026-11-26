import { test } from 'node:test'
import assert from 'node:assert/strict'
import Controller from '../build/library/controller/Controller.mjs'
import Html from '../build/library/service/Html.mjs'

const source = 'val a = 1\n\nfun f(x) = x\n\nval b = [\n  ["k"],\n  [2]\n]\n\nval c = 3'

test('move swaps a val with the next val and skips functions', () => {
  const down = Controller.move({ source, name: 'a', dir: 1 })
  assert.ok(down.ok)
  assert.ok(down.source.indexOf('val b') < down.source.indexOf('val a'))
  assert.ok(down.source.indexOf('val a') < down.source.indexOf('val c'))
  assert.ok(down.source.includes('fun f(x) = x'))
  const up = Controller.move({ source: down.source, name: 'a', dir: -1 })
  assert.ok(up.source.indexOf('val a') < up.source.indexOf('val b'))
  assert.ok(up.source.includes('val b = [\n  ["k"],\n  [2]\n]'))
})

test('the last val moves up without losing its text, and the first cannot move up', () => {
  const up = Controller.move({ source, name: 'c', dir: -1 })
  assert.ok(up.ok)
  assert.ok(up.source.indexOf('val c') < up.source.indexOf('val b'))
  assert.ok(up.source.includes('val c = 3'))
  assert.equal(Controller.move({ source, name: 'a', dir: -1 }).ok, false)
})

test('every top-level section has up and down buttons', () => {
  const tree = { kind: 'document', name: 'd', title: 'd', path: [], children: [{ kind: 'atom', name: 'a', title: 'a', path: ['a'], headers: [''], rows: [[1]], children: [] }] }
  const html = Html.generateHtml(tree, 'n', '')
  assert.ok(html.includes('data-move="a" data-dir="-1"'))
  assert.ok(html.includes('data-move="a" data-dir="1"'))
})
