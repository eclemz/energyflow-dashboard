"use client";

import { apiFetch } from "@/lib/api";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function isOnline(lastSeen: string | null) {
  if (!lastSeen) return "NO_DATA";
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (ageMs <= 60_000) return "ONLINE";
  if (ageMs <= 5 * 60_000) return "STALE";
  return "OFFLINE";
}

export default function DevicesFleetPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const fleetQuery = useQuery({
    queryKey: ["fleet"],
    queryFn: () => apiFetch("/devices/fleet") as Promise<FleetDevice[]>,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000, // backup polling
  });

  const fleet = fleetQuery.data ?? [];

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

  // key subscriptions by IDs (NOT length)
  const fleetIdsKey = useMemo(
    () =>
      fleet
        .map((d) => d.id)
        .sort()
        .join("|"),
    [fleet],
  );

  // Socket init only once
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

  // Subscribe/unsubscribe whenever device IDs set changes
  useEffect(() => {
    if (!socket) return;
    if (!fleet.length) return;

    const cleanups: Array<() => void> = [];

    for (const d of fleet) {
      const telemetryEvent = `device:${d.id}`;
      const alertEvent = `device:${d.id}:alert`;
      // Only keep this if your backend emits it
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

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [fleetIdsKey, queryClient]); // correct deps

  return (
    <div className="p-10 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Devices</h1>
          <p className="text-sm text-gray-500 mt-1">{fleet.length} total</p>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, serial, location…"
          className="w-[360] max-w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {fleetQuery.isError ? (
        <div className="rounded-2xl border bg-white p-4">
          <p className="font-semibold text-red-600">Couldn’t load fleet</p>
          <p className="text-sm text-gray-600 mt-1">
            {(fleetQuery.error as any)?.message ?? "Unknown error"}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((d) => {
          const online = isOnline(d.lastSeen);

          const onlineCls =
            online === "ONLINE"
              ? "bg-green-100 text-green-700 border-green-200"
              : online === "STALE"
                ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                : online === "OFFLINE"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-gray-100 text-gray-700 border-gray-200";

          return (
            <Link
              key={d.id}
              href={`/dashboard/devices/${d.id}`}
              className="bg-white shadow rounded-2xl p-6 border hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg">{d.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.serial} {d.location ? `• ${d.location}` : ""}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${onlineCls}`}
                >
                  {online}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border p-3">
                  <p className="text-gray-500 text-xs">Battery</p>
                  <p className="font-semibold">{d.soc ?? "—"}%</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-gray-500 text-xs">Temp</p>
                  <p className="font-semibold">{d.tempC ?? "—"}°C</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-gray-500 text-xs">Solar</p>
                  <p className="font-semibold">{d.solarW}W</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-gray-500 text-xs">Unacked</p>
                  <p className="font-semibold">{d.unackedAlerts}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4">
                Last seen:{" "}
                {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "—"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
