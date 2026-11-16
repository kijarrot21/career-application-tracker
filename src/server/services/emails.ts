import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureDbReady } from "@/db";
import {
  applications,
  companies,
  emailAccounts,
  emailCommunications,
  jobVacancies,
  notifications,
  recruiterContacts,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  COMM_CHANNELS,
  COMM_DIRECTIONS,
  COMM_SOURCES,
  EMAIL_CLASSIFICATIONS,
  EMAIL_LINK_STATUSES,
  type EmailClassification,
} from "@/lib/constants";
import { encryptSecret } from "@/lib/crypto";
import { normalizeCompanyName } from "@/lib/domain/duplicates";
import {
  classifyRecruitmentEmail,
  matchEmailToApplication,
} from "@/lib/domain/email-classifier";
import {
  fetchGmailMessagesReadOnly,
  fetchOutlookMessagesReadOnly,
  refreshAccessToken,
  type SupportedEmailProvider,
} from "@/lib/email-oauth";
import { moveApplicationStageService } from "./applications";

export async function saveConnectedEmailAccountService(
  userId: string,
  params: {
    provider: SupportedEmailProvider;
    email: string;
    refreshToken: string | null;
    scopes: string[];
  },
) {
  const db = await ensureDbReady();
  const encrypted = params.refreshToken
    ? encryptSecret(params.refreshToken)
    : null;

  const [saved] = await db
    .insert(emailAccounts)
    .values({
      userId,
      provider: params.provider,
      email: params.email.toLowerCase().trim(),
      encryptedRefreshToken: encrypted,
      scopes: params.scopes,
      status: "connected",
    })
    .onConflictDoUpdate({
      target: [
        emailAccounts.userId,
        emailAccounts.provider,
        emailAccounts.email,
      ],
      set: {
        encryptedRefreshToken: encrypted ?? undefined,
        scopes: params.scopes,
        status: "connected",
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAudit(db, {
    userId,
    entityType: "email_account",
    entityId: saved.id,
    action: "create",
    summary: `Connected ${params.provider} account (${params.email})`,
  });

  return saved;
}

export async function disconnectEmailAccountService(
  userId: string,
  accountId: string,
) {
  const db = await ensureDbReady();
  const [deleted] = await db
    .delete(emailAccounts)
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)),
    )
    .returning();
  if (!deleted) throw new Error("Connected email account not found.");

  await writeAudit(db, {
    userId,
    entityType: "email_account",
    entityId: accountId,
    action: "delete",
    summary: `Disconnected ${deleted.provider} account (${deleted.email})`,
  });
  return deleted;
}

export const ingestEmailSchema = z.object({
  emailAccountId: z.string().uuid().optional().nullable(),
  source: z.enum(COMM_SOURCES).default("manual"),
  channel: z.enum(COMM_CHANNELS).default("email"),
  direction: z.enum(COMM_DIRECTIONS).default("inbound"),
  providerMessageId: z.string().trim().max(240).optional().nullable(),
  threadId: z.string().trim().max(240).optional().nullable(),
  sender: z.string().trim().max(240).optional().nullable(),
  recipient: z.string().trim().max(240).optional().nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(400),
  snippet: z.string().trim().max(10000).optional().nullable(),
  occurredAt: z.union([z.string(), z.date()]).optional(),
  overrideClassification: z.enum(EMAIL_CLASSIFICATIONS).optional().nullable(),
  explicitApplicationId: z.string().uuid().optional().nullable(),
});

export type IngestEmailInput = z.infer<typeof ingestEmailSchema>;

/**
 * Classify, match, de-duplicate, and store a recruitment email.
 *
 * IMPORTANT:
 * - Never modifies or sends emails.
 * - Avoids duplicate records on `(userId, source, providerMessageId)`.
 * - Never changes an application's stage automatically; stage changes require
 *   explicit user confirmation via `confirmEmailStageTransitionService`.
 */
