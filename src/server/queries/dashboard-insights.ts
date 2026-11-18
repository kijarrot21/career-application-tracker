import { buildNextBestActions } from "@/server/services/recommendations";
import { getRecommendationFacts } from "@/server/queries/recommendations";
import { getOnboardingPreferencesService } from "@/server/services/onboarding";
import { getWorkflowPlan } from "@/server/services/workflow";

/**
 * Single server-side composition for the dashboard guidance widgets.
 * Business rules stay in the Stage 1-4 services; this query only fetches
 * their results once per request.
 */
export async function getDashboardInsights(userId: string) {
  const [plan, facts, onboarding] = await Promise.all([
    getWorkflowPlan(userId),
    getRecommendationFacts(userId),
    getOnboardingPreferencesService(userId),
  ]);

  return {
    progress: plan.progress,
    workflow: {
      recommendedNextStages: plan.recommendedNextStages,
      blockedActions: plan.blockedActions,
      availableActionIds: plan.availableActions.map((action) => action.id),
    },
    actions: buildNextBestActions(plan, facts),
    onboarding,
  };
}
