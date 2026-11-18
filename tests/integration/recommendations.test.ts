import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDb } from "@/db";
import * as schema from "@/db/schema";
import { addCalendarDays, todayInTimeZone } from "@/lib/domain/business-days";
import { DEFAULT_WEIGHTS } from "@/lib/domain/suitability";
import { getNextBestActions } from "@/server/services/recommendations";
import { createIsolatedTestDb, createTestUser } from "../helpers/db";

const USER_A = "user_a";
const USER_B = "user_b";
const TIMEZONE = "Asia/Jakarta";

let db: AppDb;
let cleanup: () => Promise<void>;
let seq: number;
let today: string;

beforeEach(async () => {
  const isolated = await createIsolatedTestDb();
  db = isolated.db;
  cleanup = isolated.cleanup;
  seq = 0;
  today = todayInTimeZone(TIMEZONE);
  for (const [id, name, email] of [
    [USER_A, "Alice", "alice@example.com"],
    [USER_B, "Bob", "bob@example.com"],
  ] as const) {
    await createTestUser(db, { id, name, email });
  }
});

afterEach(async () => {
  await cleanup();
});

function at(day: string): Date {
  return new Date(`${day}T09:00:00.000Z`);
}

async function makeVacancy(
  userId: string,
  overrides: Partial<typeof schema.jobVacancies.$inferInsert> = {},
) {
  seq += 1;
  const [company] = await db
    .insert(schema.companies)
    .values({
      userId,
      name: `Acme ${seq}`,
      normalizedName: `acme-${seq}`,
    })
    .returning();
  const [vacancy] = await db
    .insert(schema.jobVacancies)
    .values({
      userId,
      companyId: company.id,
      code: `JOB-${seq}`,
      title: "Engineer",
      discoveredOn: today,
      ...overrides,
    })
    .returning();
  return vacancy;
}

async function getStageId(userId: string, key: string) {
  const [stage] = await db
    .select()
    .from(schema.applicationStages)
    .where(
      and(
        eq(schema.applicationStages.userId, userId),
        eq(schema.applicationStages.key, key),
      ),
    )
    .limit(1);
  if (!stage) throw new Error(`Missing stage ${key}`);
  return stage.id;
}

async function makeApplication(
  userId: string,
  overrides: Partial<typeof schema.applications.$inferInsert> = {},
) {
  seq += 1;
  const vacancyId = overrides.vacancyId ?? (await makeVacancy(userId)).id;
  const currentStageId =
    overrides.currentStageId ?? (await getStageId(userId, "applied"));
  const [application] = await db
    .insert(schema.applications)
    .values({
      userId,
      code: `APP-${seq}`,
      vacancyId,
      currentStageId,
      submittedOn: today,
      ...overrides,
    })
    .returning();
  return application;
}

async function makeCompleteProfile(userId: string) {
  const [profile] = await db
    .insert(schema.careerProfiles)
    .values({
      userId,
      fullName: "Test User",
      headline: "Engineer",
      summary: "Summary",
      location: "Jakarta",
      targetPositions: ["Engineer"],
      preferredLocations: ["Jakarta"],
      expectedSalaryMin: 1000,
    })
    .returning();
  await db.insert(schema.careerExperiences).values({
    userId,
    profileId: profile.id,
    companyName: "Acme",
    jobTitle: "Engineer",
    startDate: "2020-01-01",
  });
  for (let i = 0; i < 3; i += 1) {
    await db.insert(schema.careerSkills).values({
      userId,
      profileId: profile.id,
      skillName: `Skill ${i}`,
      normalizedName: `skill-${i}`,
      isUserVerified: true,
      verificationStatus: "verified",
    });
  }
}

async function makeCv(userId: string) {
  const [document] = await db
    .insert(schema.documents)
    .values({ userId, category: "master_cv", title: "CV" })
    .returning();
  const [version] = await db
    .insert(schema.documentVersions)
    .values({
      userId,
      documentId: document.id,
      versionNo: 1,
      label: "v1",
      storageKey: `${userId}/cv.pdf`,
    })
    .returning();
  return version;
}

/** Completes setup and workflow stages so time-sensitive rules are unblocked. */
async function makeWorkflowCore(userId: string) {
  await makeCompleteProfile(userId);
  const cv = await makeCv(userId);
  const vacancy = await makeVacancy(userId, { triageStatus: "shortlisted" });
  await db.insert(schema.suitabilityEvaluations).values({
    userId,
    vacancyId: vacancy.id,
    weights: DEFAULT_WEIGHTS,
    overallScore: 80,
  });
  const application = await makeApplication(userId, {
    vacancyId: vacancy.id,
    cvVersionId: cv.id,
  });
  return { vacancy, application, cv };
}

