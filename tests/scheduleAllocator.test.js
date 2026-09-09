const test = require('node:test');
const assert = require('node:assert');
const { allocateSchedule } = require('../src/services/scheduleAllocator');

test('allocateSchedule - allocates exact requested days', () => {
  const reqs = [
    { id: 'r1', text: 'React 5+ yrs', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Node.js backend', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'System Architecture', kind: 'technical', priority: 'nice' }
  ];

  const questions = [
    { id: 'q1', requirement_ids: ['r1'], category: 'technical', difficulty: 3 },
    { id: 'q2', requirement_ids: ['r2'], category: 'technical', difficulty: 2 },
    { id: 'q3', requirement_ids: ['r3'], category: 'system-design', difficulty: 2 }
  ];

  const result = allocateSchedule(questions, reqs, 3);

  assert.strictEqual(result.days_available, 3);
  assert.strictEqual(result.days.length, 3);
  assert.strictEqual(result.days[0].day, 1);
  assert.strictEqual(result.days[1].day, 2);
  assert.strictEqual(result.days[2].day, 3);
});

test('allocateSchedule - puts harder must-have items earlier', () => {
  const reqs = [
    { id: 'r1', text: 'React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Python', kind: 'technical', priority: 'nice' }
  ];

  const questions = [
    { id: 'q1', requirement_ids: ['r2'], category: 'technical', difficulty: 1 },
    { id: 'q2', requirement_ids: ['r1'], category: 'technical', difficulty: 3 }
  ];

  const result = allocateSchedule(questions, reqs, 2);

  // q2 is must-have + diff 3, so it must land on day 1
  assert.ok(result.days[0].question_ids.includes('q2'));
  assert.ok(typeof result.days[0].minutes === 'number');
  assert.strictEqual(Number.isInteger(result.days[0].minutes), true);
});
