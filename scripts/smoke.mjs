#!/usr/bin/env node
/**
 * Smoke test: runs each Pulse-scoped pipeline against the real Pendo API
 * and prints row counts / samples. Run before deploying:
 *
 *   PENDO_INTEGRATION_KEY=... node scripts/smoke.mjs
 *
 * The app scope defaults to Pulse (6561780136607744). Override with
 * PENDO_APP_ID=<appId>.
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
const APP_ID = process.env.PENDO_APP_ID || "6561780136607744";
const APP = `metadata.auto_${APP_ID}`;
if (!KEY) {
  console.error("PENDO_INTEGRATION_KEY is not set");
  process.exit(1);
}

const DAY_MS = 86_400_000;
const ms = (days) => Date.now() - days * DAY_MS;

const widgets = [
  ["pulse-total-visitors", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit != null` },
    { reduce: { total: { count: null } } },
  ]],
  ["pulse-active-30d", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(30)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["pulse-active-7d", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(7)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["pulse-active-1d", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(1)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["pulse-new-30d", [
    { source: { visitors: null } },
    { filter: `${APP}.firstvisit >= ${ms(30)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["pulse-dau-30d", [
    {
      source: {
        events: { appId: Number(APP_ID) },
        timeSeries: { first: ms(30), last: "now()", period: "dayRange" },
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
  ]],
  ["pulse-new-visitors-90d", [
    { source: { visitors: null } },
    { filter: `${APP}.firstvisit >= ${ms(90)}` },
    { eval: { day: `${APP}.firstvisit - ${APP}.firstvisit % ${DAY_MS}` } },
    { group: { group: ["day"], fields: [{ newVisitors: { count: null } }] } },
    { sort: ["day"] },
  ]],
  ["pulse-by-hierarchy", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit != null && metadata.agent.hierarchy != null` },
    { group: { group: ["metadata.agent.hierarchy"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 10 },
  ]],
  ["pulse-by-department", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit != null && metadata.agent.department_role != null` },
    { group: { group: ["metadata.agent.department_role"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 20 },
  ]],
  ["pulse-titles-14d", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(14)} && metadata.agent.title != null` },
    { group: { group: ["metadata.agent.title"], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 100 },
  ]],
  ["pulse-top-browsers", [
    { source: { visitors: null } },
    { filter: `${APP}.lastbrowsername != null && ${APP}.lastbrowsername != "unknown"` },
    { group: { group: [`${APP}.lastbrowsername`], fields: [{ visitors: { count: null } }] } },
    { sort: ["-visitors"] }, { limit: 8 },
  ]],
  ["pulse-recent-visitors", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit != null` },
    { select: {
        visitorId: "visitorId",
        name: "metadata.agent.full_name",
        title: "metadata.agent.title",
        hierarchy: "metadata.agent.hierarchy",
        firstVisit: `${APP}.firstvisit`,
        lastVisit: `${APP}.lastvisit`,
      } },
    { sort: ["-lastVisit"] }, { limit: 25 },
  ]],
  ["stickiness-dau", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(1)}` },
    { reduce: { total: { count: null } } },
  ]],
  ["stickiness-mau", [
    { source: { visitors: null } },
    { filter: `${APP}.lastvisit >= ${ms(30)}` },
    { reduce: { total: { count: null } } },
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

console.log(`Smoke testing Pulse app ${APP_ID}\n`);

let ok = 0, bad = 0;
for (const [name, pipe] of widgets) {
  try {
    const r = await run(name, pipe);
    if (r.ok) {
      console.log(`✓ ${name.padEnd(26)} rows=${String(r.rows).padStart(4)}  ${r.sample ? JSON.stringify(r.sample).slice(0, 120) : ""}`);
      ok++;
    } else {
      console.log(`✗ ${name.padEnd(26)} HTTP ${r.status}  ${r.body}`);
      bad++;
    }
  } catch (e) {
    console.log(`✗ ${name.padEnd(26)} ${e.message}`);
    bad++;
  }
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
