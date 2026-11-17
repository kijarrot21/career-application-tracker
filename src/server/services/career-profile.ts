import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  careerCertifications,
  careerEducations,
  careerExperiences,
  careerProfiles,
  careerProjects,
  careerSkills,
  documents,
  documentVersions,
  user,
  userSettings,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  SALARY_PERIODS,
  WORK_ARRANGEMENTS,
} from "@/lib/constants";
import {
  CAREER_LEVELS,
  SKILL_CATEGORIES,
  SKILL_PROFICIENCIES,
  validateDateRange,
  type CvImportDraftPayload,
} from "@/lib/domain/career-profile";
import { EDUCATION_LEVELS, normalizeSkill } from "@/lib/domain/suitability";

const optionalHttpUrl = z
  .string()
  .trim()
  .max(400)
  .optional()
  .nullable()
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "URL must start with http:// or https://",
  );

const optionalIsoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .optional()
  .nullable();

export class VerifiedCareerDataProtectedError extends Error {
  constructor(message = "Verified career records cannot be overwritten automatically without explicit user review.") {
    super(message);
    this.name = "VerifiedCareerDataProtectedError";
  }
}

export async function ensureCareerProfile(userId: string) {
  const db = await ensureDbReady();
  const [existing] = await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [accountUser] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!accountUser) {
    throw new Error("User account not found.");
  }

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const [created] = await db
    .insert(careerProfiles)
    .values({
      userId,
      fullName: accountUser.name,
      headline: settings?.headline ?? null,
      contactEmail: accountUser.email,
      country: "Indonesia",
      preferredLanguage: "id-ID",
      totalExperienceYears: settings?.yearsExperience ?? null,
      preferredLocations: settings?.preferredLocations ?? [],
      preferredArrangements: settings?.preferredArrangements ?? [],
      salaryCurrency: settings?.currency ?? "IDR",
      expectedSalaryMin: settings?.expectedSalaryMin ?? null,
      expectedSalaryMax: settings?.expectedSalaryMax ?? null,
      verificationStatus: "verified",
      source: "manual",
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    if (settings?.skills && settings.skills.length > 0) {
      for (const skillName of settings.skills) {
        const trimmed = skillName.trim();
        if (!trimmed) continue;
        await db
          .insert(careerSkills)
          .values({
            userId,
            profileId: created.id,
            skillName: trimmed,
            normalizedName: normalizeSkill(trimmed),
            category: "technical",
            proficiencyLevel: "intermediate",
            isUserVerified: true,
            verificationStatus: "verified",
            source: "manual",
          })
          .onConflictDoNothing();
      }
    }
    return created;
  }

  const [fallback] = await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId))
    .limit(1);
  return fallback;
}

async function syncVerifiedSkillsToSettings(userId: string, profileId: string) {
  const db = await ensureDbReady();
  const skills = await db
    .select({
      skillName: careerSkills.skillName,
      isUserVerified: careerSkills.isUserVerified,
      verificationStatus: careerSkills.verificationStatus,
    })
    .from(careerSkills)
    .where(
      and(
        eq(careerSkills.userId, userId),
        eq(careerSkills.profileId, profileId),
      ),
    )
    .orderBy(asc(careerSkills.skillName));

  const verifiedNames = skills
    .filter((s) => s.isUserVerified && s.verificationStatus === "verified")
    .map((s) => s.skillName);

  await db
    .update(userSettings)
    .set({ skills: verifiedNames, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
}

const EDUCATION_RANK: Record<(typeof EDUCATION_LEVELS)[number], number> = {
  none: 0,
  high_school: 1,
  diploma: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

async function syncHighestEducationToSettings(userId: string, profileId: string) {
  const db = await ensureDbReady();
  const rows = await db
    .select({ qualification: careerEducations.qualification })
    .from(careerEducations)
    .where(
      and(
        eq(careerEducations.userId, userId),
        eq(careerEducations.profileId, profileId),
      ),
    );

  let highest: (typeof EDUCATION_LEVELS)[number] | null = null;
  let bestRank = -1;
  for (const r of rows) {
    const rank = EDUCATION_RANK[r.qualification] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      highest = r.qualification;
    }
  }

  await db
    .update(userSettings)
    .set({ educationLevel: highest, updatedAt: new Date() })
    .where(eq(userSettings.userId, userId));
}

// ---------------------------------------------------------------------------
// 1 & 2. Professional Info + Career Preferences
// ---------------------------------------------------------------------------
export const careerProfileSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required").max(160),
    headline: z.string().trim().max(200).optional().nullable(),
    summary: z.string().trim().max(6000).optional().nullable(),
    contactEmail: z.string().trim().email("Invalid email").max(180).optional().nullable().or(z.literal("")),
    contactPhone: z.string().trim().max(60).optional().nullable(),
    linkedinUrl: optionalHttpUrl,
    portfolioUrl: optionalHttpUrl,
    githubUrl: optionalHttpUrl,
    location: z.string().trim().max(160).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    preferredLanguage: z.string().trim().min(2).max(32).default("id-ID"),
    careerLevel: z.enum(CAREER_LEVELS).optional().nullable(),
    totalExperienceYears: z.number().int().min(0).max(60).optional().nullable(),
    targetPositions: z.array(z.string().trim().min(1).max(120)).default([]),
    targetIndustries: z.array(z.string().trim().min(1).max(120)).default([]),
    preferredLocations: z.array(z.string().trim().min(1).max(120)).default([]),
    preferredArrangements: z.array(z.enum(WORK_ARRANGEMENTS)).default([]),
    salaryCurrency: z.enum(CURRENCIES).default("IDR"),
    expectedSalaryMin: z.number().int().nonnegative().optional().nullable(),
    expectedSalaryMax: z.number().int().nonnegative().optional().nullable(),
    salaryPeriod: z.enum(SALARY_PERIODS).default("month"),
    syncToSuitabilitySettings: z.boolean().default(true),
  })
  .refine(
    (d) =>
      d.expectedSalaryMin == null ||
      d.expectedSalaryMax == null ||
      d.expectedSalaryMin <= d.expectedSalaryMax,
    {
      message: "Minimum salary expectation cannot exceed maximum salary.",
      path: ["expectedSalaryMax"],
    },
  );

