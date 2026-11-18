import type {
  JobPriority,
  SalaryPeriod,
  SearchStatus,
  TriageStatus,
} from "@/lib/constants";
import type { ArchiveOutcome } from "@/lib/domain/archive";
import type { HelpModuleKey } from "@/lib/domain/contextual-help";
import type {
  OnboardingMode,
  TutorialSection,
} from "@/lib/domain/onboarding";
import type { ProductTourStepId } from "@/lib/domain/product-tour";
import type { WorkflowStageKey } from "@/lib/domain/progress";
import type { Outcome, StageType } from "@/lib/domain/stages";

export const SUPPORTED_LOCALES = ["id-ID", "en-US"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "id-ID";
export const DEFAULT_TIMEZONE = "Asia/Jakarta";
export const DEFAULT_CURRENCY = "IDR";
export const LOCALE_COOKIE_NAME = "app_locale";

export interface MarketConfig {
  locale: AppLocale;
  htmlLang: string;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  aiLocale: "id" | "en";
  defaultCurrency: string;
  defaultTimezone: string;
  defaultCvFormat: "indonesian_cv" | "international_resume";
}

export interface CurrencyDefinition {
  code: string;
  symbol: string;
  nameId: string;
  nameEn: string;
  minorUnits: number;
  defaultFormattingLocale: AppLocale;
  isDefaultSettlement?: boolean;
}

export interface TranslationMessages {
  meta: {
    localeName: string;
    languageCode: AppLocale;
  };
  nav: {
    pipelineGroup: string;
    assetsGroup: string;
    dashboard: string;
    applications: string;
    archive: string;
    interviews: string;
    analytics: string;
    careerProfile: string;
    cvStudio: string;
    jobs: string;
    shortlist: string;
    documents: string;
    emails: string;
    credits: string;
    sync: string;
    settings: string;
    collapseSidebar: string;
    expandSidebar: string;
    signOut: string;
    searchPlaceholder: string;
    searchShort: string;
  };
  common: {
    save: string;
    saving: string;
    cancel: string;
    loading: string;
    notSet: string;
    notSpecified: string;
    undisclosed: string;
    from: string;
    upTo: string;
    to: string;
    language: string;
    timezone: string;
    currency: string;
    indicativeDisplayNote: string;
  };
  statuses: {
    outcome: Record<Outcome, string>;
    stageType: Record<StageType, string>;
    archiveOutcome: Record<ArchiveOutcome, string>;
    triage: Record<TriageStatus, string>;
    priority: Record<JobPriority, string>;
    workArrangement: Record<"onsite" | "hybrid" | "remote", string>;
    searchStatus: Record<SearchStatus, string>;
    salaryPeriod: Record<SalaryPeriod, string>;
  };
  settings: {
    pageTitle: string;
    pageDescription: string;
    workspaceSectionTitle: string;
    workspaceSectionDescription: string;
    preferredLanguageLabel: string;
    preferredLanguageHint: string;
    timezoneLabel: string;
    currencyLabel: string;
    currencyHint: string;
    searchStatusLabel: string;
    saveWorkspaceButton: string;
    workspaceSavedToast: string;
    languageSwitchedToast: string;
  };
  help: {
    button: string;
    dialogTitle: string;
    purposeLabel: string;
    fieldsLabel: string;
    outcomeLabel: string;
    stageLabel: string;
    nextLabel: string;
    close: string;
    modules: Record<
      HelpModuleKey,
      {
        title: string;
        purpose: string;
        fields: string;
        outcome: string;
        stage: string;
        next: string;
      }
    >;
  };
  onboardingSettings: {
    sectionTitle: string;
    sectionDescription: string;
    statusTitle: string;
    progressTitle: string;
    modeLabel: string;
    guidedStartedLabel: string;
    positionLabel: string;
    completedSectionsLabel: string;
    skippedSectionsLabel: string;
    tourActiveLabel: string;
    dismissedRemindersLabel: string;
    yes: string;
    no: string;
    none: string;
    resumeGuidedButton: string;
    restartGuidedButton: string;
    restartTourButton: string;
    dismissRemindersButton: string;
    resumeToast: string;
    restartGuidedToast: string;
    restartTourToast: string;
    dismissToast: string;
    labels: {
      mode: Record<OnboardingMode, string>;
      section: Record<TutorialSection, string>;
      tourStep: Record<ProductTourStepId, string>;
      stage: Record<WorkflowStageKey, string>;
    };
  };
  cv: {
    indonesianTemplateLabel: string;
    internationalTemplateLabel: string;
    sections: {
      summary: string;
      experience: string;
      projects: string;
      skills: string;
      education: string;
      certifications: string;
      languages: string;
      coverLetter: string;
      technologiesPrefix: string;
    };
  };
  errors: {
    UNAUTHORIZED: string;
    FORBIDDEN: string;
    INVALID_WEBHOOK_SIGNATURE: string;
    NOT_FOUND: string;
    INVALID_ID: string;
    INVALID_JSON: string;
    VALIDATION_ERROR: string;
    UNSUPPORTED_MEDIA_TYPE: string;
    CONFLICT: string;
    UNPROCESSABLE_ENTITY: string;
    INSUFFICIENT_CREDITS: string;
    RATE_LIMIT_EXCEEDED: string;
    PRIVACY_MODE_BLOCKED: string;
    CONSENT_REQUIRED: string;
    SYNC_FORBIDDEN_ENTITY: string;
    SYNC_CLOUD_DISABLED: string;
    SYNC_LOCAL_ONLY_MODE: string;
    ARCHIVE_SNAPSHOT_IMMUTABLE: string;
    DOCUMENT_VERSION_IMMUTABLE: string;
    INTERNAL_ERROR: string;
    UNKNOWN_ERROR: string;
  };
}
