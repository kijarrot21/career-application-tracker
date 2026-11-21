import { z } from "zod";
import {
  CAREER_LEVELS,
  SKILL_CATEGORIES,
  SKILL_PROFICIENCIES,
} from "@/lib/domain/career-profile";
import { EDUCATION_LEVELS } from "@/lib/domain/suitability";
import { EMPLOYMENT_TYPES } from "@/lib/constants";

export const aiParsedProfilePatchSchema = z.object({
  fullName: z.string().trim().min(1).max(160).nullable().optional(),
  headline: z.string().trim().max(200).nullable().optional(),
  summary: z.string().trim().max(4000).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(80).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  careerLevel: z.enum(CAREER_LEVELS).nullable().optional(),
  totalExperienceYears: z.number().int().min(0).max(60).nullable().optional(),
});

export const aiParsedExperienceSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().min(1).max(200),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  location: z.string().trim().max(160).nullable().optional(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
    .nullable()
    .optional(),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
    .nullable()
    .optional(),
  isCurrent: z.boolean().default(false),
  responsibilities: z.string().trim().max(4000).nullable().optional(),
  achievements: z.array(z.string().trim().min(1).max(600)).default([]),
});

export const aiParsedEducationSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  qualification: z.enum(EDUCATION_LEVELS).default("bachelor"),
  degreeTitle: z.string().trim().max(200).nullable().optional(),
  fieldOfStudy: z.string().trim().max(200).nullable().optional(),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
  gpa: z.string().trim().max(40).nullable().optional(),
});

export const aiParsedSkillSchema = z.object({
  skillName: z.string().trim().min(1).max(120),
  category: z.enum(SKILL_CATEGORIES).default("technical"),
  proficiencyLevel: z.enum(SKILL_PROFICIENCIES).default("intermediate"),
  yearsOfExperience: z.number().int().min(0).max(60).nullable().optional(),
  evidence: z.string().trim().max(500).nullable().optional(),
});

export const aiParsedCertificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuingOrganization: z.string().trim().min(1).max(200),
  issueDate: z.string().trim().nullable().optional(),
  expirationDate: z.string().trim().nullable().optional(),
  credentialId: z.string().trim().max(160).nullable().optional(),
  credentialUrl: z.string().trim().max(300).nullable().optional(),
});

export const aiParsedProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organization: z.string().trim().max(200).nullable().optional(),
  role: z.string().trim().max(160).nullable().optional(),
  startDate: z.string().trim().nullable().optional(),
  endDate: z.string().trim().nullable().optional(),
  isOngoing: z.boolean().default(false),
  description: z.string().trim().max(2000).nullable().optional(),
  achievements: z.array(z.string().trim().min(1).max(500)).default([]),
  technologies: z.array(z.string().trim().min(1).max(100)).default([]),
  projectUrl: z.string().trim().max(300).nullable().optional(),
});

export const aiFieldEvidenceSchema = z.object({
  section: z.string().trim().min(1).max(80),
  fieldPath: z.string().trim().min(1).max(160),
  confidence: z.number().int().min(0).max(100),
  supportingText: z.string().trim().max(600).nullable().optional(),
});

export const aiLanguageProficiencySchema = z.object({
  language: z.string().trim().min(1).max(80),
  proficiency: z.enum(SKILL_PROFICIENCIES).nullable().optional(),
});

export const aiUncertainFieldSchema = z.object({
  section: z.string().trim().min(1).max(80),
  fieldPath: z.string().trim().min(1).max(160),
  extractedValue: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().min(1).max(400),
});

export const cvDataSchema = z.object({
  profile: aiParsedProfilePatchSchema,
  experiences: z.array(aiParsedExperienceSchema).default([]),
  educations: z.array(aiParsedEducationSchema).default([]),
  skills: z.array(aiParsedSkillSchema).default([]),
  certifications: z.array(aiParsedCertificationSchema).default([]),
  projects: z.array(aiParsedProjectSchema).default([]),
  achievements: z.array(z.string().trim().min(1).max(600)).default([]),
  spokenLanguages: z.array(z.string().trim().min(1)).default([]),
  languageProficiencies: z.array(aiLanguageProficiencySchema).default([]),
  uncertainFields: z.array(aiUncertainFieldSchema).default([]),
  fieldEvidence: z.array(aiFieldEvidenceSchema).default([]),
  extractionNotes: z.array(z.string().trim()).default([]),
});

export type AiCvData = z.infer<typeof cvDataSchema>;
