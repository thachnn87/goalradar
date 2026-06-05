/**
 * POST /api/newsletter/subscribe
 *
 * Body: { email: string; source?: string }
 *
 * Flow:
 *   1. Validate email format
 *   2. Upsert subscriber row (created | resent | duplicate)
 *   3. Send confirmation email (Resend) for created/resent
 *   4. Always return a generic success — never reveal subscription status
 *
 * Rate-limited via Vercel KV: max 5 subscribe attempts per IP per hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { upsertSubscriber } from '@/lib/db';
import { sendConfirmationEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Sliding-window rate limit via KV. Returns true if the request is allowed. */
async function checkRateLimit(ip: string): Promise<boolean> {
  const key   = `newsletter:rl:${ip}`;
  const limit = 5;
  const windowSec = 3600; // 1 hour

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      // First hit — set expiry
      await kv.expire(key, windowSec);
    }
    return count <= limit;
  } catch {
    // KV unavailable — allow the request rather than blocking all signups
    return true;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

// Generic response — same for all outcomes to prevent email enumeration
const SUCCESS_MSG = "Thanks! If that email is new, you'll get a confirmation link shortly.";

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email  = typeof body.email  === 'string' ? body.email.trim()  : '';
  const source = typeof body.source === 'string' ? body.source.trim() : null;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
  }

  if (email.length > 254) {
    return NextResponse.json({ error: 'Email address too long.' }, { status: 422 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = clientIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  // ── Upsert + email ────────────────────────────────────────────────────────
  try {
    const token  = crypto.randomUUID();
    const result = await upsertSubscriber(email, token, source);

    if (result.status !== 'duplicate') {
      // Fire-and-forget — don't make the user wait for Resend
      sendConfirmationEmail(email, result.subscriber.token).catch((err) => {
        console.error('[newsletter] Confirmation email failed:', err?.message ?? err);
      });
    }

    return NextResponse.json({ ok: true, message: SUCCESS_MSG });
  } catch (err) {
    console.error('[newsletter] subscribe error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
