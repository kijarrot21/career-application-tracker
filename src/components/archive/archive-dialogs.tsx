"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { CURRENCIES, SUBMISSION_METHOD_LABELS, SUBMISSION_METHODS, type Currency, type SubmissionMethod } from "@/lib/constants";
import {
  ARCHIVE_OUTCOME_LABELS,
  ARCHIVE_OUTCOMES,
  RETENTION_PRESET_DAYS,
  type ArchiveOutcome,
} from "@/lib/domain/archive";
import {
  archiveApplicationAction,
  purgeExpiredArchivesAction,
  reapplyFromArchiveAction,
  restoreArchivedApplicationAction,
  updateRetentionPolicyAction,
} from "@/server/actions/archive";

export function ArchiveOutcomeBadge({ outcome }: { outcome: ArchiveOutcome }) {
  const variantMap: Record<
    ArchiveOutcome,
    "destructive" | "secondary" | "success" | "warning" | "info"
  > = {
    rejected: "destructive",
    withdrawn: "secondary",
    hired: "success",
    no_response: "warning",
    closed: "info",
  };
  return (
    <Badge variant={variantMap[outcome]}>
      {ARCHIVE_OUTCOME_LABELS[outcome]}
    </Badge>
  );
}

export function ManualArchiveDialog({
  open,
  onClose,
  applications,
  preselectedApplicationId,
  onArchived,
}: {
  open: boolean;
  onClose: () => void;
  applications?: {
    id: string;
    code: string;
    jobTitle: string;
    companyName: string;
    outcome: string;
    stageName: string;
  }[];
  preselectedApplicationId?: string;
  onArchived?: (closureRecordId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applicationId, setApplicationId] = useState(
    preselectedApplicationId ?? applications?.[0]?.id ?? "",
  );
  const [closureOutcome, setClosureOutcome] = useState<ArchiveOutcome>("closed");
  const [closedOn, setClosedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [closureReason, setClosureReason] = useState("");
  const [closureNote, setClosureNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetAppId = preselectedApplicationId ?? applicationId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetAppId) {
      setError("Please select an application to archive.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await archiveApplicationAction({
          applicationId: targetAppId,
          closureOutcome,
          closureSource: "manual_archive",
          closedOn,
          closureReason: closureReason || null,
          closureNote: closureNote || null,
        });
        toast.success(
          res.alreadyArchived
            ? "Application was already archived."
            : "Application archived with immutable snapshot.",
        );
        onClose();
        if (onArchived) onArchived(res.closureRecord.id);
        else router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not archive application.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archive Application</DialogTitle>
          <DialogDescription>
            Creates a closure record and an immutable historical snapshot while
            preserving the original application and attached document versions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          {!preselectedApplicationId && applications && (
            <FormField label="Application" required>
              <Select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
              >
                {applications.length === 0 ? (
                  <option value="">No unarchived applications</option>
                ) : (
                  applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.companyName} ({a.jobTitle})
                    </option>
                  ))
                )}
              </Select>
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Closure Outcome" required>
              <Select
                value={closureOutcome}
                onChange={(e) =>
                  setClosureOutcome(e.target.value as ArchiveOutcome)
                }
              >
                {ARCHIVE_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {ARCHIVE_OUTCOME_LABELS[o]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Closure Date" required>
              <Input
                type="date"
                required
                value={closedOn}
                onChange={(e) => setClosedOn(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Closure Reason">
            <Input
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              placeholder="e.g. Role filled / Position closed / Offer declined"
            />
          </FormField>

          <FormField label="Snapshot Notes">
            <Textarea
              rows={3}
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
              placeholder="Key lessons learned or context to preserve in the snapshot..."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !targetAppId}
            >
              {isPending ? "Archiving..." : "Archive & Snapshot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreArchiveDialog({
  open,
  onClose,
  closureRecordId,
  applicationCode,
  stages,
  defaultStageId,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  closureRecordId: string;
  applicationCode: string;
  stages: { id: string; name: string }[];
  defaultStageId?: string | null;
  onRestored?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [restoreToStageId, setRestoreToStageId] = useState(
    defaultStageId && stages.some((s) => s.id === defaultStageId)
      ? defaultStageId
      : (stages[0]?.id ?? ""),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await restoreArchivedApplicationAction({
          closureRecordId,
          restoreToStageId: restoreToStageId || null,
          reason,
        });
        toast.success(
          `Restored ${applicationCode} to active pipeline. Snapshot preserved.`,
        );
        onClose();
        if (onRestored) onRestored();
        else router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not restore archived application.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restore Application ({applicationCode})</DialogTitle>
          <DialogDescription>
            Returns the application to your active pipeline and records a reopen
            history event. The immutable historical snapshot remains preserved
            for auditability.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          {stages.length > 0 && (
            <FormField label="Restore to Active Stage">
              <Select
                value={restoreToStageId}
                onChange={(e) => setRestoreToStageId(e.target.value)}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Restoration Reason" required>
            <Textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Archived by mistake; recruiter reached back out to schedule interview."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Restoring..." : "Restore to Active Pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReapplyFromArchiveDialog({
  open,
  onClose,
  closureRecordId,
  applicationCode,
  companyName,
  jobTitle,
  defaultCurrency = "IDR",
  defaultCvLabel,
}: {
  open: boolean;
  onClose: () => void;
  closureRecordId: string;
  applicationCode: string;
  companyName: string;
  jobTitle: string;
  defaultCurrency?: string;
  defaultCvLabel?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submittedOn, setSubmittedOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [submissionMethod, setSubmissionMethod] =
    useState<SubmissionMethod>("platform");
  const [cvVersionLabel, setCvVersionLabel] = useState(defaultCvLabel ?? "");
  const [currency] = useState<Currency>(
    (defaultCurrency as Currency) || "IDR",
  );
  const [reapplyReason, setReapplyReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await reapplyFromArchiveAction({
          closureRecordId,
          submittedOn,
          submissionMethod,
          cvVersionLabel: cvVersionLabel || null,
          currency: CURRENCIES.includes(currency) ? currency : "IDR",
          reapplyReason,
          notes: notes || null,
        });
        toast.success(
          `Created new application attempt ${created.code} (Attempt #${created.attemptNumber}).`,
        );
        onClose();
        router.push(`/applications/${created.id}`);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not create re-application.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Intentional Re-application</DialogTitle>
          <DialogDescription>
            Submit a new application attempt for{" "}
            <span className="font-semibold text-foreground">
              {jobTitle}
            </span>{" "}
            at {companyName} (previous: {applicationCode}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Submission Date" required>
              <Input
                type="date"
                required
                value={submittedOn}
                onChange={(e) => setSubmittedOn(e.target.value)}
              />
            </FormField>
            <FormField label="Submission Method">
              <Select
                value={submissionMethod}
                onChange={(e) =>
                  setSubmissionMethod(e.target.value as SubmissionMethod)
                }
              >
                {SUBMISSION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {SUBMISSION_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Updated CV Version Label">
            <Input
              value={cvVersionLabel}
              onChange={(e) => setCvVersionLabel(e.target.value)}
              placeholder="e.g. Tailored_CV_v2.pdf"
            />
          </FormField>

          <FormField label="Reason for Re-applying" required>
            <Textarea
              rows={3}
              required
              value={reapplyReason}
              onChange={(e) => setReapplyReason(e.target.value)}
              placeholder="e.g. Role re-opened 4 months later; added production Go & Kafka experience."
            />
          </FormField>

          <FormField label="Additional Notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for this attempt..."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create New Attempt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RetentionPolicyDialog({
  open,
  onClose,
  policy,
  expiredCount,
}: {
  open: boolean;
  onClose: () => void;
  policy: {
    autoArchiveOnTerminal: boolean;
    archiveRetentionDays: number | null;
    archiveAutoDeleteExpired: boolean;
  };
  expiredCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autoArchive, setAutoArchive] = useState(policy.autoArchiveOnTerminal);
  const [retentionDays, setRetentionDays] = useState<string>(
    policy.archiveRetentionDays ? String(policy.archiveRetentionDays) : "",
  );
  const [autoDeleteExpired, setAutoDeleteExpired] = useState(
    policy.archiveAutoDeleteExpired,
  );
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateRetentionPolicyAction({
          autoArchiveOnTerminal: autoArchive,
          archiveRetentionDays: retentionDays ? Number(retentionDays) : null,
          archiveAutoDeleteExpired: autoDeleteExpired,
        });
        toast.success("Archive retention policy saved.");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not save retention policy.",
        );
      }
    });
  }

  function handlePurgeExpired() {
    startTransition(async () => {
      try {
        const res = await purgeExpiredArchivesAction();
        toast.success(
          `Purged ${res.purgedCount} expired archive record(s). Original applications remain intact.`,
        );
        setPurgeConfirmOpen(false);
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not purge expired archives.",
        );
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive &amp; Retention Policy</DialogTitle>
            <DialogDescription>
              Configure automatic archival on terminal outcomes and UU PDP data
              retention timelines.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <label className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-subtle p-3">
              <input
                type="checkbox"
                checked={autoArchive}
                onChange={(e) => setAutoArchive(e.target.checked)}
                className="mt-0.5 rounded border-input-border"
              />
              <span>
                <span className="block font-semibold text-foreground">
                  Automatic archival on terminal stage
                </span>
                <span className="text-muted-foreground">
                  Automatically create a closure record and immutable snapshot
                  when an application moves to Rejected, Withdrawn, Hired, or No
                  Response.
                </span>
              </span>
            </label>

            <FormField label="Default Retention Period">
              <Select
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              >
                {RETENTION_PRESET_DAYS.map((opt) => (
                  <option
                    key={opt.label}
                    value={opt.value === null ? "" : String(opt.value)}
                  >
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <label className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface-subtle p-3">
              <input
                type="checkbox"
                checked={autoDeleteExpired}
                onChange={(e) => setAutoDeleteExpired(e.target.checked)}
                className="mt-0.5 rounded border-input-border"
              />
              <span>
                <span className="block font-semibold text-foreground">
                  Flag expired archives for retention cleanup
                </span>
                <span className="text-muted-foreground">
                  Highlights records past their retention deadline so you can
                  review and purge them explicitly.
                </span>
              </span>
            </label>

            {expiredCount > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-warning-on-soft">
                <span>
                  {expiredCount} archive record(s) have passed their retention
                  date.
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setPurgeConfirmOpen(true)}
                >
                  Purge Expired
                </Button>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Policy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={purgeConfirmOpen}
        onOpenChange={setPurgeConfirmOpen}
        title="Purge Expired Archive Snapshots?"
        description={`This will permanently delete ${expiredCount} expired closure record(s) and their historical snapshots. Original application records remain intact.`}
        confirmLabel="Purge Expired Archives"
        variant="destructive"
        pending={isPending}
        onConfirm={handlePurgeExpired}
      />
    </>
  );
}
