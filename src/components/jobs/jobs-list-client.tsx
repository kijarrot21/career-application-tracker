"use client";

import {
  Briefcase,
  ExternalLink,
  Plus,
  Search,
  Send,
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
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_PRIORITIES,
  PRIORITY_LABELS,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENTS,
  type EmploymentType,
  type JobPriority,
  type TriageStatus,
} from "@/lib/constants";
import { formatDate, formatSalaryRange } from "@/lib/format";
import { setVacancyTriageAction } from "@/server/actions/vacancies";
import type { listVacancies } from "@/server/queries/vacancies";

type VacancyRow = Awaited<ReturnType<typeof listVacancies>>[number];

function getCompanyInitials(name: string) {
  return name
    .replace(/^PT\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function JobsListClient({
  vacancies,
  sources,
  defaultCurrency,
}: {
  vacancies: VacancyRow[];
  sources: { id: string; key: string; name: string }[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [triageFilter, setTriageFilter] = useState<TriageStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | "all">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [arrangementFilter, setArrangementFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "newest" | "score_desc" | "deadline_asc" | "salary_desc"
  >("newest");

  const [applyTarget, setApplyTarget] =
    useState<VacancyOptionForSubmission | null>(null);

  const filtered = vacancies
    .filter((v) => {
      if (triageFilter !== "all" && v.triageStatus !== triageFilter)
        return false;
      if (priorityFilter !== "all" && v.priority !== priorityFilter)
        return false;
      if (sourceFilter !== "all" && v.sourceId !== sourceFilter) return false;
      if (
        arrangementFilter !== "all" &&
        v.workArrangement !== arrangementFilter
      )
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = v.title.toLowerCase().includes(q);
        const inCo = v.company.name.toLowerCase().includes(q);
        const inLoc = (v.location ?? "").toLowerCase().includes(q);
        const inInd = (v.industry ?? "").toLowerCase().includes(q);
        const inCode = v.code.toLowerCase().includes(q);
        const inSkills = (v.skills ?? []).some((s) =>
          s.toLowerCase().includes(q),
        );
        if (!inTitle && !inCo && !inLoc && !inInd && !inCode && !inSkills)
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score_desc") {
        return (b.suitabilityScore ?? -1) - (a.suitabilityScore ?? -1);
      }
      if (sortBy === "deadline_asc") {
        return (a.deadline ?? "9999-12-31").localeCompare(
          b.deadline ?? "9999-12-31",
        );
      }
      if (sortBy === "salary_desc") {
        const sa = a.salaryMax ?? a.salaryMin ?? 0;
        const sb = b.salaryMax ?? b.salaryMin ?? 0;
        return sb - sa;
      }
      return b.discoveredOn.localeCompare(a.discoveredOn);
    });

  function handleTriage(vacancyId: string, nextStatus: TriageStatus) {
    startTransition(async () => {
      try {
        await setVacancyTriageAction(vacancyId, nextStatus);
        toast.success(`Saved as ${TRIAGE_LABELS[nextStatus]}.`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update status",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Find & Discover Job Opportunities
          </h1>
          <p className="text-[13px] text-[#64748B]">
            Organize vacancies by industry, position, location, salary, and
            suitability score before applying.
          </p>
        </div>

        <Link
          href="/jobs/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Job Vacancy
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="elevation-1 grid grid-cols-1 gap-2.5 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search position, company, industry, skill, or JOB ID..."
            className="h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] pr-3 pl-9 text-xs text-[#0F172A] outline-none placeholder:text-[#64748B] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <select
          aria-label="Filter by triage status"
          value={triageFilter}
          onChange={(e) =>
            setTriageFilter(e.target.value as TriageStatus | "all")
          }
          className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Triage Statuses</option>
          {TRIAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRIAGE_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as JobPriority | "all")
          }
          className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Priorities</option>
          {JOB_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]} Priority
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by platform source"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Platforms</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort vacancies"
          value={sortBy}
          onChange={(e) =>
            setSortBy(
              e.target.value as
                | "newest"
                | "score_desc"
                | "deadline_asc"
                | "salary_desc",
            )
          }
          className="h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="newest">Sort: Date Discovered</option>
          <option value="score_desc">Sort: Suitability Score</option>
          <option value="deadline_asc">Sort: Application Deadline</option>
          <option value="salary_desc">Sort: Highest Salary</option>
        </select>
      </div>

      {/* Work Arrangement Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium text-[#64748B]">Work Arrangement:</span>
        {(["all", ...WORK_ARRANGEMENTS] as const).map((arr) => (
          <button
            key={arr}
            type="button"
            onClick={() => setArrangementFilter(arr)}
            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition-colors ${
              arrangementFilter === arr
                ? "bg-[#204CD3] text-white"
                : "border border-[#CBD5E1] bg-[#FFFFFF] text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {arr === "all" ? "All" : WORK_ARRANGEMENT_LABELS[arr]}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-[#64748B] tabular-nums">
          {filtered.length} {filtered.length === 1 ? "vacancy" : "vacancies"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="elevation-1 flex flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <Briefcase className="h-7 w-7 text-[#64748B]" />
          <p className="mt-2 font-display text-sm font-semibold text-[#0F172A] dark:text-slate-100">
            No job vacancies match your current filters
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Add a job opportunity manually or paste a job URL from LinkedIn,
            JobStreet, Glints, or Kalibrr.
          </p>
          <Link
            href="/jobs/new"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add First Vacancy
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const activeApp = v.applications.find(
              (a) => a.outcome === "active",
            );
            const closedApp = v.applications.find(
              (a) => a.outcome !== "active",
            );

            return (
              <div
                key={v.id}
                className="elevation-2 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#EEF2FF] font-display text-[10px] font-bold text-[#1D4ED8] dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]">
                        {getCompanyInitials(v.company.name)}
                      </span>
                      <span className="font-mono text-xs text-[#64748B] tabular-nums">
                        {v.code}
                      </span>
                      <Link
                        href={`/jobs/${v.id}`}
                        className="text-headline-sm text-[#0F172A] hover:text-[#204CD3] dark:text-slate-100 dark:hover:text-[#B7C4FF]"
                      >
                        {v.title}
                      </Link>
                      <SuitabilityBadge score={v.suitabilityScore} />
                      <TriageBadge status={v.triageStatus} />
                      <PriorityBadge priority={v.priority} />
                      {v.isSample && <SampleBadge />}
                    </div>

                    <p className="text-[13px] text-[#64748B] dark:text-slate-400">
                      <span className="font-semibold text-[#0F172A] dark:text-slate-200">
                        {v.company.name}
                      </span>
                      {v.department ? ` · ${v.department}` : ""}
                      {v.industry ? ` · ${v.industry}` : ""}
                      {v.location ? ` · ${v.location}` : ""}
                      {v.workArrangement
                        ? ` (${WORK_ARRANGEMENT_LABELS[v.workArrangement]})`
                        : ""}
                      {v.employmentType
                        ? ` · ${EMPLOYMENT_TYPE_LABELS[v.employmentType as EmploymentType]}`
                        : ""}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#64748B] tabular-nums">
                      <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono font-semibold text-[#0F172A] dark:bg-slate-800 dark:text-slate-200">
                        {formatSalaryRange(
                          v.salaryMin,
                          v.salaryMax,
                          v.currency,
                          v.salaryPeriod,
                        )}
                      </span>
                      {v.source && <span>Platform: {v.source.name}</span>}
                      {v.deadline && (
                        <span>Deadline: {formatDate(v.deadline)}</span>
                      )}
                      <span>Discovered: {formatDate(v.discoveredOn)}</span>
                      {v.url && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
                        >
                          Job Posting
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {v.skills && v.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {v.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#334155] dark:bg-slate-800 dark:text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <select
                      aria-label={`Change triage status for ${v.title}`}
                      disabled={isPending}
                      value={v.triageStatus}
                      onChange={(e) =>
                        handleTriage(v.id, e.target.value as TriageStatus)
                      }
                      className="h-9 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 text-xs font-semibold text-[#334155] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {TRIAGE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Save as: {TRIAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>

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
                        {closedApp ? "Re-apply" : "Record Submission"}
                      </button>
                    )}

                    <Link
                      href={`/jobs/${v.id}`}
                      className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Evaluate & Details
                    </Link>
                  </div>
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
