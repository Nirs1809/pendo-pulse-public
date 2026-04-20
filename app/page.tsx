import {
  DashboardGrid,
  type RenderedWidget,
} from "@/components/dashboard-grid";
import {
  buildPulseContext,
  isConfigured,
  PendoApiError,
  runAggregation,
} from "@/lib/pendo";
import { PULSE_WIDGETS } from "@/lib/pulse-queries";

// Revalidate the page hourly. Underlying Pendo fetches are tagged "pendo"
// so `revalidateTag('pendo')` forces a refresh between windows.
export const revalidate = 3600;

const SUB = process.env.PENDO_SUBSCRIPTION_ID ?? "5389416346288128";
const DASHBOARD_ID =
  process.env.PENDO_DEFAULT_DASHBOARD_ID ?? "GP7dJrlLrK47XJGWRZkf6WkJjWM";

export default async function Page() {
  if (!isConfigured()) {
    return <SetupNeeded />;
  }

  // Pre-fetch metadata once; every widget gets the same context.
  const ctx = await buildPulseContext().catch((): Awaited<
    ReturnType<typeof buildPulseContext>
  > => ({
    features: [],
    pages: [],
    guides: [],
    featureNames: new Map(),
    pageNames: new Map(),
  }));

  const rendered: RenderedWidget[] = await Promise.all(
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
        return { widget, rows };
      } catch (err) {
        const message =
          err instanceof PendoApiError
            ? `Pendo ${err.status}: ${err.body.slice(0, 200)}`
            : (err as Error).message;
        return { widget, rows: [], error: message };
      }
    }),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand">
            Pendo · Sub {SUB}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Pulse Business KPIs
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            A public mirror of the Pulse dashboard. Data is pulled live from
            the Pendo Integration API and cached for 1 hour. Anyone with this
            link can view — no Pendo login required.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          <div>{ctx.guides.length} guides · refreshes hourly.</div>
          <a
            className="text-brand hover:underline"
            href={`https://app.pendo.io/s/${SUB}/dashboards/${DASHBOARD_ID}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open original in Pendo ↗
          </a>
        </div>
      </header>

      <DashboardGrid widgets={rendered} />

      <footer className="mt-10 border-t border-gray-100 pt-4 text-xs text-gray-500">
        Built with the Pendo Aggregation API. The integration key never leaves
        the server.
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
      <p className="mt-4 text-xs text-gray-500">
        In Vercel: Project → Settings → Environment Variables.
      </p>
    </main>
  );
}
