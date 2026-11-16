"use client";

import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Link2,
  Link2Off,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SampleBadge, StageBadge } from "@/components/ui/badges";
import {
  COMM_CHANNEL_LABELS,
  COMM_CHANNELS,
  COMM_DIRECTION_LABELS,
  COMM_DIRECTIONS,
  EMAIL_CLASSIFICATION_LABELS,
  EMAIL_CLASSIFICATIONS,
  type CommChannel,
  type CommDirection,
  type EmailClassification,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  confirmEmailStageTransitionAction,
  createRecruiterContactAction,
  deleteRecruiterContactAction,
  disconnectEmailAccountAction,
  ingestEmailMessageAction,
  linkEmailToApplicationAction,
  syncEmailAccountAction,
} from "@/server/actions/emails";
import type { getEmailCenterData } from "@/server/queries/emails";

type EmailCenterData = Awaited<ReturnType<typeof getEmailCenterData>>;

export function EmailCenterClient({
  data,
  oauthError,
  connectedProvider,
}: {
  data: EmailCenterData;
  oauthError?: string | null;
  connectedProvider?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"inbox" | "analyzer" | "recruiters">(
    "inbox",
  );
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<EmailClassification | "all">(
    "all",
  );
  const [linkFilter, setLinkFilter] = useState<
    "all" | "suggested" | "confirmed" | "unlinked"
  >("all");

  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [snippet, setSnippet] = useState("");
  const [channel, setChannel] = useState<CommChannel>("email");
  const [direction, setDirection] = useState<CommDirection>("inbound");
  const [explicitAppId, setExplicitAppId] = useState("");

  const [recName, setRecName] = useState("");
  const [recTitle, setRecTitle] = useState("");
  const [recCompany, setRecCompany] = useState("");
  const [recEmail, setRecEmail] = useState("");
  const [recPhone, setRecPhone] = useState("");

  const filteredEmails = data.emails.filter((e) => {
    if (classFilter !== "all" && e.classification !== classFilter) return false;
    if (linkFilter !== "all" && e.linkStatus !== linkFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        e.subject.toLowerCase().includes(q) ||
        (e.sender ?? "").toLowerCase().includes(q) ||
        (e.detectedCompany ?? "").toLowerCase().includes(q) ||
        (e.detectedPosition ?? "").toLowerCase().includes(q) ||
        (e.snippet ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  function handleAnalyzeAndSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await ingestEmailMessageAction({
          source: "manual",
          channel,
          direction,
          sender: sender || null,
          subject,
          snippet: snippet || null,
          explicitApplicationId: explicitAppId || null,
        });
        setSender("");
        setSubject("");
        setSnippet("");
        setExplicitAppId("");
        setActiveTab("inbox");
        toast.success(
          `Classified as "${
            EMAIL_CLASSIFICATION_LABELS[res.email.classification]
          }" (${res.email.confidence ?? 0}% confidence).`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not analyze email",
        );
      }
    });
  }

  function handleSyncAccount(accountId: string) {
    startTransition(async () => {
      try {
        const res = await syncEmailAccountAction(accountId);
        toast.success(
          `Sync complete: ${res.importedCount} new recruitment emails imported (${res.skippedDuplicates} duplicates skipped).`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Email sync failed");
      }
    });
  }

  function handleDisconnectAccount(accountId: string) {
    startTransition(async () => {
      try {
        await disconnectEmailAccountAction(accountId);
        toast.success("Email account disconnected.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Disconnect failed");
      }
    });
  }

  function handleLinkApplication(
    emailId: string,
    applicationId: string | null,
  ) {
    startTransition(async () => {
      try {
        await linkEmailToApplicationAction({
          emailId,
          applicationId,
          linkStatus: applicationId ? "confirmed" : "unlinked",
        });
        toast.success(
          applicationId
            ? "Email linked to application."
            : "Email unlinked from application.",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update link");
      }
    });
  }

  function handleConfirmSuggestedStage(params: {
    emailId: string;
    applicationId: string;
    toStageId: string;
    stageName: string;
  }) {
    startTransition(async () => {
      try {
        await confirmEmailStageTransitionAction({
          emailId: params.emailId,
          applicationId: params.applicationId,
          toStageId: params.toStageId,
        });
        toast.success(`Application moved to ${params.stageName}.`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update stage",
        );
      }
    });
  }

  function handleAddRecruiter(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createRecruiterContactAction({
          name: recName,
          title: recTitle || null,
          companyName: recCompany || null,
          email: recEmail || null,
          phone: recPhone || null,
        });
        setRecName("");
        setRecTitle("");
        setRecCompany("");
        setRecEmail("");
        setRecPhone("");
        toast.success("Recruiter contact added.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add contact");
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
            Recruitment Email Center & Correspondence Classifier
          </h1>
          <p className="mt-0.5 text-body-sm text-[#3f674f]">
            Connect Gmail or Outlook via read-only OAuth 2.0, classify recruitment emails, and confirm application stage updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="btn-secondary h-10 px-4 text-xs"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {showSetupGuide ? "Hide OAuth Setup Guide" : "OAuth 2.0 Setup Guide"}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analyzer")}
            className="btn-primary h-10 px-4 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Analyze / Log Email
          </button>
        </div>
      </div>

      {oauthError && (
        <div className="rounded-2xl border border-[#ba1a1a]/25 bg-[#ffdad6]/70 px-4 py-2.5 text-[#93000a] dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
          OAuth connection notice: {oauthError}
        </div>
      )}

      {connectedProvider && (
        <div className="rounded-2xl border border-[#86f9ba] bg-[#c0edcf] px-4 py-2.5 text-[#005232] dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          Connected {connectedProvider.toUpperCase()} account with read-only OAuth 2.0 permissions.
        </div>
      )}

      {/* OAuth 2.0 Connection Bar */}
      <div className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-4 space-y-3 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#006a42]" />
            <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
              Email Account Connections (Read-Only OAuth 2.0)
            </span>
            <span className="text-[#3f674f]">
              Never sends, modifies, or deletes emails. Refresh tokens are encrypted with AES-256-GCM.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.oauthStatus.gmailConfigured ? (
              <a
                href="/api/email/oauth/gmail/start"
                className="btn-secondary h-10 px-4 text-xs"
              >
                <Mail className="h-3.5 w-3.5 text-[#ba1a1a]" />
                Connect Gmail
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-[#E2E8F0] px-3.5 font-semibold text-[#727973] transition-colors hover:border-[#08945F] hover:text-[#08945F] dark:border-[#2d3d33] dark:text-[#b7c6ba]"
              >
                <Mail className="h-3.5 w-3.5" />
                Configure Gmail OAuth
              </button>
            )}

            {data.oauthStatus.outlookConfigured ? (
              <a
                href="/api/email/oauth/outlook/start"
                className="btn-secondary h-10 px-4 text-xs"
              >
                <Mail className="h-3.5 w-3.5 text-[#006a42]" />
                Connect Outlook
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-[#E2E8F0] px-3.5 font-semibold text-[#727973] transition-colors hover:border-[#08945F] hover:text-[#08945F] dark:border-[#2d3d33] dark:text-[#b7c6ba]"
              >
                <Mail className="h-3.5 w-3.5" />
                Configure Outlook OAuth
              </button>
            )}
          </div>
        </div>

        {data.accounts.length > 0 && (
          <div className="divide-y divide-[#dde4dd]/70 border-t border-[#bdcabf]/50 pt-2 dark:divide-[#24332a] dark:border-[#24332a]">
            {data.accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#c0edcf]/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#005232] dark:bg-[#006a42]/20 dark:text-[#86f9ba]">
                    {acc.provider}
                  </span>
                  <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                    {acc.email}
                  </span>
                  <span className="text-[#3f674f] tabular-nums">
                    Last synced:{" "}
                    {acc.lastSyncedAt
                      ? formatDateTime(acc.lastSyncedAt)
                      : "Never"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSyncAccount(acc.id)}
                    className="btn-secondary h-8 px-2.5 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Sync Now
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDisconnectAccount(acc.id)}
                    className="btn-destructive h-8 px-3 text-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showSetupGuide && (
          <div className="rounded-2xl border border-[#a5d1b4] bg-[#c0edcf]/60/60 p-4 space-y-2.5 text-xs dark:border-[#2d3d33] dark:bg-[#17231c]">
            <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
              How to Configure Gmail & Microsoft Outlook OAuth 2.0 Credentials
            </h3>
            <p className="text-[#3e4a41] dark:text-[#b7c6ba]">
              Until you add OAuth credentials to <code>.env.local</code>, use the <strong>Analyze / Log Email</strong> tab to classify and link recruitment correspondence with the exact same classification engine.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#bdcabf]/50 bg-[#ffffff] p-3 space-y-1 dark:border-[#24332a] dark:bg-[#111a15]">
                <p className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                  1. Google Cloud (Gmail API)
                </p>
                <p className="text-[#3f674f]">
                  Enable the Gmail API in Google Cloud Console and create an OAuth 2.0 Web Client with Redirect URI:
                </p>
                <code className="block rounded-xl bg-[#eff5ee] p-1.5 font-mono text-[11px] text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]">
                  {data.oauthStatus.gmailRedirectUri}
                </code>
                <p className="text-[#3f674f]">
                  Scope: <code>https://www.googleapis.com/auth/gmail.readonly</code>
                </p>
                <p className="text-[#3f674f]">
                  Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code>.
                </p>
              </div>

              <div className="rounded-xl border border-[#bdcabf]/50 bg-[#ffffff] p-3 space-y-1 dark:border-[#24332a] dark:bg-[#111a15]">
                <p className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                  2. Microsoft Entra ID (Outlook / Graph)
                </p>
                <p className="text-[#3f674f]">
                  Register an application in Microsoft Entra admin center with Web Redirect URI:
                </p>
                <code className="block rounded-xl bg-[#eff5ee] p-1.5 font-mono text-[11px] text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]">
                  {data.oauthStatus.outlookRedirectUri}
                </code>
                <p className="text-[#3f674f]">
                  Delegated Scopes: <code>Mail.Read User.Read offline_access</code>
                </p>
                <p className="text-[#3f674f]">
                  Set <code>MICROSOFT_CLIENT_ID</code> and <code>MICROSOFT_CLIENT_SECRET</code> in <code>.env.local</code>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#bdcabf]/50 dark:border-[#24332a]">
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "inbox"
              ? "border-[#006a42] text-[#006a42] dark:border-[#69dca0] dark:text-[#86f9ba]"
              : "border-transparent text-[#3f674f] hover:text-[#171d19] dark:hover:text-slate-200"
          }`}
        >
          Recruitment Inbox ({data.emails.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("analyzer")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "analyzer"
              ? "border-[#006a42] text-[#006a42] dark:border-[#69dca0] dark:text-[#86f9ba]"
              : "border-transparent text-[#3f674f] hover:text-[#171d19] dark:hover:text-slate-200"
          }`}
        >
          Analyze / Log Email
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recruiters")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "recruiters"
              ? "border-[#006a42] text-[#006a42] dark:border-[#69dca0] dark:text-[#86f9ba]"
              : "border-transparent text-[#3f674f] hover:text-[#171d19] dark:hover:text-slate-200"
          }`}
        >
          Recruiter Contacts ({data.recruiterDirectory.length})
        </button>
      </div>

      {/* TAB 1: Classified Recruitment Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          <div className="elevation-1 grid grid-cols-1 gap-2.5 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-3.5 sm:grid-cols-4 dark:border-[#24332a] dark:bg-[#111a15]">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#6e7a71]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email subject, sender, company, or snippet..."
                className="h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] pr-3 pl-9 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>

            <select
              aria-label="Filter by email classification"
              value={classFilter}
              onChange={(e) =>
                setClassFilter(e.target.value as EmailClassification | "all")
              }
              className="h-10 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              <option value="all">All Classifications</option>
              {EMAIL_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {EMAIL_CLASSIFICATION_LABELS[c]}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by link status"
              value={linkFilter}
              onChange={(e) =>
                setLinkFilter(
                  e.target.value as
                    | "all"
                    | "suggested"
                    | "confirmed"
                    | "unlinked",
                )
              }
              className="h-10 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              <option value="all">All Link Statuses</option>
              <option value="suggested">Suggested Link (Needs Review)</option>
              <option value="confirmed">Confirmed Link</option>
              <option value="unlinked">Unlinked</option>
            </select>
          </div>

          {filteredEmails.length === 0 ? (
            <div className="elevation-1 flex flex-col items-center justify-center rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] py-12 text-center dark:border-[#24332a] dark:bg-[#111a15]">
              <Mail className="h-7 w-7 text-[#3f674f]" />
              <p className="mt-2 text-title-md text-[#171d19] dark:text-[#ecf3eb]">
                No recruitment correspondence matches your filters
              </p>
              <p className="mt-1 text-xs text-[#3f674f]">
                Click &ldquo;Analyze / Log Email&rdquo; to classify a recruitment email and link it to an application.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  data-testid={`email-card-${email.classification}`}
                  className="elevation-2 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-4 space-y-3 dark:border-[#24332a] dark:bg-[#111a15]"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#a5d1b4] bg-[#c0edcf]/60 px-2.5 py-[2px] text-[11px] font-semibold text-[#005232] dark:border-[#006a42]/40 dark:bg-[#006a42]/20 dark:text-[#86f9ba]">
                          {
                            EMAIL_CLASSIFICATION_LABELS[
                              email.classification as EmailClassification
                            ]
                          }
                        </span>
                        {email.confidence != null && (
                          <span className="font-mono text-[11px] text-[#3f674f] tabular-nums">
                            {email.confidence}% confidence
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.04em] ${
                            email.linkStatus === "suggested"
                              ? "bg-[#ffdead]/60 text-[#5d4211] dark:bg-amber-950 dark:text-amber-300"
                              : email.linkStatus === "confirmed"
                                ? "bg-[#c0edcf] text-[#005232] dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-[#eff5ee] text-[#3f674f] dark:bg-[#1d2b23]"
                          }`}
                        >
                          {email.linkStatus}
                        </span>
                        {email.isSample && <SampleBadge />}
                      </div>

                      <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                        {email.subject}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#3f674f]">
                        {email.sender && <span>From: {email.sender}</span>}
                        <span>
                          {COMM_CHANNEL_LABELS[email.channel as CommChannel]} ·{" "}
                          {
                            COMM_DIRECTION_LABELS[
                              email.direction as CommDirection
                            ]
                          }
                        </span>
                        {email.detectedCompany && (
                          <span>
                            Detected Company:{" "}
                            <strong className="text-[#171d19] dark:text-[#ecf3eb]">
                              {email.detectedCompany}
                            </strong>
                          </span>
                        )}
                        {email.detectedPosition && (
                          <span>
                            Detected Role:{" "}
                            <strong className="text-[#171d19] dark:text-[#ecf3eb]">
                              {email.detectedPosition}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 font-mono text-[11px] text-[#3f674f] tabular-nums">
                      {formatDateTime(email.occurredAt)}
                    </span>
                  </div>

                  {email.snippet && (
                    <p className="rounded-xl bg-[#eff5ee] p-3 whitespace-pre-line text-[#3e4a41] dark:bg-[#17231c] dark:text-[#b7c6ba]">
                      {email.snippet}
                    </p>
                  )}

                  {email.classifierReasons &&
                    email.classifierReasons.length > 0 && (
                      <p className="text-[11px] text-[#3f674f]">
                        Classifier notes: {email.classifierReasons.join(" · ")}
                      </p>
                    )}

                  {/* User-Confirmed Stage Transition Prompt */}
                  {email.linkedApplication && email.suggestedStage && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#a5d1b4] bg-[#c0edcf]/60 px-3.5 py-2.5 dark:border-[#006a42]/40 dark:bg-[#006a42]/15">
                      <div className="flex flex-wrap items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#006a42] dark:text-[#86f9ba]" />
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          Suggested Stage Update for{" "}
                          <span className="font-mono">
                            {email.linkedApplication.code}
                          </span>
                          :
                        </span>
                        <StageBadge
                          name={email.linkedApplication.currentStageName}
                          color={email.linkedApplication.currentStageColor}
                        />
                        <ArrowRight className="h-3.5 w-3.5 text-[#3f674f]" />
                        <StageBadge
                          name={email.suggestedStage.name}
                          color={email.suggestedStage.color}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleConfirmSuggestedStage({
                            emailId: email.id,
                            applicationId: email.linkedApplication!.id,
                            toStageId: email.suggestedStage!.id,
                            stageName: email.suggestedStage!.name,
                          })
                        }
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Stage Update
                      </button>
                    </div>
                  )}

                  {/* Manual Link / Unlink Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#bdcabf]/50 pt-2.5 dark:border-[#24332a]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-[#3f674f]" />
                      <span className="text-[#3f674f]">Linked Application:</span>
                      <select
                        aria-label={`Link application for ${email.subject}`}
                        disabled={isPending}
                        value={email.applicationId ?? ""}
                        onChange={(e) =>
                          handleLinkApplication(
                            email.id,
                            e.target.value || null,
                          )
                        }
                        className="h-8 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2 text-xs font-medium text-[#171d19] dark:border-[#2d3d33] dark:bg-[#1d2b23] dark:text-[#ecf3eb]"
                      >
                        <option value="">Unlinked (No application)</option>
                        {data.applications.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.code}: {app.jobTitle} at {app.companyName}
                          </option>
                        ))}
                      </select>

                      {email.linkStatus === "suggested" &&
                        email.applicationId && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleLinkApplication(
                                email.id,
                                email.applicationId,
                              )
                            }
                            className="btn-primary h-8 px-3 text-[11px]"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Confirm Suggested Link
                          </button>
                        )}

                      {email.applicationId && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleLinkApplication(email.id, null)}
                          className="btn-secondary h-8 px-2.5 text-[11px]"
                        >
                          <Link2Off className="h-3 w-3" />
                          Unlink
                        </button>
                      )}
                    </div>

                    {email.linkedApplication && (
                      <Link
                        href={`/applications/${email.linkedApplication.id}?tab=communications`}
                        className="font-semibold text-[#006a42] hover:underline dark:text-[#86f9ba]"
                      >
                        Open {email.linkedApplication.code} &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Email Analyzer & Manual Importer */}
      {activeTab === "analyzer" && (
        <form
          onSubmit={handleAnalyzeAndSave}
          className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 space-y-4 dark:border-[#24332a] dark:bg-[#111a15]"
        >
          <div>
            <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
              Analyze & Import Recruitment Email
            </h2>
            <p className="text-[#3f674f]">
              Paste any email subject and message body. The classifier will detect whether it is an Application Confirmation, CV Screening, Interview Invitation, Assessment Invitation, Rejection, or Job Offer, extract the company/position, and match it to your applications.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Sender Name / Email
              </label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Talent Acquisition <careers@company.com>"
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Channel & Direction
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as CommChannel)}
                  className="h-10 flex-1 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                >
                  {COMM_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {COMM_CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
                <select
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as CommDirection)
                  }
                  className="h-10 flex-1 rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                >
                  {COMM_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {COMM_DIRECTION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Link to Application (Optional, leave blank to auto-match)
              </label>
              <select
                value={explicitAppId}
                onChange={(e) => setExplicitAppId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
              >
                <option value="">Auto-detect matching application</option>
                {data.applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.code}: {app.jobTitle} at {app.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="analyzer-subject"
              className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
            >
              Email Subject *
            </label>
            <input
              id="analyzer-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Interview Invitation for Staff Full-Stack Engineer at PT GoTo"
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
            />
          </div>

          <div>
            <label
              htmlFor="analyzer-snippet"
              className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
            >
              Email Body / Excerpt
            </label>
            <textarea
              id="analyzer-snippet"
              rows={5}
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
              placeholder="Paste the email content here (e.g., We would like to invite you to an HR interview on Thursday at 10:00 WIB)..."
              className="mt-1 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] p-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary h-10 px-4 text-xs disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isPending ? "Analyzing..." : "Classify & Save Email"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Recruiter Contact Directory */}
      {activeTab === "recruiters" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 space-y-3 dark:border-[#24332a] dark:bg-[#111a15]">
              <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Recruiter & Talent Acquisition Contact History
              </h2>

              {data.recruiterDirectory.length === 0 ? (
                <p className="py-6 text-[#3f674f]">
                  No recruiter contacts recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.recruiterDirectory.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#bdcabf]/50 bg-[#eff5ee] p-3.5 dark:border-[#24332a] dark:bg-[#17231c]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-[#006a42]" />
                          <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                            {rec.name}
                          </span>
                          {rec.title && (
                            <span className="text-[#3f674f]">· {rec.title}</span>
                          )}
                          {rec.companyName && (
                            <span className="rounded-full bg-[#c0edcf]/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#005232] dark:bg-[#1d2b23] dark:text-[#b7c6ba]">
                              {rec.companyName}
                            </span>
                          )}
                          {rec.isSample && <SampleBadge />}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-[#3f674f] tabular-nums">
                          {rec.email && <span>Email: {rec.email}</span>}
                          {rec.phone && <span>Phone: {rec.phone}</span>}
                          <span>
                            Correspondence count:{" "}
                            <strong>{rec.interactionsCount}</strong>
                          </span>
                          {rec.lastContactedAt && (
                            <span>
                              Last contact:{" "}
                              {formatDateTime(rec.lastContactedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteRecruiterContactAction(rec.id);
                            toast.success("Contact removed.");
                            router.refresh();
                          })
                        }
                        className="btn-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleAddRecruiter}
            className="elevation-1 rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-5 space-y-3 lg:col-span-5 dark:border-[#24332a] dark:bg-[#111a15]"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#006a42]" />
              <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
                Add Recruiter Contact
              </h3>
            </div>

            <div>
              <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                Recruiter Name *
              </label>
              <input
                type="text"
                required
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="Nadia Putri"
                className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                  Company
                </label>
                <input
                  type="text"
                  value={recCompany}
                  onChange={(e) => setRecCompany(e.target.value)}
                  placeholder="PT GoTo"
                  className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                  Role / Title
                </label>
                <input
                  type="text"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="Technical Recruiter"
                  className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                  Email
                </label>
                <input
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  placeholder="nadia@company.com"
                  className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="+62..."
                  className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#ffffff] px-2.5 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary h-10 w-full px-4 text-xs disabled:opacity-50"
            >
              Save Recruiter Contact
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
