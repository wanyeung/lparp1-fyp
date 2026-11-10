import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyReplacement,
  focusId,
  formatNumber,
  parseStudio,
  viewRows,
} from '../src/model.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(name) {
  const source = readFileSync(path.join(root, 'usecases', name), 'utf8');
  return { source, model: parseStudio(source, { fallbackTitle: name }) };
}

function table(model, id) {
  const found = model.tables.find((candidate) => candidate.id === id);
  assert.ok(found, `table ${id}`);
  return found;
}

function cell(model, tableId, row, key) {
  const found = table(model, tableId).rows[row]?.cells.find((candidate) => candidate.key === key);
  assert.ok(found, `${tableId}[${row}].${key}`);
  return found;
}

function field(model, tableId, label) {
  const row = table(model, tableId).rows.find((candidate) => candidate.cells[0]?.display === label);
  assert.ok(row, `${tableId} field ${label}`);
  return row.cells.find((candidate) => candidate.key === 'value');
}

function chart(model, id) {
  const found = model.charts.find((candidate) => candidate.id === id);
  assert.ok(found, `chart ${id}`);
  return found;
}

const files = [
  'student-learning.mls',
  'financial-analysis.mls',
  'business-model.mls',
  'experiment-measurements.mls',
  'algorithm-benchmark.mls',
];

test('each use case projects with no errors', () => {
  for (const name of files) {
    const { model } = load(name);
    assert.deepEqual(model.errors, [], name);
    assert.ok(model.documents.length >= 4, name);
    const roots = model.documents.filter((document) => !model.documents.some((other) => other.blocks.some((block) => block.kind === 'document' && block.id === document.id)));
    assert.equal(roots.length, 2, name);
    assert.ok(model.documents.some((document) => document.blocks.some((block) => block.kind === 'document')), name);
    assert.ok(model.tables.length >= 2, name);
    assert.ok(model.charts.length >= 1, name);
  }
});

test('editable cells point at their own literal text', () => {
  for (const name of files) {
    const { source, model } = load(name);
    for (const item of model.tables) {
      for (const row of item.rows) {
        for (const itemCell of row.cells) {
          if (!itemCell.editable) continue;
          assert.equal(source.slice(itemCell.start, itemCell.end), itemCell.expected, `${name} ${item.id}`);
        }
      }
    }
  }
});

test('student totals are shared formulas and quiz scores are literals', () => {
  const { model } = load('student-learning.mls');
  assert.equal(cell(model, 'grades', 0, 'total').display, '78');
  assert.equal(cell(model, 'grades', 1, 'total').display, '78');
  assert.equal(cell(model, 'grades', 2, 'total').display, '91.4');
  assert.equal(cell(model, 'grades', 0, 'total').editable, false);
  assert.equal(cell(model, 'students', 0, 'quiz').editable, true);
  assert.equal(cell(model, 'students', 0, 'quiz').display, '80');
  assert.ok(cell(model, 'grades', 0, 'total').refs.some((ref) => ref.path === 'students.0.quiz'));
  assert.equal(chart(model, 'totals').bars[0].editable, false);
  assert.equal(chart(model, 'quizzes').bars[0].editable, true);
  assert.equal(chart(model, 'quizzes').bars[0].value, 80);
  assert.equal(chart(model, 'quizzes').bars[0].label, 'Ada');
  assert.deepEqual(model.documents.map((document) => document.title), [
    'Grade report',
    'Weight policy',
    'Computed totals',
    'Score sheet',
    'Raw scores',
    'How a student edits',
  ]);
  const report = model.documents.find((document) => document.id === 'report');
  assert.deepEqual(report.blocks.map((block) => block.id), ['weight-policy', 'computed-totals']);
});

test('editing a quiz literal recomputes the grade and leaves the formula in place', () => {
  const { source } = load('student-learning.mls');
  const before = parseStudio(source);
  const quiz = cell(before, 'students', 0, 'quiz');
  const patched = applyReplacement(source, quiz.start, quiz.end, '100');
  assert.equal(patched.error, undefined);
  assert.ok(patched.source.includes('quiz: 100'));
  assert.ok(patched.source.includes('students.0.quiz * weights.quiz'));
  const after = parseStudio(patched.source);
  assert.deepEqual(after.errors, []);
  assert.equal(cell(after, 'students', 0, 'quiz').display, '100');
  assert.equal(cell(after, 'grades', 0, 'total').display, '82');
  assert.equal(cell(after, 'grades', 0, 'total').editable, false);
  assert.equal(cell(after, 'students', 1, 'quiz').display, '60');
});

test('sorting and filtering do not reorder the source rows', () => {
  const { model } = load('student-learning.mls');
  const rows = table(model, 'students').rows;
  const sorted = viewRows(rows, { column: 'name', direction: 'desc' });
  const filtered = viewRows(rows, { filter: 'ben' });
  assert.equal(rows[0], table(model, 'students').rows[0]);
  assert.deepEqual(sorted.map((row) => row.cells.find((item) => item.key === 'name').display), ['Cho', 'Ben', 'Ada']);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cells.find((item) => item.key === 'name').display, 'Ben');
  assert.equal(rows.length, 3);
});

