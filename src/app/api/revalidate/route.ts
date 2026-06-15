/**
 * POST /api/revalidate
 *
 * On-demand ISR revalidation endpoint — DATA-9
 *
 * Auth: Authorization: Bearer <REVALIDATE_SECRET>  OR  ?secret=<REVALIDATE_SECRET>
 *
 * Body (JSON):
 *   { "paths": ["/world-cup-2026/teams", ...] }   — revalidate specific paths
 *   {}                                             — revalidate all WC data paths
 *
 * Response:
 *   { "success": true, "revalidated": [...], "count": N, "timestamp": "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePaths, revalidateWCPaths, WC_DATA_PATHS } from '@/lib/revalidation';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let paths: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.paths) && body.paths.length > 0) {
      paths = body.paths as string[];
    }
  } catch {
    // Empty body → revalidate all WC paths
  }

  const triggeredBy = req.headers.get('authorization')?.startsWith('Bearer ') ? 'header'
    : new URL(req.url).searchParams.has('secret')                              ? 'queryparam'
    : 'unknown';

  const record = paths
    ? await revalidatePaths(paths, 'api', triggeredBy)
    : await revalidateWCPaths('api', triggeredBy);

  return NextResponse.json({
    success:     record.success,
    revalidated: record.paths,
    count:       record.revalidated,
    timestamp:   record.timestamp,
    ...(record.error ? { error: record.error } : {}),
  }, { status: record.success ? 200 : 500 });
}

// Reject non-POST methods with a clear message
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.', availablePaths: WC_DATA_PATHS },
    { status: 405 },
  );
}
