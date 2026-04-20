import type { PulseContext, PulseWidget } from "./types";

/**
 * The curated Pulse dashboard — scoped to the single Pendo app called
 * "Pulse" (default app id 6561780136607744).
 *
 * Pendo stores per-app visitor metadata under `metadata.auto_<appId>.*`.
 * For example:
 *   metadata.auto                     ← rolled up across all apps
 *   metadata.auto_6561780136607744    ← Pulse only
 *   metadata.auto__323232             ← a different (test) app
 *   metadata.auto_5670889358295040    ← a lovable.app project
 *
 * Filtering / grouping on the per-app key is what makes a widget
 * "Pulse-only". Override the default via PENDO_APP_ID env var.
 */

const APP_ID = process.env.PENDO_APP_ID ?? "6561780136607744";
const APP = `metadata.auto_${APP_ID}`;

const DAY_MS = 86_400_000;
const ms = (days: number) => Date.now() - days * DAY_MS;

function deep(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export const PULSE_WIDGETS: PulseWidget[] = [
  // ─── Row 1: topline Pulse KPIs ────────────────────────────────────────
  {
    id: "pulse-total-visitors",
    title: "Pulse visitors",
    subtitle: "All-time, app-scoped",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.lastvisit != null` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "pulse-active-30d",
    title: "Active visitors",
    subtitle: "Last 30 days",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.lastvisit >= ${ms(30)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "pulse-active-7d",
    title: "Active visitors",
    subtitle: "Last 7 days",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.lastvisit >= ${ms(7)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "pulse-active-1d",
    title: "Active visitors",
    subtitle: "Last 24 hours",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.lastvisit >= ${ms(1)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "pulse-new-30d",
    title: "New visitors",
    subtitle: "Last 30 days",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.firstvisit >= ${ms(30)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  // ─── Row 2: activity over time (Pulse only) ──────────────────────────
  {
    // True DAU: query the Pulse-scoped event stream and count distinct
    // visitors per day. Using `metadata.auto_<appId>.lastvisit` to bucket
    // would undercount earlier days because each visitor's lastvisit is
    // their most recent day only.
    id: "pulse-dau-30d",
    title: "Daily active Pulse visitors",
    subtitle: "Last 30 days",
    kind: "line",
    colSpan: 3,
    hints: { xField: "date", yField: "visitors" },
    build: () => [
      {
        source: {
          events: { appId: Number(APP_ID) },
          timeSeries: {
            first: ms(30),
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
    ],
    transform: (rows) =>
      rows.map((r) => ({
        date: new Date(Number(r.day)).toISOString().slice(5, 10),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "pulse-new-visitors-90d",
    title: "New Pulse visitors per day",
    subtitle: "Last 90 days (by firstvisit)",
    kind: "bar",
    colSpan: 3,
    hints: { xField: "date", yField: "newVisitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.firstvisit >= ${ms(90)}` },
      {
        eval: {
          day: `${APP}.firstvisit - ${APP}.firstvisit % ${DAY_MS}`,
        },
      },
      {
        group: {
          group: ["day"],
          fields: [{ newVisitors: { count: null } }],
        },
      },
      { sort: ["day"] },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        date: new Date(Number(r.day)).toISOString().slice(5, 10),
        newVisitors: Number(r.newVisitors ?? 0),
      })),
  },

  // ─── Row 3: who uses Pulse ───────────────────────────────────────────
  {
    id: "pulse-by-hierarchy",
    title: "Pulse visitors by hierarchy",
    subtitle: "From agent.hierarchy metadata",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "name", yField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      {
        filter: `${APP}.lastvisit != null && metadata.agent.hierarchy != null`,
      },
      {
        group: {
          group: ["metadata.agent.hierarchy"],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 10 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: prettyLabel(String(deep(r, "metadata.agent.hierarchy") ?? "—")),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "pulse-top-browsers",
    title: "Browsers on Pulse",
    subtitle: "By visitor count",
    kind: "pie",
    colSpan: 1,
    hints: { labelField: "name", valueField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      {
        filter: `${APP}.lastbrowsername != null && ${APP}.lastbrowsername != "unknown"`,
      },
      {
        group: {
          group: [`${APP}.lastbrowsername`],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 8 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: String(deep(r, `${APP}.lastbrowsername`) ?? "Unknown"),
        visitors: Number(r.visitors ?? 0),
      })),
  },

  // ─── Row 4: department distribution ──────────────────────────────────
  {
    id: "pulse-by-department",
    title: "Pulse visitors by department role",
    subtitle: "From agent.department_role metadata",
    kind: "bar",
    colSpan: 3,
    hints: { xField: "name", yField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      {
        filter: `${APP}.lastvisit != null && metadata.agent.department_role != null`,
      },
      {
        group: {
          group: ["metadata.agent.department_role"],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 20 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: prettyLabel(
          String(deep(r, "metadata.agent.department_role") ?? "—"),
        ),
        visitors: Number(r.visitors ?? 0),
      })),
  },

  // ─── Row 5: recent activity table ────────────────────────────────────
  {
    id: "pulse-recent-visitors",
    title: "Most recently active Pulse visitors",
    subtitle: "Top 25 by lastvisit",
    kind: "table",
    colSpan: 3,
    build: () => [
      { source: { visitors: null } },
      { filter: `${APP}.lastvisit != null` },
      {
        select: {
          visitorId: "visitorId",
          name: "metadata.agent.full_name",
          title: "metadata.agent.title",
          hierarchy: "metadata.agent.hierarchy",
          firstVisit: `${APP}.firstvisit`,
          lastVisit: `${APP}.lastvisit`,
        },
      },
      { sort: ["-lastVisit"] },
      { limit: 25 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        Visitor: String(r.visitorId ?? "—"),
        Name: String(r.name ?? "—"),
        Title: String(r.title ?? "—"),
        Hierarchy: prettyLabel(String(r.hierarchy ?? "—")),
        "First visit": r.firstVisit
          ? new Date(Number(r.firstVisit)).toISOString().slice(0, 10)
          : "—",
        "Last visit": r.lastVisit
          ? new Date(Number(r.lastVisit))
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")
          : "—",
      })),
  },
];

const LABEL_ACRONYMS = new Set([
  "ic",
  "se",
  "sdr",
  "csm",
  "cse",
  "tam",
  "ps",
  "ae",
  "pm",
  "vp",
  "api",
  "ui",
  "ux",
  "hr",
]);

function prettyLabel(s: string): string {
  if (!s || s === "—") return s;
  return s
    .split("_")
    .map((w) => {
      if (!w) return w;
      if (LABEL_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Re-exported so the page can pass it around.
export type { PulseContext };
