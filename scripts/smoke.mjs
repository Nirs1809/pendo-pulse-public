#!/usr/bin/env node
/**
 * Smoke test: runs each widget's aggregation pipeline against the real
 * Pendo API and prints row counts. Useful locally before deploying.
 *
 *   PENDO_INTEGRATION_KEY=... node scripts/smoke.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load .env.local into process.env
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const text = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const KEY = process.env.PENDO_INTEGRATION_KEY;
const BASE = process.env.PENDO_API_BASE || "https://app.pendo.io/api/v1";
if (!KEY) {
  console.error("PENDO_INTEGRATION_KEY is not set");
  process.exit(1);
}

// Minimal port of lib/pulse-queries.ts so this script has no build step.
const daysAgoMs = (d) => Date.now() - d * 86_400_000;
const LAST_30D = () => ({ first: daysAgoMs(30), last: "now()", period: "dayRange" });
const LAST_90D = () => ({ first: daysAgoMs(90), last: "now()", period: "dayRange" });
const LAST_90D_WEEKLY = () => ({ first: daysAgoMs(90), last: "now()", period: "weekRange" });

const widgets = [
  {
    id: "totals-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { reduce: { visitors: { count: "visitorId" }, accounts: { count: "accountId" }, events: { count: null } } },
    ],
  },
  {
    id: "total-accounts-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { reduce: { accounts: { count: "accountId" } } },
    ],
  },
  {
    id: "total-events-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { reduce: { events: { count: null } } },
    ],
  },
  {
    id: "weekly-visitors",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D_WEEKLY() } },
      { group: { group: ["day"], fields: [{ visitors: { count: "visitorId" } }, { accounts: { count: "accountId" } }, { events: { count: null } }] } },
      { sort: ["day"] },
    ],
  },
  {
    id: "daily-events-30d",
    build: () => [
      { source: { events: null, timeSeries: LAST_30D() } },
      { group: { group: ["day"], fields: [{ events: { count: null } }] } },
      { sort: ["day"] },
    ],
  },
  {
    id: "top-features-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "featureId != null" },
      { group: { group: ["featureId"], fields: [{ clicks: { count: null } }, { visitors: { count: "visitorId" } }] } },
      { sort: ["-clicks"] },
      { limit: 10 },
    ],
  },
  {
    id: "top-pages-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "pageId != null" },
      { group: { group: ["pageId"], fields: [{ views: { count: null } }, { visitors: { count: "visitorId" } }] } },
      { sort: ["-views"] },
      { limit: 10 },
    ],
  },
  {
    id: "top-accounts-90d",
    build: () => [
      { source: { events: null, timeSeries: LAST_90D() } },
      { filter: "accountId != null" },
      { group: { group: ["accountId"], fields: [{ events: { count: null } }, { visitors: { count: "visitorId" } }] } },
      { sort: ["-events"] },
      { limit: 20 },
    ],
  },
];

async function run(widget) {
  const res = await fetch(`${BASE}/aggregation`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": KEY },
    body: JSON.stringify({
      response: { mimeType: "application/json" },
      request: { name: widget.id, pipeline: widget.build() },
    }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 200) };
  const j = JSON.parse(body);
  return { ok: true, rows: j.results?.length ?? 0, sample: j.results?.[0] };
}

let ok = 0, bad = 0;
for (const w of widgets) {
  try {
    const r = await run(w);
    if (r.ok) {
      console.log(`✓ ${w.id.padEnd(22)} rows=${r.rows}  ${r.sample ? JSON.stringify(r.sample) : ""}`);
      ok++;
    } else {
      console.log(`✗ ${w.id}  HTTP ${r.status}  ${r.body}`);
      bad++;
    }
  } catch (e) {
    console.log(`✗ ${w.id}  ${e.message}`);
    bad++;
  }
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
