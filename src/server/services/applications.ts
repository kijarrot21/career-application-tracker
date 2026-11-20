import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  applicationClosureRecords,
  applications,
  applicationStatusHistory,
  emailCommunications,
  followUpTasks,
  interviews,
  jobVacancies,
  recruiterContacts,
  userSettings,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  COMM_CHANNELS,
  COMM_DIRECTIONS,
  CURRENCIES,
  EMAIL_CLASSIFICATIONS,
  FOLLOW_UP_TYPES,
  HISTORY_SOURCES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  SUBMISSION_METHODS,
} from "@/lib/constants";
import { isIsoDate, todayInTimeZone } from "@/lib/domain/business-days";
import {
  initialFollowUpDueOn,
  nextFollowUpInSequence,
} from "@/lib/domain/follow-ups";
import {
  classifyTransition,
  deriveOutcome,
  isTerminal,
  requiresDialog,
} from "@/lib/domain/stages";
import { formatCode } from "@/lib/format";
import { getUserSettings, getUserStages } from "@/server/queries/settings";
import { archiveApplicationTx, mapHistorySourceToClosureSource } from "./archive";
import { createVacancyService } from "./vacancies";

export const recordSubmissionSchema = z.object({
  vacancyId: z.string().uuid().optional().nullable(),
  // Used when creating an application without an existing vacancy
  companyName: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  jobUrl: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  submittedOn: z
    .string()
    .trim()
    .min(10, "Submission date is required")
    .refine(isIsoDate, "Submission date must be a valid YYYY-MM-DD date"),
  platformSourceId: z.string().uuid().optional().nullable(),
  submissionMethod: z.enum(SUBMISSION_METHODS).default("platform"),
  applicationUrl: z.string().trim().optional().nullable(),
  externalReferenceId: z.string().trim().max(120).optional().nullable(),
  confirmationReference: z.string().trim().max(160).optional().nullable(),
  cvVersionLabel: z.string().trim().max(160).optional().nullable(),
  coverLetterVersionLabel: z.string().trim().max(160).optional().nullable(),
  recruiterName: z.string().trim().max(160).optional().nullable(),
  recruiterEmail: z.string().trim().max(160).optional().nullable(),
  recruiterContact: z.string().trim().max(160).optional().nullable(),
  expectedSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).default("IDR"),
  jobCategory: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(10000).optional().nullable(),
  isIntentionalReapply: z.boolean().optional().default(false),
  reapplyReason: z.string().trim().max(1000).optional().nullable(),
});

export type RecordSubmissionInput = z.infer<typeof recordSubmissionSchema>;

