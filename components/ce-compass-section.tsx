import type { CeCompassUsage } from "@/lib/types";
import { formatValue } from "@/lib/utils";
import { WidgetCard } from "./widgets/widget-card";

/**
 * Compact section showing CE Compass page + feature button usage.
 * Renders only when at least one CE Compass page or feature exists in
 * Pendo (auto-detected by /compass/i in name).
 */
export function CeCompassSection({ data }: { data: CeCompassUsage | null }) {
  if (!data) return null;
  const { page, features } = data;
  if (!page && features.length === 0) return null;

  return (
    <section className="mt-10">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="kicker">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-pendo-pink" />
            New on Pulse · CE Compass
          </span>
          <h2 className="mt-3 font-display text-xl font-semibold text-pendo-ink">
            CE Compass adoption
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-pendo-body/70">
            Page views and button clicks for the new CE Compass surface (last
            30 days).
          </p>
        </div>
      </header>

      <WidgetCard
        title={page?.name ?? "CE Compass"}
        subtitle="Page reach · button engagement"
      >
        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          {/* Page summary */}
          {page ? (
            <div className="rounded-xl border border-pendo-mist bg-pendo-cream/60 p-4">
              <div className="text-[11px] uppercase tracking-wide text-pendo-body/50">
                Page views · last 30 days
              </div>
              <div className="mt-1 flex items-end gap-3">
                <span className="font-display text-4xl font-semibold tabular-nums text-pendo-ink">
                  {formatValue(page.views)}
                </span>
                <span className="pb-1 text-sm text-pendo-body/70">views</span>
              </div>
              <div className="mt-3 text-sm text-pendo-body">
                from{" "}
                <strong className="text-pendo-ink">{page.visitors}</strong>{" "}
                distinct{" "}
                {page.visitors === 1 ? "visitor" : "visitors"}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-pendo-mist p-4 text-sm text-pendo-body/60">
              No CE Compass page detected yet.
            </div>
          )}

          {/* Feature buttons */}
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-pendo-body/50">
              Button engagement · last 30 days
            </div>
            {features.length === 0 ? (
              <p className="text-sm text-pendo-body/60">
                No CE Compass feature buttons tagged yet.
              </p>
            ) : (
              <ul className="divide-y divide-pendo-mist/60 text-sm">
                {features.map((f) => (
                  <li
                    key={f.name}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 py-2"
                  >
                    <span className="text-pendo-body">{f.name}</span>
                    <span className="text-right tabular-nums">
                      <span className="font-display font-semibold text-pendo-ink">
                        {formatValue(f.clicks)}
                      </span>
                      <span className="ml-1 text-[11px] uppercase tracking-wide text-pendo-body/50">
                        clicks
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="font-display font-semibold text-pendo-ink">
                        {formatValue(f.visitors)}
                      </span>
                      <span className="ml-1 text-[11px] uppercase tracking-wide text-pendo-body/50">
                        visitors
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </WidgetCard>
    </section>
  );
}
