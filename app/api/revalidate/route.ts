import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * POST /api/revalidate?secret=XYZ
 *
 * Invalidates every Pendo fetch in the ISR cache, forcing the next render
 * to pull fresh data. Protect with REVALIDATE_SECRET so randoms on the
 * internet can't hammer your Pendo API quota.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  revalidateTag("pendo");
  return NextResponse.json({ ok: true, revalidated: "pendo" });
}
