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
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span>Career Assets</span>
            <span>/</span>
            <span className="text-[#006a42] dark:text-[#69dca0]">
              Shortlist & Comparison
            </span>
          </div>
          <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
            Job Shortlist & Suitability Comparison
          </h1>
          <p className="mt-0.5 text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
            Interested and Shortlisted opportunities ranked by overall
            suitability score and upcoming deadlines.
          </p>
        </div>

        <Link href="/jobs" className="btn-secondary h-10 px-4 text-xs">
          Browse All Vacancies
        </Link>
      </div>

      {/* Side-by-side comparison tray */}
      {compared.length > 0 && (
        <div className="elevation-1 space-y-3 rounded-2xl border border-[#a5d1b4] bg-[#ffffff] p-5 dark:border-[#006a42]/40 dark:bg-[#111a15]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
              <Columns3 className="h-4 w-4" />
              Side-by-Side Comparison ({compared.length} of 3 selected)
            </div>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs font-semibold text-[#3f674f] hover:text-[#006a42] hover:underline"
            >
              Clear comparison
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {compared.map((v) => (
              <div
                key={v.id}
                className="space-y-1.5 rounded-xl bg-[#eff5ee] p-4 text-xs tabular-nums dark:bg-[#17231c]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#3f674f] dark:text-[#a5d1b4]">
                    {v.code}
                  </span>
                  <SuitabilityBadge score={v.suitabilityScore} />
                </div>
                <p className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  {v.title}
                </p>
                <p className="font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
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
        <div className="elevation-1 flex flex-col items-center justify-center rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] py-14 text-center dark:border-[#24332a] dark:bg-[#111a15]">
          <BookmarkCheck className="h-7 w-7 text-[#3f674f]" />
          <p className="mt-2 font-display text-sm font-semibold text-[#171d19] dark:text-[#ecf3eb]">
            Your shortlist is empty
          </p>
          <p className="mt-1 text-xs text-[#3f674f]">
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
                className="elevation-2 flex flex-col justify-between gap-3 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 sm:flex-row sm:items-center dark:border-[#24332a] dark:bg-[#111a15]"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${v.title}`}
                      checked={compareIds.includes(v.id)}
                      onChange={() => toggleCompare(v.id)}
                      className="h-4 w-4 rounded border-[#bdcabf] accent-[#006a42]"
                    />
                    <span className="font-mono text-xs text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                      {v.code}
                    </span>
                    <Link
                      href={`/jobs/${v.id}`}
                      className="text-headline-sm text-[#171d19] hover:text-[#006a42] dark:text-[#ecf3eb] dark:hover:text-[#69dca0]"
                    >
                      {v.title}
                    </Link>
                    <SuitabilityBadge score={v.suitabilityScore} />
                    <TriageBadge status={v.triageStatus} />
                    <PriorityBadge priority={v.priority} />
                    {v.isSample && <SampleBadge />}
                  </div>

                  <p className="text-[13px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                    <strong className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                      {v.company.name}
                    </strong>
                    {v.location ? ` · ${v.location}` : ""}
                    {v.workArrangement
                      ? ` (${WORK_ARRANGEMENT_LABELS[v.workArrangement]})`
                      : ""}
                    {" · "}
                    <span className="font-mono font-semibold text-[#171d19] dark:text-[#ecf3eb]">
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#a5d1b4] bg-[#c0edcf]/60 px-3 text-xs font-semibold text-[#005232] tabular-nums dark:border-[#006a42]/40 dark:bg-[#006a42]/20 dark:text-[#86f9ba]"
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
                      className="btn-primary h-10 px-4 text-xs"
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
                    className="btn-secondary h-10 px-3.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Not Interested
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTriage(v.id, "archived")}
                    title="Archive"
                    className="btn-secondary h-10 px-3.5 text-xs"
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
