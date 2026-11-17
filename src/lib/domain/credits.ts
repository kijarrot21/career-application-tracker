import type { AiTaskType } from "./ai";

export const CREDIT_LEDGER_ENTRY_TYPES = [
  "grant",
  "reserve",
  "capture",
  "release",
  "refund",
  "adjustment",
  "topup_preview",
  "expire",
] as const;
export type CreditLedgerEntryType = (typeof CREDIT_LEDGER_ENTRY_TYPES)[number];

export const CREDIT_RESERVATION_STATUSES = [
  "reserved",
  "captured",
  "released",
  "expired",
] as const;
export type CreditReservationStatus =
  (typeof CREDIT_RESERVATION_STATUSES)[number];

export const DEFAULT_WELCOME_CREDITS = 100;
export const DEFAULT_LOW_BALANCE_THRESHOLD = 10;

export class InsufficientCreditsError extends Error {
  readonly requiredCredits: number;
  readonly availableCredits: number;
  readonly pricingKey: string;

  constructor(params: {
    requiredCredits: number;
    availableCredits: number;
    pricingKey: string;
  }) {
    super(
      `Insufficient credits for '${params.pricingKey}': requires ${params.requiredCredits} credit(s), available balance is ${params.availableCredits}.`,
    );
    this.name = "InsufficientCreditsError";
    this.requiredCredits = params.requiredCredits;
    this.availableCredits = params.availableCredits;
    this.pricingKey = params.pricingKey;
  }
}

export interface DefaultCreditPricingSeed {
  pricingKey: string;
  taskType: AiTaskType;
  label: string;
  description: string;
  creditCost: number;
  sortOrder: number;
}

/**
 * Initial configurable database pricing seed values.
 * Operators can adjust these values directly in `ai_credit_pricing` without code changes.
 */
export const DEFAULT_CREDIT_PRICING: DefaultCreditPricingSeed[] = [
  {
    pricingKey: "cv_parse",
    taskType: "cv_parse",
    label: "AI CV Parser",
    description: "Extract structured profile, experience, skills, and uncertain fields from CV.",
    creditCost: 1,
    sortOrder: 10,
  },
  {
    pricingKey: "job_match",
    taskType: "job_match",
    label: "Job Matching",
    description: "Compare Master Career Profile and optional CV against a job description.",
    creditCost: 1,
    sortOrder: 20,
  },
  {
    pricingKey: "cv_evaluate_basic",
    taskType: "cv_evaluate",
    label: "Basic CV Evaluation",
    description: "Quick structural and readability evaluation from Master Profile.",
    creditCost: 2,
    sortOrder: 30,
  },
  {
    pricingKey: "cv_evaluate_detailed",
    taskType: "cv_evaluate",
    label: "Detailed CV Evaluation",
    description: "10-dimension ATS, keyword, evidence, and CV document audit.",
    creditCost: 3,
    sortOrder: 40,
  },
  {
    pricingKey: "cv_correction",
    taskType: "cv_correction",
    label: "CV Correction",
    description: "Before-and-after wording, grammar, hierarchy, and keyword edits.",
    creditCost: 3,
    sortOrder: 50,
  },
  {
    pricingKey: "cover_letter",
    taskType: "cv_generate",
    label: "Cover Letter Drafting",
    description: "Grounded job-specific cover letter draft from verified profile.",
    creditCost: 2,
    sortOrder: 60,
  },
  {
    pricingKey: "cv_generate",
    taskType: "cv_generate",
    label: "CV Generator",
    description: "Generate Indonesian CV or International Resume template with PDF/DOCX export.",
    creditCost: 4,
    sortOrder: 70,
  },
  {
    pricingKey: "cv_generate_job_optimized",
    taskType: "cv_generate",
    label: "Job-Specific CV Optimization",
    description: "Generate CV tailored to a specific target vacancy plus grounded cover letter.",
    creditCost: 5,
    sortOrder: 80,
  },
  {
    pricingKey: "skill_gap",
    taskType: "skill_gap",
    label: "Skill Gap Analysis",
    description: "Identify matched, transferable, and missing skills vs target requirements.",
    creditCost: 3,
    sortOrder: 90,
  },
  {
    pricingKey: "career_roadmap",
    taskType: "career_roadmap",
    label: "Career Roadmap",
    description: "6-month and 12-month career roadmap grounded in profile and application history.",
    creditCost: 5,
    sortOrder: 100,
  },
  {
    pricingKey: "interview_coach",
    taskType: "interview_coach",
    label: "Interview Simulation",
    description: "Role-specific interview questions and STAR hints anchored to verified history.",
    creditCost: 3,
    sortOrder: 110,
  },
];

export const DEFAULT_PRICING_KEY_BY_TASK: Record<AiTaskType, string> = {
  cv_parse: "cv_parse",
  cv_evaluate: "cv_evaluate_detailed",
  job_match: "job_match",
  cv_correction: "cv_correction",
  cv_generate: "cv_generate",
  skill_gap: "skill_gap",
  career_roadmap: "career_roadmap",
  interview_coach: "interview_coach",
};

export interface DefaultCreditPackageSeed {
  packageKey: string;
  name: string;
  description: string;
  credits: number;
  bonusCredits: number;
  priceIdr: number;
  priceUsdCents: number;
  badgeText: string | null;
  isPopular: boolean;
  sortOrder: number;
}

export const DEFAULT_CREDIT_PACKAGES: DefaultCreditPackageSeed[] = [
  {
    packageKey: "starter_50",
    name: "Starter Pack",
    description: "Ideal for focused applications: CV evaluations, job matches, and tailoring.",
    credits: 50,
    bonusCredits: 0,
    priceIdr: 49_000,
    priceUsdCents: 350,
    badgeText: null,
    isPopular: false,
    sortOrder: 10,
  },
  {
    packageKey: "growth_150",
    name: "Job Seeker Pro",
    description: "Best value for active multi-company campaigns with CV Studio & Roadmaps.",
    credits: 150,
    bonusCredits: 25,
    priceIdr: 129_000,
    priceUsdCents: 900,
    badgeText: "+25 Bonus Credits",
    isPopular: true,
    sortOrder: 20,
  },
  {
    packageKey: "intensive_400",
    name: "Career Accelerator",
    description: "High-volume credit pack for career pivots, coaching, and portfolio CVs.",
    credits: 400,
    bonusCredits: 80,
    priceIdr: 299_000,
    priceUsdCents: 1900,
    badgeText: "+80 Bonus Credits",
    isPopular: false,
    sortOrder: 30,
  },
];
