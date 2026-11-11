import test from 'node:test';
import assert from 'node:assert/strict';
import { model, render } from '../library/Render.mjs';

const raw = ['table','raw','Raw',['minute','measured'],[[0,80],[5,60],[10,48]]];
const cleaned = ['derived','cleaned','Cleaned',['minute','measured','predicted'],[[0,80,80],[5,60,61],[10,48,49]],raw];
const chart = ['line','overlay','Measured vs predicted',cleaned,'minute',['measured','predicted']];
const root = ['group','report','Experiment',[raw,cleaned,chart]];

test('multi-series curves use numeric x values and preserve derived provenance', () => {
  const result = model(root);
  const table = result.items.find(item => item.id === 'cleaned');
  const graph = result.items.find(item => item.id === 'overlay');
  assert.equal(table.sourceTableId,'raw');
  assert.equal(table.derived,true);
  assert.equal(graph.sourceTableId,'cleaned');
  assert.equal(graph.chartType,'line');
  assert.deepEqual(graph.series[1].points,[{x:0,y:80},{x:5,y:61},{x:10,y:49}]);
  const html = render(root);
  assert.match(html,/<polyline/);
  assert.match(html,/Derived from:/);
  assert.match(html,/href="#raw"/);
  assert.match(html,/href="#cleaned"/);
  assert.doesNotMatch(html,/<script/);
});

test('line charts reject invalid series, columns and nonnumeric values', () => {
  assert.throws(()=>model(['line','bad','Bad',raw,'minute',[]]),/nonempty/);
  assert.throws(()=>model(['line','bad','Bad',raw,'minute',['missing']]),/unknown chart column/);
  const labels = ['table','labels','Labels',['x','y'],[['bad',4]]];
  assert.throws(()=>model(['line','bad','Bad',labels,'x',['y']]),/finite numbers/);
});

test('derived table source conflicts and cycles fail validation', () => {
  const conflictingRaw = ['table','raw','Other',['x'],[[1]]];
  assert.throws(()=>model(['group','g','G',[conflictingRaw,cleaned]]),/conflicts/);
  const cycle = ['derived','cycle','Cycle',['x'],[[1]],null];
  cycle[5]=cycle;
  assert.throws(()=>model(cycle),/cycle/);
});
