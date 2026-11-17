import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import {
  applicationArchiveDocuments,
  applicationArchiveSnapshots,
  applicationClosureRecords,
  applications,
  applicationStages,
  companies,
  jobVacancies,
} from "@/db/schema";
import {
  evaluateRetentionState,
  type ArchiveOutcome,
  type ClosureRecordStatus,
} from "@/lib/domain/archive";
import { todayInTimeZone } from "@/lib/domain/business-days";
import { isTerminal, isVacancyLevel } from "@/lib/domain/stages";
import { computeSnapshotContentHash } from "@/server/services/archive";
import { getUserSettings, getUserStages } from "./settings";

export interface ArchiveFilters {
  search?: string;
  outcome?: ArchiveOutcome | "all";
  company?: string;
  jobTitle?: string;
  fromDate?: string;
  toDate?: string;
  status?: ClosureRecordStatus | "all";
}

export async function listArchivedApplications(
  userId: string,
  filters: ArchiveFilters = {},
) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const statusFilter = filters.status ?? "archived";

  const rows = await db
    .select({
      closure: applicationClosureRecords,
      snapshot: applicationArchiveSnapshots,
      app: applications,
      vacancy: jobVacancies,
      company: companies,
    })
    .from(applicationClosureRecords)
    .innerJoin(
      applicationArchiveSnapshots,
      and(
        eq(
          applicationArchiveSnapshots.closureRecordId,
          applicationClosureRecords.id,
        ),
        eq(applicationArchiveSnapshots.userId, userId),
      ),
    )
    .innerJoin(
      applications,
      and(
        eq(applicationClosureRecords.applicationId, applications.id),
        eq(applications.userId, userId),
      ),
    )
    .innerJoin(
      jobVacancies,
      and(
        eq(applications.vacancyId, jobVacancies.id),
        eq(jobVacancies.userId, userId),
      ),
    )
    .innerJoin(
      companies,
      and(
        eq(jobVacancies.companyId, companies.id),
        eq(companies.userId, userId),
      ),
    )
    .where(
      and(
        eq(applicationClosureRecords.userId, userId),
        statusFilter !== "all"
          ? eq(applicationClosureRecords.status, statusFilter)
          : undefined,
        filters.outcome && filters.outcome !== "all"
          ? eq(applicationClosureRecords.closureOutcome, filters.outcome)
          : undefined,
        filters.fromDate
          ? gte(applicationClosureRecords.closedOn, filters.fromDate)
          : undefined,
        filters.toDate
          ? lte(applicationClosureRecords.closedOn, filters.toDate)
          : undefined,
        filters.company?.trim()
          ? ilike(
              applicationArchiveSnapshots.companyName,
              `%${filters.company.trim()}%`,
            )
          : undefined,
        filters.jobTitle?.trim()
          ? ilike(
              applicationArchiveSnapshots.jobTitle,
              `%${filters.jobTitle.trim()}%`,
            )
          : undefined,
        filters.search?.trim()
          ? or(
              ilike(
                applicationArchiveSnapshots.applicationCode,
                `%${filters.search.trim()}%`,
              ),
              ilike(
                applicationArchiveSnapshots.companyName,
                `%${filters.search.trim()}%`,
              ),
              ilike(
                applicationArchiveSnapshots.jobTitle,
                `%${filters.search.trim()}%`,
              ),
              ilike(
                applicationClosureRecords.closureReason,
                `%${filters.search.trim()}%`,
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(applicationClosureRecords.closedOn),
      desc(applicationClosureRecords.archivedAt),
    );

  // Determine whether each vacancy currently has an active application (blocks duplicate re-apply)
  const activeApps = await db
    .select({ vacancyId: applications.vacancyId })
    .from(applications)
    .where(
      and(eq(applications.userId, userId), eq(applications.outcome, "active")),
    );
  const activeVacancySet = new Set(activeApps.map((a) => a.vacancyId));

  // Count preserved archive documents per closure record
  const archiveDocs = await db
    .select({ closureRecordId: applicationArchiveDocuments.closureRecordId })
    .from(applicationArchiveDocuments)
    .where(eq(applicationArchiveDocuments.userId, userId));
  const docCountByClosure = new Map<string, number>();
  for (const d of archiveDocs) {
    docCountByClosure.set(
      d.closureRecordId,
      (docCountByClosure.get(d.closureRecordId) ?? 0) + 1,
    );
  }

  const items = rows.map((r) => {
    const retentionState = evaluateRetentionState(r.closure.retainUntil, today);
    return {
      ...r.closure,
      snapshot: {
        id: r.snapshot.id,
        snapshotVersion: r.snapshot.snapshotVersion,
        applicationCode: r.snapshot.applicationCode,
        companyName: r.snapshot.companyName,
        jobTitle: r.snapshot.jobTitle,
        submittedOn: r.snapshot.submittedOn,
        attemptNumber: r.snapshot.attemptNumber,
        contentHash: r.snapshot.contentHash,
        capturedAt: r.snapshot.capturedAt,
      },
      currentApplicationOutcome: r.app.outcome,
      hasActiveApplicationForVacancy: activeVacancySet.has(r.vacancy.id),
      documentsCount: docCountByClosure.get(r.closure.id) ?? 0,
      retentionState,
    };
  });

  const stats = {
    totalArchived: items.filter((i) => i.status === "archived").length,
    rejectedCount: items.filter(
      (i) => i.status === "archived" && i.closureOutcome === "rejected",
    ).length,
    withdrawnCount: items.filter(
      (i) => i.status === "archived" && i.closureOutcome === "withdrawn",
    ).length,
    hiredCount: items.filter(
      (i) => i.status === "archived" && i.closureOutcome === "hired",
    ).length,
    noResponseCount: items.filter(
      (i) => i.status === "archived" && i.closureOutcome === "no_response",
    ).length,
    closedCount: items.filter(
      (i) => i.status === "archived" && i.closureOutcome === "closed",
    ).length,
    expiringOrExpiredCount: items.filter(
      (i) =>
        i.status === "archived" &&
        (i.retentionState === "expiring_soon" ||
          i.retentionState === "expired"),
    ).length,
    expiredCount: items.filter(
      (i) => i.status === "archived" && i.retentionState === "expired",
    ).length,
  };

  return {
    items,
    stats,
    retentionPolicy: {
      autoArchiveOnTerminal: settings.autoArchiveOnTerminal,
      archiveRetentionDays: settings.archiveRetentionDays,
      archiveAutoDeleteExpired: settings.archiveAutoDeleteExpired,
    },
  };
}

export async function getArchivedApplicationDetail(
  userId: string,
  closureRecordId: string,
) {
  const db = await ensureDbReady();
  const settings = await getUserSettings(userId);
  const today = todayInTimeZone(settings.timezone);

  const [row] = await db
    .select({
      closure: applicationClosureRecords,
      snapshot: applicationArchiveSnapshots,
      app: applications,
      currentStage: applicationStages,
    })
    .from(applicationClosureRecords)
    .innerJoin(
      applicationArchiveSnapshots,
      and(
        eq(
          applicationArchiveSnapshots.closureRecordId,
          applicationClosureRecords.id,
        ),
        eq(applicationArchiveSnapshots.userId, userId),
      ),
    )
    .innerJoin(
      applications,
      and(
        eq(applicationClosureRecords.applicationId, applications.id),
        eq(applications.userId, userId),
      ),
    )
    .innerJoin(
      applicationStages,
      and(
        eq(applications.currentStageId, applicationStages.id),
        eq(applicationStages.userId, userId),
      ),
    )
    .where(
      and(
        eq(applicationClosureRecords.id, closureRecordId),
        eq(applicationClosureRecords.userId, userId),
      ),
    );

  if (!row) return null;

  const archiveDocuments = await db
    .select()
    .from(applicationArchiveDocuments)
    .where(
      and(
        eq(applicationArchiveDocuments.userId, userId),
        eq(applicationArchiveDocuments.closureRecordId, closureRecordId),
      ),
    );

  const siblingAttempts = await db
    .select({
      id: applications.id,
      code: applications.code,
      attemptNumber: applications.attemptNumber,
      outcome: applications.outcome,
      submittedOn: applications.submittedOn,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        eq(applications.vacancyId, row.closure.vacancyId),
      ),
    )
    .orderBy(desc(applications.attemptNumber));

  const hasActiveApplicationForVacancy = siblingAttempts.some(
    (a) => a.outcome === "active",
  );

  const expectedHash = computeSnapshotContentHash(row.snapshot.snapshotPayload);
  const integrityVerified = expectedHash === row.snapshot.contentHash;

  const allStages = await getUserStages(userId, false);
  const activeRestoreStages = allStages.filter(
    (s) => !isTerminal(s.stageType) && !isVacancyLevel(s.stageType),
  );

  return {
    closure: row.closure,
    snapshot: row.snapshot,
    integrityVerified,
    retentionState: evaluateRetentionState(row.closure.retainUntil, today),
    liveApplication: {
      id: row.app.id,
      code: row.app.code,
      outcome: row.app.outcome,
      currentStageName: row.currentStage.name,
      currentStageColor: row.currentStage.color,
    },
    archiveDocuments,
    siblingAttempts,
    hasActiveApplicationForVacancy,
    activeRestoreStages,
    retentionPolicy: {
      autoArchiveOnTerminal: settings.autoArchiveOnTerminal,
      archiveRetentionDays: settings.archiveRetentionDays,
      archiveAutoDeleteExpired: settings.archiveAutoDeleteExpired,
    },
  };
}

export async function listArchivableApplications(userId: string) {
  const db = await ensureDbReady();

  const rows = await db
    .select({
      id: applications.id,
      code: applications.code,
      outcome: applications.outcome,
      submittedOn: applications.submittedOn,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
      stageName: applicationStages.name,
    })
    .from(applications)
    .innerJoin(
      jobVacancies,
      and(
        eq(applications.vacancyId, jobVacancies.id),
        eq(jobVacancies.userId, userId),
      ),
    )
    .innerJoin(
      companies,
      and(
        eq(jobVacancies.companyId, companies.id),
        eq(companies.userId, userId),
      ),
    )
    .innerJoin(
      applicationStages,
      and(
        eq(applications.currentStageId, applicationStages.id),
        eq(applicationStages.userId, userId),
      ),
    )
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  const archived = await db
    .select({ applicationId: applicationClosureRecords.applicationId })
    .from(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.userId, userId),
        eq(applicationClosureRecords.status, "archived"),
      ),
    );
  const archivedSet = new Set(archived.map((a) => a.applicationId));

  return rows.filter((r) => !archivedSet.has(r.id));
}

export async function getActiveArchiveForApplication(
  userId: string,
  applicationId: string,
) {
  const db = await ensureDbReady();
  const [record] = await db
    .select({
      id: applicationClosureRecords.id,
      closureOutcome: applicationClosureRecords.closureOutcome,
      closedOn: applicationClosureRecords.closedOn,
      archivedAt: applicationClosureRecords.archivedAt,
    })
    .from(applicationClosureRecords)
    .where(
      and(
        eq(applicationClosureRecords.userId, userId),
        eq(applicationClosureRecords.applicationId, applicationId),
        eq(applicationClosureRecords.status, "archived"),
      ),
    )
    .limit(1);
  return record ?? null;
}