export async function recordSubmissionService(
  userId: string,
  rawInput: RecordSubmissionInput,
) {
  const input = recordSubmissionSchema.parse(rawInput);
  const db = await ensureDbReady();
  const stages = await getUserStages(userId, true);

  let vacancyId = input.vacancyId ?? null;
  if (!vacancyId) {
    if (!input.companyName || !input.title) {
      throw new Error("Provide either an existing job vacancy or company name and position title.");
    }
    const createdVac = await createVacancyService(userId, {
      companyName: input.companyName,
      title: input.title,
      url: input.jobUrl || null,
      location: input.location || null,
      sourceId: input.platformSourceId || null,
      currency: input.currency,
      salaryPeriod: "month",
      priority: "medium",
      triageStatus: "shortlisted",
      skills: [],
      discoveredOn: input.submittedOn,
    });
    vacancyId = createdVac.id;
  }

  const [vacancy] = await db
    .select()
    .from(jobVacancies)
    .where(and(eq(jobVacancies.id, vacancyId), eq(jobVacancies.userId, userId)));
  if (!vacancy) {
    throw new Error("Job vacancy not found.");
  }

  // Check existing applications for this vacancy
  const existingApps = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.vacancyId, vacancyId)))
    .orderBy(desc(applications.attemptNumber));

  const activeExisting = existingApps.find((a) => a.outcome === "active");
  if (activeExisting) {
    throw new Error(
      `An active application (${activeExisting.code}) already exists for this job vacancy. Duplicate active applications to the same position are blocked.`,
    );
  }

  let attemptNumber = 1;
  if (existingApps.length > 0) {
    if (!input.isIntentionalReapply || !input.reapplyReason?.trim()) {
      throw new Error(
        `A previous application (${existingApps[0].code}) exists for this position. Confirm intentional re-application and provide a reason.`,
      );
    }
    attemptNumber = existingApps[0].attemptNumber + 1;
  }

  const sourcedStage = stages.find((s) => s.stageType === "sourced");
  const interestedStage = stages.find((s) => s.stageType === "interested");
  const appliedStage =
    stages.find((s) => s.key === "applied") ??
    stages.find((s) => s.stageType === "applied");

  if (!appliedStage) {
    throw new Error("Applied stage is missing from pipeline configuration.");
  }

  let recruiterId: string | null = null;
  if (input.recruiterName) {
    const [rec] = await db
      .insert(recruiterContacts)
      .values({
        userId,
        companyId: vacancy.companyId,
        name: input.recruiterName,
        email: input.recruiterEmail || null,
        phone: input.recruiterContact || null,
      })
      .returning({ id: recruiterContacts.id });
    recruiterId = rec.id;
  }

  const freshSettings = await getUserSettings(userId);
  const code = formatCode("APP", freshSettings.nextApplicationSeq);
  const firstFollowUpDueOn = initialFollowUpDueOn(input.submittedOn, {
    followUpFirstDays: freshSettings.followUpFirstDays,
    holidays: freshSettings.holidays ?? [],
  });

  const [created] = await db
    .insert(applications)
    .values({
      userId,
      code,
      vacancyId,
      currentStageId: appliedStage.id,
      outcome: "active",
      submittedOn: input.submittedOn,
      platformSourceId: input.platformSourceId ?? vacancy.sourceId ?? null,
      submissionMethod: input.submissionMethod,
      applicationUrl: input.applicationUrl || vacancy.url || null,
      externalReferenceId: input.externalReferenceId || vacancy.externalJobId || null,
      confirmationReference: input.confirmationReference || null,
      cvVersionLabel: input.cvVersionLabel || null,
      coverLetterVersionLabel: input.coverLetterVersionLabel || null,
      primaryRecruiterId: recruiterId,
      recruiterName: input.recruiterName || null,
      recruiterEmail: input.recruiterEmail || null,
      recruiterContact: input.recruiterContact || null,
      expectedSalary: input.expectedSalary ?? null,
      currency: input.currency,
      jobCategory: input.jobCategory || vacancy.department || null,
      attemptNumber,
      reapplyReason: attemptNumber > 1 ? (input.reapplyReason ?? null) : null,
      nextFollowUpOn: firstFollowUpDueOn,
      lastActivityAt: new Date(),
      notes: input.notes || null,
    })
    .returning();

  // Promote vacancy triage to shortlisted if still 'new'
  if (vacancy.triageStatus === "new") {
    await db
      .update(jobVacancies)
      .set({ triageStatus: "shortlisted", triagedAt: new Date() })
      .where(and(eq(jobVacancies.id, vacancy.id), eq(jobVacancies.userId, userId)));
  }

  // Record initial status history: Sourced -> Interested -> Applied
  const discoveredDate =
    vacancy.discoveredOn <= input.submittedOn ? vacancy.discoveredOn : input.submittedOn;
  let lastStageId: string | null = null;
  if (sourcedStage) {
    await db.insert(applicationStatusHistory).values({
      userId,
      applicationId: created.id,
      fromStageId: null,
      toStageId: sourcedStage.id,
      effectiveOn: discoveredDate,
      source: "submission",
      note: "Vacancy discovered",
    });
    lastStageId = sourcedStage.id;
  }
  if (interestedStage) {
    await db.insert(applicationStatusHistory).values({
      userId,
      applicationId: created.id,
      fromStageId: lastStageId,
      toStageId: interestedStage.id,
      effectiveOn: discoveredDate,
      source: "submission",
      note: "Candidate decided to pursue opportunity",
    });
    lastStageId = interestedStage.id;
  }

  await db.insert(applicationStatusHistory).values({
    userId,
    applicationId: created.id,
    fromStageId: lastStageId,
    toStageId: appliedStage.id,
    effectiveOn: input.submittedOn,
    source: "submission",
    reason: attemptNumber > 1 ? `Re-application #${attemptNumber}: ${input.reapplyReason}` : null,
    note: `Submitted via ${input.submissionMethod}`,
  });

  // Schedule automatic first follow-up task
  await db.insert(followUpTasks).values({
    userId,
    applicationId: created.id,
    type: "follow_up",
    title: `First follow-up for ${vacancy.title}`,
    sequenceNo: 1,
    dueOn: firstFollowUpDueOn,
    status: "open",
    autoGenerated: true,
    note: `Follow up if no response after ${freshSettings.followUpFirstDays} business days.`,
  });

  await db
    .update(userSettings)
    .set({ nextApplicationSeq: freshSettings.nextApplicationSeq + 1 })
    .where(eq(userSettings.userId, userId));

  await writeAudit(db, {
    userId,
    entityType: "application",
    entityId: created.id,
    action: "create",
    summary: `Recorded application ${created.code} for ${vacancy.title}`,
  });

  return created;
}

