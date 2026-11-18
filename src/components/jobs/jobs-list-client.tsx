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
import { ContextualHelp } from "@/components/help/contextual-help";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  PriorityBadge,
  SampleBadge,
  Select,
  StageBadge,
  SuitabilityBadge,
  TriageBadge,
} from "@/components/ui";
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
      <PageHeader
        breadcrumbs={[
          { label: "Career Assets" },
          { label: "Opportunity Discovery" },
        ]}
        title="Find & Discover Job Opportunities"
        description="Organize vacancies by industry, position, location, salary, and suitability score before applying."
        actions={
          <>
            <ContextualHelp module="jobDiscovery" />
            <Button variant="primary" size="lg" asChild data-tour="add-job">
              <Link href="/jobs/new">
                <Plus className="h-3.5 w-3.5" />
                Add Job Vacancy
              </Link>
            </Button>
          </>
        }
      />

      {/* Filters Bar */}
      <Card
        padding="sm"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            inputSize="lg"
            tone="subtle"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search vacancies"
            placeholder="Search position, company, industry, skill, or JOB ID..."
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter by triage status"
          selectSize="lg"
          tone="subtle"
          value={triageFilter}
          onChange={(e) =>
            setTriageFilter(e.target.value as TriageStatus | "all")
          }
        >
          <option value="all">All Triage Statuses</option>
          {TRIAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRIAGE_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by priority"
          selectSize="lg"
          tone="subtle"
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as JobPriority | "all")
          }
        >
          <option value="all">All Priorities</option>
          {JOB_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]} Priority
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by platform source"
          selectSize="lg"
          tone="subtle"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">All Platforms</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Sort vacancies"
          selectSize="lg"
          tone="subtle"
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
        >
          <option value="newest">Sort: Date Discovered</option>
          <option value="score_desc">Sort: Suitability Score</option>
          <option value="deadline_asc">Sort: Application Deadline</option>
          <option value="salary_desc">Sort: Highest Salary</option>
        </Select>
      </Card>

      {/* Work Arrangement Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-muted-foreground">
          Work Arrangement:
        </span>
        {(["all", ...WORK_ARRANGEMENTS] as const).map((arr) => (
          <Button
            key={arr}
            type="button"
            size="xs"
            variant={arrangementFilter === arr ? "primary" : "secondary"}
            onClick={() => setArrangementFilter(arr)}
            className="rounded-full px-3.5 py-1"
          >
            {arr === "all" ? "All" : WORK_ARRANGEMENT_LABELS[arr]}
          </Button>
        ))}
        <Badge variant="secondary" className="ml-auto font-mono tabular-nums">
          {filtered.length} {filtered.length === 1 ? "vacancy" : "vacancies"}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No job vacancies match your current filters"
          description="Add a job opportunity manually or paste a job URL from LinkedIn, JobStreet, Glints, or Kalibrr."
          action={
            <Button variant="primary" size="lg" asChild>
              <Link href="/jobs/new">
                <Plus className="h-3.5 w-3.5" />
                Add First Vacancy
              </Link>
            </Button>
          }
        />
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
              <Card
                key={v.id}
                elevation="interactive"
                padding="md"
                className="transition-all"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[11px] font-bold text-white">
                        {getCompanyInitials(v.company.name)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {v.code}
                      </span>
                      <Link
                        href={`/jobs/${v.id}`}
                        className="text-section-title text-foreground transition-colors hover:text-primary-text"
                      >
                        {v.title}
                      </Link>
                      <SuitabilityBadge score={v.suitabilityScore} />
                      <TriageBadge status={v.triageStatus} />
                      <PriorityBadge priority={v.priority} />
                      {v.isSample && <SampleBadge />}
                    </div>

                    <p className="text-[13px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
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

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground tabular-nums">
                      <Badge
                        variant="secondary"
                        className="font-mono font-semibold text-foreground"
                      >
                        {formatSalaryRange(
                          v.salaryMin,
                          v.salaryMax,
                          v.currency,
                          v.salaryPeriod,
                        )}
                      </Badge>
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
                          className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
                        >
                          Job Posting
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {v.skills && v.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {v.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Change triage status for ${v.title}`}
                      selectSize="lg"
                      tone="subtle"
                      wrapperClassName="w-auto"
                      disabled={isPending}
                      value={v.triageStatus}
                      onChange={(e) =>
                        handleTriage(v.id, e.target.value as TriageStatus)
                      }
                      className="font-semibold"
                    >
                      {TRIAGE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Save as: {TRIAGE_LABELS[s]}
                        </option>
                      ))}
                    </Select>

                    {activeApp ? (
                      <Link
                        href={`/applications/${activeApp.id}`}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary-soft px-3 text-xs font-semibold text-primary-on-soft tabular-nums"
                      >
                        <span>{activeApp.code}:</span>
                        <StageBadge
                          name={activeApp.stageName}
                          color={activeApp.stageColor}
                        />
                      </Link>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
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
                      >
                        <Send className="h-3 w-3" />
                        {closedApp ? "Re-apply" : "Record Submission"}
                      </Button>
                    )}

                    <Button variant="secondary" size="lg" asChild>
                      <Link href={`/jobs/${v.id}`}>Evaluate & Details</Link>
                    </Button>
                  </div>
                </div>
              </Card>
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
