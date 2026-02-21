"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  function setWebAuthMarker() {
    const isProd = process.env.NODE_ENV === "production";
    document.cookie = `ef_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setWebAuthMarker();
      router.push("/dashboard/devices");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function demoLogin() {
    setErr(null);
    setLoading(true);

    try {
      await apiFetch("/auth/demo", { method: "POST" });
      setWebAuthMarker();
      router.push("/dashboard/devices");
    } catch (e: any) {
      setErr(e?.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-zinc-950 text-white">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-medium tracking-wider text-zinc-400">
              ENERGYFLOW
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
              Admin Login
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Sign in to view fleet devices and live telemetry.
            </p>
          </div>

          {/* Error */}
          {err && (
            <div className="mb-4 rounded-2xl border border-red-900/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@energyflow.dev"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600 focus:ring-4 focus:ring-zinc-600/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-600 focus:ring-4 focus:ring-zinc-600/20"
              />
            </div>

            {/* Primary CTA */}
            <button
              disabled={!canSubmit}
              className="w-full rounded-2xl bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs font-medium text-zinc-500">OR</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            {/* Secondary CTA */}
            <button
              type="button"
              onClick={demoLogin}
              disabled={loading}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 font-medium text-zinc-100 hover:bg-zinc-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Starting demo..." : "View Live Demo"}
            </button>
          </form>

          <p className="mt-5 text-xs text-zinc-400">
            Demo creates a temporary session and redirects to the fleet
            dashboard.
          </p>
        </div>

        {/* tiny footer */}
        <p className="mt-4 text-center text-xs text-zinc-500">
          Built by Clement Eneh
        </p>
      </div>
    </div>
  );
}
