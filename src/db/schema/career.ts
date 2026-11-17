import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CvImportDraftPayload } from "@/lib/domain/career-profile";
import { documentVersions } from "./applications";
import { timestamps, userId } from "./core";
import {
  careerLevelEnum,
  educationLevelEnum,
  employmentTypeEnum,
  profileDataSourceEnum,
  salaryPeriodEnum,
  skillCategoryEnum,
  skillProficiencyEnum,
  verificationStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// 1. Master Career Profile (1:1 per user)
// ---------------------------------------------------------------------------
export const careerProfiles = pgTable(
  "career_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    // Professional Information
    fullName: text("full_name").notNull(),
    headline: text("headline"),
    summary: text("summary"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    githubUrl: text("github_url"),
    location: text("location"),
    country: text("country").default("Indonesia"),
    preferredLanguage: text("preferred_language").notNull().default("id-ID"),
    careerLevel: careerLevelEnum("career_level"),
    totalExperienceYears: smallint("total_experience_years"),
    // Career Preferences
    targetPositions: text("target_positions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    targetIndustries: text("target_industries")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    preferredLocations: text("preferred_locations")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    preferredArrangements: text("preferred_arrangements")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    salaryCurrency: text("salary_currency").notNull().default("IDR"),
    expectedSalaryMin: bigint("expected_salary_min", { mode: "number" }),
    expectedSalaryMax: bigint("expected_salary_max", { mode: "number" }),
    salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("month"),
    // Verification & CV Import Staging
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    pendingReviewPayload: jsonb("pending_review_payload").$type<
      CvImportDraftPayload | null
    >(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("career_profiles_id_user_uq").on(t.id, t.userId),
    uniqueIndex("career_profiles_user_uq").on(t.userId),
    check(
      "career_profiles_exp_ck",
      sql`${t.totalExperienceYears} is null or ${t.totalExperienceYears} between 0 and 60`,
    ),
    check(
      "career_profiles_salary_ck",
      sql`${t.expectedSalaryMin} is null or ${t.expectedSalaryMax} is null or ${t.expectedSalaryMin} <= ${t.expectedSalaryMax}`,
    ),
    check(
      "career_profiles_salary_nonneg_ck",
      sql`coalesce(${t.expectedSalaryMin}, 0) >= 0 and coalesce(${t.expectedSalaryMax}, 0) >= 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 2. Work Experience
// ---------------------------------------------------------------------------
export const careerExperiences = pgTable(
  "career_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    profileId: uuid("profile_id").notNull(),
    companyName: text("company_name").notNull(),
    jobTitle: text("job_title").notNull(),
    employmentType: employmentTypeEnum("employment_type")
      .notNull()
      .default("full_time"),
    location: text("location"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    isCurrent: boolean("is_current").notNull().default(false),
    responsibilities: text("responsibilities"),
    achievements: text("achievements")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "career_experiences_profile_fk",
      columns: [t.profileId, t.userId],
      foreignColumns: [careerProfiles.id, careerProfiles.userId],
    }).onDelete("cascade"),
    index("career_experiences_user_profile_idx").on(
      t.userId,
      t.profileId,
      t.startDate,
    ),
    check(
      "career_experiences_dates_ck",
      sql`(${t.isCurrent} = false or ${t.endDate} is null) and (${t.endDate} is null or ${t.endDate} >= ${t.startDate})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 3. Education
// ---------------------------------------------------------------------------
export const careerEducations = pgTable(
  "career_educations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    profileId: uuid("profile_id").notNull(),
    institution: text("institution").notNull(),
    qualification: educationLevelEnum("qualification")
      .notNull()
      .default("bachelor"),
    degreeTitle: text("degree_title"),
    fieldOfStudy: text("field_of_study"),
    graduationYear: smallint("graduation_year"),
    gpa: text("gpa"),
    notes: text("notes"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "career_educations_profile_fk",
      columns: [t.profileId, t.userId],
      foreignColumns: [careerProfiles.id, careerProfiles.userId],
    }).onDelete("cascade"),
    index("career_educations_user_profile_idx").on(
      t.userId,
      t.profileId,
      t.graduationYear,
    ),
    check(
      "career_educations_year_ck",
      sql`${t.graduationYear} is null or ${t.graduationYear} between 1950 and 2100`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4. Skills
// ---------------------------------------------------------------------------
export const careerSkills = pgTable(
  "career_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    profileId: uuid("profile_id").notNull(),
    skillName: text("skill_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    category: skillCategoryEnum("category").notNull().default("technical"),
    proficiencyLevel: skillProficiencyEnum("proficiency_level")
      .notNull()
      .default("intermediate"),
    yearsOfExperience: smallint("years_of_experience"),
    evidence: text("evidence"),
    isUserVerified: boolean("is_user_verified").notNull().default(true),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("career_skills_profile_norm_uq").on(
      t.profileId,
      t.normalizedName,
    ),
    foreignKey({
      name: "career_skills_profile_fk",
      columns: [t.profileId, t.userId],
      foreignColumns: [careerProfiles.id, careerProfiles.userId],
    }).onDelete("cascade"),
    index("career_skills_user_cat_idx").on(t.userId, t.category),
    check(
      "career_skills_years_ck",
      sql`${t.yearsOfExperience} is null or ${t.yearsOfExperience} between 0 and 60`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 5. Certifications
// ---------------------------------------------------------------------------
export const careerCertifications = pgTable(
  "career_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    profileId: uuid("profile_id").notNull(),
    name: text("name").notNull(),
    issuingOrganization: text("issuing_organization").notNull(),
    issueDate: date("issue_date", { mode: "string" }),
    expirationDate: date("expiration_date", { mode: "string" }),
    credentialId: text("credential_id"),
    credentialUrl: text("credential_url"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "career_certifications_profile_fk",
      columns: [t.profileId, t.userId],
      foreignColumns: [careerProfiles.id, careerProfiles.userId],
    }).onDelete("cascade"),
    index("career_certifications_user_profile_idx").on(
      t.userId,
      t.profileId,
      t.issueDate,
    ),
    check(
      "career_certifications_dates_ck",
      sql`${t.issueDate} is null or ${t.expirationDate} is null or ${t.expirationDate} >= ${t.issueDate}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 6. Projects
// ---------------------------------------------------------------------------
export const careerProjects = pgTable(
  "career_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    profileId: uuid("profile_id").notNull(),
    name: text("name").notNull(),
    organization: text("organization"),
    role: text("role"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    isOngoing: boolean("is_ongoing").notNull().default(false),
    description: text("description"),
    achievements: text("achievements")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    technologies: text("technologies")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    projectUrl: text("project_url"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("verified"),
    source: profileDataSourceEnum("source").notNull().default("manual"),
    sourceDocumentVersionId: uuid("source_document_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "career_projects_profile_fk",
      columns: [t.profileId, t.userId],
      foreignColumns: [careerProfiles.id, careerProfiles.userId],
    }).onDelete("cascade"),
    index("career_projects_user_profile_idx").on(
      t.userId,
      t.profileId,
      t.startDate,
    ),
    check(
      "career_projects_dates_ck",
      sql`(${t.isOngoing} = false or ${t.endDate} is null) and (${t.startDate} is null or ${t.endDate} is null or ${t.endDate} >= ${t.startDate})`,
    ),
  ],
);