export async function ingestEmailMessageService(
  userId: string,
  rawInput: IngestEmailInput,
) {
  const input = ingestEmailSchema.parse(rawInput);
  const db = await ensureDbReady();

  // Check de-duplication if providerMessageId is present
  if (input.providerMessageId) {
    const existing = await db
      .select()
      .from(emailCommunications)
      .where(
        and(
          eq(emailCommunications.userId, userId),
          eq(emailCommunications.source, input.source),
          eq(emailCommunications.providerMessageId, input.providerMessageId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return { email: existing[0], deduplicated: true };
    }
  }

  const classified = classifyRecruitmentEmail({
    sender: input.sender,
    recipient: input.recipient,
    subject: input.subject,
    snippet: input.snippet,
  });

  const finalClassification: EmailClassification =
    input.overrideClassification ?? classified.classification;

  // Load candidate applications for automatic matching
  const appRows = await db
    .select({
      id: applications.id,
      code: applications.code,
      recruiterEmail: applications.recruiterEmail,
      jobTitle: jobVacancies.title,
      companyName: companies.name,
    })
    .from(applications)
    .innerJoin(jobVacancies, eq(applications.vacancyId, jobVacancies.id))
    .innerJoin(companies, eq(jobVacancies.companyId, companies.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.submittedOn));

  let matchedApplicationId: string | null = input.explicitApplicationId ?? null;
  let linkStatus: (typeof EMAIL_LINK_STATUSES)[number] = "unlinked";
  const reasons = [...classified.reasons];

  if (matchedApplicationId) {
    linkStatus = "confirmed";
    reasons.push("Explicitly linked by user");
  } else {
    const match = matchEmailToApplication(
      {
        sender: input.sender,
        subject: input.subject,
        snippet: input.snippet,
        detectedCompany: classified.detectedCompany,
        detectedPosition: classified.detectedPosition,
      },
      appRows,
    );
    if (match.applicationId) {
      matchedApplicationId = match.applicationId;
      linkStatus = "suggested";
      if (match.matchReason) {
        reasons.push(`Matched to ${match.matchReason}`);
      }
    }
  }

  const occurredAt =
    input.occurredAt instanceof Date
      ? input.occurredAt
      : input.occurredAt
        ? new Date(input.occurredAt)
        : new Date();

  const [inserted] = await db
    .insert(emailCommunications)
    .values({
      userId,
      emailAccountId: input.emailAccountId ?? null,
      source: input.source,
      channel: input.channel,
      direction: input.direction,
      providerMessageId: input.providerMessageId ?? null,
      threadId: input.threadId ?? null,
      sender: input.sender ?? null,
      recipient: input.recipient ?? null,
      subject: input.subject,
      snippet: input.snippet ?? null,
      occurredAt,
      classification: finalClassification,
      confidence: classified.confidence,
      classifierReasons: reasons,
      detectedCompany: classified.detectedCompany,
      detectedPosition: classified.detectedPosition,
      applicationId: matchedApplicationId,
      linkStatus,
    })
    .returning();

  return { email: inserted, deduplicated: false };
}

export async function syncEmailAccountService(
  userId: string,
  accountId: string,
) {
  const db = await ensureDbReady();
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)),
    );

  if (!account) {
    throw new Error("Connected email account not found.");
  }
  if (!account.encryptedRefreshToken) {
    throw new Error(
      "This email account does not have an active OAuth refresh token. Reconnect the account.",
    );
  }

  const accessToken = await refreshAccessToken({
    provider: account.provider,
    encryptedRefreshToken: account.encryptedRefreshToken,
  });

  const remoteMessages =
    account.provider === "gmail"
      ? await fetchGmailMessagesReadOnly(accessToken)
      : await fetchOutlookMessagesReadOnly(accessToken);

  let importedCount = 0;
  let skippedDuplicates = 0;

  for (const msg of remoteMessages) {
    const res = await ingestEmailMessageService(userId, {
      emailAccountId: account.id,
      source: account.provider,
      channel: "email",
      direction: "inbound",
      providerMessageId: msg.providerMessageId,
      threadId: msg.threadId,
      sender: msg.sender,
      recipient: msg.recipient,
      subject: msg.subject,
      snippet: msg.snippet,
      occurredAt: msg.occurredAt,
    });
    if (res.deduplicated) skippedDuplicates++;
    else importedCount++;
  }

  await db
    .update(emailAccounts)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(emailAccounts.id, account.id));

  return { importedCount, skippedDuplicates, totalScanned: remoteMessages.length };
}

