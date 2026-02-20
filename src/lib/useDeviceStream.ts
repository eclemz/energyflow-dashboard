"use client";

import { useEffect, useRef, useState } from "react";

type TelemetryPoint = {
  ts: string;
  solarW?: number;
  loadW?: number;
  gridW?: number;
  soc?: number;
  tempC?: number;
};

type StreamState = "connecting" | "connected" | "reconnecting" | "closed";

export function useDeviceStream({
  deviceId,
  enabled,
  onPoint,
}: {
  deviceId?: string;
  enabled: boolean;
  onPoint: (p: TelemetryPoint) => void;
}) {
  const esRef = useRef<EventSource | null>(null);

  // keep latest onPoint without reopening SSE
  const onPointRef = useRef(onPoint);
  const [state, setState] = useState<StreamState>("closed");

  useEffect(() => {
    onPointRef.current = onPoint;
  }, [onPoint]);

  useEffect(() => {
    if (!enabled || !deviceId) {
      setState("closed");
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    setState("connecting");

    const url = `${process.env.NEXT_PUBLIC_API_URL}/devices/${deviceId}/stream`;
    console.log("SSE URL:", url);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setState("connected");

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        // Nest returns { data: ... }
        const payload = msg?.data ?? msg;

        // ignore heartbeat
        if (payload?.type === "ping") return;

        // telemetry must have ts
        if (!payload?.ts) return;

        onPointRef.current(payload);
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    es.onerror = (e) => {
      console.log("SSE error", e, "readyState:", es.readyState);
      setState((prev) => (prev === "connected" ? "reconnecting" : prev));
    };

    return () => {
      es.close();
      esRef.current = null;
      setState("closed");
    };
  }, [deviceId, enabled]);

  return { state };
}
