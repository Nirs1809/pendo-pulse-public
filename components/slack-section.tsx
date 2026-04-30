import type { SlackSnapshot } from "@/lib/slack-snapshot";
import { ChartWidget } from "./widgets/chart-widget";
import { KpiWidget } from "./widgets/kpi-widget";
import { WidgetCard } from "./widgets/widget-card";

import type { PulseWidget } from "@/lib/types";

const dummyKpiWidget = (
  title: string,
  subtitle: string,
  format?: "number" | "percent",
): PulseWidget => ({
  id: title,
  title,
  subtitle,
  kind: "kpi",
  hints: { valueField: "v", format: format ?? "number" },
});

export function SlackSection({ snapshot }: { snapshot: SlackSnapshot | null }) {
  if (!snapshot) {
    return (
      <section className="mt-10">
        <SectionHeader />
        <div className="card p-6 text-sm text-pendo-body/60">
          Slack snapshot not found. The widget appears once a snapshot is
          committed at <code>data/slack-pulse-snapshot.json</code>.
        </div>
      </section>
    );
  }

  const { totals, daily, topChannels, topAuthors, recent, generatedAt } =
    snapshot;

  return (
    <section className="mt-10">
      <SectionHeader generatedAt={generatedAt} window={snapshot.windowDays} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* KPIs */}
        <KpiWidget
          widget={dummyKpiWidget("Pulse mentions", `last ${snapshot.windowDays} days`)}
          rows={[{ v: totals.messages }]}
        />
        <KpiWidget
          widget={dummyKpiWidget(
            "Channels & DMs",
            "distinct surfaces talking about Pulse",
          )}
          rows={[{ v: totals.channels }]}
        />
        <KpiWidget
          widget={dummyKpiWidget("Authors", "distinct people")}
          rows={[{ v: totals.authors }]}
        />

        {/* Daily trend */}
        <div className="md:col-span-2 xl:col-span-3">
          <ChartWidget
            title="Pulse mentions per day"
            subtitle={`Slack search · "${snapshot.query}" · ${snapshot.windowDays}-day window`}
            kind="line"
            hints={{ xField: "date", yField: "count" }}
            rows={daily.map((d) => ({
              date: d.date.slice(5),
              count: d.count,
            }))}
          />
        </div>

        {/* Top channels */}
        <div className="md:col-span-2 xl:col-span-2">
          <ChartWidget
            title="Top Slack channels & DMs"
            subtitle="Where Pulse comes up most"
            kind="bar"
            hints={{ xField: "channel", yField: "count" }}
            rows={topChannels.slice(0, 10).map((c) => ({
              channel: c.channel.length > 26 ? c.channel.slice(0, 25) + "…" : c.channel,
              count: c.count,
            }))}
          />
        </div>

        {/* Top authors as a small table */}
        <div className="md:col-span-2 xl:col-span-1">
          <WidgetCard
            title="Top voices"
            subtitle="Authors mentioning Pulse most"
            className="min-h-[280px]"
          >
            <ol className="space-y-1 text-sm">
              {topAuthors.slice(0, 8).map((a, i) => (
                <li
                  key={a.author}
                  className="flex items-center justify-between border-b border-pendo-mist/50 py-1.5 last:border-0"
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

        {/* Recent mentions — full width, custom rendering so the Slack
            permalink can be a real <a>. */}
        <div className="md:col-span-2 xl:col-span-3">
          <RecentMentions rows={recent} />
        </div>
      </div>
    </section>
  );
}

function RecentMentions({
  rows,
}: {
  rows: SlackSnapshot["recent"];
}) {
  return (
    <WidgetCard
      title="Recent Pulse mentions"
      subtitle={`${rows.length} most recent · open in Slack to read in context`}
      className="min-h-[220px]"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-pendo-body/60">No mentions yet.</p>
      ) : (
        <ul className="-mt-2 divide-y divide-pendo-mist/60">
          {rows.map((r, i) => (
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
      )}
    </WidgetCard>
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
          Slack · Pulse mentions
        </span>
        <h2 className="mt-3 font-display text-xl font-semibold text-pendo-ink">
          How much Pulse is talked about
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-pendo-body/70">
          Aggregated from Slack search results across all channels and DMs the
          authenticated user can read. Refresh by asking the assistant to
          regenerate the snapshot.
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