export async function linkEmailToApplicationService(
  userId: string,
  params: {
    emailId: string;
    applicationId: string | null;
    linkStatus: "confirmed" | "unlinked" | "ignored";
    classification?: EmailClassification;
  },
) {
  const db = await ensureDbReady();

  if (params.applicationId) {
    const [app] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.id, params.applicationId),
          eq(applications.userId, userId),
        ),
      );
    if (!app) throw new Error("Target application not found.");
  }

  const [updated] = await db
    .update(emailCommunications)
    .set({
      applicationId: params.applicationId,
      linkStatus: params.linkStatus,
      classification: params.classification ?? undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(emailCommunications.id, params.emailId),
        eq(emailCommunications.userId, userId),
      ),
    )
    .returning();

  if (!updated) throw new Error("Email record not found.");
  return updated;
}

/**
 * User-confirmed stage transition triggered from a classified recruitment email.
 */
export async function confirmEmailStageTransitionService(
  userId: string,
  params: {
    emailId: string;
    applicationId: string;
    toStageId: string;
    effectiveOn?: string;
    reason?: string | null;
  },
) {
  const db = await ensureDbReady();

  const [email] = await db
    .select()
    .from(emailCommunications)
    .where(
      and(
        eq(emailCommunications.id, params.emailId),
        eq(emailCommunications.userId, userId),
      ),
    );
  if (!email) throw new Error("Email record not found.");

  // Confirm the email link first
  await db
    .update(emailCommunications)
    .set({
      applicationId: params.applicationId,
      linkStatus: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(emailCommunications.id, email.id));

  const effectiveOn =
    params.effectiveOn ?? email.occurredAt.toISOString().slice(0, 10);

  const moveResult = await moveApplicationStageService(userId, {
    applicationId: params.applicationId,
    toStageId: params.toStageId,
    effectiveOn,
    source: "email_suggestion",
    reason:
      params.reason ??
      `Confirmed from recruitment email: "${email.subject}"`,
    note: `Linked email from ${email.sender ?? "recruiter"} (${email.classification})`,
  });

  return moveResult;
}

export const recruiterContactSchema = z.object({
  companyName: z.string().trim().max(160).optional().nullable(),
  name: z.string().trim().min(1, "Recruiter name is required").max(160),
  title: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().max(180).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  linkedinUrl: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function createRecruiterContactService(
  userId: string,
  rawInput: z.infer<typeof recruiterContactSchema>,
) {
  const input = recruiterContactSchema.parse(rawInput);
  const db = await ensureDbReady();

  let companyId: string | null = null;
  if (input.companyName?.trim()) {
    const norm = normalizeCompanyName(input.companyName);
    const existing = await db
      .select()
      .from(companies)
      .where(
        and(eq(companies.userId, userId), eq(companies.normalizedName, norm)),
      )
      .limit(1);
    if (existing.length > 0) {
      companyId = existing[0].id;
    } else {
      const [createdCo] = await db
        .insert(companies)
        .values({
          userId,
          name: input.companyName.trim(),
          normalizedName: norm || input.companyName.toLowerCase().trim(),
        })
        .returning({ id: companies.id });
      companyId = createdCo.id;
    }
  }

  const [contact] = await db
    .insert(recruiterContacts)
    .values({
      userId,
      companyId,
      name: input.name,
      title: input.title || null,
      email: input.email || null,
      phone: input.phone || null,
      linkedinUrl: input.linkedinUrl || null,
      notes: input.notes || null,
    })
    .returning();

  return contact;
}

export async function deleteRecruiterContactService(
  userId: string,
  contactId: string,
) {
  const db = await ensureDbReady();
  await db
    .delete(recruiterContacts)
    .where(
      and(
        eq(recruiterContacts.id, contactId),
        eq(recruiterContacts.userId, userId),
      ),
    );
}

export async function dismissNotificationService(
  userId: string,
  notificationKey: string,
) {
  const db = await ensureDbReady();
  await db.insert(notifications).values({
    userId,
    type: notificationKey,
    title: "Dismissed",
    readAt: new Date(),
    dismissedAt: new Date(),
  });
}