export const moveStageSchema = z.object({
  applicationId: z.string().uuid(),
  toStageId: z.string().uuid(),
  effectiveOn: z.string().trim().optional(),
  source: z.enum(HISTORY_SOURCES).default("manual"),
  reason: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type MoveStageInput = z.infer<typeof moveStageSchema>;

export async function moveApplicationStageService(
  userId: string,
  rawInput: MoveStageInput,
) {
  const input = moveStageSchema.parse(rawInput);
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);
  const allStages = await getUserStages(userId, true);
  const stageById = new Map(allStages.map((s) => [s.id, s]));

  const [app] = await db
    .select()
    .from(applications)
    .where(
      and(eq(applications.id, input.applicationId), eq(applications.userId, userId)),
    );
  if (!app) {
    throw new Error("Application not found.");
  }

  const fromStage = stageById.get(app.currentStageId);
  const toStage = stageById.get(input.toStageId);
  if (!fromStage || !toStage) {
    throw new Error("Target recruitment stage does not exist.");
  }

  const transition = classifyTransition(fromStage, toStage, allStages);
  if (transition.kind === "same") {
    return { application: app, transition };
  }
  if (transition.kind === "invalid") {
    throw new Error(transition.error ?? "Invalid stage transition.");
  }

  if (requiresDialog(transition.kind) && !input.reason?.trim() && !input.note?.trim()) {
    // Allow Kanban/manual moves if they provide a default note or reason, but require non-empty context for reopen
    if (transition.kind === "reopen") {
      throw new Error("Please provide a reason when reopening a closed application.");
    }
  }

  const newOutcome = deriveOutcome(toStage.stageType);
  const effectiveOn = input.effectiveOn || today;
  const isClosing = isTerminal(toStage.stageType);

  let historySource = input.source;
  if (transition.kind === "backward" && input.source === "manual") {
    historySource = "correction";
  } else if (transition.kind === "reopen") {
    historySource = "reopen";
  }

  const [updated, archiveResult] = await db.transaction(async (tx) => {
    const [updatedApp] = await tx
      .update(applications)
      .set({
        currentStageId: toStage.id,
        outcome: newOutcome,
        closedAt: isClosing ? effectiveOn : null,
        nextFollowUpOn: isClosing ? null : app.nextFollowUpOn,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, app.id), eq(applications.userId, userId)))
      .returning();

    // If moving to a terminal stage, cancel any open follow-up tasks
    if (isClosing) {
      await tx
        .update(followUpTasks)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(followUpTasks.userId, userId),
            eq(followUpTasks.applicationId, app.id),
            eq(followUpTasks.status, "open"),
          ),
        );
    }

    // If reopening out of a terminal stage, mark active closure record as restored
    if (transition.kind === "reopen") {
      await tx
        .update(applicationClosureRecords)
        .set({
          status: "restored",
          restoredAt: new Date(),
          restoredToStageId: toStage.id,
          restorationReason: input.reason || "Reopened from recruitment pipeline",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(applicationClosureRecords.userId, userId),
            eq(applicationClosureRecords.applicationId, app.id),
            eq(applicationClosureRecords.status, "archived"),
          ),
        );
    }

    await tx.insert(applicationStatusHistory).values({
      userId,
      applicationId: app.id,
      fromStageId: fromStage.id,
      toStageId: toStage.id,
      effectiveOn,
      source: historySource,
      reason: input.reason || null,
      note:
        input.note ||
        (transition.skipped.length > 0
          ? `Skipped stages: ${transition.skipped.map((s) => s.name).join(", ")}`
          : null),
    });

    await writeAudit(tx, {
      userId,
      entityType: "application",
      entityId: app.id,
      action: "stage_change",
      summary: `Moved ${app.code} from ${fromStage.name} to ${toStage.name}`,
      changes: {
        fromStage: fromStage.name,
        toStage: toStage.name,
        outcome: newOutcome,
        effectiveOn,
      },
    });

    let archived = null;
    if (isClosing && settings.autoArchiveOnTerminal) {
      archived = await archiveApplicationTx(tx, {
        userId,
        applicationId: app.id,
        closureSource: mapHistorySourceToClosureSource(historySource),
        closedOn: effectiveOn,
        previousStageId: fromStage.id,
        previousOutcome: app.outcome,
        closureReason: input.reason || null,
        closureNote: input.note || null,
        isSample: app.isSample,
      });
    }

    return [updatedApp, archived] as const;
  });

  return { application: updated, transition, archive: archiveResult };
}

