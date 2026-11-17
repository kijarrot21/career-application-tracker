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
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  SampleBadge,
  Select,
  StageBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
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

  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [deleteRecruiterId, setDeleteRecruiterId] = useState<string | null>(
    null,
  );

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

  function handleConfirmDisconnect() {
    if (!disconnectId) return;
    startTransition(async () => {
      try {
        await disconnectEmailAccountAction(disconnectId);
        toast.success("Email account disconnected.");
        setDisconnectId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Disconnect failed");
      }
    });
  }

  function handleConfirmDeleteRecruiter() {
    if (!deleteRecruiterId) return;
    startTransition(async () => {
      try {
        await deleteRecruiterContactAction(deleteRecruiterId);
        toast.success("Contact removed.");
        setDeleteRecruiterId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
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
        toast.error(
          err instanceof Error ? err.message : "Could not update link",
        );
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
        toast.error(
          err instanceof Error ? err.message : "Could not add contact",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-xs">
      <PageHeader
        title="Recruitment Email Center & Correspondence Classifier"
        description="Connect Gmail or Outlook via read-only OAuth 2.0, classify recruitment emails, and confirm application stage updates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowSetupGuide(!showSetupGuide)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {showSetupGuide
                ? "Hide OAuth Setup Guide"
                : "OAuth 2.0 Setup Guide"}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setActiveTab("analyzer")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analyze / Log Email
            </Button>
          </div>
        }
      />

      {oauthError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive-border bg-destructive-soft px-4 py-2.5 text-destructive-on-soft"
        >
          OAuth connection notice: {oauthError}
        </div>
      )}

      {connectedProvider && (
        <div className="rounded-xl border border-success-border bg-success-soft px-4 py-2.5 text-success-on-soft">
          Connected {connectedProvider.toUpperCase()} account with read-only
          OAuth 2.0 permissions.
        </div>
      )}

      {/* OAuth 2.0 Connection Bar */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-text" />
            <span className="font-semibold text-foreground">
              Email Account Connections (Read-Only OAuth 2.0)
            </span>
            <span className="text-muted-foreground">
              Never sends, modifies, or deletes emails. Refresh tokens are
              encrypted with AES-256-GCM.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.oauthStatus.gmailConfigured ? (
              <Button variant="secondary" size="lg" asChild>
                <a href="/api/email/oauth/gmail/start">
                  <Mail className="h-3.5 w-3.5 text-destructive" />
                  Connect Gmail
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowSetupGuide(true)}
                className="border-dashed text-muted-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                Configure Gmail OAuth
              </Button>
            )}

            {data.oauthStatus.outlookConfigured ? (
              <Button variant="secondary" size="lg" asChild>
                <a href="/api/email/oauth/outlook/start">
                  <Mail className="h-3.5 w-3.5 text-primary-text" />
                  Connect Outlook
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowSetupGuide(true)}
                className="border-dashed text-muted-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                Configure Outlook OAuth
              </Button>
            )}
          </div>
        </div>

        {data.accounts.length > 0 && (
          <div className="divide-y divide-border-subtle border-t border-border-subtle pt-2">
            {data.accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="primary" className="font-mono uppercase">
                    {acc.provider}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {acc.email}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Last synced:{" "}
                    {acc.lastSyncedAt
                      ? formatDateTime(acc.lastSyncedAt)
                      : "Never"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSyncAccount(acc.id)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setDisconnectId(acc.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showSetupGuide && (
          <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary-soft/50 p-4 text-xs">
            <h3 className="text-section-title text-foreground">
              How to Configure Gmail & Microsoft Outlook OAuth 2.0 Credentials
            </h3>
            <p className="text-muted-foreground">
              Until you add OAuth credentials to <code>.env.local</code>, use
              the <strong>Analyze / Log Email</strong> tab to classify and link
              recruitment correspondence with the exact same classification
              engine.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card padding="sm" className="space-y-1">
                <p className="font-semibold text-foreground">
                  1. Google Cloud (Gmail API)
                </p>
                <p className="text-muted-foreground">
                  Enable the Gmail API in Google Cloud Console and create an
                  OAuth 2.0 Web Client with Redirect URI:
                </p>
                <code className="block rounded-lg bg-surface-subtle p-1.5 font-mono text-[11px] text-foreground">
                  {data.oauthStatus.gmailRedirectUri}
                </code>
                <p className="text-muted-foreground">
                  Scope:{" "}
                  <code>https://www.googleapis.com/auth/gmail.readonly</code>
                </p>
                <p className="text-muted-foreground">
                  Set <code>GOOGLE_CLIENT_ID</code> and{" "}
                  <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code>.
                </p>
              </Card>

              <Card padding="sm" className="space-y-1">
                <p className="font-semibold text-foreground">
                  2. Microsoft Entra ID (Outlook / Graph)
                </p>
                <p className="text-muted-foreground">
                  Register an application in Microsoft Entra admin center with
                  Web Redirect URI:
                </p>
                <code className="block rounded-lg bg-surface-subtle p-1.5 font-mono text-[11px] text-foreground">
                  {data.oauthStatus.outlookRedirectUri}
                </code>
                <p className="text-muted-foreground">
                  Delegated Scopes:{" "}
                  <code>Mail.Read User.Read offline_access</code>
                </p>
                <p className="text-muted-foreground">
                  Set <code>MICROSOFT_CLIENT_ID</code> and{" "}
                  <code>MICROSOFT_CLIENT_SECRET</code> in{" "}
                  <code>.env.local</code>.
                </p>
              </Card>
            </div>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "inbox" | "analyzer" | "recruiters")
        }
      >
        <TabsList>
          <TabsTrigger value="inbox">
            Recruitment Inbox ({data.emails.length})
          </TabsTrigger>
          <TabsTrigger value="analyzer">Analyze / Log Email</TabsTrigger>
          <TabsTrigger value="recruiters">
            Recruiter Contacts ({data.recruiterDirectory.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB 1: Classified Recruitment Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          <Card
            padding="sm"
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-4"
          >
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                inputSize="lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search recruitment emails"
                placeholder="Search email subject, sender, company, or snippet..."
                className="pl-9"
              />
            </div>

            <Select
              aria-label="Filter by email classification"
              selectSize="lg"
              value={classFilter}
              onChange={(e) =>
                setClassFilter(e.target.value as EmailClassification | "all")
              }
            >
              <option value="all">All Classifications</option>
              {EMAIL_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {EMAIL_CLASSIFICATION_LABELS[c]}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by link status"
              selectSize="lg"
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
            >
              <option value="all">All Link Statuses</option>
              <option value="suggested">Suggested Link (Needs Review)</option>
              <option value="confirmed">Confirmed Link</option>
              <option value="unlinked">Unlinked</option>
            </Select>
          </Card>

          {filteredEmails.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No recruitment correspondence matches your filters"
              description='Click "Analyze / Log Email" to classify a recruitment email and link it to an application.'
            />
          ) : (
            <div className="space-y-3">
              {filteredEmails.map((email) => (
                <Card
                  key={email.id}
                  elevation="interactive"
                  padding="sm"
                  data-testid={`email-card-${email.classification}`}
                  className="space-y-3"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="primary">
                          {
                            EMAIL_CLASSIFICATION_LABELS[
                              email.classification as EmailClassification
                            ]
                          }
                        </Badge>
                        {email.confidence != null && (
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            {email.confidence}% confidence
                          </span>
                        )}
                        <Badge
                          variant={
                            email.linkStatus === "suggested"
                              ? "warning"
                              : email.linkStatus === "confirmed"
                                ? "success"
                                : "secondary"
                          }
                          className="font-mono uppercase"
                        >
                          {email.linkStatus}
                        </Badge>
                        {email.isSample && <SampleBadge />}
                      </div>

                      <h3 className="text-section-title text-foreground">
                        {email.subject}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
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
                            <strong className="text-foreground">
                              {email.detectedCompany}
                            </strong>
                          </span>
                        )}
                        {email.detectedPosition && (
                          <span>
                            Detected Role:{" "}
                            <strong className="text-foreground">
                              {email.detectedPosition}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatDateTime(email.occurredAt)}
                    </span>
                  </div>

                  {email.snippet && (
                    <p className="rounded-xl bg-surface-subtle p-3 whitespace-pre-line text-foreground/90">
                      {email.snippet}
                    </p>
                  )}

                  {email.classifierReasons &&
                    email.classifierReasons.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Classifier notes: {email.classifierReasons.join(" · ")}
                      </p>
                    )}

                  {email.linkedApplication && email.suggestedStage && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary-soft px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary-on-soft" />
                        <span className="font-semibold text-foreground">
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
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <StageBadge
                          name={email.suggestedStage.name}
                          color={email.suggestedStage.color}
                        />
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          handleConfirmSuggestedStage({
                            emailId: email.id,
                            applicationId: email.linkedApplication!.id,
                            toStageId: email.suggestedStage!.id,
                            stageName: email.suggestedStage!.name,
                          })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Stage Update
                      </Button>
                    </div>
                  )}

                  {/* Manual Link / Unlink Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Linked Application:
                      </span>
                      <Select
                        aria-label={`Link application for ${email.subject}`}
                        selectSize="sm"
                        wrapperClassName="w-64"
                        disabled={isPending}
                        value={email.applicationId ?? ""}
                        onChange={(e) =>
                          handleLinkApplication(
                            email.id,
                            e.target.value || null,
                          )
                        }
                      >
                        <option value="">Unlinked (No application)</option>
                        {data.applications.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.code}: {app.jobTitle} at {app.companyName}
                          </option>
                        ))}
                      </Select>

                      {email.linkStatus === "suggested" &&
                        email.applicationId && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              handleLinkApplication(
                                email.id,
                                email.applicationId,
                              )
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Confirm Suggested Link
                          </Button>
                        )}

                      {email.applicationId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleLinkApplication(email.id, null)}
                        >
                          <Link2Off className="h-3 w-3" />
                          Unlink
                        </Button>
                      )}
                    </div>

                    {email.linkedApplication && (
                      <Link
                        href={`/applications/${email.linkedApplication.id}?tab=communications`}
                        className="font-semibold text-primary-text hover:underline"
                      >
                        Open {email.linkedApplication.code} &rarr;
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Email Analyzer & Manual Importer */}
      {activeTab === "analyzer" && (
        <Card padding="md">
          <form onSubmit={handleAnalyzeAndSave} className="space-y-4">
            <div>
              <h2 className="text-section-title text-foreground">
                Analyze & Import Recruitment Email
              </h2>
              <p className="text-muted-foreground">
                Paste any email subject and message body. The classifier will
                detect whether it is an Application Confirmation, CV Screening,
                Interview Invitation, Assessment Invitation, Rejection, or Job
                Offer, extract the company/position, and match it to your
                applications.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Sender Name / Email">
                <Input
                  type="text"
                  inputSize="lg"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Talent Acquisition <careers@company.com>"
                />
              </FormField>

              <FormField label="Channel & Direction">
                <div className="flex gap-2">
                  <Select
                    aria-label="Communication channel"
                    selectSize="lg"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CommChannel)}
                  >
                    {COMM_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {COMM_CHANNEL_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Communication direction"
                    selectSize="lg"
                    value={direction}
                    onChange={(e) =>
                      setDirection(e.target.value as CommDirection)
                    }
                  >
                    {COMM_DIRECTIONS.map((d) => (
                      <option key={d} value={d}>
                        {COMM_DIRECTION_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormField>

              <FormField label="Link to Application (Optional, leave blank to auto-match)">
                <Select
                  selectSize="lg"
                  value={explicitAppId}
                  onChange={(e) => setExplicitAppId(e.target.value)}
                >
                  <option value="">Auto-detect matching application</option>
                  {data.applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.code}: {app.jobTitle} at {app.companyName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Email Subject" htmlFor="analyzer-subject" required>
              <Input
                id="analyzer-subject"
                type="text"
                inputSize="lg"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Interview Invitation for Staff Full-Stack Engineer at PT GoTo"
              />
            </FormField>

            <FormField
              label="Email Body / Excerpt"
              htmlFor="analyzer-snippet"
            >
              <Textarea
                id="analyzer-snippet"
                rows={5}
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                placeholder="Paste the email content here (e.g., We would like to invite you to an HR interview on Thursday at 10:00 WIB)..."
              />
            </FormField>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isPending ? "Analyzing..." : "Classify & Save Email"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 3: Recruiter Contact Directory */}
      {activeTab === "recruiters" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <Card padding="md" className="space-y-3">
              <h2 className="text-section-title text-foreground">
                Recruiter & Talent Acquisition Contact History
              </h2>

              {data.recruiterDirectory.length === 0 ? (
                <p className="py-6 text-muted-foreground">
                  No recruiter contacts recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.recruiterDirectory.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-subtle p-3.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-primary-text" />
                          <span className="font-semibold text-foreground">
                            {rec.name}
                          </span>
                          {rec.title && (
                            <span className="text-muted-foreground">
                              · {rec.title}
                            </span>
                          )}
                          {rec.companyName && (
                            <Badge variant="primary">{rec.companyName}</Badge>
                          )}
                          {rec.isSample && <SampleBadge />}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground tabular-nums">
                          {rec.email && <span>Email: {rec.email}</span>}
                          {rec.phone && <span>Phone: {rec.phone}</span>}
                          <span>
                            Correspondence count:{" "}
                            <strong className="text-foreground">
                              {rec.interactionsCount}
                            </strong>
                          </span>
                          {rec.lastContactedAt && (
                            <span>
                              Last contact:{" "}
                              {formatDateTime(rec.lastContactedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={isPending}
                        aria-label={`Delete contact ${rec.name}`}
                        onClick={() => setDeleteRecruiterId(rec.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card padding="md" className="lg:col-span-5">
            <form onSubmit={handleAddRecruiter} className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary-text" />
                <h3 className="text-section-title text-foreground">
                  Add Recruiter Contact
                </h3>
              </div>

              <FormField label="Recruiter Name" required>
                <Input
                  type="text"
                  inputSize="lg"
                  required
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder="Nadia Putri"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Company">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={recCompany}
                    onChange={(e) => setRecCompany(e.target.value)}
                    placeholder="PT GoTo"
                  />
                </FormField>
                <FormField label="Role / Title">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder="Technical Recruiter"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Email">
                  <Input
                    type="email"
                    inputSize="lg"
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="nadia@company.com"
                  />
                </FormField>
                <FormField label="Phone / WhatsApp">
                  <Input
                    type="text"
                    inputSize="lg"
                    value={recPhone}
                    onChange={(e) => setRecPhone(e.target.value)}
                    placeholder="+62..."
                  />
                </FormField>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full"
              >
                Save Recruiter Contact
              </Button>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(disconnectId)}
        onOpenChange={(next) => !next && setDisconnectId(null)}
        title="Disconnect email account?"
        description="Imported messages will remain in your inbox, but future OAuth syncing will stop until reconnected."
        confirmLabel="Disconnect"
        pending={isPending}
        onConfirm={handleConfirmDisconnect}
      />

      <ConfirmDialog
        open={Boolean(deleteRecruiterId)}
        onOpenChange={(next) => !next && setDeleteRecruiterId(null)}
        title="Remove recruiter contact?"
        description="This will remove the recruiter entry from your contact directory."
        confirmLabel="Remove Contact"
        pending={isPending}
        onConfirm={handleConfirmDeleteRecruiter}
      />
    </div>
  );
}
