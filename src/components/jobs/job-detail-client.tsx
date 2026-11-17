"use client";

import { Edit3, ExternalLink, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RecordSubmissionDialog } from "@/components/applications/record-submission-dialog";
import { SuitabilityPanel } from "@/components/jobs/suitability-panel";
import { VacancyForm } from "@/components/jobs/vacancy-form";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  OutcomeBadge,
  PriorityBadge,
  SampleBadge,
  Select,
  StageBadge,
  SuitabilityBadge,
  TriageBadge,
} from "@/components/ui";
import {
  EMPLOYMENT_TYPE_LABELS,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  WORK_ARRANGEMENT_LABELS,
  type Currency,
  type EmploymentType,
  type SalaryPeriod,
  type TriageStatus,
} from "@/lib/constants";
import {
  EDUCATION_LABELS,
  type EducationLevel,
} from "@/lib/domain/suitability";
import { formatDate, formatSalaryRange } from "@/lib/format";
import {
  deleteVacancyAction,
  setVacancyTriageAction,
} from "@/server/actions/vacancies";
import type { getVacancyDetail } from "@/server/queries/vacancies";

type VacancyDetailData = NonNullable<
  Awaited<ReturnType<typeof getVacancyDetail>>
>;

export function JobDetailClient({
  vacancy,
  sources,
}: {
  vacancy: VacancyDetailData;
  sources: { id: string; key: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activeApp = vacancy.applications.find((a) => a.outcome === "active");
  const hasClosedApp = vacancy.applications.some((a) => a.outcome !== "active");

  function handleTriage(status: TriageStatus) {
    startTransition(async () => {
      try {
        await setVacancyTriageAction(vacancy.id, status);
        toast.success(`Saved as ${TRIAGE_LABELS[status]}.`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update triage",
        );
      }
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteVacancyAction(vacancy.id);
        toast.success("Vacancy deleted.");
        setDeleteOpen(false);
        router.push("/jobs");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete vacancy",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/jobs"
          className="text-xs font-semibold text-primary-text hover:underline"
        >
          &larr; Back to Find Jobs
        </Link>
      </div>

      {/* Header Card */}
      <Card padding="md">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {vacancy.code}
              </span>
              <h1 className="text-page-title text-foreground">
                {vacancy.title}
              </h1>
              <SuitabilityBadge score={vacancy.suitabilityScore} />
              <TriageBadge status={vacancy.triageStatus} />
              <PriorityBadge priority={vacancy.priority} />
              {vacancy.isSample && <SampleBadge />}
            </div>

            <p className="text-[14px] text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {vacancy.company.name}
              </strong>
              {vacancy.department ? ` · ${vacancy.department}` : ""}
              {vacancy.industry ? ` · ${vacancy.industry}` : ""}
              {vacancy.location ? ` · ${vacancy.location}` : ""}
              {vacancy.workArrangement
                ? ` (${WORK_ARRANGEMENT_LABELS[vacancy.workArrangement]})`
                : ""}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground tabular-nums">
              <span>
                Salary:{" "}
                <strong className="font-mono font-semibold text-foreground">
                  {formatSalaryRange(
                    vacancy.salaryMin,
                    vacancy.salaryMax,
                    vacancy.currency,
                    vacancy.salaryPeriod,
                  )}
                </strong>
              </span>
              {vacancy.source && <span>Source: {vacancy.source.name}</span>}
              {vacancy.externalJobId && (
                <span>
                  External ID:{" "}
                  <span className="font-mono">{vacancy.externalJobId}</span>
                </span>
              )}
              {vacancy.deadline && (
                <span>Deadline: {formatDate(vacancy.deadline)}</span>
              )}
              <span>Discovered: {formatDate(vacancy.discoveredOn)}</span>
              {vacancy.url && (
                <a
                  href={vacancy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
                >
                  Open Job Posting
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Vacancy triage status"
              selectSize="lg"
              tone="subtle"
              wrapperClassName="w-auto"
              disabled={isPending}
              value={vacancy.triageStatus}
              onChange={(e) => handleTriage(e.target.value as TriageStatus)}
              className="font-semibold"
            >
              {TRIAGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  Save as: {TRIAGE_LABELS[s]}
                </option>
              ))}
            </Select>

            {activeApp ? (
              <Button variant="primary" size="lg" asChild>
                <Link href={`/applications/${activeApp.id}`}>
                  View Application ({activeApp.code})
                </Link>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setApplyOpen(true)}
              >
                <Send className="h-3.5 w-3.5" />
                {hasClosedApp ? "Re-apply to Position" : "Record Submission"}
              </Button>
            )}

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setEditing(!editing)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editing ? "Close Editor" : "Edit"}
            </Button>

            <Button
              variant="destructive"
              size="lg"
              disabled={isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {editing ? (
        <VacancyForm
          sources={sources}
          initialData={{
            id: vacancy.id,
            companyName: vacancy.company.name,
            title: vacancy.title,
            department: vacancy.department,
            industry: vacancy.industry,
            location: vacancy.location,
            employmentType: vacancy.employmentType as EmploymentType | null,
            workArrangement: vacancy.workArrangement,
            salaryMin: vacancy.salaryMin,
            salaryMax: vacancy.salaryMax,
            currency: vacancy.currency as Currency,
            salaryPeriod: vacancy.salaryPeriod as SalaryPeriod,
            requiredExperienceYears: vacancy.requiredExperienceYears,
            requiredEducation:
              vacancy.requiredEducation as EducationLevel | null,
            qualifications: vacancy.qualifications,
            description: vacancy.description,
            skills: vacancy.skills,
            url: vacancy.url,
            sourceId: vacancy.sourceId,
            externalJobId: vacancy.externalJobId,
            deadline: vacancy.deadline,
            discoveredOn: vacancy.discoveredOn,
            priority: vacancy.priority,
            triageStatus: vacancy.triageStatus,
            notes: vacancy.notes,
          }}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left (60%): Description, Qualifications, Skills, Linked Applications */}
          <div className="space-y-6 lg:col-span-7">
            <Card padding="md" className="space-y-4 text-xs">
              <h2 className="text-section-title text-foreground">
                Vacancy Details & Requirements
              </h2>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Employment Type</span>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {vacancy.employmentType
                      ? EMPLOYMENT_TYPE_LABELS[
                          vacancy.employmentType as EmploymentType
                        ]
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Required Experience
                  </span>
                  <p className="mt-0.5 font-semibold text-foreground tabular-nums">
                    {vacancy.requiredExperienceYears != null
                      ? `${vacancy.requiredExperienceYears} years`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Required Education
                  </span>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {vacancy.requiredEducation
                      ? EDUCATION_LABELS[
                          vacancy.requiredEducation as EducationLevel
                        ]
                      : "Not specified"}
                  </p>
                </div>
              </div>

              {vacancy.skills && vacancy.skills.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Required Skills</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {vacancy.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {vacancy.description && (
                <div>
                  <span className="text-muted-foreground">Job Description</span>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/90">
                    {vacancy.description}
                  </p>
                </div>
              )}

              {vacancy.qualifications && (
                <div>
                  <span className="text-muted-foreground">
                    Required Qualifications
                  </span>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/90">
                    {vacancy.qualifications}
                  </p>
                </div>
              )}

              {vacancy.notes && (
                <div>
                  <span className="text-muted-foreground">Candidate Notes</span>
                  <p className="mt-1 whitespace-pre-line text-foreground/90">
                    {vacancy.notes}
                  </p>
                </div>
              )}
            </Card>

            {/* Linked Applications */}
            <Card padding="md" className="space-y-3 text-xs">
              <h2 className="text-section-title text-foreground">
                Submitted Applications for This Vacancy
              </h2>
              {vacancy.applications.length === 0 ? (
                <p className="text-muted-foreground">
                  You have not submitted an application for this vacancy yet.
                  Click &ldquo;Record Submission&rdquo; once you apply.
                </p>
              ) : (
                <div className="space-y-2">
                  {vacancy.applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="elevation-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-subtle p-3 tabular-nums hover:bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary-text">
                          {app.code}
                        </span>
                        <span>Attempt #{app.attemptNumber}</span>
                        <span>· Submitted {formatDate(app.submittedOn)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StageBadge
                          name={app.stage.name}
                          color={app.stage.color}
                        />
                        <OutcomeBadge outcome={app.outcome} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right (40%): Suitability Evaluation Panel */}
          <div className="lg:col-span-5">
            <SuitabilityPanel
              vacancyId={vacancy.id}
              initialScores={{
                skills: vacancy.evaluation?.skillsScore ?? null,
                experience: vacancy.evaluation?.experienceScore ?? null,
                education: vacancy.evaluation?.educationScore ?? null,
                salary: vacancy.evaluation?.salaryScore ?? null,
                location: vacancy.evaluation?.locationScore ?? null,
                growth: vacancy.evaluation?.growthScore ?? null,
              }}
              suggestions={vacancy.suggestions}
              weights={vacancy.weights}
            />
          </div>
        </div>
      )}

      <RecordSubmissionDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        preselectedVacancy={{
          id: vacancy.id,
          code: vacancy.code,
          title: vacancy.title,
          companyName: vacancy.company.name,
          url: vacancy.url,
          sourceId: vacancy.sourceId,
          department: vacancy.department,
          hasActiveApp: Boolean(activeApp),
          hasClosedApp,
        }}
        sources={sources}
        defaultCurrency={vacancy.currency}
        onCreated={(appId) => router.push(`/applications/${appId}`)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete job vacancy ${vacancy.code}?`}
        description={`This will permanently delete "${vacancy.title}" and any linked evaluations. This action cannot be undone.`}
        confirmLabel="Delete Vacancy"
        pending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
