"use client";

import {
  Award,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileUp,
  FolderGit2,
  GraduationCap,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CareerRoadmapPanel } from "@/components/profile/career-roadmap-panel";
import {
  ReviewStagedCvImportDialog,
  StageCvImportDialog,
} from "@/components/profile/cv-import-review-modal";
import {
  CertificationFormDialog,
  EducationFormDialog,
  ExperienceFormDialog,
  ProjectFormDialog,
  SkillFormDialog,
} from "@/components/profile/profile-sections-modals";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import {
  CURRENCIES,
  EMPLOYMENT_TYPE_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_PERIODS,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENTS,
  type Currency,
  type EmploymentType,
  type SalaryPeriod,
} from "@/lib/constants";
import {
  CAREER_LEVEL_LABELS,
  CAREER_LEVELS,
  PREFERRED_LANGUAGES,
  SKILL_CATEGORY_LABELS,
  SKILL_PROFICIENCY_LABELS,
  type CareerLevel,
  type SkillCategory,
  type SkillProficiency,
} from "@/lib/domain/career-profile";
import {
  EDUCATION_LABELS,
  type EducationLevel,
  type WorkArrangement,
} from "@/lib/domain/suitability";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteCareerCertificationAction,
  deleteCareerEducationAction,
  deleteCareerExperienceAction,
  deleteCareerProjectAction,
  deleteCareerSkillAction,
  saveCareerSkillAction,
  upsertCareerProfileAction,
} from "@/server/actions/career-profile";
import type { AiCareerRoadmap } from "@/server/ai/schemas";
import type { getMasterCareerProfile } from "@/server/queries/career-profile";

type ProfileBundle = Awaited<ReturnType<typeof getMasterCareerProfile>>;
type SectionTab =
  | "professional"
  | "experiences"
  | "educations"
  | "skills"
  | "certifications"
  | "projects"
  | "roadmap";

