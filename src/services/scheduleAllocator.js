/**
 * Deterministic Schedule Allocator
 * Section 8 Requirements:
 * - Every day has a focus, a set of question ids, and an integer duration in minutes.
 * - Every must-have requirement appears somewhere in the schedule.
 * - Number of days in schedule equals the number of days requested.
 * - Harder & higher priority material lands earlier, not the night before.
 */

function allocateSchedule(questions, requirements, daysAvailable) {
  const safeDays = Math.max(1, Math.min(60, parseInt(daysAvailable, 10) || 5));

  const mustReqIds = new Set(
    requirements.filter(r => r.priority === 'must').map(r => r.id)
  );

  // Score questions for priority ordering:
  // Must-have requirement match + higher difficulty = placed earlier
  const scoredQuestions = questions.map(q => {
    const isMust = (q.requirement_ids || []).some(id => mustReqIds.has(id));
    const difficulty = q.difficulty || 2;
    // Higher score = earlier day
    const priorityScore = (isMust ? 100 : 0) + (difficulty * 10);
    
    // Minute estimate per question based on difficulty
    const minutes = difficulty === 1 ? 15 : difficulty === 2 ? 25 : 35;

    return {
      ...q,
      priorityScore,
      estMinutes: minutes
    };
  });

  // Sort descending by priority score
  scoredQuestions.sort((a, b) => b.priorityScore - a.priorityScore);

  // Initialize schedule days array
  const days = Array.from({ length: safeDays }, (_, i) => ({
    day: i + 1,
    focus: '',
    question_ids: [],
    minutes: 0,
    categories: {}
  }));

  // Track which must-have requirements have been included in schedule
  const coveredMustReqsInSchedule = new Set();

  if (scoredQuestions.length === 0) {
    // Edge case: empty questions list
    for (let d = 0; d < safeDays; d++) {
      days[d].focus = `Day ${d + 1}: Overview & Role Review`;
      days[d].minutes = 30;
      delete days[d].categories;
    }
    return {
      days_available: safeDays,
      days
    };
  }

  // Round-robin with early bias distribution:
  // We place questions onto days. Earlier days have capacity for higher priority items.
  for (let i = 0; i < scoredQuestions.length; i++) {
    const q = scoredQuestions[i];
    
    // Choose target day:
    // We spread questions across 1..safeDays, favoring earlier days for higher i
    let targetDayIndex;
    if (safeDays === 1) {
      targetDayIndex = 0;
    } else {
      // Distribute i linearly across safeDays
      const progress = i / Math.max(1, scoredQuestions.length - 1);
      targetDayIndex = Math.min(safeDays - 1, Math.floor(progress * safeDays));
    }

    const dayObj = days[targetDayIndex];
    dayObj.question_ids.push(q.id);
    dayObj.minutes += q.estMinutes;

    const cat = q.category || 'technical';
    dayObj.categories[cat] = (dayObj.categories[cat] || 0) + 1;

    (q.requirement_ids || []).forEach(rid => {
      if (mustReqIds.has(rid)) {
        coveredMustReqsInSchedule.add(rid);
      }
    });
  }

  // Backup pass: ensure EVERY must-have requirement appears in schedule
  mustReqIds.forEach(mId => {
    if (!coveredMustReqsInSchedule.has(mId)) {
      const qForMust = questions.find(q => (q.requirement_ids || []).includes(mId));
      if (qForMust) {
        // Place on day 1 (earliest day)
        if (!days[0].question_ids.includes(qForMust.id)) {
          days[0].question_ids.push(qForMust.id);
          days[0].minutes += (qForMust.difficulty || 2) * 10;
        }
      }
    }
  });

  // Assign human-readable focus strings for each day
  days.forEach((dayObj, index) => {
    const sortedCats = Object.entries(dayObj.categories)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    let focus = '';
    if (sortedCats.length > 0) {
      const mainCat = sortedCats[0].replace('-', ' ');
      const mainCatCap = mainCat.charAt(0).toUpperCase() + mainCat.slice(1);
      if (index === 0) {
        focus = `Core ${mainCatCap} & Priority Must-Have Requirements`;
      } else if (index === safeDays - 1) {
        focus = `Final Review, ${mainCatCap} & Comprehensive Q&A`;
      } else {
        focus = `${mainCatCap} Focus & Applied Practice`;
      }
    } else {
      focus = `Day ${index + 1} General Interview Preparation`;
    }

    dayObj.focus = focus;
    // Ensure minimum minutes integer
    dayObj.minutes = Math.max(30, Math.round(dayObj.minutes));
    delete dayObj.categories;
  });

  return {
    days_available: safeDays,
    days
  };
}

module.exports = { allocateSchedule };
