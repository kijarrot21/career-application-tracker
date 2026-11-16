/**
 * Deterministic Recruitment Email Classifier & Application Matcher.
 *
 * Inspects email subject, sender, and snippet/body (supports English and
 * Bahasa Indonesia recruitment terminology) to:
 * 1. Classify into one of the 8 HR recruitment correspondence categories.
 * 2. Extract candidate company name and job position.
 * 3. Recommend a suggested recruitment stage type (never applied automatically;
 *    always requires user confirmation).
 * 4. Match the email to existing submitted applications.
 */

import type { EmailClassification } from "@/lib/constants";
import { normalizeCompanyName, normalizeTitle } from "./duplicates";
import type { StageType } from "./stages";

export interface RawEmailInput {
  sender?: string | null;
  recipient?: string | null;
  subject: string;
  snippet?: string | null;
}

export interface ClassificationResult {
  classification: EmailClassification;
  confidence: number;
  reasons: string[];
  detectedCompany: string | null;
  detectedPosition: string | null;
  suggestedStageType: StageType | null;
}

interface RulePattern {
  classification: Exclude<EmailClassification, "not_recruitment" | "other_recruitment">;
  weight: number;
  label: string;
  regex: RegExp;
}

const CLASSIFICATION_RULES: readonly RulePattern[] = [
  // Job Offer
  {
    classification: "job_offer",
    weight: 92,
    label: "Job offer phrase detected",
    regex:
      /\b(pleased to offer you|offer of employment|employment offer|formal offer|offering you the (position|role)|offer letter|surat penawaran kerja|offering letter|penawaran kerja)\b/i,
  },
  // Rejection Notification
  {
    classification: "rejection",
    weight: 90,
    label: "Rejection phrase detected",
    regex:
      /\b(unfortunately[, ]+we|not moving forward|will not be moving forward|decided not to proceed|pursue other candidates|other candidates whose qualifications|regret to inform you|belum dapat melanjutkan|belum bisa melanjutkan|mohon maaf.*lamaran)\b/i,
  },
  // Assessment Invitation
  {
    classification: "assessment_invitation",
    weight: 88,
    label: "Assessment or technical test invitation detected",
    regex:
      /\b(technical assessment|coding challenge|online assessment|take-home (test|assignment|project)|hackerrank|codility|leetcode|psychometric test|aptitude test|case study assignment|tes teknis|psikotes|tes kemampuan)\b/i,
  },
  // Interview Invitation
  {
    classification: "interview_invitation",
    weight: 88,
    label: "Interview invitation or scheduling phrase detected",
    regex:
      /\b(invite you to (an |a )?(hr |technical |user |panel |final )?interview|interview invitation|schedule (an |your )?interview|availability for (an )?interview|undangan (wawancara|interview)|jadwal (wawancara|interview))\b/i,
  },
  // Interview Follow-up
  {
    classification: "interview_follow_up",
    weight: 82,
    label: "Post-interview follow-up phrase detected",
    regex:
      /\b(thank you for (speaking|interviewing|meeting) with us|following up on (our|your) interview|next steps after your interview|post-interview|terima kasih telah mengikuti wawancara|tindak lanjut wawancara)\b/i,
  },
  // CV Screening
  {
    classification: "cv_screening",
    weight: 80,
    label: "CV screening or profile review phrase detected",
    regex:
      /\b(application is under review|reviewing your (application|cv|resume|profile)|shortlisted for review|passed initial screening|cv screening|lamaran.*sedang ditinjau|lolos seleksi administrasi|tahap seleksi berkas)\b/i,
  },
  // Application Confirmation
  {
    classification: "application_confirmation",
    weight: 84,
    label: "Application acknowledgment phrase detected",
    regex:
      /\b(thank you for applying|thanks for applying|application received|we have received your application|application confirmation|application to .* was successfully submitted|terima kasih telah melamar|lamaran anda telah kami terima|konfirmasi lamaran)\b/i,
  },
];

