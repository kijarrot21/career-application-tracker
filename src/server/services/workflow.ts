import type { ProgressSnapshot } from "@/lib/domain/progress";
import { evaluateWorkflow, type WorkflowPlan } from "@/lib/domain/workflow";
import { requireUser } from "@/lib/session";
import { detectProgress } from "./progress";

/**
 * Interpret an already calculated progress snapshot. Kept separate from data
 * retrieval so the rule engine stays pure and reusable in tests.
 */
export function evaluateWorkflowPlan(
  progress: ProgressSnapshot,
  evaluatedAt: string = new Date().toISOString(),
): WorkflowPlan {
  return evaluateWorkflow(progress, evaluatedAt);
}

/** Recalculate Stage 1 progress, then apply the advisory workflow rules. */
export async function getWorkflowPlan(userId: string): Promise<WorkflowPlan> {
  return evaluateWorkflowPlan(await detectProgress(userId));
}

/** Convenience wrapper for server pages and actions. */
export async function getWorkflowPlanForCurrentUser(): Promise<WorkflowPlan> {
  const user = await requireUser();
  return getWorkflowPlan(user.id);
}
