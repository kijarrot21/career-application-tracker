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
  OutcomeBadge,
  PriorityBadge,
  SampleBadge,
  StageBadge,
  SuitabilityBadge,
  TriageBadge,
} from "@/components/ui/badges";
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

  function handleDelete() {
    if (
      !window.confirm(`Delete job vacancy ${vacancy.code} (${vacancy.title})?`)
    )
      return;
    startTransition(async () => {
      try {
        await deleteVacancyAction(vacancy.id);
        toast.success("Vacancy deleted.");
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
          className="text-xs font-semibold text-[#006a42] hover:underline dark:text-[#86f9ba]"
        >
          &larr; Back to Find Jobs
        </Link>
      </div>

      {/* Header Card */}
      <div className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[#3f674f] tabular-nums">
                {vacancy.code}
              </span>
              <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
                {vacancy.title}
              </h1>
              <SuitabilityBadge score={vacancy.suitabilityScore} />
              <TriageBadge status={vacancy.triageStatus} />
              <PriorityBadge priority={vacancy.priority} />
              {vacancy.isSample && <SampleBadge />}
            </div>

            <p className="text-[14px] text-[#3e4a41] dark:text-[#b7c6ba]">
              <strong className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                {vacancy.company.name}
              </strong>
              {vacancy.department ? ` · ${vacancy.department}` : ""}
              {vacancy.industry ? ` · ${vacancy.industry}` : ""}
              {vacancy.location ? ` · ${vacancy.location}` : ""}
              {vacancy.workArrangement
                ? ` (${WORK_ARRANGEMENT_LABELS[vacancy.workArrangement]})`
                : ""}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#3f674f] tabular-nums">
              <span>
                Salary:{" "}
                <strong className="font-mono font-semibold text-[#171d19] dark:text-[#ecf3eb]">
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
                  className="inline-flex items-center gap-1 font-semibold text-[#006a42] hover:underline dark:text-[#86f9ba]"
                >
                  Open Job Posting
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Vacancy triage status"
              disabled={isPending}
              value={vacancy.triageStatus}
              onChange={(e) => handleTriage(e.target.value as TriageStatus)}
              className="h-9 rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-2.5 text-xs font-semibold text-[#3e4a41] dark:border-[#2d3d33] dark:bg-[#1d2b23] dark:text-[#ecf3eb]"
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
                className="btn-primary h-10 px-4 text-xs"
              >
                View Application ({activeApp.code})
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="btn-primary h-10 px-4 text-xs"
              >
                <Send className="h-3.5 w-3.5" />
                {hasClosedApp ? "Re-apply to Position" : "Record Submission"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="btn-secondary h-10 px-4 text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editing ? "Close Editor" : "Edit"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="btn-destructive h-10 px-4 text-xs disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

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
            <div className="elevation-1 space-y-4 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 text-xs dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Vacancy Details & Requirements
              </h2>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-[#3f674f]">Employment Type</span>
                  <p className="mt-0.5 font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                    {vacancy.employmentType
                      ? EMPLOYMENT_TYPE_LABELS[
                          vacancy.employmentType as EmploymentType
                        ]
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-[#3f674f]">Required Experience</span>
                  <p className="mt-0.5 font-semibold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
                    {vacancy.requiredExperienceYears != null
                      ? `${vacancy.requiredExperienceYears} years`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <span className="text-[#3f674f]">Required Education</span>
                  <p className="mt-0.5 font-semibold text-[#171d19] dark:text-[#ecf3eb]">
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
                  <span className="text-[#3f674f]">Required Skills</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {vacancy.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#eff5ee] px-2.5 py-0.5 text-xs font-medium text-[#171d19] dark:bg-[#1d2b23] dark:text-[#ecf3eb]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {vacancy.description && (
                <div>
                  <span className="text-[#3f674f]">Job Description</span>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-[#3e4a41] dark:text-[#b7c6ba]">
                    {vacancy.description}
                  </p>
                </div>
              )}

              {vacancy.qualifications && (
                <div>
                  <span className="text-[#3f674f]">
                    Required Qualifications
                  </span>
                  <p className="mt-1 whitespace-pre-line leading-relaxed text-[#3e4a41] dark:text-[#b7c6ba]">
                    {vacancy.qualifications}
                  </p>
                </div>
              )}

              {vacancy.notes && (
                <div>
                  <span className="text-[#3f674f]">Candidate Notes</span>
                  <p className="mt-1 whitespace-pre-line text-[#3e4a41] dark:text-[#b7c6ba]">
                    {vacancy.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Linked Applications */}
            <div className="elevation-1 space-y-3 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 text-xs dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Submitted Applications for This Vacancy
              </h2>
              {vacancy.applications.length === 0 ? (
                <p className="text-[#3f674f]">
                  You have not submitted an application for this vacancy yet.
                  Click &ldquo;Record Submission&rdquo; once you apply.
                </p>
              ) : (
                <div className="space-y-2">
                  {vacancy.applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="elevation-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-3 tabular-nums dark:border-[#24332a] dark:bg-[#17231c]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[#006a42] dark:text-[#86f9ba]">
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
            </div>
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
    </div>
  );
}
