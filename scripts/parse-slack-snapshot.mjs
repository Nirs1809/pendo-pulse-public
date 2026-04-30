#!/usr/bin/env node
/**
 * Parse the markdown output from `slack_search_public_and_private`
 * (response_format=detailed) into a JSON snapshot the dashboard widget
 * can consume.
 *
 * Usage:
 *   node scripts/parse-slack-snapshot.mjs <raw-pages.txt> > data/slack-pulse-snapshot.json
 *
 * The raw input file should contain the concatenated text of one or more
 * MCP tool call results (each call's "results" string).
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: parse-slack-snapshot.mjs <raw-text-file>");
  process.exit(2);
}

const raw = readFileSync(path, "utf8");

// Split into individual result blocks across all pages.
const blocks = raw
  .split(/^### Result \d+ of \d+$/m)
  .map((s) => s.trim())
  .filter(Boolean);

const seen = new Set();
const messages = [];

for (const b of blocks) {
  // Each block has "Channel:", "From:", "Time:", "Message_ts:", "Permalink:", "Text:" etc.
  const channel = match(b, /^Channel:\s*(.+?)$/m) ?? "";
  const channelId = match(b, /\(ID:\s*([A-Z0-9]+)\)/) ?? "";
  const fromName = match(b, /^From:\s*(.+?)\s*\(ID:/m) ?? "";
  const fromId = match(b, /^From:.*?\(ID:\s*([A-Z0-9]+)\)/m) ?? "";
  const time = match(b, /^Time:\s*(.+)$/m) ?? "";
  const ts = match(b, /^Message_ts:\s*([\d.]+)$/m) ?? "";
  const permalink = match(b, /^Permalink:\s*\[link\]\((.+?)\)$/m) ?? "";
  const text = (
    match(b, /^Text:\s*\n([\s\S]*?)(?:\n---\n|\n*$)/m) ??
    match(b, /^Text:\s*\n([\s\S]*)$/m) ??
    ""
  ).trim();

  // Heuristics for channel kind
  const kind = channel.startsWith("#")
    ? "channel"
    : channel.startsWith("DM")
      ? "dm"
      : channel.startsWith("Group DM")
        ? "group_dm"
        : "channel";

  // Channels with no '#' prefix (Group DMs / DMs) — make the display name
  // friendlier from the participants line.
  let display = channel;
  if (kind === "dm" || kind === "group_dm") {
    const parts = match(b, /^Participants:\s*(.+?)$/m) ?? "";
    if (parts) {
      const names = parts
        .split(",")
        .map((p) => p.replace(/\(ID:[^)]+\)/g, "").trim())
        .filter(Boolean);
      display =
        kind === "dm"
          ? `DM · ${names.filter((n) => !/Nir Sebastian/i.test(n)).join(", ")}`
          : `Group DM · ${names.filter((n) => !/Nir Sebastian/i.test(n)).join(", ")}`;
    }
  }

  if (!ts) continue;
  const dedupeKey = `${channelId}:${ts}`;
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);

  messages.push({
    ts: Number(ts),
    isoTime: parseSlackTime(time),
    channelId,
    channel: display,
    rawChannel: channel,
    kind,
    fromName,
    fromId,
    permalink,
    text: collapseWhitespace(text).slice(0, 280),
  });
}

// Sort newest first
messages.sort((a, b) => b.ts - a.ts);

const totalMessages = messages.length;
const tsRange = messages.length
  ? {
      newest: new Date(messages[0].ts * 1000).toISOString(),
      oldest: new Date(messages[messages.length - 1].ts * 1000).toISOString(),
    }
  : { newest: null, oldest: null };

const dailyMap = new Map();
for (const m of messages) {
  const day = new Date(m.ts * 1000).toISOString().slice(0, 10);
  dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
}
const daily = [...dailyMap.entries()]
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date));

const channelTally = new Map();
for (const m of messages) {
  const key = m.channel;
  if (!channelTally.has(key))
    channelTally.set(key, { channel: key, kind: m.kind, count: 0 });
  channelTally.get(key).count += 1;
}
const topChannels = [...channelTally.values()]
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);

const authorTally = new Map();
for (const m of messages) {
  const key = m.fromName || "(unknown)";
  authorTally.set(key, (authorTally.get(key) ?? 0) + 1);
}
const topAuthors = [...authorTally.entries()]
  .map(([author, count]) => ({ author, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 15);

const distinctChannels = channelTally.size;
const distinctAuthors = authorTally.size;

const recent = messages.slice(0, 50).map((m) => ({
  date: m.isoTime,
  channel: m.channel,
  author: m.fromName,
  snippet: m.text,
  permalink: m.permalink,
}));

const snapshot = {
  generatedAt: new Date().toISOString(),
  query: "pulse",
  windowDays: daysBetween(tsRange.oldest, tsRange.newest),
  range: tsRange,
  totals: {
    messages: totalMessages,
    channels: distinctChannels,
    authors: distinctAuthors,
  },
  daily,
  topChannels,
  topAuthors,
  recent,
};

process.stdout.write(JSON.stringify(snapshot, null, 2));

// ─── helpers ──────────────────────────────────────────────────────────────
function match(s, re) {
  const m = s.match(re);
  return m ? m[1].trim() : null;
}
function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}
function parseSlackTime(t) {
  // Input like "2026-04-30 09:22:05 IDT". Take the date+time, drop the tz.
  const m = t.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
  if (!m) return t;
  return `${m[1]} ${m[2]}`;
}
function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = Date.parse(b) - Date.parse(a);
  return Math.max(1, Math.round(ms / 86400000));
}
