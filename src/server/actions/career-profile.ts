"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  type applyCvImportReviewSchema,
  applyCvImportReviewService,
  type careerCertificationSchema,
  type careerEducationSchema,
  type careerExperienceSchema,
  type careerProfileSchema,
  type careerProjectSchema,
  type careerSkillSchema,
  deleteCareerCertificationService,
  deleteCareerEducationService,
  deleteCareerExperienceService,
  deleteCareerProjectService,
  deleteCareerSkillService,
  discardCvImportReviewService,
  saveCareerCertificationService,
  saveCareerEducationService,
  saveCareerExperienceService,
  saveCareerProjectService,
  saveCareerSkillService,
  type stageCvImportSchema,
  stageCvImportReviewService,
  upsertCareerProfileService,
} from "@/server/services/career-profile";

function revalidateProfilePaths() {
  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

export async function upsertCareerProfileAction(
  input: z.infer<typeof careerProfileSchema>,
) {
  const user = await requireUser();
  const updated = await upsertCareerProfileService(user.id, input);
  revalidateProfilePaths();
  return updated;
}

export async function saveCareerExperienceAction(
  input: z.infer<typeof careerExperienceSchema>,
) {
  const user = await requireUser();
  const saved = await saveCareerExperienceService(user.id, input);
  revalidateProfilePaths();
  return saved;
}

export async function deleteCareerExperienceAction(experienceId: string) {
  const user = await requireUser();
  await deleteCareerExperienceService(user.id, experienceId);
  revalidateProfilePaths();
  return { ok: true };
}

export async function saveCareerEducationAction(
  input: z.infer<typeof careerEducationSchema>,
) {
  const user = await requireUser();
  const saved = await saveCareerEducationService(user.id, input);
  revalidateProfilePaths();
  return saved;
}

export async function deleteCareerEducationAction(educationId: string) {
  const user = await requireUser();
  await deleteCareerEducationService(user.id, educationId);
  revalidateProfilePaths();
  return { ok: true };
}

export async function saveCareerSkillAction(
  input: z.infer<typeof careerSkillSchema>,
) {
  const user = await requireUser();
  const saved = await saveCareerSkillService(user.id, input);
  revalidateProfilePaths();
  return saved;
}

export async function deleteCareerSkillAction(skillId: string) {
  const user = await requireUser();
  await deleteCareerSkillService(user.id, skillId);
  revalidateProfilePaths();
  return { ok: true };
}

export async function saveCareerCertificationAction(
  input: z.infer<typeof careerCertificationSchema>,
) {
  const user = await requireUser();
  const saved = await saveCareerCertificationService(user.id, input);
  revalidateProfilePaths();
  return saved;
}

export async function deleteCareerCertificationAction(certificationId: string) {
  const user = await requireUser();
  await deleteCareerCertificationService(user.id, certificationId);
  revalidateProfilePaths();
  return { ok: true };
}

export async function saveCareerProjectAction(
  input: z.input<typeof careerProjectSchema>,
) {
  const user = await requireUser();
  const saved = await saveCareerProjectService(user.id, input);
  revalidateProfilePaths();
  return saved;
}

export async function deleteCareerProjectAction(projectId: string) {
  const user = await requireUser();
  await deleteCareerProjectService(user.id, projectId);
  revalidateProfilePaths();
  return { ok: true };
}

export async function stageCvImportReviewAction(
  input: z.infer<typeof stageCvImportSchema>,
) {
  const user = await requireUser();
  const updated = await stageCvImportReviewService(user.id, input);
  revalidateProfilePaths();
  return updated;
}

export async function applyCvImportReviewAction(
  input: z.input<typeof applyCvImportReviewSchema>,
) {
  const user = await requireUser();
  const res = await applyCvImportReviewService(user.id, input);
  revalidateProfilePaths();
  return res;
}

export async function discardCvImportReviewAction() {
  const user = await requireUser();
  const res = await discardCvImportReviewService(user.id);
  revalidateProfilePaths();
  return res;
}
