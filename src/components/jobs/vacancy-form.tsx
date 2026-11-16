"use client";

import { AlertTriangle, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CURRENCIES,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  JOB_PRIORITIES,
  PRIORITY_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_PERIODS,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENTS,
  type Currency,
  type EmploymentType,
  type JobPriority,
  type SalaryPeriod,
  type TriageStatus,
} from "@/lib/constants";
import { detectSource, extractExternalJobId } from "@/lib/domain/duplicates";
import {
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  type EducationLevel,
  type WorkArrangement,
} from "@/lib/domain/suitability";
import {
  checkDuplicateVacancyAction,
  createVacancyAction,
  updateVacancyAction,
} from "@/server/actions/vacancies";

export interface VacancyFormInitialData {
  id?: string;
  companyName?: string;
  companyIndustry?: string | null;
  companyWebsite?: string | null;
  title?: string;
  department?: string | null;
  industry?: string | null;
  location?: string | null;
  employmentType?: EmploymentType | null;
  workArrangement?: WorkArrangement | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: Currency;
  salaryPeriod?: SalaryPeriod;
  requiredExperienceYears?: number | null;
  requiredEducation?: EducationLevel | null;
  qualifications?: string | null;
  description?: string | null;
  skills?: string[];
  url?: string | null;
  sourceId?: string | null;
  externalJobId?: string | null;
  deadline?: string | null;
  discoveredOn?: string | null;
  priority?: JobPriority;
  triageStatus?: TriageStatus;
  notes?: string | null;
}

