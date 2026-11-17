import { and, asc, desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  careerCertifications,
  careerEducations,
  careerExperiences,
  careerProfiles,
  careerProjects,
  careerSkills,
  userSettings,
} from "@/db/schema";
import { computeProfileCompletion } from "@/lib/domain/career-profile";
import type {
  EducationLevel,
  ProfileForScoring,
  WorkArrangement,
} from "@/lib/domain/suitability";
import {
  ensureCareerProfile,
  listCvVersionsForProfileImport,
} from "@/server/services/career-profile";

const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0,
  high_school: 1,
  diploma: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

/**
 * Primary reader for vacancy suitability evaluation.
 * Pulls directly from Master Career Profile tables (`career_profiles`,
 * verified `career_skills`, and `career_educations`) with fallback to
 * `user_settings` only if a profile record has not been populated yet.
 */
export async function getProfileForSuitabilityScoring(
  userId: string,
): Promise<ProfileForScoring> {
  const db = await ensureDbReady();

  const [[profile], skills, educations, [settings]] = await Promise.all([
    db
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, userId))
      .limit(1),
    db
      .select({
        skillName: careerSkills.skillName,
      })
      .from(careerSkills)
      .where(
        and(
          eq(careerSkills.userId, userId),
          eq(careerSkills.isUserVerified, true),
          eq(careerSkills.verificationStatus, "verified"),
        ),
      )
      .orderBy(asc(careerSkills.skillName)),
    db
      .select({ qualification: careerEducations.qualification })
      .from(careerEducations)
      .where(eq(careerEducations.userId, userId)),
    db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
  ]);

  let highestEdu: EducationLevel | null = null;
  let bestRank = -1;
  for (const edu of educations) {
    const rank = EDUCATION_RANK[edu.qualification] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      highestEdu = edu.qualification;
    }
  }

  return {
    skills:
      skills.length > 0
        ? skills.map((s) => s.skillName)
        : (settings?.skills ?? []),
    yearsExperience:
      profile?.totalExperienceYears ?? settings?.yearsExperience ?? null,
    educationLevel: highestEdu ?? settings?.educationLevel ?? null,
    expectedSalaryMin:
      profile?.expectedSalaryMin ?? settings?.expectedSalaryMin ?? null,
    currency: profile?.salaryCurrency ?? settings?.currency ?? "IDR",
    preferredLocations:
      profile && profile.preferredLocations.length > 0
        ? profile.preferredLocations
        : (settings?.preferredLocations ?? []),
    preferredArrangements: (profile && profile.preferredArrangements.length > 0
      ? profile.preferredArrangements
      : (settings?.preferredArrangements ?? [])) as WorkArrangement[],
  };
}

export async function getMasterCareerProfile(userId: string) {
  const db = await ensureDbReady();
  const profile = await ensureCareerProfile(userId);

  const [experiences, educations, skills, certifications, projects, cvVersions] =
    await Promise.all([
      db
        .select()
        .from(careerExperiences)
        .where(eq(careerExperiences.userId, userId))
        .orderBy(
          desc(careerExperiences.isCurrent),
          desc(careerExperiences.startDate),
          asc(careerExperiences.sortOrder),
        ),
      db
        .select()
        .from(careerEducations)
        .where(eq(careerEducations.userId, userId))
        .orderBy(desc(careerEducations.graduationYear)),
      db
        .select()
        .from(careerSkills)
        .where(eq(careerSkills.userId, userId))
        .orderBy(asc(careerSkills.category), asc(careerSkills.skillName)),
      db
        .select()
        .from(careerCertifications)
        .where(eq(careerCertifications.userId, userId))
        .orderBy(desc(careerCertifications.issueDate)),
      db
        .select()
        .from(careerProjects)
        .where(eq(careerProjects.userId, userId))
        .orderBy(desc(careerProjects.isOngoing), desc(careerProjects.startDate)),
      listCvVersionsForProfileImport(userId),
    ]);

  const verifiedSkillsCount = skills.filter(
    (s) => s.isUserVerified && s.verificationStatus === "verified",
  ).length;

  const completion = computeProfileCompletion({
    profile,
    experiencesCount: experiences.length,
    educationsCount: educations.length,
    verifiedSkillsCount,
    certificationsCount: certifications.length,
    projectsCount: projects.length,
  });

  return {
    profile,
    experiences,
    educations,
    skills,
    certifications,
    projects,
    cvVersions,
    completion,
  };
}
