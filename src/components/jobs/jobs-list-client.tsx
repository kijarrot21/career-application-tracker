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
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span>Career Assets</span>
            <span>/</span>
            <span className="text-[#006a42] dark:text-[#69dca0]">
              Opportunity Discovery
            </span>
          </div>
          <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
            Find & Discover Job Opportunities
          </h1>
          <p className="mt-0.5 text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
            Organize vacancies by industry, position, location, salary, and
            suitability score before applying.
          </p>
        </div>

        <Link href="/jobs/new" className="btn-primary h-10 px-4 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add Job Vacancy
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="elevation-1 grid grid-cols-1 gap-2.5 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-3.5 sm:grid-cols-2 lg:grid-cols-6 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#3f674f] dark:text-[#a5d1b4]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search position, company, industry, skill, or JOB ID..."
            className="h-10 w-full rounded-xl border border-transparent bg-[#eff5ee] pr-3 pl-9 text-xs text-[#171d19] outline-none placeholder:text-[#3f674f] focus:border-[#006a42] focus:bg-[#ffffff] dark:bg-[#17231c] dark:text-[#ecf3eb]"
          />
        </div>

        <select
          aria-label="Filter by triage status"
          value={triageFilter}
          onChange={(e) =>
            setTriageFilter(e.target.value as TriageStatus | "all")
          }
          className="h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
          className="h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
          className="h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
          className="h-10 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
        >
          <option value="newest">Sort: Date Discovered</option>
          <option value="score_desc">Sort: Suitability Score</option>
          <option value="deadline_asc">Sort: Application Deadline</option>
          <option value="salary_desc">Sort: Highest Salary</option>
        </select>
      </div>

      {/* Work Arrangement Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-[#3f674f] dark:text-[#a5d1b4]">
          Work Arrangement:
        </span>
        {(["all", ...WORK_ARRANGEMENTS] as const).map((arr) => (
          <button
            key={arr}
            type="button"
            onClick={() => setArrangementFilter(arr)}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
              arrangementFilter === arr
                ? "bg-[#006a42] text-white shadow-sm"
                : "border border-[#bdcabf]/50 bg-[#ffffff] text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:border-[#24332a] dark:bg-[#111a15] dark:text-[#b7c6ba]"
            }`}
          >
            {arr === "all" ? "All" : WORK_ARRANGEMENT_LABELS[arr]}
          </button>
        ))}
        <span className="ml-auto rounded-full bg-[#eff5ee] px-3 py-1 font-mono text-xs font-semibold text-[#3f674f] tabular-nums dark:bg-[#17231c] dark:text-[#a5d1b4]">
          {filtered.length} {filtered.length === 1 ? "vacancy" : "vacancies"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="elevation-1 flex flex-col items-center justify-center rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] py-14 text-center dark:border-[#24332a] dark:bg-[#111a15]">
          <Briefcase className="h-7 w-7 text-[#3f674f]" />
          <p className="mt-2 font-display text-sm font-semibold text-[#171d19] dark:text-[#ecf3eb]">
            No job vacancies match your current filters
          </p>
          <p className="mt-1 text-xs text-[#3f674f]">
            Add a job opportunity manually or paste a job URL from LinkedIn,
            JobStreet, Glints, or Kalibrr.
          </p>
          <Link href="/jobs/new" className="btn-primary mt-4 h-10 px-4 text-xs">
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
                className="elevation-2 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-5 transition-all dark:border-[#24332a] dark:bg-[#111a15]"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#006a42] font-display text-[11px] font-bold text-white">
                        {getCompanyInitials(v.company.name)}
                      </span>
                      <span className="font-mono text-xs text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                        {v.code}
                      </span>
                      <Link
                        href={`/jobs/${v.id}`}
                        className="text-headline-sm text-[#171d19] transition-colors hover:text-[#006a42] dark:text-[#ecf3eb] dark:hover:text-[#69dca0]"
                      >
                        {v.title}
                      </Link>
                      <SuitabilityBadge score={v.suitabilityScore} />
                      <TriageBadge status={v.triageStatus} />
                      <PriorityBadge priority={v.priority} />
                      {v.isSample && <SampleBadge />}
                    </div>

                    <p className="text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
                      <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
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

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                      <span className="rounded-full bg-[#eff5ee] px-2.5 py-0.5 font-mono font-semibold text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]">
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
                          className="inline-flex items-center gap-1 font-semibold text-[#006a42] hover:underline dark:text-[#69dca0]"
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
                            className="rounded-full bg-[#e3eae3] px-2.5 py-0.5 text-[11px] font-medium text-[#3e4a41] dark:bg-[#1d2b23] dark:text-[#b7c6ba]"
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
                      className="h-9 rounded-xl border border-[#bdcabf]/60 bg-[#eff5ee] px-3 text-xs font-semibold text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
                        {closedApp ? "Re-apply" : "Record Submission"}
                      </button>
                    )}

                    <Link
                      href={`/jobs/${v.id}`}
                      className="btn-secondary h-10 px-4 text-xs"
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
