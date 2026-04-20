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

import type { PulseWidget } from "@/lib/types";
import { formatCompact } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

const PALETTE = [
  "#FF4A00",
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#0EA5E9",
  "#8B5CF6",
  "#84CC16",
];

export function ChartWidget({
  widget,
  rows,
}: {
  widget: PulseWidget;
  rows: Array<Record<string, unknown>>;
}) {
  const xField = widget.hints?.xField ?? "day";
  const yField = widget.hints?.yField ?? "value";
  const labelField = widget.hints?.labelField ?? "name";
  const valueField = widget.hints?.valueField ?? "value";

  const empty = rows.length === 0;

  return (
    <WidgetCard title={widget.title} subtitle={widget.subtitle} className="min-h-[280px]">
      {empty ? (
        <EmptyChart />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(widget.kind, rows, {
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
  kind: PulseWidget["kind"],
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

  if (kind === "bar") {
    return (
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey={fields.xField}
          tick={{ fontSize: 11, fill: "#6b7280" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => formatCompact(Number(v))}
        />
        <Tooltip />
        <Bar dataKey={fields.yField} fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }

  // default: line
  return (
    <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
      <CartesianGrid stroke="#f1f5f9" vertical={false} />
      <XAxis
        dataKey={fields.xField}
        tick={{ fontSize: 11, fill: "#6b7280" }}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#6b7280" }}
        tickFormatter={(v) => formatCompact(Number(v))}
      />
      <Tooltip />
      <Line
        type="monotone"
        dataKey={fields.yField}
        stroke={PALETTE[0]}
        strokeWidth={2}
        dot={false}
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
