"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FilePlus2,
  FileUp,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AiConsentDialog,
  type PendingConsentPrompt,
} from "@/components/ai/ai-consent-dialog";
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import {
  AI_PRIVACY_MODE_LABELS,
  type AiLocale,
  type AiPrivacyMode,
} from "@/lib/domain/ai";
import { formatDate } from "@/lib/format";
import {
  applyApprovedCvCorrectionsAction,
  approveAndRunAiJobAction,
  cancelAiJobAction,
  evaluateCvWithAiAction,
  generateTailoredCvWithAiAction,
  parseCvWithAiAction,
  saveGeneratedCvVersionAction,
  stageAiParsedCvToProfileAction,
  suggestCvCorrectionsWithAiAction,
} from "@/server/actions/ai-career";
import {
  CV_CORRECTION_CATEGORY_LABELS,
  CV_EVALUATION_CATEGORY_LABELS,
  CV_FORMAT_LABELS,
  CV_FORMATS,
  CV_TEMPLATE_STYLE_LABELS,
  CV_TEMPLATE_STYLES,
  type AiCorrectionResult,
  type AiCvData,
  type AiCvEvaluation,
  type AiCvFormat,
  type AiCvGenerationResult,
  type AiCvTemplateStyle,
} from "@/server/ai/schemas";
import type { listAiAnalysesForUser } from "@/server/queries/ai";
import type { listCvVersionsForProfileImport } from "@/server/services/career-profile";

type StudioTab = "parser" | "evaluator" | "correction" | "generator";
type CvVersionOption = Awaited<
  ReturnType<typeof listCvVersionsForProfileImport>
>[number];
type AnalysisRow = Awaited<ReturnType<typeof listAiAnalysesForUser>>[number];

