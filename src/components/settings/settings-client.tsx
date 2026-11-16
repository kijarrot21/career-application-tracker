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
import { StageBadge } from "@/components/ui/badges";
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
import {
  CUSTOM_STAGE_TYPES,
  STAGE_COLORS,
  type StageColor,
} from "@/lib/domain/stages";
import { INDONESIAN_HOLIDAY_PRESETS } from "@/lib/domain/business-days";
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
      await reorderStagesAction(orderedIds);
      router.refresh();
    });
  }

  function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "Permanently delete your account and all job vacancies, applications, and history? This cannot be undone.",
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteAccountWithPasswordAction(deletePassword);
        toast.success("Your account and data have been permanently deleted.");
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
      <div>
        <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
          Settings, Pipeline Customization & Data Privacy
        </h1>
        <p className="text-[13px] text-[#64748B]">
          Configure your candidate profile, recruitment stages, follow-up rules,
          suitability weights, and privacy controls.
        </p>
      </div>

      {/* 1. Candidate Profile & Locale */}
      <form
        onSubmit={handleSaveProfile}
        className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
          1. Candidate Profile & Preferences
        </h2>
        <p className="text-[#64748B]">
          Used to auto-suggest suitability scores when evaluating job vacancies.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Default Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Job Search Status
            </label>
            <select
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value as SearchStatus)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {SEARCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SEARCH_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Target Headline / Role
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Full-Stack Software Engineer"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Years of Experience
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Highest Education Level
            </label>
            <select
              value={educationLevel}
              onChange={(e) =>
                setEducationLevel(e.target.value as EducationLevel)
              }
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {EDUCATION_LABELS[lvl]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-[#334155] dark:text-slate-300">
            Your Skills (comma-separated)
          </label>
          <input
            type="text"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="TypeScript, React, Next.js, Node.js, PostgreSQL, Tailwind CSS"
            className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Expected Monthly Salary Min ({currency})
            </label>
            <input
              type="number"
              min={0}
              value={expectedSalaryMin}
              onChange={(e) => setExpectedSalaryMin(e.target.value)}
              placeholder="22000000"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Expected Monthly Salary Max ({currency})
            </label>
            <input
              type="number"
              min={0}
              value={expectedSalaryMax}
              onChange={(e) => setExpectedSalaryMax(e.target.value)}
              placeholder="32000000"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Preferred Locations (comma-separated)
            </label>
            <input
              type="text"
              value={preferredLocationsText}
              onChange={(e) => setPreferredLocationsText(e.target.value)}
              placeholder="Jakarta, Bandung, Remote"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-[#334155] dark:text-slate-300">
            Preferred Work Arrangements:
          </span>
          {WORK_ARRANGEMENTS.map((arr) => (
            <label
              key={arr}
              className="inline-flex items-center gap-1.5 font-medium text-[#0F172A] dark:text-slate-200"
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
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
          >
            Save Profile & Preferences
          </button>
        </div>
      </form>

      {/* 2. Recruitment Pipeline Stages */}
      <div className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
            2. Recruitment Pipeline Stages
          </h2>
          <p className="text-[#64748B]">
            Reorder, hide, or add custom recruitment stages while preserving
            standard HR stage classifications.
          </p>
        </div>

        <div className="divide-y divide-[#E2E8F0] rounded-[8px] border border-[#E2E8F0] dark:divide-slate-800 dark:border-slate-800">
          {stages.map((st, idx) => (
            <div
              key={st.id}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <StageBadge name={st.name} color={st.color} />
                <span className="font-mono text-[11px] text-[#64748B]">
                  type: {st.stageType}
                </span>
                {st.isHidden && (
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B] dark:bg-slate-800">
                    Hidden
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isPending || idx === 0}
                  onClick={() => handleMoveStageOrder(idx, -1)}
                  title="Move stage earlier"
                  className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] disabled:opacity-30 dark:hover:bg-slate-800"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isPending || idx === stages.length - 1}
                  onClick={() => handleMoveStageOrder(idx, 1)}
                  title="Move stage later"
                  className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] disabled:opacity-30 dark:hover:bg-slate-800"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
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
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
                </button>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddStage}
          className="flex flex-wrap items-end gap-2.5 pt-2"
        >
          <div className="flex-1">
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Add Custom Stage Name
            </label>
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="e.g., Live Coding Pair Session"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Stage Classification
            </label>
            <select
              value={newStageType}
              onChange={(e) => setNewStageType(e.target.value)}
              className="mt-1 h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {CUSTOM_STAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Badge Color
            </label>
            <select
              value={newStageColor}
              onChange={(e) => setNewStageColor(e.target.value as StageColor)}
              className="mt-1 h-10 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
            >
              {STAGE_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-10 items-center gap-1 rounded-[4px] bg-[#204CD3] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stage
          </button>
        </form>
      </div>

      {/* 3. Follow-up & No Response Rules */}
      <form
        onSubmit={handleSaveFollowUp}
        className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
          3. Follow-up & &ldquo;No Response&rdquo; Intervals
        </h2>
        <p className="text-[#64748B]">
          Operational defaults for follow-up task scheduling. Applications are
          never automatically marked as Rejected or No Response without your
          confirmation.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              1st Follow-up (Business Days)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={followUpFirstDays}
              onChange={(e) => setFollowUpFirstDays(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              2nd Follow-up (Business Days)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={followUpSecondDays}
              onChange={(e) => setFollowUpSecondDays(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Final Follow-up (Business Days)
            </label>
            <input
              type="number"
              min={0}
              max={90}
              value={followUpFinalDays}
              onChange={(e) => setFollowUpFinalDays(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              No Response Suggestion (Days)
            </label>
            <input
              type="number"
              min={7}
              max={365}
              value={noResponseDays}
              onChange={(e) => setNoResponseDays(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-semibold text-[#334155] dark:text-slate-300">
              Public Holidays Excluded from Business-Day Follow-up Calculations (YYYY-MM-DD, comma-separated)
            </label>
            <button
              type="button"
              onClick={() =>
                setHolidaysText(INDONESIAN_HOLIDAY_PRESETS.join(", "))
              }
              className="rounded-[4px] border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DDE1FF]"
            >
              Load Indonesian Public Holidays (2026-2027)
            </button>
          </div>
          <input
            type="text"
            value={holidaysText}
            onChange={(e) => setHolidaysText(e.target.value)}
            placeholder="2026-01-01, 2026-03-20, 2026-08-17, 2026-12-25"
            className="h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 font-mono text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
          >
            Save Follow-up Rules
          </button>
        </div>
      </form>

      {/* 4. Suitability Weights */}
      <form
        onSubmit={handleSaveWeights}
        className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
          4. Job Suitability Evaluation Weights
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CRITERIA.map((c) => (
            <div key={c}>
              <label className="block truncate font-semibold text-[#334155] dark:text-slate-300">
                {CRITERION_LABELS[c]}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights[c]}
                onChange={(e) =>
                  setWeights((prev) => ({
                    ...prev,
                    [c]: Number(e.target.value) || 0,
                  }))
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
          >
            Save Suitability Weights
          </button>
        </div>
      </form>

      {/* 5. Sample Demonstration Data */}
      <div className="elevation-1 space-y-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#F59E0B]" />
          <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
            5. Sample Demonstration Records
          </h2>
        </div>
        <p className="text-[#64748B]">
          Sample records are clearly labeled with a SAMPLE badge and kept
          strictly separate from your real applications.
        </p>

        <div className="flex flex-wrap gap-2">
          {!sampleStatus.hasSampleData ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await loadSampleDataAction();
                  toast.success("Sample demonstration data loaded.");
                  router.refresh();
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 text-xs font-semibold text-[#B45309] hover:bg-[#FEF3C7] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
            >
              <Database className="h-3.5 w-3.5" />
              Load Sample Data
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await removeSampleDataAction();
                  toast.success("All sample records removed.");
                  router.refresh();
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFFFF] px-3 text-xs font-semibold text-[#B45309] tabular-nums hover:bg-[#FFFBEB] dark:border-amber-800 dark:bg-slate-950 dark:text-amber-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Sample Data ({sampleStatus.sampleJobsCount} jobs,{" "}
              {sampleStatus.sampleAppsCount} applications)
            </button>
          )}
        </div>
      </div>

      {/* 6. Data Export & Account Deletion (UU PDP) */}
      <div className="elevation-1 space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#204CD3]" />
          <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
            6. Data Portability & Account Deletion (Privacy / UU PDP)
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/account"
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export All Account Data (JSON)
          </a>

          <a
            href="/api/export/applications"
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export Applications (CSV)
          </a>
        </div>

        <form
          onSubmit={handleDeleteAccount}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#F43F5E]/20 pt-4 dark:border-rose-950"
        >
          <div className="flex-1">
            <label className="block font-semibold text-[#BE123C] dark:text-rose-400">
              Confirm Password to Permanently Delete Account & All Data
            </label>
            <input
              type="password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1 h-10 w-full rounded-[4px] border border-[#F43F5E]/40 bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-rose-900 dark:bg-slate-950"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !deletePassword}
            className="inline-flex h-10 items-center gap-1.5 rounded-[4px] bg-[#F43F5E] px-3.5 text-xs font-semibold text-white hover:bg-[#E11D48] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account Permanently
          </button>
        </form>
      </div>
    </div>
  );
}