export function VacancyForm({
  sources,
  initialData,
  defaultCurrency = "IDR",
  onSaved,
}: {
  sources: { id: string; key: string; name: string }[];
  initialData?: VacancyFormInitialData;
  defaultCurrency?: string;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [url, setUrl] = useState(initialData?.url ?? "");
  const [sourceId, setSourceId] = useState(initialData?.sourceId ?? "");
  const [externalJobId, setExternalJobId] = useState(
    initialData?.externalJobId ?? "",
  );
  const [detectedPlatformNote, setDetectedPlatformNote] = useState<
    string | null
  >(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    code: string;
    title: string;
    companyName: string;
    isDuplicateUrl: boolean;
  } | null>(null);

  const [companyName, setCompanyName] = useState(
    initialData?.companyName ?? "",
  );
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [department, setDepartment] = useState(initialData?.department ?? "");
  const [industry, setIndustry] = useState(initialData?.industry ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">(
    initialData?.employmentType ?? "full_time",
  );
  const [workArrangement, setWorkArrangement] = useState<WorkArrangement | "">(
    initialData?.workArrangement ?? "hybrid",
  );
  const [salaryMin, setSalaryMin] = useState(
    initialData?.salaryMin != null ? String(initialData.salaryMin) : "",
  );
  const [salaryMax, setSalaryMax] = useState(
    initialData?.salaryMax != null ? String(initialData.salaryMax) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    initialData?.currency ?? (defaultCurrency as Currency) ?? "IDR",
  );
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(
    initialData?.salaryPeriod ?? "month",
  );
  const [requiredExperienceYears, setRequiredExperienceYears] = useState(
    initialData?.requiredExperienceYears != null
      ? String(initialData.requiredExperienceYears)
      : "",
  );
  const [requiredEducation, setRequiredEducation] = useState<
    EducationLevel | ""
  >(initialData?.requiredEducation ?? "bachelor");
  const [skillsText, setSkillsText] = useState(
    (initialData?.skills ?? []).join(", "),
  );
  const [qualifications, setQualifications] = useState(
    initialData?.qualifications ?? "",
  );
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [deadline, setDeadline] = useState(initialData?.deadline ?? "");
  const [discoveredOn, setDiscoveredOn] = useState(
    initialData?.discoveredOn ?? "",
  );
  const [priority, setPriority] = useState<JobPriority>(
    initialData?.priority ?? "medium",
  );
  const [triageStatus, setTriageStatus] = useState<TriageStatus>(
    initialData?.triageStatus ?? "interested",
  );
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [recruiterPhone, setRecruiterPhone] = useState("");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleUrlChange(nextUrl: string) {
    setUrl(nextUrl);
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      setDetectedPlatformNote(null);
      return;
    }

    const detectedKey = detectSource(trimmed);
    const extId = extractExternalJobId(trimmed);
    if (detectedKey) {
      const matched = sources.find((s) => s.key === detectedKey);
      if (matched) {
        setSourceId(matched.id);
      }
      setDetectedPlatformNote(
        `Detected platform: ${matched?.name ?? detectedKey}${
          extId ? ` (External Job ID: ${extId})` : ""
        }`,
      );
    }
    if (extId && !externalJobId) {
      setExternalJobId(extId);
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const dup = await checkDuplicateVacancyAction({
        url: trimmed,
        excludeId: initialData?.id,
      });
      if (dup.existing) {
        setDuplicateWarning({
          ...dup.existing,
          isDuplicateUrl: dup.isDuplicateUrl,
        });
      } else {
        setDuplicateWarning(null);
      }
    }
  }

  async function handleCheckRoleDuplicate() {
    if (!companyName.trim() || !title.trim()) return;
    const dup = await checkDuplicateVacancyAction({
      url: url || null,
      companyName,
      title,
      excludeId: initialData?.id,
    });
    if (dup.existing) {
      setDuplicateWarning({
        ...dup.existing,
        isDuplicateUrl: dup.isDuplicateUrl,
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedSkills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const payload = {
          companyName,
          title,
          department: department || null,
          industry: industry || null,
          location: location || null,
          employmentType: (employmentType || null) as EmploymentType | null,
          workArrangement: (workArrangement || null) as WorkArrangement | null,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
          currency,
          salaryPeriod,
          requiredExperienceYears: requiredExperienceYears
            ? Number(requiredExperienceYears)
            : null,
          requiredEducation: (requiredEducation ||
            null) as EducationLevel | null,
          qualifications: qualifications || null,
          description: description || null,
          skills: parsedSkills,
          url: url || null,
          sourceId: sourceId || null,
          externalJobId: externalJobId || null,
          deadline: deadline || null,
          discoveredOn: discoveredOn || null,
          priority,
          triageStatus,
          recruiterName: recruiterName || null,
          recruiterEmail: recruiterEmail || null,
          recruiterPhone: recruiterPhone || null,
          notes: notes || null,
        };

        if (initialData?.id) {
          const updated = await updateVacancyAction(initialData.id, payload);
          toast.success(`Updated ${updated.code}.`);
          if (onSaved) onSaved(updated.id);
          else router.refresh();
        } else {
          const created = await createVacancyAction(payload);
          toast.success(`Saved vacancy ${created.code}.`);
          if (onSaved) onSaved(created.id);
          else router.push(`/jobs/${created.id}`);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save vacancy.",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs">
      {error && (
        <div className="rounded-2xl border border-[#ba1a1a]/40 bg-[#ffdad6]/70 px-4 py-3 text-[#93000a] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* URL Auto-Inspect Section */}
      <div className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-4 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="mb-2 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#006a42] dark:text-[#86f9ba]" />
          <span className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
            Save from External Job URL (Optional)
          </span>
        </div>
        <p className="mb-3 text-[11px] text-[#3f674f]">
          Paste a link from LinkedIn, JobStreet, Indeed, Glints, Kalibrr, or a
          company career page to automatically detect the source platform and
          external job ID.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Job Vacancy URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Source Platform
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              <option value="">Select source...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {detectedPlatformNote && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#c0edcf]/60 px-3 py-1 text-[11px] font-semibold text-[#005232] dark:bg-[#006a42]/20 dark:text-[#86f9ba]">
            <Sparkles className="h-3 w-3" />
            {detectedPlatformNote}
          </p>
        )}

        {duplicateWarning && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e8c084]/40 bg-[#ffdead]/60 px-3 py-2 text-[#5d4211] dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {duplicateWarning.isDuplicateUrl
                  ? "This exact job URL is already saved:"
                  : "A vacancy with the same company and title already exists:"}{" "}
                <strong>
                  {duplicateWarning.code} ({duplicateWarning.title} at{" "}
                  {duplicateWarning.companyName})
                </strong>
              </span>
            </span>
            <Link
              href={`/jobs/${duplicateWarning.id}`}
              className="shrink-0 font-semibold underline"
            >
              View existing
            </Link>
          </div>
        )}
      </div>

      {/* Core Position & Company Details */}
      <div className="elevation-1 space-y-4 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 dark:border-[#24332a] dark:bg-[#111a15]">
        <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
          Position & Company Information
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="vacancy-company"
              className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
            >
              Company Name *
            </label>
            <input
              id="vacancy-company"
              type="text"
              required
              value={companyName}
              onBlur={handleCheckRoleDuplicate}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., PT GoTo Gojek Tokopedia Tbk"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label
              htmlFor="vacancy-title"
              className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
            >
              Position Title *
            </label>
            <input
              id="vacancy-title"
              type="text"
              required
              value={title}
              onBlur={handleCheckRoleDuplicate}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Frontend Engineer"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Product Engineering"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Technology / Fintech / FMCG"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Job Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta, Indonesia"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType)
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Work Arrangement
              </label>
              <select
                value={workArrangement}
                onChange={(e) =>
                  setWorkArrangement(e.target.value as WorkArrangement)
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              >
                {WORK_ARRANGEMENTS.map((w) => (
                  <option key={w} value={w}>
                    {WORK_ARRANGEMENT_LABELS[w]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Compensation & Requirements */}
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-4">
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Salary Min
            </label>
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="20000000"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Salary Max
            </label>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="30000000"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Currency & Period
            </label>
            <div className="mt-1 flex gap-1.5">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="h-10 w-20 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={salaryPeriod}
                onChange={(e) =>
                  setSalaryPeriod(e.target.value as SalaryPeriod)
                }
                className="h-10 flex-1 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              >
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {SALARY_PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Min Experience (Years)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={requiredExperienceYears}
              onChange={(e) => setRequiredExperienceYears(e.target.value)}
              placeholder="3"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Required Education
            </label>
            <select
              value={requiredEducation}
              onChange={(e) =>
                setRequiredEducation(e.target.value as EducationLevel)
              }
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              {EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {EDUCATION_LABELS[lvl]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Required Skills (comma-separated, used for Suitability Scoring)
            </label>
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="TypeScript, React, Next.js, PostgreSQL, REST API"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Save Status (Triage)
            </label>
            <select
              value={triageStatus}
              onChange={(e) => setTriageStatus(e.target.value as TriageStatus)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              {TRIAGE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {TRIAGE_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Job Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              {JOB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Application Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Date Discovered
            </label>
            <input
              type="date"
              value={discoveredOn}
              onChange={(e) => setDiscoveredOn(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Job Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste key responsibilities and role summary..."
              className="mt-1 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 py-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Required Qualifications
            </label>
            <textarea
              rows={4}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="Key qualifications, certifications, or domain requirements..."
              className="mt-1 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 py-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>
        </div>

        {!initialData?.id && (
          <div className="grid grid-cols-1 gap-3 border-t border-[#bdcabf]/50 pt-3 sm:grid-cols-3 dark:border-[#24332a]">
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Recruiter / HR Contact Name
              </label>
              <input
                type="text"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Optional HR contact"
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Recruiter Email
              </label>
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="hr@company.com"
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Recruiter Phone
              </label>
              <input
                type="text"
                value={recruiterPhone}
                onChange={(e) => setRecruiterPhone(e.target.value)}
                placeholder="+62..."
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
            Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal notes on team culture, compensation, or referral contacts..."
            className="mt-1 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 py-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#bdcabf]/50 pt-4 dark:border-[#24332a]">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary h-10 px-4 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary h-10 px-4 text-xs disabled:opacity-50"
          >
            {isPending
              ? "Saving..."
              : initialData?.id
                ? "Save Changes"
                : "Save Job Vacancy"}
          </button>
        </div>
      </div>
    </form>
  );
}
