const test = require('node:test');
const assert = require('node:assert');
const { validateKit } = require('../src/services/validator');

test('validateKit - validates correct Appendix A structure', () => {
  const validKit = {
    source: {
      company: 'Acme',
      company_url: 'https://acme.com',
      role: 'Backend Dev',
      location: 'Remote',
      jd_chars: 500,
      researched_at: new Date().toISOString(),
      pages_used: ['https://acme.com']
    },
    company_brief: {
      summary: 'Leading cloud company.',
      what_they_do: 'Cloud management tools.',
      sources: ['https://acme.com']
    },
    role: {
      title: 'Backend Dev',
      seniority: 'Senior',
      responsibilities: ['Build APIs'],
      requirements: [
        { id: 'r1', text: '5+ years Node.js', kind: 'technical', priority: 'must' }
      ]
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Explain Node event loop.',
        answer_outline: 'Explain phase execution.',
        difficulty: 2
      }
    ],
    flashcards: [
      { id: 'f1', front: 'Node loop', back: 'Single-threaded event loop', requirement_ids: ['r1'] }
    ],
    schedule: {
      days_available: 1,
      days: [
        { day: 1, focus: 'Node.js Core', question_ids: ['q1'], minutes: 60 }
      ]
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1
    }
  };

  const res = validateKit(validKit);
  assert.strictEqual(res.valid, true);
});

test('validateKit - catches invalid schedule question references', () => {
  const invalidKit = {
    source: {
      company: 'Acme',
      company_url: 'https://acme.com',
      role: 'Dev',
      location: 'Remote',
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: []
    },
    company_brief: { summary: 'S', what_they_do: 'W', sources: [] },
    role: { title: 'T', seniority: 'S', responsibilities: [], requirements: [{ id: 'r1', text: 'T', kind: 'technical', priority: 'must' }] },
    questions: [{ id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P', answer_outline: 'A', difficulty: 1 }],
    flashcards: [{ id: 'f1', front: 'F', back: 'B', requirement_ids: ['r1'] }],
    schedule: {
      days_available: 1,
      days: [{ day: 1, focus: 'F', question_ids: ['non_existent_q_id'], minutes: 30 }]
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 }
  };

  const res = validateKit(invalidKit);
  assert.strictEqual(res.valid, false);
});
