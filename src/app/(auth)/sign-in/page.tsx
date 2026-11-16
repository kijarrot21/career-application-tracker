"use client";

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
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 dark:bg-[#0B1120]">
      <div className="elevation-2 w-full max-w-sm rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#204CD3] font-display text-xs font-bold text-white shadow-2xs">
            CT
          </div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Sign in to Career Application Tracker
          </h1>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            Executive Precision Personal Applicant Tracking System (ATS)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[4px] border border-[#F43F5E]/40 bg-[#FFF1F2] px-3 py-2 text-xs text-[#BE123C] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-[#334155] dark:text-slate-300"
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
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] outline-none placeholder:text-[#64748B] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#334155] dark:text-slate-300"
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
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-[4px] bg-[#204CD3] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[#64748B] dark:text-slate-400">
          New to Career Application Tracker?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
