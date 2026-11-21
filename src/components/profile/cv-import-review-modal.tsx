"use client";

import { CheckCircle2, FileUp, ShieldAlert, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { CvImportDraftPayload } from "@/lib/domain/career-profile";
import {
  applyCvImportReviewAction,
  discardCvImportReviewAction,
  stageCvImportReviewAction,
} from "@/server/actions/career-profile";

type ProfilePatchField =
  | "fullName"
  | "headline"
  | "summary"
  | "contactEmail"
  | "contactPhone"
  | "location"
  | "country"
  | "totalExperienceYears";

type ExistingProfile = {
  fullName?: string | null;
  headline?: string | null;
  summary?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  location?: string | null;
  country?: string | null;
  totalExperienceYears?: number | null;
  experiences?: Array<{ companyName: string; jobTitle: string }>;
  educations?: Array<{ institution: string }>;
  skills?: Array<{ skillName: string; proficiencyLevel?: string | null }>;
  certifications?: Array<{ name: string }>;
  projects?: Array<{ name: string }>;
};

export function StageCvImportDialog({
  open,
  onClose,
  cvVersions,
}: {
  open: boolean;
  onClose: () => void;
  cvVersions: {
    versionId: string;
    title: string;
    category: string;
    versionNo: number;
    label: string;
    filename: string | null;
  }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sourceDocumentVersionId, setSourceDocumentVersionId] = useState(
    cvVersions[0]?.versionId ?? "",
  );
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleStage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (jsonInput.trim()) {
          const parsed = JSON.parse(jsonInput) as Partial<CvImportDraftPayload>;
          await stageCvImportReviewAction({
            sourceDocumentVersionId: sourceDocumentVersionId || null,
            profilePatch: parsed.profilePatch,
            experiences: parsed.experiences as never,
            educations: parsed.educations as never,
            skills: parsed.skills as never,
            certifications: parsed.certifications as never,
            projects: parsed.projects as never,
          });
        } else {
          const skillItems = skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((skillName, idx) => ({
              tempId: `skill_${Date.now()}_${idx}`,
              skillName,
            }));

          const expItems =
            companyName.trim() && jobTitle.trim() && startDate.trim()
              ? [
                  {
                    tempId: `exp_${Date.now()}`,
                    companyName: companyName.trim(),
                    jobTitle: jobTitle.trim(),
                    startDate: startDate.trim(),
                  },
                ]
              : [];

          await stageCvImportReviewAction({
            sourceDocumentVersionId: sourceDocumentVersionId || null,
            profilePatch: {
              headline: headline.trim() || undefined,
              summary: summary.trim() || undefined,
              location: location.trim() || undefined,
            },
            experiences: expItems,
            skills: skillItems,
          });
        }

        toast.success(
          "CV import draft staged for review. Verified career data was not modified.",
        );
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not stage CV import payload.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stage CV Import for Review</DialogTitle>
          <DialogDescription>
            Link a CV from your Document Repository and stage candidate updates
            for review. AI-extracted CVs are staged here automatically after
            upload. No verified profile record is overwritten without your
            explicit approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStage} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Source CV Document Version (Optional)">
            <Select
              value={sourceDocumentVersionId}
              onChange={(e) => setSourceDocumentVersionId(e.target.value)}
            >
              <option value="">None / External structured draft</option>
              {cvVersions.map((v) => (
                <option key={v.versionId} value={v.versionId}>
                  {v.title} · v{v.versionNo} ({v.label})
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Proposed Headline">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
              />
            </FormField>
            <FormField label="Proposed Location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Jakarta"
              />
            </FormField>
          </div>

          <FormField label="Proposed Professional Summary">
            <Textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Paste summary text to review before applying..."
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Proposed Company">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="PT Contoh"
              />
            </FormField>
            <FormField label="Proposed Role">
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Software Engineer"
              />
            </FormField>
            <FormField label="Start Date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Proposed Skills (comma-separated)">
            <Input
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="TypeScript, Go, PostgreSQL"
            />
          </FormField>

          <FormField
            label="Or Paste Structured CV Import JSON (Optional)"
            hint="If provided, overrides the quick fields above while staying strictly in pending review."
          >
            <Textarea
              rows={3}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"profilePatch":{"headline":"..."},"skills":[{"tempId":"s1","skillName":"Go"}]}'
              className="font-mono text-[11px]"
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <FileUp className="h-3.5 w-3.5" />
              {isPending ? "Staging..." : "Stage for Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function confidenceVariant(
  confidence: number,
): "success" | "warning" | "destructive" {
  if (confidence >= 70) return "success";
  if (confidence >= 40) return "warning";
  return "destructive";
}

function ItemField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <FormField label={label}>
      {multiline ? (
        <Textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}

export function ReviewStagedCvImportDialog({
  open,
  onClose,
  staged,
  existingProfile,
}: {
  open: boolean;
  onClose: () => void;
  staged: CvImportDraftPayload;
  existingProfile?: ExistingProfile;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CvImportDraftPayload>(() =>
    JSON.parse(JSON.stringify(staged)),
  );

  const availableFields = (
    [
      "fullName",
      "headline",
      "summary",
      "contactEmail",
      "contactPhone",
      "location",
      "country",
      "totalExperienceYears",
    ] as const
  ).filter(
    (k) =>
      draft.profilePatch?.[k] !== undefined &&
      draft.profilePatch?.[k] !== null &&
      draft.profilePatch?.[k] !== "",
  );

  const [selectedFields, setSelectedFields] = useState<ProfilePatchField[]>([
    ...availableFields,
  ]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>(
    (staged.experiences ?? []).map((e) => e.tempId),
  );
  const [selectedEduIds, setSelectedEduIds] = useState<string[]>(
    (staged.educations ?? []).map((e) => e.tempId),
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(
    (staged.skills ?? []).map((s) => s.tempId),
  );
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>(
    (staged.certifications ?? []).map((c) => c.tempId),
  );
  const [selectedProjIds, setSelectedProjIds] = useState<string[]>(
    (staged.projects ?? []).map((p) => p.tempId),
  );

  function toggle<T extends string>(list: T[], val: T, setList: (v: T[]) => void) {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  function setAll(enabled: boolean) {
    setSelectedFields(enabled ? [...availableFields] : []);
    setSelectedExpIds(enabled ? (draft.experiences ?? []).map((e) => e.tempId) : []);
    setSelectedEduIds(enabled ? (draft.educations ?? []).map((e) => e.tempId) : []);
    setSelectedSkillIds(enabled ? (draft.skills ?? []).map((s) => s.tempId) : []);
    setSelectedCertIds(
      enabled ? (draft.certifications ?? []).map((c) => c.tempId) : [],
    );
    setSelectedProjIds(enabled ? (draft.projects ?? []).map((p) => p.tempId) : []);
  }

  function metaFor(fieldPath: string) {
    return draft.reviewMeta?.fields.find((f) => f.fieldPath === fieldPath);
  }

  function evidenceBlock(fieldPath: string) {
    const meta = metaFor(fieldPath);
    return (
      <>
        {meta && (
          <Badge variant={confidenceVariant(meta.confidence)}>
            {meta.confidence}% confidence
          </Badge>
        )}
        {meta?.evidence && (
          <span className="block text-[11px] text-muted-foreground">
            Evidence: {meta.evidence}
          </span>
        )}
      </>
    );
  }

  function existingValue(field: ProfilePatchField) {
    const value = existingProfile?.[field];
    return value === null || value === undefined ? null : String(value);
  }

  function updateProfileField(field: ProfilePatchField, value: string) {
    setDraft((prev) => ({
      ...prev,
      profilePatch: {
        ...prev.profilePatch,
        [field]:
          field === "totalExperienceYears"
            ? value === ""
              ? null
              : Number(value)
            : value,
      },
    }));
  }

  function updateItemField<T extends { tempId: string }>(
    section: "experiences" | "educations" | "skills" | "certifications" | "projects",
    tempId: string,
    field: string,
    value: string,
  ) {
    setDraft((prev) => ({
      ...prev,
      [section]: (prev[section] as T[] | undefined)?.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function handleApply() {
    startTransition(async () => {
      try {
        await applyCvImportReviewAction({
          acceptProfileFields: selectedFields,
          acceptedExperienceIds: selectedExpIds,
          acceptedEducationIds: selectedEduIds,
          acceptedSkillIds: selectedSkillIds,
          acceptedCertificationIds: selectedCertIds,
          acceptedProjectIds: selectedProjIds,
          reviewedPayload: draft as never,
        });
        toast.success(
          "Selected CV import items verified and saved to Master Career Profile.",
        );
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not apply CV import review.",
        );
      }
    });
  }

  function handleDiscard() {
    startTransition(async () => {
      try {
        await discardCvImportReviewAction();
        toast.success("Staged CV import discarded.");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not discard staged draft.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; Correct Staged CV Import</DialogTitle>
          <DialogDescription>
            Every field shows the proposed value, your current value when it
            differs, and extraction confidence with supporting text. Edit before
            accepting. Only checked items are applied; verified records are never
            silently overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-warning-on-soft">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Source:{" "}
              <strong>
                {staged.sourceDocumentLabel ?? "Structured Import Draft"}
              </strong>
            </span>
            <div className="flex gap-2">
              <Button size="xs" variant="secondary" onClick={() => setAll(true)}>
                Accept all reviewed
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setAll(false)}>
                Deselect all
              </Button>
            </div>
          </div>

          {availableFields.length > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">
                Professional Information &amp; Summary
              </p>
              {availableFields.map((field) => {
                const current = existingValue(field);
                const proposed = String(draft.profilePatch?.[field] ?? "");
                const changed = current !== null && current !== proposed;
                return (
                  <div
                    key={field}
                    className="space-y-1.5 rounded-lg bg-surface-subtle p-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Accept ${field}`}
                        checked={selectedFields.includes(field)}
                        onChange={() =>
                          toggle(selectedFields, field, setSelectedFields)
                        }
                      />
                      <span className="font-semibold capitalize text-foreground">
                        {field}
                      </span>
                      {changed && (
                        <Badge variant="warning">
                          Current: {current}
                        </Badge>
                      )}
                      {evidenceBlock(`profile.${field}`)}
                    </div>
                    {field === "summary" ? (
                      <Textarea
                        rows={2}
                        value={proposed}
                        onChange={(e) => updateProfileField(field, e.target.value)}
                      />
                    ) : (
                      <Input
                        type={
                          field === "totalExperienceYears" ? "number" : "text"
                        }
                        value={proposed}
                        onChange={(e) => updateProfileField(field, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {(draft.experiences?.length ?? 0) > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Work Experience</p>
              {draft.experiences!.map((exp, index) => (
                <div
                  key={exp.tempId}
                  className="space-y-2 rounded-lg bg-surface-subtle p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Accept experience ${exp.companyName}`}
                      checked={selectedExpIds.includes(exp.tempId)}
                      onChange={() =>
                        toggle(selectedExpIds, exp.tempId, setSelectedExpIds)
                      }
                    />
                    <span className="font-semibold text-foreground">
                      {exp.companyName} · {exp.jobTitle}
                    </span>
                    {existingProfile?.experiences?.some(
                      (e) =>
                        e.companyName.toLowerCase() ===
                        exp.companyName.toLowerCase(),
                    ) && <Badge variant="warning">Existing entry found</Badge>}
                    {evidenceBlock(`experiences[${index}].jobTitle`)}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ItemField
                      label="Company"
                      value={exp.companyName}
                      onChange={(v) =>
                        updateItemField("experiences", exp.tempId, "companyName", v)
                      }
                    />
                    <ItemField
                      label="Job title"
                      value={exp.jobTitle}
                      onChange={(v) =>
                        updateItemField("experiences", exp.tempId, "jobTitle", v)
                      }
                    />
                    <ItemField
                      label="Start date"
                      value={exp.startDate}
                      onChange={(v) =>
                        updateItemField("experiences", exp.tempId, "startDate", v)
                      }
                    />
                    <ItemField
                      label="End date"
                      value={exp.endDate ?? ""}
                      onChange={(v) =>
                        updateItemField("experiences", exp.tempId, "endDate", v)
                      }
                    />
                    <div className="sm:col-span-2">
                      <ItemField
                        label="Responsibilities"
                        value={exp.responsibilities ?? ""}
                        multiline
                        onChange={(v) =>
                          updateItemField(
                            "experiences",
                            exp.tempId,
                            "responsibilities",
                            v,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {(draft.educations?.length ?? 0) > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Education</p>
              {draft.educations!.map((edu, index) => (
                <div
                  key={edu.tempId}
                  className="space-y-2 rounded-lg bg-surface-subtle p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Accept education ${edu.institution}`}
                      checked={selectedEduIds.includes(edu.tempId)}
                      onChange={() =>
                        toggle(selectedEduIds, edu.tempId, setSelectedEduIds)
                      }
                    />
                    <span className="font-semibold text-foreground">
                      {edu.institution}
                    </span>
                    {evidenceBlock(`educations[${index}].institution`)}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <ItemField
                      label="Institution"
                      value={edu.institution}
                      onChange={(v) =>
                        updateItemField("educations", edu.tempId, "institution", v)
                      }
                    />
                    <ItemField
                      label="Degree"
                      value={edu.degreeTitle ?? ""}
                      onChange={(v) =>
                        updateItemField("educations", edu.tempId, "degreeTitle", v)
                      }
                    />
                    <ItemField
                      label="Field of study"
                      value={edu.fieldOfStudy ?? ""}
                      onChange={(v) =>
                        updateItemField("educations", edu.tempId, "fieldOfStudy", v)
                      }
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {(draft.skills?.length ?? 0) > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Skills &amp; Languages</p>
              <div className="flex flex-wrap gap-2">
                {draft.skills!.map((sk, index) => {
                  const existing = existingProfile?.skills?.find(
                    (s) =>
                      s.skillName.toLowerCase() === sk.skillName.toLowerCase(),
                  );
                  return (
                    <div
                      key={sk.tempId}
                      className="w-full space-y-1.5 rounded-lg bg-surface-subtle p-2 sm:w-[calc(50%-0.5rem)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Accept skill ${sk.skillName}`}
                          checked={selectedSkillIds.includes(sk.tempId)}
                          onChange={() =>
                            toggle(selectedSkillIds, sk.tempId, setSelectedSkillIds)
                          }
                        />
                        <Badge variant={sk.category === "language" ? "info" : "outline"}>
                          {sk.category ?? "technical"}
                        </Badge>
                        {existing && (
                          <Badge variant="warning">
                            Current: {existing.proficiencyLevel ?? "not set"}
                          </Badge>
                        )}
                        {evidenceBlock(`skills[${index}].skillName`)}
                      </div>
                      <ItemField
                        label="Skill"
                        value={sk.skillName}
                        onChange={(v) =>
                          updateItemField("skills", sk.tempId, "skillName", v)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(draft.certifications?.length ?? 0) > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Certifications</p>
              {draft.certifications!.map((cert, index) => (
                <div
                  key={cert.tempId}
                  className="space-y-2 rounded-lg bg-surface-subtle p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Accept certification ${cert.name}`}
                      checked={selectedCertIds.includes(cert.tempId)}
                      onChange={() =>
                        toggle(selectedCertIds, cert.tempId, setSelectedCertIds)
                      }
                    />
                    <span className="font-semibold text-foreground">
                      {cert.name}
                    </span>
                    {evidenceBlock(`certifications[${index}].name`)}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <ItemField
                      label="Name"
                      value={cert.name}
                      onChange={(v) =>
                        updateItemField("certifications", cert.tempId, "name", v)
                      }
                    />
                    <ItemField
                      label="Issuer"
                      value={cert.issuingOrganization}
                      onChange={(v) =>
                        updateItemField(
                          "certifications",
                          cert.tempId,
                          "issuingOrganization",
                          v,
                        )
                      }
                    />
                    <ItemField
                      label="Issue date"
                      value={cert.issueDate ?? ""}
                      onChange={(v) =>
                        updateItemField("certifications", cert.tempId, "issueDate", v)
                      }
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {(draft.projects?.length ?? 0) > 0 && (
            <section className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Projects</p>
              {draft.projects!.map((proj, index) => (
                <div
                  key={proj.tempId}
                  className="space-y-2 rounded-lg bg-surface-subtle p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Accept project ${proj.name}`}
                      checked={selectedProjIds.includes(proj.tempId)}
                      onChange={() =>
                        toggle(selectedProjIds, proj.tempId, setSelectedProjIds)
                      }
                    />
                    <span className="font-semibold text-foreground">
                      {proj.name}
                    </span>
                    {evidenceBlock(`projects[${index}].name`)}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ItemField
                      label="Name"
                      value={proj.name}
                      onChange={(v) =>
                        updateItemField("projects", proj.tempId, "name", v)
                      }
                    />
                    <ItemField
                      label="Role"
                      value={proj.role ?? ""}
                      onChange={(v) =>
                        updateItemField("projects", proj.tempId, "role", v)
                      }
                    />
                    <div className="sm:col-span-2">
                      <ItemField
                        label="Description"
                        value={proj.description ?? ""}
                        multiline
                        onChange={(v) =>
                          updateItemField("projects", proj.tempId, "description", v)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {(draft.reviewMeta?.unmapped.length ?? 0) > 0 && (
            <section className="space-y-1 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">
                Extracted data without a Career Profile field
              </p>
              <p className="text-muted-foreground">
                Kept for review only. It is not written to your profile.
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {draft.reviewMeta!.unmapped.map((entry, index) => (
                  <li key={`${entry.fieldPath}-${index}`}>
                    {entry.section}: {entry.value}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <DialogFooter className="flex flex-wrap justify-between gap-2 pt-3">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDiscard}
            disabled={isPending}
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject Extraction
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApply} disabled={isPending}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPending ? "Applying..." : "Verify & Apply Selected"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
