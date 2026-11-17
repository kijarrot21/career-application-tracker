"use client";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArchiveOutcomeBadge,
  ReapplyFromArchiveDialog,
  RestoreArchiveDialog,
} from "@/components/archive/archive-dialogs";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  OutcomeBadge,
  PageHeader,
  SampleBadge,
  StageBadge,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import {
  ARCHIVE_CLOSURE_SOURCE_LABELS,
  type ArchiveClosureSource,
} from "@/lib/domain/archive";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  deleteArchiveRecordAction,
  updateClosureRetentionAction,
} from "@/server/actions/archive";
import type { getArchivedApplicationDetail } from "@/server/queries/archive";

type ArchiveDetailData = NonNullable<
  Awaited<ReturnType<typeof getArchivedApplicationDetail>>
>;

type DetailTab = "overview" | "timeline" | "activity" | "documents";

export function ArchiveDetailClient({
  data,
  defaultCurrency,
}: {
  data: ArchiveDetailData;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [reapplyOpen, setReapplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [retainInput, setRetainInput] = useState(
    data.closure.retainUntil ?? "",
  );

  const snap = data.snapshot.snapshotPayload;
  const { closure } = data;

  function handleSaveRetention(nextDate: string | null) {
    startTransition(async () => {
      try {
        await updateClosureRetentionAction({
          closureRecordId: closure.id,
          retainUntil: nextDate,
        });
        setRetainInput(nextDate ?? "");
        toast.success(
          nextDate
            ? `Retention deadline updated to ${nextDate}.`
            : "Retention set to indefinite.",
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update retention.",
        );
      }
    });
  }

  function handleDeleteArchive() {
    startTransition(async () => {
      try {
        await deleteArchiveRecordAction(closure.id);
        toast.success(
          "Archive record deleted. Original application record was preserved.",
        );
        router.push("/archive");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete archive.",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/archive">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Archive
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/applications/${data.liveApplication.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              View Original Record ({data.liveApplication.code})
            </Link>
          </Button>
          {closure.status === "archived" &&
            !data.hasActiveApplicationForVacancy && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRestoreOpen(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore to Active
              </Button>
            )}
          {!data.hasActiveApplicationForVacancy && (
            <Button size="sm" onClick={() => setReapplyOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-apply (New Attempt)
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Archive
          </Button>
        </div>
      </div>

      <PageHeader
        breadcrumbs={[
          { label: "Application Archive", href: "/archive" },
          { label: snap.application.code },
        ]}
        title={`${snap.vacancy.title} — ${snap.company.name}`}
        description={`Immutable historical snapshot #${data.snapshot.snapshotVersion} for ${snap.application.code} (Attempt #${snap.application.attemptNumber}).`}
      />

      {/* Immutability & Closure Summary Card */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono tabular-nums">
                {snap.application.code}
              </Badge>
              <ArchiveOutcomeBadge outcome={closure.closureOutcome} />
              {closure.status === "restored" && (
                <Badge variant="info">Restored to Active Pipeline</Badge>
              )}
              {data.closure.isSample && <SampleBadge />}
              <Badge
                variant={data.integrityVerified ? "success" : "destructive"}
              >
                {data.integrityVerified ? (
                  <>
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    SHA-256 Verified Immutable
                  </>
                ) : (
                  <>
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    Hash Verification Warning
                  </>
                )}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <span>
                Submitted:{" "}
                <strong className="text-foreground">
                  {formatDate(snap.application.submittedOn)}
                </strong>
              </span>
              <span>
                Closed On:{" "}
                <strong className="text-foreground">
                  {formatDate(closure.closedOn)}
                </strong>
              </span>
              <span>
                Captured:{" "}
                <strong className="text-foreground">
                  {formatDateTime(data.snapshot.capturedAt)}
                </strong>
              </span>
              <span>
                Source:{" "}
                <strong className="text-foreground">
                  {
                    ARCHIVE_CLOSURE_SOURCE_LABELS[
                      closure.closureSource as ArchiveClosureSource
                    ]
                  }
                </strong>
              </span>
            </div>

            <p className="font-mono text-[11px] text-subtle-foreground">
              Snapshot Hash: {data.snapshot.contentHash.slice(0, 24)}...
            </p>
          </div>

          {/* Retention Controls */}
          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3 text-xs">
            <p className="font-semibold text-foreground">
              Retention Policy
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={retainInput}
                onChange={(e) => setRetainInput(e.target.value)}
                aria-label="Retain archive until date"
                className="h-8 w-auto text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending || !retainInput}
                onClick={() => handleSaveRetention(retainInput || null)}
              >
                Set Date
              </Button>
              {closure.retainUntil && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleSaveRetention(null)}
                >
                  Indefinite
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {closure.retainUntil
                ? data.retentionState === "expired"
                  ? `Expired on ${formatDate(closure.retainUntil)}.`
                  : `Retained until ${formatDate(closure.retainUntil)}.`
                : "Retained indefinitely unless manually deleted."}
            </p>
          </div>
        </div>

        {(closure.closureReason || closure.closureNote) && (
          <div className="rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-xs">
            {closure.closureReason && (
              <p className="font-medium text-foreground">
                Closure Reason: {closure.closureReason}
              </p>
            )}
            {closure.closureNote && (
              <p className="mt-1 text-muted-foreground">
                {closure.closureNote}
              </p>
            )}
          </div>
        )}

        {closure.status === "restored" && (
          <div className="rounded-xl border border-info-border bg-info-soft px-3.5 py-2.5 text-xs text-info-on-soft">
            <p className="font-semibold">
              Restored on{" "}
              {closure.restoredAt
                ? formatDateTime(closure.restoredAt)
                : "unknown date"}
            </p>
            {closure.restorationReason && (
              <p className="mt-0.5">Reason: {closure.restorationReason}</p>
            )}
            <p className="mt-0.5 text-[11px] opacity-85">
              This historical snapshot remains read-only and unmodified.
            </p>
          </div>
        )}
      </Card>

      {/* AI Analysis Placeholder (Phase 4 Entry Point) */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-on-soft">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                AI Career Post-Mortem &amp; Outcome Insights
              </p>
              <Badge variant="outline">Coming in AI Phase</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Future Hybrid AI analysis will inspect this immutable snapshot to
              summarize skill gaps, interview feedback patterns, and tailored
              re-application recommendations.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" disabled title="Available once Hybrid AI Engine is implemented">
          <Lock className="h-3.5 w-3.5" />
          Analyze Snapshot (Unavailable)
        </Button>
      </Card>

      {/* Detail Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview &amp; Fit</TabsTrigger>
          <TabsTrigger value="timeline">
            Historical Timeline ({snap.statusHistory.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Comms, Interviews &amp; Offers (
            {snap.communications.length +
              snap.interviews.length +
              snap.assessments.length +
              (snap.offer ? 1 : 0)}
            )
          </TabsTrigger>
          <TabsTrigger value="documents">
            Document History ({data.archiveDocuments.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="space-y-4 p-5 lg:col-span-2">
            <h2 className="text-section-title text-foreground">
              Application Snapshot Details
            </h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="font-semibold text-foreground">
                  {snap.company.name}
                  {snap.company.industry ? ` (${snap.company.industry})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stage at Closure</dt>
                <dd className="mt-0.5">
                  <StageBadge
                    name={snap.application.stageAtClosure.name}
                    color={snap.application.stageAtClosure.color}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Platform / Method</dt>
                <dd className="font-medium text-foreground">
                  {snap.application.platformName ?? "Direct"} •{" "}
                  {snap.application.submissionMethod}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expected Salary</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  {snap.application.expectedSalary != null
                    ? formatMoney(
                        snap.application.expectedSalary,
                        snap.application.currency,
                      )
                    : "Not specified"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recruiter Contact</dt>
                <dd className="font-medium text-foreground">
                  {snap.application.recruiterName || "—"}
                  {snap.application.recruiterEmail
                    ? ` (${snap.application.recruiterEmail})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location &amp; Mode</dt>
                <dd className="font-medium text-foreground">
                  {snap.vacancy.location || "—"}
                  {snap.vacancy.workArrangement
                    ? ` • ${snap.vacancy.workArrangement}`
                    : ""}
                </dd>
              </div>
            </dl>

            {snap.application.reapplyReason && (
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3 text-xs">
                <p className="font-semibold text-foreground">
                  Re-application Context (Attempt #{snap.application.attemptNumber})
                </p>
                <p className="mt-1 text-muted-foreground">
                  {snap.application.reapplyReason}
                </p>
              </div>
            )}

            {snap.application.notes && (
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-foreground">
                  Preserved Application Notes
                </p>
                <p className="whitespace-pre-wrap rounded-xl border border-border-subtle bg-surface-subtle p-3 text-muted-foreground">
                  {snap.application.notes}
                </p>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="space-y-3 p-5">
              <h3 className="text-card-title text-foreground">
                Suitability Score at Closure
              </h3>
              {snap.suitabilityEvaluation ? (
                <div className="space-y-2 text-xs">
                  <p className="font-display text-3xl font-bold text-primary-text tabular-nums">
                    {snap.suitabilityEvaluation.overallScore ?? "—"}%
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                    <span>
                      Skills: {snap.suitabilityEvaluation.skillsScore ?? "—"}
                    </span>
                    <span>
                      Experience:{" "}
                      {snap.suitabilityEvaluation.experienceScore ?? "—"}
                    </span>
                    <span>
                      Education:{" "}
                      {snap.suitabilityEvaluation.educationScore ?? "—"}
                    </span>
                    <span>
                      Salary: {snap.suitabilityEvaluation.salaryScore ?? "—"}
                    </span>
                    <span>
                      Location:{" "}
                      {snap.suitabilityEvaluation.locationScore ?? "—"}
                    </span>
                    <span>
                      Growth: {snap.suitabilityEvaluation.growthScore ?? "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No suitability evaluation recorded.
                </p>
              )}
            </Card>

            <Card className="space-y-2.5 p-5">
              <h3 className="text-card-title text-foreground">
                Attempts for This Vacancy
              </h3>
              <div className="space-y-1.5 text-xs">
                {data.siblingAttempts.map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/applications/${attempt.id}`}
                    className="flex items-center justify-between rounded-lg border border-border-subtle px-2.5 py-2 transition-colors hover:bg-surface-subtle"
                  >
                    <span className="font-mono font-semibold text-primary-text tabular-nums">
                      {attempt.code} (#{attempt.attemptNumber})
                    </span>
                    <OutcomeBadge outcome={attempt.outcome} />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <Card className="p-5">
          <h2 className="mb-4 text-section-title text-foreground">
            Immutable Status History
          </h2>
          {snap.statusHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No stage transitions captured in snapshot.
            </p>
          ) : (
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {snap.statusHistory.map((h) => (
                <li key={h.id} className="relative space-y-1 text-xs">
                  <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    {h.fromStageName && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          {h.fromStageName}
                        </span>
                        <span className="text-subtle-foreground">→</span>
                      </>
                    )}
                    <StageBadge name={h.toStageName} color={h.toStageColor} />
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatDate(h.effectiveOn)}
                    </span>
                    <Badge variant="outline">{h.source}</Badge>
                  </div>
                  {h.reason && (
                    <p className="text-foreground">Reason: {h.reason}</p>
                  )}
                  {h.note && (
                    <p className="text-muted-foreground">{h.note}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <div className="space-y-4">
          {snap.offer && (
            <Card className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <h3 className="text-card-title text-foreground">
                  Preserved Job Offer ({snap.offer.decision})
                </h3>
              </div>
              <p className="text-xs text-foreground">
                {snap.offer.positionTitle} —{" "}
                {snap.offer.baseSalary != null
                  ? formatMoney(snap.offer.baseSalary, snap.offer.currency)
                  : "Salary undisclosed"}{" "}
                ({snap.offer.salaryPeriod})
              </p>
              {snap.offer.benefits && (
                <p className="text-xs text-muted-foreground">
                  Benefits: {snap.offer.benefits}
                </p>
              )}
            </Card>
          )}

          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary-text" />
              <h3 className="text-card-title text-foreground">
                Interviews ({snap.interviews.length}) &amp; Assessments (
                {snap.assessments.length})
              </h3>
            </div>
            {snap.interviews.length === 0 && snap.assessments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No interviews or assessments recorded.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {snap.interviews.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-xl border border-border-subtle bg-surface-subtle p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground uppercase">
                        {i.interviewType} Interview
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{i.status}</Badge>
                        <Badge variant="secondary">{i.result}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {formatDateTime(i.startsAt)} ({i.durationMinutes} min)
                      {i.interviewerName ? ` • ${i.interviewerName}` : ""}
                    </p>
                    {i.feedback && (
                      <p className="mt-1 text-foreground">
                        Feedback: {i.feedback}
                      </p>
                    )}
                  </div>
                ))}
                {snap.assessments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-border-subtle bg-surface-subtle p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <ClipboardCheck className="h-3.5 w-3.5 text-primary-text" />
                        {a.title} ({a.assessmentType})
                      </span>
                      <Badge variant="secondary">{a.result}</Badge>
                    </div>
                    {a.score && (
                      <p className="mt-1 text-muted-foreground">
                        Score: {a.score}
                        {a.maxScore ? ` / ${a.maxScore}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary-text" />
              <h3 className="text-card-title text-foreground">
                Email &amp; Correspondence History ({snap.communications.length})
              </h3>
            </div>
            {snap.communications.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No correspondence captured in snapshot.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {snap.communications.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border-subtle bg-surface-subtle p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {c.subject}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(c.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.direction} • {c.channel} •{" "}
                      {c.sender ?? "Unknown sender"}
                    </p>
                    {c.snippet && (
                      <p className="mt-1.5 text-muted-foreground">{c.snippet}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card className="space-y-3 p-5">
          <h2 className="text-section-title text-foreground">
            Preserved Document &amp; CV Versions
          </h2>
          {data.archiveDocuments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No CV, cover letter, or supporting document references were
              attached at closure.
            </p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {data.archiveDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-primary-text" />
                      <span className="font-semibold text-foreground">
                        {doc.documentTitle}
                      </span>
                      <Badge variant="outline" className="uppercase">
                        {doc.role.replace("_", " ")}
                      </Badge>
                      <Badge variant="secondary">
                        {doc.versionNo ? `v${doc.versionNo}: ` : ""}
                        {doc.versionLabel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.filename || "Metadata reference only"}
                      {doc.sizeBytes
                        ? ` • ${Math.round(doc.sizeBytes / 1024)} KB`
                        : ""}
                      {doc.sha256
                        ? ` • SHA-256 ${doc.sha256.slice(0, 14)}...`
                        : ""}
                    </p>
                    {doc.notes && (
                      <p className="text-[11px] text-subtle-foreground">
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  {doc.documentVersionId && doc.storageKey ? (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`/api/documents/versions/${doc.documentVersionId}/file?download=1`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Version
                      </a>
                    </Button>
                  ) : (
                    <Badge variant="secondary">Reference Preserved</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {restoreOpen && (
        <RestoreArchiveDialog
          open={restoreOpen}
          onClose={() => setRestoreOpen(false)}
          closureRecordId={closure.id}
          applicationCode={snap.application.code}
          stages={data.activeRestoreStages}
          defaultStageId={closure.previousStageId}
        />
      )}

      {reapplyOpen && (
        <ReapplyFromArchiveDialog
          open={reapplyOpen}
          onClose={() => setReapplyOpen(false)}
          closureRecordId={closure.id}
          applicationCode={snap.application.code}
          companyName={snap.company.name}
          jobTitle={snap.vacancy.title}
          defaultCurrency={defaultCurrency}
          defaultCvLabel={snap.application.cvVersionLabel}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Archive Closure Record?"
        description="This deletes the closure record and its archived snapshot. Your original application record remains intact in Applications."
        confirmLabel="Delete Archive Record"
        variant="destructive"
        pending={isPending}
        onConfirm={handleDeleteArchive}
      />
    </div>
  );
}
