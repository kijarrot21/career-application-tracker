import { z } from "zod";

export const CV_EVALUATION_CATEGORIES = [
  "cv_structure",
  "professional_summary",
  "experience_relevance",
  "achievement_quality",
  "technical_skills",
  "education",
  "certifications",
  "keyword_relevance",
  "readability",
  "ats_compatibility",
] as const;

export const CV_EVALUATION_CATEGORY_LABELS: Record<
  (typeof CV_EVALUATION_CATEGORIES)[number],
  string
> = {
  cv_structure: "CV Structure",
  professional_summary: "Professional Summary",
  experience_relevance: "Experience Relevance",
  achievement_quality: "Achievement Quality",
  technical_skills: "Technical Skills",
  education: "Education",
  certifications: "Certifications",
  keyword_relevance: "Keyword Relevance",
  readability: "Readability",
  ats_compatibility: "ATS Compatibility",
};

export const cvSectionScoreSchema = z.object({
  section: z.enum([
    "summary",
    "experience",
    "skills",
    "education",
    "projects",
    "formatting_clarity",
    ...CV_EVALUATION_CATEGORIES,
  ]),
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(1).max(800),
});

export const cvCategoryScoreSchema = z.object({
  category: z.enum(CV_EVALUATION_CATEGORIES),
  score: z.number().int().min(0).max(100),
  evidence: z.string().trim().max(600).default(""),
  feedback: z.string().trim().min(1).max(800),
});

export const cvActionItemSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  section: z.string().trim().min(1).max(80),
  recommendation: z.string().trim().min(1).max(800),
  groundedReason: z.string().trim().min(1).max(600),
});

const HIRING_PROBABILITY_RE = /\b(hiring\s+probability|chance\s+of\s+getting\s+hired|likelihood\s+of\s+offer|peluang\s+diterima)\b/i;

export const DEFAULT_EVALUATION_DISCLAIMER =
  "This score evaluates CV structure, clarity, keyword alignment, and ATS readability only — it does not measure or predict hiring probability.";

export const cvEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  scoreDisclaimer: z
    .string()
    .trim()
    .max(400)
    .default(DEFAULT_EVALUATION_DISCLAIMER)
    .refine(
      (val) =>
        val.length === 0 ||
        /not\s+(?:a\s+)?hiring\s+probability|bukan\s+probabilitas\s+diterima|does\s+not\s+measure\s+or\s+predict\s+hiring/i.test(
          val,
        ) ||
        !HIRING_PROBABILITY_RE.test(val),
      "Score disclaimer must never present the score as a hiring probability.",
    ),
  summary: z.string().trim().min(1).max(1500),
  categoryScores: z.array(cvCategoryScoreSchema).default([]),
  sectionScores: z.array(cvSectionScoreSchema).default([]),
  evidence: z.array(z.string().trim().min(1).max(500)).default([]),
  strengths: z.array(z.string().trim().min(1).max(400)).default([]),
  weaknesses: z.array(z.string().trim().min(1).max(400)).default([]),
  recommendations: z.array(z.string().trim().min(1).max(500)).default([]),
  atsReadabilityIssues: z.array(z.string().trim().min(1).max(400)).default([]),
  priorityActions: z.array(cvActionItemSchema).default([]),
  actionItems: z.array(cvActionItemSchema).default([]),
  groundedFactsUsed: z.array(z.string().trim().min(1)).default([]),
});

export type AiCvEvaluation = z.infer<typeof cvEvaluationSchema>;

export const skillGapItemSchema = z.object({
  skillName: z.string().trim().min(1).max(120),
  importance: z.enum(["critical", "recommended", "nice_to_have"]),
  currentStatus: z.enum(["missing", "partial", "unverified"]),
  suggestedAction: z.string().trim().min(1).max(600),
  estimatedTimeToLearnWeeks: z.number().int().min(1).max(104).nullable().optional(),
});

export const skillGapSchema = z.object({
  readinessScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1500),
  matchedSkills: z.array(z.string().trim().min(1)).default([]),
  transferableSkills: z.array(z.string().trim().min(1)).default([]),
  missingSkills: z.array(skillGapItemSchema).default([]),
  quickWins: z.array(z.string().trim().min(1).max(400)).default([]),
});

export type AiSkillGapAnalysis = z.infer<typeof skillGapSchema>;
