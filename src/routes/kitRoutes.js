const express = require('express');
const Kit = require('../models/Kit');
const { auth, optionalAuth } = require('../middleware/auth');
const { runPipeline } = require('../services/pipeline');
const { allocateSchedule } = require('../services/scheduleAllocator');

const router = express.Router();

// Generate New Kit (Protected or Optional Auth)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { jd, company_url, days = 5 } = req.body;

    if (!jd || typeof jd !== 'string' || jd.trim().length === 0) {
      return res.status(400).json({ error: 'Job description text is required.' });
    }

    const kitData = await runPipeline({
      jd,
      company_url,
      days: parseInt(days, 10) || 5
    });

    const kitDoc = new Kit({
      userId: req.user?.userId || null,
      title: `${kitData.role.title} @ ${kitData.source.company}`,
      company: kitData.source.company,
      kitData,
      pinnedState: {
        editedQuestionIds: [],
        customQuestionIds: [],
        editedFlashcardIds: [],
        customFlashcardIds: [],
        briefPinned: false
      }
    });
    const savedKitDoc = await kitDoc.save();

    res.status(201).json({
      id: savedKitDoc._id,
      kit: kitData,
      saved: true
    });
  } catch (err) {
    console.error('Kit generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate interview kit.' });
  }
});

// Batch Kit Generation
router.post('/batch', optionalAuth, async (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'Array of cases is required for batch generation.' });
    }

    const generatedKits = [];
    for (const c of cases) {
      try {
        const kitData = await runPipeline({
          jd: c.jd,
          company_url: c.company_url,
          days: c.days || 5
        });

        const kitDoc = new Kit({
          userId: req.user?.userId || null,
          caseId: c.id,
          title: `${kitData.role.title} @ ${kitData.source.company}`,
          company: kitData.source.company,
          kitData
        });
        const saved = await kitDoc.save();

        generatedKits.push({
          id: c.id,
          docId: saved._id,
          status: 'ok',
          kit: kitData
        });
      } catch (err) {
        generatedKits.push({
          id: c.id,
          status: 'failed',
          error: err.message
        });
      }
    }

    res.json({ kits: generatedKits });
  } catch (err) {
    res.status(500).json({ error: 'Batch processing failed.' });
  }
});

// List User's Kits (Protected)
router.get('/', auth, async (req, res) => {
  try {
    const kits = await Kit.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
    res.json(kits);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user kits.' });
  }
});

// Get Kit by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const kitDoc = await Kit.findById(req.params.id);
    if (!kitDoc) {
      return res.status(404).json({ error: 'Kit not found.' });
    }
    res.json(kitDoc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch kit.' });
  }
});

// Update Kit (Full or Partial edit by hand)
router.put('/:id', auth, async (req, res) => {
  try {
    const { kitData, pinnedState, practiceState } = req.body;
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!kitDoc) {
      return res.status(404).json({ error: 'Kit not found or access denied.' });
    }

    if (kitData) kitDoc.kitData = kitData;
    if (pinnedState) kitDoc.pinnedState = pinnedState;
    if (practiceState) kitDoc.practiceState = practiceState;

    await kitDoc.save();
    res.json(kitDoc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update kit.' });
  }
});

// Section Regeneration (Section 6 Requirement)
// Regenerating one section must not discard edits made elsewhere!
router.post('/:id/regenerate-section', auth, async (req, res) => {
  try {
    const { section, category } = req.body; // section: 'brief' | 'category' | 'schedule'
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!kitDoc) {
      return res.status(404).json({ error: 'Kit not found or access denied.' });
    }

    const currentKit = kitDoc.kitData;
    const pinnedState = kitDoc.pinnedState || { editedQuestionIds: [], customQuestionIds: [] };
    const pinnedQIds = new Set([...(pinnedState.editedQuestionIds || []), ...(pinnedState.customQuestionIds || [])]);

    if (section === 'schedule') {
      // Re-allocate schedule while keeping all questions
      const newSchedule = allocateSchedule(
        currentKit.questions,
        currentKit.role.requirements,
        currentKit.schedule.days_available
      );
      currentKit.schedule = newSchedule;
    } else if (section === 'category' && category) {
      // Regenerate questions for a specific category, preserving pinned/hand-edited questions
      const untouchedQuestions = currentKit.questions.filter(q => q.category !== category || pinnedQIds.has(q.id));
      
      // Add fresh non-pinned questions for this category
      const targetReqs = currentKit.role.requirements.filter(r => r.kind === category || category === 'technical');
      const freshQuestions = targetReqs.slice(0, 3).map((r, i) => ({
        id: `q_regen_${category}_${Date.now()}_${i}`,
        requirement_ids: [r.id],
        category: category,
        prompt: `Regenerated ${category} focus: How would you approach "${r.text}"?`,
        answer_outline: `1. Key strategy for ${r.text}.\n2. Real-world scenario.\n3. Common pitfalls.`,
        difficulty: 2
      }));

      currentKit.questions = [...untouchedQuestions, ...freshQuestions];
      
      // Update schedule to reflect updated questions
      currentKit.schedule = allocateSchedule(
        currentKit.questions,
        currentKit.role.requirements,
        currentKit.schedule.days_available
      );
    } else if (section === 'brief') {
      // Refresh company brief
      currentKit.company_brief.summary = `Refreshed brief for ${currentKit.source.company}: Industry leader in software solution delivery.`;
    }

    kitDoc.kitData = currentKit;
    kitDoc.markModified('kitData');
    await kitDoc.save();

    res.json(kitDoc);
  } catch (err) {
    console.error('Section regeneration error:', err);
    res.status(500).json({ error: 'Failed to regenerate section.' });
  }
});

// Update Practice Mode State (Section 7 Requirement)
router.post('/:id/practice', auth, async (req, res) => {
  try {
    const { cardConfidences } = req.body; // { f1: 'easy', f2: 'hard' }
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!kitDoc) {
      return res.status(404).json({ error: 'Kit not found or access denied.' });
    }

    kitDoc.practiceState = {
      cardConfidences: {
        ...(kitDoc.practiceState?.cardConfidences || {}),
        ...cardConfidences
      },
      lastPracticedAt: new Date()
    };

    await kitDoc.save();
    res.json(kitDoc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save practice confidence.' });
  }
});

// Delete Kit
router.delete('/:id', auth, async (req, res) => {
  try {
    await Kit.deleteOne({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Kit deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete kit.' });
  }
});

module.exports = router;
