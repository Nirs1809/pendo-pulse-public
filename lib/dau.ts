/**
 * Shared helpers for the "Daily active Pulse visitors" line chart.
 *
 * The series is a LIVE Pendo Aggregation pipeline (events source, grouped
 * per day, counting distinct visitorId) — not a snapshot. It is used in
 * three places that must stay in lockstep:
 *
 *   1. lib/pulse-queries.ts  — the default server-rendered widget (30d).
 *   2. app/api/dau/route.ts  — the client-driven range refetch endpoint.
 *   3. components/widgets/dau-chart.tsx — the range buttons (presets only).
 *
 * Keeping everything pure (no server-only imports) lets the same constants
 * be imported on both the server and the client.
 *
 * NOTE ON HISTORY: the Pulse app only began collecting on 2026-03-30, so
 * ranges longer than that simply start at first activity. The aggregation
 * itself supports up to ~367 days; older windows fill in as data accrues.
 */

const APP_ID = process.env.PENDO_APP_ID ?? "6561780136607744";

const DAY_MS = 86_400_000;
const ms = (days: number) => Date.now() - days * DAY_MS;

export interface DauRange {
  days: number;
  label: string;
}

// Preset windows surfaced as range buttons. 365 is the practical ceiling
// (Pendo aggregation caps near 367 days); shorter presets keep the busy
// daily series readable.
export const DAU_RANGE_OPTIONS: readonly DauRange[] = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 365, label: "365d" },
] as const;

export const DAU_DEFAULT_DAYS = 30;
export const DAU_MIN_DAYS = 1;
export const DAU_MAX_DAYS = 365;

const ALLOWED_DAYS = new Set(DAU_RANGE_OPTIONS.map((r) => r.days));

/**
 * Clamp/normalize an arbitrary `days` input to a supported preset. Falls
 * back to the default when the value is missing or out of range so the
 * API route can never be coerced into an unbounded query.
 */
export function normalizeDauDays(input: unknown): number {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n)) return DAU_DEFAULT_DAYS;
  if (ALLOWED_DAYS.has(n)) return n;
  if (n < DAU_MIN_DAYS) return DAU_DEFAULT_DAYS;
  if (n > DAU_MAX_DAYS) return DAU_MAX_DAYS;
  return DAU_DEFAULT_DAYS;
}

export function dauSubtitle(days: number): string {
  return `Last ${days} days`;
}

/**
 * Build the Pendo aggregation pipeline for the daily-active series over the
 * trailing `days` window. The time filter is driven entirely by `days`, so
 * switching ranges just re-issues this pipeline with a wider window. Daily
 * granularity is preserved (`period: "dayRange"`).
 */
export function buildDauPipeline(days: number): unknown[] {
  return [
    {
      source: {
        events: { appId: Number(APP_ID) },
        timeSeries: {
          first: ms(days),
          last: "now()",
          period: "dayRange",
        },
      },
    },
    {
      group: {
        group: ["day"],
        fields: [
          { visitors: { count: "visitorId" } },
          { events: { count: null } },
        ],
      },
    },
    { sort: ["day"] },
  ];
}

export interface DauPoint {
  date: string;
  visitors: number;
}

/**
 * Shape raw aggregation rows for the chart. Leading days with no activity
 * (i.e. before the app started collecting) are trimmed so long windows
 * start at first real data instead of a flat run of zeros. Interior
 * zero-days (e.g. weekends) are preserved so dips stay visible.
 */
export function transformDauRows(
  rows: Array<Record<string, unknown>>,
): DauPoint[] {
  const points = rows.map((r) => ({
    day: Number(r.day),
    date: new Date(Number(r.day)).toISOString().slice(5, 10),
    visitors: Number(r.visitors ?? 0),
  }));

  const firstActive = points.findIndex((p) => p.visitors > 0);
  const trimmed = firstActive <= 0 ? points : points.slice(firstActive);

  return trimmed.map(({ date, visitors }) => ({ date, visitors }));
}
