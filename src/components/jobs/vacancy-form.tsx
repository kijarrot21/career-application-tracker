"use client";

import { AlertTriangle, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
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
        <div
          role="alert"
          className="rounded-xl border border-destructive-border bg-destructive-soft px-4 py-3 text-destructive-on-soft"
        >
          {error}
        </div>
      )}

      {/* URL Auto-Inspect Section */}
      <Card padding="sm">
        <div className="mb-2 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary-text" />
          <span className="text-section-title text-foreground">
            Save from External Job URL (Optional)
          </span>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Paste a link from LinkedIn, JobStreet, Indeed, Glints, Kalibrr, or a
          company career page to automatically detect the source platform and
          external job ID.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Job Vacancy URL" className="sm:col-span-2">
            <Input
              type="url"
              inputSize="lg"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
            />
          </FormField>
          <FormField label="Source Platform">
            <Select
              selectSize="lg"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select source...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {detectedPlatformNote && (
          <Badge variant="primary" className="mt-2 py-1">
            <Sparkles className="h-3 w-3" />
            {detectedPlatformNote}
          </Badge>
        )}

        {duplicateWarning && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-warning-on-soft">
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
      </Card>

      {/* Core Position & Company Details */}
      <Card padding="md" className="space-y-4">
        <h3 className="text-section-title text-foreground">
          Position & Company Information
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Company Name" htmlFor="vacancy-company" required>
            <Input
              id="vacancy-company"
              type="text"
              inputSize="lg"
              required
              value={companyName}
              onBlur={handleCheckRoleDuplicate}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., PT GoTo Gojek Tokopedia Tbk"
            />
          </FormField>

          <FormField label="Position Title" htmlFor="vacancy-title" required>
            <Input
              id="vacancy-title"
              type="text"
              inputSize="lg"
              required
              value={title}
              onBlur={handleCheckRoleDuplicate}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Frontend Engineer"
            />
          </FormField>

          <FormField label="Department">
            <Input
              type="text"
              inputSize="lg"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Product Engineering"
            />
          </FormField>

          <FormField label="Industry">
            <Input
              type="text"
              inputSize="lg"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Technology / Fintech / FMCG"
            />
          </FormField>

          <FormField label="Job Location">
            <Input
              type="text"
              inputSize="lg"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta, Indonesia"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Employment Type">
              <Select
                selectSize="lg"
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType)
                }
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Work Arrangement">
              <Select
                selectSize="lg"
                value={workArrangement}
                onChange={(e) =>
                  setWorkArrangement(e.target.value as WorkArrangement)
                }
              >
                {WORK_ARRANGEMENTS.map((w) => (
                  <option key={w} value={w}>
                    {WORK_ARRANGEMENT_LABELS[w]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>

        {/* Compensation & Requirements */}
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-4">
          <FormField label="Salary Min">
            <Input
              type="number"
              inputSize="lg"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="20000000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Salary Max">
            <Input
              type="number"
              inputSize="lg"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="30000000"
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Currency & Period">
            <div className="flex gap-1.5">
              <Select
                aria-label="Salary currency"
                selectSize="lg"
                wrapperClassName="w-24 shrink-0"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Salary period"
                selectSize="lg"
                value={salaryPeriod}
                onChange={(e) =>
                  setSalaryPeriod(e.target.value as SalaryPeriod)
                }
              >
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {SALARY_PERIOD_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
          </FormField>
          <FormField label="Min Experience (Years)">
            <Input
              type="number"
              inputSize="lg"
              min={0}
              max={50}
              value={requiredExperienceYears}
              onChange={(e) => setRequiredExperienceYears(e.target.value)}
              placeholder="3"
              className="tabular-nums"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Required Education">
            <Select
              selectSize="lg"
              value={requiredEducation}
              onChange={(e) =>
                setRequiredEducation(e.target.value as EducationLevel)
              }
            >
              {EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {EDUCATION_LABELS[lvl]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Required Skills (comma-separated, used for Suitability Scoring)"
            className="sm:col-span-2"
          >
            <Input
              type="text"
              inputSize="lg"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="TypeScript, React, Next.js, PostgreSQL, REST API"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <FormField label="Save Status (Triage)">
            <Select
              selectSize="lg"
              value={triageStatus}
              onChange={(e) => setTriageStatus(e.target.value as TriageStatus)}
            >
              {TRIAGE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {TRIAGE_LABELS[st]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Job Priority">
            <Select
              selectSize="lg"
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
            >
              {JOB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Application Deadline">
            <Input
              type="date"
              inputSize="lg"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField label="Date Discovered">
            <Input
              type="date"
              inputSize="lg"
              value={discoveredOn}
              onChange={(e) => setDiscoveredOn(e.target.value)}
              className="tabular-nums"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Job Description">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste key responsibilities and role summary..."
            />
          </FormField>

          <FormField label="Required Qualifications">
            <Textarea
              rows={4}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="Key qualifications, certifications, or domain requirements..."
            />
          </FormField>
        </div>

        {!initialData?.id && (
          <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-3">
            <FormField label="Recruiter / HR Contact Name">
              <Input
                type="text"
                inputSize="lg"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Optional HR contact"
              />
            </FormField>
            <FormField label="Recruiter Email">
              <Input
                type="email"
                inputSize="lg"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="hr@company.com"
              />
            </FormField>
            <FormField label="Recruiter Phone">
              <Input
                type="text"
                inputSize="lg"
                value={recruiterPhone}
                onChange={(e) => setRecruiterPhone(e.target.value)}
                placeholder="+62..."
              />
            </FormField>
          </div>
        )}

        <FormField label="Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal notes on team culture, compensation, or referral contacts..."
          />
        </FormField>

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
          >
            {isPending
              ? "Saving..."
              : initialData?.id
                ? "Save Changes"
                : "Save Job Vacancy"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
