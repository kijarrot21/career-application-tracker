import { z } from "zod";

export const requirementMatchSchema = z.object({
  requirement: z.string().trim().min(1).max(500),
  category: z.enum([
    "skill",
    "experience",
    "education",
    "domain",
    "location",
    "compensation",
    "other",
  ]),
  status: z.enum(["matched", "partial", "missing", "unknown"]),
  evidenceFromProfile: z.string().trim().max(500).nullable().optional(),
});

export const jobMatchSchema = z.object({
  overallMatchScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1500),
  matchingSkills: z.array(z.string().trim().min(1).max(120)).default([]),
  missingSkills: z.array(z.string().trim().min(1).max(120)).default([]),
  qualificationGaps: z.array(z.string().trim().min(1).max(500)).default([]),
  transferableSkills: z.array(z.string().trim().min(1).max(200)).default([]),
  recommendations: z.array(z.string().trim().min(1).max(500)).default([]),
  requirementMatches: z.array(requirementMatchSchema).default([]),
  missingRequirements: z.array(z.string().trim().min(1).max(400)).default([]),
  experienceFitNotes: z.string().trim().max(800).nullable().optional(),
  salaryAndLocationNotes: z.string().trim().max(800).nullable().optional(),
  tailoredPitchPoints: z.array(z.string().trim().min(1).max(500)).default([]),
  riskFlags: z.array(z.string().trim().min(1).max(400)).default([]),
});

export type AiJobMatchResult = z.infer<typeof jobMatchSchema>;
