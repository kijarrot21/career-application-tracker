"use client";

import {
  Download,
  Eye,
  FilePlus2,
  FileText,
  Layers,
  Link2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ContextualHelp } from "@/components/help/contextual-help";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  SampleBadge,
  Select,
} from "@/components/ui";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  deleteDocumentAction,
  linkDocumentVersionToApplicationAction,
  unlinkDocumentVersionFromApplicationAction,
} from "@/server/actions/career";
import type { getDocumentsModuleData } from "@/server/queries/career";

type DocumentsData = Awaited<ReturnType<typeof getDocumentsModuleData>>;
type DocumentRow = DocumentsData["documents"][number];
type VersionRow = DocumentRow["versions"][number];

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "Metadata only";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsClient({ data }: { data: DocumentsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<
    DocumentCategory | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // Upload / Add Version state
  const [targetDocId, setTargetDocId] = useState<string>("");
  const [category, setCategory] = useState<DocumentCategory>("master_cv");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1.0");
  const [notes, setNotes] = useState("");
  const [linkAppId, setLinkAppId] = useState("");
  const [linkRole, setLinkRole] = useState<"cv" | "cover_letter" | "other">(
    "cv",
  );
  const [uploading, setUploading] = useState(false);

  // Preview & Delete modal state
  const [previewVersion, setPreviewVersion] = useState<{
    version: VersionRow;
    docTitle: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);

  const filteredDocs = data.documents.filter((d) => {
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inTitle = d.title.toLowerCase().includes(q);
      const inDesc = (d.description ?? "").toLowerCase().includes(q);
      const inVer = d.versions.some(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          (v.filename ?? "").toLowerCase().includes(q),
      );
      if (!inTitle && !inDesc && !inVer) return false;
    }
    return true;
  });

  function openNewVersionModal(doc: DocumentRow) {
    const nextVerNo = (doc.versions[0]?.versionNo ?? 0) + 1;
    setTargetDocId(doc.id);
    setCategory(doc.category as DocumentCategory);
    setTitle(doc.title);
    setVersionLabel(`v${nextVerNo}.0`);
    setNotes("");
    setShowUploadPanel(true);
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    try {
      const fd = new FormData();
      if (targetDocId) fd.set("documentId", targetDocId);
      fd.set("category", category);
      fd.set("title", title);
      if (description) fd.set("description", description);
      fd.set("versionLabel", versionLabel);
      if (notes) fd.set("notes", notes);
      if (linkAppId) {
        fd.set("linkApplicationId", linkAppId);
        fd.set("linkRole", linkRole);
      }
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        fd.set("file", file);
      }

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: fd,
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Upload failed");
      }

      toast.success(
        targetDocId
          ? `Added version ${versionLabel} to "${title}".`
          : `Saved document "${title}" (${versionLabel}).`,
      );
      setTargetDocId("");
      setTitle("");
      setDescription("");
      setVersionLabel("v1.0");
      setNotes("");
      setLinkAppId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowUploadPanel(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleLinkToApplication(
    documentVersionId: string,
    applicationId: string,
    role: "cv" | "cover_letter" | "other",
  ) {
    if (!applicationId) return;
    startTransition(async () => {
      try {
        await linkDocumentVersionToApplicationAction({
          applicationId,
          documentVersionId,
          role,
        });
        toast.success("Document version linked to application.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not link");
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteDocumentAction(deleteTarget.id);
        toast.success("Document deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-xs">
      <PageHeader
        breadcrumbs={[
          { label: "Career Assets" },
          { label: "Vault & Version Control" },
        ]}
        title="Career Document Repository & Version Control"
        description="Upload and version Master CVs, Customized CVs, Cover Letters, Portfolios, Certificates, Transcripts, and Offers."
        actions={
          <>
            <ContextualHelp module="documents" />
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
              setTargetDocId("");
              setTitle("");
              setVersionLabel("v1.0");
              setShowUploadPanel(!showUploadPanel);
            }}
          >
            <Plus className="h-4 w-4" />
            {showUploadPanel ? "Close Uploader" : "Upload Document"}
            </Button>
          </>
        }
      />

      {/* Upload / New Version Panel */}
      {showUploadPanel && (
        <Card padding="lg" className="border-primary/30">
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h2 className="text-section-title text-foreground">
                  {targetDocId
                    ? `Upload New Version for "${title}"`
                    : "Upload Career Document"}
                </h2>
                <p className="text-caption text-muted-foreground">
                  Supported file formats: PDF, PNG, JPEG, WebP, DOCX, TXT, and
                  Markdown (.md) up to 10 MB.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowUploadPanel(false)}
                aria-label="Close upload panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Document Category" required>
                <Select
                  selectSize="lg"
                  disabled={Boolean(targetDocId)}
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as DocumentCategory)
                  }
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {DOCUMENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Document Title" htmlFor="doc-title" required>
                <Input
                  id="doc-title"
                  type="text"
                  inputSize="lg"
                  required
                  disabled={Boolean(targetDocId)}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Master CV - Senior Backend Engineer"
                />
              </FormField>

              <FormField
                label="Version Label"
                htmlFor="doc-version-label"
                required
              >
                <Input
                  id="doc-version-label"
                  type="text"
                  inputSize="lg"
                  required
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="v1.0 (Fintech Tailored)"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Attach File (PDF / Image / DOCX / TXT / MD)"
                htmlFor="doc-file"
              >
                <Input
                  id="doc-file"
                  ref={fileInputRef}
                  type="file"
                  inputSize="lg"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md"
                />
              </FormField>

              <FormField label="Associate with Application (Optional)">
                <Select
                  selectSize="lg"
                  value={linkAppId}
                  onChange={(e) => setLinkAppId(e.target.value)}
                >
                  <option value="">Do not link yet</option>
                  {data.applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code}: {a.jobTitle} at {a.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Attachment Role">
                <Select
                  selectSize="lg"
                  value={linkRole}
                  onChange={(e) =>
                    setLinkRole(
                      e.target.value as "cv" | "cover_letter" | "other",
                    )
                  }
                >
                  <option value="cv">CV Version Used</option>
                  <option value="cover_letter">Cover Letter Version</option>
                  <option value="other">Supporting / Offer Document</option>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Document Description">
                <Input
                  type="text"
                  inputSize="lg"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Role focus or summary..."
                />
              </FormField>
              <FormField label="Version Changelog / Notes">
                <Input
                  type="text"
                  inputSize="lg"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What changed in this version..."
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowUploadPanel(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={uploading}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                {uploading ? "Uploading..." : "Save Document Version"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search & Category Pills */}
      <div className="space-y-3">
        <Card padding="sm" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              inputSize="lg"
              tone="subtle"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search documents"
              placeholder="Search documents by title, version label, or filename..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="font-mono tabular-nums">
            {filteredDocs.length} document(s)
          </Badge>
        </Card>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === "all" ? "primary" : "secondary"}
            onClick={() => setCategoryFilter("all")}
            className="rounded-full px-3.5"
          >
            All Categories
          </Button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={categoryFilter === cat ? "primary" : "secondary"}
              onClick={() => setCategoryFilter(cat)}
              className="rounded-full px-3.5"
            >
              {DOCUMENT_CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      {/* Document Cards */}
      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No career documents in this category"
          description="Upload your Master CV, Customized CVs, Cover Letters, Portfolios, or Certificates to track versions used per application."
        />
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <Card
              key={doc.id}
              elevation="interactive"
              padding="lg"
              data-testid={`doc-card-${doc.category}`}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-on-soft">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">
                        {
                          DOCUMENT_CATEGORY_LABELS[
                            doc.category as DocumentCategory
                          ]
                        }
                      </Badge>
                      <h3 className="text-section-title text-foreground">
                        {doc.title}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="font-mono tabular-nums"
                      >
                        <Layers className="h-3 w-3" />
                        {doc.versions.length} version(s)
                      </Badge>
                      {doc.isSample && <SampleBadge />}
                    </div>
                    {doc.description && (
                      <p className="text-muted-foreground">{doc.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openNewVersionModal(doc)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New Version
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(doc)}
                    aria-label={`Delete ${doc.title}`}
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Versions List */}
              <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-subtle">
                {doc.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex flex-col justify-between gap-3 p-4 lg:flex-row lg:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                          v{ver.versionNo}
                        </span>
                        <span className="font-semibold text-foreground">
                          {ver.label}
                        </span>
                        {ver.filename && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            ({ver.filename})
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatBytes(ver.sizeBytes)}
                        </span>
                        {ver.sha256 && (
                          <span
                            title={`SHA-256: ${ver.sha256}`}
                            className="font-mono text-[10px] text-subtle-foreground"
                          >
                            sha256:{ver.sha256.slice(0, 10)}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          Uploaded {formatDateTime(ver.createdAt)}
                        </span>
                      </div>

                      {ver.notes && (
                        <p className="text-[11px] text-muted-foreground">
                          Note: {ver.notes}
                        </p>
                      )}

                      {ver.linkedApplications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-muted-foreground">
                            Used in:
                          </span>
                          {ver.linkedApplications.map((la) => (
                            <Badge
                              key={la.link.id}
                              variant="primary"
                              className="gap-1"
                            >
                              <Link
                                href={`/applications/${la.appId}`}
                                className="hover:underline"
                              >
                                {la.appCode} ({la.companyName})
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  startTransition(async () => {
                                    await unlinkDocumentVersionFromApplicationAction(
                                      la.link.id,
                                      la.appId,
                                    );
                                    toast.success("Unlinked from application.");
                                    router.refresh();
                                  })
                                }
                                aria-label={`Remove association with ${la.appCode}`}
                                title="Remove association"
                                className="ml-0.5 cursor-pointer text-primary-on-soft hover:text-destructive-on-soft"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select
                          aria-label={`Associate ${ver.label} with application`}
                          selectSize="sm"
                          wrapperClassName="w-56"
                          defaultValue=""
                          onChange={(e) => {
                            const appId = e.target.value;
                            if (!appId) return;
                            const role =
                              doc.category === "master_cv" ||
                              doc.category === "custom_cv"
                                ? "cv"
                                : doc.category === "cover_letter"
                                  ? "cover_letter"
                                  : "other";
                            handleLinkToApplication(ver.id, appId, role);
                            e.target.value = "";
                          }}
                        >
                          <option value="">+ Link to Application...</option>
                          {data.applications.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code}: {a.jobTitle} at {a.companyName}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {ver.storageKey && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setPreviewVersion({
                                version: ver,
                                docTitle: doc.title,
                              })
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </Button>

                          <Button variant="secondary" size="sm" asChild>
                            <a
                              href={`/api/documents/versions/${ver.id}/file?download=1`}
                              download
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* In-App Document Preview Modal */}
      <Dialog
        open={Boolean(previewVersion)}
        onOpenChange={(next) => !next && setPreviewVersion(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[85vh] max-w-4xl flex-col overflow-hidden p-0"
        >
          {previewVersion && (
            <>
              <DialogHeader className="mb-0 px-5 py-3.5 pr-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <DialogTitle>
                      {previewVersion.docTitle} ({previewVersion.version.label})
                    </DialogTitle>
                    <DialogDescription className="font-mono text-[11px]">
                      {previewVersion.version.filename} ·{" "}
                      {previewVersion.version.mimeType}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" asChild>
                      <a
                        href={`/api/documents/versions/${previewVersion.version.id}/file?download=1`}
                        download
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close dialog"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogClose>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 bg-surface-subtle p-4">
                {previewVersion.version.mimeType?.startsWith("image/") ? (
                  <div className="flex h-full items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/documents/versions/${previewVersion.version.id}/file`}
                      alt={previewVersion.docTitle}
                      className="max-h-full max-w-full rounded-xl object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    title={`Preview ${previewVersion.docTitle}`}
                    src={`/api/documents/versions/${previewVersion.version.id}/file`}
                    className="h-full w-full rounded-xl border border-border bg-white"
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete document?"}
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.title}" and all ${deleteTarget.versions.length} version(s).`
            : ""
        }
        confirmLabel="Delete Document"
        pending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
