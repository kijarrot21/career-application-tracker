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
import { SampleBadge } from "@/components/ui/badges";
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
  const [targetDocId, setTargetDocId] = useState<string>(""); // empty = create new document
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

  // Preview modal state
  const [previewVersion, setPreviewVersion] = useState<{
    version: VersionRow;
    docTitle: string;
  } | null>(null);

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

  function handleDeleteDocument(doc: DocumentRow) {
    if (
      !window.confirm(
        `Delete "${doc.title}" and all ${doc.versions.length} version(s)?`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteDocumentAction(doc.id);
        toast.success("Document deleted.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Career Document Repository & Version Control
          </h1>
          <p className="mt-0.5 text-body-sm text-[#64748B]">
            Upload and version Master CVs, Customized CVs, Cover Letters, Portfolios, Certificates, Transcripts, and Offers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTargetDocId("");
            setTitle("");
            setVersionLabel("v1.0");
            setShowUploadPanel(!showUploadPanel);
          }}
          className="btn-primary h-9 px-3.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {showUploadPanel ? "Close Uploader" : "Upload Document"}
        </button>
      </div>

      {/* Upload / New Version Panel */}
      {showUploadPanel && (
        <form
          onSubmit={handleUploadSubmit}
          className="elevation-1 rounded-[8px] border border-[#C7D2FE] bg-[#FFFFFF] p-5 space-y-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5 dark:border-slate-800">
            <div>
              <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                {targetDocId
                  ? `Upload New Version for "${title}"`
                  : "Upload Career Document"}
              </h2>
              <p className="text-[#64748B]">
                Supported file formats: PDF, PNG, JPEG, WebP, DOCX, TXT, and Markdown (.md) up to 10 MB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Document Category *
              </label>
              <select
                disabled={Boolean(targetDocId)}
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DocumentCategory)
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="doc-title"
                className="block font-semibold text-[#334155] dark:text-slate-300"
              >
                Document Title *
              </label>
              <input
                id="doc-title"
                type="text"
                required
                disabled={Boolean(targetDocId)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Master CV - Senior Backend Engineer"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="doc-version-label"
                className="block font-semibold text-[#334155] dark:text-slate-300"
              >
                Version Label *
              </label>
              <input
                id="doc-version-label"
                type="text"
                required
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="v1.0 (Fintech Tailored)"
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="doc-file"
                className="block font-semibold text-[#334155] dark:text-slate-300"
              >
                Attach File (PDF / Image / DOCX / TXT / MD)
              </label>
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md"
                className="mt-1 block w-full rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Associate with Application (Optional)
              </label>
              <select
                value={linkAppId}
                onChange={(e) => setLinkAppId(e.target.value)}
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Do not link yet</option>
                {data.applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code}: {a.jobTitle} at {a.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Attachment Role
              </label>
              <select
                value={linkRole}
                onChange={(e) =>
                  setLinkRole(
                    e.target.value as "cv" | "cover_letter" | "other",
                  )
                }
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="cv">CV Version Used</option>
                <option value="cover_letter">Cover Letter Version</option>
                <option value="other">Supporting / Offer Document</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Document Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role focus or summary..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#334155] dark:text-slate-300">
                Version Changelog / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What changed in this version..."
                className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="btn-secondary h-9 px-3 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary h-9 px-4 text-xs disabled:opacity-50"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Save Document Version"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Pills */}
      <div className="space-y-3">
        <div className="elevation-1 flex flex-wrap items-center gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents by title, version label, or filename..."
              className="h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] pr-3 pl-9 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <span className="font-mono text-xs text-[#64748B] tabular-nums">
            {filteredDocs.length} document(s)
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              categoryFilter === "all"
                ? "bg-[#204CD3] text-white"
                : "border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            All Categories
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                categoryFilter === cat
                  ? "bg-[#204CD3] text-white"
                  : "border border-[#E2E8F0] bg-[#FFFFFF] text-[#334155] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {DOCUMENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Document Cards */}
      {filteredDocs.length === 0 ? (
        <div className="elevation-1 flex flex-col items-center justify-center rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileText className="h-8 w-8 text-[#64748B]" />
          <p className="mt-2 text-title-md text-[#0F172A] dark:text-slate-100">
            No career documents in this category
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Upload your Master CV, Customized CVs, Cover Letters, Portfolios, or Certificates to track versions used per application.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              data-testid={`doc-card-${doc.category}`}
              className="elevation-2 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-[2px] text-[11px] font-semibold text-[#1D4ED8]">
                      {
                        DOCUMENT_CATEGORY_LABELS[
                          doc.category as DocumentCategory
                        ]
                      }
                    </span>
                    <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                      {doc.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-[2px] font-mono text-[11px] font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
                      <Layers className="h-3 w-3" />
                      {doc.versions.length} version(s)
                    </span>
                    {doc.isSample && <SampleBadge />}
                  </div>
                  {doc.description && (
                    <p className="text-[#64748B]">{doc.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openNewVersionModal(doc)}
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New Version
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDeleteDocument(doc)}
                    className="rounded-[4px] border border-[#FECDD3] bg-[#FFF1F2] p-1.5 text-[#BE123C] hover:bg-rose-100"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Versions Table / List */}
              <div className="divide-y divide-[#E2E8F0] rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                {doc.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex flex-col justify-between gap-3 p-3.5 lg:flex-row lg:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[4px] bg-[#204CD3] px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                          v{ver.versionNo}
                        </span>
                        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {ver.label}
                        </span>
                        {ver.filename && (
                          <span className="font-mono text-[11px] text-[#334155] dark:text-slate-300">
                            ({ver.filename})
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                          {formatBytes(ver.sizeBytes)}
                        </span>
                        {ver.sha256 && (
                          <span
                            title={`SHA-256: ${ver.sha256}`}
                            className="font-mono text-[10px] text-[#64748B]"
                          >
                            sha256:{ver.sha256.slice(0, 10)}
                          </span>
                        )}
                        <span className="text-[11px] text-[#64748B] tabular-nums">
                          Uploaded {formatDateTime(ver.createdAt)}
                        </span>
                      </div>

                      {ver.notes && (
                        <p className="text-[11px] text-[#64748B]">
                          Note: {ver.notes}
                        </p>
                      )}

                      {/* Associated Applications */}
                      {ver.linkedApplications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-[#64748B]">
                            Used in:
                          </span>
                          {ver.linkedApplications.map((la) => (
                            <span
                              key={la.link.id}
                              className="inline-flex items-center gap-1 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]"
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
                                title="Remove association"
                                className="ml-0.5 text-[#64748B] hover:text-[#BE123C]"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Associate with Application Dropdown */}
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5 text-[#64748B]" />
                        <select
                          aria-label={`Associate ${ver.label} with application`}
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
                          className="h-8 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="">+ Link to Application...</option>
                          {data.applications.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code}: {a.jobTitle} at {a.companyName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {ver.storageKey && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewVersion({
                                version: ver,
                                docTitle: doc.title,
                              })
                            }
                            className="btn-secondary h-8 px-2.5 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </button>

                          <a
                            href={`/api/documents/versions/${ver.id}/file?download=1`}
                            download
                            className="btn-secondary h-8 px-2.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Document Preview Modal */}
      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/40 p-4">
          <div className="elevation-4 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
                  {previewVersion.docTitle} ({previewVersion.version.label})
                </h3>
                <p className="font-mono text-[11px] text-[#64748B]">
                  {previewVersion.version.filename} ·{" "}
                  {previewVersion.version.mimeType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/documents/versions/${previewVersion.version.id}/file?download=1`}
                  download
                  className="btn-secondary h-8 px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewVersion(null)}
                  className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#F8FAFC] p-4 dark:bg-slate-950">
              {previewVersion.version.mimeType?.startsWith("image/") ? (
                <div className="flex h-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/documents/versions/${previewVersion.version.id}/file`}
                    alt={previewVersion.docTitle}
                    className="max-h-full max-w-full rounded-[4px] object-contain"
                  />
                </div>
              ) : (
                <iframe
                  title={`Preview ${previewVersion.docTitle}`}
                  src={`/api/documents/versions/${previewVersion.version.id}/file`}
                  className="h-full w-full rounded-[4px] border border-[#E2E8F0] bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
