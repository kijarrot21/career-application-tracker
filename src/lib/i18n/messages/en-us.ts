import type { TranslationMessages } from "../types";

export const EN_US_MESSAGES: TranslationMessages = {
  meta: {
    localeName: "English (en-US)",
    languageCode: "en-US",
  },
  nav: {
    pipelineGroup: "Pipeline & Analytics",
    assetsGroup: "Discovery & Assets",
    dashboard: "Dashboard",
    applications: "Applications",
    archive: "Archive",
    interviews: "Interviews",
    analytics: "Analytics",
    careerProfile: "Career Profile",
    cvStudio: "CV Studio AI",
    jobs: "Find Jobs",
    shortlist: "Job Shortlist",
    documents: "Documents",
    emails: "Email Center",
    credits: "Credit Wallet",
    sync: "Hybrid Sync",
    settings: "Settings",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    signOut: "Sign out",
    searchPlaceholder: "Search jobs, applications, companies, or tags...",
    searchShort: "Search...",
  },
  common: {
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    loading: "Loading...",
    notSet: "Not set",
    notSpecified: "Not specified",
    undisclosed: "Undisclosed",
    from: "From",
    upTo: "Up to",
    to: "to",
    language: "Language",
    timezone: "Timezone",
    currency: "Currency",
    indicativeDisplayNote:
      "Display estimate only (not a financial settlement rate).",
  },
  statuses: {
    outcome: {
      active: "Active",
      successful: "Successful",
      unsuccessful: "Unsuccessful",
      withdrawn: "Withdrawn",
      no_response: "No Response",
      closed: "Closed",
    },
    stageType: {
      sourced: "Sourced",
      interested: "Interested",
      applied: "Applied",
      screening: "CV Screening",
      interview: "Interview",
      assessment: "Assessment",
      offer: "Offer",
      hired: "Hired",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
      no_response: "No Response",
    },
    archiveOutcome: {
      rejected: "Rejected",
      withdrawn: "Withdrawn",
      hired: "Hired",
      no_response: "No Response",
      closed: "Closed",
    },
    triage: {
      new: "New",
      interested: "Interested",
      shortlisted: "Shortlisted",
      not_interested: "Not Interested",
      archived: "Archived",
    },
    priority: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    workArrangement: {
      onsite: "On-site",
      hybrid: "Hybrid",
      remote: "Remote",
    },
    searchStatus: {
      actively_searching: "Actively searching",
      open_to_offers: "Open to offers",
      paused: "Search paused",
      hired: "Hired / Not searching",
    },
    salaryPeriod: {
      month: "/mo",
      year: "/yr",
      hour: "/hr",
      project: "/project",
    },
  },
  settings: {
    pageTitle: "Settings, Pipeline Customization & Data Privacy",
    pageDescription:
      "Configure workspace locale, recruitment stages, follow-up rules, suitability weights, and privacy controls.",
    workspaceSectionTitle: "1. Workspace Locale & Search Status",
    workspaceSectionDescription:
      "Configure your preferred language, timezone, display currency, and current job search availability.",
    preferredLanguageLabel: "Preferred Language",
    preferredLanguageHint:
      "Controls UI labels, localized date/number formatting, and default AI prompt language.",
    timezoneLabel: "Timezone",
    currencyLabel: "Default Display Currency",
    currencyHint:
      "Display currency does not alter server-verified payment settlement currencies.",
    searchStatusLabel: "Job Search Status",
    saveWorkspaceButton: "Save Workspace Settings",
    workspaceSavedToast: "Workspace settings updated.",
    languageSwitchedToast: "Language switched to English (en-US).",
  },
  help: {
    button: "Module guide",
    dialogTitle: "How this module works",
    purposeLabel: "Purpose",
    fieldsLabel: "Important fields and actions",
    outcomeLabel: "Expected outcome",
    stageLabel: "Related workflow stage",
    nextLabel: "Suggested next action",
    close: "Close guide",
    modules: {
      careerProfile: {
        title: "Career Profile",
        purpose:
          "Keep one verified source of professional truth for suitability scoring and grounded AI tools.",
        fields:
          "Use professional details, work experience, education, skills, certifications, and projects. Only user-verified skills count toward readiness.",
        outcome:
          "The profile passes the existing isReadyForAi rule: professional info, one experience, and three verified skills.",
        stage: "Career Profile",
        next: "Store a master CV in Documents.",
      },
      cvStudio: {
        title: "CV Studio",
        purpose:
          "Parse an existing CV, evaluate ATS quality, review proposed edits, and export a grounded CV.",
        fields:
          "Choose file source, locale, privacy mode, and review AI suggestions before applying edits. Local AI works without cloud consent.",
        outcome:
          "A reviewed CV draft is ready for export and storage as a document version.",
        stage: "CV Upload",
        next: "Save the exported CV in Documents.",
      },
      documents: {
        title: "Document Repository",
        purpose:
          "Store versioned CVs, cover letters, certificates, and other application documents.",
        fields:
          "Select document category, title, and version label. Upload validates file type, size, and malware signatures before storing a file key.",
        outcome:
          "At least one master or customized CV has a stored file version that applications can reference.",
        stage: "CV Upload",
        next: "Discover and save a job vacancy.",
      },
      jobDiscovery: {
        title: "Job Discovery",
        purpose:
          "Capture vacancies, detect duplicates, and rank opportunities before deciding where to apply.",
        fields:
          "Add URL, company, title, salary, deadline, platform, and triage status. Suitability scores can be edited on the job detail page.",
        outcome:
          "A saved vacancy exists with enough information to evaluate compatibility.",
        stage: "Job Discovery",
        next: "Evaluate suitability for the saved vacancy.",
      },
      shortlist: {
        title: "Shortlist",
        purpose:
          "Compare interested and shortlisted vacancies by suitability score and deadlines.",
        fields:
          "Use triage status, comparison selection, score, and deadline to decide priority. Shortlisting does not create an application.",
        outcome:
          "At least one vacancy is shortlisted or marked interested.",
        stage: "Shortlist",
        next: "Record an application for a shortlisted vacancy.",
      },
      applications: {
        title: "Applications",
        purpose:
          "Track submitted applications through the customizable recruitment pipeline.",
        fields:
          "Use the Kanban board or table to move stages, record reasons, link CV versions, and log recruiter activity. Stage moves are audited.",
        outcome:
          "A real application exists with stage history and the next follow-up calculated.",
        stage: "Job Application",
        next: "Record interviews, assessments, or follow-up activity.",
      },
      interviews: {
        title: "Interviews and Assessments",
        purpose:
          "Manage interview schedules, preparation notes, feedback, and pending technical assessments.",
        fields:
          "Record interview date, type, result, and stage. Assessments track due date, completion, score, and result.",
        outcome:
          "Real tracking activity is attached to an application.",
        stage: "Recruitment Tracking",
        next: "Open Applications, select the application, then capture the offer or final outcome.",
      },
      archive: {
        title: "Archive",
        purpose:
          "Inspect closed applications, immutable snapshots, and retention state without losing history.",
        fields:
          "Use closure outcome, retained documents, retention policy, restore, and intentional re-application actions.",
        outcome:
          "A completed application has a closure record and preserved snapshot.",
        stage: "Offers and Outcomes",
        next: "Review dashboard recommendations for remaining work.",
      },
    },
  },
  onboardingSettings: {
    sectionTitle: "Onboarding & Guidance",
    sectionDescription:
      "Manage guided setup and product tour preferences. These never change application records.",
    statusTitle: "Onboarding status",
    progressTitle: "Actual workflow progress",
    modeLabel: "Mode",
    guidedStartedLabel: "Guided setup started",
    positionLabel: "Current tutorial position",
    completedSectionsLabel: "Completed tutorial sections",
    skippedSectionsLabel: "Skipped tutorial sections",
    tourActiveLabel: "Product tour active step",
    dismissedRemindersLabel: "Dismissed reminders",
    yes: "Yes",
    no: "No",
    none: "None",
    resumeGuidedButton: "Resume Guided Setup",
    restartGuidedButton: "Restart Guided Setup",
    restartTourButton: "Restart Product Tour",
    dismissRemindersButton: "Dismiss Onboarding Reminders",
    resumeToast: "Guided setup is ready to resume.",
    restartGuidedToast: "Guided setup restarted. Records were not changed.",
    restartTourToast: "Product tour restarted and opened.",
    dismissToast: "Onboarding reminders dismissed. Recommendations stay active.",
    labels: {
      mode: { guided: "Guided", self_paced: "Self-paced" },
      section: {
        career_profile: "Career Profile",
        cv_upload: "CV Upload",
        job_discovery: "Job Discovery",
        suitability_evaluation: "Suitability Evaluation",
        shortlist: "Shortlist",
        job_application: "Job Application",
        recruitment_tracking: "Recruitment Tracking",
        offers_outcomes: "Offers and Outcomes",
      },
      tourStep: {
        navigation: "Workspace navigation",
        global_search: "Global search",
        getting_started: "Getting Started",
        next_best_action: "Next Best Action",
        add_vacancy: "Add vacancy",
      },
      stage: {
        career_profile: "Career Profile",
        cv_upload: "CV Upload",
        job_discovery: "Job Discovery",
        suitability_evaluation: "Suitability Evaluation",
        shortlist: "Shortlist",
        job_application: "Job Application",
        recruitment_tracking: "Recruitment Tracking",
        offers_outcomes: "Offers and Outcomes",
      },
    },
  },
  cv: {
    indonesianTemplateLabel: "Indonesian CV (Structured ATS Format)",
    internationalTemplateLabel: "International Resume (US/Global Format)",
    sections: {
      summary: "PROFESSIONAL SUMMARY",
      experience: "WORK EXPERIENCE",
      projects: "KEY PROJECTS",
      skills: "SKILLS",
      education: "EDUCATION",
      certifications: "CERTIFICATIONS",
      languages: "LANGUAGES",
      coverLetter: "COVER LETTER DRAFT",
      technologiesPrefix: "Technologies",
    },
  },
  errors: {
    UNAUTHORIZED: "Authentication required. Please sign in.",
    FORBIDDEN: "You do not have permission to access this resource.",
    INVALID_WEBHOOK_SIGNATURE: "Invalid payment webhook signature.",
    NOT_FOUND: "The requested record was not found.",
    INVALID_ID: "Invalid ID format; expected UUID.",
    INVALID_JSON: "Request body must be valid JSON.",
    VALIDATION_ERROR: "Input validation failed. Please check your entries.",
    UNSUPPORTED_MEDIA_TYPE: "Unsupported file format.",
    CONFLICT: "A version or state conflict occurred.",
    UNPROCESSABLE_ENTITY:
      "Request cannot be processed due to domain constraints.",
    INSUFFICIENT_CREDITS: "Insufficient AI credit balance.",
    RATE_LIMIT_EXCEEDED: "Rate limit exceeded. Please retry shortly.",
    PRIVACY_MODE_BLOCKED:
      "Cloud AI providers are blocked by Local AI Only privacy mode.",
    CONSENT_REQUIRED:
      "Explicit user consent is required before sending documents to Cloud AI.",
    SYNC_FORBIDDEN_ENTITY:
      "Credits and payments are cloud-authoritative and cannot be synchronized from local devices.",
    SYNC_CLOUD_DISABLED:
      "Cloud synchronization is disabled pending production approval.",
    SYNC_LOCAL_ONLY_MODE: "Device is configured for local_only offline mode.",
    ARCHIVE_SNAPSHOT_IMMUTABLE:
      "Historical archive snapshots are immutable and cannot be modified.",
    DOCUMENT_VERSION_IMMUTABLE:
      "Existing document versions cannot be overwritten.",
    INTERNAL_ERROR: "An unexpected internal error occurred.",
    UNKNOWN_ERROR: "An unexpected error occurred.",
  },
};

