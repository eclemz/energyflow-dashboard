"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function DemoPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  // keep this UI identical spacing to fleet page
  const skeletonCards = useMemo(() => Array.from({ length: 6 }), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/demo`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        if (!res.ok) throw new Error("Demo login failed");

        // marker for Next middleware
        const isProd = process.env.NODE_ENV === "production";
        document.cookie = `ef_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${
          isProd ? "; Secure" : ""
        }`;

        if (!cancelled) router.replace("/dashboard/devices");
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Demo login failed");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="p-16 space-y-6">
      {/* HEADER (same structure as fleet page) */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Devices</h1>
          <p className="text-sm text-gray-500 mt-1">Loading…</p>
        </div>

        <input
          value=""
          readOnly
          placeholder="Search by name, serial, location…"
          className="w-[360] max-w-full rounded-xl border px-3 py-2 text-sm bg-white"
        />
      </div>

      {/* ERROR STATE (same card style) */}
      {err ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold text-red-600">Couldn’t start demo</p>
          <p className="text-sm text-gray-600 mt-1">{err}</p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="rounded-xl border px-3 py-2 text-sm font-medium"
            >
              Retry
            </button>

            <Link
              href="/login"
              className="rounded-xl border px-3 py-2 text-sm font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      ) : null}

      {/* GRID SKELETON (same as fleet cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {skeletonCards.map((_, i) => (
          <div key={i} className="bg-white shadow rounded-2xl p-6 border">
            <div className="flex items-start justify-between gap-3">
              <div className="w-full">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="mt-2 h-3 w-56 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border p-3">
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="mt-2 h-5 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="rounded-xl border p-3">
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                <div className="mt-2 h-5 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="rounded-xl border p-3">
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                <div className="mt-2 h-5 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="rounded-xl border p-3">
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="mt-2 h-5 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>

            <div className="mt-4 h-3 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