export const updateApplicationSchema = z.object({
  submittedOn: z.string().trim().min(10),
  platformSourceId: z.string().uuid().optional().nullable(),
  submissionMethod: z.enum(SUBMISSION_METHODS),
  applicationUrl: z.string().trim().optional().nullable(),
  externalReferenceId: z.string().trim().max(120).optional().nullable(),
  confirmationReference: z.string().trim().max(160).optional().nullable(),
  cvVersionLabel: z.string().trim().max(160).optional().nullable(),
  coverLetterVersionLabel: z.string().trim().max(160).optional().nullable(),
  recruiterName: z.string().trim().max(160).optional().nullable(),
  recruiterEmail: z.string().trim().max(160).optional().nullable(),
  recruiterContact: z.string().trim().max(160).optional().nullable(),
  expectedSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).default("IDR"),
  jobCategory: z.string().trim().max(120).optional().nullable(),
  nextFollowUpOn: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(10000).optional().nullable(),
});

export async function updateApplicationService(
  userId: string,
  applicationId: string,
  rawInput: z.infer<typeof updateApplicationSchema>,
) {
  const input = updateApplicationSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(applications)
    .set({
      submittedOn: input.submittedOn,
      platformSourceId: input.platformSourceId ?? null,
      submissionMethod: input.submissionMethod,
      applicationUrl: input.applicationUrl || null,
      externalReferenceId: input.externalReferenceId || null,
      confirmationReference: input.confirmationReference || null,
      cvVersionLabel: input.cvVersionLabel || null,
      coverLetterVersionLabel: input.coverLetterVersionLabel || null,
      recruiterName: input.recruiterName || null,
      recruiterEmail: input.recruiterEmail || null,
      recruiterContact: input.recruiterContact || null,
      expectedSalary: input.expectedSalary ?? null,
      currency: input.currency,
      jobCategory: input.jobCategory || null,
      nextFollowUpOn: input.nextFollowUpOn || null,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new Error("Application not found.");

  await writeAudit(db, {
    userId,
    entityType: "application",
    entityId: applicationId,
    action: "update",
    summary: `Updated application ${updated.code}`,
  });

  return updated;
}

export async function deleteApplicationService(userId: string, applicationId: string) {
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();
  if (!deleted) throw new Error("Application not found.");

  await writeAudit(db, {
    userId,
    entityType: "application",
    entityId: applicationId,
    action: "delete",
    summary: `Deleted application ${deleted.code}`,
  });
  return deleted;
}

export const logCommunicationSchema = z.object({
  applicationId: z.string().uuid(),
  channel: z.enum(COMM_CHANNELS).default("email"),
  direction: z.enum(COMM_DIRECTIONS).default("inbound"),
  classification: z.enum(EMAIL_CLASSIFICATIONS).default("other_recruitment"),
  sender: z.string().trim().max(180).optional().nullable(),
  recipient: z.string().trim().max(180).optional().nullable(),
  subject: z.string().trim().min(1, "Subject or summary is required").max(300),
  snippet: z.string().trim().max(5000).optional().nullable(),
  occurredAt: z.string().trim().optional(),
});

export async function logCommunicationService(
  userId: string,
  rawInput: z.infer<typeof logCommunicationSchema>,
) {
  const input = logCommunicationSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, input.applicationId), eq(applications.userId, userId)));
  if (!app) throw new Error("Application not found.");

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const [comm] = await db
    .insert(emailCommunications)
    .values({
      userId,
      applicationId: app.id,
      source: "manual",
      channel: input.channel,
      direction: input.direction,
      classification: input.classification,
      sender: input.sender || null,
      recipient: input.recipient || null,
      subject: input.subject,
      snippet: input.snippet || null,
      occurredAt,
      linkStatus: "confirmed",
    })
    .returning();

  await db
    .update(applications)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(and(eq(applications.id, app.id), eq(applications.userId, userId)));

  return comm;
}

