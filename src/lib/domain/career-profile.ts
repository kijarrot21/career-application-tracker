/**
 * Master Career Profile domain types, enumerations, and completion rules.
 *
 * Pure, isomorphic helpers shared across Drizzle schemas, Zod validators,
 * server services, and client UI.
 */

import { isIsoDate } from "./business-days";
import type { EducationLevel, WorkArrangement } from "./suitability";

export const CAREER_LEVELS = [
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "manager",
  "director",
  "executive",
] as const;
export type CareerLevel = (typeof CAREER_LEVELS)[number];

export const CAREER_LEVEL_LABELS: Record<CareerLevel, string> = {
  entry: "Entry Level / Fresh Graduate",
  junior: "Junior (1–2 yrs)",
  mid: "Mid-Level (3–5 yrs)",
  senior: "Senior (5–8 yrs)",
  lead: "Lead / Staff",
  principal: "Principal / Architect",
  manager: "Engineering / People Manager",
  director: "Director / Head of Department",
  executive: "VP / C-Level Executive",
};

export const SKILL_CATEGORIES = [
  "technical",
  "framework",
  "tool",
  "language",
  "domain",
  "soft_skill",
  "methodology",
  "other",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: "Programming / Core Tech",
  framework: "Frameworks & Libraries",
  tool: "Cloud, DevOps & Tools",
  language: "Spoken Languages",
  domain: "Domain & Business",
  soft_skill: "Leadership & Soft Skills",
  methodology: "Methodologies & Practices",
  other: "Other",
};

export const SKILL_PROFICIENCIES = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;
export type SkillProficiency = (typeof SKILL_PROFICIENCIES)[number];

export const SKILL_PROFICIENCY_LABELS: Record<SkillProficiency, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const VERIFICATION_STATUSES = [
  "verified",
  "pending_review",
  "unverified",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending_review: "Pending Review",
  unverified: "Unverified",
};

export const PROFILE_DATA_SOURCES = [
  "manual",
  "cv_import",
  "ai_suggested_pending",
] as const;
export type ProfileDataSource = (typeof PROFILE_DATA_SOURCES)[number];

export const PREFERRED_LANGUAGES = [
  { value: "id-ID", label: "Bahasa Indonesia (id-ID)" },
  { value: "en-US", label: "English (en-US)" },
  { value: "bilingual", label: "Bilingual (ID & EN)" },
] as const;

export interface CvImportDraftPayload {
  importedAt: string;
  sourceDocumentVersionId: string | null;
  sourceDocumentLabel: string | null;
  profilePatch?: {
    fullName?: string | null;
    headline?: string | null;
    summary?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    location?: string | null;
    country?: string | null;
    totalExperienceYears?: number | null;
  };
  experiences?: Array<{
    tempId: string;
    companyName: string;
    jobTitle: string;
    employmentType?: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    responsibilities?: string | null;
    achievements?: string[];
  }>;
  educations?: Array<{
    tempId: string;
    institution: string;
    qualification?: EducationLevel;
    degreeTitle?: string | null;
    fieldOfStudy?: string | null;
    graduationYear?: number | null;
    gpa?: string | null;
  }>;
  skills?: Array<{
    tempId: string;
    skillName: string;
    category?: SkillCategory;
    proficiencyLevel?: SkillProficiency;
    yearsOfExperience?: number | null;
    evidence?: string | null;
  }>;
  certifications?: Array<{
    tempId: string;
    name: string;
    issuingOrganization: string;
    issueDate?: string | null;
    expirationDate?: string | null;
    credentialId?: string | null;
    credentialUrl?: string | null;
  }>;
  projects?: Array<{
    tempId: string;
    name: string;
    organization?: string | null;
    role?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isOngoing?: boolean;
    description?: string | null;
    achievements?: string[];
    technologies?: string[];
    projectUrl?: string | null;
  }>;
  /** Provenance shown in the review UI. Never applied to Career Profile. */
  reviewMeta?: {
    fields: Array<{
      section: string;
      fieldPath: string;
      confidence: number;
      evidence?: string | null;
      existingValue?: string | null;
    }>;
    unmapped: Array<{
      section: string;
      fieldPath: string;
      value: string;
    }>;
  };
}

