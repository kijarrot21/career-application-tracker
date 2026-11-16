/**
 * Job suitability evaluation. Six criteria scored 0-100 and combined with
 * user-configurable weights. Suggestions are derived from the user's profile
 * and always come with a reason. Missing data is "Not rated", never guessed.
 */

export const CRITERIA = [
  "skills",
  "experience",
  "education",
  "salary",
  "location",
  "growth",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_LABELS: Record<Criterion, string> = {
  skills: "Skills Compatibility",
  experience: "Experience Compatibility",
  education: "Educational Requirements",
  salary: "Salary Compatibility",
  location: "Location Compatibility",
  growth: "Career Growth Potential",
};

export type Weights = Record<Criterion, number>;
export const DEFAULT_WEIGHTS: Weights = {
  skills: 25,
  experience: 20,
  salary: 20,
  growth: 15,
  education: 10,
  location: 10,
};

export type Scores = Partial<Record<Criterion, number | null>>;

export const EDUCATION_LEVELS = [
  "none",
  "high_school",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  none: "No requirement",
  high_school: "High School (SMA/SMK)",
  diploma: "Diploma (D3/D4)",
  bachelor: "Bachelor (S1)",
  master: "Master (S2)",
  doctorate: "Doctorate (S3)",
};

export type WorkArrangement = "onsite" | "hybrid" | "remote";

export interface VacancyForScoring {
  skills: string[];
  requiredExperienceYears: number | null;
  requiredEducation: EducationLevel | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  location: string | null;
  workArrangement: WorkArrangement | null;
}

export interface ProfileForScoring {
  skills: string[];
  yearsExperience: number | null;
  educationLevel: EducationLevel | null;
  expectedSalaryMin: number | null;
  currency: string;
  preferredLocations: string[];
  preferredArrangements: WorkArrangement[];
}

export interface Suggestion {
  score: number | null;
  reason: string;
}

const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  reactjs: "react",
  "react.js": "react",
  nextjs: "next.js",
  next: "next.js",
  node: "node.js",
  nodejs: "node.js",
  vuejs: "vue",
  "vue.js": "vue",
  postgres: "postgresql",
  psql: "postgresql",
  "ms excel": "excel",
  "microsoft excel": "excel",
  gcp: "google cloud",
  "amazon web services": "aws",
  k8s: "kubernetes",
  golang: "go",
  py: "python",
  "c sharp": "c#",
  csharp: "c#",
  ml: "machine learning",
  hris: "hris",
  "talent acquisition": "recruitment",
  recruiting: "recruitment",
};

