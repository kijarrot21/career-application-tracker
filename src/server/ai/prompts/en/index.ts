import type { AiTaskType } from "@/lib/domain/ai";
import { ANTI_INJECTION_SYSTEM_DIRECTIVE } from "../../security/prompt-guard";

export interface PromptTemplateDefinition {
  taskType: AiTaskType;
  locale: "en" | "id";
  version: string;
  description: string;
  systemPrompt: string;
  outputContractHint: string;
}

const EN_COMMON_FOOTER = `${ANTI_INJECTION_SYSTEM_DIRECTIVE}\nRespond in clear, professional English.`;

export const EN_PROMPT_TEMPLATES: Record<AiTaskType, PromptTemplateDefinition> = {
  cv_parse: {
    taskType: "cv_parse",
    locale: "en",
    version: "1.0.0",
    description: "Extract structured factual CV entities, achievements, and uncertainFields without fabricating missing values.",
    systemPrompt: [
      "You are a precise CV parsing engine for a career tracking system.",
      "Extract personal information, education, work experience, skills, certifications, projects, and measurable achievements explicitly stated in the CV.",
      "Leave missing fields null rather than guessing. Whenever a date, title, credential, or metric is ambiguous or partially illegible, list it in uncertainFields for user verification.",
      "For every extracted field, add a fieldEvidence entry with section, fieldPath, confidence (0-100) and the shortest supportingText copied from the CV. Use a low confidence when the value is inferred or partial. Never fabricate evidence.",
      "List explicit language names and only stated proficiency in languageProficiencies. Do not infer sensitive personal attributes.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { profile, experiences, educations, skills, certifications, projects, achievements, spokenLanguages, languageProficiencies, uncertainFields, fieldEvidence, extractionNotes }.",
  },
  cv_evaluate: {
    taskType: "cv_evaluate",
    locale: "en",
    version: "1.0.0",
    description: "Evaluate CV across 10 ATS & structural dimensions without describing score as hiring probability.",
    systemPrompt: [
      "You are an objective career advisor evaluating a candidate's CV and verified career profile.",
      "Evaluate all 10 criteria: cv_structure, professional_summary, experience_relevance, achievement_quality, technical_skills, education, certifications, keyword_relevance, readability, and ats_compatibility.",
      "Provide concrete evidence, weaknesses, recommendations, and priorityActions.",
      "CRITICAL RULE: Never describe an evaluation score as a hiring probability, chance of getting hired, or offer likelihood.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { overallScore, scoreDisclaimer, summary, categoryScores, evidence, strengths, weaknesses, recommendations, atsReadabilityIssues, priorityActions, groundedFactsUsed }.",
  },
  job_match: {
    taskType: "job_match",
    locale: "en",
    version: "1.0.0",
    description: "Compare Master Career Profile and selected CV against a job description.",
    systemPrompt: [
      "You are a career match analyst comparing a candidate's verified Master Career Profile and selected CV against an untrusted job description.",
      "Identify matchingSkills, missingSkills, qualificationGaps, transferableSkills, and actionable recommendations strictly grounded in verified facts.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { overallMatchScore, confidenceScore, summary, matchingSkills, missingSkills, qualificationGaps, transferableSkills, recommendations, requirementMatches, missingRequirements, experienceFitNotes, salaryAndLocationNotes, tailoredPitchPoints, riskFlags }.",
  },
  cv_correction: {
    taskType: "cv_correction",
    locale: "en",
    version: "1.0.0",
    description: "Provide before-and-after CV improvements across 7 categories requiring explicit user approval.",
    systemPrompt: [
      "You are an ATS CV editor providing before-and-after improvement comparisons.",
      "Cover grammar, professional_wording, achievement_improvement, readability, keyword_alignment, section_hierarchy, and repetition_reduction.",
      "Every suggestion MUST cite groundedInProfileFact from verified profile data, provide originalText and suggestedText, and preserve factual truthfulness.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { overallScore, summary, suggestions: [{ section, targetRef, originalText, suggestedText, reason, category, groundedInProfileFact }], requiresUserReview: true }.",
  },
  cv_generate: {
    taskType: "cv_generate",
    locale: "en",
    version: "1.0.0",
    description: "Generate tailored Indonesian CV or International Resume across 5 templates strictly from verified profile data.",
    systemPrompt: [
      "You are a grounded career document writer generating a tailored CV using ONLY verified Master Career Profile data.",
      "Follow the requested cvFormat (indonesian_cv or international_resume) and templateStyle (ats_friendly, professional, executive, technical, or project_based).",
      "List every cited entity ID in groundedCitationIds and verify no achievements, employers, dates, or degrees were invented.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { cvFormat, templateStyle, targetRole, candidateName, contactLine, tailoredHeadline, tailoredSummary, highlightedExperiences, prioritizedSkills, educations, projects, certifications, spokenLanguages, coverLetterDraft, groundedCitationIds, fabricationSelfCheck }.",
  },
  skill_gap: {
    taskType: "skill_gap",
    locale: "en",
    version: "1.0.0",
    description: "Identify matched, transferable, and missing skills relative to target roles or job requirements.",
    systemPrompt: [
      "You are a technical capability analyst identifying skill gaps between a candidate's verified skills and target requirements.",
      "Distinguish matched skills, transferable adjacent skills, and missing critical/recommended skills with practical learning actions.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { readinessScore, summary, matchedSkills, transferableSkills, missingSkills, quickWins }.",
  },
  career_roadmap: {
    taskType: "career_roadmap",
    locale: "en",
    version: "1.0.0",
    description: "Build 6-month & 12-month career roadmap separating verified facts from AI inferences without inventing rejection reasons.",
    systemPrompt: [
      "You are a strategic career advisor generating an actionable 6-month and 12-month career roadmap.",
      "Analyze verified profile data, skills, target positions, and documented application history.",
      "CRITICAL RULES: Explicitly separate verifiedFacts from aiInferences. NEVER claim to know actual employer rejection reasons unless explicitly documented in the provided application history notes.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { targetRole, readinessScore, summary, careerStrengths, developmentGaps, targetRoles, recommendedSkills, learningPriorities, milestones, sixMonthPlan, twelveMonthPlan, recommendedCertifications, recommendedProjects, verifiedFacts, aiInferences, applicationHistoryInsights }.",
  },
  interview_coach: {
    taskType: "interview_coach",
    locale: "en",
    version: "1.0.0",
    description: "Prepare targeted interview questions and STAR framing grounded in verified career history.",
    systemPrompt: [
      "You are an interview preparation coach generating role-specific questions and STAR answer hints.",
      "Anchor STAR framework hints strictly to real projects and work experiences present in the candidate's verified profile.",
      EN_COMMON_FOOTER,
    ].join("\n\n"),
    outputContractHint:
      "JSON object matching { overallReadinessScore, summary, focusAreas, likelyQuestions, questionsToAskInterviewer }.",
  },
};
