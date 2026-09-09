const test = require('node:test');
const assert = require('node:assert');
const { checkCoverage } = require('../src/services/coverageChecker');

test('checkCoverage - identifies uncovered must-have requirements', () => {
  const reqs = [
    { id: 'r1', text: 'React 5+ yrs', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'MongoDB schema design', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'CSS grid', kind: 'technical', priority: 'nice' }
  ];

  const questions = [
    { id: 'q1', requirement_ids: ['r1'], category: 'technical', difficulty: 2 }
  ];

  const result = checkCoverage(reqs, questions);

  assert.deepStrictEqual(result.uncovered_must_ids, ['r2']);
  assert.deepStrictEqual(result.uncovered_nice_ids, ['r3']);
});

test('checkCoverage - returns empty uncovered list when all covered', () => {
  const reqs = [
    { id: 'r1', text: 'React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Node', kind: 'technical', priority: 'must' }
  ];

  const questions = [
    { id: 'q1', requirement_ids: ['r1', 'r2'], category: 'technical', difficulty: 2 }
  ];

  const result = checkCoverage(reqs, questions);

  assert.strictEqual(result.uncovered_must_ids.length, 0);
});
