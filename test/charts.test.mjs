import { test } from 'node:test'
import assert from 'node:assert/strict'

await import('../library/service/Charts.js')
const { draw, defaultType, seriesTypes, categoryTypes } = globalThis.MlsCharts

const line = { chart: 'Line', source: 'sales', x: 'month', labels: [1, 2, 3, 4], series: [{ name: 'a', values: [1, 3, 2, 5] }, { name: 'b', values: [2, 1, 4, 3] }] }
const bars = { chart: 'Bar', source: 'sales', x: 'item', labels: ['Tea', '<b>', 'Milk'], series: [{ name: 'units', values: [30, 45, -5] }] }

test('every series type draws, and none of them needs an inline style attribute', () => {
  for (const type of seriesTypes) {
    const html = draw(line, type)
    assert.ok(html.includes('<svg'), type)
    assert.ok(html.includes('class="dot"'), type)
    assert.ok(!html.includes(' style='), type)
  }
  assert.ok(draw(line, 'line').includes('<polyline class="line"'))
  assert.ok(draw(line, 'area').includes('<polygon class="area"'))
  assert.ok(draw(line, 'lollipop').includes('class="stem"'))
  assert.ok(!draw(line, 'scatter').includes('<polyline class="line"'))
})

test('every category type draws, and labels are escaped', () => {
  for (const type of categoryTypes) {
    const html = draw(bars, type)
    assert.ok(html.length > 100, type)
    assert.ok(!html.includes(' style='), type)
    assert.ok(!html.includes('<b>'), type)
  }
  assert.ok(draw(bars, 'bar').includes('class="bar-rows"'))
  assert.ok(draw(bars, 'column').includes('class="columns"'))
  assert.ok(draw(bars, 'donut').includes('<svg class="pie-svg"'))
  assert.ok(draw(bars, 'radar').includes('Radar chart'))
})

test('the buttons follow the chart family, and an unknown type falls back to the default', () => {
  const buttons = (html) => [...html.matchAll(/data-type="(\w+)"/g)].map((m) => m[1])
  assert.deepEqual(buttons(draw(line, 'line')), seriesTypes)
  assert.deepEqual(buttons(draw(bars, 'bar')), categoryTypes)
  assert.ok(draw(line, 'pie').includes('data-type="line" class="on"'))
  assert.deepEqual(['Bar', 'Line', 'Pie'].map((chart) => defaultType({ chart })), ['bar', 'line', 'pie'])
})

test('empty data says so instead of failing', () => {
  assert.ok(draw({ ...bars, labels: [], series: [{ name: 'u', values: [] }] }, 'bar').includes('No chart data.'))
  assert.ok(draw({ ...line, labels: [], series: [{ name: 'a', values: [] }] }, 'line').includes('No chart data.'))
})