const ATS_SENDER_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "myworkday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "ashbyhq.com",
  "workablemail.com",
  "bamboohr.com",
  "kalibrr.com",
  "glints.com",
  "jobstreet.com",
  "indeedemail.com",
  "linkedin.com",
];

const GENERIC_RECRUITMENT_TERMS =
  /\b(recruiter|talent acquisition|recruitment|hiring team|career opportunity|job application|candidacy|candidate|rekrutmen|hrd|lowongan)\b/i;

export function suggestedStageTypeForClassification(
  classification: EmailClassification,
): StageType | null {
  switch (classification) {
    case "application_confirmation":
      return "applied";
    case "cv_screening":
      return "screening";
    case "interview_invitation":
    case "interview_follow_up":
      return "interview";
    case "assessment_invitation":
      return "assessment";
    case "rejection":
      return "rejected";
    case "job_offer":
      return "offer";
    default:
      return null;
  }
}

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  ...ATS_SENDER_DOMAINS,
]);

export function extractCompanyFromEmail(input: RawEmailInput): string | null {
  const subject = input.subject.trim();

  // Pattern 1: "[Company Name] ..."
  const bracketMatch = subject.match(/^\[([A-Za-z0-9 .,&()-]{2,40})\]/);
  if (bracketMatch) {
    return bracketMatch[1].trim();
  }

  // Pattern 2: "... at Company Name", "... applying to Company Name", "... with Company Name", "... di Company Name"
  const atMatch = `${subject}\n${input.snippet ?? ""}`.match(
    /\b(?:applying to|application to|at|with|from|di)\s+([A-Z][A-Za-z0-9 .,&]{1,40}?)(?:\s*[-|:.,!(\n]|$)/,
  );
  if (atMatch) {
    return atMatch[1].trim();
  }

  // Pattern 3: Sender display name "Company Talent Acquisition <...>"
  if (input.sender) {
    const displayMatch = input.sender.match(/^"?([^"<]+)"?\s*</);
    if (displayMatch) {
      const cleaned = displayMatch[1]
        .replace(
          /\b(careers?|recruiting|recruitment|talent acquisition|hr|hiring|team|no-reply|noreply)\b/gi,
          "",
        )
        .trim();
      if (cleaned.length >= 2 && cleaned.length <= 40) {
        return cleaned;
      }
    }

    // Pattern 4: Sender domain (non-generic, non-ATS)
    const domainMatch = input.sender.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
    if (domainMatch) {
      const domain = domainMatch[1];
      const isGeneric = [...GENERIC_EMAIL_DOMAINS].some(
        (g) => domain === g || domain.endsWith(`.${g}`),
      );
      if (!isGeneric) {
        const root = domain.split(".")[0];
        if (root && root.length >= 2) {
          return root.charAt(0).toUpperCase() + root.slice(1);
        }
      }
    }
  }

  return null;
}

export function extractPositionFromEmail(input: RawEmailInput): string | null {
  const text = `${input.subject} ${input.snippet ?? ""}`;

  const patterns = [
    /\b(?:application|interview|invitation|offer|assessment|role|position)\s+(?:for|as)\s+(?:the\s+)?([A-Z][A-Za-z0-9 /()-]{2,55}?)(?:\s+(?:at|with|di|position|role)\b|[-|,.!\n]|$)/i,
    /\b(?:posisi|lamaran)\s+([A-Z][A-Za-z0-9 /()-]{2,55}?)(?:\s+(?:di|pada)\b|[-|,.!\n]|$)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (candidate.length >= 3 && candidate.length <= 60) {
        return candidate;
      }
    }
  }

  return null;
}

