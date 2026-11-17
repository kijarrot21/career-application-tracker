import { and, eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import { aiPromptVersions } from "@/db/schema";
import type { AiLocale, AiTaskType } from "@/lib/domain/ai";
import { canonicalSha256 } from "../security/prompt-guard";
import { EN_PROMPT_TEMPLATES, type PromptTemplateDefinition } from "./en";
import { ID_PROMPT_TEMPLATES } from "./id";

export interface ResolvedPromptTemplate extends PromptTemplateDefinition {
  templateHash: string;
  tag: string;
}

export function getPromptTemplate(
  taskType: AiTaskType,
  locale: AiLocale = "en",
): ResolvedPromptTemplate {
  const table = locale === "id" ? ID_PROMPT_TEMPLATES : EN_PROMPT_TEMPLATES;
  const tpl = table[taskType];
  const templateHash = canonicalSha256({
    taskType: tpl.taskType,
    locale: tpl.locale,
    version: tpl.version,
    systemPrompt: tpl.systemPrompt,
    outputContractHint: tpl.outputContractHint,
  });
  return {
    ...tpl,
    templateHash,
    tag: `${tpl.taskType}:${tpl.locale}:v${tpl.version}`,
  };
}

/**
 * Ensures the resolved prompt version is recorded in `ai_prompt_versions`
 * so every AI job and analysis has a persistent foreign key reference.
 */
export async function ensurePromptVersionRecorded(
  dbOrTx: Pick<AppDb, "select" | "insert" | "update">,
  taskType: AiTaskType,
  locale: AiLocale = "en",
): Promise<{
  promptVersionId: string;
  resolved: ResolvedPromptTemplate;
}> {
  const resolved = getPromptTemplate(taskType, locale);

  const [existing] = await dbOrTx
    .select()
    .from(aiPromptVersions)
    .where(
      and(
        eq(aiPromptVersions.taskType, taskType),
        eq(aiPromptVersions.locale, locale),
        eq(aiPromptVersions.version, resolved.version),
      ),
    );

  if (existing) {
    return { promptVersionId: existing.id, resolved };
  }

  await dbOrTx
    .insert(aiPromptVersions)
    .values({
      taskType,
      locale,
      version: resolved.version,
      templateHash: resolved.templateHash,
      description: resolved.description,
      isActive: true,
    })
    .onConflictDoNothing();

  const [created] = await dbOrTx
    .select()
    .from(aiPromptVersions)
    .where(
      and(
        eq(aiPromptVersions.taskType, taskType),
        eq(aiPromptVersions.locale, locale),
        eq(aiPromptVersions.version, resolved.version),
      ),
    );

  return { promptVersionId: created.id, resolved };
}
