"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import type { z } from "zod";
import { getAuth } from "@/lib/auth";
import type { SearchStatus } from "@/lib/constants";
import type { Weights } from "@/lib/domain/suitability";
import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { searchGlobal } from "@/server/queries/dashboard";
import {
  type aiPrivacySettingsSchema,
  type customStageSchema,
  deleteUserAccountService,
  type followUpSettingsSchema,
  loadSampleDataService,
  type profileSettingsSchema,
  removeSampleDataService,
  reorderStagesService,
  saveStageService,
  toggleStageHiddenService,
  updateAiPrivacySettingsService,
  updateFollowUpSettingsService,
  updatePreferredLocaleService,
  updateProfileSettingsService,
  updateSearchStatusService,
  updateSuitabilityWeightsService,
  updateWorkspaceSettingsService,
  type workspaceSettingsSchema,
} from "@/server/services/settings";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/shortlist");
  revalidatePath("/applications");
  revalidatePath("/settings");
  revalidatePath("/cv-studio");
  revalidatePath("/credits");
  revalidatePath("/sync");
  revalidatePath("/analytics");
}

async function persistLocaleCookie(locale: string) {
  const store = await cookies();
  store.set(LOCALE_COOKIE_NAME, normalizeLocale(locale), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function updateWorkspaceSettingsAction(
  input: z.input<typeof workspaceSettingsSchema>,
) {
  const user = await requireUser();
  const updated = await updateWorkspaceSettingsService(user.id, input);
  await persistLocaleCookie(updated.preferredLocale);
  revalidateAll();
  return updated;
}

export async function updatePreferredLocaleAction(locale: string) {
  const user = await requireUser();
  const updated = await updatePreferredLocaleService(user.id, locale);
  await persistLocaleCookie(updated.preferredLocale);
  revalidateAll();
  return updated;
}

export async function updateAiPrivacySettingsAction(
  input: z.input<typeof aiPrivacySettingsSchema>,
) {
  const user = await requireUser();
  const updated = await updateAiPrivacySettingsService(user.id, input);
  revalidateAll();
  return updated;
}

export async function updateProfileSettingsAction(
  input: z.infer<typeof profileSettingsSchema>,
) {
  const user = await requireUser();
  const updated = await updateProfileSettingsService(user.id, input);
  revalidateAll();
  return updated;
}

export async function updateSearchStatusAction(searchStatus: SearchStatus) {
  const user = await requireUser();
  const updated = await updateSearchStatusService(user.id, searchStatus);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return updated;
}

export async function updateFollowUpSettingsAction(
  input: z.infer<typeof followUpSettingsSchema>,
) {
  const user = await requireUser();
  const updated = await updateFollowUpSettingsService(user.id, input);
  revalidateAll();
  return updated;
}

export async function updateSuitabilityWeightsAction(weights: Weights) {
  const user = await requireUser();
  const updated = await updateSuitabilityWeightsService(user.id, weights);
  revalidateAll();
  return updated;
}

export async function saveStageAction(input: z.infer<typeof customStageSchema>) {
  const user = await requireUser();
  const stage = await saveStageService(user.id, input);
  revalidateAll();
  return stage;
}

export async function reorderStagesAction(orderedStageIds: string[]) {
  const user = await requireUser();
  await reorderStagesService(user.id, orderedStageIds);
  revalidateAll();
  return { ok: true };
}

export async function toggleStageHiddenAction(stageId: string, isHidden: boolean) {
  const user = await requireUser();
  await toggleStageHiddenService(user.id, stageId, isHidden);
  revalidateAll();
  return { ok: true };
}

export async function loadSampleDataAction() {
  const user = await requireUser();
  await loadSampleDataService(user.id);
  revalidateAll();
  return { ok: true };
}

export async function removeSampleDataAction() {
  const user = await requireUser();
  await removeSampleDataService(user.id);
  revalidateAll();
  return { ok: true };
}

export async function deleteAccountWithPasswordAction(password: string) {
  const user = await requireUser();
  // Verify password via Better Auth sign-in check before irreversible account deletion
  const hdrs = await headers();
  const verified = await getAuth().api
    .signInEmail({
      body: { email: user.email, password },
      headers: hdrs,
    })
    .catch(() => null);

  if (!verified?.user || verified.user.id !== user.id) {
    throw new Error("Incorrect password. Account deletion was cancelled.");
  }

  await deleteUserAccountService(user.id);
  return { ok: true };
}

export async function globalSearchAction(query: string) {
  const user = await requireUser();
  return searchGlobal(user.id, query);
}
