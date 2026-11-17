"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Button,
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
import {
  CURRENCIES,
  SUBMISSION_METHOD_LABELS,
  SUBMISSION_METHODS,
  type Currency,
  type SubmissionMethod,
} from "@/lib/constants";
import { recordSubmissionAction } from "@/server/actions/applications";

export interface VacancyOptionForSubmission {
  id: string;
  code: string;
  title: string;
  companyName: string;
  url?: string | null;
  sourceId?: string | null;
  department?: string | null;
  hasActiveApp?: boolean;
  hasClosedApp?: boolean;
}

export function RecordSubmissionDialog({
  open,
  onClose,
  preselectedVacancy,
  vacancyOptions = [],
  sources = [],
  defaultCurrency = "IDR",
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  preselectedVacancy?: VacancyOptionForSubmission | null;
  vacancyOptions?: VacancyOptionForSubmission[];
  sources?: { id: string; name: string }[];
  defaultCurrency?: string;
  defaultDate?: string;
  onCreated?: (applicationId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<"existing" | "new">(
    preselectedVacancy || vacancyOptions.length > 0 ? "existing" : "new",
  );
  const [vacancyId, setVacancyId] = useState(
    preselectedVacancy?.id ?? vacancyOptions[0]?.id ?? "",
  );
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [location, setLocation] = useState("");

  const activeVacancy =
    preselectedVacancy ??
    (mode === "existing"
      ? vacancyOptions.find((v) => v.id === vacancyId) ?? null
      : null);

  const [submittedOn, setSubmittedOn] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10),
  );
  const [platformSourceId, setPlatformSourceId] = useState(
    activeVacancy?.sourceId ?? "",
  );
  const [submissionMethod, setSubmissionMethod] =
    useState<SubmissionMethod>("platform");
  const [applicationUrl, setApplicationUrl] = useState(
    activeVacancy?.url ?? "",
  );
  const [externalReferenceId, setExternalReferenceId] = useState("");
  const [confirmationReference, setConfirmationReference] = useState("");
  const [cvVersionLabel, setCvVersionLabel] = useState("Master_CV_v1.pdf");
  const [coverLetterVersionLabel, setCoverLetterVersionLabel] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [currency, setCurrency] = useState<Currency>(
    (defaultCurrency as Currency) || "IDR",
  );
  const [jobCategory, setJobCategory] = useState(
    activeVacancy?.department ?? "",
  );
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [recruiterContact, setRecruiterContact] = useState("");
  const [notes, setNotes] = useState("");
  const [isIntentionalReapply, setIsIntentionalReapply] = useState(false);
  const [reapplyReason, setReapplyReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const created = await recordSubmissionAction({
          vacancyId:
            preselectedVacancy?.id ??
            (mode === "existing" && vacancyId ? vacancyId : null),
          companyName: mode === "new" ? companyName : undefined,
          title: mode === "new" ? title : undefined,
          jobUrl: mode === "new" ? jobUrl : undefined,
          location: mode === "new" ? location : undefined,
          submittedOn,
          platformSourceId: platformSourceId || null,
          submissionMethod,
          applicationUrl: applicationUrl || null,
          externalReferenceId: externalReferenceId || null,
          confirmationReference: confirmationReference || null,
          cvVersionLabel: cvVersionLabel || null,
          coverLetterVersionLabel: coverLetterVersionLabel || null,
          expectedSalary: expectedSalary ? Number(expectedSalary) : null,
          currency,
          jobCategory: jobCategory || null,
          recruiterName: recruiterName || null,
          recruiterEmail: recruiterEmail || null,
          recruiterContact: recruiterContact || null,
          notes: notes || null,
          isIntentionalReapply,
          reapplyReason: reapplyReason || null,
        });

        toast.success(`Application ${created.code} recorded.`);
        onClose();
        if (onCreated) {
          onCreated(created.id);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to record application.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Submitted Job Application</DialogTitle>
          <DialogDescription>
            Creates a unique Application ID, records initial status history, and
            schedules your first follow-up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-xs text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          {preselectedVacancy ? (
            <div className="rounded-xl border border-primary/25 bg-primary-soft p-3.5">
              <p className="text-label-xs uppercase text-primary-on-soft tabular-nums">
                Selected Vacancy ({preselectedVacancy.code})
              </p>
              <p className="mt-0.5 text-card-title text-foreground">
                {preselectedVacancy.title} at {preselectedVacancy.companyName}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl bg-surface-subtle p-3.5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "existing" ? "primary" : "secondary"}
                  onClick={() => setMode("existing")}
                >
                  From saved vacancy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "new" ? "primary" : "secondary"}
                  onClick={() => setMode("new")}
                >
                  Enter new position directly
                </Button>
              </div>

              {mode === "existing" ? (
                <FormField label="Saved Job Vacancy" required>
                  <Select
                    required
                    selectSize="lg"
                    value={vacancyId}
                    onChange={(e) => setVacancyId(e.target.value)}
                  >
                    <option value="">Select a vacancy...</option>
                    {vacancyOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code}: {v.title} at {v.companyName}
                        {v.hasActiveApp
                          ? " (Active application exists)"
                          : v.hasClosedApp
                            ? " (Previously applied)"
                            : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Company Name" required>
                    <Input
                      type="text"
                      inputSize="lg"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="PT Tokopedia"
                    />
                  </FormField>
                  <FormField label="Job Position" required>
                    <Input
                      type="text"
                      inputSize="lg"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Senior Backend Engineer"
                    />
                  </FormField>
                  <FormField label="Location">
                    <Input
                      type="text"
                      inputSize="lg"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Jakarta / Hybrid"
                    />
                  </FormField>
                  <FormField label="Job URL">
                    <Input
                      type="url"
                      inputSize="lg"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/jobs/view/..."
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}

          {activeVacancy?.hasClosedApp && (
            <div className="space-y-2 rounded-xl border border-warning-border bg-warning-soft p-3">
              <label className="flex items-center gap-2 font-semibold text-warning-on-soft">
                <input
                  type="checkbox"
                  checked={isIntentionalReapply}
                  onChange={(e) => setIsIntentionalReapply(e.target.checked)}
                />
                This is an intentional re-application to a previously closed
                position
              </label>
              {isIntentionalReapply && (
                <Input
                  type="text"
                  inputSize="lg"
                  required
                  value={reapplyReason}
                  onChange={(e) => setReapplyReason(e.target.value)}
                  placeholder="Reason for re-applying (e.g., Recruiter invited me for new opening)"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Application Date" required>
              <Input
                type="date"
                inputSize="lg"
                required
                value={submittedOn}
                onChange={(e) => setSubmittedOn(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Application Platform">
              <Select
                selectSize="lg"
                value={platformSourceId}
                onChange={(e) => setPlatformSourceId(e.target.value)}
              >
                <option value="">Auto-detect / Unspecified</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Submission Method" required>
              <Select
                selectSize="lg"
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="CV Version Used">
              <Input
                type="text"
                inputSize="lg"
                value={cvVersionLabel}
                onChange={(e) => setCvVersionLabel(e.target.value)}
                placeholder="e.g., CV_Backend_v3.pdf"
              />
            </FormField>

            <FormField label="Cover Letter Version">
              <Input
                type="text"
                inputSize="lg"
                value={coverLetterVersionLabel}
                onChange={(e) => setCoverLetterVersionLabel(e.target.value)}
                placeholder="Optional cover letter version"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Expected Salary">
              <Input
                type="number"
                inputSize="lg"
                min={0}
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                placeholder="25000000"
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Currency">
              <Select
                selectSize="lg"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Job Category / Dept">
              <Input
                type="text"
                inputSize="lg"
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value)}
                placeholder="Engineering"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="External Application Ref ID">
              <Input
                type="text"
                inputSize="lg"
                value={externalReferenceId}
                onChange={(e) => setExternalReferenceId(e.target.value)}
                placeholder="Workday / LinkedIn ref ID"
              />
            </FormField>
            <FormField label="Confirmation Reference">
              <Input
                type="text"
                inputSize="lg"
                value={confirmationReference}
                onChange={(e) => setConfirmationReference(e.target.value)}
                placeholder="Email confirmation code"
              />
            </FormField>
            <FormField label="Application Portal URL">
              <Input
                type="url"
                inputSize="lg"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Recruiter Name">
              <Input
                type="text"
                inputSize="lg"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Recruiter / TA name"
              />
            </FormField>
            <FormField label="Recruiter Email">
              <Input
                type="email"
                inputSize="lg"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="recruiter@company.com"
              />
            </FormField>
            <FormField label="Recruiter Phone / LinkedIn">
              <Input
                type="text"
                inputSize="lg"
                value={recruiterContact}
                onChange={(e) => setRecruiterContact(e.target.value)}
                placeholder="+62..."
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referral context, key talking points, or application notes..."
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Recording..." : "Record Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