export function classifyRecruitmentEmail(
  input: RawEmailInput,
): ClassificationResult {
  const combined = `${input.subject}\n${input.snippet ?? ""}`;
  const senderLower = (input.sender ?? "").toLowerCase();
  const reasons: string[] = [];

  const fromAts = ATS_SENDER_DOMAINS.some((d) => senderLower.includes(d));
  if (fromAts) {
    reasons.push("Sent from known ATS / recruitment platform domain");
  }

  const matchedRules: RulePattern[] = [];
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.regex.test(combined)) {
      matchedRules.push(rule);
      reasons.push(rule.label);
    }
  }

  const detectedCompany = extractCompanyFromEmail(input);
  const detectedPosition = extractPositionFromEmail(input);

  if (matchedRules.length > 0) {
    matchedRules.sort((a, b) => b.weight - a.weight);
    const best = matchedRules[0];
    const confidence = Math.min(99, best.weight + (fromAts ? 6 : 0));
    return {
      classification: best.classification,
      confidence,
      reasons,
      detectedCompany,
      detectedPosition,
      suggestedStageType: suggestedStageTypeForClassification(
        best.classification,
      ),
    };
  }

  if (fromAts || GENERIC_RECRUITMENT_TERMS.test(combined)) {
    if (GENERIC_RECRUITMENT_TERMS.test(combined)) {
      reasons.push("Contains recruitment or talent acquisition keywords");
    }
    return {
      classification: "other_recruitment",
      confidence: fromAts ? 75 : 65,
      reasons,
      detectedCompany,
      detectedPosition,
      suggestedStageType: null,
    };
  }

  return {
    classification: "not_recruitment",
    confidence: 20,
    reasons: ["No recruitment keywords or ATS sender detected"],
    detectedCompany: null,
    detectedPosition: null,
    suggestedStageType: null,
  };
}

export interface ApplicationCandidateForMatch {
  id: string;
  code: string;
  companyName: string;
  jobTitle: string;
  recruiterEmail?: string | null;
}

export interface EmailApplicationMatch {
  applicationId: string | null;
  matchScore: number;
  matchReason: string | null;
}

/**
 * Find the best matching application for a recruitment email.
 * Never mutates the application status automatically.
 */
export function matchEmailToApplication(
  email: RawEmailInput & {
    detectedCompany?: string | null;
    detectedPosition?: string | null;
  },
  applications: readonly ApplicationCandidateForMatch[],
): EmailApplicationMatch {
  if (applications.length === 0) {
    return { applicationId: null, matchScore: 0, matchReason: null };
  }

  const senderLower = (email.sender ?? "").toLowerCase();
  const combinedNorm = `${email.subject} ${email.snippet ?? ""}`.toLowerCase();
  const detectedCoNorm = email.detectedCompany
    ? normalizeCompanyName(email.detectedCompany)
    : "";
  const detectedPosNorm = email.detectedPosition
    ? normalizeTitle(email.detectedPosition)
    : "";

  let best: { id: string; code: string; score: number; reasons: string[] } | null =
    null;

  for (const app of applications) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Exact recruiter email match
    if (
      app.recruiterEmail &&
      senderLower.includes(app.recruiterEmail.toLowerCase())
    ) {
      score += 65;
      reasons.push(`Recruiter email matches ${app.recruiterEmail}`);
    }

    // 2. Company name match
    const coNorm = normalizeCompanyName(app.companyName);
    if (
      coNorm &&
      ((detectedCoNorm && (coNorm.includes(detectedCoNorm) || detectedCoNorm.includes(coNorm))) ||
        combinedNorm.includes(coNorm))
    ) {
      score += 45;
      reasons.push(`Company matches ${app.companyName}`);
    }

    // 3. Position title match
    const titleNorm = normalizeTitle(app.jobTitle);
    if (
      titleNorm &&
      ((detectedPosNorm &&
        (titleNorm.includes(detectedPosNorm) || detectedPosNorm.includes(titleNorm))) ||
        combinedNorm.includes(titleNorm))
    ) {
      score += 35;
      reasons.push(`Position matches ${app.jobTitle}`);
    }

    if (score > (best?.score ?? 0)) {
      best = { id: app.id, code: app.code, score, reasons };
    }
  }

  if (!best || best.score < 40) {
    return { applicationId: null, matchScore: 0, matchReason: null };
  }

  return {
    applicationId: best.id,
    matchScore: Math.min(100, best.score),
    matchReason: `${best.code}: ${best.reasons.join("; ")}`,
  };
}