export function CvStudioClient({
  aiPrivacyMode,
  cvVersions,
  vacancies,
  recentAnalyses,
}: {
  aiPrivacyMode: AiPrivacyMode;
  cvVersions: CvVersionOption[];
  vacancies: Array<{ id: string; code: string; title: string; companyName: string }>;
  recentAnalyses: AnalysisRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<StudioTab>("parser");
  const [locale, setLocale] = useState<AiLocale>("en");
  const [pendingConsent, setPendingConsent] =
    useState<PendingConsentPrompt | null>(null);

  // Shared selectors
  const [selectedCvVersionId, setSelectedCvVersionId] = useState("");
  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [cvText, setCvText] = useState("");

  // Tab 1: Parser
  const [parseFile, setParseFile] = useState<File | null>(null);
  const [parsedResult, setParsedResult] = useState<{
    analysisId: string;
    data: AiCvData;
  } | null>(null);

  // Tab 2: Evaluator
  const [evalTargetRole, setEvalTargetRole] = useState("");
  const [evalResult, setEvalResult] = useState<{
    analysisId: string;
    data: AiCvEvaluation;
  } | null>(null);

  // Tab 3: Correction
  const [correctionResult, setCorrectionResult] = useState<{
    analysisId: string;
    data: AiCorrectionResult;
  } | null>(null);
  const [approvedIndices, setApprovedIndices] = useState<number[]>([]);
  const [appliedRevisionText, setAppliedRevisionText] = useState<string | null>(
    null,
  );

  // Tab 4: Generator
  const [genTargetRole, setGenTargetRole] = useState("");
  const [cvFormat, setCvFormat] = useState<AiCvFormat>("international_resume");
  const [templateStyle, setTemplateStyle] =
    useState<AiCvTemplateStyle>("ats_friendly");
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [genResult, setGenResult] = useState<{
    analysisId: string;
    data: AiCvGenerationResult;
  } | null>(null);

  function handleConsentPause(res: PendingConsentPrompt) {
    setPendingConsent(res);
  }

  function applyCompletedPayload(
    taskType: string,
    analysisId: string,
    data: unknown,
  ) {
    if (taskType === "cv_parse") {
      setParsedResult({ analysisId, data: data as AiCvData });
    } else if (taskType === "cv_evaluate") {
      setEvalResult({ analysisId, data: data as AiCvEvaluation });
    } else if (taskType === "cv_correction") {
      const corr = data as AiCorrectionResult;
      setCorrectionResult({ analysisId, data: corr });
      setApprovedIndices([]);
      setAppliedRevisionText(null);
    } else if (taskType === "cv_generate") {
      setGenResult({ analysisId, data: data as AiCvGenerationResult });
    }
  }

  async function handleParseSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (parseFile) {
          const form = new FormData();
          form.set("file", parseFile);
          form.set("locale", locale);
          const response = await fetch("/api/ai/cv-parse", {
            method: "POST",
            body: form,
          });
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || "Failed to parse uploaded CV file.");
          }
          if (body.status === "awaiting_consent") {
            handleConsentPause(body);
            return;
          }
          setParsedResult({
            analysisId: body.analysisId,
            data: body.data as AiCvData,
          });
          toast.success("CV file parsed. Review fields below before staging.");
          router.refresh();
          return;
        }

        const res = await parseCvWithAiAction({
          documentVersionId: selectedCvVersionId || undefined,
          cvText: cvText.trim() || undefined,
          locale,
        });
        if (res.status === "awaiting_consent") {
          handleConsentPause(res);
          return;
        }
        setParsedResult({ analysisId: res.analysisId, data: res.data });
        toast.success("CV parsed. Uncertain fields are highlighted below.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "CV parse failed");
      }
    });
  }

  function handleStageParsedCv() {
    if (!parsedResult) return;
    startTransition(async () => {
      try {
        await stageAiParsedCvToProfileAction({
          analysisId: parsedResult.analysisId,
          sourceDocumentVersionId: selectedCvVersionId || null,
        });
        toast.success(
          "Parsed CV staged into Career Profile review. Verified records were not altered.",
        );
        router.push("/profile");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to stage parsed CV",
        );
      }
    });
  }

  function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await evaluateCvWithAiAction({
          targetRole: evalTargetRole.trim() || undefined,
          documentVersionId: selectedCvVersionId || undefined,
          cvText: cvText.trim() || undefined,
          locale,
        });
        if (res.status === "awaiting_consent") {
          handleConsentPause(res);
          return;
        }
        setEvalResult({ analysisId: res.analysisId, data: res.data });
        toast.success("CV evaluation completed.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Evaluation failed");
      }
    });
  }

  function handleSuggestCorrections(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await suggestCvCorrectionsWithAiAction({
          vacancyId: selectedVacancyId || undefined,
          documentVersionId: selectedCvVersionId || undefined,
          cvText: cvText.trim() || undefined,
          locale,
        });
        if (res.status === "awaiting_consent") {
          handleConsentPause(res);
          return;
        }
        setCorrectionResult({ analysisId: res.analysisId, data: res.data });
        setApprovedIndices([]);
        setAppliedRevisionText(null);
        toast.success("Before-and-after suggestions ready for your approval.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Correction analysis failed",
        );
      }
    });
  }

  function handleApplyApprovedCorrections(saveVersion: boolean) {
    if (!correctionResult || approvedIndices.length === 0) return;
    startTransition(async () => {
      try {
        const res = await applyApprovedCvCorrectionsAction({
          analysisId: correctionResult.analysisId,
          approvedIndexes: approvedIndices,
          baseText: cvText.trim() || undefined,
          saveAsNewDocumentVersion: saveVersion,
          versionLabel: "AI Approved Correction Draft",
        });
        setAppliedRevisionText(res.revisedText);
        toast.success(
          saveVersion && res.createdVersion
            ? `Applied ${res.approvedCount} approved edit(s) as new version v${res.createdVersion.versionNo}.`
            : `Applied ${res.approvedCount} approved edit(s) to draft preview.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not apply corrections",
        );
      }
    });
  }

  function handleGenerateCv(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await generateTailoredCvWithAiAction({
          vacancyId: selectedVacancyId || undefined,
          targetRole: genTargetRole.trim() || undefined,
          cvFormat,
          templateStyle,
          includeCoverLetter,
          customInstructions: customInstructions.trim() || undefined,
          locale,
        });
        if (res.status === "awaiting_consent") {
          handleConsentPause(res);
          return;
        }
        setGenResult({ analysisId: res.analysisId, data: res.data });
        toast.success("Grounded CV generated from your verified profile.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "CV generation failed",
        );
      }
    });
  }

  function handleSaveGeneratedVersion(exportFormat: "pdf" | "docx") {
    if (!genResult) return;
    startTransition(async () => {
      try {
        const saved = await saveGeneratedCvVersionAction({
          analysisId: genResult.analysisId,
          exportFormat,
        });
        toast.success(
          `Saved new CV version v${saved.version.versionNo} (${exportFormat.toUpperCase()}) to Document Vault without altering originals.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save CV version",
        );
      }
    });
  }

  function handleApproveConsent(jobId: string) {
    startTransition(async () => {
      try {
        const res = await approveAndRunAiJobAction(jobId);
        setPendingConsent(null);
        if (res.status === "completed") {
          // Determine active tab result cleanly
          const matchedTask =
            tab === "parser"
              ? "cv_parse"
              : tab === "evaluator"
                ? "cv_evaluate"
                : tab === "correction"
                  ? "cv_correction"
                  : "cv_generate";
          applyCompletedPayload(matchedTask, res.analysisId, res.data);
          toast.success("AI task completed after your consent.");
          router.refresh();
        }
      } catch (err) {
        setPendingConsent(null);
        toast.error(
          err instanceof Error ? err.message : "Approved AI execution failed",
        );
      }
    });
  }

  function handleCancelConsent(jobId: string) {
    startTransition(async () => {
      try {
        await cancelAiJobAction(jobId);
        setPendingConsent(null);
        toast.info("AI task cancelled.");
      } catch {
        setPendingConsent(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-xs">
      <PageHeader
        title="AI CV Studio"
        description="Parse uploaded CVs, evaluate ATS & content quality, approve before-and-after wording edits, and generate grounded Indonesian or International CVs with PDF/DOCX export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Privacy: {AI_PRIVACY_MODE_LABELS[aiPrivacyMode]}
            </Badge>
            <Select
              aria-label="Output language"
              wrapperClassName="w-auto shrink-0"
              value={locale}
              onChange={(e) => setLocale(e.target.value as AiLocale)}
            >
              <option value="en">Language: English</option>
              <option value="id">Bahasa Indonesia</option>
            </Select>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as StudioTab)}>
        <TabsList>
          <TabsTrigger value="parser">1. CV Parser</TabsTrigger>
          <TabsTrigger value="evaluator">2. CV Evaluation</TabsTrigger>
          <TabsTrigger value="correction">3. CV Correction</TabsTrigger>
          <TabsTrigger value="generator">4. CV Generator &amp; Export</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Shared Document / Context Selector for Parser, Evaluator, Correction */}
      {tab !== "generator" && (
        <Card padding="md" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Existing CV Version from Document Vault (Optional)"
            hint="Supports stored PDF, DOCX, TXT, or Markdown files."
          >
            <Select
              selectSize="lg"
              value={selectedCvVersionId}
              onChange={(e) => setSelectedCvVersionId(e.target.value)}
            >
              <option value="">Use Verified Master Profile / Pasted Text</option>
              {cvVersions.map((v) => (
                <option key={v.versionId} value={v.versionId}>
                  {v.title} — v{v.versionNo} ({v.label})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Or Paste CV Text (Optional)">
            <Textarea
              rows={3}
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste CV text here if not uploading a file or choosing from Document Vault..."
            />
          </FormField>
        </Card>
      )}

      {/* TAB 1: CV PARSER */}
      {tab === "parser" && (
        <div className="space-y-4">
          <Card padding="md">
            <form onSubmit={handleParseSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-primary-text" />
                <h2 className="text-section-title text-foreground">
                  Upload or Extract Structured CV Data
                </h2>
              </div>
              <p className="text-muted-foreground">
                Supports PDF, DOCX, TXT, and Markdown. Extracted details never
                overwrite verified profile records automatically — uncertain
                fields are flagged so you can verify them first.
              </p>

              <FormField label="Upload CV File (PDF, DOCX, TXT, MD — Max 10 MB)">
                <Input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) =>
                    setParseFile(e.target.files?.[0] ?? null)
                  }
                />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="lg" disabled={isPending}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Parse CV with Hybrid AI
                </Button>
              </div>
            </form>
          </Card>

          {parsedResult && (
            <Card padding="md" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-section-title text-foreground">
                    Extracted CV Structure
                  </h3>
                  <p className="text-muted-foreground">
                    {parsedResult.data.experiences.length} experience(s),{" "}
                    {parsedResult.data.educations.length} education(s),{" "}
                    {parsedResult.data.skills.length} skill(s),{" "}
                    {parsedResult.data.projects.length} project(s)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPending}
                  onClick={handleStageParsedCv}
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Stage Into Career Profile Review
                </Button>
              </div>

              {parsedResult.data.uncertainFields.length > 0 && (
                <div className="rounded-lg border border-warning-border bg-warning-soft p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-warning-on-soft">
                    <AlertTriangle className="h-4 w-4" />
                    Uncertain Fields Requiring Verification (
                    {parsedResult.data.uncertainFields.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-warning-on-soft">
                    {parsedResult.data.uncertainFields.map((uf, i) => (
                      <li key={i}>
                        <span className="font-mono">{uf.fieldPath}</span>:{" "}
                        {uf.extractedValue ?? "(missing)"} — {uf.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-semibold text-foreground">Personal Info</p>
                  <p>{parsedResult.data.profile.fullName ?? "Not stated"}</p>
                  <p className="text-muted-foreground">
                    {parsedResult.data.profile.headline ?? "No headline"}
                  </p>
                  <p className="text-muted-foreground">
                    {parsedResult.data.profile.location ?? ""}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-semibold text-foreground">Extracted Skills</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parsedResult.data.skills.map((s, idx) => (
                      <Badge key={idx} variant="secondary">
                        {s.skillName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: CV EVALUATION */}
      {tab === "evaluator" && (
        <div className="space-y-4">
          <Card padding="md">
            <form onSubmit={handleEvaluate} className="space-y-4">
              <FormField
                label="Target Role (Optional)"
                hint="Evaluates 10 dimensions: structure, summary, experience, achievements, skills, education, certifications, keywords, readability, and ATS compatibility."
              >
                <Input
                  inputSize="lg"
                  value={evalTargetRole}
                  onChange={(e) => setEvalTargetRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="lg" disabled={isPending}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Run 10-Point CV Evaluation
                </Button>
              </div>
            </form>
          </Card>

          {evalResult && (
            <Card padding="md" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-section-title text-foreground">
                    Evaluation Score: {evalResult.data.overallScore} / 100
                  </h3>
                  <p className="text-muted-foreground">
                    {evalResult.data.scoreDisclaimer}
                  </p>
                </div>
              </div>

              <p className="text-foreground">{evalResult.data.summary}</p>

              {evalResult.data.categoryScores.length > 0 && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {evalResult.data.categoryScores.map((cat) => (
                    <div
                      key={cat.category}
                      className="rounded-lg border border-border p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {CV_EVALUATION_CATEGORY_LABELS[cat.category]}
                        </span>
                        <Badge variant="secondary">{cat.score}/100</Badge>
                      </div>
                      <p className="text-muted-foreground">{cat.feedback}</p>
                      {cat.evidence && (
                        <p className="text-[11px] text-primary-text">
                          Evidence: {cat.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-semibold text-foreground">Weaknesses</p>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    {evalResult.data.weaknesses.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-semibold text-foreground">
                    Priority Actions &amp; Recommendations
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    {evalResult.data.priorityActions.map((pa, idx) => (
                      <li key={idx}>
                        <Badge variant="secondary" className="mr-1">
                          {pa.priority}
                        </Badge>
                        {pa.recommendation}
                      </li>
                    ))}
                    {evalResult.data.recommendations.map((rec, idx) => (
                      <li key={`rec-${idx}`}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: CV CORRECTION */}
      {tab === "correction" && (
        <div className="space-y-4">
          <Card padding="md">
            <form onSubmit={handleSuggestCorrections} className="space-y-4">
              <FormField label="Align Keywords Against Job Vacancy (Optional)">
                <Select
                  selectSize="lg"
                  value={selectedVacancyId}
                  onChange={(e) => setSelectedVacancyId(e.target.value)}
                >
                  <option value="">General CV Polish (No specific vacancy)</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} · {v.companyName} — {v.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="lg" disabled={isPending}>
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate Before/After Corrections
                </Button>
              </div>
            </form>
          </Card>

          {correctionResult && (
            <Card padding="md" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-section-title text-foreground">
                    Before &amp; After Improvement Suggestions
                  </h3>
                  <p className="text-muted-foreground">
                    {correctionResult.data.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isPending || approvedIndices.length === 0}
                    onClick={() => handleApplyApprovedCorrections(false)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Preview Approved ({approvedIndices.length})
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isPending || approvedIndices.length === 0}
                    onClick={() => handleApplyApprovedCorrections(true)}
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Save Approved as New Version
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {correctionResult.data.suggestions.map((s, idx) => {
                  const checked = approvedIndices.includes(idx);
                  return (
                    <label
                      key={idx}
                      className="block cursor-pointer rounded-lg border border-border p-3 space-y-2 hover:bg-surface-subtle"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setApprovedIndices((prev) =>
                                prev.includes(idx)
                                  ? prev.filter((x) => x !== idx)
                                  : [...prev, idx],
                              )
                            }
                          />
                          <Badge variant="secondary">
                            {CV_CORRECTION_CATEGORY_LABELS[s.category]}
                          </Badge>
                          <span className="font-mono text-muted-foreground">
                            {s.section}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div className="rounded border border-border-subtle bg-surface-subtle p-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            Before
                          </p>
                          <p className="text-foreground">{s.originalText}</p>
                        </div>
                        <div className="rounded border border-success-border bg-success-soft/30 p-2">
                          <p className="text-[11px] font-semibold text-success-on-soft">
                            After (Proposed)
                          </p>
                          <p className="text-foreground">{s.suggestedText}</p>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        {s.reason} · Grounded in: {s.groundedInProfileFact}
                      </p>
                    </label>
                  );
                })}
              </div>

              {appliedRevisionText && (
                <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-1.5">
                  <p className="font-semibold text-foreground">
                    Approved Revised Draft Preview
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-foreground">
                    {appliedRevisionText}
                  </pre>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: CV GENERATOR & EXPORT */}
      {tab === "generator" && (
        <div className="space-y-4">
          <Card padding="md">
            <form onSubmit={handleGenerateCv} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Format Standard">
                  <Select
                    selectSize="lg"
                    value={cvFormat}
                    onChange={(e) => setCvFormat(e.target.value as AiCvFormat)}
                  >
                    {CV_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {CV_FORMAT_LABELS[fmt]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Template Style">
                  <Select
                    selectSize="lg"
                    value={templateStyle}
                    onChange={(e) =>
                      setTemplateStyle(e.target.value as AiCvTemplateStyle)
                    }
                  >
                    {CV_TEMPLATE_STYLES.map((tpl) => (
                      <option key={tpl} value={tpl}>
                        {CV_TEMPLATE_STYLE_LABELS[tpl]}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Target Job Vacancy (Optional)">
                  <Select
                    selectSize="lg"
                    value={selectedVacancyId}
                    onChange={(e) => setSelectedVacancyId(e.target.value)}
                  >
                    <option value="">General Role (Manual Title Below)</option>
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} · {v.companyName} — {v.title}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label="Target Role Title"
                  hint="Required if no job vacancy is selected."
                >
                  <Input
                    inputSize="lg"
                    value={genTargetRole}
                    onChange={(e) => setGenTargetRole(e.target.value)}
                    placeholder="e.g. Staff Software Engineer"
                  />
                </FormField>
              </div>

              <FormField label="Customization Notes (Optional)">
                <Textarea
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Emphasize fintech payment scalability and team mentorship..."
                />
              </FormField>

              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={includeCoverLetter}
                  onChange={(e) => setIncludeCoverLetter(e.target.checked)}
                />
                <span>Include tailored cover letter draft</span>
              </label>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="lg" disabled={isPending}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Grounded CV
                </Button>
              </div>
            </form>
          </Card>

          {genResult && (
            <Card padding="md" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-section-title text-foreground">
                    {genResult.data.tailoredHeadline}
                  </h3>
                  <p className="text-muted-foreground">
                    {CV_FORMAT_LABELS[genResult.data.cvFormat]} ·{" "}
                    {CV_TEMPLATE_STYLE_LABELS[genResult.data.templateStyle]} ·
                    Citations: {genResult.data.groundedCitationIds.length}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <a
                      href={`/api/ai/cv-studio/${genResult.analysisId}/export?format=pdf`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </a>
                  </Button>
                  <Button variant="secondary" size="sm" asChild>
                    <a
                      href={`/api/ai/cv-studio/${genResult.analysisId}/export?format=docx`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download DOCX
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSaveGeneratedVersion("pdf")}
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Save New Version (PDF)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSaveGeneratedVersion("docx")}
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Save New Version (DOCX)
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 space-y-2">
                <p className="font-semibold text-foreground">Summary</p>
                <p className="text-foreground">{genResult.data.tailoredSummary}</p>
                <p className="text-[11px] text-success-on-soft">
                  Grounding check: {genResult.data.fabricationSelfCheck}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recent AI Analysis Audit History */}
      {recentAnalyses.length > 0 && (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-section-title text-foreground">
              Recent CV Studio &amp; AI Career History
            </h3>
            <Link href="/documents" className="text-primary-text hover:underline">
              Open Document Vault &rarr;
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {recentAnalyses.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.taskType}</Badge>
                  <span className="font-mono text-muted-foreground">
                    {item.provider} ({item.model})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {item.overallScore != null && (
                    <span className="tabular-nums font-semibold text-foreground">
                      Score: {item.overallScore}
                    </span>
                  )}
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AiConsentDialog
        pending={pendingConsent}
        pendingAction={isPending}
        onApprove={handleApproveConsent}
        onCancel={handleCancelConsent}
      />
    </div>
  );
}
