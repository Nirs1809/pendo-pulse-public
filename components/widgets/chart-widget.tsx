"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

type ChartKind = "line" | "bar" | "pie";

export interface ChartWidgetProps {
  title: string;
  subtitle?: string;
  kind: ChartKind;
  hints?: {
    xField?: string;
    yField?: string;
    labelField?: string;
    valueField?: string;
  };
  rows: Array<Record<string, unknown>>;
}

// Pendo brand palette. Lead with hot pink, then deep wine, then the
// softer accent tones, falling back to neutrals for a 6th+ series.
const PALETTE = [
  "#DE2864",
  "#7A2133",
  "#FF69B4",
  "#E4B4BE",
  "#2B0007",
  "#101010",
  "#FFB3C6",
  "#2A2A2A",
];

export function ChartWidget({
  title,
  subtitle,
  kind,
  hints,
  rows,
}: ChartWidgetProps) {
  const xField = hints?.xField ?? "day";
  const yField = hints?.yField ?? "value";
  const labelField = hints?.labelField ?? "name";
  const valueField = hints?.valueField ?? "value";

  const empty = rows.length === 0;

  return (
    <WidgetCard title={title} subtitle={subtitle} className="min-h-[280px]">
      {empty ? (
        <EmptyChart />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(kind, rows, {
              xField,
              yField,
              labelField,
              valueField,
            })}
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}

function renderChart(
  kind: ChartKind,
  rows: Array<Record<string, unknown>>,
  fields: {
    xField: string;
    yField: string;
    labelField: string;
    valueField: string;
  },
) {
  if (kind === "pie") {
    const data = rows.map((r, i) => ({
      name: String(r[fields.labelField] ?? r.name ?? `Slice ${i + 1}`),
      value: Number(r[fields.valueField] ?? r.value ?? r.count ?? 0),
    }));
    return (
      <PieChart>
        <Pie dataKey="value" data={data} outerRadius={90} innerRadius={50}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  }

  const axisTick = { fontSize: 11, fill: "#7a2133" };
  const gridStroke = "#eceee7";

  if (kind === "bar") {
    return (
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <XAxis dataKey={fields.xField} tick={axisTick} stroke="#eceee7" />
        <YAxis
          tick={axisTick}
          stroke="#eceee7"
          tickFormatter={(v) => formatCompact(Number(v))}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #eceee7",
            borderRadius: 10,
            background: "#fff",
            fontSize: 12,
          }}
          cursor={{ fill: "#ffe4e9" }}
        />
        <Bar dataKey={fields.yField} fill={PALETTE[0]} radius={[6, 6, 0, 0]} />
      </BarChart>
    );
  }

  // default: line
  return (
    <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
      <CartesianGrid stroke={gridStroke} vertical={false} />
      <XAxis dataKey={fields.xField} tick={axisTick} stroke="#eceee7" />
      <YAxis
        tick={axisTick}
        stroke="#eceee7"
        tickFormatter={(v) => formatCompact(Number(v))}
      />
      <Tooltip
        contentStyle={{
          border: "1px solid #eceee7",
          borderRadius: 10,
          background: "#fff",
          fontSize: 12,
        }}
      />
      <Line
        type="monotone"
        dataKey={fields.yField}
        stroke={PALETTE[0]}
        strokeWidth={2.5}
        dot={{ r: 2.5, fill: PALETTE[0], stroke: PALETTE[0] }}
        activeDot={{ r: 5, fill: PALETTE[0] }}
      />
    </LineChart>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 text-sm text-gray-500">
      <span>No data in this time window</span>
      <span className="text-xs text-gray-400">
        The Pendo pipeline ran successfully but produced no rows.
      </span>
    </div>
  );
}
