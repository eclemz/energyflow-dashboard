"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

type AlertPayload = {
  id: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
  ts?: string;
  createdAt?: string;
};

let socket: Socket | null = null;

export function useDeviceAlertSocket({
  deviceId,
  enabled,
  onAlert,
  onAck,
}: {
  deviceId?: string;
  enabled: boolean;
  onAlert: (a: AlertPayload) => void;
  onAck?: (a: { id: string; deviceId: string }) => void;
}) {
  const onAlertRef = useRef(onAlert);
  const onAckRef = useRef(onAck);
  // keep latest callback without re-subscribing
  useEffect(() => {
    onAlertRef.current = onAlert;
  }, [onAlert]);

  useEffect(() => {
    onAckRef.current = onAck;
  }, [onAck]);

  useEffect(() => {
    if (!enabled || !deviceId) return;

    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () =>
        console.log("Socket connected ✅", socket?.id),
      );
      socket.on("connect_error", (e) =>
        console.log("Socket connect_error ❌", e.message),
      );
      socket.on("disconnect", (r) => console.log("Socket disconnected", r));

      // optional: log any event
      socket.onAny((event, ...args) =>
        console.log("SOCKET EVENT:", event, args),
      );
    }

    const eventName = `device:${deviceId}:alert`;

    const handler = (data: AlertPayload) => {
      console.log("ALERT RECEIVED 🔔", data);
      onAlertRef.current(data);
    };

    const ackEventName = `device:${deviceId}:alert:ack`;

    const ackHandler = (data: { id: string; deviceId: string }) => {
      console.log("ALERT ACK RECEIVED ✅", data);
      onAckRef.current?.(data);
    };

    socket.on(eventName, handler);
    socket.on(ackEventName, ackHandler);

    return () => {
      socket?.off(eventName, handler);
      socket?.off(ackEventName, ackHandler);
    };
  }, [deviceId, enabled]);
}
