import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getMasterCareerProfile } from "@/server/queries/career-profile";
import { getVacancyDetail } from "@/server/queries/vacancies";
import { uploadOrVersionDocumentService } from "@/server/services/career";
import { createVacancyService } from "@/server/services/vacancies";
import {
  applyCvImportReviewService,
  deleteCareerCertificationService,
  deleteCareerEducationService,
  deleteCareerExperienceService,
  deleteCareerProjectService,
  deleteCareerSkillService,
  discardCvImportReviewService,
  saveCareerCertificationService,
  saveCareerEducationService,
  saveCareerExperienceService,
  saveCareerProjectService,
  saveCareerSkillService,
  stageCvImportReviewService,
  upsertCareerProfileService,
  VerifiedCareerDataProtectedError,
} from "@/server/services/career-profile";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

describe("Master Career Profile integration tests (in-memory PGlite)", () => {
  let db: AppDb;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const res = await createIsolatedTestDb();
    db = res.db;
    cleanup = res.cleanup;
    await createTestUser(db, {
      id: "user_a",
      name: "Alice Candidate",
      email: "alice@example.com",
    });
    await createTestUser(db, {
      id: "user_b",
      name: "Bob Other",
      email: "bob@example.com",
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("creates, updates, and validates profile information and career preferences", async () => {
    const initial = await getMasterCareerProfile("user_a");
    expect(initial.profile.fullName).toBe("Alice Candidate");
    expect(initial.completion.percentage).toBe(0);

    const updated = await upsertCareerProfileService("user_a", {
      fullName: "Alice Pratama",
      headline: "Senior Full-Stack Engineer",
      summary: "7 years shipping fintech and e-commerce platforms in Indonesia.",
      contactEmail: "alice@example.com",
      contactPhone: "+62 812 9000 1234",
      linkedinUrl: "https://linkedin.com/in/alice-pratama",
      portfolioUrl: "https://alice.dev",
      githubUrl: "https://github.com/alice",
      location: "Jakarta",
      country: "Indonesia",
      preferredLanguage: "bilingual",
      careerLevel: "senior",
      totalExperienceYears: 7,
      targetPositions: ["Staff Software Engineer", "Tech Lead"],
      targetIndustries: ["Fintech", "SaaS"],
      preferredLocations: ["Jakarta", "Remote"],
      preferredArrangements: ["hybrid", "remote"],
      salaryCurrency: "IDR",
      expectedSalaryMin: 30_000_000,
      expectedSalaryMax: 45_000_000,
      salaryPeriod: "month",
      syncToSuitabilitySettings: true,
    });

    expect(updated.headline).toBe("Senior Full-Stack Engineer");
    expect(updated.careerLevel).toBe("senior");
    expect(updated.targetPositions).toEqual([
      "Staff Software Engineer",
      "Tech Lead",
    ]);

    // Synced to user_settings for suitability scoring
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, "user_a"));
    expect(settings.headline).toBe("Senior Full-Stack Engineer");
    expect(settings.yearsExperience).toBe(7);
    expect(settings.expectedSalaryMin).toBe(30_000_000);

    // Rejects invalid salary range (min > max)
    await expect(
      upsertCareerProfileService("user_a", {
        fullName: "Alice Pratama",
        preferredLanguage: "id-ID",
        targetPositions: [],
        targetIndustries: [],
        preferredLocations: [],
        preferredArrangements: [],
        salaryCurrency: "IDR",
        expectedSalaryMin: 50_000_000,
        expectedSalaryMax: 30_000_000,
        salaryPeriod: "month",
        syncToSuitabilitySettings: false,
      }),
    ).rejects.toThrow(/exceed maximum salary/i);
  });

  it("manages multiple experiences, educations, skills, certifications, and projects with strict date & duplicate validation", async () => {
    // 1. Multiple experiences
    const exp1 = await saveCareerExperienceService("user_a", {
      companyName: "PT GoTo",
      jobTitle: "Senior Backend Engineer",
      employmentType: "full_time",
      location: "Jakarta",
      startDate: "2023-03-01",
      endDate: null,
      isCurrent: true,
      responsibilities: "Core ledger services",
      achievements: ["Reduced p99 latency by 40%"],
    });
    const exp2 = await saveCareerExperienceService("user_a", {
      companyName: "PT Bukalapak",
      jobTitle: "Software Engineer",
      employmentType: "full_time",
      location: "Bandung",
      startDate: "2020-01-15",
      endDate: "2023-02-20",
      isCurrent: false,
      responsibilities: "Checkout API",
      achievements: ["Handled 10k RPS flash sale traffic"],
    });
    expect(exp1.isCurrent).toBe(true);
    expect(exp2.endDate).toBe("2023-02-20");

    // Rejects endDate earlier than startDate
    await expect(
      saveCareerExperienceService("user_a", {
        companyName: "PT BadDates",
        jobTitle: "Engineer",
        employmentType: "full_time",
        startDate: "2024-05-01",
        endDate: "2024-01-01",
        isCurrent: false,
        achievements: [],
      }),
    ).rejects.toThrow(/earlier/i);

    // Rejects endDate when isCurrent is true
    await expect(
      saveCareerExperienceService("user_a", {
        companyName: "PT BadCurrent",
        jobTitle: "Engineer",
        employmentType: "full_time",
        startDate: "2024-05-01",
        endDate: "2025-01-01",
        isCurrent: true,
        achievements: [],
      }),
    ).rejects.toThrow(/must be empty/i);

    // 2. Multiple educations
    const edu1 = await saveCareerEducationService("user_a", {
      institution: "Institut Teknologi Bandung",
      qualification: "bachelor",
      degreeTitle: "S.T.",
      fieldOfStudy: "Informatics",
      graduationYear: 2019,
      gpa: "3.82",
    });
    const edu2 = await saveCareerEducationService("user_a", {
      institution: "Universitas Indonesia",
      qualification: "master",
      degreeTitle: "M.Kom",
      fieldOfStudy: "Computer Science",
      graduationYear: 2022,
    });
    expect(edu1.graduationYear).toBe(2019);
    expect(edu2.qualification).toBe("master");

    // 3. Skills + alias deduplication + user_settings sync
    const sk1 = await saveCareerSkillService("user_a", {
      skillName: "React",
      category: "framework",
      proficiencyLevel: "expert",
      yearsOfExperience: 5,
      evidence: "Built merchant dashboard at GoTo",
      isUserVerified: true,
    });
    await saveCareerSkillService("user_a", {
      skillName: "Go",
      category: "technical",
      proficiencyLevel: "advanced",
      yearsOfExperience: 4,
      isUserVerified: true,
    });
    await saveCareerSkillService("user_a", {
      skillName: "PostgreSQL",
      category: "tool",
      proficiencyLevel: "advanced",
      yearsOfExperience: 5,
      isUserVerified: true,
    });

    // Alias "reactjs" maps to normalized "react" -> blocked as duplicate
    await expect(
      saveCareerSkillService("user_a", {
        skillName: "reactjs",
        category: "framework",
        proficiencyLevel: "intermediate",
        isUserVerified: true,
      }),
    ).rejects.toThrow(/already exists/i);

    const [settingsAfterSkills] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, "user_a"));
    expect(settingsAfterSkills.skills).toContain("React");
    expect(settingsAfterSkills.skills).toContain("Go");

    // 4. Certifications + date check
    const cert = await saveCareerCertificationService("user_a", {
      name: "AWS Solutions Architect",
      issuingOrganization: "AWS",
      issueDate: "2024-01-10",
      expirationDate: "2027-01-10",
      credentialUrl: "https://aws.amazon.com/verification/123",
    });
    expect(cert.name).toBe("AWS Solutions Architect");

    await expect(
      saveCareerCertificationService("user_a", {
        name: "Invalid Cert",
        issuingOrganization: "Org",
        issueDate: "2025-06-01",
        expirationDate: "2024-01-01",
      }),
    ).rejects.toThrow(/earlier/i);

    // 5. Projects
    const proj = await saveCareerProjectService("user_a", {
      name: "QRIS Settlement Monitor",
      organization: "PT GoTo",
      role: "Tech Lead",
      startDate: "2024-02-01",
      isOngoing: true,
      description: "Real-time alerting for payment settlement SLA.",
      achievements: ["99.99% uptime"],
      technologies: ["Go", "Kafka", "PostgreSQL"],
      projectUrl: "https://github.com/example/qris-monitor",
    });
    expect(proj.technologies).toEqual(["Go", "Kafka", "PostgreSQL"]);

    // Verify full bundle & deletes
    const bundle = await getMasterCareerProfile("user_a");
    expect(bundle.experiences).toHaveLength(2);
    expect(bundle.educations).toHaveLength(2);
    expect(bundle.skills).toHaveLength(3);
    expect(bundle.certifications).toHaveLength(1);
    expect(bundle.projects).toHaveLength(1);

    await deleteCareerExperienceService("user_a", exp2.id);
    await deleteCareerEducationService("user_a", edu2.id);
    await deleteCareerSkillService("user_a", sk1.id);
    await deleteCareerCertificationService("user_a", cert.id);
    await deleteCareerProjectService("user_a", proj.id);

    const afterDelete = await getMasterCareerProfile("user_a");
    expect(afterDelete.experiences).toHaveLength(1);
    expect(afterDelete.educations).toHaveLength(1);
    expect(afterDelete.skills).toHaveLength(2);
    expect(afterDelete.certifications).toHaveLength(0);
    expect(afterDelete.projects).toHaveLength(0);
  });

  it("stages CV imports without overwriting verified data and requires explicit review to apply or discard", async () => {
    await upsertCareerProfileService("user_a", {
      fullName: "Alice Verified",
      headline: "Verified Headline",
      preferredLanguage: "id-ID",
      targetPositions: [],
      targetIndustries: [],
      preferredLocations: [],
      preferredArrangements: [],
      salaryCurrency: "IDR",
      salaryPeriod: "month",
      syncToSuitabilitySettings: false,
    });

    const verifiedExp = await saveCareerExperienceService("user_a", {
      companyName: "PT Verified Corp",
      jobTitle: "Verified Role",
      employmentType: "full_time",
      startDate: "2022-01-01",
      isCurrent: true,
      achievements: ["Verified metric"],
    });

    // Guard blocks non-manual (AI/import) overwrite of verified records
    await expect(
      saveCareerExperienceService(
        "user_a",
        {
          id: verifiedExp.id,
          companyName: "Overwritten Corp",
          jobTitle: "Hallucinated Title",
          employmentType: "full_time",
          startDate: "2022-01-01",
          isCurrent: true,
          achievements: [],
        },
        { actorMode: "ai" },
      ),
    ).rejects.toThrow(VerifiedCareerDataProtectedError);

    const uploadedCv = await uploadOrVersionDocumentService("user_a", {
      metadata: {
        category: "master_cv",
        title: "Alice Master CV",
        versionLabel: "v3.0",
        linkRole: "cv",
      },
      file: {
        buffer: Buffer.from("%PDF-1.4\n%cv content\n"),
        filename: "alice_cv_v3.pdf",
      },
    });

    // Stage CV import, must NOT overwrite verified headline or experiences
    await stageCvImportReviewService("user_a", {
      sourceDocumentVersionId: uploadedCv.version.id,
      profilePatch: {
        headline: "Imported Draft Headline",
        summary: "Imported draft summary",
      },
      experiences: [
        {
          tempId: "imp_exp_1",
          companyName: "PT Imported Startup",
          jobTitle: "Founding Engineer",
          startDate: "2020-01-01",
          endDate: "2021-12-31",
          isCurrent: false,
        },
      ],
      skills: [
        { tempId: "imp_sk_1", skillName: "TypeScript", category: "technical" },
        { tempId: "imp_sk_2", skillName: "Unwanted Skill", category: "other" },
      ],
    });

    const whileStaged = await getMasterCareerProfile("user_a");
    expect(whileStaged.profile.headline).toBe("Verified Headline");
    expect(whileStaged.experiences).toHaveLength(1);
    expect(whileStaged.skills).toHaveLength(0);
    expect(whileStaged.profile.pendingReviewPayload).not.toBeNull();

    // User explicitly accepts summary + exp1 + sk1 (and keeps verified headline!)
    await applyCvImportReviewService("user_a", {
      acceptProfileFields: ["summary"],
      acceptedExperienceIds: ["imp_exp_1"],
      acceptedSkillIds: ["imp_sk_1"],
    });

    const afterApply = await getMasterCareerProfile("user_a");
    expect(afterApply.profile.headline).toBe("Verified Headline");
    expect(afterApply.profile.summary).toBe("Imported draft summary");
    expect(afterApply.profile.pendingReviewPayload).toBeNull();
    expect(afterApply.experiences).toHaveLength(2);
    expect(afterApply.skills.map((s) => s.skillName)).toEqual(["TypeScript"]);

    // Stage again and discard
    await stageCvImportReviewService("user_a", {
      profilePatch: { headline: "Should Be Discarded" },
    });
    await discardCvImportReviewService("user_a");
    const afterDiscard = await getMasterCareerProfile("user_a");
    expect(afterDiscard.profile.headline).toBe("Verified Headline");
    expect(afterDiscard.profile.pendingReviewPayload).toBeNull();
  });

  it("enforces strict per-user data isolation across all Master Career Profile tables", async () => {
    const expA = await saveCareerExperienceService("user_a", {
      companyName: "Private Co A",
      jobTitle: "Secret Lead",
      employmentType: "full_time",
      startDate: "2023-01-01",
      isCurrent: true,
      achievements: [],
    });
    const eduA = await saveCareerEducationService("user_a", {
      institution: "University A",
      qualification: "bachelor",
    });
    const skA = await saveCareerSkillService("user_a", {
      skillName: "Rust",
      category: "technical",
      proficiencyLevel: "advanced",
      isUserVerified: true,
    });
    const certA = await saveCareerCertificationService("user_a", {
      name: "Cert A",
      issuingOrganization: "Org A",
    });
    const projA = await saveCareerProjectService("user_a", {
      name: "Project A",
      achievements: [],
      technologies: ["Rust"],
    });

    const profileB = await getMasterCareerProfile("user_b");
    expect(profileB.experiences).toHaveLength(0);
    expect(profileB.educations).toHaveLength(0);
    expect(profileB.skills).toHaveLength(0);
    expect(profileB.certifications).toHaveLength(0);
    expect(profileB.projects).toHaveLength(0);

    await expect(
      deleteCareerExperienceService("user_b", expA.id),
    ).rejects.toThrow();
    await expect(
      deleteCareerEducationService("user_b", eduA.id),
    ).rejects.toThrow();
    await expect(
      deleteCareerSkillService("user_b", skA.id),
    ).rejects.toThrow();
    await expect(
      deleteCareerCertificationService("user_b", certA.id),
    ).rejects.toThrow();
    await expect(
      deleteCareerProjectService("user_b", projA.id),
    ).rejects.toThrow();
  });

  it("evaluates job suitability directly from Master Career Profile tables", async () => {
    await upsertCareerProfileService("user_a", {
      fullName: "Alice Matcher",
      headline: "Go Engineer",
      preferredLanguage: "id-ID",
      totalExperienceYears: 5,
      targetPositions: ["Backend Engineer"],
      targetIndustries: ["Fintech"],
      preferredLocations: ["Jakarta"],
      preferredArrangements: ["hybrid"],
      salaryCurrency: "IDR",
      expectedSalaryMin: 20_000_000,
      expectedSalaryMax: 30_000_000,
      salaryPeriod: "month",
      syncToSuitabilitySettings: false,
    });

    await saveCareerEducationService("user_a", {
      institution: "ITB",
      qualification: "bachelor",
    });

    await saveCareerSkillService("user_a", {
      skillName: "Go",
      category: "technical",
      proficiencyLevel: "expert",
      isUserVerified: true,
    });
    await saveCareerSkillService("user_a", {
      skillName: "PostgreSQL",
      category: "tool",
      proficiencyLevel: "advanced",
      isUserVerified: true,
    });

    const vac = await createVacancyService("user_a", {
      companyName: "PT Match",
      title: "Backend Engineer",
      location: "Jakarta",
      workArrangement: "hybrid",
      salaryMin: 22_000_000,
      salaryMax: 28_000_000,
      currency: "IDR",
      salaryPeriod: "month",
      requiredExperienceYears: 4,
      requiredEducation: "bachelor",
      skills: ["Go", "PostgreSQL"],
      priority: "high",
      triageStatus: "new",
    });

    expect(vac.suitabilityScore).toBe(100);

    const detail = await getVacancyDetail("user_a", vac.id);
    expect(detail).not.toBeNull();
    expect(detail!.suggestions.skills.score).toBe(100);
    expect(detail!.suggestions.experience.score).toBe(100);
    expect(detail!.suggestions.education.score).toBe(100);
    expect(detail!.suggestions.salary.score).toBe(100);
    expect(detail!.suggestions.location.score).toBe(100);
  });
});
