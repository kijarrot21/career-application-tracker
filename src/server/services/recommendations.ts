import {
  computeNextBestActions,
  type NextBestActionOptions,
  type NextBestActionResult,
  type RecommendationFacts,
} from "@/lib/domain/recommendations";
import type { WorkflowPlan } from "@/lib/domain/workflow";
import { requireUser } from "@/lib/session";
import { getRecommendationFacts } from "@/server/queries/recommendations";
import { getWorkflowPlan } from "./workflow";

/** Pure composition of an already calculated Stage 2 plan and facts. */
export function buildNextBestActions(
  plan: WorkflowPlan,
  facts: RecommendationFacts,
  options?: NextBestActionOptions,
): NextBestActionResult {
  return computeNextBestActions(plan, facts, options);
}

/**
 * Recalculate progress, workflow state, and time-sensitive facts on every call.
 * Both reads are user-scoped and run in parallel.
 */
export async function getNextBestActions(
  userId: string,
  options?: NextBestActionOptions,
): Promise<NextBestActionResult> {
  const [plan, facts] = await Promise.all([
    getWorkflowPlan(userId),
    getRecommendationFacts(userId),
  ]);
  return buildNextBestActions(plan, facts, options);
}

/** Convenience wrapper for server pages and actions. */
export async function getNextBestActionsForCurrentUser(): Promise<NextBestActionResult> {
  const user = await requireUser();
  return getNextBestActions(user.id);
}