test('cashflow nets, balances, and category check share the monthly inputs', () => {
  const { source, model } = load('financial-analysis.mls');
  assert.deepEqual(
    [0, 1, 2].map((row) => cell(model, 'cashflow', row, 'net').display),
    ['1100', '1400', '900'],
  );
  assert.deepEqual(
    [0, 1, 2].map((row) => cell(model, 'cashflow', row, 'balance').display),
    ['3100', '4500', '5400'],
  );
  assert.equal(cell(model, 'cashflow', 0, 'net').editable, false);
  assert.equal(cell(model, 'reconciled', 0, 'categoryTotal').display, '9500');
  assert.equal(cell(model, 'reconciled', 0, 'monthTotal').display, '9500');
  assert.equal(chart(model, 'net').bars.every((bar) => bar.editable === false), true);
  assert.equal(chart(model, 'income').bars.every((bar) => bar.editable), true);

  const income = cell(model, 'months', 1, 'income');
  const patched = parseStudio(applyReplacement(source, income.start, income.end, '5000').source);
  assert.equal(cell(patched, 'cashflow', 1, 'net').display, '2200');
  assert.equal(cell(patched, 'cashflow', 1, 'balance').display, '5300');
  assert.equal(cell(patched, 'cashflow', 2, 'balance').display, '6200');
  assert.equal(field(model, 'assumptions', 'Opening').editable, true);
});

test('café contribution and profit read the same product literals', () => {
  const { source, model } = load('business-model.mls');
  assert.deepEqual(
    [0, 1, 2].map((row) => cell(model, 'contributions', row, 'contribution').display),
    ['3120', '1760', '780'],
  );
  assert.equal(cell(model, 'contributions', 0, 'contribution').editable, false);
  assert.equal(cell(model, 'summary', 0, 'revenue').display, '8120');
  assert.equal(cell(model, 'summary', 0, 'variableCost').display, '2460');
  assert.equal(cell(model, 'summary', 0, 'profit').display, '1660');
  assert.equal(chart(model, 'units').bars[2].editable, true);
  assert.equal(chart(model, 'contribution').bars[2].editable, false);

  const units = cell(model, 'products', 2, 'units');
  const patched = parseStudio(applyReplacement(source, units.start, units.end, '0').source);
  assert.equal(cell(patched, 'contributions', 2, 'contribution').display, '0');
  assert.equal(cell(patched, 'summary', 0, 'profit').display, '880');
});

test('lab means follow the trial literals and only the readings are editable', () => {
  const { model } = load('experiment-measurements.mls');
  assert.equal(field(model, 'summary', 'Mean Length').display, formatNumber((102.4 + 101.8 + 103 + 102.1 + 102.7) / 5));
  assert.equal(field(model, 'summary', 'Mean Temperature').display, formatNumber((21 + 21.2 + 21.1 + 20.9 + 21) / 5));
  assert.equal(field(model, 'summary', 'Mean Length').editable, false);
  assert.equal(field(model, 'summary', 'Mean Length').refs.length, 5);
  assert.equal(chart(model, 'lengths').bars.every((bar) => bar.editable), true);
  assert.equal(chart(model, 'lengths').bars[0].decimals, 1);
  assert.equal(cell(model, 'trials', 0, 'length').display, '102.4');
});

test('speedup is baseline divided by the measured time', () => {
  const { model } = load('algorithm-benchmark.mls');
  assert.equal(cell(model, 'comparison', 0, 'speedup').display, '1');
  assert.equal(cell(model, 'comparison', 1, 'speedup').display, '15.5');
  assert.equal(cell(model, 'comparison', 2, 'speedup').display, formatNumber(12400 / 300));
  assert.equal(cell(model, 'comparison', 4, 'speedup').display, formatNumber(128000 / 1100));
  assert.equal(cell(model, 'comparison', 5, 'speedup').display, '320');
  assert.equal(chart(model, 'times').bars.every((bar) => bar.editable), true);
  assert.equal(chart(model, 'speedups').bars.every((bar) => bar.editable === false), true);
  assert.ok(cell(model, 'comparison', 1, 'speedup').refs.some((ref) => ref.path === 'runs.0.microseconds'));
});

test('the cursor maps back to the let that contains it', () => {
  const { model } = load('student-learning.mls');
  const students = table(model, 'students');
  assert.equal(focusId(model, students.start + 10), 'students');
  assert.equal(focusId(model, 0), null);
});

test('a broken let is reported instead of throwing', () => {
  const model = parseStudio('let weights = [\nlet next = 1\n');
  assert.ok(model.errors.length >= 1);
  assert.equal(table(model, 'next').rows[0].cells[0].display, '1');
});

test('order comments choose the document when no @document is set', () => {
  const model = parseStudio(`
// @order chart:scores, table:rows
let rows = [ mut { name: "Ada", score: 80 } ]
// @chart Scores
// id: scores
// type: bar
// source: rows
// x: name
// y: score
// @endchart
`);
  assert.deepEqual(model.errors, []);
  assert.deepEqual(model.documents[0].blocks, [
    { kind: 'chart', id: 'scores' },
    { kind: 'table', id: 'rows' },
  ]);
});

test('a subcase cannot include its own parent', () => {
  const model = parseStudio(`
// @document Outer
// id: outer
// includes: document:inner
// @enddocument
// @document Inner
// id: inner
// includes: document:outer
// @enddocument
`);
  assert.ok(model.errors.some((error) => error.message === 'Document outer includes itself'));
  assert.ok(model.errors.some((error) => error.message === 'Document inner includes itself'));
});

test('empty input is not written back as a literal', () => {
  const result = applyReplacement('let n = 1\n', 8, 9, '   ');
  assert.equal(result.error, 'Enter a value.');
});
