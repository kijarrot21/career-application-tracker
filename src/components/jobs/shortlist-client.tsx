"use client";

import {
  Archive,
  BookmarkCheck,
  Columns3,
  Send,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  RecordSubmissionDialog,
  type VacancyOptionForSubmission,
} from "@/components/applications/record-submission-dialog";
import {
  PriorityBadge,
  SampleBadge,
  StageBadge,
  SuitabilityBadge,
  TriageBadge,
} from "@/components/ui/badges";
import { WORK_ARRANGEMENT_LABELS, type TriageStatus } from "@/lib/constants";
import { formatDate, formatSalaryRange } from "@/lib/format";
import { setVacancyTriageAction } from "@/server/actions/vacancies";
import type { listShortlistVacancies } from "@/server/queries/vacancies";

type ShortlistRow = Awaited<ReturnType<typeof listShortlistVacancies>>[number];

export function ShortlistClient({
  vacancies,
  sources,
  defaultCurrency,
}: {
  vacancies: ShortlistRow[];
  sources: { id: string; key: string; name: string }[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [applyTarget, setApplyTarget] =
    useState<VacancyOptionForSubmission | null>(null);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.info("Select up to 3 vacancies to compare side by side.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function handleTriage(id: string, next: TriageStatus) {
    startTransition(async () => {
      try {
        await setVacancyTriageAction(id, next);
        toast.success("Updated shortlist status.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update");
      }
    });
  }

  const compared = vacancies.filter((v) => compareIds.includes(v.id));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Job Shortlist & Suitability Comparison
          </h1>
          <p className="text-[13px] text-[#64748B]">
            Interested and Shortlisted opportunities ranked by overall
            suitability score and upcoming deadlines.
          </p>
        </div>

        <Link
          href="/jobs"
          className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          Browse All Vacancies
        </Link>
      </div>

      {/* Side-by-side comparison tray */}
      {compared.length > 0 && (
        <div className="elevation-1 space-y-3 rounded-[8px] border border-[#204CD3]/30 bg-[#FFFFFF] p-4 dark:border-[#204CD3]/40 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1D4ED8] tabular-nums dark:text-[#B7C4FF]">
              <Columns3 className="h-4 w-4" />
              Side-by-Side Comparison ({compared.length} of 3 selected)
            </div>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs font-semibold text-[#64748B] hover:text-[#204CD3] hover:underline"
            >
              Clear comparison
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {compared.map((v) => (
              <div
                key={v.id}
                className="space-y-1.5 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs tabular-nums dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#64748B]">{v.code}</span>
                  <SuitabilityBadge score={v.suitabilityScore} />
                </div>
                <p className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                  {v.title}
                </p>
                <p className="font-medium text-[#334155] dark:text-slate-300">
                  {v.company.name}
                </p>
                <p>
                  <strong>Salary:</strong>{" "}
                  {formatSalaryRange(
                    v.salaryMin,
                    v.salaryMax,
                    v.currency,
                    v.salaryPeriod,
                  )}
                </p>
                <p>
                  <strong>Location:</strong> {v.location ?? "N/A"}{" "}
                  {v.workArrangement
                    ? `(${WORK_ARRANGEMENT_LABELS[v.workArrangement]})`
                    : ""}
                </p>
                <p>
                  <strong>Experience:</strong>{" "}
                  {v.requiredExperienceYears != null
                    ? `${v.requiredExperienceYears} yrs`
                    : "N/A"}
                </p>
                <p>
                  <strong>Deadline:</strong> {formatDate(v.deadline)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {vacancies.length === 0 ? (
        <div className="elevation-1 flex flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <BookmarkCheck className="h-7 w-7 text-[#64748B]" />
          <p className="mt-2 font-display text-sm font-semibold text-[#0F172A] dark:text-slate-100">
            Your shortlist is empty
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Mark vacancies as Interested or Shortlisted in Find Jobs to evaluate
            and compare them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => {
            const activeApp = v.applications.find(
              (a) => a.outcome === "active",
            );
            const closedApp = v.applications.find(
              (a) => a.outcome !== "active",
            );

            return (
              <div
                key={v.id}
                className="elevation-2 flex flex-col justify-between gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${v.title}`}
                      checked={compareIds.includes(v.id)}
                      onChange={() => toggleCompare(v.id)}
                      className="h-4 w-4 rounded-[4px] border-[#CBD5E1] accent-[#204CD3]"
                    />
                    <span className="font-mono text-xs text-[#64748B] tabular-nums">
                      {v.code}
                    </span>
                    <Link
                      href={`/jobs/${v.id}`}
                      className="text-headline-sm text-[#0F172A] hover:text-[#204CD3] dark:text-slate-100"
                    >
                      {v.title}
                    </Link>
                    <SuitabilityBadge score={v.suitabilityScore} />
                    <TriageBadge status={v.triageStatus} />
                    <PriorityBadge priority={v.priority} />
                    {v.isSample && <SampleBadge />}
                  </div>

                  <p className="text-[13px] text-[#64748B] tabular-nums dark:text-slate-400">
                    <strong className="font-semibold text-[#0F172A] dark:text-slate-200">
                      {v.company.name}
                    </strong>
                    {v.location ? ` · ${v.location}` : ""}
                    {v.workArrangement
                      ? ` (${WORK_ARRANGEMENT_LABELS[v.workArrangement]})`
                      : ""}
                    {" · "}
                    <span className="font-mono font-semibold text-[#334155] dark:text-slate-300">
                      {formatSalaryRange(
                        v.salaryMin,
                        v.salaryMax,
                        v.currency,
                        v.salaryPeriod,
                      )}
                    </span>
                    {v.deadline ? ` · Deadline: ${formatDate(v.deadline)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeApp ? (
                    <Link
                      href={`/applications/${activeApp.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#204CD3]/30 bg-[#EEF2FF] px-2.5 text-xs font-semibold text-[#1D4ED8] tabular-nums dark:border-[#204CD3]/40 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]"
                    >
                      <span>{activeApp.code}:</span>
                      <StageBadge
                        name={activeApp.stageName}
                        color={activeApp.stageColor}
                      />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setApplyTarget({
                          id: v.id,
                          code: v.code,
                          title: v.title,
                          companyName: v.company.name,
                          url: v.url,
                          sourceId: v.sourceId,
                          department: v.department,
                          hasActiveApp: false,
                          hasClosedApp: Boolean(closedApp),
                        })
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
                    >
                      <Send className="h-3 w-3" />
                      Record Submission
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTriage(v.id, "not_interested")}
                    title="Mark Not Interested"
                    className="inline-flex h-9 items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Not Interested
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTriage(v.id, "archived")}
                    title="Archive"
                    className="inline-flex h-9 items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {applyTarget && (
        <RecordSubmissionDialog
          open={true}
          onClose={() => setApplyTarget(null)}
          preselectedVacancy={applyTarget}
          sources={sources}
          defaultCurrency={defaultCurrency}
          onCreated={(appId) => router.push(`/applications/${appId}`)}
        />
      )}
    </div>
  );
}