export const scheduleInterviewSchema = z.object({
  applicationId: z.string().uuid(),
  interviewType: z.enum(INTERVIEW_TYPES).default("hr"),
  startsAt: z.string().trim().min(10, "Interview date and time are required"),
  durationMinutes: z.number().int().min(10).max(480).default(45),
  location: z.string().trim().max(240).optional().nullable(),
  meetingUrl: z.string().trim().max(300).optional().nullable(),
  interviewerName: z.string().trim().max(160).optional().nullable(),
  interviewerPosition: z.string().trim().max(160).optional().nullable(),
  interviewerContact: z.string().trim().max(160).optional().nullable(),
  preparationNotes: z.string().trim().max(5000).optional().nullable(),
  questions: z.string().trim().max(5000).optional().nullable(),
});

export async function scheduleInterviewService(
  userId: string,
  rawInput: z.infer<typeof scheduleInterviewSchema>,
) {
  const input = scheduleInterviewSchema.parse(rawInput);
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);

  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, input.applicationId), eq(applications.userId, userId)));
  if (!app) throw new Error("Application not found.");

  const [created] = await db
    .insert(interviews)
    .values({
      userId,
      applicationId: app.id,
      stageId: app.currentStageId,
      interviewType: input.interviewType,
      startsAt: new Date(input.startsAt),
      durationMinutes: input.durationMinutes,
      timezone: settings.timezone,
      location: input.location || null,
      meetingUrl: input.meetingUrl || null,
      interviewerName: input.interviewerName || null,
      interviewerPosition: input.interviewerPosition || null,
      interviewerContact: input.interviewerContact || null,
      preparationNotes: input.preparationNotes || null,
      questions: input.questions || null,
      status: "scheduled",
      result: "pending",
    })
    .returning();

  await db
    .update(applications)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(and(eq(applications.id, app.id), eq(applications.userId, userId)));

  return created;
}

export const updateInterviewOutcomeSchema = z.object({
  interviewId: z.string().uuid(),
  status: z.enum(INTERVIEW_STATUSES),
  result: z.enum(INTERVIEW_RESULTS),
  feedback: z.string().trim().max(5000).optional().nullable(),
});

