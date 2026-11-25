import { test } from 'node:test'
import assert from 'node:assert/strict'

const node = () => new Proxy(function () {}, {
  get: (_t, key) => key === Symbol.toPrimitive ? () => 0 : key === 'nodeType' ? undefined : node(),
  apply: () => node(),
  set: () => true,
})

globalThis.document = { createElement: node, createElementNS: node, createTextNode: node }
const Marks = await import('../build/library/controller/D3Manipulation/Marks.js')

const chart = {
  title: 'Units',
  source: 'sales',
  y: 'units',
  bars: [
    { label: 'Tea', value: 30, start: 0, end: 2, expected: 30, editable: true },
    { label: 'Coffee', value: 45, start: 3, end: 5, expected: 45, editable: false },
    { label: 'Milk', value: null, editable: false },
  ],
}

test('every chart type draws without a missing dependency', () => {
  for (const type of ['bar', 'column', 'pie', 'donut', 'radar', 'line', 'step', 'area']) {
    assert.doesNotThrow(() => Marks.renderChart(chart, type), type)
  }
})

test('a drag posts a patch only when the value changed', () => {
  const sent = []
  Marks.state.post = (message) => sent.push(message)
  Marks.postPatch(chart.bars[0], 30)
  Marks.postPatch(chart.bars[0], 31)
  assert.deepEqual(sent, [{ type: 'patch', start: 0, end: 2, value: '31', expected: 30 }])
})
