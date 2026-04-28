import type { AggregationResult, PulseContext } from "./types";

/**
 * Minimal Pendo REST client.
 *
 * The public REST API does not expose dashboards. Widgets in this app
 * therefore hand-author pipelines against /aggregation directly
 * (see lib/pulse-queries.ts). This module wraps the REST calls plus
 * the metadata fetches (features / pages / guides) that we use both
 * for name-resolution and for the guide-state pie.
 *
 * All calls happen server-side — the integration key must never reach
 * the browser.
 */

const BASE = process.env.PENDO_API_BASE ?? "https://app.pendo.io/api/v1";

export class PendoApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Pendo API ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

function getKey(): string {
  const key = process.env.PENDO_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "PENDO_INTEGRATION_KEY is not set. Add it to your environment (see .env.example).",
    );
  }
  return key;
}

export function isConfigured(): boolean {
  return Boolean(process.env.PENDO_INTEGRATION_KEY);
}

async function pendoFetch<T>(
  path: string,
  init: RequestInit = {},
  revalidateSeconds = 3600,
): Promise<T> {
  const key = getKey();
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-pendo-integration-key": key,
      ...(init.headers ?? {}),
    },
    next: { revalidate: revalidateSeconds, tags: ["pendo"] },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PendoApiError(res.status, body);
  }
  return (await res.json()) as T;
}

// ─── Aggregation ──────────────────────────────────────────────────────────

export async function runAggregation(
  name: string,
  pipeline: unknown[],
): Promise<AggregationResult> {
  const raw = await pendoFetch<{ results?: Array<Record<string, unknown>> }>(
    `/aggregation`,
    {
      method: "POST",
      body: JSON.stringify({
        response: { mimeType: "application/json" },
        request: { name, pipeline },
      }),
    },
  );
  return { rows: raw.results ?? [], raw };
}

// ─── Context: names + guide catalog + Pulse event counts ────────────────

const DAY_MS = 86_400_000;

