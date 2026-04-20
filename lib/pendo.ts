import type { AggregationResult } from "./types";

/**
 * Minimal Pendo REST client.
 *
 * Background:
 *   Pendo's public REST API (v1) exposes /feature, /page, /guide, /report
 *   and a powerful /aggregation endpoint — but it does NOT expose a
 *   "dashboard" resource. The dashboard you see at
 *     https://app.pendo.io/s/<sub>/dashboards/<id>
 *   is a UI layout only. The reports on it store a high-level "definition"
 *   (what the user picked in the UI) rather than a runnable aggregation
 *   pipeline. Pendo's own frontend compiles that definition into a pipeline
 *   at render time.
 *
 *   Because we can't run that compiler from outside, this client takes a
 *   different approach: we hand-author the aggregation pipelines that
 *   reproduce the widgets on the Pulse dashboard and submit them directly
 *   to /aggregation. See lib/pulse-queries.ts.
 *
 *   All Pendo calls happen server-side — the integration key must never
 *   reach the browser.
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

// ─── Metadata helpers (names for feature/page IDs) ────────────────────────

let featureCache: Map<string, string> | null = null;
let pageCache: Map<string, string> | null = null;

export async function getFeatureNames(): Promise<Map<string, string>> {
  if (featureCache) return featureCache;
  const feats = await pendoFetch<Array<Record<string, unknown>>>(`/feature`);
  const map = new Map<string, string>();
  for (const f of feats) {
    const id = String(f.id ?? "");
    const name = String(f.name ?? id);
    if (id) map.set(id, name);
  }
  featureCache = map;
  return map;
}

export async function getPageNames(): Promise<Map<string, string>> {
  if (pageCache) return pageCache;
  const pages = await pendoFetch<Array<Record<string, unknown>>>(`/page`);
  const map = new Map<string, string>();
  for (const p of pages) {
    const id = String(p.id ?? "");
    const name = String(p.name ?? id);
    if (id) map.set(id, name);
  }
  pageCache = map;
  return map;
}
