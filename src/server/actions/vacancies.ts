"use server";

import { revalidatePath } from "next/cache";
import type { TriageStatus } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { checkDuplicateVacancy } from "@/server/queries/vacancies";
import {
  createVacancyService,
  deleteVacancyService,
  saveSuitabilityService,
  setVacancyTriageService,
  type suitabilityInputSchema,
  updateVacancyService,
  type VacancyInput,
} from "@/server/services/vacancies";
import type { z } from "zod";

function revalidateJobPaths(vacancyId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/shortlist");
  revalidatePath("/applications");
  if (vacancyId) {
    revalidatePath(`/jobs/${vacancyId}`);
  }
}

export async function createVacancyAction(input: VacancyInput) {
  const user = await requireUser();
  const created = await createVacancyService(user.id, input);
  revalidateJobPaths(created.id);
  return created;
}

export async function updateVacancyAction(vacancyId: string, input: VacancyInput) {
  const user = await requireUser();
  const updated = await updateVacancyService(user.id, vacancyId, input);
  revalidateJobPaths(vacancyId);
  return updated;
}

export async function setVacancyTriageAction(
  vacancyId: string,
  triageStatus: TriageStatus,
) {
  const user = await requireUser();
  const updated = await setVacancyTriageService(user.id, vacancyId, triageStatus);
  revalidateJobPaths(vacancyId);
  return updated;
}

export async function saveSuitabilityAction(
  vacancyId: string,
  scores: z.infer<typeof suitabilityInputSchema>,
) {
  const user = await requireUser();
  const result = await saveSuitabilityService(user.id, vacancyId, scores);
  revalidateJobPaths(vacancyId);
  return result;
}

export async function deleteVacancyAction(vacancyId: string) {
  const user = await requireUser();
  await deleteVacancyService(user.id, vacancyId);
  revalidateJobPaths();
  return { ok: true };
}

export async function checkDuplicateVacancyAction(params: {
  url?: string | null;
  companyName?: string | null;
  title?: string | null;
  excludeId?: string;
}) {
  const user = await requireUser();
  return checkDuplicateVacancy(user.id, params);
}
