/**
 * Follow-up scheduling and "No Response" suggestion logic.
 *
 * IMPORTANT:
 * - Follow-up emails are never sent automatically.
 * - "No Response" is only a suggestion after `noResponseDays` of silence;
 *   it never automatically classifies an application as Rejected or No Response.
 */

import { addBusinessDays, daysBetween } from "./business-days";
import type { Outcome, StageType } from "./stages";

export interface FollowUpSettings {
  followUpFirstDays: number;
  followUpSecondDays: number;
  followUpFinalDays: number;
  noResponseDays: number;
  holidays: readonly string[];
}

export const DEFAULT_FOLLOW_UP_SETTINGS: FollowUpSettings = {
  followUpFirstDays: 5,
  followUpSecondDays: 5,
  followUpFinalDays: 10,
  noResponseDays: 30,
  holidays: [],
};

/** Compute the due date (YYYY-MM-DD) for the first follow-up after submission. */
export function initialFollowUpDueOn(
  submittedOn: string,
  settings: Pick<FollowUpSettings, "followUpFirstDays" | "holidays"> = DEFAULT_FOLLOW_UP_SETTINGS,
): string {
  return addBusinessDays(submittedOn, settings.followUpFirstDays, settings.holidays);
}

/**
 * Given the completed sequence number (1 or 2), compute the next follow-up
 * due date from `completedOn` (YYYY-MM-DD), or null if the sequence is finished.
 */
export function nextFollowUpInSequence(
  completedSequenceNo: number,
  completedOn: string,
  settings: FollowUpSettings = DEFAULT_FOLLOW_UP_SETTINGS,
): { sequenceNo: number; dueOn: string; title: string } | null {
  if (completedSequenceNo === 1 && settings.followUpSecondDays > 0) {
    return {
      sequenceNo: 2,
      dueOn: addBusinessDays(completedOn, settings.followUpSecondDays, settings.holidays),
      title: "Second follow-up with recruiter",
    };
  }
  if (completedSequenceNo === 2 && settings.followUpFinalDays > 0) {
    return {
      sequenceNo: 3,
      dueOn: addBusinessDays(completedOn, settings.followUpFinalDays, settings.holidays),
      title: "Final follow-up check-in",
    };
  }
  return null;
}

export function isFollowUpOverdue(dueOn: string, today: string): boolean {
  return daysBetween(dueOn, today) > 0;
}

export interface NoResponseCheckInput {
  outcome: Outcome;
  currentStageType: StageType;
  submittedOn: string;
  lastActivityOn: string; // YYYY-MM-DD of latest stage move or communication
}

export interface NoResponseSuggestion {
  shouldSuggest: boolean;
  silentDays: number;
  reason: string | null;
}

/**
 * Evaluate whether an active application has gone silent past `noResponseDays`
 * and should show a non-destructive suggestion to mark as "No Response".
 */
export function evaluateNoResponseSuggestion(
  app: NoResponseCheckInput,
  today: string,
  noResponseDays: number = DEFAULT_FOLLOW_UP_SETTINGS.noResponseDays,
): NoResponseSuggestion {
  if (app.outcome !== "active") {
    return { shouldSuggest: false, silentDays: 0, reason: null };
  }
  const anchor = app.lastActivityOn > app.submittedOn ? app.lastActivityOn : app.submittedOn;
  const silentDays = Math.max(0, daysBetween(anchor, today));
  if (silentDays < noResponseDays) {
    return { shouldSuggest: false, silentDays, reason: null };
  }
  return {
    shouldSuggest: true,
    silentDays,
    reason: `No employer activity recorded for ${silentDays} days (threshold: ${noResponseDays} days). Confirm if you want to mark this application as No Response.`,
  };
}
