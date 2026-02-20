"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  ts: string; // ISO
  [k: string]: any;
};

type RangeKey = "6h" | "24h" | "7d" | "30d";

function formatTick(tsISO: string, mode: "short" | "day") {
  const d = new Date(tsISO);
  if (Number.isNaN(d.getTime())) return tsISO;

  if (mode === "day") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipLabel(tsISO: string) {
  const d = new Date(tsISO);
  if (Number.isNaN(d.getTime())) return tsISO;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function niceNumber(v: any) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (Math.abs(n) >= 1000)
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

function CustomTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: any;
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border bg-white px-3 py-2 shadow-sm">
      <div className="text-xs text-gray-500 mb-1">
        {formatTooltipLabel(String(label))}
      </div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div
            key={p.dataKey}
            className="flex items-center justify-between gap-6 text-sm"
          >
            <span className="text-gray-600">{p.name}</span>
            <span className="font-semibold">{niceNumber(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Charts({
  data,
  range,
  lastUpdatedISO,
  isFetching,
}: {
  data: Point[];
  range?: RangeKey;
  lastUpdatedISO?: string;
  isFetching?: boolean;
}) {
  const tickMode = range === "7d" || range === "30d" ? "day" : "short";

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-white shadow rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500">No telemetry yet…</div>
          {lastUpdatedISO && (
            <div className="text-xs text-gray-400">
              Last updated: {formatTooltipLabel(lastUpdatedISO)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={["space-y-10", isFetching ? "opacity-60" : ""].join(" ")}>
      <div className="flex items-center justify-end">
        {lastUpdatedISO && (
          <div className="text-xs text-gray-400">
            Last updated: {formatTooltipLabel(lastUpdatedISO)}
          </div>
        )}
      </div>

      <Chart
        title="Power Flow (W)"
        data={data}
        tickMode={tickMode}
        lines={[
          { key: "solarW", label: "Solar (W)" },
          { key: "loadW", label: "Load (W)" },
          { key: "gridW", label: "Grid (W)" },
        ]}
      />

      <Chart
        title="Battery SoC (%)"
        data={data}
        tickMode={tickMode}
        lines={[{ key: "soc", label: "SoC (%)" }]}
        yDomain={[0, 100]}
      />

      <Chart
        title="Temperature (°C)"
        data={data}
        tickMode={tickMode}
        lines={[{ key: "tempC", label: "Temp (°C)" }]}
      />
    </div>
  );
}

function Chart({
  title,
  data,
  lines,
  tickMode,
  yDomain,
}: {
  title: string;
  data: Point[];
  lines: { key: string; label: string }[];
  tickMode: "short" | "day";
  yDomain?: any;
}) {
  return (
    <div className="bg-white shadow rounded-2xl p-6 h-[340]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">{title}</h2>
        <div className="text-xs text-gray-400">
          {data.length.toLocaleString()} pts
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          syncId="device-charts" // <- hover sync across charts
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="ts"
            tickFormatter={(v) => formatTick(String(v), tickMode)}
            minTickGap={24}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={yDomain}
            allowDataOverflow
            tickFormatter={(v) => niceNumber(v)}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />

          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              dot={false}
              connectNulls
              strokeWidth={2}
              isAnimationActive={false} // <- smoother on frequent refresh
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