export async function upsertCareerProfileService(
  userId: string,
  rawInput: z.infer<typeof careerProfileSchema>,
) {
  const input = careerProfileSchema.parse(rawInput);
  const db = await ensureDbReady();
  const existing = await ensureCareerProfile(userId);

  const [updated] = await db
    .update(careerProfiles)
    .set({
      fullName: input.fullName,
      headline: input.headline || null,
      summary: input.summary || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      linkedinUrl: input.linkedinUrl || null,
      portfolioUrl: input.portfolioUrl || null,
      githubUrl: input.githubUrl || null,
      location: input.location || null,
      country: input.country || null,
      preferredLanguage: input.preferredLanguage,
      careerLevel: input.careerLevel ?? null,
      totalExperienceYears: input.totalExperienceYears ?? null,
      targetPositions: input.targetPositions,
      targetIndustries: input.targetIndustries,
      preferredLocations: input.preferredLocations,
      preferredArrangements: input.preferredArrangements,
      salaryCurrency: input.salaryCurrency,
      expectedSalaryMin: input.expectedSalaryMin ?? null,
      expectedSalaryMax: input.expectedSalaryMax ?? null,
      salaryPeriod: input.salaryPeriod,
      verificationStatus: "verified",
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(careerProfiles.id, existing.id),
        eq(careerProfiles.userId, userId),
      ),
    )
    .returning();

  if (input.syncToSuitabilitySettings) {
    await db
      .update(userSettings)
      .set({
        headline: input.headline || null,
        yearsExperience: input.totalExperienceYears ?? null,
        expectedSalaryMin: input.expectedSalaryMin ?? null,
        expectedSalaryMax: input.expectedSalaryMax ?? null,
        preferredLocations: input.preferredLocations,
        preferredArrangements: input.preferredArrangements,
        currency: input.salaryCurrency,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  }

  await writeAudit(db, {
    userId,
    entityType: "career_profile",
    entityId: updated.id,
    action: "update",
    summary: `Updated Master Career Profile for ${updated.fullName}`,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 3. Work Experience CRUD
// ---------------------------------------------------------------------------
export const careerExperienceSchema = z.object({
  id: z.string().uuid().optional(),
  companyName: z.string().trim().min(1, "Company name is required").max(160),
  jobTitle: z.string().trim().min(1, "Job title is required").max(160),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  location: z.string().trim().max(160).optional().nullable(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required (YYYY-MM-DD)"),
  endDate: optionalIsoDate,
  isCurrent: z.boolean().default(false),
  responsibilities: z.string().trim().max(8000).optional().nullable(),
  achievements: z.array(z.string().trim().min(1).max(600)).default([]),
});

export async function saveCareerExperienceService(
  userId: string,
  rawInput: z.input<typeof careerExperienceSchema>,
  options: { actorMode?: "manual" | "import" | "ai" } = {},
) {
  const input = careerExperienceSchema.parse(rawInput);
  const rawEndDate = input.endDate || null;

  const dateErr = validateDateRange({
    startDate: input.startDate,
    endDate: rawEndDate,
    isCurrentOrOngoing: input.isCurrent,
  });
  if (dateErr) throw new Error(dateErr);
  const normalizedEndDate = input.isCurrent ? null : rawEndDate;

  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  if (input.id) {
    const [existing] = await db
      .select()
      .from(careerExperiences)
      .where(
        and(
          eq(careerExperiences.id, input.id),
          eq(careerExperiences.userId, userId),
        ),
      );
    if (!existing) throw new Error("Experience record not found.");

    if (
      options.actorMode &&
      options.actorMode !== "manual" &&
      existing.verificationStatus === "verified"
    ) {
      throw new VerifiedCareerDataProtectedError();
    }

    const [updated] = await db
      .update(careerExperiences)
      .set({
        companyName: input.companyName,
        jobTitle: input.jobTitle,
        employmentType: input.employmentType,
        location: input.location || null,
        startDate: input.startDate,
        endDate: normalizedEndDate,
        isCurrent: input.isCurrent,
        responsibilities: input.responsibilities || null,
        achievements: input.achievements,
        verificationStatus: "verified",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(careerExperiences.id, input.id),
          eq(careerExperiences.userId, userId),
        ),
      )
      .returning();

    await writeAudit(db, {
      userId,
      entityType: "career_experience",
      entityId: updated.id,
      action: "update",
      summary: `Updated work experience: ${updated.jobTitle} at ${updated.companyName}`,
    });

    return updated;
  }

  const [created] = await db
    .insert(careerExperiences)
    .values({
      userId,
      profileId: profile.id,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      employmentType: input.employmentType,
      location: input.location || null,
      startDate: input.startDate,
      endDate: normalizedEndDate,
      isCurrent: input.isCurrent,
      responsibilities: input.responsibilities || null,
      achievements: input.achievements,
      verificationStatus: "verified",
      source: "manual",
    })
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "career_experience",
    entityId: created.id,
    action: "create",
    summary: `Added work experience: ${created.jobTitle} at ${created.companyName}`,
  });

  return created;
}

export async function deleteCareerExperienceService(
  userId: string,
  experienceId: string,
) {
  const id = z.string().uuid().parse(experienceId);
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(careerExperiences)
    .where(
      and(eq(careerExperiences.id, id), eq(careerExperiences.userId, userId)),
    )
    .returning();
  if (!deleted) throw new Error("Experience record not found.");

  await writeAudit(db, {
    userId,
    entityType: "career_experience",
    entityId: id,
    action: "delete",
    summary: `Deleted work experience: ${deleted.jobTitle} at ${deleted.companyName}`,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// 4. Education CRUD
// ---------------------------------------------------------------------------
export const careerEducationSchema = z.object({
  id: z.string().uuid().optional(),
  institution: z.string().trim().min(1, "Institution name is required").max(200),
  qualification: z.enum(EDUCATION_LEVELS).default("bachelor"),
  degreeTitle: z.string().trim().max(160).optional().nullable(),
  fieldOfStudy: z.string().trim().max(160).optional().nullable(),
  graduationYear: z
    .number()
    .int()
    .min(1950, "Graduation year must be >= 1950")
    .max(2100, "Graduation year must be <= 2100")
    .optional()
    .nullable(),
  gpa: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function saveCareerEducationService(
  userId: string,
  rawInput: z.infer<typeof careerEducationSchema>,
) {
  const input = careerEducationSchema.parse(rawInput);
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  if (input.id) {
    const [updated] = await db
      .update(careerEducations)
      .set({
        institution: input.institution,
        qualification: input.qualification,
        degreeTitle: input.degreeTitle || null,
        fieldOfStudy: input.fieldOfStudy || null,
        graduationYear: input.graduationYear ?? null,
        gpa: input.gpa || null,
        notes: input.notes || null,
        verificationStatus: "verified",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(careerEducations.id, input.id),
          eq(careerEducations.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Education record not found.");

    await syncHighestEducationToSettings(userId, updated.profileId);
    await writeAudit(db, {
      userId,
      entityType: "career_education",
      entityId: updated.id,
      action: "update",
      summary: `Updated education: ${updated.institution}`,
    });
    return updated;
  }

  const [created] = await db
    .insert(careerEducations)
    .values({
      userId,
      profileId: profile.id,
      institution: input.institution,
      qualification: input.qualification,
      degreeTitle: input.degreeTitle || null,
      fieldOfStudy: input.fieldOfStudy || null,
      graduationYear: input.graduationYear ?? null,
      gpa: input.gpa || null,
      notes: input.notes || null,
      verificationStatus: "verified",
      source: "manual",
    })
    .returning();

  await syncHighestEducationToSettings(userId, profile.id);
  await writeAudit(db, {
    userId,
    entityType: "career_education",
    entityId: created.id,
    action: "create",
    summary: `Added education: ${created.institution}`,
  });

  return created;
}

export async function deleteCareerEducationService(
  userId: string,
  educationId: string,
) {
  const id = z.string().uuid().parse(educationId);
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(careerEducations)
    .where(
      and(eq(careerEducations.id, id), eq(careerEducations.userId, userId)),
    )
    .returning();
  if (!deleted) throw new Error("Education record not found.");

  await syncHighestEducationToSettings(userId, deleted.profileId);
  await writeAudit(db, {
    userId,
    entityType: "career_education",
    entityId: id,
    action: "delete",
    summary: `Deleted education: ${deleted.institution}`,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// 5. Skills CRUD
// ---------------------------------------------------------------------------
export const careerSkillSchema = z.object({
  id: z.string().uuid().optional(),
  skillName: z.string().trim().min(1, "Skill name is required").max(100),
  category: z.enum(SKILL_CATEGORIES).default("technical"),
  proficiencyLevel: z.enum(SKILL_PROFICIENCIES).default("intermediate"),
  yearsOfExperience: z.number().int().min(0).max(60).optional().nullable(),
  evidence: z.string().trim().max(1000).optional().nullable(),
  isUserVerified: z.boolean().default(true),
});

export async function saveCareerSkillService(
  userId: string,
  rawInput: z.infer<typeof careerSkillSchema>,
) {
  const input = careerSkillSchema.parse(rawInput);
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);
  const norm = normalizeSkill(input.skillName);

  const verificationStatus = input.isUserVerified ? "verified" : "unverified";

  if (input.id) {
    const [dup] = await db
      .select({ id: careerSkills.id })
      .from(careerSkills)
      .where(
        and(
          eq(careerSkills.profileId, profile.id),
          eq(careerSkills.normalizedName, norm),
        ),
      )
      .limit(1);
    if (dup && dup.id !== input.id) {
      throw new Error(`Skill "${input.skillName}" already exists in your profile.`);
    }

    const [updated] = await db
      .update(careerSkills)
      .set({
        skillName: input.skillName,
        normalizedName: norm,
        category: input.category,
        proficiencyLevel: input.proficiencyLevel,
        yearsOfExperience: input.yearsOfExperience ?? null,
        evidence: input.evidence || null,
        isUserVerified: input.isUserVerified,
        verificationStatus,
        updatedAt: new Date(),
      })
      .where(
        and(eq(careerSkills.id, input.id), eq(careerSkills.userId, userId)),
      )
      .returning();
    if (!updated) throw new Error("Skill record not found.");

    await syncVerifiedSkillsToSettings(userId, profile.id);
    await writeAudit(db, {
      userId,
      entityType: "career_skill",
      entityId: updated.id,
      action: "update",
      summary: `Updated skill: ${updated.skillName}`,
    });
    return updated;
  }

  const [dup] = await db
    .select({ id: careerSkills.id })
    .from(careerSkills)
    .where(
      and(
        eq(careerSkills.profileId, profile.id),
        eq(careerSkills.normalizedName, norm),
      ),
    )
    .limit(1);
  if (dup) {
    throw new Error(`Skill "${input.skillName}" already exists in your profile.`);
  }

  const [created] = await db
    .insert(careerSkills)
    .values({
      userId,
      profileId: profile.id,
      skillName: input.skillName,
      normalizedName: norm,
      category: input.category,
      proficiencyLevel: input.proficiencyLevel,
      yearsOfExperience: input.yearsOfExperience ?? null,
      evidence: input.evidence || null,
      isUserVerified: input.isUserVerified,
      verificationStatus,
      source: "manual",
    })
    .returning();

  await syncVerifiedSkillsToSettings(userId, profile.id);
  await writeAudit(db, {
    userId,
    entityType: "career_skill",
    entityId: created.id,
    action: "create",
    summary: `Added skill: ${created.skillName}`,
  });

  return created;
}

export async function deleteCareerSkillService(
  userId: string,
  skillId: string,
) {
  const id = z.string().uuid().parse(skillId);
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(careerSkills)
    .where(and(eq(careerSkills.id, id), eq(careerSkills.userId, userId)))
    .returning();
  if (!deleted) throw new Error("Skill record not found.");

  await syncVerifiedSkillsToSettings(userId, deleted.profileId);
  await writeAudit(db, {
    userId,
    entityType: "career_skill",
    entityId: id,
    action: "delete",
    summary: `Deleted skill: ${deleted.skillName}`,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// 6. Certifications CRUD
// ---------------------------------------------------------------------------
export const careerCertificationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Certification name is required").max(200),
  issuingOrganization: z.string().trim().min(1, "Issuing organization is required").max(200),
  issueDate: optionalIsoDate,
  expirationDate: optionalIsoDate,
  credentialId: z.string().trim().max(120).optional().nullable(),
  credentialUrl: optionalHttpUrl,
});

export async function saveCareerCertificationService(
  userId: string,
  rawInput: z.infer<typeof careerCertificationSchema>,
) {
  const input = careerCertificationSchema.parse(rawInput);
  const dateErr = validateDateRange({
    startDate: input.issueDate ?? null,
    endDate: input.expirationDate ?? null,
    startLabel: "Issue date",
    endLabel: "Expiration date",
  });
  if (dateErr) throw new Error(dateErr);

  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  if (input.id) {
    const [updated] = await db
      .update(careerCertifications)
      .set({
        name: input.name,
        issuingOrganization: input.issuingOrganization,
        issueDate: input.issueDate || null,
        expirationDate: input.expirationDate || null,
        credentialId: input.credentialId || null,
        credentialUrl: input.credentialUrl || null,
        verificationStatus: "verified",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(careerCertifications.id, input.id),
          eq(careerCertifications.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Certification record not found.");

    await writeAudit(db, {
      userId,
      entityType: "career_certification",
      entityId: updated.id,
      action: "update",
      summary: `Updated certification: ${updated.name}`,
    });
    return updated;
  }

  const [created] = await db
    .insert(careerCertifications)
    .values({
      userId,
      profileId: profile.id,
      name: input.name,
      issuingOrganization: input.issuingOrganization,
      issueDate: input.issueDate || null,
      expirationDate: input.expirationDate || null,
      credentialId: input.credentialId || null,
      credentialUrl: input.credentialUrl || null,
      verificationStatus: "verified",
      source: "manual",
    })
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "career_certification",
    entityId: created.id,
    action: "create",
    summary: `Added certification: ${created.name}`,
  });

  return created;
}

export async function deleteCareerCertificationService(
  userId: string,
  certificationId: string,
) {
  const id = z.string().uuid().parse(certificationId);
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(careerCertifications)
    .where(
      and(
        eq(careerCertifications.id, id),
        eq(careerCertifications.userId, userId),
      ),
    )
    .returning();
  if (!deleted) throw new Error("Certification record not found.");

  await writeAudit(db, {
    userId,
    entityType: "career_certification",
    entityId: id,
    action: "delete",
    summary: `Deleted certification: ${deleted.name}`,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// 7. Projects CRUD
// ---------------------------------------------------------------------------
export const careerProjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Project name is required").max(200),
  organization: z.string().trim().max(160).optional().nullable(),
  role: z.string().trim().max(160).optional().nullable(),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  isOngoing: z.boolean().default(false),
  description: z.string().trim().max(6000).optional().nullable(),
  achievements: z.array(z.string().trim().min(1).max(600)).default([]),
  technologies: z.array(z.string().trim().min(1).max(80)).default([]),
  projectUrl: optionalHttpUrl,
});

export async function saveCareerProjectService(
  userId: string,
  rawInput: z.input<typeof careerProjectSchema>,
) {
  const input = careerProjectSchema.parse(rawInput);
  const rawEndDate = input.endDate || null;

  const dateErr = validateDateRange({
    startDate: input.startDate ?? null,
    endDate: rawEndDate,
    isCurrentOrOngoing: input.isOngoing,
  });
  if (dateErr) throw new Error(dateErr);
  const normalizedEndDate = input.isOngoing ? null : rawEndDate;

  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  if (input.id) {
    const [updated] = await db
      .update(careerProjects)
      .set({
        name: input.name,
        organization: input.organization || null,
        role: input.role || null,
        startDate: input.startDate || null,
        endDate: normalizedEndDate,
        isOngoing: input.isOngoing,
        description: input.description || null,
        achievements: input.achievements,
        technologies: input.technologies,
        projectUrl: input.projectUrl || null,
        verificationStatus: "verified",
        updatedAt: new Date(),
      })
      .where(
        and(eq(careerProjects.id, input.id), eq(careerProjects.userId, userId)),
      )
      .returning();
    if (!updated) throw new Error("Project record not found.");

    await writeAudit(db, {
      userId,
      entityType: "career_project",
      entityId: updated.id,
      action: "update",
      summary: `Updated project: ${updated.name}`,
    });
    return updated;
  }

  const [created] = await db
    .insert(careerProjects)
    .values({
      userId,
      profileId: profile.id,
      name: input.name,
      organization: input.organization || null,
      role: input.role || null,
      startDate: input.startDate || null,
      endDate: normalizedEndDate,
      isOngoing: input.isOngoing,
      description: input.description || null,
      achievements: input.achievements,
      technologies: input.technologies,
      projectUrl: input.projectUrl || null,
      verificationStatus: "verified",
      source: "manual",
    })
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "career_project",
    entityId: created.id,
    action: "create",
    summary: `Added project: ${created.name}`,
  });

  return created;
}

export async function deleteCareerProjectService(
  userId: string,
  projectId: string,
) {
  const id = z.string().uuid().parse(projectId);
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(careerProjects)
    .where(and(eq(careerProjects.id, id), eq(careerProjects.userId, userId)))
    .returning();
  if (!deleted) throw new Error("Project record not found.");

  await writeAudit(db, {
    userId,
    entityType: "career_project",
    entityId: id,
    action: "delete",
    summary: `Deleted project: ${deleted.name}`,
  });
  return deleted;
}

// ---------------------------------------------------------------------------
// 8. CV Import Integration Point (Staging -> Explicit Review -> Apply)
//    NEVER silently overwrites verified career data.
// ---------------------------------------------------------------------------
export const stageCvImportSchema = z.object({
  sourceDocumentVersionId: z.string().uuid().optional().nullable(),
  profilePatch: z
    .object({
      fullName: z.string().trim().max(160).optional().nullable(),
      headline: z.string().trim().max(200).optional().nullable(),
      summary: z.string().trim().max(6000).optional().nullable(),
      contactEmail: z.string().trim().max(180).optional().nullable(),
      contactPhone: z.string().trim().max(60).optional().nullable(),
      location: z.string().trim().max(160).optional().nullable(),
      country: z.string().trim().max(100).optional().nullable(),
      totalExperienceYears: z.number().int().min(0).max(60).optional().nullable(),
    })
    .optional(),
  experiences: z
    .array(
      z.object({
        tempId: z.string().trim().min(1),
        companyName: z.string().trim().min(1).max(160),
        jobTitle: z.string().trim().min(1).max(160),
        employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
        location: z.string().trim().max(160).optional().nullable(),
        startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: optionalIsoDate,
        isCurrent: z.boolean().optional(),
        responsibilities: z.string().trim().max(8000).optional().nullable(),
        achievements: z.array(z.string().trim().min(1).max(600)).optional(),
      }),
    )
    .optional(),
  educations: z
    .array(
      z.object({
        tempId: z.string().trim().min(1),
        institution: z.string().trim().min(1).max(200),
        qualification: z.enum(EDUCATION_LEVELS).optional(),
        degreeTitle: z.string().trim().max(160).optional().nullable(),
        fieldOfStudy: z.string().trim().max(160).optional().nullable(),
        graduationYear: z.number().int().min(1950).max(2100).optional().nullable(),
        gpa: z.string().trim().max(30).optional().nullable(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        tempId: z.string().trim().min(1),
        skillName: z.string().trim().min(1).max(100),
        category: z.enum(SKILL_CATEGORIES).optional(),
        proficiencyLevel: z.enum(SKILL_PROFICIENCIES).optional(),
        yearsOfExperience: z.number().int().min(0).max(60).optional().nullable(),
        evidence: z.string().trim().max(1000).optional().nullable(),
      }),
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        tempId: z.string().trim().min(1),
        name: z.string().trim().min(1).max(200),
        issuingOrganization: z.string().trim().min(1).max(200),
        issueDate: optionalIsoDate,
        expirationDate: optionalIsoDate,
        credentialId: z.string().trim().max(120).optional().nullable(),
        credentialUrl: optionalHttpUrl,
      }),
    )
    .optional(),
  projects: z
    .array(
      z.object({
        tempId: z.string().trim().min(1),
        name: z.string().trim().min(1).max(200),
        organization: z.string().trim().max(160).optional().nullable(),
        role: z.string().trim().max(160).optional().nullable(),
        startDate: optionalIsoDate,
        endDate: optionalIsoDate,
        isOngoing: z.boolean().optional(),
        description: z.string().trim().max(6000).optional().nullable(),
        achievements: z.array(z.string().trim().min(1).max(600)).optional(),
        technologies: z.array(z.string().trim().min(1).max(80)).optional(),
        projectUrl: optionalHttpUrl,
      }),
    )
    .optional(),
});

export async function stageCvImportReviewService(
  userId: string,
  rawInput: z.infer<typeof stageCvImportSchema>,
) {
  const input = stageCvImportSchema.parse(rawInput);
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  let docLabel: string | null = null;
  if (input.sourceDocumentVersionId) {
    const [ver] = await db
      .select({
        id: documentVersions.id,
        label: documentVersions.label,
        title: documents.title,
      })
      .from(documentVersions)
      .innerJoin(documents, eq(documentVersions.documentId, documents.id))
      .where(
        and(
          eq(documentVersions.id, input.sourceDocumentVersionId),
          eq(documentVersions.userId, userId),
        ),
      )
      .limit(1);
    if (!ver) {
      throw new Error("Selected CV document version not found.");
    }
    docLabel = `${ver.title} (${ver.label})`;
  }

  const payload: CvImportDraftPayload = {
    importedAt: new Date().toISOString(),
    sourceDocumentVersionId: input.sourceDocumentVersionId ?? null,
    sourceDocumentLabel: docLabel,
    profilePatch: input.profilePatch,
    experiences: input.experiences,
    educations: input.educations,
    skills: input.skills,
    certifications: input.certifications,
    projects: input.projects,
  };

  // Staging only updates `pendingReviewPayload`; verified records remain untouched!
  const [updated] = await db
    .update(careerProfiles)
    .set({
      pendingReviewPayload: payload,
      updatedAt: new Date(),
    })
    .where(
      and(eq(careerProfiles.id, profile.id), eq(careerProfiles.userId, userId)),
    )
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "career_profile",
    entityId: profile.id,
    action: "update",
    summary: `Staged CV import draft for user review${docLabel ? ` (${docLabel})` : ""}`,
  });

  return updated;
}

export const applyCvImportReviewSchema = z.object({
  acceptProfileFields: z
    .array(
      z.enum([
        "fullName",
        "headline",
        "summary",
        "contactEmail",
        "contactPhone",
        "location",
        "country",
        "totalExperienceYears",
      ]),
    )
    .default([]),
  acceptedExperienceIds: z.array(z.string()).default([]),
  acceptedEducationIds: z.array(z.string()).default([]),
  acceptedSkillIds: z.array(z.string()).default([]),
  acceptedCertificationIds: z.array(z.string()).default([]),
  acceptedProjectIds: z.array(z.string()).default([]),
  /** Optional reviewed/corrected payload override edited by the user before applying. */
  reviewedPayload: stageCvImportSchema.optional(),
});

export async function applyCvImportReviewService(
  userId: string,
  rawInput: z.input<typeof applyCvImportReviewSchema>,
) {
  const input = applyCvImportReviewSchema.parse(rawInput);
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  const staged = input.reviewedPayload
    ? {
        ...profile.pendingReviewPayload,
        ...input.reviewedPayload,
        sourceDocumentVersionId:
          input.reviewedPayload.sourceDocumentVersionId ??
          profile.pendingReviewPayload?.sourceDocumentVersionId ??
          null,
      }
    : profile.pendingReviewPayload;

  if (!staged) {
    throw new Error("No staged CV import payload pending review.");
  }

  const docVerId = staged.sourceDocumentVersionId ?? null;

  await db.transaction(async (tx) => {
    // 1. Apply explicitly accepted profile fields only
    if (input.acceptProfileFields.length > 0 && staged.profilePatch) {
      const patch: Record<string, unknown> = {
        source: "cv_import",
        sourceDocumentVersionId: docVerId,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      };
      for (const field of input.acceptProfileFields) {
        const val = staged.profilePatch[field];
        if (val !== undefined) {
          patch[field] = val;
        }
      }
      await tx
        .update(careerProfiles)
        .set(patch)
        .where(
          and(
            eq(careerProfiles.id, profile.id),
            eq(careerProfiles.userId, userId),
          ),
        );
    }

    // 2. Insert explicitly accepted experiences
    const expSet = new Set(input.acceptedExperienceIds);
    for (const exp of staged.experiences ?? []) {
      if (!expSet.has(exp.tempId)) continue;
      const isCurrent = Boolean(exp.isCurrent);
      const endDate = isCurrent ? null : (exp.endDate ?? null);
      const dateErr = validateDateRange({
        startDate: exp.startDate,
        endDate,
        isCurrentOrOngoing: isCurrent,
      });
      if (dateErr) throw new Error(dateErr);

      await tx.insert(careerExperiences).values({
        userId,
        profileId: profile.id,
        companyName: exp.companyName,
        jobTitle: exp.jobTitle,
        employmentType: (exp.employmentType as (typeof EMPLOYMENT_TYPES)[number]) ?? "full_time",
        location: exp.location ?? null,
        startDate: exp.startDate,
        endDate,
        isCurrent,
        responsibilities: exp.responsibilities ?? null,
        achievements: exp.achievements ?? [],
        verificationStatus: "verified",
        source: "cv_import",
        sourceDocumentVersionId: docVerId,
      });
    }

    // 3. Insert explicitly accepted educations
    const eduSet = new Set(input.acceptedEducationIds);
    for (const edu of staged.educations ?? []) {
      if (!eduSet.has(edu.tempId)) continue;
      await tx.insert(careerEducations).values({
        userId,
        profileId: profile.id,
        institution: edu.institution,
        qualification: edu.qualification ?? "bachelor",
        degreeTitle: edu.degreeTitle ?? null,
        fieldOfStudy: edu.fieldOfStudy ?? null,
        graduationYear: edu.graduationYear ?? null,
        gpa: edu.gpa ?? null,
        verificationStatus: "verified",
        source: "cv_import",
        sourceDocumentVersionId: docVerId,
      });
    }

    // 4. Insert explicitly accepted skills (skip duplicates gracefully)
    const skillSet = new Set(input.acceptedSkillIds);
    for (const sk of staged.skills ?? []) {
      if (!skillSet.has(sk.tempId)) continue;
      const norm = normalizeSkill(sk.skillName);
      await tx
        .insert(careerSkills)
        .values({
          userId,
          profileId: profile.id,
          skillName: sk.skillName,
          normalizedName: norm,
          category: sk.category ?? "technical",
          proficiencyLevel: sk.proficiencyLevel ?? "intermediate",
          yearsOfExperience: sk.yearsOfExperience ?? null,
          evidence: sk.evidence ?? null,
          isUserVerified: true,
          verificationStatus: "verified",
          source: "cv_import",
          sourceDocumentVersionId: docVerId,
        })
        .onConflictDoNothing();
    }

    // 5. Insert explicitly accepted certifications
    const certSet = new Set(input.acceptedCertificationIds);
    for (const cert of staged.certifications ?? []) {
      if (!certSet.has(cert.tempId)) continue;
      await tx.insert(careerCertifications).values({
        userId,
        profileId: profile.id,
        name: cert.name,
        issuingOrganization: cert.issuingOrganization,
        issueDate: cert.issueDate ?? null,
        expirationDate: cert.expirationDate ?? null,
        credentialId: cert.credentialId ?? null,
        credentialUrl: cert.credentialUrl ?? null,
        verificationStatus: "verified",
        source: "cv_import",
        sourceDocumentVersionId: docVerId,
      });
    }

    // 6. Insert explicitly accepted projects
    const projSet = new Set(input.acceptedProjectIds);
    for (const proj of staged.projects ?? []) {
      if (!projSet.has(proj.tempId)) continue;
      const isOngoing = Boolean(proj.isOngoing);
      const endDate = isOngoing ? null : (proj.endDate ?? null);
      await tx.insert(careerProjects).values({
        userId,
        profileId: profile.id,
        name: proj.name,
        organization: proj.organization ?? null,
        role: proj.role ?? null,
        startDate: proj.startDate ?? null,
        endDate,
        isOngoing,
        description: proj.description ?? null,
        achievements: proj.achievements ?? [],
        technologies: proj.technologies ?? [],
        projectUrl: proj.projectUrl ?? null,
        verificationStatus: "verified",
        source: "cv_import",
        sourceDocumentVersionId: docVerId,
      });
    }

    // 7. Clear pending review payload
    await tx
      .update(careerProfiles)
      .set({
        pendingReviewPayload: null,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(careerProfiles.id, profile.id),
          eq(careerProfiles.userId, userId),
        ),
      );

    await writeAudit(tx, {
      userId,
      entityType: "career_profile",
      entityId: profile.id,
      action: "update",
      summary: "Reviewed and applied CV import selections to Master Career Profile",
      changes: {
        acceptedProfileFields: input.acceptProfileFields,
        experiencesAdded: input.acceptedExperienceIds.length,
        educationsAdded: input.acceptedEducationIds.length,
        skillsAdded: input.acceptedSkillIds.length,
        certificationsAdded: input.acceptedCertificationIds.length,
        projectsAdded: input.acceptedProjectIds.length,
      },
    });
  });

  await syncVerifiedSkillsToSettings(userId, profile.id);
  await syncHighestEducationToSettings(userId, profile.id);
  return { ok: true };
}

export async function discardCvImportReviewService(userId: string) {
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);
  await db
    .update(careerProfiles)
    .set({ pendingReviewPayload: null, updatedAt: new Date() })
    .where(
      and(eq(careerProfiles.id, profile.id), eq(careerProfiles.userId, userId)),
    );
  return { ok: true };
}

export async function listCvVersionsForProfileImport(userId: string) {
  const db = await ensureDbReady();
  return db
    .select({
      versionId: documentVersions.id,
      documentId: documents.id,
      title: documents.title,
      category: documents.category,
      versionNo: documentVersions.versionNo,
      label: documentVersions.label,
      filename: documentVersions.filename,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .innerJoin(
      documents,
      and(
        eq(documentVersions.documentId, documents.id),
        eq(documents.userId, userId),
      ),
    )
    .where(eq(documentVersions.userId, userId))
    .orderBy(desc(documentVersions.createdAt));
}
