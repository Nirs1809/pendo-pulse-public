#!/usr/bin/env node
/**
 * Smoke test: runs each widget's pipeline against the real Pendo API
 * and prints row counts / samples. Run before deploying:
 *
 *   PENDO_INTEGRATION_KEY=... node scripts/smoke.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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

const DAY_MS = 86_400_000;
const ms = (days) => Date.now() - days * DAY_MS;

const widgets = [
  ["total-visitors", [
    { source: { visitors: null } },
    { reduce: { total: { count: null } } },
  ]],
  ["total-accounts", [
    { source: { accounts: null } },
    { reduce: { total: { count: null } } },
  ]],
  ["active-30d", [
    { source: { visitors: null } },
    { filter: `metadata.auto.lastvisit >= ${ms(30)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["active-7d", [
    { source: { visitors: null } },
    { filter: `metadata.auto.lastvisit >= ${ms(7)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["dau-30d", [
    { source: { visitors: null } },
    { filter: `metadata.auto.lastvisit >= ${ms(30)}` },
    { eval: { day: "metadata.auto.lastvisit - metadata.auto.lastvisit % 86400000" } },
    { group: { group: ["day"], fields: [{ visitors: { count: null } }] } },
    { sort: ["day"] },
  ]],
  ["new-visitors-90d", [
    { source: { visitors: null } },
    { filter: `metadata.auto.firstvisit >= ${ms(90)}` },
    { eval: { day: "metadata.auto.firstvisit - metadata.auto.firstvisit % 86400000" } },
    { group: { group: ["day"], fields: [{ newVisitors: { count: null } }] } },
    { sort: ["day"] },
  ]],
  ["top-accounts", [
    { source: { visitors: null } },
    { filter: "metadata.auto.accountids != null" },
    { unwind: { field: "metadata.auto.accountids" } },
    { group: { group: ["metadata.auto.accountids"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 10 },
  ]],
  ["top-browsers", [
    { source: { visitors: null } },
    { filter: 'metadata.auto.lastbrowsername != null && metadata.auto.lastbrowsername != "unknown"' },
    { group: { group: ["metadata.auto.lastbrowsername"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 8 },
  ]],
  ["top-hosts", [
    { source: { visitors: null } },
    { filter: 'metadata.auto.lastservername != null && !startsWith(metadata.auto.lastservername, "__")' },
    { group: { group: ["metadata.auto.lastservername"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 10 },
  ]],
  ["accounts-table", [
    { source: { accounts: null } },
    { select: { accountId: "accountId", firstVisit: "metadata.auto.firstvisit", lastVisit: "metadata.auto.lastvisit" } },
  ]],
];

async function run(name, pipeline) {
  const res = await fetch(`${BASE}/aggregation`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pendo-integration-key": KEY },
    body: JSON.stringify({
      response: { mimeType: "application/json" },
      request: { name, pipeline },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 200) };
  const j = JSON.parse(text);
  return { ok: true, rows: j.results?.length ?? 0, sample: j.results?.[0] };
}

async function guidesCount() {
  const res = await fetch(`${BASE}/guide`, {
    headers: { "x-pendo-integration-key": KEY },
  });
  if (!res.ok) return -1;
  const j = await res.json();
  return Array.isArray(j) ? j.length : -1;
}

let ok = 0, bad = 0;
for (const [name, pipe] of widgets) {
  try {
    const r = await run(name, pipe);
    if (r.ok) {
      console.log(`✓ ${name.padEnd(22)} rows=${String(r.rows).padStart(4)}  ${r.sample ? JSON.stringify(r.sample).slice(0, 140) : ""}`);
      ok++;
    } else {
      console.log(`✗ ${name.padEnd(22)} HTTP ${r.status}  ${r.body}`);
      bad++;
    }
  } catch (e) {
    console.log(`✗ ${name.padEnd(22)} ${e.message}`);
    bad++;
  }
}
const gc = await guidesCount();
console.log(`✓ ${"guides (meta)".padEnd(22)} count=${gc}`);
console.log(`\n${ok} aggregation widgets passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
