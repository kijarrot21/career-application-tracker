import { z } from "zod";

export const roadmapMilestoneSchema = z.object({
  phase: z.string().trim().min(1).max(120),
  timeframe: z.string().trim().min(1).max(120),
  focusArea: z.string().trim().min(1).max(200),
  actions: z.array(z.string().trim().min(1).max(500)).min(1),
  measurableOutcome: z.string().trim().min(1).max(500),
});

export const careerStrengthItemSchema = z.object({
  strength: z.string().trim().min(1).max(300),
  groundedEvidence: z.string().trim().min(1).max(400),
});

export const careerDevelopmentGapSchema = z.object({
  gap: z.string().trim().min(1).max(300),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  groundedReason: z.string().trim().min(1).max(400),
});

export const recommendedSkillItemSchema = z.object({
  skill: z.string().trim().min(1).max(120),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  reason: z.string().trim().min(1).max(400),
});

export const aiInferenceItemSchema = z.object({
  inference: z.string().trim().min(1).max(400),
  basis: z.string().trim().min(1).max(400),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const careerRoadmapSchema = z.object({
  targetRole: z.string().trim().min(1).max(200),
  readinessScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1500),
  careerStrengths: z.array(careerStrengthItemSchema).default([]),
  developmentGaps: z.array(careerDevelopmentGapSchema).default([]),
  targetRoles: z.array(z.string().trim().min(1).max(160)).default([]),
  recommendedSkills: z.array(recommendedSkillItemSchema).default([]),
  learningPriorities: z.array(z.string().trim().min(1).max(400)).default([]),
  milestones: z.array(roadmapMilestoneSchema).min(1),
  sixMonthPlan: z.array(roadmapMilestoneSchema).default([]),
  twelveMonthPlan: z.array(roadmapMilestoneSchema).default([]),
  recommendedCertifications: z
    .array(z.string().trim().min(1).max(200))
    .default([]),
  recommendedProjects: z.array(z.string().trim().min(1).max(300)).default([]),
  verifiedFacts: z.array(z.string().trim().min(1).max(400)).default([]),
  aiInferences: z.array(aiInferenceItemSchema).default([]),
  applicationHistoryInsights: z
    .object({
      applicationsAnalyzed: z.number().int().min(0).default(0),
      documentedOutcomesSummary: z.string().trim().max(600).default(""),
      unknownRejectionReasonsNote: z
        .string()
        .trim()
        .max(600)
        .default(
          "Actual employer rejection reasons are only referenced when explicitly recorded in closure notes or interview feedback.",
        ),
    })
    .optional(),
});

export type AiCareerRoadmap = z.infer<typeof careerRoadmapSchema>;

export const interviewQuestionPrepSchema = z.object({
  question: z.string().trim().min(1).max(600),
  category: z.enum([
    "technical",
    "behavioral",
    "system_design",
    "cultural_fit",
    "salary_expectation",
  ]),
  whyAsked: z.string().trim().min(1).max(500),
  starFrameworkHints: z.array(z.string().trim().min(1).max(400)).default([]),
  groundedProfileRef: z.string().trim().max(300).nullable().optional(),
});

export const interviewCoachSchema = z.object({
  overallReadinessScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1500),
  focusAreas: z.array(z.string().trim().min(1).max(400)).default([]),
  likelyQuestions: z.array(interviewQuestionPrepSchema).min(1),
  questionsToAskInterviewer: z
    .array(z.string().trim().min(1).max(400))
    .default([]),
});

export type AiInterviewCoachResult = z.infer<typeof interviewCoachSchema>;
