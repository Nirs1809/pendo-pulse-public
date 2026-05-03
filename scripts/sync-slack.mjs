#!/usr/bin/env node
/**
 * Sync the Slack "Pulse mentions" snapshot used by the Pulse brand-meter
 * widget. Runs from CI (GitHub Actions) on a daily schedule and writes
 * data/slack-pulse-snapshot.json.
 *
 * Required env:
 *   SLACK_USER_TOKEN   xoxp-… token with `search:read` scope
 *
 * Optional env:
 *   SLACK_QUERY        default "pulse"
 *   SLACK_WINDOW_DAYS  default 30
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Allow local runs that source .env.local for the token.
if (existsSync(resolve(root, ".env.local"))) {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const TOKEN = process.env.SLACK_USER_TOKEN;
if (!TOKEN) {
  console.error(
    "SLACK_USER_TOKEN is not set. Generate at https://api.slack.com/apps " +
      "(scope: search:read) and store as a GitHub repo secret named SLACK_USER_TOKEN.",
  );
  process.exit(2);
}

const QUERY = process.env.SLACK_QUERY ?? "pulse";
const WINDOW_DAYS = Number(process.env.SLACK_WINDOW_DAYS ?? "30");
const SLACK = "https://slack.com/api";

const after = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
  .toISOString()
  .slice(0, 10);
const fullQuery = `${QUERY} after:${after}`;

console.log(`Searching Slack for: ${fullQuery}`);

// ─── Step 1: paginate search.messages ─────────────────────────────────────
const matches = [];
let page = 1;
let pageCount = 1;
while (page <= pageCount && page <= 30) {
  const url = new URL(`${SLACK}/search.messages`);
  url.searchParams.set("query", fullQuery);
  url.searchParams.set("count", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "timestamp");
  url.searchParams.set("sort_dir", "desc");

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  if (!j.ok) {
    console.error(`Slack search.messages failed on page ${page}: ${j.error}`);
    process.exit(1);
  }
  const list = j.messages?.matches ?? [];
  matches.push(...list);
  pageCount = j.messages?.pagination?.page_count ?? 1;
  console.log(`  page ${page}/${pageCount} → ${list.length} matches`);
  page += 1;
  // Tier-2 rate limits: be polite.
  await sleep(150);
}
console.log(`Total raw matches: ${matches.length}`);

// ─── Step 2: resolve channel + user names for display ─────────────────────
const channelIds = new Set(matches.map((m) => m.channel?.id).filter(Boolean));
const userIds = new Set(matches.map((m) => m.user).filter(Boolean));

const channelMap = new Map();
for (const id of channelIds) {
  // Channel responses already include name + is_im/is_mpim, so we only
  // need conversations.info for IDs missing those fields. For DMs the
  // search response gives `is_im=true` and `user` of the other party.
  // We still call conversations.info to get reliable names where missing.
  const r = await fetch(`${SLACK}/conversations.info?channel=${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  if (j.ok) channelMap.set(id, j.channel);
  await sleep(80);
}

const userMap = new Map();
for (const id of userIds) {
  const r = await fetch(`${SLACK}/users.info?user=${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  if (j.ok) userMap.set(id, j.user);
  await sleep(80);
}

// ─── Step 3: shape into snapshot rows ─────────────────────────────────────
const seen = new Set();
const messages = [];
for (const m of matches) {
  const tsNum = Number(m.ts);
  if (!Number.isFinite(tsNum)) continue;
  const cid = m.channel?.id ?? "";
  const dedupe = `${cid}:${m.ts}`;
  if (seen.has(dedupe)) continue;
  seen.add(dedupe);

  const ch = channelMap.get(cid) ?? m.channel ?? {};
  const isIm = ch.is_im ?? m.channel?.is_im;
  const isMpim = ch.is_mpim ?? m.channel?.is_mpim;
  let kind = "channel";
  let label = ch.name ? `#${ch.name}` : `#${cid}`;
  if (isIm) {
    kind = "dm";
    const otherId = ch.user ?? m.channel?.user;
    const other = otherId
      ? userMap.get(otherId)?.real_name ?? userMap.get(otherId)?.name ?? otherId
      : "(unknown)";
    label = `DM · ${other}`;
  } else if (isMpim) {
    kind = "group_dm";
    label = `Group DM · ${ch.name ?? cid}`;
  }

  const u = userMap.get(m.user);
  const fromName = u?.real_name ?? u?.name ?? m.username ?? "(unknown)";

  messages.push({
    ts: tsNum,
    isoTime: new Date(tsNum * 1000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " "),
    channelId: cid,
    channel: label,
    rawChannel: ch.name ?? cid,
    kind,
    fromName,
    fromId: m.user ?? "",
    permalink: m.permalink ?? "",
    text: collapse(m.text ?? "").slice(0, 280),
  });
}
messages.sort((a, b) => b.ts - a.ts);

// ─── Step 4: aggregate ────────────────────────────────────────────────────
const range = messages.length
  ? {
      newest: new Date(messages[0].ts * 1000).toISOString(),
      oldest: new Date(messages[messages.length - 1].ts * 1000).toISOString(),
    }
  : { newest: null, oldest: null };

const dailyMap = new Map();
for (const m of messages) {
  const d = new Date(m.ts * 1000).toISOString().slice(0, 10);
  dailyMap.set(d, (dailyMap.get(d) ?? 0) + 1);
}
const daily = [...dailyMap.entries()]
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date));

const channelTally = new Map();
for (const m of messages) {
  if (!channelTally.has(m.channel))
    channelTally.set(m.channel, { channel: m.channel, kind: m.kind, count: 0 });
  channelTally.get(m.channel).count += 1;
}
const topChannels = [...channelTally.values()]
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);

const authorTally = new Map();
for (const m of messages) {
  authorTally.set(m.fromName, (authorTally.get(m.fromName) ?? 0) + 1);
}
const topAuthors = [...authorTally.entries()]
  .map(([author, count]) => ({ author, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 15);

const recent = messages.slice(0, 50).map((m) => ({
  date: m.isoTime,
  channel: m.channel,
  author: m.fromName,
  snippet: m.text,
  permalink: m.permalink,
}));

const snapshot = {
  generatedAt: new Date().toISOString(),
  query: QUERY,
  windowDays: WINDOW_DAYS,
  range,
  totals: {
    messages: messages.length,
    channels: channelTally.size,
    authors: authorTally.size,
  },
  daily,
  topChannels,
  topAuthors,
  recent,
};

const out = resolve(root, "data/slack-pulse-snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `Wrote ${out} (${snapshot.totals.messages} msgs · ${snapshot.totals.channels} surfaces · ${snapshot.totals.authors} voices).`,
);

function collapse(s) {
  return s.replace(/\s+/g, " ").trim();
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
