import { test } from 'node:test'
import assert from 'node:assert/strict'
import Structure from '../../../build/main/Structure.mjs'

test('inferKind', () => {
  assert.equal(Structure.inferKind(5), 'atom')
  assert.equal(Structure.inferKind('x'), 'atom')
  assert.equal(Structure.inferKind([]), 'list')
  assert.equal(Structure.inferKind([1, 2, 3]), 'list')
  assert.equal(Structure.inferKind([[1, 2], [3, 4]]), 'table')
})
