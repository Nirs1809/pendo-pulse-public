import type { PulseWidget } from "./types";

/**
 * The curated Pulse dashboard.
 *
 * Each widget hand-authors an aggregation pipeline against Pendo's public
 * /aggregation endpoint. This is necessary because Pendo's REST API does
 * not expose dashboards or the compiled pipelines behind individual
 * reports — only the raw primitives.
 *
 * Pipelines here use relative time windows: the pipeline builder runs at
 * request time so "last 90 days" is always current.
 */

function daysAgoMs(days: number): number {
  return Date.now() - days * 86_400_000;
}

const LAST_30D = () => ({ first: daysAgoMs(30), last: "now()" as const, period: "dayRange" as const });
const LAST_90D = () => ({ first: daysAgoMs(90), last: "now()" as const, period: "dayRange" as const });
const LAST_90D_WEEKLY = () => ({ first: daysAgoMs(90), last: "now()" as const, period: "weekRange" as const });

export const PULSE_WIDGETS: PulseWidget[] = [
  {
    id: "totals-90d",
    title: "Total visitors (90d)",
    kind: "kpi",
    hints: { valueField: "visitors" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      {
        reduce: {
          visitors: { count: "visitorId" },
          accounts: { count: "accountId" },
          events: { count: null },
        },
      },
    ],
  },
  {
    id: "total-accounts-90d",
    title: "Total accounts (90d)",
    kind: "kpi",
    hints: { valueField: "accounts" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { reduce: { accounts: { count: "accountId" } } },
    ],
  },
  {
    id: "total-events-90d",
    title: "Total events (90d)",
    kind: "kpi",
    hints: { valueField: "events" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { reduce: { events: { count: null } } },
    ],
  },
  {
    id: "weekly-visitors",
    title: "Weekly visitors (90d)",
    subtitle: "Unique visitors per week",
    kind: "line",
    colSpan: 2,
    hints: { xField: "week", yField: "visitors" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D_WEEKLY() } },
      {
        group: {
          group: ["day"],
          fields: [
            { visitors: { count: "visitorId" } },
            { accounts: { count: "accountId" } },
            { events: { count: null } },
          ],
        },
      },
      { sort: ["day"] },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        week: typeof r.day === "number"
          ? new Date(r.day as number).toISOString().slice(0, 10)
          : String(r.day ?? ""),
        visitors: Number(r.visitors ?? 0),
        accounts: Number(r.accounts ?? 0),
      })),
  },
  {
    id: "daily-events-30d",
    title: "Daily events (30d)",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "day", yField: "events" },
    build: () => [
      { source: { events: null, timeSeries: LAST_30D() } },
      {
        group: {
          group: ["day"],
          fields: [{ events: { count: null } }],
        },
      },
      { sort: ["day"] },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        day: typeof r.day === "number"
          ? new Date(r.day as number).toISOString().slice(5, 10)
          : String(r.day ?? ""),
        events: Number(r.events ?? 0),
      })),
  },
  {
    id: "top-features-90d",
    title: "Top features (90d)",
    subtitle: "Ranked by click count",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "name", yField: "clicks" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "featureId != null" },
      {
        group: {
          group: ["featureId"],
          fields: [
            { clicks: { count: null } },
            { visitors: { count: "visitorId" } },
          ],
        },
      },
      { sort: ["-clicks"] },
      { limit: 10 },
    ],
    transform: (rows, ctx) =>
      rows.map((r) => ({
        name: ctx.featureNames.get(String(r.featureId)) ?? String(r.featureId),
        clicks: Number(r.clicks ?? 0),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "top-pages-90d",
    title: "Top pages (90d)",
    subtitle: "Ranked by views",
    kind: "bar",
    colSpan: 2,
    hints: { xField: "name", yField: "views" },
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "pageId != null" },
      {
        group: {
          group: ["pageId"],
          fields: [
            { views: { count: null } },
            { visitors: { count: "visitorId" } },
          ],
        },
      },
      { sort: ["-views"] },
      { limit: 10 },
    ],
    transform: (rows, ctx) =>
      rows.map((r) => ({
        name: ctx.pageNames.get(String(r.pageId)) ?? String(r.pageId),
        views: Number(r.views ?? 0),
        visitors: Number(r.visitors ?? 0),
      })),
  },
  {
    id: "top-accounts-90d",
    title: "Most active accounts (90d)",
    subtitle: "Ranked by event count",
    kind: "table",
    colSpan: 3,
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "accountId != null" },
      {
        group: {
          group: ["accountId"],
          fields: [
            { events: { count: null } },
            { visitors: { count: "visitorId" } },
          ],
        },
      },
      { sort: ["-events"] },
      { limit: 20 },
    ],
    transform: (rows) =>
      rows.map((r) => ({
        Account: String(r.accountId ?? "—"),
        Events: Number(r.events ?? 0),
        Visitors: Number(r.visitors ?? 0),
      })),
  },
];
