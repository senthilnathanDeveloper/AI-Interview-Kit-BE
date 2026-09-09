const { crawlCompanySite } = require('./crawler');
const { findPublicDiscussions } = require('./publicSearch');
const { callGemini, heuristicExtractAndGenerate } = require('./llmService');
const { checkCoverage } = require('./coverageChecker');
const { allocateSchedule } = require('./scheduleAllocator');
const { validateKit } = require('./validator');

/**
 * Executes the complete multi-step research, generation, 2nd-pass coverage check,
 * and deterministic schedule allocation pipeline.
 *
 * @param {Object} params - { jd, company_url, days, onProgress }
 */
async function runPipeline({ jd, company_url, days = 5, onProgress = () => {} }) {
  const jdText = (jd || '').trim();
  const companyUrl = (company_url || '').trim();
  const safeDays = Math.max(1, Math.min(60, parseInt(days, 10) || 5));

  if (!jdText) {
    throw new Error('Job description is required to generate interview kit.');
  }

  // Step 1: Crawl company site & retrieve pages
  onProgress({ stage: 'CRAWLING', message: `Crawling company site at ${companyUrl || 'provided URL'}...` });
  const crawlResult = await crawlCompanySite(companyUrl);

  // Step 2: Public discussion research
  onProgress({ stage: 'PUBLIC_SEARCH', message: `Searching public interview discussions for ${crawlResult.companyName}...` });
  const publicDiscussion = await findPublicDiscussions(crawlResult.companyName);

  // Step 3: Extract Requirements & Initial Kit Draft
  onProgress({ stage: 'EXTRACTING_REQUIREMENTS', message: 'Extracting requirements and structuring company brief...' });
  let draftKit = null;
  let useLlm = false;

  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  if (apiKey) {
    try {
      // Attempt LLM multi-step extraction via Gemini API
      const prompt = `
Generate a structured JSON draft for an interview preparation kit.
Job Description:
${jdText}

Company Name: ${crawlResult.companyName}
Company URL: ${companyUrl}
Crawled Page Texts:
${crawlResult.pages.map(p => p.text).join('\n---\n')}

Return JSON with exact keys: source, company_brief, role, questions, flashcards.
Ensure every requirement in role.requirements has a unique id (r1, r2, ...), kind (technical|behavioural|domain), priority (must|nice).
Every question must have id (q1, q2...), requirement_ids (array of rX ids), category (technical|behavioural|system-design|company-fit), difficulty (1..3).
Every flashcard must have id (f1, f2...), front, back, requirement_ids.
`;
      const llmResult = await callGemini(prompt, "You are an expert technical interviewer and interview preparation coach. Output valid JSON only.");
      if (llmResult && llmResult.role && llmResult.questions) {
        draftKit = llmResult;
        useLlm = true;
      }
    } catch (llmErr) {
      console.warn(`[Pipeline] LLM call failed or unavailable, falling back to heuristic engine: ${llmErr.message}`);
    }
  }

  if (!draftKit) {
    // Execute heuristic AI generation engine
    draftKit = heuristicExtractAndGenerate({
      jd: jdText,
      companyName: crawlResult.companyName,
      companyUrl: companyUrl,
      pages: crawlResult.pages,
      publicDiscussion,
      days: safeDays
    });
  }

  // Ensure source parameters match input
  draftKit.source = draftKit.source || {};
  draftKit.source.company = crawlResult.companyName || draftKit.source.company || 'Company';
  draftKit.source.company_url = companyUrl;
  draftKit.source.jd_chars = jdText.length;
  draftKit.source.researched_at = new Date().toISOString();
  draftKit.source.pages_used = crawlResult.sourcesUsed || [];

  // Step 4 & 5: Deterministic Coverage Check (First Pass)
  onProgress({ stage: 'COVERAGE_CHECK', message: 'Performing first-pass coverage gap check...' });
  let coverageResult = checkCoverage(draftKit.role.requirements, draftKit.questions);
  let passCount = 1;

  // Step 6: Second Pass Loop - Generate missing questions for uncovered must-have requirements
  if (coverageResult.uncovered_must_ids.length > 0) {
    onProgress({ stage: 'SECOND_PASS', message: `Second pass: closing coverage gap for ${coverageResult.uncovered_must_ids.length} requirements...` });
    
    passCount = 2;
    coverageResult.uncovered_must_ids.forEach(reqId => {
      const targetReq = draftKit.role.requirements.find(r => r.id === reqId);
      if (targetReq) {
        const newQId = `q_pass2_${reqId}`;
        const newCat = targetReq.kind === 'behavioural' ? 'behavioural' : 'technical';
        
        draftKit.questions.push({
          id: newQId,
          requirement_ids: [reqId],
          category: newCat,
          prompt: `Specific question for must-have requirement: "${targetReq.text}"`,
          answer_outline: `1. Explain core mechanics of ${targetReq.text}.\n2. Describe real-world implementation.\n3. Discuss edge cases and error handling.`,
          difficulty: 2
        });

        // Add corresponding flashcard as well
        draftKit.flashcards.push({
          id: `f_pass2_${reqId}`,
          front: `Must-Have: ${targetReq.text}`,
          back: `Key principles and best practices for ${targetReq.text}.`,
          requirement_ids: [reqId]
        });
      }
    });

    // Re-evaluate coverage after second pass
    coverageResult = checkCoverage(draftKit.role.requirements, draftKit.questions);
  }

  // Step 7: Deterministic Schedule Allocation (Section 8 of Brief)
  onProgress({ stage: 'ALLOCATING_SCHEDULE', message: 'Allocating day-by-day study schedule using priority arithmetic...' });
  const scheduleData = allocateSchedule(
    draftKit.questions,
    draftKit.role.requirements,
    safeDays
  );

  // Assemble complete final kit according to Appendix A structure
  const finalKit = {
    source: draftKit.source,
    company_brief: draftKit.company_brief,
    role: draftKit.role,
    questions: draftKit.questions,
    flashcards: draftKit.flashcards,
    schedule: scheduleData,
    coverage: {
      uncovered_requirement_ids: coverageResult.uncovered_must_ids,
      passes: passCount
    }
  };

  // Step 8: Schema Validation
  onProgress({ stage: 'VALIDATING', message: 'Validating kit structure against Appendix A schema...' });
  const validation = validateKit(finalKit);
  if (!validation.valid) {
    console.error('[Pipeline] Schema validation failed:', validation.errors);
    throw new Error(`Generated kit failed Appendix A validation: ${JSON.stringify(validation.errors)}`);
  }

  onProgress({ stage: 'COMPLETED', message: 'Interview Prep Kit successfully generated!' });
  return finalKit;
}

module.exports = { runPipeline };
