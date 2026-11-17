import { z } from "zod";

export const CV_CORRECTION_CATEGORIES = [
  "grammar",
  "professional_wording",
  "achievement_improvement",
  "readability",
  "keyword_alignment",
  "section_hierarchy",
  "repetition_reduction",
  // Legacy aliases retained for backwards compatibility
  "clarity",
  "impact_framing",
  "ats_formatting",
] as const;

export const CV_CORRECTION_CATEGORY_LABELS: Record<
  (typeof CV_CORRECTION_CATEGORIES)[number],
  string
> = {
  grammar: "Grammar Correction",
  professional_wording: "Professional Wording",
  achievement_improvement: "Achievement Improvement",
  readability: "Readability",
  keyword_alignment: "Keyword Alignment",
  section_hierarchy: "Section Hierarchy",
  repetition_reduction: "Repetition Reduction",
  clarity: "Clarity",
  impact_framing: "Impact Framing",
  ats_formatting: "ATS Formatting",
};

export const correctionSuggestionSchema = z.object({
  section: z.enum([
    "headline",
    "summary",
    "experience_bullet",
    "project_bullet",
    "skills",
    "education",
    "section_hierarchy",
    "formatting",
  ]),
  targetRef: z.string().trim().max(200).nullable().optional(),
  originalText: z.string().trim().min(1).max(1500),
  suggestedText: z.string().trim().min(1).max(1500),
  reason: z.string().trim().min(1).max(600),
  category: z.enum(CV_CORRECTION_CATEGORIES),
  groundedInProfileFact: z.string().trim().min(1).max(500),
});

export const correctionResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(1200),
  suggestions: z.array(correctionSuggestionSchema).default([]),
  requiresUserReview: z.boolean().default(true),
});

export type AiCorrectionResult = z.infer<typeof correctionResultSchema>;

export const CV_FORMATS = ["indonesian_cv", "international_resume"] as const;
export type AiCvFormat = (typeof CV_FORMATS)[number];

export const CV_FORMAT_LABELS: Record<AiCvFormat, string> = {
  indonesian_cv: "Indonesian CV (Curriculum Vitae)",
  international_resume: "International Resume",
};

export const CV_TEMPLATE_STYLES = [
  "ats_friendly",
  "professional",
  "executive",
  "technical",
  "project_based",
] as const;
export type AiCvTemplateStyle = (typeof CV_TEMPLATE_STYLES)[number];

export const CV_TEMPLATE_STYLE_LABELS: Record<AiCvTemplateStyle, string> = {
  ats_friendly: "ATS-Friendly Classic",
  professional: "Professional Standard",
  executive: "Executive Leadership",
  technical: "Technical / Engineering",
  project_based: "Project-Based Portfolio",
};

export const tailoredExperienceHighlightSchema = z.object({
  experienceId: z.string().trim().max(120).nullable().optional(),
  companyName: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().min(1).max(200),
  location: z.string().trim().max(160).nullable().optional(),
  periodLabel: z.string().trim().max(120).nullable().optional(),
  relevantBullets: z.array(z.string().trim().min(1).max(500)).default([]),
});

export const cvGeneratedEducationSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  qualificationLabel: z.string().trim().min(1).max(200),
  fieldOfStudy: z.string().trim().max(200).nullable().optional(),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

export const cvGeneratedProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(160).nullable().optional(),
  organization: z.string().trim().max(200).nullable().optional(),
  bullets: z.array(z.string().trim().min(1).max(500)).default([]),
  technologies: z.array(z.string().trim().min(1).max(100)).default([]),
});

export const cvGeneratedCertificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuingOrganization: z.string().trim().min(1).max(200),
  issueDate: z.string().trim().max(40).nullable().optional(),
});

export const cvGenerationSchema = z.object({
  cvFormat: z.enum(CV_FORMATS).default("international_resume"),
  templateStyle: z.enum(CV_TEMPLATE_STYLES).default("ats_friendly"),
  targetRole: z.string().trim().min(1).max(200),
  candidateName: z.string().trim().max(160).optional(),
  contactLine: z.string().trim().max(400).optional(),
  tailoredHeadline: z.string().trim().min(1).max(220),
  tailoredSummary: z.string().trim().min(1).max(2500),
  highlightedExperiences: z.array(tailoredExperienceHighlightSchema).default([]),
  prioritizedSkills: z.array(z.string().trim().min(1).max(120)).default([]),
  educations: z.array(cvGeneratedEducationSchema).default([]),
  projects: z.array(cvGeneratedProjectSchema).default([]),
  certifications: z.array(cvGeneratedCertificationSchema).default([]),
  spokenLanguages: z.array(z.string().trim().min(1).max(80)).default([]),
  coverLetterDraft: z.string().trim().max(6000).nullable().optional(),
  groundedCitationIds: z.array(z.string().trim().min(1)).default([]),
  fabricationSelfCheck: z.string().trim().min(1).max(600),
});

export type AiCvGenerationResult = z.infer<typeof cvGenerationSchema>;
