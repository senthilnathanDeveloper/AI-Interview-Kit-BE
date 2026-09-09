/**
 * Deterministic Coverage Checker
 * Compares requirements against generated questions.
 * Returns array of uncovered requirement IDs (focusing on 'must' priority requirements).
 */

function checkCoverage(requirements, questions) {
  // Map of requirementId -> set of question IDs covering it
  const coverageMap = new Map();
  
  requirements.forEach(req => {
    coverageMap.set(req.id, []);
  });

  questions.forEach(q => {
    if (Array.isArray(q.requirement_ids)) {
      q.requirement_ids.forEach(rid => {
        if (coverageMap.has(rid)) {
          coverageMap.get(rid).push(q.id);
        }
      });
    }
  });

  const uncoveredMustIds = [];
  const uncoveredNiceIds = [];

  requirements.forEach(req => {
    const coveredBy = coverageMap.get(req.id) || [];
    if (coveredBy.length === 0) {
      if (req.priority === 'must') {
        uncoveredMustIds.push(req.id);
      } else {
        uncoveredNiceIds.push(req.id);
      }
    }
  });

  return {
    uncovered_must_ids: uncoveredMustIds,
    uncovered_nice_ids: uncoveredNiceIds,
    uncovered_all_ids: [...uncoveredMustIds, ...uncoveredNiceIds],
    coverageMap
  };
}

module.exports = { checkCoverage };
