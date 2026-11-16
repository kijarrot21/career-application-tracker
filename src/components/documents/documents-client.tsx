"use client";

import {
  ChevronRight,
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
      {/* Header matching Stitch HTML 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span>Career Assets</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-[#006a42] dark:text-[#69dca0]">
              Vault & Version Control
            </span>
          </div>
          <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
            Career Document Repository & Version Control
          </h1>
          <p className="mt-1 text-body-sm text-[#3f674f] dark:text-[#a5d1b4]">
            Upload and version Master CVs, Customized CVs, Cover Letters,
            Portfolios, Certificates, Transcripts, and Offers.
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
          className="btn-primary h-10 px-4 text-xs"
        >
          <Plus className="h-4 w-4" />
          {showUploadPanel ? "Close Uploader" : "Upload Document"}
        </button>
      </div>

      {/* Upload / New Version Panel */}
      {showUploadPanel && (
        <form
          onSubmit={handleUploadSubmit}
          className="elevation-1 space-y-4 rounded-2xl border border-[#a5d1b4] bg-[#ffffff] p-6 dark:border-[#2d3d33] dark:bg-[#111a15]"
        >
          <div className="flex items-center justify-between border-b border-[#e3eae3] pb-3 dark:border-[#24332a]">
            <div>
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                {targetDocId
                  ? `Upload New Version for "${title}"`
                  : "Upload Career Document"}
              </h2>
              <p className="text-[#3f674f] dark:text-[#a5d1b4]">
                Supported file formats: PDF, PNG, JPEG, WebP, DOCX, TXT, and
                Markdown (.md) up to 10 MB.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="rounded-lg p-1.5 text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#b7c6ba]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Document Category *
              </label>
              <select
                disabled={Boolean(targetDocId)}
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DocumentCategory)
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
                className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
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
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>

            <div>
              <label
                htmlFor="doc-version-label"
                className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
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
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="doc-file"
                className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
              >
                Attach File (PDF / Image / DOCX / TXT / MD)
              </label>
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md"
                className="mt-1 block w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 py-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Associate with Application (Optional)
              </label>
              <select
                value={linkAppId}
                onChange={(e) => setLinkAppId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Attachment Role
              </label>
              <select
                value={linkRole}
                onChange={(e) =>
                  setLinkRole(
                    e.target.value as "cv" | "cover_letter" | "other",
                  )
                }
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              >
                <option value="cv">CV Version Used</option>
                <option value="cover_letter">Cover Letter Version</option>
                <option value="other">Supporting / Offer Document</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Document Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role focus or summary..."
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Version Changelog / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What changed in this version..."
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="btn-secondary h-10 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary h-10 px-4 text-xs disabled:opacity-50"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Save Document Version"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Pills */}
      <div className="space-y-3">
        <div className="elevation-1 flex flex-wrap items-center gap-3 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-3.5 dark:border-[#24332a] dark:bg-[#111a15]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#3f674f] dark:text-[#a5d1b4]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents by title, version label, or filename..."
              className="h-10 w-full rounded-xl border border-transparent bg-[#eff5ee] pr-3 pl-9 text-xs text-[#171d19] placeholder:text-[#3f674f] focus:border-[#006a42] focus:bg-[#ffffff] dark:bg-[#17231c] dark:text-[#ecf3eb] dark:placeholder:text-[#a5d1b4]"
            />
          </div>
          <span className="rounded-full bg-[#eff5ee] px-3 py-1 font-mono text-xs font-semibold text-[#3f674f] tabular-nums dark:bg-[#17231c] dark:text-[#a5d1b4]">
            {filteredDocs.length} document(s)
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              categoryFilter === "all"
                ? "bg-[#006a42] text-white shadow-sm"
                : "border border-[#bdcabf]/50 bg-[#ffffff] text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:border-[#24332a] dark:bg-[#111a15] dark:text-[#b7c6ba]"
            }`}
          >
            All Categories
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                categoryFilter === cat
                  ? "bg-[#006a42] text-white shadow-sm"
                  : "border border-[#bdcabf]/50 bg-[#ffffff] text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:border-[#24332a] dark:bg-[#111a15] dark:text-[#b7c6ba]"
              }`}
            >
              {DOCUMENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Document Cards matching Stitch HTML 3 */}
      {filteredDocs.length === 0 ? (
        <div className="elevation-1 flex flex-col items-center justify-center rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] py-14 text-center dark:border-[#24332a] dark:bg-[#111a15]">
          <FileText className="h-8 w-8 text-[#3f674f]" />
          <p className="mt-2 text-title-md text-[#171d19] dark:text-[#ecf3eb]">
            No career documents in this category
          </p>
          <p className="mt-1 text-xs text-[#3f674f]">
            Upload your Master CV, Customized CVs, Cover Letters, Portfolios, or
            Certificates to track versions used per application.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              data-testid={`doc-card-${doc.category}`}
              className="elevation-2 group relative space-y-4 overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]"
            >
              <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-[#86f9ba]/20 blur-xl transition-transform group-hover:scale-125 dark:bg-[#006a42]/15" />

              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c0edcf] text-[#006a42] shadow-2xs dark:bg-[#005232] dark:text-[#86f9ba]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#c0edcf] px-2.5 py-0.5 text-[11px] font-bold text-[#005232] dark:bg-[#005232] dark:text-[#86f9ba]">
                        {
                          DOCUMENT_CATEGORY_LABELS[
                            doc.category as DocumentCategory
                          ]
                        }
                      </span>
                      <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                        {doc.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eff5ee] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#3e4a41] tabular-nums dark:bg-[#17231c] dark:text-[#b7c6ba]">
                        <Layers className="h-3 w-3" />
                        {doc.versions.length} version(s)
                      </span>
                      {doc.isSample && <SampleBadge />}
                    </div>
                    {doc.description && (
                      <p className="text-[#3f674f] dark:text-[#a5d1b4]">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center gap-2">
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
                    className="btn-destructive h-8 w-8 p-0"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Versions Table / List */}
              <div className="divide-y divide-[#dde4dd] rounded-xl bg-[#eff5ee]/80 dark:divide-[#24332a] dark:bg-[#17231c]">
                {doc.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex flex-col justify-between gap-3 p-4 lg:flex-row lg:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-[#006a42] px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                          v{ver.versionNo}
                        </span>
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {ver.label}
                        </span>
                        {ver.filename && (
                          <span className="font-mono text-[11px] text-[#3e4a41] dark:text-[#b7c6ba]">
                            ({ver.filename})
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                          {formatBytes(ver.sizeBytes)}
                        </span>
                        {ver.sha256 && (
                          <span
                            title={`SHA-256: ${ver.sha256}`}
                            className="font-mono text-[10px] text-[#6e7a71]"
                          >
                            sha256:{ver.sha256.slice(0, 10)}
                          </span>
                        )}
                        <span className="text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                          Uploaded {formatDateTime(ver.createdAt)}
                        </span>
                      </div>

                      {ver.notes && (
                        <p className="text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                          Note: {ver.notes}
                        </p>
                      )}

                      {/* Associated Applications */}
                      {ver.linkedApplications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                            Used in:
                          </span>
                          {ver.linkedApplications.map((la) => (
                            <span
                              key={la.link.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[#c0edcf] px-2.5 py-0.5 text-[11px] font-semibold text-[#005232] dark:bg-[#005232] dark:text-[#86f9ba]"
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
                                className="ml-0.5 text-[#005232] hover:text-[#93000a]"
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
                        <Link2 className="h-3.5 w-3.5 text-[#3f674f]" />
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
                          className="h-8 rounded-xl border border-[#bdcabf]/60 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#111a15] dark:text-[#ecf3eb]"
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
                            className="btn-secondary h-8 bg-[#ffffff] px-3 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </button>

                          <a
                            href={`/api/documents/versions/${ver.id}/file?download=1`}
                            download
                            className="btn-secondary h-8 bg-[#ffffff] px-3 text-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171d19]/45 p-4 backdrop-blur-[4px]">
          <div className="elevation-4 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#bdcabf]/60 bg-[#ffffff] dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="flex items-center justify-between border-b border-[#e3eae3] px-5 py-3.5 dark:border-[#24332a]">
              <div>
                <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                  {previewVersion.docTitle} ({previewVersion.version.label})
                </h3>
                <p className="font-mono text-[11px] text-[#3f674f]">
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
                  className="rounded-lg p-1.5 text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#eff5ee] p-4 dark:bg-[#0b120e]">
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
                  className="h-full w-full rounded-xl border border-[#bdcabf]/50 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
