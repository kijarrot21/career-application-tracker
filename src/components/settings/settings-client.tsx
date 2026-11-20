"use client";

import {
  ArrowDown,
  ArrowUp,
  Cpu,
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
import { useTranslations } from "@/components/i18n/locale-provider";
import { OnboardingSettingsCard } from "@/components/settings/onboarding-settings-card";
import {
  getFeatureAvailability,
  isFeatureEnabled,
} from "@/lib/domain/feature-availability";
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
  StatusBadge,
} from "@/components/ui";
import {
  SEARCH_STATUSES,
  TIMEZONES,
  type SearchStatus,
} from "@/lib/constants";
import {
  getLocalizedFeatureLabel,
  getLocalizedFeatureStatusLabel,
  getLocalizedSearchStatusLabel,
  getMessages,
  getSupportedCurrencyOptions,
  MARKET_CONFIGS,
  normalizeLocale,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/lib/i18n";
import { INDONESIAN_HOLIDAY_PRESETS } from "@/lib/domain/business-days";
import {
  AI_PREFERRED_PROVIDERS,
  AI_PRIVACY_MODE_DESCRIPTIONS,
  AI_PRIVACY_MODE_LABELS,
  AI_PRIVACY_MODES,
  AI_PROVIDER_LABELS,
  DEFAULT_OLLAMA_ENDPOINT,
  type AiPreferredProvider,
  type AiPrivacyMode,
  type AiProviderSanitizedStatus,
} from "@/lib/domain/ai";
import {
  CUSTOM_STAGE_TYPES,
  STAGE_COLORS,
  type StageColor,
} from "@/lib/domain/stages";
import {
  CRITERIA,
  CRITERION_LABELS,
  type Weights,
} from "@/lib/domain/suitability";
import {
  deleteAccountWithPasswordAction,
  loadSampleDataAction,
  removeSampleDataAction,
  reorderStagesAction,
  saveStageAction,
  toggleStageHiddenAction,
  updateAiPrivacySettingsAction,
  updateFollowUpSettingsAction,
  updateSuitabilityWeightsAction,
  updateWorkspaceSettingsAction,
} from "@/server/actions/settings";
import type { ProgressSnapshot } from "@/lib/domain/progress";
import type {
  getSampleDataStatus,
  getUserSettings,
  getUserStages,
} from "@/server/queries/settings";
import type { OnboardingPreferencesResult } from "@/server/services/onboarding";

type SettingsData = Awaited<ReturnType<typeof getUserSettings>>;
type StagesData = Awaited<ReturnType<typeof getUserStages>>;
type SampleStatus = Awaited<ReturnType<typeof getSampleDataStatus>>;

export function SettingsClient({
  settings,
  stages,
  sampleStatus,
  aiProviders,
  onboarding,
  progress,
}: {
  settings: SettingsData;
  stages: StagesData;
  sampleStatus: SampleStatus;
  aiProviders: AiProviderSanitizedStatus[];
  onboarding: OnboardingPreferencesResult;
  progress: ProgressSnapshot;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { locale: activeLocale, messages } = useTranslations();

  const localAIAvailability = getFeatureAvailability("localAI");
  const localAIStatusLabel = getLocalizedFeatureStatusLabel(
    localAIAvailability.status,
    activeLocale,
  );
  const cloudAIAvailability = getFeatureAvailability("cloudAI");
  const cloudAISupported = isFeatureEnabled("cloudAI");
  const cloudAIStatusLabel = getLocalizedFeatureStatusLabel(
    cloudAIAvailability.status,
    activeLocale,
  );

  // 1. Workspace locale & search status state
  const [preferredLocale, setPreferredLocale] = useState<AppLocale>(
    normalizeLocale(settings.preferredLocale ?? activeLocale),
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState<string>(
    settings.currency ?? "IDR",
  );
  const [searchStatus, setSearchStatus] = useState<SearchStatus>(
    settings.searchStatus,
  );
  const currencyOptions = getSupportedCurrencyOptions(preferredLocale);

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

  // 5. AI privacy mode state
  const [aiPrivacyMode, setAiPrivacyMode] = useState<AiPrivacyMode>(
    cloudAISupported
      ? settings.aiPrivacyMode
      : settings.aiPrivacyMode === "cloud_allowed"
        ? "ask_before_each"
        : settings.aiPrivacyMode,
  );
  const [aiPreferredProvider, setAiPreferredProvider] =
    useState<AiPreferredProvider>(
      cloudAISupported
        ? settings.aiPreferredProvider
        : settings.aiPreferredProvider === "ollama"
          ? "ollama"
          : "auto",
    );
  const [aiOllamaEndpoint, setAiOllamaEndpoint] = useState(
    settings.aiOllamaEndpoint ?? DEFAULT_OLLAMA_ENDPOINT,
  );
  const [aiOllamaModel, setAiOllamaModel] = useState(
    settings.aiOllamaModel ?? "",
  );
  const [aiCloudDocumentConsent, setAiCloudDocumentConsent] = useState(
    cloudAISupported && settings.aiCloudDocumentConsent,
  );

  // 6. Account deletion state
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function handleSaveAiPrivacy(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateAiPrivacySettingsAction({
          aiPrivacyMode,
          aiPreferredProvider,
          aiOllamaEndpoint: aiOllamaEndpoint.trim() || null,
          aiOllamaModel: aiOllamaModel.trim() || null,
          aiCloudDocumentConsent: cloudAISupported
            ? aiPrivacyMode === "local_only"
              ? false
              : aiCloudDocumentConsent
            : false,
        });
        toast.success("AI privacy and provider preferences saved.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not save AI privacy settings",
        );
      }
    });
  }

  function handleSaveWorkspaceSettings(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateWorkspaceSettingsAction({
          preferredLocale,
          timezone: timezone as (typeof TIMEZONES)[number],
          currency,
          searchStatus,
          includeSampleInAnalytics: settings.includeSampleInAnalytics,
        });
        toast.success(getMessages(preferredLocale).settings.workspaceSavedToast);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : messages.errors.UNKNOWN_ERROR,
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
        title={messages.settings.pageTitle}
        description={messages.settings.pageDescription}
      />

      <OnboardingSettingsCard onboarding={onboarding} progress={progress} />

      {/* 1. Workspace Locale & Search Status */}
      <Card padding="md">
        <form onSubmit={handleSaveWorkspaceSettings} className="space-y-4">
          <h2 className="text-section-title text-foreground">
            {messages.settings.workspaceSectionTitle}
          </h2>
          <p className="text-muted-foreground">
            {messages.settings.workspaceSectionDescription}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              label={messages.settings.preferredLanguageLabel}
              hint={messages.settings.preferredLanguageHint}
            >
              <Select
                selectSize="lg"
                value={preferredLocale}
                onChange={(e) =>
                  setPreferredLocale(normalizeLocale(e.target.value))
                }
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {MARKET_CONFIGS[loc].label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={messages.settings.timezoneLabel}>
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

            <FormField
              label={messages.settings.currencyLabel}
              hint={messages.settings.currencyHint}
            >
              <Select
                selectSize="lg"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencyOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={messages.settings.searchStatusLabel}>
              <Select
                selectSize="lg"
                value={searchStatus}
                onChange={(e) =>
                  setSearchStatus(e.target.value as SearchStatus)
                }
              >
                {SEARCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {getLocalizedSearchStatusLabel(s, preferredLocale)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              {messages.settings.saveWorkspaceButton}
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

      {/* 5. AI Privacy & Provider Mode */}
      <Card padding="md">
        <form onSubmit={handleSaveAiPrivacy} className="space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-text" />
            <h2 className="text-section-title text-foreground">
              {messages.featureAvailability.cloudAI.settingsTitle}
            </h2>
          </div>
          <p className="text-muted-foreground">
            {messages.featureAvailability.cloudAI.settingsNote}
          </p>

          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3"
          >
            <StatusBadge
              label={`${getLocalizedFeatureLabel("localAI", activeLocale)} — ${localAIStatusLabel}`}
              tone={localAIAvailability.tone}
            />
            <span className="text-muted-foreground">
              {messages.featureAvailability.localAI.message}
            </span>
          </div>

          {!cloudAISupported && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3"
            >
              <StatusBadge
                label={cloudAIStatusLabel}
                tone={cloudAIAvailability.tone}
              />
              <span className="text-muted-foreground">
                {messages.featureAvailability.cloudAI.message}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {aiProviders.map((p) => {
              const cloudUnavailable = p.locality === "cloud" && !cloudAISupported;
              return (
                <Badge
                  key={p.id}
                  variant={
                    cloudUnavailable
                      ? "secondary"
                      : p.configured
                        ? "success"
                        : "secondary"
                  }
                >
                  {p.label}:{" "}
                  {cloudUnavailable
                    ? cloudAIStatusLabel
                    : p.configured
                      ? `Configured (${p.defaultModel})`
                      : "Not configured"}
                </Badge>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="AI Privacy Mode"
              hint={AI_PRIVACY_MODE_DESCRIPTIONS[aiPrivacyMode]}
            >
              <Select
                selectSize="lg"
                value={aiPrivacyMode}
                onChange={(e) => {
                  const next = e.target.value as AiPrivacyMode;
                  setAiPrivacyMode(next);
                  if (next === "local_only") {
                    setAiCloudDocumentConsent(false);
                  }
                }}
              >
                {AI_PRIVACY_MODES.map((m) => {
                  const cloudModeUnavailable =
                    m === "cloud_allowed" && !cloudAISupported;
                  return (
                    <option key={m} value={m} disabled={cloudModeUnavailable}>
                      {AI_PRIVACY_MODE_LABELS[m]}
                      {cloudModeUnavailable ? ` — ${cloudAIStatusLabel}` : ""}
                    </option>
                  );
                })}
              </Select>
            </FormField>

            <FormField label="Preferred Provider">
              <Select
                selectSize="lg"
                value={aiPreferredProvider}
                onChange={(e) =>
                  setAiPreferredProvider(e.target.value as AiPreferredProvider)
                }
              >
                {AI_PREFERRED_PROVIDERS.map((p) => {
                  const cloudProviderUnavailable =
                    p !== "auto" && p !== "ollama" && !cloudAISupported;
                  return (
                    <option key={p} value={p} disabled={cloudProviderUnavailable}>
                      {AI_PROVIDER_LABELS[p]}
                      {cloudProviderUnavailable
                        ? ` — ${cloudAIStatusLabel}`
                        : ""}
                    </option>
                  );
                })}
              </Select>
            </FormField>

            <FormField
              label="Local AI Endpoint (Ollama)"
              hint="Must target a valid loopback URL (e.g. http://127.0.0.1:11434)."
            >
              <Input
                inputSize="lg"
                value={aiOllamaEndpoint}
                onChange={(e) => setAiOllamaEndpoint(e.target.value)}
                placeholder={DEFAULT_OLLAMA_ENDPOINT}
              />
            </FormField>

            <FormField
              label="Local Model Override (Optional)"
              hint="Leave empty to use server default local model."
            >
              <Input
                inputSize="lg"
                value={aiOllamaModel}
                onChange={(e) => setAiOllamaModel(e.target.value)}
                placeholder="qwen2.5:7b"
              />
            </FormField>
          </div>

          {cloudAISupported && aiPrivacyMode !== "local_only" && (
            <label className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-subtle p-3 text-foreground">
              <input
                type="checkbox"
                checked={aiCloudDocumentConsent}
                onChange={(e) => setAiCloudDocumentConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I explicitly consent to sending selected career documents to
                configured Cloud AI providers when running Cloud AI tasks.
              </span>
            </label>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending}
            >
              Save AI Privacy Settings
            </Button>
          </div>
        </form>
      </Card>

      {/* 6. Sample Demonstration Data */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-warning" />
          <h2 className="text-section-title text-foreground">
            6. Sample Demonstration Records
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
            7. Data Portability & Account Deletion (Privacy / UU PDP)
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
