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
import { ContextualHelp } from "@/components/help/contextual-help";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PriorityBadge,
  SampleBadge,
  StageBadge,
  SuitabilityBadge,
  TriageBadge,
} from "@/components/ui";
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
      <PageHeader
        breadcrumbs={[
          { label: "Career Assets" },
          { label: "Shortlist & Comparison" },
        ]}
        title="Job Shortlist & Suitability Comparison"
        description="Interested and Shortlisted opportunities ranked by overall suitability score and upcoming deadlines."
        actions={
          <>
            <ContextualHelp module="shortlist" />
            <Button variant="secondary" size="lg" asChild>
              <Link href="/jobs">Browse All Vacancies</Link>
            </Button>
          </>
        }
      />

      {/* Side-by-side comparison tray */}
      {compared.length > 0 && (
        <Card padding="md" className="space-y-3 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary-text tabular-nums">
              <Columns3 className="h-4 w-4" />
              Side-by-Side Comparison ({compared.length} of 3 selected)
            </div>
            <Button
              variant="link"
              size="xs"
              onClick={() => setCompareIds([])}
            >
              Clear comparison
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {compared.map((v) => (
              <Card
                key={v.id}
                tone="subtle"
                elevation="flat"
                padding="sm"
                className="space-y-1.5 text-xs tabular-nums"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground">
                    {v.code}
                  </span>
                  <SuitabilityBadge score={v.suitabilityScore} />
                </div>
                <p className="text-card-title text-foreground">{v.title}</p>
                <p className="font-semibold text-muted-foreground">
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
              </Card>
            ))}
          </div>
        </Card>
      )}

      {vacancies.length === 0 ? (
        <EmptyState
          icon={BookmarkCheck}
          title="Your shortlist is empty"
          description="Mark vacancies as Interested or Shortlisted in Find Jobs to evaluate and compare them here."
          action={
            <Button variant="primary" size="lg" asChild>
              <Link href="/jobs">Browse Find Jobs</Link>
            </Button>
          }
        />
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
              <Card
                key={v.id}
                elevation="interactive"
                padding="md"
                className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${v.title}`}
                      checked={compareIds.includes(v.id)}
                      onChange={() => toggleCompare(v.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {v.code}
                    </span>
                    <Link
                      href={`/jobs/${v.id}`}
                      className="text-section-title text-foreground hover:text-primary-text"
                    >
                      {v.title}
                    </Link>
                    <SuitabilityBadge score={v.suitabilityScore} />
                    <TriageBadge status={v.triageStatus} />
                    <PriorityBadge priority={v.priority} />
                    {v.isSample && <SampleBadge />}
                  </div>

                  <p className="text-[13px] text-muted-foreground tabular-nums">
                    <strong className="font-semibold text-foreground">
                      {v.company.name}
                    </strong>
                    {v.location ? ` · ${v.location}` : ""}
                    {v.workArrangement
                      ? ` (${WORK_ARRANGEMENT_LABELS[v.workArrangement]})`
                      : ""}
                    {" · "}
                    <span className="font-mono font-semibold text-foreground">
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
                      Record Submission
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={isPending}
                    onClick={() => handleTriage(v.id, "not_interested")}
                    title="Mark Not Interested"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Not Interested
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={isPending}
                    onClick={() => handleTriage(v.id, "archived")}
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </Button>
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
