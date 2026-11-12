import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileModule } from '../src/hkmc2.mjs';
import { overlayCompiled, parseStudio } from '../src/model.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function project(name, values) {
  const source = readFileSync(path.join(root, 'usecases', name), 'utf8');
  return overlayCompiled(parseStudio(source, { fallbackTitle: name }), values);
}

function cell(model, tableId, row, key) {
  return model.tables.find((table) => table.id === tableId).rows[row].cells.find((item) => item.key === key);
}

function field(model, tableId, label) {
  const row = model.tables.find((table) => table.id === tableId).rows
    .find((candidate) => candidate.cells[0]?.display === label);
  return row.cells.find((item) => item.key === 'value');
}

test('hkmc2 computes the use cases from ordinary let bindings', async () => {
  const expectations = {
    'student-learning.mls': (model) => {
      assert.equal(cell(model, 'grades', 0, 'total').display, '78.6');
      assert.equal(cell(model, 'grades', 5, 'passMargin').display, '-12.35');
      assert.equal(cell(model, 'students', 0, 'quiz').display, '80');
      assert.equal(field(model, 'cohort', 'Mean').display, '72.125');
    },
    'financial-analysis.mls': (model) => {
      assert.equal(cell(model, 'statement', 11, 'cash').display, '60020');
      assert.equal(cell(model, 'schedule', 11, 'balance').display, '7263.76');
      assert.equal(field(model, 'year', 'Emergency Months').display, '3.665');
    },
    'business-model.mls': (model) => {
      assert.equal(field(model, 'result', 'Profit').display, '45450.92');
      assert.equal(field(model, 'result', 'Break Even Revenue').display, '142713.245');
    },
    'experiment-measurements.mls': (model) => {
      assert.equal(field(model, 'meanK', 'Stiffness').display, '119.206');
      assert.equal(field(model, 'spread', 'Variance').display, '12.588');
    },
    'algorithm-benchmark.mls': (model) => {
      assert.equal(cell(model, 'comparison', 1, 'speedup').display, '15.5');
      assert.equal(cell(model, 'comparison', 11, 'perThousand').display, '5.6');
      assert.equal(cell(model, 'scale', 0, 'growth').display, '10.323');
    },
  };
  for (const [name, check] of Object.entries(expectations)) {
    const source = readFileSync(path.join(root, 'usecases', name), 'utf8');
    const compiled = await compileModule(source, root);
    assert.equal(compiled.ok, true, `${name}: ${(compiled.errors || []).join('; ')}`);
    const model = project(name, compiled.values);
    assert.equal(model.compiler, 'hkmc2', name);
    check(model);
  }
});
