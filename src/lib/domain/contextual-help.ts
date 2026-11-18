/**
 * Contextual help module registry.
 *
 * Only modules that exist in the application are listed. Text lives in the
 * existing i18n catalogs; this registry maps a page to its workflow stage and
 * verified next-action route.
 */

import type { WorkflowStageKey } from "./progress";

export const HELP_MODULE_KEYS = [
  "careerProfile",
  "cvStudio",
  "documents",
  "jobDiscovery",
  "shortlist",
  "applications",
  "interviews",
  "archive",
] as const;
export type HelpModuleKey = (typeof HELP_MODULE_KEYS)[number];

export interface HelpModuleDefinition {
  key: HelpModuleKey;
  stage: WorkflowStageKey;
  /** Route for the module itself; always an existing route. */
  route: string;
  /** Route for the recommended next action. */
  nextRoute: string;
}

export const HELP_MODULES: readonly HelpModuleDefinition[] = [
  {
    key: "careerProfile",
    stage: "career_profile",
    route: "/profile",
    nextRoute: "/documents",
  },
  {
    key: "cvStudio",
    stage: "cv_upload",
    route: "/cv-studio",
    nextRoute: "/documents",
  },
  {
    key: "documents",
    stage: "cv_upload",
    route: "/documents",
    nextRoute: "/jobs/new",
  },
  {
    key: "jobDiscovery",
    stage: "job_discovery",
    route: "/jobs",
    nextRoute: "/jobs/new",
  },
  {
    key: "shortlist",
    stage: "shortlist",
    route: "/shortlist",
    nextRoute: "/applications",
  },
  {
    key: "applications",
    stage: "job_application",
    route: "/applications",
    nextRoute: "/interviews",
  },
  {
    key: "interviews",
    stage: "recruitment_tracking",
    route: "/interviews",
    nextRoute: "/applications",
  },
  {
    key: "archive",
    stage: "offers_outcomes",
    route: "/archive",
    nextRoute: "/dashboard",
  },
];

export function findHelpModule(
  key: HelpModuleKey,
): HelpModuleDefinition | undefined {
  return HELP_MODULES.find((module) => module.key === key);
}