describe("next best action rules (integration, in-memory PGlite)", () => {
  it("recommends completing the profile on an empty account", async () => {
    const result = await getNextBestActions(USER_A);
    expect(result.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(result.primary?.targetRoute).toBe("/profile");
    expect(result.urgent).toEqual([]);
  });

  it("advances from profile to CV to discovery to application", async () => {
    await makeCompleteProfile(USER_A);
    expect((await getNextBestActions(USER_A)).primary?.actionId).toBe(
      "P2-UPLOAD-CV",
    );

    const cv = await makeCv(USER_A);
    expect((await getNextBestActions(USER_A)).primary?.actionId).toBe(
      "P3-DISCOVER-JOBS",
    );

    await makeVacancy(USER_A);
    const afterDiscovery = await getNextBestActions(USER_A);
    expect([afterDiscovery.primary?.actionId]).toContain("P3-BUILD-SHORTLIST");

    await makeApplication(USER_A, { cvVersionId: cv.id });
    // Setup/workflow are done and the application already references a CV.
    expect((await getNextBestActions(USER_A)).primary).toBeNull();
  });

  it("recommends an overdue follow-up as the primary urgent action", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    await db.insert(schema.followUpTasks).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Follow up",
      dueOn: addCalendarDays(today, -3),
      status: "open",
    });

    const result = await getNextBestActions(USER_A);
    expect(result.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
    expect(result.primary?.dueDate).toBe(addCalendarDays(today, -3));
    expect(result.urgent).toHaveLength(1);
  });

  it("recommends an upcoming interview within the existing window", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    const interviewDate = addCalendarDays(today, 2);
    await db.insert(schema.interviews).values({
      userId: USER_A,
      applicationId: application.id,
      startsAt: at(interviewDate),
      status: "scheduled",
    });

    const result = await getNextBestActions(USER_A);
    expect(result.primary?.actionId).toBe("P1-UPCOMING-INTERVIEW");
    expect(result.primary?.dueDate).toBe(interviewDate);
  });

  it("ignores a distant interview", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    await db.insert(schema.interviews).values({
      userId: USER_A,
      applicationId: application.id,
      startsAt: at(addCalendarDays(today, 30)),
      status: "scheduled",
    });

    expect((await getNextBestActions(USER_A)).primary).toBeNull();
  });

  it("recommends a pending assessment using its real due date", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    const dueDate = addCalendarDays(today, 4);
    await db.insert(schema.assessments).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Technical test",
      dueAt: at(dueDate),
      result: "pending",
    });

    const result = await getNextBestActions(USER_A);
    expect(result.primary?.actionId).toBe("P1-PENDING-ASSESSMENT");
    expect(result.primary?.dueDate).toBe(dueDate);
  });

  it("recommends a pending offer decision and ignores a decided offer", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    const deadline = addCalendarDays(today, 5);
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: today,
      responseDeadline: deadline,
      decision: "pending",
    });

    const pending = await getNextBestActions(USER_A);
    expect(pending.primary?.actionId).toBe("P1-OFFER-DECISION");
    expect(pending.primary?.dueDate).toBe(deadline);

    await db
      .update(schema.jobOffers)
      .set({ decision: "accepted" })
      .where(eq(schema.jobOffers.userId, USER_A));
    expect((await getNextBestActions(USER_A)).primary).toBeNull();
  });

  it("orders multiple simultaneous actions by priority and due date", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    await db.insert(schema.followUpTasks).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Overdue follow-up",
      dueOn: addCalendarDays(today, -1),
      status: "open",
    });
    await db.insert(schema.interviews).values({
      userId: USER_A,
      applicationId: application.id,
      startsAt: at(addCalendarDays(today, 1)),
      status: "scheduled",
    });
    await db.insert(schema.assessments).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Test",
      result: "pending",
    });
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: today,
      decision: "pending",
    });

    const result = await getNextBestActions(USER_A);
    expect(result.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
    expect(result.urgent.map((a) => a.actionId)).toEqual([
      "P1-OVERDUE-FOLLOWUP",
      "P1-UPCOMING-INTERVIEW",
      "P1-OFFER-DECISION",
      "P1-PENDING-ASSESSMENT",
    ]);
  });

  it("does not recommend a completed or deleted follow-up", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    const [task] = await db
      .insert(schema.followUpTasks)
      .values({
        userId: USER_A,
        applicationId: application.id,
        title: "Follow up",
        dueOn: addCalendarDays(today, -2),
        status: "open",
      })
      .returning();

    expect(
      (await getNextBestActions(USER_A)).primary?.actionId,
    ).toBe("P1-OVERDUE-FOLLOWUP");

    await db
      .update(schema.followUpTasks)
      .set({ status: "done" })
      .where(eq(schema.followUpTasks.id, task.id));
    expect((await getNextBestActions(USER_A)).primary).toBeNull();

    await db
      .update(schema.followUpTasks)
      .set({ status: "open" })
      .where(eq(schema.followUpTasks.id, task.id));
    await db
      .delete(schema.followUpTasks)
      .where(eq(schema.followUpTasks.id, task.id));
    expect((await getNextBestActions(USER_A)).primary).toBeNull();
  });

  it("recommends archive review only for active archived records with expiring retention", async () => {
    const { vacancy, application } = await makeWorkflowCore(USER_A);
    const [closure] = await db
      .insert(schema.applicationClosureRecords)
      .values({
        userId: USER_A,
        applicationId: application.id,
        vacancyId: vacancy.id,
        closureOutcome: "rejected",
        status: "archived",
        closedOn: addCalendarDays(today, -100),
        retainUntil: addCalendarDays(today, -1),
      })
      .returning();

    expect((await getNextBestActions(USER_A)).primary?.actionId).toBe(
      "P4-REVIEW-ARCHIVE",
    );

    await db
      .update(schema.applicationClosureRecords)
      .set({ status: "restored" })
      .where(eq(schema.applicationClosureRecords.id, closure.id));
    expect((await getNextBestActions(USER_A)).primary).toBeNull();
  });

  it("uses an existing no-response suggestion for status maintenance", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    const inactiveDay = addCalendarDays(today, -40);
    await db
      .update(schema.applications)
      .set({
        lastActivityAt: at(inactiveDay),
        submittedOn: inactiveDay,
      })
      .where(eq(schema.applications.id, application.id));

    expect((await getNextBestActions(USER_A)).primary?.actionId).toBe(
      "P4-UPDATE-STATUS",
    );
  });

  it("filters unavailable target routes", async () => {
    const result = await getNextBestActions(USER_A, {
      availableRoutes: ["/profile"],
      evaluatedAt: "2026-11-18T02:00:00.000Z",
    });
    expect(result.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(result.secondary).toEqual([]);
  });

  it("returns a deterministic empty result for a fully populated account", async () => {
    const { application, vacancy } = await makeWorkflowCore(USER_A);
    await db.insert(schema.applicationStatusHistory).values({
      userId: USER_A,
      applicationId: application.id,
      toStageId: await getStageId(USER_A, "cv_screening"),
      effectiveOn: today,
      source: "kanban",
    });
    await db.insert(schema.jobOffers).values({
      userId: USER_A,
      applicationId: application.id,
      positionTitle: "Engineer",
      offerReceivedOn: today,
      decision: "accepted",
    });

    const options = { evaluatedAt: "2026-11-18T02:00:00.000Z" };
    const first = await getNextBestActions(USER_A, options);
    const second = await getNextBestActions(USER_A, options);

    expect(first.primary).toBeNull();
    expect(first.secondary).toEqual([]);
    expect(first.urgent).toEqual([]);
    expect(first.reasons).toEqual([]);
    expect(first.emptyStateReason).toContain("no time-sensitive");
    expect(first.progressContext.percentage).toBe(100);
    expect({
      primary: first.primary,
      secondary: first.secondary,
      urgent: first.urgent,
      reasons: first.reasons,
      evaluatedAt: first.evaluatedAt,
      emptyStateReason: first.emptyStateReason,
    }).toEqual({
      primary: second.primary,
      secondary: second.secondary,
      urgent: second.urgent,
      reasons: second.reasons,
      evaluatedAt: second.evaluatedAt,
      emptyStateReason: second.emptyStateReason,
    });
    expect(vacancy.id).toBeTruthy();
  });

  it("isolates recommendations between users", async () => {
    const { application } = await makeWorkflowCore(USER_A);
    await db.insert(schema.followUpTasks).values({
      userId: USER_A,
      applicationId: application.id,
      title: "Overdue follow-up",
      dueOn: addCalendarDays(today, -2),
      status: "open",
    });

    const a = await getNextBestActions(USER_A);
    const b = await getNextBestActions(USER_B);

    expect(a.primary?.actionId).toBe("P1-OVERDUE-FOLLOWUP");
    expect(b.primary?.actionId).toBe("P2-COMPLETE-PROFILE");
    expect(b.urgent).toEqual([]);
  });
});
