import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applications,
  applicationStages,
  companies,
  emailAccounts,
  emailCommunications,
  followUpTasks,
  interviews,
  jobVacancies,
  notifications,
  recruiterContacts,
} from "@/db/schema";
import type { EmailClassification } from "@/lib/constants";
import { daysBetween, todayInTimeZone } from "@/lib/domain/business-days";
import { suggestedStageTypeForClassification } from "@/lib/domain/email-classifier";
import { progressRank } from "@/lib/domain/stages";
import { getOAuthRedirectUri } from "@/lib/email-oauth";
import { isGmailOAuthConfigured, isOutlookOAuthConfigured } from "@/lib/env";
import { getUserSettings, getUserStages } from "./settings";

export interface EmailCenterFilters {
  search?: string;
  classification?: EmailClassification | "all";
  linkStatus?: "all" | "suggested" | "confirmed" | "unlinked" | "ignored";
  source?: "all" | "gmail" | "outlook" | "manual";
}

export async function getEmailCenterData(
  userId: string,
  filters: EmailCenterFilters = {},
) {
  const db = await ensureDbReady();
  const stages = await getUserStages(userId, false);

  const accounts = await db
    .select({
      id: emailAccounts.id,
      provider: emailAccounts.provider,
      email: emailAccounts.email,
      scopes: emailAccounts.scopes,
      lastSyncedAt: emailAccounts.lastSyncedAt,
      status: emailAccounts.status,
      createdAt: emailAccounts.createdAt,
    })
    .from(emailAccounts)
    .where(eq(emailAccounts.userId, userId))
    .orderBy(asc(emailAccounts.createdAt));

  const appRows = await db
    .select({
      app: applications,
      vacancy: jobVacancies,
      company: companies,
      stage: applicationStages,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .innerJoin(applicationStages, eq(applications.currentStageId, applicationStages.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  const appById = new Map(
    appRows.map((r) => [
      r.app.id,
      {
        id: r.app.id,
        code: r.app.code,
        jobTitle: r.vacancy.title,
        companyName: r.company.name,
        recruiterEmail: r.app.recruiterEmail,
        currentStageId: r.stage.id,
        currentStageName: r.stage.name,
        currentStageColor: r.stage.color,
        currentStageType: r.stage.stageType,
        outcome: r.app.outcome,
      },
    ]),
  );

  const commRows = await db
    .select()
    .from(emailCommunications)
    .where(
      and(
        eq(emailCommunications.userId, userId),
        filters.classification && filters.classification !== "all"
          ? eq(emailCommunications.classification, filters.classification)
          : undefined,
        filters.linkStatus && filters.linkStatus !== "all"
          ? eq(emailCommunications.linkStatus, filters.linkStatus)
          : undefined,
        filters.source && filters.source !== "all"
          ? eq(emailCommunications.source, filters.source)
          : undefined,
        filters.search
          ? or(
              ilike(emailCommunications.subject, `%${filters.search}%`),
              ilike(emailCommunications.sender, `%${filters.search}%`),
              ilike(emailCommunications.detectedCompany, `%${filters.search}%`),
              ilike(emailCommunications.detectedPosition, `%${filters.search}%`),
              ilike(emailCommunications.snippet, `%${filters.search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(emailCommunications.occurredAt), desc(emailCommunications.createdAt));

  const emails = commRows.map((c) => {
    const linkedApp = c.applicationId ? (appById.get(c.applicationId) ?? null) : null;
    const suggestedType = suggestedStageTypeForClassification(c.classification);

    let suggestedStage: {
      id: string;
      name: string;
      color: string;
      stageType: typeof stages[number]["stageType"];
    } | null = null;

    if (suggestedType && linkedApp) {
      const targetStage = stages.find((s) => s.stageType === suggestedType);
      if (targetStage && targetStage.id !== linkedApp.currentStageId) {
        const isTerminalSuggestion =
          suggestedType === "rejected" || suggestedType === "offer";
        const isForwardProgress =
          progressRank(suggestedType) > progressRank(linkedApp.currentStageType);
        if (
          (isTerminalSuggestion && linkedApp.outcome === "active") ||
          isForwardProgress
        ) {
          suggestedStage = {
            id: targetStage.id,
            name: targetStage.name,
            color: targetStage.color,
            stageType: targetStage.stageType,
          };
        }
      }
    }

    return {
      ...c,
      linkedApplication: linkedApp,
      suggestedStage,
    };
  });

  // Recruiter contacts & interaction counts
  const contactRows = await db
    .select({
      contact: recruiterContacts,
      companyName: companies.name,
    })
    .from(recruiterContacts)
    .leftJoin(companies, eq(recruiterContacts.companyId, companies.id))
    .where(eq(recruiterContacts.userId, userId))
    .orderBy(desc(recruiterContacts.updatedAt));

  const recruiterDirectory = contactRows.map((r) => {
    const emailLower = (r.contact.email ?? "").toLowerCase();
    const interactions = emailLower
      ? commRows.filter(
          (c) =>
            (c.sender ?? "").toLowerCase().includes(emailLower) ||
            (c.recipient ?? "").toLowerCase().includes(emailLower),
        )
      : [];
    return {
      ...r.contact,
      companyName: r.companyName ?? null,
      interactionsCount: interactions.length,
      lastContactedAt: interactions[0]?.occurredAt ?? null,
    };
  });

  return {
    oauthStatus: {
      gmailConfigured: isGmailOAuthConfigured(),
      outlookConfigured: isOutlookOAuthConfigured(),
      gmailRedirectUri: getOAuthRedirectUri("gmail"),
      outlookRedirectUri: getOAuthRedirectUri("outlook"),
    },
    accounts,
    emails,
    applications: [...appById.values()],
    stages,
    recruiterDirectory,
  };
}

export interface LiveNotificationItem {
  id: string;
  category:
    | "overdue_followup"
    | "due_followup"
    | "upcoming_interview"
    | "upcoming_deadline"
    | "email_suggestion";
  title: string;
  body: string;
  href: string;
  severity: "urgent" | "warning" | "info";
}

export async function getNotificationsSummary(userId: string): Promise<{
  items: LiveNotificationItem[];
  urgentCount: number;
}> {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const dismissedRows = await db
    .select({ type: notifications.type })
    .from(notifications)
    .where(eq(notifications.userId, userId));
  const dismissedKeys = new Set(dismissedRows.map((d) => d.type));

  const items: LiveNotificationItem[] = [];

  // 1. Open follow-up tasks (overdue or due within 2 days)
  const openTasks = await db
    .select({
      task: followUpTasks,
      appCode: applications.code,
    })
    .from(followUpTasks)
    .leftJoin(applications, eq(followUpTasks.applicationId, applications.id))
    .where(and(eq(followUpTasks.userId, userId), eq(followUpTasks.status, "open")))
    .orderBy(asc(followUpTasks.dueOn));

  for (const row of openTasks) {
    const key = `task:${row.task.id}:${row.task.dueOn}`;
    if (dismissedKeys.has(key)) continue;
    const diff = daysBetween(today, row.task.dueOn); // dueOn - today
    if (diff < 0) {
      items.push({
        id: key,
        category: "overdue_followup",
        title: `Overdue Follow-up (${Math.abs(diff)}d overdue)`,
        body: `${row.task.title}${row.appCode ? ` (${row.appCode})` : ""}`,
        href: row.task.applicationId
          ? `/applications/${row.task.applicationId}?tab=followups`
          : "/dashboard",
        severity: "urgent",
      });
    } else if (diff <= 2) {
      items.push({
        id: key,
        category: "due_followup",
        title: diff === 0 ? "Follow-up Due Today" : `Follow-up Due in ${diff}d`,
        body: `${row.task.title}${row.appCode ? ` (${row.appCode})` : ""}`,
        href: row.task.applicationId
          ? `/applications/${row.task.applicationId}?tab=followups`
          : "/dashboard",
        severity: "warning",
      });
    }
  }

  // 2. Upcoming interviews within next 3 days
  const scheduledInterviews = await db
    .select({
      interview: interviews,
      appCode: applications.code,
      companyName: companies.name,
      jobTitle: jobVacancies.title,
    })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(and(eq(interviews.userId, userId), eq(interviews.status, "scheduled")))
    .orderBy(asc(interviews.startsAt));

  for (const row of scheduledInterviews) {
    const intDate = row.interview.startsAt.toISOString().slice(0, 10);
    const diff = daysBetween(today, intDate);
    const key = `interview:${row.interview.id}`;
    if (dismissedKeys.has(key)) continue;
    if (diff >= 0 && diff <= 3) {
      items.push({
        id: key,
        category: "upcoming_interview",
        title:
          diff === 0
            ? `Interview Today with ${row.companyName}`
            : `Upcoming Interview in ${diff}d (${row.companyName})`,
        body: `${row.jobTitle} (${row.appCode})`,
        href: `/applications/${row.interview.applicationId}?tab=interviews`,
        severity: diff <= 1 ? "urgent" : "info",
      });
    }
  }

  // 3. Vacancy deadlines within 3 days (unapplied)
  const vacancies = await db
    .select({
      vacancy: jobVacancies,
      companyName: companies.name,
    })
    .from(jobVacancies)
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(eq(jobVacancies.userId, userId));

  for (const row of vacancies) {
    if (!row.vacancy.deadline) continue;
    if (
      row.vacancy.triageStatus !== "interested" &&
      row.vacancy.triageStatus !== "shortlisted"
    )
      continue;
    const key = `deadline:${row.vacancy.id}:${row.vacancy.deadline}`;
    if (dismissedKeys.has(key)) continue;
    const diff = daysBetween(today, row.vacancy.deadline);
    if (diff >= 0 && diff <= 3) {
      items.push({
        id: key,
        category: "upcoming_deadline",
        title:
          diff === 0
            ? "Application Deadline Today"
            : `Application Deadline in ${diff}d`,
        body: `${row.vacancy.title} at ${row.companyName} (${row.vacancy.code})`,
        href: `/jobs/${row.vacancy.id}`,
        severity: diff <= 1 ? "urgent" : "warning",
      });
    }
  }

  // 4. Suggested email links awaiting confirmation
  const suggestedEmails = await db
    .select()
    .from(emailCommunications)
    .where(
      and(
        eq(emailCommunications.userId, userId),
        eq(emailCommunications.linkStatus, "suggested"),
      ),
    )
    .limit(5);

  for (const e of suggestedEmails) {
    const key = `email_sug:${e.id}`;
    if (dismissedKeys.has(key)) continue;
    items.push({
      id: key,
      category: "email_suggestion",
      title: "Recruitment Email Needs Confirmation",
      body: e.subject,
      href: "/emails",
      severity: "info",
    });
  }

  const urgentCount = items.filter((i) => i.severity === "urgent").length;
  return { items: items.slice(0, 12), urgentCount };
}
