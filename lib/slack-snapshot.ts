import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SlackSnapshot {
  generatedAt: string;
  query: string;
  windowDays: number;
  range: { newest: string | null; oldest: string | null };
  totals: { messages: number; channels: number; authors: number };
  daily: Array<{ date: string; count: number }>;
  topChannels: Array<{ channel: string; kind: string; count: number }>;
  topAuthors: Array<{ author: string; count: number }>;
  recent: Array<{
    date: string;
    channel: string;
    author: string;
    snippet: string;
    permalink: string;
  }>;
}

let cached: SlackSnapshot | null = null;

/**
 * Load the Slack snapshot from disk. We pin the file at build/render
 * time — the widget reads pre-aggregated data because Slack searches
 * happen interactively via the Cursor MCP, not from the server.
 */
export function loadSlackSnapshot(): SlackSnapshot | null {
  if (cached) return cached;
  try {
    const path = resolve(process.cwd(), "data/slack-pulse-snapshot.json");
    const text = readFileSync(path, "utf8");
    cached = JSON.parse(text) as SlackSnapshot;
    return cached;
  } catch {
    return null;
  }
}