export async function updateInterviewOutcomeService(
  userId: string,
  rawInput: z.infer<typeof updateInterviewOutcomeSchema>,
) {
  const input = updateInterviewOutcomeSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [updated] = await db
    .update(interviews)
    .set({
      status: input.status,
      result: input.result,
      feedback: input.feedback ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(interviews.id, input.interviewId), eq(interviews.userId, userId)))
    .returning();
  if (!updated) throw new Error("Interview not found.");
  return updated;
}

export const createFollowUpSchema = z.object({
  applicationId: z.string().uuid().optional().nullable(),
  type: z.enum(FOLLOW_UP_TYPES).default("follow_up"),
  title: z.string().trim().min(1, "Task title is required").max(240),
  dueOn: z.string().trim().min(10, "Due date is required"),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function createFollowUpTaskService(
  userId: string,
  rawInput: z.infer<typeof createFollowUpSchema>,
) {
  const input = createFollowUpSchema.parse(rawInput);
  const db = await ensureDbReady();

  const [task] = await db
    .insert(followUpTasks)
    .values({
      userId,
      applicationId: input.applicationId || null,
      type: input.type,
      title: input.title,
      dueOn: input.dueOn,
      status: "open",
      autoGenerated: false,
      note: input.note || null,
    })
    .returning();

  if (input.applicationId) {
    await syncApplicationNextFollowUp(userId, input.applicationId);
  }
  return task;
}

export async function completeFollowUpTaskService(
  userId: string,
  taskId: string,
  scheduleNextInSequence: boolean = true,
) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const [task] = await db
    .update(followUpTasks)
    .set({
      status: "done",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(followUpTasks.id, taskId), eq(followUpTasks.userId, userId)))
    .returning();

  if (!task) throw new Error("Follow-up task not found.");

  if (scheduleNextInSequence && task.applicationId && task.type === "follow_up") {
    const nextSpec = nextFollowUpInSequence(task.sequenceNo, today, {
      followUpFirstDays: settings.followUpFirstDays,
      followUpSecondDays: settings.followUpSecondDays,
      followUpFinalDays: settings.followUpFinalDays,
      noResponseDays: settings.noResponseDays,
      holidays: settings.holidays ?? [],
    });
    if (nextSpec) {
      await db.insert(followUpTasks).values({
        userId,
        applicationId: task.applicationId,
        type: "follow_up",
        title: nextSpec.title,
        sequenceNo: nextSpec.sequenceNo,
        dueOn: nextSpec.dueOn,
        status: "open",
        autoGenerated: true,
      });
    }
  }

  if (task.applicationId) {
    await syncApplicationNextFollowUp(userId, task.applicationId);
  }
  return task;
}

export async function snoozeFollowUpTaskService(
  userId: string,
  taskId: string,
  newDueOn: string,
) {
  const db = await ensureDbReady();
  const [task] = await db
    .update(followUpTasks)
    .set({ dueOn: newDueOn, updatedAt: new Date() })
    .where(and(eq(followUpTasks.id, taskId), eq(followUpTasks.userId, userId)))
    .returning();
  if (!task) throw new Error("Follow-up task not found.");

  if (task.applicationId) {
    await syncApplicationNextFollowUp(userId, task.applicationId);
  }
  return task;
}

async function syncApplicationNextFollowUp(userId: string, applicationId: string) {
  const db = await ensureDbReady();
  const [earliest] = await db
    .select({ dueOn: followUpTasks.dueOn })
    .from(followUpTasks)
    .where(
      and(
        eq(followUpTasks.userId, userId),
        eq(followUpTasks.applicationId, applicationId),
        eq(followUpTasks.status, "open"),
      ),
    )
    .orderBy(asc(followUpTasks.dueOn))
    .limit(1);

  await db
    .update(applications)
    .set({ nextFollowUpOn: earliest?.dueOn ?? null })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
}
