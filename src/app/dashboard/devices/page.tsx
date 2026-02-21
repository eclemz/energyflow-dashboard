"use client";

import Footer from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiOutlineHome } from "react-icons/hi";
import { io, Socket } from "socket.io-client";

type FleetDevice = {
  id: string;
  name: string;
  serial: string;
  location?: string | null;
  timezone?: string | null;

  lastSeen: string | null;
  status: string;

  solarW: number;
  loadW: number;
  gridW: number;
  soc: number | null;
  tempC: number | null;

  unackedAlerts: number;
};

type AlertPayload = {
  id: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
  createdAt?: string;
};

let socket: Socket | null = null;

type OnlineState = "ONLINE" | "STALE" | "OFFLINE" | "NO_DATA";

function getOnlineState(lastSeen: string | null): OnlineState {
  if (!lastSeen) return "NO_DATA";
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (ageMs <= 60_000) return "ONLINE";
  if (ageMs <= 5 * 60_000) return "STALE";
  return "OFFLINE";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtW(w: number) {
  if (!Number.isFinite(w)) return "—";
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(1)}kW`;
  return `${w}W`;
}

function relativeTime(iso: string | null) {
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

export default function DevicesFleetPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [, tick] = useState(0);

  // Update relative times without refetching data (prevents blinking)
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const fleetQuery = useQuery({
    queryKey: ["fleet"],
    queryFn: () => apiFetch("/devices/fleet") as Promise<FleetDevice[]>,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000, // backup every 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const fleet = fleetQuery.data ?? [];
  const isColdLoading = fleetQuery.isPending && fleet.length === 0;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fleet;
    return fleet.filter((d) => {
      return (
        d.name.toLowerCase().includes(s) ||
        d.serial.toLowerCase().includes(s) ||
        (d.location?.toLowerCase().includes(s) ?? false)
      );
    });
  }, [fleet, q]);

  const fleetIdsKey = useMemo(
    () =>
      fleet
        .map((d) => d.id)
        .sort()
        .join("|"),
    [fleet],
  );

  const summary = useMemo(() => {
    const counts = { ONLINE: 0, STALE: 0, OFFLINE: 0, NO_DATA: 0 };
    let unacked = 0;

    for (const d of fleet) {
      const s = getOnlineState(d.lastSeen);
      counts[s] += 1;
      unacked += d.unackedAlerts ?? 0;
    }

    return {
      total: fleet.length,
      ...counts,
      unacked,
    };
  }, [fleet]);

  // Socket init once
  useEffect(() => {
    if (socket) return;

    socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => console.log("Fleet socket ✅", socket?.id));
    socket.on("disconnect", (r) => console.log("Fleet socket ❌", r));
    socket.on("connect_error", (e) =>
      console.log("Fleet socket error ❌", e.message),
    );
  }, []);

  // Subscribe per device
  useEffect(() => {
    if (!socket || !fleet.length) return;

    const cleanups: Array<() => void> = [];

    for (const d of fleet) {
      const telemetryEvent = `device:${d.id}`;
      const alertEvent = `device:${d.id}:alert`;
      const ackEvent = `device:${d.id}:alert:ack`;

      const telemetryHandler = (payload: any) => {
        queryClient.setQueryData(["fleet"], (prev: any) => {
          const arr: FleetDevice[] = Array.isArray(prev) ? prev : [];
          return arr.map((x) =>
            x.id !== d.id
              ? x
              : {
                  ...x,
                  lastSeen: payload.ts ?? x.lastSeen,
                  status: payload.status ?? x.status,
                  solarW: payload.solarW ?? x.solarW,
                  loadW: payload.loadW ?? x.loadW,
                  gridW: payload.gridW ?? x.gridW,
                  soc: payload.soc ?? x.soc,
                  tempC: payload.tempC ?? x.tempC,
                },
          );
        });
      };

      const alertHandler = (_a: AlertPayload) => {
        queryClient.setQueryData(["fleet"], (prev: any) => {
          const arr: FleetDevice[] = Array.isArray(prev) ? prev : [];
          return arr.map((x) =>
            x.id !== d.id
              ? x
              : { ...x, unackedAlerts: (x.unackedAlerts ?? 0) + 1 },
          );
        });
      };

      const ackHandler = (_a: { id: string; deviceId: string }) => {
        queryClient.setQueryData(["fleet"], (prev: any) => {
          const arr: FleetDevice[] = Array.isArray(prev) ? prev : [];
          return arr.map((x) =>
            x.id !== d.id
              ? x
              : {
                  ...x,
                  unackedAlerts: Math.max(0, (x.unackedAlerts ?? 0) - 1),
                },
          );
        });
      };

      socket.on(telemetryEvent, telemetryHandler);
      socket.on(alertEvent, alertHandler);
      socket.on(ackEvent, ackHandler);

      cleanups.push(() => {
        socket?.off(telemetryEvent, telemetryHandler);
        socket?.off(alertEvent, alertHandler);
        socket?.off(ackEvent, ackHandler);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [fleetIdsKey, queryClient, fleet.length]);

  return (
    <div className="flex flex-col min-h-screen px-10 space-y-6 bg-zinc-950 text-zinc-100">
      {/* Static header */}
      <div className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1 text-zinc-400">
                <Link href="/" className="hover:text-white transition text-lg ">
                  <HiOutlineHome className="w-5 h-5 text-zinc-400 hover:text-white transition" />
                </Link>
                <span className="text-2xl font-medium">/</span>
                <span className="text-zinc-300 text-2xl font-semibold tracking-tight">
                  Devices
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Fleet overview with live telemetry
              </p>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search devices…"
              className="w-[360] max-w-full rounded-2xl border border-zinc-700 bg-zinc-900/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-700 focus:ring-4 focus:ring-zinc-800/40"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryTile label="Total" value={summary.total} />
            <SummaryTile label="Online" value={summary.ONLINE} />
            <SummaryTile label="Stale" value={summary.STALE} />
            <SummaryTile label="Offline" value={summary.OFFLINE} />
            <SummaryTile label="Unacked" value={summary.unacked} />
          </div>

          {fleetQuery.isError && (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              Couldn’t load fleet —{" "}
              {(fleetQuery.error as any)?.message ?? "Unknown error"}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <main className="flex-1">
        <div className="px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isColdLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6 shadow-sm animate-pulse"
                  >
                    <div className="h-5 w-44 bg-zinc-800 rounded" />
                    <div className="mt-2 h-3 w-64 bg-zinc-800 rounded" />
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="h-16 bg-zinc-800 rounded-2xl" />
                      <div className="h-16 bg-zinc-800 rounded-2xl" />
                      <div className="h-16 bg-zinc-800 rounded-2xl" />
                      <div className="h-16 bg-zinc-800 rounded-2xl" />
                    </div>
                    <div className="mt-4 h-3 w-52 bg-zinc-800 rounded" />
                  </div>
                ))
              : filtered.map((d) => {
                  const online = getOnlineState(d.lastSeen);

                  const dotCls =
                    online === "ONLINE"
                      ? "bg-emerald-400"
                      : online === "STALE"
                        ? "bg-amber-400"
                        : online === "OFFLINE"
                          ? "bg-rose-400"
                          : "bg-zinc-600";

                  const soc = d.soc ?? null;
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
                    <Link
                      key={d.id}
                      href={`/dashboard/devices/${d.id}`}
                      className={[
                        "group rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6 shadow-sm",
                        "transition hover:bg-zinc-900/35 hover:border-zinc-700",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{d.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {d.serial}
                            {d.location ? ` • ${d.location}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${dotCls}`}
                          />
                          {online}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-zinc-500">Battery</p>
                            <p className="text-xs text-zinc-500">SoC</p>
                          </div>
                          <p className="mt-1 text-base font-semibold">
                            {soc === null ? "—" : `${soc}%`}
                          </p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                            <div
                              className={`h-1.5 rounded-full ${socTone}`}
                              style={{ width: `${socPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <p className="text-xs text-zinc-500">Temp</p>
                          <p className="mt-1 text-base font-semibold">
                            {d.tempC ?? "—"}°C
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Status: {d.status ?? "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <p className="text-xs text-zinc-500">Solar</p>
                          <p className="mt-1 text-base font-semibold">
                            {fmtW(d.solarW)}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Load: {fmtW(d.loadW)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-3">
                          <p className="text-xs text-zinc-500">Unacked</p>
                          <p className="mt-1 text-base font-semibold">
                            {d.unackedAlerts}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Grid: {fmtW(d.gridW)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-xs text-zinc-500">
                        Last seen:{" "}
                        <span className="text-zinc-300">
                          {relativeTime(d.lastSeen)}
                        </span>
                        {d.lastSeen ? (
                          <span className="text-zinc-700"> • </span>
                        ) : null}
                        {d.lastSeen
                          ? new Date(d.lastSeen).toLocaleString()
                          : ""}
                      </p>
                    </Link>
                  );
                })}
          </div>

          {!fleetQuery.isPending && filtered.length === 0 && (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 text-sm text-zinc-400">
              No devices found.
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 px-4 py-3 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold leading-6 text-zinc-100">{value}</p>
    </div>
  );
}
