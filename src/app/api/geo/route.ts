/**
 * GET /api/geo — GEO-1
 *
 * Returns the visitor's ISO country code from Vercel's geo header.
 * Read client-side (and cached in sessionStorage) so match pages can stay
 * ISR-cached — reading request headers inside the page itself would force
 * dynamic rendering and regress PERF-8.
 *
 * No KV, no providers — a header echo only.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const country =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??       // non-Vercel proxies (local/dev parity)
    null;

  return NextResponse.json(
    { country },
    // Per-visitor response — must never be shared-cached.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
