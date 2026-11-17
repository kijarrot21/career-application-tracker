"use client";

import {
  ArrowDown,
  ArrowUp,
  Database,
  Download,
  Eye,
  EyeOff,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FormField,
  Input,
  PageHeader,
  Select,
  StageBadge,
} from "@/components/ui";
import {
  CURRENCIES,
  SEARCH_STATUS_LABELS,
  SEARCH_STATUSES,
  TIMEZONES,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENTS,
  type Currency,
  type SearchStatus,
} from "@/lib/constants";
import { INDONESIAN_HOLIDAY_PRESETS } from "@/lib/domain/business-days";
import {
  CUSTOM_STAGE_TYPES,
  STAGE_COLORS,
  type StageColor,
} from "@/lib/domain/stages";
import {
  CRITERIA,
  CRITERION_LABELS,
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Weights,
  type WorkArrangement,
} from "@/lib/domain/suitability";
import {
  deleteAccountWithPasswordAction,
  loadSampleDataAction,
  removeSampleDataAction,
  reorderStagesAction,
  saveStageAction,
  toggleStageHiddenAction,
  updateFollowUpSettingsAction,
  updateProfileSettingsAction,
  updateSuitabilityWeightsAction,
} from "@/server/actions/settings";
import type {
  getSampleDataStatus,
  getUserSettings,
  getUserStages,
} from "@/server/queries/settings";

type SettingsData = Awaited<ReturnType<typeof getUserSettings>>;
type StagesData = Awaited<ReturnType<typeof getUserStages>>;
type SampleStatus = Awaited<ReturnType<typeof getSampleDataStatus>>;

