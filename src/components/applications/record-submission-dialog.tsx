"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/20 p-4 backdrop-blur-[1px]">
      <div className="elevation-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-[#E2E8F0] pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Record Submitted Job Application
            </h2>
            <p className="text-xs text-[#64748B]">
              Creates a unique Application ID, records initial status history,
              and schedules your first follow-up.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="rounded-[4px] border border-[#F43F5E]/40 bg-[#FFF1F2] px-3 py-2 text-xs text-[#BE123C] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          {preselectedVacancy ? (
            <div className="rounded-[8px] border border-[#204CD3]/25 bg-[#EEF2FF] p-3.5 dark:border-[#204CD3]/40 dark:bg-[#204CD3]/15">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#1D4ED8] tabular-nums dark:text-[#B7C4FF]">
                Selected Vacancy ({preselectedVacancy.code})
              </p>
              <p className="mt-0.5 font-display text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                {preselectedVacancy.title} at {preselectedVacancy.companyName}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === "existing"
                      ? "bg-[#204CD3] text-white"
                      : "border border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#EEF2FF] hover:text-[#1D4ED8] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  From saved vacancy
                </button>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === "new"
                      ? "bg-[#204CD3] text-white"
                      : "border border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:bg-[#EEF2FF] hover:text-[#1D4ED8] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  Enter new position directly
                </button>
              </div>

              {mode === "existing" ? (
                <div>
                  <label className="block font-semibold text-[#334155] dark:text-slate-300">
                    Saved Job Vacancy
                  </label>
                  <select
                    required
                    value={vacancyId}
                    onChange={(e) => setVacancyId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-[#334155] dark:text-slate-300">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="PT Tokopedia"
                      className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] dark:text-slate-300">
                      Job Position *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Senior Backend Engineer"
                      className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] dark:text-slate-300">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Jakarta / Hybrid"
                      className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#334155] dark:text-slate-300">
                      Job URL
                    </label>
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeVacancy?.hasClosedApp && (
            <div className="space-y-2 rounded-[8px] border border-[#F59E0B]/40 bg-[#FFFBEB] p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <label className="flex items-center gap-2 font-semibold text-[#B45309] dark:text-amber-200">
                <input
                  type="checkbox"
                  checked={isIntentionalReapply}
                  onChange={(e) => setIsIntentionalReapply(e.target.checked)}
                />
                This is an intentional re-application to a previously closed
                position
              </label>
              {isIntentionalReapply && (
                <input
                  type="text"
                  required
                  value={reapplyReason}
                  onChange={(e) => setReapplyReason(e.target.value)}
                  placeholder="Reason for re-applying (e.g., Recruiter invited me for new opening)"
                  className="h-10 w-full rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-amber-800 dark:bg-slate-950"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Date *
              </label>
              <input
                type="date"
                required
                value={submittedOn}
                onChange={(e) => setSubmittedOn(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Platform
              </label>
              <select
                value={platformSourceId}
                onChange={(e) => setPlatformSourceId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Auto-detect / Unspecified</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Submission Method *
              </label>
              <select
                value={submissionMethod}
                onChange={(e) =>
                  setSubmissionMethod(e.target.value as SubmissionMethod)
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {SUBMISSION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {SUBMISSION_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                CV Version Used
              </label>
              <input
                type="text"
                value={cvVersionLabel}
                onChange={(e) => setCvVersionLabel(e.target.value)}
                placeholder="e.g., CV_Backend_v3.pdf"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Cover Letter Version
              </label>
              <input
                type="text"
                value={coverLetterVersionLabel}
                onChange={(e) => setCoverLetterVersionLabel(e.target.value)}
                placeholder="Optional cover letter version"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Expected Salary
              </label>
              <input
                type="number"
                min={0}
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                placeholder="25000000"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Job Category / Dept
              </label>
              <input
                type="text"
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value)}
                placeholder="Engineering"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                External Application Ref ID
              </label>
              <input
                type="text"
                value={externalReferenceId}
                onChange={(e) => setExternalReferenceId(e.target.value)}
                placeholder="Workday / LinkedIn ref ID"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Confirmation Reference
              </label>
              <input
                type="text"
                value={confirmationReference}
                onChange={(e) => setConfirmationReference(e.target.value)}
                placeholder="Email confirmation code"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Application Portal URL
              </label>
              <input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Name
              </label>
              <input
                type="text"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Recruiter / TA name"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Email
              </label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="recruiter@company.com"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Recruiter Phone / LinkedIn
              </label>
              <input
                type="text"
                value={recruiterContact}
                onChange={(e) => setRecruiterContact(e.target.value)}
                placeholder="+62..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referral context, key talking points, or application notes..."
              className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-[4px] bg-[#204CD3] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Recording..." : "Record Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
