"use client";

import Charts from "@/components/Charts";
import { useDeviceAlertSocket } from "@/hooks/useDeviceAlertSocket";
import { apiFetch } from "@/lib/api";
import type { DeviceSummary, RangeKey, TelemetryReading } from "@/lib/types";
import { useDeviceStream } from "@/lib/useDeviceStream";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IoMdRefresh } from "react-icons/io";
import { RiArrowLeftSLine } from "react-icons/ri";

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

function latestTsISO(data: TelemetryReading[]) {
  if (!Array.isArray(data) || data.length === 0) return null;

  let max = 0;
  for (const p of data) {
    const t = new Date((p as any).ts).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max ? new Date(max).toISOString() : null;
}

function appendPointCapped<T>(arr: T[], p: T, max = 500) {
  const next = [...arr, p];
  if (next.length <= max) return next;
  return next.slice(next.length - max);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtW(w: any) {
  const n = Number(w);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}kW`;
  return `${n}W`;
}

function relativeTime(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));

  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id;

  const [rangeUI, setRangeUI] = useState<RangeKey>("24h");
  const [range, setRange] = useState<RangeKey>("24h");
  const summaryKey = ["device", id, "summary"] as const;
  const unackedAlertsKey = ["device", id, "alerts", "unacked"] as const;

  // update relative clock without refetching
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setRange(rangeUI), 150);
    return () => clearTimeout(t);
  }, [rangeUI]);

  const queryClient = useQueryClient();
  const { from, to } = useMemo(() => getRange(range), [range]);

  const stream = useDeviceStream({
    deviceId: id,
    enabled: !!id && (range === "6h" || range === "24h"),
    onPoint: (p) => {
      queryClient.setQueryData(
        ["device", id, "readings", range, from, to],
        (prev: any) => {
          const arr = Array.isArray(prev) ? prev : [];
          return appendPointCapped(arr, p, 500);
        },
      );

      queryClient.setQueryData(summaryKey, (prev: any) => {
        const base = prev ?? {};
        return {
          ...base,
          solarW: p.solarW ?? base.solarW,
          loadW: p.loadW ?? base.loadW,
          gridW: p.gridW ?? base.gridW,
          batterySoc: p.soc ?? base.batterySoc,
          tempC: p.tempC ?? base.tempC,
          lastSeen: p.ts,
        };
      });

      const isWarnish =
        (p.soc !== undefined && p.soc < 20) ||
        (p.tempC !== undefined && p.tempC > 60);

      if (isWarnish) {
        queryClient.invalidateQueries({ queryKey: summaryKey });
      }
    },
  });

  useDeviceAlertSocket({
    deviceId: id,
    enabled: !!id,

    onAlert: (a) => {
      queryClient.setQueryData(unackedAlertsKey, (prev: any) => {
        const arr = Array.isArray(prev) ? prev : [];
        if (arr.some((x: any) => x.id === a.id)) return arr;
        return [a, ...arr].slice(0, 50);
      });

      queryClient.setQueryData(summaryKey, (prev: any) => {
        const base = prev ?? {};
        return { ...base, unackedAlerts: (base.unackedAlerts ?? 0) + 1 };
      });
    },

    onAck: ({ id: alertId }) => {
      queryClient.setQueryData(unackedAlertsKey, (prev: any) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((x: any) => x.id !== alertId);
      });

      queryClient.setQueryData(summaryKey, (prev: any) => {
        const base = prev ?? {};
        const cur = base.unackedAlerts ?? 0;
        return { ...base, unackedAlerts: Math.max(0, cur - 1) };
      });
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["device", id, "summary"],
    enabled: !!id,
    queryFn: () => apiFetch(`/devices/${id}/summary`) as Promise<DeviceSummary>,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const alertsQuery = useQuery({
    queryKey: unackedAlertsKey,
    enabled: !!id,
    queryFn: () =>
      apiFetch(`/devices/${id}/alerts?status=unacked`) as Promise<any[]>,
    placeholderData: keepPreviousData,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const readingsQuery = useQuery({
    queryKey: ["device", id, "readings", range, from, to],
    enabled: !!id,
    queryFn: async () => {
      const r = (await apiFetch(
        `/devices/${id}/readings?from=${from}&to=${to}`,
      )) as unknown;
      return Array.isArray(r) ? (r as TelemetryReading[]) : [];
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const summary = summaryQuery.data;
  const data = readingsQuery.data ?? [];

  const hasSummary = !!summary;
  const hasReadings = Array.isArray(data) && data.length > 0;

  const isColdLoading =
    (summaryQuery.isPending || readingsQuery.isPending) &&
    !hasSummary &&
    !hasReadings;

  const isSoftLoading =
    (summaryQuery.isFetching || readingsQuery.isFetching) &&
    (hasSummary || hasReadings);

  const error =
    (summaryQuery.error as Error | null) ||
    (readingsQuery.error as Error | null);

  const isNetworkError =
    !!error &&
    (String(error.message).toLowerCase().includes("networkerror") ||
      String(error.message).toLowerCase().includes("failed to fetch"));

  const showFatalError = !!error && !isNetworkError;
  const showReconnecting = !!error && isNetworkError;

  const lastUpdatedAt = Math.max(
    summaryQuery.dataUpdatedAt || 0,
    readingsQuery.dataUpdatedAt || 0,
  );
  const lastReadingISO = useMemo(() => latestTsISO(data), [data]);

  async function refetchAll() {
    if (!id) return;
    await Promise.all([summaryQuery.refetch(), readingsQuery.refetch()]);
  }

  const isDev = process.env.NODE_ENV !== "production";
  const isDemo =
    typeof document !== "undefined" && document.cookie.includes("ef_demo=1");
  const canSimulate = isDev || isDemo;

  const [isSimulating, setIsSimulating] = useState(false);

  async function simulateTelemetry() {
    if (!id) return;
    try {
      setIsSimulating(true);
      await apiFetch(`/devices/${id}/simulate`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["device", id] });
      await refetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  }

  if (!id) return <div className="p-10">Missing device id</div>;
  if (isColdLoading && !summary) return <DevicePageSkeleton />;

  const soc = summary?.batterySoc ?? null;
  const socPct = soc === null ? 0 : clamp(soc, 0, 100);

  const socTone =
    soc === null
      ? "bg-zinc-700"
      : socPct < 20
        ? "bg-rose-400"
        : socPct < 50
          ? "bg-amber-400"
          : "bg-emerald-400";

  return (
    <div className="min-h-screen px-10 bg-zinc-950 text-zinc-100">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-zinc-800/40 bg-zinc-950/80 backdrop-blur">
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/dashboard/devices")}
                  className="flex flex-row text-base items-center text-zinc-400 hover:text-zinc-100 transition cursor-pointer"
                >
                  <RiArrowLeftSLine className="w-5 h-5" />
                  Fleet
                </button>
                <span className="text-zinc-400">/</span>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Device Overview
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <StreamBadge state={stream.state} />
                <DeviceOnlineBadge lastSeen={summary?.lastSeen} />
                <span className="text-xs text-zinc-500">
                  Last seen:{" "}
                  <span className="text-zinc-200">
                    {relativeTime(summary?.lastSeen)}
                  </span>
                </span>
              </div>

              <div className="text-xs text-zinc-500">
                {lastReadingISO ? (
                  <>
                    Last reading:{" "}
                    <span className="text-zinc-200">
                      {relativeTime(lastReadingISO)}
                    </span>
                  </>
                ) : (
                  "No readings received yet"
                )}
                {lastUpdatedAt ? (
                  <>
                    <span className="text-zinc-700 px-2"> • </span>
                    Updated: {new Date(lastUpdatedAt).toLocaleString()}
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/20 p-1 gap-1">
                {(["6h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRangeUI(r)}
                    className={[
                      "px-3 py-2 rounded-xl text-sm transition",
                      rangeUI === r
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-300 hover:bg-zinc-900/40",
                    ].join(" ")}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <button
                onClick={refetchAll}
                disabled={isSoftLoading}
                className="group flex rounded-xl border border-zinc-800 bg-zinc-900/20 px-3 py-2 text-sm font-medium items-center gap-2 disabled:opacity-60 active:scale-95 transition"
              >
                <IoMdRefresh
                  className={[
                    "h-5 w-5 transition-transform duration-500",
                    isSoftLoading ? "animate-spin" : "group-active:rotate-180",
                  ].join(" ")}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Metric label="Solar" value={fmtW(summary?.solarW)} />
            <Metric label="Load" value={fmtW(summary?.loadW)} />
            <Metric label="Grid" value={fmtW(summary?.gridW)} />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 px-4 py-3">
              <p className="text-xs text-zinc-500">Battery</p>
              <p className="text-lg font-semibold">
                {soc === null ? "—" : `${soc}%`}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className={`h-1.5 rounded-full ${socTone}`}
                  style={{ width: `${socPct}%` }}
                />
              </div>
            </div>
            <Metric
              label="Temp"
              value={summary?.tempC == null ? "—" : `${summary.tempC}°C`}
            />
            <Metric
              label="Unacked"
              value={String(summary?.unackedAlerts ?? 0)}
            />
          </div>

          {showReconnecting ? (
            <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
              Reconnecting… backend is temporarily unavailable.
            </div>
          ) : null}

          {showFatalError ? (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              Couldn’t load device data — {error.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* Alerts */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Active Alerts</h2>
            <span className="text-sm text-zinc-400">
              {alertsQuery.data?.length ?? 0} unacked
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {(alertsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No active alerts</p>
            ) : (
              (alertsQuery.data ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{a.type}</p>
                    <p className="text-sm text-zinc-400 mt-1">{a.message}</p>
                  </div>

                  <button
                    onClick={async () => {
                      if (!id) return;

                      const prevAlerts =
                        queryClient.getQueryData(unackedAlertsKey);
                      const prevSummary = queryClient.getQueryData(summaryKey);

                      queryClient.setQueryData(
                        unackedAlertsKey,
                        (prev: any) => {
                          const arr = Array.isArray(prev) ? prev : [];
                          return arr.filter((x: any) => x.id !== a.id);
                        },
                      );

                      queryClient.setQueryData(summaryKey, (prev: any) => {
                        const base = prev ?? {};
                        const cur = base.unackedAlerts ?? 0;
                        return { ...base, unackedAlerts: Math.max(0, cur - 1) };
                      });

                      try {
                        await apiFetch(`/devices/alerts/${a.id}/ack`, {
                          method: "POST",
                        });
                      } catch (e) {
                        queryClient.setQueryData(
                          unackedAlertsKey,
                          prevAlerts as any,
                        );
                        queryClient.setQueryData(
                          summaryKey,
                          prevSummary as any,
                        );
                        console.error(e);
                      }
                    }}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900/50 transition active:scale-95"
                  >
                    Acknowledge
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* No telemetry */}
        {!hasReadings ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-semibold">No telemetry for this range</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  This device hasn’t sent readings between{" "}
                  <span className="text-zinc-200">
                    {new Date(from).toLocaleString()}
                  </span>{" "}
                  and{" "}
                  <span className="text-zinc-200">
                    {new Date(to).toLocaleString()}
                  </span>
                  .
                </p>
                <ul className="mt-3 text-sm text-zinc-500 list-disc ml-5 space-y-1">
                  <li>Confirm the device is online and connected.</li>
                  <li>Try a shorter range like 6h or 24h.</li>
                </ul>
              </div>

              {canSimulate ? (
                <button
                  onClick={simulateTelemetry}
                  disabled={isSimulating}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900/50 disabled:opacity-60 active:scale-95 transition"
                >
                  {isSimulating ? "Simulating..." : "Simulate telemetry"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Charts */}
        <div className={isSoftLoading ? "opacity-70 pointer-events-none" : ""}>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
            <p className="text-sm text-zinc-400 mb-4">Telemetry</p>
            <Charts
              data={data as any}
              range={range}
              lastUpdatedISO={lastReadingISO ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 px-4 py-3 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold leading-6 text-zinc-100">{value}</p>
    </div>
  );
}

function StreamBadge({
  state,
}: {
  state: "connecting" | "connected" | "reconnecting" | "closed";
}) {
  const label =
    state === "connected"
      ? "Live"
      : state === "connecting"
        ? "Connecting"
        : state === "reconnecting"
          ? "Reconnecting"
          : "Stopped";

  const dot =
    state === "connected"
      ? "bg-emerald-400"
      : state === "reconnecting"
        ? "bg-amber-400"
        : "bg-zinc-600";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function DeviceOnlineBadge({ lastSeen }: { lastSeen?: string | null }) {
  const state = lastSeen
    ? (() => {
        const ageMs = Date.now() - new Date(lastSeen).getTime();
        if (ageMs <= 60_000) return "Online";
        if (ageMs <= 5 * 60_000) return "Stale";
        return "Offline";
      })()
    : "No data";

  const dot =
    state === "Online"
      ? "bg-emerald-400"
      : state === "Stale"
        ? "bg-amber-400"
        : state === "Offline"
          ? "bg-rose-400"
          : "bg-zinc-600";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {state}
    </span>
  );
}

function DevicePageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-10 space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6 animate-pulse">
        <div className="h-6 w-56 bg-zinc-800 rounded" />
        <div className="mt-3 h-3 w-72 bg-zinc-800 rounded" />
        <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6 h-[320] animate-pulse">
        <div className="h-4 w-40 bg-zinc-800 rounded" />
        <div className="mt-6 h-[240] bg-zinc-800 rounded-2xl" />
      </div>
    </div>
  );
}
