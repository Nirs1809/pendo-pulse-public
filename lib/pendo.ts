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

// ─── Context: names + guide catalog ──────────────────────────────────────

export async function buildPulseContext(): Promise<PulseContext> {
  const [features, pages, guides] = await Promise.all([
    pendoFetch<Array<Record<string, unknown>>>(`/feature`).catch(() => []),
    pendoFetch<Array<Record<string, unknown>>>(`/page`).catch(() => []),
    pendoFetch<Array<Record<string, unknown>>>(`/guide`).catch(() => []),
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

  return { features, pages, guides, featureNames, pageNames };
}
