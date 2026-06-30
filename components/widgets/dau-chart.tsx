"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  DAU_RANGE_OPTIONS,
  type DauPoint,
  dauSubtitle,
} from "@/lib/dau";
import { cn, formatCompact } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

const PINK = "#DE2864";

export interface DauChartProps {
  title: string;
  initialDays: number;
  initialPoints: DauPoint[];
}

/**
 * "Daily active Pulse visitors" with preset range buttons (30/90/180/365d).
 *
 * The 30d series is server-rendered (ISR-cached) and passed in as
 * `initialPoints`; switching ranges refetches /api/dau client-side and
 * redraws without busting the page cache. Fetched ranges are memoized for
 * the lifetime of the component so re-selecting a range is instant.
 */
export function DauChart({ title, initialDays, initialPoints }: DauChartProps) {
  const [days, setDays] = useState(initialDays);
  const [points, setPoints] = useState<DauPoint[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache by window so re-selecting a range doesn't refetch.
  const cache = useRef<Map<number, DauPoint[]>>(
    new Map([[initialDays, initialPoints]]),
  );
  const controllerRef = useRef<AbortController | null>(null);

  const select = useCallback((next: number) => {
    setDays(next);
    setError(null);

    const cached = cache.current.get(next);
    if (cached) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setPoints(cached);
      setLoading(false);
      return;
    }

    // Cancel any range request still in flight before starting a new one.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    fetch(`/api/dau?days=${next}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as {
          ok: boolean;
          points?: DauPoint[];
          error?: string;
        };
        if (!res.ok || !body.ok || !body.points) {
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        cache.current.set(next, body.points);
        setPoints(body.points);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load range");
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setLoading(false);
        }
      });
  }, []);

  // Abort any in-flight request on unmount.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const empty = points.length === 0;

  return (
    <WidgetCard
      title={title}
      subtitle={dauSubtitle(days)}
      className="min-h-[280px]"
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {DAU_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            type="button"
            aria-pressed={days === opt.days}
            disabled={loading && days === opt.days}
            onClick={() => select(opt.days)}
            className={cn(
              "rounded-full px-3 py-1 font-display text-xs font-medium transition",
              "border focus:outline-none focus-visible:ring-2 focus-visible:ring-pendo-pink/40",
              days === opt.days
                ? "border-pendo-pink bg-pendo-pink text-white"
                : "border-pendo-mist bg-white text-pendo-body/70 hover:border-pendo-softpink hover:text-pendo-wine",
            )}
          >
            {opt.label}
          </button>
        ))}
        {loading ? (
          <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-pendo-body/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pendo-pink" />
            Loading…
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-pendo-softpink/60 text-sm text-pendo-wine">
          <span>Couldn’t load this range</span>
          <span className="max-w-md truncate px-4 text-xs text-pendo-body/50">
            {error}
          </span>
          <button
            type="button"
            onClick={() => select(days)}
            className="mt-1 rounded-full border border-pendo-mist px-3 py-1 text-xs text-pendo-wine hover:border-pendo-softpink"
          >
            Retry
          </button>
        </div>
      ) : empty ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 text-sm text-gray-500">
          <span>No data in this time window</span>
          <span className="text-xs text-gray-400">
            The Pendo pipeline ran successfully but produced no rows.
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "h-64 w-full transition-opacity",
            loading ? "opacity-50" : "opacity-100",
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="#eceee7" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#7a2133" }}
                stroke="#eceee7"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#7a2133" }}
                stroke="#eceee7"
                allowDecimals={false}
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
                dataKey="visitors"
                stroke={PINK}
                strokeWidth={2.5}
                dot={points.length > 120 ? false : { r: 2.5, fill: PINK, stroke: PINK }}
                activeDot={{ r: 5, fill: PINK }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
