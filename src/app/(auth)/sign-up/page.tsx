"use client";

import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, FormField, Input } from "@/components/ui";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message || "Could not create account.");
      return;
    }
    toast.success("Account created. Welcome to Career Application Tracker!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      {/* Left Executive Credentials Pane */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 font-display text-sm font-bold text-white backdrop-blur">
            CT
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Trackr
          </span>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-on-soft">
            ATS
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Precision Personal ATS
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Built for deliberate career momentum.
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            Establish your personal command center for opportunity discovery,
            interview scheduling, resume versioning, and pipeline analytics.
          </p>

          <div className="space-y-3 pt-2 text-xs text-white/95">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Zero-glare executive workspace with Kanban & Table views</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Automated follow-up cadence & email classifier</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Full exportability & user-owned data controls</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/75">
          Executive Precision ATS · Personal Career Command Center
        </p>
      </div>

      {/* Right Floating Form Pane */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card elevation="interactive" padding="lg" className="w-full max-w-md p-8">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary font-display text-xs font-bold text-white shadow-xs">
                CT
              </div>
              <span className="font-display text-base font-bold text-foreground">
                Trackr
              </span>
              <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary-on-soft">
                ATS
              </span>
            </div>
            <h1 className="text-page-title text-foreground">
              Create your Career Tracker account
            </h1>
            <p className="mt-1 text-caption text-muted-foreground">
              Executive Precision HR recruitment pipeline and career analytics
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive-border bg-destructive-soft px-3.5 py-2.5 text-xs font-medium text-destructive-on-soft"
              >
                {error}
              </div>
            )}

            <FormField label="Full name" htmlFor="name" required>
              <Input
                id="name"
                type="text"
                inputSize="xl"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Candidate"
              />
            </FormField>

            <FormField label="Email address" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                inputSize="xl"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>

            <FormField
              label="Password (minimum 10 characters)"
              htmlFor="password"
              required
            >
              <Input
                id="password"
                type="password"
                inputSize="xl"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="xl"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-caption text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-primary-text hover:underline"
            >
              Sign in
            </Link>
          </p>

          <div className="mt-6 rounded-xl border border-border bg-surface-subtle p-4 text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary-text" />
              <span>Career Data Privacy (UU PDP)</span>
            </div>
            <p>
              Job search data (CVs, salary expectations, HR correspondence,
              recruiter contact details) is personal and sensitive.
            </p>
            <p className="mt-1.5">
              This application is built with a privacy-first approach
              referencing Indonesia&apos;s Law No. 27 of 2022 on Personal Data
              Protection (UU PDP), supporting strict per-user data isolation,
              zero-setup local storage with PGlite, no job portal scraping, no
              automated emails sent on the user&apos;s behalf, and full rights
              to export data (JSON/CSV) and permanently delete your account.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
