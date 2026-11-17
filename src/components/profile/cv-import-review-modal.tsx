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
            for review. No verified profile records will be overwritten
            automatically (AI parsing will plug into this staging queue in a
            future phase).
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
                  {v.title} — v{v.versionNo} ({v.label})
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

export function ReviewStagedCvImportDialog({
  open,
  onClose,
  staged,
}: {
  open: boolean;
  onClose: () => void;
  staged: CvImportDraftPayload;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      staged.profilePatch?.[k] !== undefined &&
      staged.profilePatch?.[k] !== null &&
      staged.profilePatch?.[k] !== "",
  );

  const [selectedFields, setSelectedFields] = useState<ProfilePatchField[]>([
    ...availableFields,
  ]);
  const [editedHeadline, setEditedHeadline] = useState(
    staged.profilePatch?.headline ?? "",
  );
  const [editedSummary, setEditedSummary] = useState(
    staged.profilePatch?.summary ?? "",
  );
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
          reviewedPayload: {
            sourceDocumentVersionId: staged.sourceDocumentVersionId,
            profilePatch: {
              ...staged.profilePatch,
              headline: editedHeadline || staged.profilePatch?.headline,
              summary: editedSummary || staged.profilePatch?.summary,
            },
            experiences: staged.experiences as never,
            educations: staged.educations as never,
            skills: staged.skills as never,
            certifications: staged.certifications as never,
            projects: staged.projects as never,
          },
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
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; Correct Staged CV Import</DialogTitle>
          <DialogDescription>
            Select only the fields and records you confirm as accurate. Unchecked
            items are ignored, and existing verified records are never silently
            overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-warning-on-soft">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Source:{" "}
              <strong>
                {staged.sourceDocumentLabel ?? "Structured Import Draft"}
              </strong>
            </span>
          </div>

          {availableFields.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">
                Profile Fields (Explicit Opt-In Overwrite)
              </p>
              <div className="space-y-2">
                {availableFields.map((field) => (
                  <label key={field} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field)}
                      onChange={() =>
                        toggle(selectedFields, field, setSelectedFields)
                      }
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="font-semibold capitalize text-foreground">
                        {field}:{" "}
                      </span>
                      {field === "headline" ? (
                        <Input
                          value={editedHeadline}
                          onChange={(e) => setEditedHeadline(e.target.value)}
                          className="mt-1 h-8"
                        />
                      ) : field === "summary" ? (
                        <Textarea
                          rows={2}
                          value={editedSummary}
                          onChange={(e) => setEditedSummary(e.target.value)}
                          className="mt-1"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {String(staged.profilePatch?.[field] ?? "")}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(staged.experiences?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">
                Staged Work Experiences
              </p>
              {staged.experiences!.map((exp) => (
                <label
                  key={exp.tempId}
                  className="flex items-start gap-2 rounded-lg bg-surface-subtle p-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedExpIds.includes(exp.tempId)}
                    onChange={() =>
                      toggle(selectedExpIds, exp.tempId, setSelectedExpIds)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="text-foreground">
                      {exp.jobTitle} — {exp.companyName}
                    </strong>
                    <span className="block text-muted-foreground">
                      {exp.startDate} to{" "}
                      {exp.isCurrent ? "Present" : (exp.endDate ?? "N/A")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {(staged.skills?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Staged Skills</p>
              <div className="flex flex-wrap gap-2">
                {staged.skills!.map((sk) => (
                  <label
                    key={sk.tempId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(sk.tempId)}
                      onChange={() =>
                        toggle(selectedSkillIds, sk.tempId, setSelectedSkillIds)
                      }
                    />
                    <span className="font-medium text-foreground">
                      {sk.skillName}
                    </span>
                    {sk.category && <Badge variant="outline">{sk.category}</Badge>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(staged.educations?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Staged Education</p>
              {staged.educations!.map((edu) => (
                <label key={edu.tempId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedEduIds.includes(edu.tempId)}
                    onChange={() =>
                      toggle(selectedEduIds, edu.tempId, setSelectedEduIds)
                    }
                  />
                  <span>
                    <strong>{edu.institution}</strong>
                    {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}

          {(staged.certifications?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">
                Staged Certifications
              </p>
              {staged.certifications!.map((cert) => (
                <label key={cert.tempId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCertIds.includes(cert.tempId)}
                    onChange={() =>
                      toggle(selectedCertIds, cert.tempId, setSelectedCertIds)
                    }
                  />
                  <span>
                    <strong>{cert.name}</strong> ({cert.issuingOrganization})
                  </span>
                </label>
              ))}
            </div>
          )}

          {(staged.projects?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle p-3">
              <p className="font-semibold text-foreground">Staged Projects</p>
              {staged.projects!.map((proj) => (
                <label key={proj.tempId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedProjIds.includes(proj.tempId)}
                    onChange={() =>
                      toggle(selectedProjIds, proj.tempId, setSelectedProjIds)
                    }
                  />
                  <span>
                    <strong>{proj.name}</strong>
                    {proj.role ? ` (${proj.role})` : ""}
                  </span>
                </label>
              ))}
            </div>
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
            Discard Draft
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
