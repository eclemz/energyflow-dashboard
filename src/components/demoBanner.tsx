"use client";

import { apiFetch } from "@/lib/api";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function DemoBanner() {
  const pathname = usePathname();
  const isDemo = useMemo(() => getCookie("ef_demo") === "1", []);
  const [busy, setBusy] = useState(false);

  // We only show this inside dashboard pages
  const inDashboard = pathname?.startsWith("/dashboard");
  if (!inDashboard || !isDemo) return null;

  return (
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="font-semibold">Live Demo Mode</p>
          <p className="text-sm opacity-80">
            You’re viewing the demo experience. Data may be simulated.
          </p>
        </div>

        <button
          disabled={busy}
          onClick={async () => {
            // Demo reset strategy: just refresh fleet + current pages.
            // (If you want “simulate all devices”, tell me and I’ll add a fleet endpoint.)
            try {
              setBusy(true);
              // optional: ping API so Render wakes instantly
              await apiFetch("/health");
              // soft refresh
              window.location.reload();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl border border-yellow-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Refreshing..." : "Refresh Demo"}
        </button>
      </div>
    </div>
  );
}
