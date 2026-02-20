export type RangeKey = "6h" | "24h" | "7d" | "30d";

export type DeviceSummary = {
  lastSeen?: string | null;
  solarW: number | null;
  loadW: number | null;
  batterySoc: number | null;
  tempC: number | null;
  status: string | null;
  unackedAlerts: number | null;
};

export type TelemetryReading = {
  ts: string; // ISO
  solarW?: number | null;
  loadW?: number | null;
  gridW?: number | null;
  soc?: number | null;
  tempC?: number | null;
};
