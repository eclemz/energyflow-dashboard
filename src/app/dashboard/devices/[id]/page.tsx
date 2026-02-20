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
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IoMdRefresh } from "react-icons/io";

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

  // in case backend doesn't guarantee sort order
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

export default function DevicePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [rangeUI, setRangeUI] = useState<RangeKey>("24h");
  const [range, setRange] = useState<RangeKey>("24h");
  const summaryKey = ["device", id, "summary"] as const;
  const unackedAlertsKey = ["device", id, "alerts", "unacked"] as const;

  // smooth range change (prevents fast flicker)
  useEffect(() => {
    const t = setTimeout(() => setRange(rangeUI), 150);
    return () => clearTimeout(t);
  }, [rangeUI]);

  const queryClient = useQueryClient();

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
        // pulls latest alerts from backend only when needed
        queryClient.invalidateQueries({ queryKey: summaryKey }); // keep count consistent
      }
    },
  });

  useDeviceAlertSocket({
    deviceId: id,
    enabled: !!id,

    // NEW ALERT
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

    // ALERT ACK FROM OTHER TABS / USERS
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

  const { from, to } = useMemo(() => getRange(range), [range]);

  const summaryQuery = useQuery({
    queryKey: ["device", id, "summary"],
    enabled: !!id,
    queryFn: () => apiFetch(`/devices/${id}/summary`) as Promise<DeviceSummary>,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchInterval: range === "6h" || range === "24h" ? 10_000 : 30_000,
  });

  const alertsQuery = useQuery({
    queryKey: unackedAlertsKey,
    enabled: !!id,
    queryFn: () =>
      apiFetch(`/devices/${id}/alerts?status=unacked`) as Promise<any[]>,
    placeholderData: keepPreviousData,
    refetchInterval: false, // stop polling and drive it via SSE
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
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchInterval: range === "6h" || range === "24h" ? 10_000 : 30_000,
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

  // DEV-only simulate CTA
  const isDev = process.env.NODE_ENV !== "production";

  const [isSimulating, setIsSimulating] = useState(false);

  async function simulateTelemetry() {
    if (!id) return;
    try {
      setIsSimulating(true);
      await apiFetch(`/devices/${id}/simulate`, { method: "POST" });

      // refresh everything
      await queryClient.invalidateQueries({ queryKey: ["device", id] });
      await refetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  }

  if (!id) return <div className="p-10">Missing device id</div>;

  if (isColdLoading && !summary) {
    return <DevicePageSkeleton />;
  }

  return (
    <div className="p-10 space-y-6">
      {/* Sticky Header */}
      <div className="flex flex-col md:flex-row sticky md:p-4 p-2 top-0 items-start md:items-end justify-between gap-2 md:gap-4 bg-black z-10">
        <div>
          <h1 className="text-3xl font-bold">Device Overview</h1>
          <div className="flex items-center gap-2 mt-2">
            <StreamBadge state={stream.state} />
            <DeviceOnlineBadge lastSeen={summary?.lastSeen} />
          </div>

          <div className="mt-1 space-y-1">
            {lastUpdatedAt ? (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(lastUpdatedAt).toLocaleString()}
              </p>
            ) : null}

            {lastReadingISO ? (
              <p className="text-xs text-gray-400">
                Last reading: {new Date(lastReadingISO).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs text-gray-500">No readings received yet</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border bg-white p-1 gap-1">
            {(["6h", "24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRangeUI(r)}
                className={[
                  "px-3 py-2 rounded-xl text-sm border transition-colors duration-200 cursor-pointer",
                  rangeUI === r ? "text-black bg-white" : "bg-black text-white",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={refetchAll}
            disabled={isSoftLoading}
            className="group flex rounded-xl border px-3 py-2 text-sm font-medium items-center gap-2 disabled:opacity-60 cursor-pointer active:scale-95 transition-transform duration-300"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <IoMdRefresh
                className={[
                  "h-5 w-5 transition-transform duration-500 group-active:rotate-180",
                  isSoftLoading ? "animate-spin" : "",
                ].join(" ")}
              />
            </span>
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {/* Reconnecting banner (network down) */}
      {showReconnecting ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold text-yellow-700">Reconnecting…</p>
          <p className="text-sm text-gray-600 mt-1">
            Backend is temporarily unavailable. We’ll retry automatically.
          </p>
        </div>
      ) : null}

      {/* Fatal error banner (real API error) */}
      {showFatalError ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold text-red-600">
            Couldn’t load device data
          </p>
          <p className="text-sm text-gray-600 mt-1">{error.message}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={refetchAll}
              className="rounded-xl border px-3 py-2 text-sm font-medium border-gray-300 text-gray-300 active:scale-95 transition"
            >
              Retry
            </button>
            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["device", id] })
              }
              className="rounded-xl border px-3 py-2 text-sm font-medium border-gray-300 text-gray-300 active:scale-95 transition"
            >
              Clear cache & reload
            </button>
          </div>
        </div>
      ) : null}

      {/* Cards */}
      <div className={isSoftLoading ? "opacity-60" : ""}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card title="Solar Power" value={`${summary?.solarW ?? "—"} W`} />
          <Card title="Load Power" value={`${summary?.loadW ?? "—"} W`} />
          <Card title="Battery SoC" value={`${summary?.batterySoc ?? "—"}%`} />
          <Card title="Temperature" value={`${summary?.tempC ?? "—"} °C`} />
          <Card title="Status" value={summary?.status ?? "—"} />
          <Card title="Unacked Alerts" value={summary?.unackedAlerts ?? 0} />
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white shadow rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active Alerts</h2>
          <span className="text-sm text-gray-500">
            {alertsQuery.data?.length ?? 0} unacked
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {(alertsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No active alerts</p>
          ) : (
            (alertsQuery.data ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <div>
                  <p className="font-medium">{a.type}</p>
                  <p className="text-sm text-gray-600">{a.message}</p>
                </div>

                <button
                  onClick={async () => {
                    if (!id) return;

                    // Snapshot current cache (for rollback if request fails)
                    const prevAlerts =
                      queryClient.getQueryData(unackedAlertsKey);
                    const prevSummary = queryClient.getQueryData(summaryKey);

                    // 1) Optimistically remove from list
                    queryClient.setQueryData(unackedAlertsKey, (prev: any) => {
                      const arr = Array.isArray(prev) ? prev : [];
                      return arr.filter((x: any) => x.id !== a.id);
                    });

                    // 2) Optimistically decrement count
                    queryClient.setQueryData(summaryKey, (prev: any) => {
                      const base = prev ?? {};
                      const cur = base.unackedAlerts ?? 0;
                      return { ...base, unackedAlerts: Math.max(0, cur - 1) };
                    });

                    try {
                      await apiFetch(`/devices/alerts/${a.id}/ack`, {
                        method: "POST",
                      });
                      // No invalidate needed. UI already updated.
                    } catch (e) {
                      // Rollback if API failed
                      queryClient.setQueryData(
                        unackedAlertsKey,
                        prevAlerts as any,
                      );
                      queryClient.setQueryData(summaryKey, prevSummary as any);
                      console.error(e);
                    }
                  }}
                  className="rounded-xl border px-3 py-2 text-sm font-medium cursor-pointer border-gray-300 text-gray-300 active:scale-95 transition"
                >
                  Acknowledge
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Empty State (only when no readings for selected range) */}
      {!hasReadings ? (
        <div className="bg-white shadow rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-semibold">No telemetry for this range</h2>
              <p className="text-sm text-gray-600 mt-1">
                This device hasn’t sent readings between{" "}
                <span className="font-medium">
                  {new Date(from).toLocaleString()}
                </span>{" "}
                and{" "}
                <span className="font-medium">
                  {new Date(to).toLocaleString()}
                </span>
                .
              </p>

              <ul className="mt-3 text-sm text-gray-600 list-disc ml-5 space-y-1">
                <li>Confirm the device is online and connected.</li>
                <li>
                  Check that the device is sending timestamps in ISO format.
                </li>
                <li>Try a shorter range like 6h or 24h.</li>
              </ul>
            </div>

            {isDev ? (
              <button
                onClick={simulateTelemetry}
                disabled={isSimulating}
                className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60 active:scale-95 transition border-gray-500 text-gray-500"
              >
                {isSimulating ? "Simulating..." : "Simulate telemetry (dev)"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Charts */}
      <div className={isSoftLoading ? "opacity-60 pointer-events-none" : ""}>
        <Charts
          data={data as any}
          range={range}
          lastUpdatedISO={lastReadingISO ?? undefined}
        />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white shadow rounded-2xl p-6">
      <p className="text-gray-500">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
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

  const cls =
    state === "connected"
      ? "bg-green-100 text-green-700 border-green-200"
      : state === "reconnecting"
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function DeviceOnlineBadge({ lastSeen }: { lastSeen?: string | null }) {
  if (!lastSeen) {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 border-gray-200">
        No data
      </span>
    );
  }

  const ageMs = Date.now() - new Date(lastSeen).getTime();

  // tune these
  const onlineMs = 60_000; // 1 min
  const staleMs = 5 * 60_000; // 5 mins

  const label =
    ageMs <= onlineMs ? "Online" : ageMs <= staleMs ? "Stale" : "Offline";
  const cls =
    label === "Online"
      ? "bg-green-100 text-green-700 border-green-200"
      : label === "Stale"
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : "bg-red-100 text-red-700 border-red-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function DevicePageSkeleton() {
  return (
    <div className="p-10 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-44 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-56 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white shadow rounded-2xl p-6">
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="mt-3 h-8 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white shadow rounded-2xl p-6 h-[340]">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="mt-5 h-[260] w-full bg-gray-200 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
