/**
 * POST /api/push/opt-in
 *
 * Tracks a web push notification opt-in event.
 * Called client-side after the user grants browser notification permission.
 *
 * Body: { matchId?: string | null, matchLabel?: string | null }
 *
 * Increments two Vercel KV counters:
 *   push:grants:total         — all-time grant count
 *   push:grants:{YYYY-MM-DD}  — daily grant count
 *
 * Returns: { ok: true }
 * Always returns 200 — failures are silent (non-critical tracking).
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';

export const dynamic = 'force-dynamic';

const KV_AVAILABLE =
  typeof process.env.KV_REST_API_URL === 'string' && process.env.KV_REST_API_URL.trim() !== '';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({})) as {
      matchId?:    string | null;
      matchLabel?: string | null;
    };

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (KV_AVAILABLE) {
      await Promise.allSettled([
        kv.incr('push:grants:total'),
        kv.incr(`push:grants:${today}`),
      ]);
    }

    console.log(
      `[PUSH OPT-IN] match=${body.matchId ?? 'n/a'} label="${body.matchLabel ?? ''}" date=${today}`,
    );
  } catch (err) {
    // Non-critical — never expose errors to the client
    console.error('[PUSH OPT-IN] error:', err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