export function normalizeSkill(skill: string): string {
  const s = skill.trim().toLowerCase().replace(/\s+/g, " ");
  return SKILL_ALIASES[s] ?? s;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function suggestSkills(required: string[], have: string[]): Suggestion {
  const req = [...new Set(required.map(normalizeSkill).filter(Boolean))];
  if (req.length === 0) return { score: null, reason: "No required skills listed on the vacancy." };
  if (have.length === 0) return { score: null, reason: "Add your skills in Settings > Profile to get a suggestion." };
  const haveSet = new Set(have.map(normalizeSkill));
  const matched = req.filter((s) => haveSet.has(s));
  const missing = req.filter((s) => !haveSet.has(s));
  const score = clamp((matched.length / req.length) * 100);
  const parts = [`${matched.length} of ${req.length} skills matched`];
  if (matched.length) parts.push(`matched: ${matched.slice(0, 5).join(", ")}`);
  if (missing.length) parts.push(`missing: ${missing.slice(0, 5).join(", ")}`);
  return { score, reason: parts.join("; ") + "." };
}

export function suggestExperience(required: number | null, have: number | null): Suggestion {
  if (required === null || required <= 0) return { score: 100, reason: "No minimum experience required." };
  if (have === null) return { score: null, reason: "Add your years of experience in Settings > Profile." };
  if (have >= required) return { score: 100, reason: `You have ${have} years; ${required} required.` };
  return { score: clamp((have / required) * 100), reason: `You have ${have} years; ${required} required.` };
}

export function suggestEducation(required: EducationLevel | null, have: EducationLevel | null): Suggestion {
  if (!required || required === "none") return { score: 100, reason: "No education requirement." };
  if (!have) return { score: null, reason: "Add your education level in Settings > Profile." };
  const gap = EDUCATION_LEVELS.indexOf(required) - EDUCATION_LEVELS.indexOf(have);
  if (gap <= 0) return { score: 100, reason: `Meets requirement (${EDUCATION_LABELS[required]}).` };
  if (gap === 1) return { score: 60, reason: `One level below requirement (${EDUCATION_LABELS[required]}).` };
  return { score: 20, reason: `Below requirement (${EDUCATION_LABELS[required]}).` };
}

export function suggestSalary(
  vacancy: Pick<VacancyForScoring, "salaryMin" | "salaryMax" | "currency">,
  profile: Pick<ProfileForScoring, "expectedSalaryMin" | "currency">,
): Suggestion {
  const top = vacancy.salaryMax ?? vacancy.salaryMin;
  if (top === null) return { score: null, reason: "Salary not disclosed on the vacancy." };
  if (profile.expectedSalaryMin === null || profile.expectedSalaryMin <= 0) {
    return { score: null, reason: "Add your expected salary in Settings > Profile." };
  }
  if (vacancy.currency !== profile.currency) {
    return { score: null, reason: `Vacancy is in ${vacancy.currency}; your expectation is in ${profile.currency}.` };
  }
  if (top >= profile.expectedSalaryMin) {
    return { score: 100, reason: "Vacancy range reaches your minimum expectation." };
  }
  const pct = clamp((top / profile.expectedSalaryMin) * 100);
  return { score: pct, reason: `Vacancy top is ${pct}% of your minimum expectation.` };
}

export function suggestLocation(
  vacancy: Pick<VacancyForScoring, "location" | "workArrangement">,
  profile: Pick<ProfileForScoring, "preferredLocations" | "preferredArrangements">,
): Suggestion {
  const prefsLoc = profile.preferredLocations.map((l) => l.trim().toLowerCase()).filter(Boolean);
  const prefsArr = profile.preferredArrangements;
  if (prefsLoc.length === 0 && prefsArr.length === 0) {
    return { score: null, reason: "Add preferred locations or work arrangements in Settings > Profile." };
  }
  const arrangement = vacancy.workArrangement;
  if (arrangement === "remote" && prefsArr.includes("remote")) {
    return { score: 100, reason: "Remote role and you accept remote work." };
  }
  const loc = (vacancy.location ?? "").toLowerCase();
  const cityMatch = loc !== "" && prefsLoc.some((p) => loc.includes(p) || p.includes(loc));
  const arrangementOk = !arrangement || prefsArr.length === 0 || prefsArr.includes(arrangement);
  if (cityMatch && arrangementOk) return { score: 100, reason: "Location and arrangement match your preferences." };
  if (cityMatch) return { score: 60, reason: `Location matches but ${arrangement} is not a preferred arrangement.` };
  if (arrangementOk && arrangement === "remote") return { score: 80, reason: "Remote role." };
  return { score: 30, reason: "Location is outside your preferred locations." };
}

export function suggestScores(
  vacancy: VacancyForScoring,
  profile: ProfileForScoring,
): Record<Criterion, Suggestion> {
  return {
    skills: suggestSkills(vacancy.skills, profile.skills),
    experience: suggestExperience(vacancy.requiredExperienceYears, profile.yearsExperience),
    education: suggestEducation(vacancy.requiredEducation, profile.educationLevel),
    salary: suggestSalary(vacancy, profile),
    location: suggestLocation(vacancy, profile),
    growth: { score: null, reason: "Rate career growth potential manually." },
  };
}

/**
 * Weighted average of rated criteria. Criteria that are null/undefined or
 * have zero weight are excluded. Returns null if nothing is rated.
 */
export function overallScore(scores: Scores, weights: Weights = DEFAULT_WEIGHTS): number | null {
  let total = 0;
  let weightSum = 0;
  for (const c of CRITERIA) {
    const s = scores[c];
    const w = weights[c] ?? 0;
    if (s === null || s === undefined || w <= 0) continue;
    total += clamp(s) * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;
  return Math.round(total / weightSum);
}

export function scoreBand(score: number | null): "none" | "low" | "medium" | "high" {
  if (score === null) return "none";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
