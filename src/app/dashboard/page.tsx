"use client";

import { apiFetch } from "@/lib/api";
import type { DeviceSummary, RangeKey, TelemetryReading } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Device = {
  id: string;
  name: string;
  serial: string;
  location?: string | null;
  timezone?: string | null;
};

function getRange(r: RangeKey) {
  const now = Date.now();
  const ms =
    r === "6h"
      ? 6 * 60 * 60 * 1000
      : r === "24h"
        ? 24 * 60 * 60 * 1000
        : r === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

  return {
    from: new Date(now - ms).toISOString(),
    to: new Date(now).toISOString(),
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setErr(null);
      try {
        // Step A: auth check
        await apiFetch("/auth/me");

        const o = await apiFetch("/devices/overview");
        setOverview(o);

        // Step B: load devices
        const list = await apiFetch("/devices");
        setDevices(list);
      } catch (e: any) {
        console.error("Dashboard load failed:", e);

        // Only redirect if it's truly auth failure
        if (e?.status === 401) {
          router.replace("/login");
          return;
        }

        setErr(e?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const queryClient = useQueryClient();

  async function prefetchDevice(id: string, range: RangeKey = "24h") {
    const { from, to } = getRange(range);

    if (queryClient.getQueryData(["device", id, "summary"])) return;

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["device", id, "summary"],
        queryFn: () =>
          apiFetch(`/devices/${id}/summary`) as Promise<DeviceSummary>,
        staleTime: 10_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["device", id, "readings", range, from, to],
        queryFn: async () => {
          const r = (await apiFetch(
            `/devices/${id}/readings?from=${from}&to=${to}`,
          )) as unknown;
          return Array.isArray(r) ? (r as TelemetryReading[]) : [];
        },
        staleTime: 10_000,
      }),
    ]);
  }

  if (loading) return <div className="p-6">Loading dashboard...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Devices" value={overview.totalDevices} />
          <StatCard title="Online" value={overview.onlineDevices} />
          <StatCard title="Warnings" value={overview.warningDevices} />
          <StatCard title="Unacked Alerts" value={overview.unackedAlerts} />
        </div>
      )}

      <h1 className="text-2xl font-semibold">Devices</h1>

      {err && (
        <div className="mt-4 rounded-xl border p-4 text-sm text-red-600">
          <div className="font-medium">Dashboard error</div>
          <div className="mt-1">{err}</div>
          <div className="mt-2 text-gray-600">
            Open DevTools Console to see details.
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {devices.map((d) => (
          <button
            key={d.id}
            onMouseEnter={() => !loading && !err && prefetchDevice(d.id, "24h")}
            onFocus={() => !loading && !err && prefetchDevice(d.id, "24h")}
            onMouseDown={() => !loading && !err && prefetchDevice(d.id, "24h")}
            onClick={() => router.push(`/dashboard/devices/${d.id}`)}
            className="text-left rounded-2xl border p-5 hover:shadow-sm transition"
          >
            <div className="font-medium">{d.name}</div>
            <div className="text-sm text-gray-500">Serial: {d.serial}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }: any) {
  return (
    <div className="bg-white shadow rounded-2xl p-5">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
