"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact } from "@/lib/utils";

export interface SparklineProps {
  data: Array<Record<string, unknown>>;
  xField: string;
  yField: string;
}

/**
 * A bare-bones filled area chart designed to live inside another card —
 * no padding, no header. Used for the Slack "Pulse brand meter" headline.
 */
export function Sparkline({ data, xField, yField }: SparklineProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-pendo-body/50">
        No data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="pendoPinkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DE2864" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#DE2864" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eceee7" vertical={false} />
        <XAxis
          dataKey={xField}
          tick={{ fontSize: 11, fill: "#7a2133" }}
          stroke="#eceee7"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#7a2133" }}
          stroke="#eceee7"
          tickFormatter={(v) => formatCompact(Number(v))}
          width={28}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #eceee7",
            borderRadius: 10,
            background: "#fff",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey={yField}
          stroke="#DE2864"
          strokeWidth={2.5}
          fill="url(#pendoPinkFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