export function validateDateRange(params: {
  startDate?: string | null;
  endDate?: string | null;
  isCurrentOrOngoing?: boolean;
  startLabel?: string;
  endLabel?: string;
}): string | null {
  const startLabel = params.startLabel ?? "Start date";
  const endLabel = params.endLabel ?? "End date";

  if (params.startDate && !isIsoDate(params.startDate)) {
    return `${startLabel} must be a valid YYYY-MM-DD date.`;
  }
  if (params.endDate && !isIsoDate(params.endDate)) {
    return `${endLabel} must be a valid YYYY-MM-DD date.`;
  }
  if (params.isCurrentOrOngoing && params.endDate) {
    return `${endLabel} must be empty when marked as current or ongoing.`;
  }
  if (params.startDate && params.endDate && params.endDate < params.startDate) {
    return `${endLabel} cannot be earlier than ${startLabel.toLowerCase()}.`;
  }
  return null;
}

export interface ProfileCompletionSection {
  key:
    | "professional"
    | "preferences"
    | "experiences"
    | "educations"
    | "skills"
    | "certifications"
    | "projects";
  label: string;
  completed: boolean;
  detail: string;
  weight: number;
}

export interface ProfileCompletionResult {
  percentage: number;
  completedCount: number;
  totalCount: number;
  isReadyForAi: boolean;
  sections: ProfileCompletionSection[];
}

export function computeProfileCompletion(input: {
  profile: {
    fullName?: string | null;
    headline?: string | null;
    summary?: string | null;
    contactEmail?: string | null;
    location?: string | null;
    country?: string | null;
    targetPositions?: string[];
    preferredLocations?: string[];
    preferredArrangements?: WorkArrangement[] | string[];
    expectedSalaryMin?: number | null;
  } | null;
  experiencesCount: number;
  educationsCount: number;
  verifiedSkillsCount: number;
  certificationsCount: number;
  projectsCount: number;
}): ProfileCompletionResult {
  const p = input.profile;

  const hasProfessional = Boolean(
    p?.fullName?.trim() &&
      p?.headline?.trim() &&
      p?.summary?.trim() &&
      (p?.location?.trim() || p?.country?.trim()),
  );

  const hasPreferences = Boolean(
    (p?.targetPositions?.length ?? 0) > 0 &&
      ((p?.preferredLocations?.length ?? 0) > 0 ||
        (p?.preferredArrangements?.length ?? 0) > 0) &&
      p?.expectedSalaryMin != null,
  );

  const hasExperiences = input.experiencesCount > 0;
  const hasEducations = input.educationsCount > 0;
  const hasSkills = input.verifiedSkillsCount >= 3;
  const hasCertifications = input.certificationsCount > 0;
  const hasProjects = input.projectsCount > 0;

  const sections: ProfileCompletionSection[] = [
    {
      key: "professional",
      label: "Professional Info",
      completed: hasProfessional,
      detail: hasProfessional
        ? "Name, headline, summary & location complete"
        : "Add headline, summary & location",
      weight: 20,
    },
    {
      key: "preferences",
      label: "Career Preferences",
      completed: hasPreferences,
      detail: hasPreferences
        ? "Target roles, locations & salary set"
        : "Set target positions, locations & expected salary",
      weight: 15,
    },
    {
      key: "experiences",
      label: "Work Experience",
      completed: hasExperiences,
      detail: hasExperiences
        ? `${input.experiencesCount} experience record(s)`
        : "Add at least 1 work experience",
      weight: 25,
    },
    {
      key: "educations",
      label: "Education",
      completed: hasEducations,
      detail: hasEducations
        ? `${input.educationsCount} education record(s)`
        : "Add at least 1 education record",
      weight: 10,
    },
    {
      key: "skills",
      label: "Verified Skills",
      completed: hasSkills,
      detail: hasSkills
        ? `${input.verifiedSkillsCount} verified skills`
        : `Verify at least 3 skills (${input.verifiedSkillsCount}/3)`,
      weight: 15,
    },
    {
      key: "certifications",
      label: "Certifications",
      completed: hasCertifications,
      detail: hasCertifications
        ? `${input.certificationsCount} certification(s)`
        : "Optional: add certifications or licenses",
      weight: 5,
    },
    {
      key: "projects",
      label: "Projects",
      completed: hasProjects,
      detail: hasProjects
        ? `${input.projectsCount} project(s)`
        : "Add at least 1 portfolio or work project",
      weight: 10,
    },
  ];

  const percentage = sections.reduce(
    (sum, s) => sum + (s.completed ? s.weight : 0),
    0,
  );
  const completedCount = sections.filter((s) => s.completed).length;

  return {
    percentage,
    completedCount,
    totalCount: sections.length,
    isReadyForAi: hasProfessional && hasExperiences && hasSkills,
    sections,
  };
}
