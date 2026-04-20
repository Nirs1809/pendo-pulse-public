import type { PulseContext, PulseWidget } from "./types";

/**
 * The curated Pulse dashboard.
 *
 * Every widget either (a) hand-authors a Pendo /aggregation pipeline via
 * `build()` or (b) computes rows locally from pre-fetched metadata via
 * `run(ctx)`. This layout was derived empirically by probing the live
 * Pendo API — the original "events" source in this sub is sparse, but
 * the visitor / account / guide surfaces are rich, so the widgets here
 * lean on those.
 */

const DAY_MS = 86_400_000;
const ms = (days: number) => Date.now() - days * DAY_MS;

// Fields returned by groupBy on a nested metadata path come back as a
// nested object. This helper plucks the leaf value.
function deep(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export const PULSE_WIDGETS: PulseWidget[] = [
  // ─── Row 1: topline KPIs ─────────────────────────────────────────────
  {
    id: "total-visitors",
    title: "Total visitors",
    subtitle: "All-time",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "total-accounts",
    title: "Total accounts",
    subtitle: "All-time",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { accounts: null } },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "active-30d",
    title: "Active visitors",
    subtitle: "Last 30 days",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `metadata.auto.lastvisit >= ${ms(30)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "active-7d",
    title: "Active visitors",
    subtitle: "Last 7 days",
    kind: "kpi",
    hints: { valueField: "total" },
    build: () => [
      { source: { visitors: null } },
      { filter: `metadata.auto.lastvisit >= ${ms(7)}` },
      { reduce: { total: { count: null } } },
    ],
  },
  {
    id: "total-guides",
    title: "Total guides",
    subtitle: "All states",
    kind: "kpi",
    hints: { valueField: "total" },
    run: (ctx) => [{ total: ctx.guides.length }],
  },
  {
    id: "published-guides",
    title: "Published guides",
    subtitle: "state=public",
    kind: "kpi",
    hints: { valueField: "total" },
    run: (ctx) => [
      {
        total: ctx.guides.filter((g) => g.state === "public").length,
      },
    ],
  },

  // ─── Row 2: activity over time ───────────────────────────────────────
  {
    id: "dau-30d",
    title: "Daily active visitors",
    subtitle: "Last 30 days",
    kind: "line",
    colSpan: 3,
    hints: { xField: "date", yField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: `metadata.auto.lastvisit >= ${ms(30)}` },
      {
        eval: {
          day: "metadata.auto.lastvisit - metadata.auto.lastvisit % 86400000",
        },
      },
      { group: { group: ["day"], fields: [{ visitors: { count: null } }] } },
      { sort: ["day"] },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        date: new Date(Number(r.day)).toISOString().slice(5, 10),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "new-visitors-90d",
    title: "New visitors per day",
    subtitle: "Last 90 days (by firstvisit)",
    kind: "line",
    colSpan: 3,
    hints: { xField: "date", yField: "newVisitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: `metadata.auto.firstvisit >= ${ms(90)}` },
      {
        eval: {
          day: "metadata.auto.firstvisit - metadata.auto.firstvisit % 86400000",
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

  // ─── Row 3: top accounts & hosts ─────────────────────────────────────
  {
    id: "top-accounts",
    title: "Top accounts",
    subtitle: "By visitor count",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "name", yField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: "metadata.auto.accountids != null" },
      { unwind: { field: "metadata.auto.accountids" } },
      {
        group: {
          group: ["metadata.auto.accountids"],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 10 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: String(deep(r, "metadata.auto.accountids") ?? "—"),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "top-browsers",
    title: "Top browsers",
    subtitle: "By visitor count (excl. synthetic)",
    kind: "pie",
    colSpan: 1,
    hints: { labelField: "name", valueField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: 'metadata.auto.lastbrowsername != null && metadata.auto.lastbrowsername != "unknown"' },
      {
        group: {
          group: ["metadata.auto.lastbrowsername"],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 8 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: String(deep(r, "metadata.auto.lastbrowsername") ?? "Unknown"),
        visitors: Number(r.visitors ?? 0),
      })),
  },

  // ─── Row 4: hosts + guide states ─────────────────────────────────────
  {
    id: "top-hosts",
    title: "Top hosts",
    subtitle: "Last-seen domain (excl. synthetic)",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "name", yField: "visitors" },
    build: () => [
      { source: { visitors: null } },
      { filter: 'metadata.auto.lastservername != null && !startsWith(metadata.auto.lastservername, "__")' },
      {
        group: {
          group: ["metadata.auto.lastservername"],
          fields: [{ visitors: { count: null } }],
        },
      },
      { sort: ["-visitors"] },
      { limit: 10 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        name: truncate(
          String(deep(r, "metadata.auto.lastservername") ?? "—"),
          32,
        ),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "guides-by-state",
    title: "Guides by state",
    subtitle: `${0} total`,
    kind: "pie",
    colSpan: 1,
    hints: { labelField: "name", valueField: "count" },
    run: (ctx) => {
      const tally = new Map<string, number>();
      for (const g of ctx.guides) {
        const state = String(g.state ?? "unknown");
        tally.set(state, (tally.get(state) ?? 0) + 1);
      }
      return [...tally.entries()]
        .map(([name, count]) => ({ name: prettyState(name), count }))
        .sort((a, b) => b.count - a.count);
    },
  },

  // ─── Row 5: accounts table ───────────────────────────────────────────
  {
    id: "accounts-table",
    title: "Accounts overview",
    subtitle: "Identified accounts in this subscription",
    kind: "table",
    colSpan: 3,
    build: () => [
      { source: { accounts: null } },
      {
        select: {
          accountId: "accountId",
          firstVisit: "metadata.auto.firstvisit",
          lastVisit: "metadata.auto.lastvisit",
        },
      },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        Account: String(r.accountId ?? "—"),
        "First visit": r.firstVisit
          ? new Date(Number(r.firstVisit)).toISOString().slice(0, 10)
          : "—",
        "Last visit": r.lastVisit
          ? new Date(Number(r.lastVisit)).toISOString().slice(0, 10)
          : "—",
      })),
  },
];

function prettyState(s: string): string {
  const t = s.replace(/^_+|_+$/g, "");
  if (!t) return "Unknown";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Re-declared here so the page code doesn't have to import it.
export type { PulseContext };
