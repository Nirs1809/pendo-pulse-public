import type { SlackSnapshot } from "@/lib/slack-snapshot";
import { ChartWidget } from "./widgets/chart-widget";
import { Sparkline } from "./widgets/sparkline";
import { WidgetCard } from "./widgets/widget-card";

export function SlackSection({ snapshot }: { snapshot: SlackSnapshot | null }) {
  if (!snapshot) {
    return (
      <section className="mt-12">
        <SectionHeader />
        <div className="card p-6 text-sm text-pendo-body/60">
          Slack snapshot not found. Refresh by asking the assistant to
          regenerate <code>data/slack-pulse-snapshot.json</code>.
        </div>
      </section>
    );
  }

  const { totals, daily, topChannels, topAuthors, recent, generatedAt } =
    snapshot;
  const m = computeMeter(snapshot);

  return (
    <section className="mt-12">
      <SectionHeader generatedAt={generatedAt} window={snapshot.windowDays} />

      {/* Headline meter — a single visceral statement of brand reach. */}
      <div className="card mb-4 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.1fr_2fr]">
          <div className="border-b border-pendo-mist p-6 md:border-b-0 md:border-r">
            <div className="flex items-end gap-3">
              <span className="font-display text-6xl font-semibold tracking-tight text-pendo-ink">
                {totals.messages}
              </span>
              <span className="pb-2 text-sm text-pendo-body/70">
                mentions
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-pendo-body">
              <strong className="text-pendo-ink">{totals.authors}</strong>{" "}
              voices spread across{" "}
              <strong className="text-pendo-ink">{totals.channels}</strong>{" "}
              channels &amp; DMs in the last{" "}
              <strong className="text-pendo-ink">
                {snapshot.windowDays}
              </strong>{" "}
              days.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-4 text-xs">
              <Stat label="per day" value={m.avgPerDay} />
              <Stat
                label="days active"
                value={`${m.daysActive}/${snapshot.windowDays}`}
              />
              <Stat
                label="momentum"
                value={m.momentumLabel}
                tone={m.momentumTone}
              />
            </div>
          </div>
          <div className="p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-pendo-body/50">
              Daily mentions · {snapshot.windowDays}-day window
            </div>
            <div className="h-48 w-full">
              <Sparkline
                xField="date"
                yField="count"
                data={daily.map((d) => ({
                  date: d.date.slice(5),
                  count: d.count,
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spread + Top channels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <WidgetCard
          title="Where Pulse spreads"
          subtitle="By surface type"
          className="md:col-span-1"
        >
          <DonutSurfaceMix data={m.surfaceMix} />
        </WidgetCard>

        <div className="md:col-span-2">
          <ChartWidget
            title="Top channels & DMs"
            subtitle="Volume of Pulse mentions per surface"
            kind="bar"
            hints={{ xField: "channel", yField: "count" }}
            rows={topChannels.slice(0, 10).map((c) => ({
              channel:
                c.channel.length > 26
                  ? c.channel.slice(0, 25) + "…"
                  : c.channel,
              count: c.count,
            }))}
          />
        </div>
      </div>

      {/* Top voices */}
      <div className="mt-4">
        <WidgetCard
          title="Top voices talking about Pulse"
          subtitle={`${topAuthors.length} contributors · ranked by mention count`}
        >
          <ol className="grid gap-1 text-sm md:grid-cols-2">
            {topAuthors.slice(0, 12).map((a, i) => (
              <li
                key={a.author}
                className="flex items-center justify-between border-b border-pendo-mist/50 py-1.5 last:border-0 md:[&:nth-last-child(2)]:border-0"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-pendo-palepink text-[11px] font-medium text-pendo-wine">
                    {i + 1}
                  </span>
                  <span className="text-pendo-body">{a.author}</span>
                </span>
                <span className="font-display tabular-nums text-pendo-ink">
                  {a.count}
                </span>
              </li>
            ))}
          </ol>
        </WidgetCard>
      </div>

      {/* Recent mentions are now optional — collapsed by default. */}
      <details className="card mt-4 overflow-hidden">
        <summary className="card-header cursor-pointer list-none select-none">
          <div>
            <h3 className="card-title">Recent mentions (optional)</h3>
            <p className="card-subtitle mt-0.5">
              {recent.length} most recent — click to expand
            </p>
          </div>
          <span className="font-display text-xs text-pendo-pink">
            Show ▸
          </span>
        </summary>
        <ul className="divide-y divide-pendo-mist/60 px-5 pb-4">
          {recent.map((r, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-pendo-body/60">
                <span className="font-medium text-pendo-ink">{r.author}</span>
                <span>·</span>
                <span className="font-display text-pendo-pink">
                  {r.channel}
                </span>
                <span>·</span>
                <span>{r.date}</span>
                {r.permalink ? (
                  <a
                    href={r.permalink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-auto inline-flex items-center gap-1 text-pendo-pink hover:text-pendo-wine"
                  >
                    Open in Slack ↗
                  </a>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-pendo-body">
                {r.snippet}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function SectionHeader({
  generatedAt,
  window,
}: {
  generatedAt?: string;
  window?: number;
} = {}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <span className="kicker">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pendo-pink" />
          Pulse brand meter · Slack
        </span>
        <h2 className="mt-3 font-display text-2xl font-semibold text-pendo-ink">
          How far Pulse is reaching inside Pendo
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-pendo-body/70">
          Aggregated mentions across all channels and DMs the authenticated
          user can read. Higher numbers = wider conversation surface.
        </p>
      </div>
      {generatedAt ? (
        <div className="text-right font-display text-xs text-pendo-body/60">
          Snapshot · {generatedAt.slice(0, 16).replace("T", " ")} UTC
          {window ? <div>{window}-day window</div> : null}
        </div>
      ) : null}
    </header>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-pendo-wine"
        : "text-pendo-ink";
  return (
    <div className="rounded-lg border border-pendo-mist/80 bg-pendo-cream/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-pendo-body/50">
        {label}
      </div>
      <div className={`mt-0.5 font-display text-base font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function DonutSurfaceMix({
  data,
}: {
  data: Array<{ name: string; count: number }>;
}) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0)
    return (
      <p className="text-sm text-pendo-body/60">No mentions in this window.</p>
    );

  // Single horizontal stacked bar — minimal, on-brand alternative to a pie.
  const tones = [
    "bg-pendo-pink",
    "bg-pendo-wine",
    "bg-pendo-softpink",
    "bg-pendo-palepink",
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-pendo-mist">
        {data.map((d, i) => {
          const pct = (d.count / total) * 100;
          return (
            <div
              key={d.name}
              title={`${d.name}: ${d.count}`}
              className={tones[i % tones.length]}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => {
          const pct = ((d.count / total) * 100).toFixed(0);
          return (
            <li key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${tones[i % tones.length]}`}
                />
                <span className="text-pendo-body">{d.name}</span>
              </span>
              <span className="font-display tabular-nums text-pendo-ink">
                {d.count}{" "}
                <span className="text-pendo-body/50">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface MeterStats {
  avgPerDay: string;
  daysActive: number;
  momentumLabel: string;
  momentumTone: "good" | "bad" | "neutral";
  surfaceMix: Array<{ name: string; count: number }>;
}

function computeMeter(snapshot: SlackSnapshot): MeterStats {
  const { totals, daily, topChannels, windowDays } = snapshot;

  const avgPerDay = (totals.messages / Math.max(windowDays, 1)).toFixed(1);
  const daysActive = daily.filter((d) => d.count > 0).length;

  // Momentum: last 7 days vs prior portion of window. Compare per-day
  // averages so a longer prior window doesn't artificially weigh up.
  const sorted = daily.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const prior = sorted.slice(0, Math.max(0, sorted.length - 7));
  const sum = (rows: typeof sorted) =>
    rows.reduce((acc, r) => acc + r.count, 0);
  const last7Avg = last7.length ? sum(last7) / last7.length : 0;
  const priorAvg = prior.length ? sum(prior) / prior.length : 0;
  let momentumLabel = "—";
  let momentumTone: "good" | "bad" | "neutral" = "neutral";
  if (priorAvg > 0) {
    const change = ((last7Avg - priorAvg) / priorAvg) * 100;
    momentumLabel = `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
    momentumTone = change > 5 ? "good" : change < -5 ? "bad" : "neutral";
  } else if (last7Avg > 0) {
    momentumLabel = "new";
    momentumTone = "good";
  }

  // Surface mix: bucket channel counts into Public / Private / DMs / Group DMs.
  const buckets: Record<string, number> = {
    "Public channels": 0,
    "DMs": 0,
    "Group DMs": 0,
  };
  for (const c of topChannels) {
    if (c.kind === "dm") buckets["DMs"] += c.count;
    else if (c.kind === "group_dm") buckets["Group DMs"] += c.count;
    else buckets["Public channels"] += c.count;
  }
  const surfaceMix = Object.entries(buckets)
    .map(([name, count]) => ({ name, count }))
    .filter((b) => b.count > 0);

  return { avgPerDay, daysActive, momentumLabel, momentumTone, surfaceMix };
}