export function CareerProfileClient({
  data,
  latestRoadmap,
}: {
  data: ProfileBundle;
  latestRoadmap?: AiCareerRoadmap | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<SectionTab>("professional");

  const { profile, completion } = data;

  // 1 & 2. Professional Info & Career Preferences Form State
  const [fullName, setFullName] = useState(profile.fullName);
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [country, setCountry] = useState(profile.country ?? "Indonesia");
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.preferredLanguage ?? "id-ID",
  );
  const [careerLevel, setCareerLevel] = useState<CareerLevel | "">(
    profile.careerLevel ?? "",
  );
  const [totalExperienceYears, setTotalExperienceYears] = useState(
    profile.totalExperienceYears != null
      ? String(profile.totalExperienceYears)
      : "",
  );

  const [targetPositionsText, setTargetPositionsText] = useState(
    (profile.targetPositions ?? []).join(", "),
  );
  const [targetIndustriesText, setTargetIndustriesText] = useState(
    (profile.targetIndustries ?? []).join(", "),
  );
  const [preferredLocationsText, setPreferredLocationsText] = useState(
    (profile.preferredLocations ?? []).join(", "),
  );
  const [preferredArrangements, setPreferredArrangements] = useState<
    WorkArrangement[]
  >((profile.preferredArrangements ?? []) as WorkArrangement[]);
  const [salaryCurrency, setSalaryCurrency] = useState<Currency>(
    (profile.salaryCurrency as Currency) ?? "IDR",
  );
  const [expectedSalaryMin, setExpectedSalaryMin] = useState(
    profile.expectedSalaryMin != null
      ? String(profile.expectedSalaryMin)
      : "",
  );
  const [expectedSalaryMax, setExpectedSalaryMax] = useState(
    profile.expectedSalaryMax != null
      ? String(profile.expectedSalaryMax)
      : "",
  );
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(
    (profile.salaryPeriod as SalaryPeriod) ?? "month",
  );
  const [syncToSuitabilitySettings, setSyncToSuitabilitySettings] =
    useState(true);

  // Modals State
  const [stageCvOpen, setStageCvOpen] = useState(false);
  const [reviewCvOpen, setReviewCvOpen] = useState(false);
  const [expModal, setExpModal] = useState<{
    open: boolean;
    item?: ProfileBundle["experiences"][number] | null;
  }>({ open: false });
  const [eduModal, setEduModal] = useState<{
    open: boolean;
    item?: ProfileBundle["educations"][number] | null;
  }>({ open: false });
  const [skillModal, setSkillModal] = useState<{
    open: boolean;
    item?: ProfileBundle["skills"][number] | null;
  }>({ open: false });
  const [certModal, setCertModal] = useState<{
    open: boolean;
    item?: ProfileBundle["certifications"][number] | null;
  }>({ open: false });
  const [projModal, setProjModal] = useState<{
    open: boolean;
    item?: ProfileBundle["projects"][number] | null;
  }>({ open: false });

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "experience" | "education" | "skill" | "certification" | "project";
    id: string;
    label: string;
  } | null>(null);

  function parseCsvList(raw: string): string[] {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toggleArrangement(val: WorkArrangement) {
    setPreferredArrangements((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val],
    );
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertCareerProfileAction({
          fullName,
          headline: headline || null,
          summary: summary || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          linkedinUrl: linkedinUrl || null,
          portfolioUrl: portfolioUrl || null,
          githubUrl: githubUrl || null,
          location: location || null,
          country: country || null,
          preferredLanguage,
          careerLevel: careerLevel || null,
          totalExperienceYears: totalExperienceYears
            ? Number(totalExperienceYears)
            : null,
          targetPositions: parseCsvList(targetPositionsText),
          targetIndustries: parseCsvList(targetIndustriesText),
          preferredLocations: parseCsvList(preferredLocationsText),
          preferredArrangements,
          salaryCurrency,
          expectedSalaryMin: expectedSalaryMin
            ? Number(expectedSalaryMin)
            : null,
          expectedSalaryMax: expectedSalaryMax
            ? Number(expectedSalaryMax)
            : null,
          salaryPeriod,
          syncToSuitabilitySettings,
        });
        toast.success("Master Career Profile saved and verified.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not save Master Career Profile.",
        );
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        if (deleteTarget.kind === "experience") {
          await deleteCareerExperienceAction(deleteTarget.id);
        } else if (deleteTarget.kind === "education") {
          await deleteCareerEducationAction(deleteTarget.id);
        } else if (deleteTarget.kind === "skill") {
          await deleteCareerSkillAction(deleteTarget.id);
        } else if (deleteTarget.kind === "certification") {
          await deleteCareerCertificationAction(deleteTarget.id);
        } else {
          await deleteCareerProjectAction(deleteTarget.id);
        }
        toast.success(`Removed "${deleteTarget.label}".`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete item.",
        );
      }
    });
  }

  function handleToggleSkillVerify(sk: ProfileBundle["skills"][number]) {
    startTransition(async () => {
      try {
        await saveCareerSkillAction({
          id: sk.id,
          skillName: sk.skillName,
          category: sk.category as SkillCategory,
          proficiencyLevel: sk.proficiencyLevel as SkillProficiency,
          yearsOfExperience: sk.yearsOfExperience,
          evidence: sk.evidence,
          isUserVerified: !sk.isUserVerified,
        });
        toast.success(
          !sk.isUserVerified
            ? `Verified skill "${sk.skillName}".`
            : `Marked "${sk.skillName}" as unverified.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update skill.",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Career Assets", href: "/dashboard" },
          { label: "Master Career Profile" },
        ]}
        title="Master Career Profile"
        description="Your single, user-verified source of professional truth for suitability evaluation and future grounded AI career tools."
        actions={
          <Button variant="secondary" onClick={() => setStageCvOpen(true)}>
            <FileUp className="h-4 w-4" />
            Stage CV Import
          </Button>
        }
      />

      {/* Pending CV Import Review Alert */}
      {profile.pendingReviewPayload && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning-border bg-warning-soft p-4 text-xs text-warning-on-soft">
          <div className="space-y-0.5">
            <p className="font-semibold">
              CV Import Draft Pending Your Verification
            </p>
            <p>
              Staged from{" "}
              <strong>
                {profile.pendingReviewPayload.sourceDocumentLabel ??
                  "Structured Draft"}
              </strong>
              . Your verified career records have NOT been modified.
            </p>
          </div>
          <Button
            variant="warning"
            size="sm"
            onClick={() => setReviewCvOpen(true)}
          >
            Review &amp; Confirm Changes
          </Button>
        </Card>
      )}

      {/* Profile Completion & AI Grounding Readiness */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary-text" />
              <h2 className="text-section-title text-foreground">
                Profile Completeness &amp; Verification Status
              </h2>
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3 w-3" />
                User-Verified Source
              </Badge>
              {completion.isReadyForAi && (
                <Badge variant="primary">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Grounded for Future AI
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {completion.completedCount} of {completion.totalCount} core
              modules complete. AI features will only cite facts explicitly
              verified here.
            </p>
          </div>

          <div className="text-right">
            <span className="font-display text-3xl font-bold text-primary-text tabular-nums">
              {completion.percentage}%
            </span>
          </div>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {completion.sections.map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() =>
                setTab(
                  sec.key === "preferences"
                    ? "professional"
                    : sec.key === "certifications"
                      ? "certifications"
                      : sec.key === "educations"
                        ? "educations"
                        : (sec.key as SectionTab),
                )
              }
              className="flex cursor-pointer items-start gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-2.5 text-left text-xs transition-colors hover:border-primary"
            >
              <CheckCircle2
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  sec.completed ? "text-success" : "text-subtle-foreground",
                )}
              />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{sec.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {sec.detail}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Section Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as SectionTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="professional">
            Profile &amp; Preferences
          </TabsTrigger>
          <TabsTrigger value="experiences">
            Experience ({data.experiences.length})
          </TabsTrigger>
          <TabsTrigger value="educations">
            Education ({data.educations.length})
          </TabsTrigger>
          <TabsTrigger value="skills">
            Skills ({data.skills.length})
          </TabsTrigger>
          <TabsTrigger value="certifications">
            Certifications ({data.certifications.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({data.projects.length})
          </TabsTrigger>
          <TabsTrigger value="roadmap">
            AI Career Roadmap
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB 1: Professional Information & Career Preferences */}
      {tab === "professional" && (
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <Card className="space-y-4 p-5">
            <h3 className="text-section-title text-foreground">
              1. Professional Information
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Full Name" required>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </FormField>
              <FormField label="Professional Headline">
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer (Go & TypeScript)"
                />
              </FormField>
            </div>

            <FormField label="Professional Summary">
              <Textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Concise summary of your verified domain expertise, engineering scope, and career focus..."
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Contact Email">
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </FormField>
              <FormField label="Contact Phone / WhatsApp">
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+62 812..."
                />
              </FormField>
              <FormField label="Preferred Language">
                <Select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                >
                  {PREFERRED_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="City / Location">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Jakarta"
                />
              </FormField>
              <FormField label="Country">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Indonesia"
                />
              </FormField>
              <FormField label="Career Level">
                <Select
                  value={careerLevel}
                  onChange={(e) =>
                    setCareerLevel(e.target.value as CareerLevel | "")
                  }
                >
                  <option value="">Select level...</option>
                  {CAREER_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {CAREER_LEVEL_LABELS[lvl]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Total Experience (Years)">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={totalExperienceYears}
                  onChange={(e) => setTotalExperienceYears(e.target.value)}
                  placeholder="4"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="LinkedIn URL">
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </FormField>
              <FormField label="Portfolio / Website URL">
                <Input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://..."
                />
              </FormField>
              <FormField label="GitHub URL">
                <Input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </FormField>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="text-section-title text-foreground">
              2. Career Preferences
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Target Positions (comma-separated)"
                hint="Roles you are targeting in your job search"
              >
                <Input
                  value={targetPositionsText}
                  onChange={(e) => setTargetPositionsText(e.target.value)}
                  placeholder="Staff Backend Engineer, Technical Lead"
                />
              </FormField>
              <FormField
                label="Target Industries (comma-separated)"
                hint="Preferred sectors"
              >
                <Input
                  value={targetIndustriesText}
                  onChange={(e) => setTargetIndustriesText(e.target.value)}
                  placeholder="Fintech, SaaS, E-Commerce"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Preferred Locations (comma-separated)">
                <Input
                  value={preferredLocationsText}
                  onChange={(e) => setPreferredLocationsText(e.target.value)}
                  placeholder="Jakarta, Bandung, Remote"
                />
              </FormField>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-foreground">
                  Preferred Work Arrangements
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {WORK_ARRANGEMENTS.map((arr) => {
                    const active = preferredArrangements.includes(arr);
                    return (
                      <button
                        key={arr}
                        type="button"
                        onClick={() => toggleArrangement(arr)}
                        className={cn(
                          "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card text-muted-foreground hover:border-primary",
                        )}
                      >
                        {WORK_ARRANGEMENT_LABELS[arr]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <FormField label="Salary Currency">
                <Select
                  value={salaryCurrency}
                  onChange={(e) =>
                    setSalaryCurrency(e.target.value as Currency)
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Expected Salary Min">
                <Input
                  type="number"
                  min={0}
                  value={expectedSalaryMin}
                  onChange={(e) => setExpectedSalaryMin(e.target.value)}
                  placeholder="22000000"
                />
              </FormField>
              <FormField label="Expected Salary Max">
                <Input
                  type="number"
                  min={0}
                  value={expectedSalaryMax}
                  onChange={(e) => setExpectedSalaryMax(e.target.value)}
                  placeholder="32000000"
                />
              </FormField>
              <FormField label="Salary Period">
                <Select
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
              </FormField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={syncToSuitabilitySettings}
                  onChange={(e) =>
                    setSyncToSuitabilitySettings(e.target.checked)
                  }
                />
                Sync headline, experience, locations, and salary to Suitability
                Evaluation defaults
              </label>

              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Master Career Profile"}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* TAB 2: Work Experience */}
      {tab === "experiences" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">
              Work Experience
            </h3>
            <Button onClick={() => setExpModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" />
              Add Experience
            </Button>
          </div>

          {data.experiences.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No work experience added yet"
              description="Add your roles, responsibilities, and measurable achievements so future AI CV tailoring stays 100% factual."
              action={
                <Button onClick={() => setExpModal({ open: true, item: null })}>
                  <Plus className="h-4 w-4" />
                  Add First Experience
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data.experiences.map((exp) => (
                <Card key={exp.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-card-title text-foreground">
                          {exp.jobTitle}
                        </h4>
                        <Badge variant="outline">
                          {
                            EMPLOYMENT_TYPE_LABELS[
                              exp.employmentType as EmploymentType
                            ]
                          }
                        </Badge>
                        {exp.isCurrent && (
                          <Badge variant="success">Current Role</Badge>
                        )}
                        <Badge variant="secondary">
                          {exp.verificationStatus}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-primary-text">
                        {exp.companyName}
                        {exp.location ? ` • ${exp.location}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {formatDate(exp.startDate)} —{" "}
                        {exp.isCurrent
                          ? "Present"
                          : exp.endDate
                            ? formatDate(exp.endDate)
                            : "Unspecified"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpModal({ open: true, item: exp })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "experience",
                            id: exp.id,
                            label: `${exp.jobTitle} at ${exp.companyName}`,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {exp.responsibilities && (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {exp.responsibilities}
                    </p>
                  )}

                  {exp.achievements.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-foreground">
                        Measurable Achievements:
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {exp.achievements.map((ach, i) => (
                          <li key={i}>{ach}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Education */}
      {tab === "educations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">Education</h3>
            <Button onClick={() => setEduModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" />
              Add Education
            </Button>
          </div>

          {data.educations.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No education records yet"
              description="Add degrees, diplomas, or academic qualifications."
              action={
                <Button onClick={() => setEduModal({ open: true, item: null })}>
                  <Plus className="h-4 w-4" />
                  Add Education
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.educations.map((edu) => (
                <Card key={edu.id} className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-card-title text-foreground">
                        {edu.institution}
                      </h4>
                      <p className="text-xs font-medium text-primary-text">
                        {EDUCATION_LABELS[edu.qualification as EducationLevel]}
                        {edu.degreeTitle ? ` • ${edu.degreeTitle}` : ""}
                      </p>
                      {edu.fieldOfStudy && (
                        <p className="text-xs text-muted-foreground">
                          {edu.fieldOfStudy}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEduModal({ open: true, item: edu })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "education",
                            id: edu.id,
                            label: edu.institution,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {edu.graduationYear && (
                      <Badge variant="outline">
                        Class of {edu.graduationYear}
                      </Badge>
                    )}
                    {edu.gpa && <Badge variant="secondary">GPA {edu.gpa}</Badge>}
                  </div>
                  {edu.notes && (
                    <p className="text-xs text-muted-foreground">{edu.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Skills */}
      {tab === "skills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">
              Skills &amp; Grounded Evidence
            </h3>
            <Button onClick={() => setSkillModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" />
              Add Skill
            </Button>
          </div>

          {data.skills.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No skills recorded yet"
              description="Add verified skills with proficiency levels and real-world evidence."
              action={
                <Button
                  onClick={() => setSkillModal({ open: true, item: null })}
                >
                  <Plus className="h-4 w-4" />
                  Add Skill
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.skills.map((sk) => (
                <Card key={sk.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {sk.skillName}
                        </span>
                        <Badge variant="outline">
                          {
                            SKILL_CATEGORY_LABELS[
                              sk.category as SkillCategory
                            ]
                          }
                        </Badge>
                        <Badge variant="secondary">
                          {
                            SKILL_PROFICIENCY_LABELS[
                              sk.proficiencyLevel as SkillProficiency
                            ]
                          }
                        </Badge>
                      </div>
                      {sk.yearsOfExperience != null && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {sk.yearsOfExperience} year(s) experience
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant={sk.isUserVerified ? "secondary" : "outline"}
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggleSkillVerify(sk)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {sk.isUserVerified ? "Verified" : "Verify"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSkillModal({ open: true, item: sk })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "skill",
                            id: sk.id,
                            label: sk.skillName,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {sk.evidence && (
                    <p className="text-xs text-muted-foreground">
                      Evidence: {sk.evidence}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Certifications */}
      {tab === "certifications" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">
              Certifications &amp; Licenses
            </h3>
            <Button onClick={() => setCertModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" />
              Add Certification
            </Button>
          </div>

          {data.certifications.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No certifications added yet"
              description="Record industry certifications, issuing organizations, and verification URLs."
              action={
                <Button
                  onClick={() => setCertModal({ open: true, item: null })}
                >
                  <Plus className="h-4 w-4" />
                  Add Certification
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.certifications.map((cert) => (
                <Card key={cert.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-card-title text-foreground">
                        {cert.name}
                      </h4>
                      <p className="text-xs font-medium text-primary-text">
                        {cert.issuingOrganization}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {cert.issueDate
                          ? `Issued ${formatDate(cert.issueDate)}`
                          : "Issue date not set"}
                        {cert.expirationDate
                          ? ` • Expires ${formatDate(cert.expirationDate)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setCertModal({ open: true, item: cert })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "certification",
                            id: cert.id,
                            label: cert.name,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {cert.credentialId && (
                      <Badge variant="outline">ID: {cert.credentialId}</Badge>
                    )}
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
                      >
                        Verify Credential{" "}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: Projects */}
      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">
              Projects &amp; Portfolio
            </h3>
            <Button onClick={() => setProjModal({ open: true, item: null })}>
              <Plus className="h-4 w-4" />
              Add Project
            </Button>
          </div>

          {data.projects.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No projects added yet"
              description="Document technical, product, or open-source projects with technologies and measurable results."
              action={
                <Button
                  onClick={() => setProjModal({ open: true, item: null })}
                >
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data.projects.map((proj) => (
                <Card key={proj.id} className="space-y-2.5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-card-title text-foreground">
                          {proj.name}
                        </h4>
                        {proj.role && (
                          <Badge variant="outline">{proj.role}</Badge>
                        )}
                        {proj.isOngoing && (
                          <Badge variant="success">Ongoing</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {proj.organization ? `${proj.organization} • ` : ""}
                        {proj.startDate ? formatDate(proj.startDate) : ""}
                        {proj.isOngoing
                          ? " — Present"
                          : proj.endDate
                            ? ` — ${formatDate(proj.endDate)}`
                            : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {proj.projectUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={proj.projectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Link
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setProjModal({ open: true, item: proj })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "project",
                            id: proj.id,
                            label: proj.name,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {proj.description && (
                    <p className="text-xs text-muted-foreground">
                      {proj.description}
                    </p>
                  )}
                  {proj.achievements.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {proj.achievements.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {proj.technologies.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: AI Career Roadmap */}
      {tab === "roadmap" && (
        <CareerRoadmapPanel
          defaultTargetRole={
            profile.targetPositions?.[0] || profile.headline || ""
          }
          initialRoadmap={latestRoadmap}
        />
      )}

      {/* Summary Footer */}
      {expectedSalaryMin && (
        <p className="text-[11px] text-muted-foreground">
          Target compensation recorded:{" "}
          <strong className="text-foreground">
            {formatMoney(Number(expectedSalaryMin), salaryCurrency)}
            {expectedSalaryMax
              ? ` – ${formatMoney(Number(expectedSalaryMax), salaryCurrency)}`
              : ""}
          </strong>{" "}
          ({SALARY_PERIOD_LABELS[salaryPeriod]}).
        </p>
      )}

      {/* Modals */}
      {stageCvOpen && (
        <StageCvImportDialog
          open={stageCvOpen}
          onClose={() => setStageCvOpen(false)}
          cvVersions={data.cvVersions}
        />
      )}

      {reviewCvOpen && profile.pendingReviewPayload && (
        <ReviewStagedCvImportDialog
          open={reviewCvOpen}
          onClose={() => setReviewCvOpen(false)}
          staged={profile.pendingReviewPayload}
        />
      )}

      {expModal.open && (
        <ExperienceFormDialog
          open={expModal.open}
          onClose={() => setExpModal({ open: false })}
          initial={expModal.item}
        />
      )}

      {eduModal.open && (
        <EducationFormDialog
          open={eduModal.open}
          onClose={() => setEduModal({ open: false })}
          initial={eduModal.item}
        />
      )}

      {skillModal.open && (
        <SkillFormDialog
          open={skillModal.open}
          onClose={() => setSkillModal({ open: false })}
          initial={skillModal.item}
        />
      )}

      {certModal.open && (
        <CertificationFormDialog
          open={certModal.open}
          onClose={() => setCertModal({ open: false })}
          initial={certModal.item}
        />
      )}

      {projModal.open && (
        <ProjectFormDialog
          open={projModal.open}
          onClose={() => setProjModal({ open: false })}
          initial={projModal.item}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={`Remove "${deleteTarget?.label ?? "record"}"?`}
        description="This permanently deletes the selected career record from your Master Career Profile."
        confirmLabel="Remove Record"
        variant="destructive"
        pending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
