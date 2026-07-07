import { NextResponse } from "next/server";

import { buildDauPipeline, normalizeDauDays, transformDauRows } from "@/lib/dau";
import { isConfigured, PendoApiError, runAggregation } from "@/lib/pendo";

/**
 * Daily-active-visitors series for an arbitrary preset window.
 *
 * Drives the range buttons on the "Daily active Pulse visitors" chart:
 * the client fetches /api/dau?days=90 (etc.) and redraws. The integration
 * key stays server-side. Results are tagged "pendo" and revalidated every
 * 15 minutes so they share the same cache lifecycle as the ISR page render,
 * and a `revalidateTag('pendo')` bust refreshes both at once.
 */
export const runtime = "nodejs";
export const revalidate = 900;

export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Pendo integration key not configured" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const days = normalizeDauDays(url.searchParams.get("days"));

  try {
    const { rows } = await runAggregation(
      `pulse-dau-${days}d`,
      buildDauPipeline(days),
    );
    const points = transformDauRows(rows);
    return NextResponse.json(
      { ok: true, days, points },
      {
        headers: {
          // Let the CDN/browser reuse the response briefly; the underlying
          // Pendo fetch is already ISR-cached for an hour server-side.
          "cache-control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    const message =
      err instanceof PendoApiError
        ? `Pendo ${err.status}: ${err.body.slice(0, 200)}`
        : (err as Error).message;
    return NextResponse.json({ ok: false, days, error: message }, { status: 502 });
  }
}