export async function buildPulseContext(): Promise<PulseContext> {
  const appId = Number(process.env.PENDO_APP_ID ?? "6561780136607744");
  const since = Date.now() - 30 * DAY_MS;

  const ts = { first: since, last: "now()" as const, period: "dayRange" as const };
  const since14 = Date.now() - 14 * DAY_MS;

  // Use ?appId so we get the Pulse-scoped feature catalog (59 features)
  // rather than the integration-key default (only 13 test-app features).
  const [
    features,
    pages,
    guides,
    clickRows,
    viewRows,
    deptVisitorRows,
  ] = await Promise.all([
    pendoFetch<Array<Record<string, unknown>>>(
      `/feature?appId=${appId}`,
    ).catch(() => []),
    pendoFetch<Array<Record<string, unknown>>>(`/page?appId=${appId}`).catch(
      () => [],
    ),
    pendoFetch<Array<Record<string, unknown>>>(`/guide`).catch(() => []),
    runAggregation("ctx-pulse-feature-clicks-per-visitor", [
      { source: { featureEvents: { appId }, timeSeries: ts } },
      {
        group: {
          group: ["visitorId"],
          fields: [{ clicks: { count: null } }],
        },
      },
    ])
      .then((r) => r.rows)
      .catch(() => []),
    runAggregation("ctx-pulse-page-views-per-visitor", [
      { source: { pageEvents: { appId }, timeSeries: ts } },
      {
        group: {
          group: ["visitorId"],
          fields: [{ views: { count: null } }],
        },
      },
    ])
      .then((r) => r.rows)
      .catch(() => []),
    runAggregation("ctx-pulse-dept-visitors-14d", [
      { source: { visitors: null } },
      {
        filter: `metadata.auto_${appId}.lastvisit >= ${since14} && metadata.agent.department_role != null`,
      },
      {
        select: {
          visitorId: "visitorId",
          name: "metadata.agent.full_name",
          title: "metadata.agent.title",
          hierarchy: "metadata.agent.hierarchy",
          role: "metadata.agent.department_role",
          lastVisit: `metadata.auto_${appId}.lastvisit`,
        },
      },
      { sort: ["-lastVisit"] },
    ])
      .then((r) => r.rows)
      .catch(() => []),
  ]);

  const featureNames = new Map<string, string>();
  for (const f of features) {
    const id = String(f.id ?? "");
    if (id) featureNames.set(id, String(f.name ?? id));
  }
  const pageNames = new Map<string, string>();
  for (const p of pages) {
    const id = String(p.id ?? "");
    if (id) pageNames.set(id, String(p.name ?? id));
  }

  const pulseEventCounts = new Map<string, number>();
  for (const r of clickRows) {
    const id = String(r.visitorId ?? "");
    if (!id) continue;
    pulseEventCounts.set(
      id,
      (pulseEventCounts.get(id) ?? 0) + Number(r.clicks ?? 0),
    );
  }
  for (const r of viewRows) {
    const id = String(r.visitorId ?? "");
    if (!id) continue;
    pulseEventCounts.set(
      id,
      (pulseEventCounts.get(id) ?? 0) + Number(r.views ?? 0),
    );
  }

  // Group dept-role visitors by pretty-cased role for the expandable table.
  const pulseVisitorsByDept: Record<
    string,
    Array<Record<string, unknown>>
  > = {};
  for (const r of deptVisitorRows) {
    const rawRole = String(r.role ?? "");
    if (!rawRole) continue;
    const key = prettyDeptLabel(rawRole);
    if (!pulseVisitorsByDept[key]) pulseVisitorsByDept[key] = [];
    pulseVisitorsByDept[key].push({
      Visitor: String(r.visitorId ?? "—"),
      Name: String(r.name ?? "—"),
      Title: String(r.title ?? "—"),
      Hierarchy: prettyDeptLabel(String(r.hierarchy ?? "—")),
      "Events (30d)": pulseEventCounts.get(String(r.visitorId ?? "")) ?? 0,
      "Last visit": r.lastVisit
        ? new Date(Number(r.lastVisit))
            .toISOString()
            .slice(0, 16)
            .replace("T", " ")
        : "—",
    });
  }

  // Canary feature usage: filter by /canary/i in the feature name and run
  // a single per-feature aggregation (no-op if there are no Canary features).
  const canaryFeatures = features.filter((f) =>
    /canary/i.test(String(f.name ?? "")),
  );
  let canaryFeatureUsage: Array<Record<string, unknown>> = [];
  if (canaryFeatures.length > 0) {
    const idFilter = canaryFeatures
      .map((f) => `featureId == "${String(f.id)}"`)
      .join(" || ");
    const r = await runAggregation("ctx-canary-usage-30d", [
      { source: { featureEvents: { appId }, timeSeries: ts } },
      { filter: idFilter },
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
    ]).catch(() => ({ rows: [] }));

    const nameById = new Map(
      canaryFeatures.map((f) => [String(f.id), String(f.name)]),
    );
    const seen = new Set<string>();
    for (const row of r.rows) {
      const id = String(row.featureId ?? "");
      seen.add(id);
      canaryFeatureUsage.push({
        Feature: nameById.get(id) ?? id,
        Clicks: Number(row.clicks ?? 0),
        Visitors: Number(row.visitors ?? 0),
      });
    }
    // Surface zero-activity Canary features explicitly so it's clear
    // which ones haven't been touched yet.
    for (const f of canaryFeatures) {
      if (!seen.has(String(f.id))) {
        canaryFeatureUsage.push({
          Feature: String(f.name ?? f.id),
          Clicks: 0,
          Visitors: 0,
        });
      }
    }
    canaryFeatureUsage.sort(
      (a, b) => Number(b.Clicks ?? 0) - Number(a.Clicks ?? 0),
    );
  }

  return {
    features,
    pages,
    guides,
    featureNames,
    pageNames,
    pulseEventCounts,
    pulseVisitorsByDept,
    canaryFeatureUsage,
  };
}

// Pretty-label for snake_case role strings; preserves common acronyms.
const DEPT_ACRONYMS = new Set([
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
]);

function prettyDeptLabel(s: string): string {
  if (!s || s === "—") return s;
  return s
    .split("_")
    .map((w) => {
      if (!w) return w;
      if (DEPT_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}
