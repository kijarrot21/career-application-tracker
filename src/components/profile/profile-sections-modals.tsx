"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
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
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  type EmploymentType,
} from "@/lib/constants";
import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  SKILL_PROFICIENCIES,
  SKILL_PROFICIENCY_LABELS,
  type SkillCategory,
  type SkillProficiency,
} from "@/lib/domain/career-profile";
import {
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  type EducationLevel,
} from "@/lib/domain/suitability";
import {
  saveCareerCertificationAction,
  saveCareerEducationAction,
  saveCareerExperienceAction,
  saveCareerProjectAction,
  saveCareerSkillAction,
} from "@/server/actions/career-profile";
import type { getMasterCareerProfile } from "@/server/queries/career-profile";

type ProfileBundle = Awaited<ReturnType<typeof getMasterCareerProfile>>;

export function ExperienceFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProfileBundle["experiences"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    (initial?.employmentType as EmploymentType) ?? "full_time",
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [isCurrent, setIsCurrent] = useState(initial?.isCurrent ?? false);
  const [responsibilities, setResponsibilities] = useState(
    initial?.responsibilities ?? "",
  );
  const [achievementsText, setAchievementsText] = useState(
    (initial?.achievements ?? []).join("\n"),
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCareerExperienceAction({
          id: initial?.id,
          companyName,
          jobTitle,
          employmentType,
          location: location || null,
          startDate,
          endDate: isCurrent ? null : endDate || null,
          isCurrent,
          responsibilities: responsibilities || null,
          achievements: achievementsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        });
        toast.success(
          initial ? "Experience updated." : "Work experience added.",
        );
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save experience.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Work Experience" : "Add Work Experience"}
          </DialogTitle>
          <DialogDescription>
            Record verified employment details and measurable achievements.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Company Name" required>
              <Input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. PT GoTo Gojek Tokopedia"
              />
            </FormField>
            <FormField label="Job Title" required>
              <Input
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Employment Type">
              <Select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType)
                }
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Jakarta (Hybrid)"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Start Date" required>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                disabled={isCurrent}
                value={isCurrent ? "" : endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => {
                setIsCurrent(e.target.checked);
                if (e.target.checked) setEndDate("");
              }}
            />
            I currently work in this role
          </label>

          <FormField label="Core Responsibilities">
            <Textarea
              rows={3}
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="Primary scope, ownership, and team context..."
            />
          </FormField>

          <FormField
            label="Measurable Achievements (one per line)"
            hint="Verified metrics only (e.g. Reduced checkout latency by 32% across 4M daily requests)."
          >
            <Textarea
              rows={3}
              value={achievementsText}
              onChange={(e) => setAchievementsText(e.target.value)}
              placeholder="Reduced API p95 latency from 420ms to 180ms&#10;Led migration of 12 microservices to PostgreSQL"
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Experience"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EducationFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProfileBundle["educations"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [qualification, setQualification] = useState<EducationLevel>(
    (initial?.qualification as EducationLevel) ?? "bachelor",
  );
  const [degreeTitle, setDegreeTitle] = useState(initial?.degreeTitle ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(
    initial?.fieldOfStudy ?? "",
  );
  const [graduationYear, setGraduationYear] = useState(
    initial?.graduationYear != null ? String(initial.graduationYear) : "",
  );
  const [gpa, setGpa] = useState(initial?.gpa ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCareerEducationAction({
          id: initial?.id,
          institution,
          qualification,
          degreeTitle: degreeTitle || null,
          fieldOfStudy: fieldOfStudy || null,
          graduationYear: graduationYear ? Number(graduationYear) : null,
          gpa: gpa || null,
          notes: notes || null,
        });
        toast.success(initial ? "Education updated." : "Education added.");
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save education.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Education" : "Add Education"}
          </DialogTitle>
          <DialogDescription>
            Add formal degrees, diplomas, or academic qualifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Institution" required>
            <Input
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Institut Teknologi Bandung (ITB)"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Qualification Level" required>
              <Select
                value={qualification}
                onChange={(e) =>
                  setQualification(e.target.value as EducationLevel)
                }
              >
                {EDUCATION_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {EDUCATION_LABELS[l]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Graduation Year">
              <Input
                type="number"
                min={1950}
                max={2100}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                placeholder="2021"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Degree / Title">
              <Input
                value={degreeTitle}
                onChange={(e) => setDegreeTitle(e.target.value)}
                placeholder="e.g. Sarjana Komputer (S.Kom)"
              />
            </FormField>
            <FormField label="Field of Study">
              <Input
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="e.g. Informatics / Computer Science"
              />
            </FormField>
          </div>

          <FormField label="GPA / Honors (Optional)">
            <Input
              value={gpa}
              onChange={(e) => setGpa(e.target.value)}
              placeholder="e.g. 3.78 / 4.00 (Cum Laude)"
            />
          </FormField>

          <FormField label="Notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thesis topic, relevant coursework, or awards..."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Education"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SkillFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProfileBundle["skills"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [skillName, setSkillName] = useState(initial?.skillName ?? "");
  const [category, setCategory] = useState<SkillCategory>(
    (initial?.category as SkillCategory) ?? "technical",
  );
  const [proficiencyLevel, setProficiencyLevel] = useState<SkillProficiency>(
    (initial?.proficiencyLevel as SkillProficiency) ?? "intermediate",
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(
    initial?.yearsOfExperience != null
      ? String(initial.yearsOfExperience)
      : "",
  );
  const [evidence, setEvidence] = useState(initial?.evidence ?? "");
  const [isUserVerified, setIsUserVerified] = useState(
    initial?.isUserVerified ?? true,
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCareerSkillAction({
          id: initial?.id,
          skillName,
          category,
          proficiencyLevel,
          yearsOfExperience: yearsOfExperience
            ? Number(yearsOfExperience)
            : null,
          evidence: evidence || null,
          isUserVerified,
        });
        toast.success(initial ? "Skill updated." : "Skill added.");
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save skill.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Skill" : "Add Skill"}</DialogTitle>
          <DialogDescription>
            Verified skills power suitability scoring and future grounded AI CV
            tailoring.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Skill Name" required>
            <Input
              required
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="e.g. TypeScript, PostgreSQL, Product Strategy"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Category">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as SkillCategory)}
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SKILL_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Proficiency">
              <Select
                value={proficiencyLevel}
                onChange={(e) =>
                  setProficiencyLevel(e.target.value as SkillProficiency)
                }
              >
                {SKILL_PROFICIENCIES.map((p) => (
                  <option key={p} value={p}>
                    {SKILL_PROFICIENCY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Years of Experience">
            <Input
              type="number"
              min={0}
              max={60}
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              placeholder="e.g. 4"
            />
          </FormField>

          <FormField
            label="Grounded Evidence"
            hint="Where and how you applied this skill in real projects or roles."
          >
            <Textarea
              rows={2}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Built payment reconciliation pipeline in Go at PT Example..."
            />
          </FormField>

          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={isUserVerified}
              onChange={(e) => setIsUserVerified(e.target.checked)}
            />
            I verify this skill is accurate for my profile
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CertificationFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProfileBundle["certifications"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [issuingOrganization, setIssuingOrganization] = useState(
    initial?.issuingOrganization ?? "",
  );
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? "");
  const [expirationDate, setExpirationDate] = useState(
    initial?.expirationDate ?? "",
  );
  const [credentialId, setCredentialId] = useState(
    initial?.credentialId ?? "",
  );
  const [credentialUrl, setCredentialUrl] = useState(
    initial?.credentialUrl ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCareerCertificationAction({
          id: initial?.id,
          name,
          issuingOrganization,
          issueDate: issueDate || null,
          expirationDate: expirationDate || null,
          credentialId: credentialId || null,
          credentialUrl: credentialUrl || null,
        });
        toast.success(
          initial ? "Certification updated." : "Certification added.",
        );
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not save certification.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Certification" : "Add Certification"}
          </DialogTitle>
          <DialogDescription>
            Record professional certifications, licenses, and credential links.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Certification Name" required>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWS Certified Solutions Architect – Associate"
            />
          </FormField>

          <FormField label="Issuing Organization" required>
            <Input
              required
              value={issuingOrganization}
              onChange={(e) => setIssuingOrganization(e.target.value)}
              placeholder="e.g. Amazon Web Services (AWS)"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Issue Date">
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </FormField>
            <FormField label="Expiration Date">
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Credential ID">
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Optional certificate serial/ID"
            />
          </FormField>

          <FormField label="Credential URL">
            <Input
              type="url"
              value={credentialUrl}
              onChange={(e) => setCredentialUrl(e.target.value)}
              placeholder="https://www.credly.com/..."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Certification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectFormDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProfileBundle["projects"][number] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [organization, setOrganization] = useState(initial?.organization ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [isOngoing, setIsOngoing] = useState(initial?.isOngoing ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [achievementsText, setAchievementsText] = useState(
    (initial?.achievements ?? []).join("\n"),
  );
  const [technologiesText, setTechnologiesText] = useState(
    (initial?.technologies ?? []).join(", "),
  );
  const [projectUrl, setProjectUrl] = useState(initial?.projectUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveCareerProjectAction({
          id: initial?.id,
          name,
          organization: organization || null,
          role: role || null,
          startDate: startDate || null,
          endDate: isOngoing ? null : endDate || null,
          isOngoing,
          description: description || null,
          achievements: achievementsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          technologies: technologiesText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          projectUrl: projectUrl || null,
        });
        toast.success(initial ? "Project updated." : "Project added.");
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save project.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Project" : "Add Project"}
          </DialogTitle>
          <DialogDescription>
            Document portfolio, open-source, or key enterprise project outcomes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Project Name" required>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Real-Time QRIS Settlement Engine"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Organization / Context">
              <Input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. PT Example / Open Source"
              />
            </FormField>
            <FormField label="Your Role">
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Lead Backend Engineer"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
            <FormField label="End Date">
              <Input
                type="date"
                disabled={isOngoing}
                value={isOngoing ? "" : endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={isOngoing}
              onChange={(e) => {
                setIsOngoing(e.target.checked);
                if (e.target.checked) setEndDate("");
              }}
            />
            Project is currently ongoing
          </label>

          <FormField label="Description">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Problem solved, architecture, and scale..."
            />
          </FormField>

          <FormField label="Measurable Outcomes / Achievements (one per line)">
            <Textarea
              rows={2}
              value={achievementsText}
              onChange={(e) => setAchievementsText(e.target.value)}
              placeholder="Processed 120k transactions/day with 99.99% uptime"
            />
          </FormField>

          <FormField label="Technologies (comma-separated)">
            <Input
              value={technologiesText}
              onChange={(e) => setTechnologiesText(e.target.value)}
              placeholder="Go, PostgreSQL, Kafka, Docker"
            />
          </FormField>

          <FormField label="Project / Repository URL">
            <Input
              type="url"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
