const { z } = require('zod');

const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice'])
});

const QuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3)
});

const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string())
});

const ScheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().min(0)
});

const ScheduleSchema = z.object({
  days_available: z.number().int().min(1),
  days: z.array(ScheduleDaySchema)
});

const AppendixAKitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int(),
    researched_at: z.string(),
    pages_used: z.array(z.string())
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string())
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(RequirementSchema)
  }),
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().min(1)
  })
});

function validateKit(kit) {
  const result = AppendixAKitSchema.safeParse(kit);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors
    };
  }

  // Cross-reference referential integrity validation (Spec rule: "every question_ids entry in schedule must refer to a question that exists")
  const questionIds = new Set(kit.questions.map(q => q.id));
  const reqIds = new Set(kit.role.requirements.map(r => r.id));

  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) {
        return {
          valid: false,
          errors: [`Schedule day ${day.day} references non-existent question_id '${qid}'`]
        };
      }
    }
  }

  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!reqIds.has(rid)) {
        return {
          valid: false,
          errors: [`Question '${q.id}' references non-existent requirement_id '${rid}'`]
        };
      }
    }
  }

  return { valid: true, kit: result.data };
}

module.exports = {
  validateKit,
  AppendixAKitSchema
};
