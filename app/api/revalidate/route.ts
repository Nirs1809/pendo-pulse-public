import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Revalidate every Pendo-tagged ISR cache entry, forcing the next page
 * render to pull fresh data.
 *
 * Two ways to call this:
 *
 *   1. Vercel Cron (scheduled hourly via vercel.json) — Vercel sends
 *      `Authorization: Bearer $CRON_SECRET`. Set the same value as the
 *      `CRON_SECRET` env var.
 *
 *   2. Manual cache bust:
 *      curl -X POST "https://<host>/api/revalidate?secret=$REVALIDATE_SECRET"
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

function handle(req: Request) {
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  const cronSecret = process.env.CRON_SECRET;
  const manualSecret = process.env.REVALIDATE_SECRET;

  const fromCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  const fromManual = Boolean(manualSecret) && secret === manualSecret;

  if (!fromCron && !fromManual) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  revalidateTag("pendo");
  return NextResponse.json({
    ok: true,
    revalidated: "pendo",
    via: fromCron ? "cron" : "manual",
    at: new Date().toISOString(),
  });
}
