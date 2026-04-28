import {
  DashboardGrid,
  type RenderedWidget,
} from "@/components/dashboard-grid";
import { LastRefreshed } from "@/components/last-refreshed";
import {
  buildPulseContext,
  isConfigured,
  PendoApiError,
  runAggregation,
} from "@/lib/pendo";
import { PULSE_WIDGETS } from "@/lib/pulse-queries";
import type { PulseWidget } from "@/lib/types";

// Revalidate the page hourly. Underlying Pendo fetches are tagged "pendo"
// so `revalidateTag('pendo')` forces a refresh between windows.
export const revalidate = 3600;

const SUB = process.env.PENDO_SUBSCRIPTION_ID ?? "5389416346288128";
const DASHBOARD_ID =
  process.env.PENDO_DEFAULT_DASHBOARD_ID ?? "GP7dJrlLrK47XJGWRZkf6WkJjWM";
const APP_ID = process.env.PENDO_APP_ID ?? "6561780136607744";
const APP = `metadata.auto_${APP_ID}`;
const DAY_MS = 86_400_000;

export default async function Page() {
  if (!isConfigured()) {
    return <SetupNeeded />;
  }

  // Stamp now — re-evaluates every time ISR rebuilds the page (≤ 1 hour).
  const renderedAt = new Date().toISOString();

  const ctx = await buildPulseContext().catch((): Awaited<
    ReturnType<typeof buildPulseContext>
  > => ({
    features: [],
    pages: [],
    guides: [],
    featureNames: new Map(),
    pageNames: new Map(),
    pulseEventCounts: new Map(),
    pulseVisitorsByDept: {},
    canaryFeatureUsage: [],
  }));

  const widgetResults: RenderedWidget[] = await Promise.all(
    PULSE_WIDGETS.map(async (widget) => {
      try {
        let rows: Array<Record<string, unknown>> = [];
        if (widget.build) {
          rows = (await runAggregation(widget.id, widget.build())).rows;
        } else if (widget.run) {
          rows = await widget.run(ctx);
        }
        if (widget.transform) {
          rows = await widget.transform(rows, ctx);
        }
        const result: RenderedWidget = { widget, rows };
        // Wire the dept-role table to expand into the per-role visitor list.
        if (widget.id === "pulse-dept-14d") {
          result.expandable = {
            keyColumn: "Department role",
            rowsByKey: ctx.pulseVisitorsByDept,
          };
        }
        return result;
      } catch (err) {
        const message =
          err instanceof PendoApiError
            ? `Pendo ${err.status}: ${err.body.slice(0, 200)}`
            : (err as Error).message;
        return { widget, rows: [], error: message };
      }
    }),
  );

  // Derived stickiness KPI: WAU / MAU. Captures the share of monthly
  // actives who came back within the last week — a more forgiving and
  // commonly-reported stickiness metric than DAU/MAU.
  let stickinessWidget: RenderedWidget | null = null;
  try {
    const [wau, mau] = await Promise.all([
      runAggregation("stickiness-wau", [
        { source: { visitors: null } },
        { filter: `${APP}.lastvisit >= ${Date.now() - 7 * DAY_MS}` },
        { reduce: { total: { count: null } } },
      ]),
      runAggregation("stickiness-mau", [
        { source: { visitors: null } },
        { filter: `${APP}.lastvisit >= ${Date.now() - 30 * DAY_MS}` },
        { reduce: { total: { count: null } } },
      ]),
    ]);
    const wauCount = Number(wau.rows[0]?.total ?? 0);
    const mauCount = Number(mau.rows[0]?.total ?? 0);
    const pct = mauCount > 0 ? wauCount / mauCount : 0;
    const widget: PulseWidget = {
      id: "pulse-stickiness",
      title: "Stickiness",
      subtitle: `WAU ${wauCount} / MAU ${mauCount}`,
      kind: "kpi",
      hints: { valueField: "pct", format: "percent" },
    };
    stickinessWidget = { widget, rows: [{ pct }] };
  } catch {
    // If stickiness fails, skip it silently rather than block the page.
  }

  // Insert stickiness after the 30-day active card so it flows naturally.
  const renderOrder: RenderedWidget[] = [];
  for (const r of widgetResults) {
    renderOrder.push(r);
    if (stickinessWidget && r.widget.id === "pulse-active-30d") {
      renderOrder.push(stickinessWidget);
      stickinessWidget = null;
    }
  }
  if (stickinessWidget) renderOrder.push(stickinessWidget);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-8">
      <header className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="kicker">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-pendo-pink" />
            Pulse · Subscription {SUB}
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-pendo-ink md:text-5xl">
            Pulse Business KPIs
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-pendo-body/80">
            A public mirror of the Pulse dashboard, scoped to the Pulse app
            only. Data is pulled live from the Pendo Integration API and
            cached for one hour. Anyone with this link can view — no Pendo
            login required.
          </p>
        </div>
        <div className="text-right font-display text-xs text-pendo-body/70">
          <div className="flex items-center justify-end gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pendo-pink opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pendo-pink" />
            </span>
            <LastRefreshed iso={renderedAt} />
          </div>
          <div className="mt-0.5 text-pendo-body/50">
            Auto-refresh every hour
          </div>
          <a
            className="mt-2 inline-flex items-center gap-1 font-medium text-pendo-pink transition hover:text-pendo-wine"
            href={`https://app.pendo.io/s/${SUB}/dashboards/${DASHBOARD_ID}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open original in Pendo ↗
          </a>
        </div>
      </header>

      <DashboardGrid widgets={renderOrder} />

      <footer className="mt-14 border-t border-pendo-mist pt-5 text-xs text-pendo-body/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Built with the Pendo Aggregation API. App ID{" "}
            <code className="rounded bg-pendo-beige px-1">{APP_ID}</code> —
            change via <code>PENDO_APP_ID</code>. The integration key never
            leaves the server.
          </span>
          <a
            href="https://www.pendo.io/"
            target="_blank"
            rel="noreferrer noopener"
            className="font-display font-semibold text-pendo-wine hover:text-pendo-pink"
          >
            pendo.io ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function SetupNeeded() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-xl font-semibold text-gray-900">
        Integration key not configured
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Set <code>PENDO_INTEGRATION_KEY</code> in your deployment environment
        and redeploy.
      </p>
    </main>
  );
}
