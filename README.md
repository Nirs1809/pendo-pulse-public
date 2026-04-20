# Share the Pulse Pendo dashboard publicly

A small Next.js app that exposes a **public, read-only mirror** of the
Pulse dashboard from Pendo sub `5389416346288128`. Anyone you share the
URL with can view it — no Pendo login required.

**Original dashboard** (sub-gated):
<https://app.pendo.io/s/5389416346288128/dashboards/GP7dJrlLrK47XJGWRZkf6WkJjWM>

## How it works

Pendo's public REST API does **not** expose dashboards — dashboards are a
UI-only concept. So instead of proxying the dashboard, this app:

1. Ships a curated set of widgets (`lib/pulse-queries.ts`) that
   reproduce the key Pulse metrics: totals, weekly visitors, daily
   events, top features, top pages, most active accounts.
2. Each widget is a hand-authored **aggregation pipeline** submitted to
   Pendo's `POST /api/v1/aggregation` endpoint at render time.
3. Results are cached by Next.js ISR for **1 hour**.
4. Widgets render as KPI tiles, line / bar charts, or tables.

The Pendo Integration Key lives only in server env — the browser never
sees it.

---

## Deploy to Vercel (recommended)

1. Push this repo to GitHub (or Vercel's Git integration of choice).
2. In Vercel: *Add New → Project → import this repo*.
3. Add the env var `PENDO_INTEGRATION_KEY` (value from Pendo Settings →
   Integrations → Integration Keys — a read-only key is enough).
4. Deploy. Your share URL will be `https://<app>.vercel.app`.

Optional env vars:

| Name | Default | Purpose |
| --- | --- | --- |
| `PENDO_API_BASE` | `https://app.pendo.io/api/v1` | Switch to `https://app.eu.pendo.io/api/v1` or `https://us2.pendo.io/api/v1` if your sub is on EU/US2 |
| `PENDO_SUBSCRIPTION_ID` | `5389416346288128` | Shown in the UI header |
| `PENDO_DEFAULT_DASHBOARD_ID` | `GP7dJrlLrK47XJGWRZkf6WkJjWM` | Used for the "Open original in Pendo" link |
| `REVALIDATE_SECRET` | — | Enables `POST /api/revalidate?secret=...` to force a cache bust |

---

## Local development

```bash
cp .env.example .env.local
# add your PENDO_INTEGRATION_KEY
npm install
npm run dev
# open http://localhost:3000
```

Force-refresh the cache (if `REVALIDATE_SECRET` is set):

```bash
curl -X POST "http://localhost:3000/api/revalidate?secret=$REVALIDATE_SECRET"
```

---

## Adding / changing widgets

Everything lives in `lib/pulse-queries.ts`. Each widget declares:

```ts
{
  id: 'unique-id',
  title: 'Weekly visitors (90d)',
  kind: 'line',              // 'kpi' | 'line' | 'bar' | 'pie' | 'table'
  build: () => [...pipeline] // Pendo Aggregation API pipeline
  transform: (rows, ctx) => rows.map(...) // optional: shape data / swap IDs for names
  hints: { xField, yField }
  colSpan: 1 | 2 | 3
}
```

See Pendo's [Aggregation API docs](https://developers.pendo.io/docs/?bash#aggregations)
for the pipeline grammar.

---

## Security notes

- `PENDO_INTEGRATION_KEY` is read in `lib/pendo.ts` via `process.env` — used
  only in server components and route handlers, never shipped to the browser.
- The page is fully public as requested. If you ever need to gate it, add
  a `middleware.ts` that checks `request.nextUrl.searchParams.get('k')`
  against an env var.
- The key is stored in `.env.local` which is gitignored; it is not
  committed to the repo.

---

## File tour

```
app/
  page.tsx                 The Pulse dashboard (ISR, 1 hour)
  layout.tsx / globals.css
  api/revalidate/route.ts  Manual cache bust
lib/
  pendo.ts                 REST client: runAggregation, feature/page name caches
  pulse-queries.ts         Curated widgets + pipelines
  types.ts                 Internal shapes
  utils.ts                 Formatters
components/
  dashboard-grid.tsx       Places widgets and picks renderers
  widgets/*                KPI / chart / table / error renderers
```