export function SettingsClient({
  settings,
  stages,
  sampleStatus,
}: {
  settings: SettingsData;
  stages: StagesData;
  sampleStatus: SampleStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. Profile state
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState<Currency>(
    (settings.currency as Currency) ?? "IDR",
  );
  const [searchStatus, setSearchStatus] = useState<SearchStatus>(
    settings.searchStatus,
  );
  const [headline, setHeadline] = useState(settings.headline ?? "");
  const [skillsText, setSkillsText] = useState(
    (settings.skills ?? []).join(", "),
  );
  const [yearsExperience, setYearsExperience] = useState(
    settings.yearsExperience != null ? String(settings.yearsExperience) : "",
  );
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">(
    settings.educationLevel ?? "bachelor",
  );
  const [expectedSalaryMin, setExpectedSalaryMin] = useState(
    settings.expectedSalaryMin != null
      ? String(settings.expectedSalaryMin)
      : "",
  );
  const [expectedSalaryMax, setExpectedSalaryMax] = useState(
    settings.expectedSalaryMax != null
      ? String(settings.expectedSalaryMax)
      : "",
  );
  const [preferredLocationsText, setPreferredLocationsText] = useState(
    (settings.preferredLocations ?? []).join(", "),
  );
  const [preferredArrangements, setPreferredArrangements] = useState<
    WorkArrangement[]
  >((settings.preferredArrangements ?? []) as WorkArrangement[]);

  // 2. Follow-up rules state
  const [followUpFirstDays, setFollowUpFirstDays] = useState(
    String(settings.followUpFirstDays),
  );
  const [followUpSecondDays, setFollowUpSecondDays] = useState(
    String(settings.followUpSecondDays),
  );
  const [followUpFinalDays, setFollowUpFinalDays] = useState(
    String(settings.followUpFinalDays),
  );
  const [noResponseDays, setNoResponseDays] = useState(
    String(settings.noResponseDays),
  );
  const [holidaysText, setHolidaysText] = useState(
    (settings.holidays ?? []).join(", "),
  );

  // 3. Suitability weights state
  const [weights, setWeights] = useState<Weights>(settings.suitabilityWeights);

  // 4. Custom stage state
  const [newStageName, setNewStageName] = useState("");
  const [newStageType, setNewStageType] = useState<string>("interview");
  const [newStageColor, setNewStageColor] = useState<StageColor>("indigo");

  // 5. Account deletion state
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function toggleArrangement(arr: WorkArrangement) {
    setPreferredArrangements((prev) =>
      prev.includes(arr) ? prev.filter((x) => x !== arr) : [...prev, arr],
    );
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfileSettingsAction({
          timezone: timezone as (typeof TIMEZONES)[number],
          currency,
          searchStatus,
          headline: headline || null,
          skills: skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          yearsExperience: yearsExperience ? Number(yearsExperience) : null,
          educationLevel: (educationLevel || null) as EducationLevel | null,
          expectedSalaryMin: expectedSalaryMin
            ? Number(expectedSalaryMin)
            : null,
          expectedSalaryMax: expectedSalaryMax
            ? Number(expectedSalaryMax)
            : null,
          preferredLocations: preferredLocationsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          preferredArrangements,
          includeSampleInAnalytics: settings.includeSampleInAnalytics,
        });
        toast.success("Profile and preferences saved.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save profile",
        );
      }
    });
  }

  function handleSaveFollowUp(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateFollowUpSettingsAction({
          followUpFirstDays: Number(followUpFirstDays) || 5,
          followUpSecondDays: Number(followUpSecondDays) || 5,
          followUpFinalDays: Number(followUpFinalDays) || 0,
          noResponseDays: Number(noResponseDays) || 30,
          holidays: holidaysText
            .split(",")
            .map((d) => d.trim())
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
        });
        toast.success("Follow-up intervals updated.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save rules",
        );
      }
    });
  }

  function handleSaveWeights(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateSuitabilityWeightsAction(weights);
        toast.success("Suitability weights saved.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save weights",
        );
      }
    });
  }

  function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    startTransition(async () => {
      try {
        await saveStageAction({
          name: newStageName.trim(),
          stageType: newStageType,
          color: newStageColor,
        });
        setNewStageName("");
        toast.success("Custom recruitment stage added.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add stage");
      }
    });
  }

  function handleMoveStageOrder(index: number, direction: -1 | 1) {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= stages.length) return;
    const orderedIds = stages.map((s) => s.id);
    const [moved] = orderedIds.splice(index, 1);
    orderedIds.splice(nextIdx, 0, moved);
    startTransition(async () => {
      try {
        await reorderStagesAction(orderedIds);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not reorder stages",
        );
      }
    });
  }

  function handleRequestDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleteDialogOpen(true);
  }

  function handleConfirmDeleteAccount() {
    startTransition(async () => {
      try {
        await deleteAccountWithPasswordAction(deletePassword);
        toast.success("Your account and data have been permanently deleted.");
        setDeleteDialogOpen(false);
        router.push("/sign-in");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Account deletion failed",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-xs">
      <PageHeader
        title="Settings, Pipeline Customization & Data Privacy"
        description="Configure your candidate profile, recruitment stages, follow-up rules, suitability weights, and privacy controls."
      />

      {/* 1. Candidate Profile & Locale */}
      <Card padding="md">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h2 className="text-section-title text-foreground">
            1. Candidate Profile & Preferences
          </h2>
          <p className="text-muted-foreground">
            Used to auto-suggest suitability scores when evaluating job
            vacancies.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Timezone">
              <Select
                selectSize="lg"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Default Currency">
              <Select
                selectSize="lg"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Job Search Status">
              <Select
                selectSize="lg"
                value={searchStatus}
                onChange={(e) =>
                  setSearchStatus(e.target.value as SearchStatus)
                }
              >
                {SEARCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SEARCH_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Target Headline / Role">
              <Input
                type="text"
                inputSize="lg"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Full-Stack Software Engineer"
              />
            </FormField>

            <FormField label="Years of Experience">
              <Input
                type="number"
                inputSize="lg"
                min={0}
                max={50}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Highest Education Level">
              <Select
                selectSize="lg"
                value={educationLevel}
                onChange={(e) =>
                  setEducationLevel(e.target.value as EducationLevel)
                }
              >
                {EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {EDUCATION_LABELS[lvl]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Your Skills (comma-separated)">
            <Input
              type="text"
              inputSize="lg"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="TypeScript, React, Next.js, Node.js, PostgreSQL, Tailwind CSS"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label={`Expected Monthly Salary Min (${currency})`}>
              <Input
                type="number"
                inputSize="lg"
                min={0}
                value={expectedSalaryMin}
                onChange={(e) => setExpectedSalaryMin(e.target.value)}
                placeholder="22000000"
                className="tabular-nums"
              />
            </FormField>
            <FormField label={`Expected Monthly Salary Max (${currency})`}>
              <Input
                type="number"
                inputSize="lg"
                min={0}
                value={expectedSalaryMax}
                onChange={(e) => setExpectedSalaryMax(e.target.value)}
                placeholder="32000000"
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Preferred Locations (comma-separated)">
              <Input
                type="text"
                inputSize="lg"
                value={preferredLocationsText}
                onChange={(e) => setPreferredLocationsText(e.target.value)}
                placeholder="Jakarta, Bandung, Remote"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground">
              Preferred Work Arrangements:
            </span>
            {WORK_ARRANGEMENTS.map((arr) => (
              <label
                key={arr}
                className="inline-flex items-center gap-1.5 font-medium text-foreground"
              >
                <input
                  type="checkbox"
                  checked={preferredArrangements.includes(arr)}
                  onChange={() => toggleArrangement(arr)}
                />
                <span>{WORK_ARRANGEMENT_LABELS[arr]}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              Save Profile & Preferences
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. Recruitment Pipeline Stages */}
      <Card padding="md" className="space-y-4">
        <div>
          <h2 className="text-section-title text-foreground">
            2. Recruitment Pipeline Stages
          </h2>
          <p className="text-muted-foreground">
            Reorder, hide, or add custom recruitment stages while preserving
            standard HR stage classifications.
          </p>
        </div>

        <div className="divide-y divide-border-subtle rounded-xl border border-border">
          {stages.map((st, idx) => (
            <div
              key={st.id}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <StageBadge name={st.name} color={st.color} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  type: {st.stageType}
                </span>
                {st.isHidden && <Badge variant="secondary">Hidden</Badge>}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending || idx === 0}
                  onClick={() => handleMoveStageOrder(idx, -1)}
                  aria-label={`Move ${st.name} earlier`}
                  title="Move stage earlier"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending || idx === stages.length - 1}
                  onClick={() => handleMoveStageOrder(idx, 1)}
                  aria-label={`Move ${st.name} later`}
                  title="Move stage later"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await toggleStageHiddenAction(st.id, !st.isHidden);
                        router.refresh();
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Cannot hide stage",
                        );
                      }
                    })
                  }
                >
                  {st.isHidden ? (
                    <>
                      <Eye className="h-3 w-3" /> Show
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" /> Hide
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddStage}
          className="flex flex-wrap items-end gap-2.5 pt-2"
        >
          <FormField label="Add Custom Stage Name" className="min-w-[200px] flex-1">
            <Input
              type="text"
              inputSize="lg"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="e.g., Live Coding Pair Session"
            />
          </FormField>

          <FormField label="Stage Classification">
            <Select
              selectSize="lg"
              value={newStageType}
              onChange={(e) => setNewStageType(e.target.value)}
            >
              {CUSTOM_STAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Badge Color">
            <Select
              selectSize="lg"
              value={newStageColor}
              onChange={(e) => setNewStageColor(e.target.value as StageColor)}
            >
              {STAGE_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stage
          </Button>
        </form>
      </Card>

      {/* 3. Follow-up & No Response Rules */}
      <Card padding="md">
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          <h2 className="text-section-title text-foreground">
            3. Follow-up & &ldquo;No Response&rdquo; Intervals
          </h2>
          <p className="text-muted-foreground">
            Operational defaults for follow-up task scheduling. Applications are
            never automatically marked as Rejected or No Response without your
            confirmation.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label="1st Follow-up (Business Days)">
              <Input
                type="number"
                inputSize="lg"
                min={1}
                max={60}
                value={followUpFirstDays}
                onChange={(e) => setFollowUpFirstDays(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="2nd Follow-up (Business Days)">
              <Input
                type="number"
                inputSize="lg"
                min={1}
                max={60}
                value={followUpSecondDays}
                onChange={(e) => setFollowUpSecondDays(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Final Follow-up (Business Days)">
              <Input
                type="number"
                inputSize="lg"
                min={0}
                max={90}
                value={followUpFinalDays}
                onChange={(e) => setFollowUpFinalDays(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="No Response Suggestion (Days)">
              <Input
                type="number"
                inputSize="lg"
                min={7}
                max={365}
                value={noResponseDays}
                onChange={(e) => setNoResponseDays(e.target.value)}
                className="tabular-nums"
              />
            </FormField>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="settings-holidays"
                className="font-semibold text-foreground"
              >
                Public Holidays Excluded from Business-Day Follow-up
                Calculations (YYYY-MM-DD, comma-separated)
              </label>
              <Button
                variant="soft"
                size="xs"
                onClick={() =>
                  setHolidaysText(INDONESIAN_HOLIDAY_PRESETS.join(", "))
                }
              >
                Load Indonesian Public Holidays (2026-2027)
              </Button>
            </div>
            <Input
              id="settings-holidays"
              type="text"
              inputSize="lg"
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder="2026-01-01, 2026-03-20, 2026-08-17, 2026-12-25"
              className="font-mono"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              Save Follow-up Rules
            </Button>
          </div>
        </form>
      </Card>

      {/* 4. Suitability Weights */}
      <Card padding="md">
        <form onSubmit={handleSaveWeights} className="space-y-4">
          <h2 className="text-section-title text-foreground">
            4. Job Suitability Evaluation Weights
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CRITERIA.map((c) => (
              <FormField key={c} label={CRITERION_LABELS[c]}>
                <Input
                  type="number"
                  inputSize="lg"
                  min={0}
                  max={100}
                  value={weights[c]}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [c]: Number(e.target.value) || 0,
                    }))
                  }
                  className="tabular-nums"
                />
              </FormField>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              Save Suitability Weights
            </Button>
          </div>
        </form>
      </Card>

      {/* 5. Sample Demonstration Data */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-warning" />
          <h2 className="text-section-title text-foreground">
            5. Sample Demonstration Records
          </h2>
        </div>
        <p className="text-muted-foreground">
          Sample records are clearly labeled with a SAMPLE badge and kept
          strictly separate from your real applications.
        </p>

        <div className="flex flex-wrap gap-2">
          {!sampleStatus.hasSampleData ? (
            <Button
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await loadSampleDataAction();
                    toast.success("Sample demonstration data loaded.");
                    router.refresh();
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to load sample data",
                    );
                  }
                })
              }
              className="border-warning-border bg-warning-soft text-warning-on-soft"
            >
              <Database className="h-3.5 w-3.5" />
              Load Sample Data
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await removeSampleDataAction();
                    toast.success("All sample records removed.");
                    router.refresh();
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to remove sample data",
                    );
                  }
                })
              }
              className="tabular-nums"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Sample Data ({sampleStatus.sampleJobsCount} jobs,{" "}
              {sampleStatus.sampleAppsCount} applications)
            </Button>
          )}
        </div>
      </Card>

      {/* 6. Data Export & Account Deletion (UU PDP) */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary-text" />
          <h2 className="text-section-title text-foreground">
            6. Data Portability & Account Deletion (Privacy / UU PDP)
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="lg" asChild>
            <a href="/api/export/account" download>
              <Download className="h-3.5 w-3.5" />
              Export All Account Data (JSON)
            </a>
          </Button>

          <Button variant="secondary" size="lg" asChild>
            <a href="/api/export/applications" download>
              <Download className="h-3.5 w-3.5" />
              Export Applications (CSV)
            </a>
          </Button>
        </div>

        <form
          onSubmit={handleRequestDeleteAccount}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-destructive-border pt-4"
        >
          <div className="min-w-[240px] flex-1">
            <label
              htmlFor="delete-account-password"
              className="block font-semibold text-destructive-on-soft"
            >
              Confirm Password to Permanently Delete Account & All Data
            </label>
            <Input
              id="delete-account-password"
              type="password"
              inputSize="lg"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1 border-destructive-border"
            />
          </div>

          <Button
            type="submit"
            variant="destructive"
            size="lg"
            disabled={isPending || !deletePassword}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account Permanently
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Permanently delete your account?"
        description="This will permanently erase your account and all job vacancies, applications, documents, emails, and history. This cannot be undone."
        confirmLabel="Delete Account Permanently"
        pending={isPending}
        onConfirm={handleConfirmDeleteAccount}
      />
    </div>
  );
}
