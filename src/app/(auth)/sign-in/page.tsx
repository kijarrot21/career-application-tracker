"use client";

import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn.email({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message || "Invalid email or password.");
      return;
    }
    toast.success("Signed in.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen bg-[#f4fbf4] text-[#171d19] dark:bg-[#0b120e] dark:text-[#ecf3eb]">
      <div className="pointer-events-none absolute top-0 right-1/4 h-72 w-72 rounded-full bg-[#86f9ba]/25 blur-3xl dark:bg-[#006a42]/15" />

      {/* Left Executive Credentials Pane */}
      <div className="hidden w-1/2 flex-col justify-between bg-[#006a42] p-12 text-white lg:flex dark:bg-[#0b291c]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 font-display text-sm font-bold text-white backdrop-blur">
            CT
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            Trackr
          </span>
          <span className="rounded-full bg-[#86f9ba] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#002111]">
            ATS
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#c0edcf]">
            <Sparkles className="h-3.5 w-3.5" />
            Executive Precision Personal ATS
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Command every stage of your career search.
          </h2>
          <p className="text-sm leading-relaxed text-[#c0edcf]">
            Track applications across pipelines, score vacancy fit, classify
            recruiter correspondence, and monitor conversion velocity in one
            private workspace.
          </p>

          <div className="space-y-3 pt-2 text-xs text-[#ecf3eb]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#86f9ba]" />
              <span>Multi-stage Kanban pipeline & structured audit logs</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#86f9ba]" />
              <span>Suitability scoring & resume version vault</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#86f9ba]" />
              <span>Private, encrypted local-first career intelligence</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#a5d1b4]">
          Executive Precision ATS · Personal Career Command Center
        </p>
      </div>

      {/* Right Floating Form Pane */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="elevation-2 w-full max-w-md rounded-2xl border border-[#bdcabf]/50 bg-[#ffffff] p-8 dark:border-[#24332a] dark:bg-[#111a15]">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#006a42] font-display text-xs font-bold text-white shadow-sm">
                CT
              </div>
              <span className="font-display text-base font-bold text-[#171d19] dark:text-[#ecf3eb]">
                Trackr
              </span>
              <span className="rounded-full bg-[#c0edcf] px-1.5 py-0.5 text-[10px] font-bold text-[#005232]">
                ATS
              </span>
            </div>
            <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
              Sign in to Career Application Tracker
            </h1>
            <p className="mt-1 text-xs text-[#3f674f] dark:text-[#a5d1b4]">
              Executive Precision Personal Applicant Tracking System (ATS)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6] px-3.5 py-2.5 text-xs font-medium text-[#93000a] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3.5 text-sm text-[#171d19] outline-none placeholder:text-[#6e7a71] focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-[#3e4a41] dark:text-[#b7c6ba]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3.5 text-sm text-[#171d19] outline-none focus:bg-[#ffffff] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-12 w-full px-5 text-sm disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#3f674f] dark:text-[#a5d1b4]">
            New to Career Application Tracker?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-[#08945F] hover:underline dark:text-[#69dca0]"
            >
              Create an account
            </Link>
          </p>

          <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#eff5ee]/70 p-4 text-[11px] leading-relaxed text-[#3e4a41] dark:border-[#24332a] dark:bg-[#17231c] dark:text-[#b7c6ba]">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#171d19] dark:text-[#ecf3eb]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#08945F] dark:text-[#69dca0]" />
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
        </div>
      </div>
    </div>
  );
}
