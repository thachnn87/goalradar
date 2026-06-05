/**
 * POST /api/newsletter/subscribe
 *
 * Body: { email: string; source?: string; _hp?: string; _t?: number }
 *
 * Flow:
 *   1. Anti-spam: honeypot (_hp must be empty) + timing (_t must be 1–600s ago)
 *   2. Validate email format and length; block known disposable domains
 *   3. Rate-limit via Vercel KV (5 attempts per IP per hour)
 *   4. PRIMARY: upsert to Vercel Postgres + send confirmation email
 *   5. FALLBACK: if Postgres unavailable, capture email in KV set for later import
 *   6. Always return a generic success — never reveal subscription status
 *
 * Rate-limited via Vercel KV: max 5 subscribe attempts per IP per hour.
 *
 * Env vars:
 *   POSTGRES_URL          — Vercel Postgres (set via Vercel Storage integration)
 *   KV_REST_API_URL       — Vercel KV (set via Vercel KV integration)
 *   KV_REST_API_TOKEN     — Vercel KV token
 *   RESEND_API_KEY        — Resend transactional email
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { upsertSubscriber, DB_AVAILABLE } from '@/lib/db';
import { sendConfirmationEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Common disposable/throwaway email providers — block at API level */
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'yopmail.com', 'spam4.me', 'trashmail.com', 'fakeinbox.com', '10minutemail.com',
  'dispostable.com', 'maildrop.cc', 'mailnull.com', 'spamgourmet.com', 'trashmail.net',
  'dodgit.com', 'spamfree24.org', 'discard.email', 'spamspot.com', 'jetable.fr.nf',
  'noclickemail.com', 'superrito.com', 'spamthisplease.com', 'mailnesia.com',
]);

/** KV key for fallback lead capture when Postgres is unavailable */
const KV_FALLBACK_SET  = 'newsletter:fallback:leads';
const KV_FALLBACK_META = 'newsletter:fallback:meta';

// Generic response — same message for all outcomes (prevents email enumeration)
const SUCCESS_MSG = "Thanks! Check your inbox for a confirmation link.";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/** Sliding-window rate limit via KV. Returns true if the request is allowed. */
async function checkRateLimit(ip: string): Promise<boolean> {
  const key       = `newsletter:rl:${ip}`;
  const limit     = 5;
  const windowSec = 3600;

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSec);
    return count <= limit;
  } catch {
    // KV unavailable — allow rather than blocking all signups
    return true;
  }
}

/**
 * KV fallback: capture the email in a Redis set so no lead is ever lost,
 * even when Postgres is not yet provisioned.
 */
async function kvCaptureLead(email: string, source: string | null): Promise<void> {
  const normalised = email.toLowerCase().trim();
  try {
    await kv.sadd(KV_FALLBACK_SET, normalised);
    await kv.hset(KV_FALLBACK_META, {
      [normalised]: JSON.stringify({ source, ts: Date.now() }),
    });
  } catch (err) {
    // If KV also unavailable, log so the email appears in Vercel logs
    console.error('[newsletter] KV fallback capture failed. Email:', email, 'Error:', err);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: unknown; source?: unknown; _hp?: unknown; _t?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email  = typeof body.email  === 'string' ? body.email.trim()  : '';
  const source = typeof body.source === 'string' ? body.source.trim() : null;

  // ── Anti-spam: honeypot ───────────────────────────────────────────────────
  // Real browsers leave _hp empty; bots often fill every visible field.
  const honeypot = typeof body._hp === 'string' ? body._hp : '';
  if (honeypot.length > 0) {
    // Silent success — don't tell bots they were caught
    return NextResponse.json({ ok: true, message: SUCCESS_MSG });
  }

  // ── Anti-spam: form submission timing ────────────────────────────────────
  // _t = unix ms timestamp when the form was rendered on the client.
  // Bots often submit instantly; real users take > 1 second.
  // Also reject if form is stale > 10 minutes (refresh the page).
  if (typeof body._t === 'number') {
    const elapsed = Date.now() - body._t;
    if (elapsed < 1000 || elapsed > 600_000) {
      // Could be a bot or stale form — return generic success to avoid leaking info
      return NextResponse.json({ ok: true, message: SUCCESS_MSG });
    }
  }

  // ── Validate email ────────────────────────────────────────────────────────
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
  }

  if (email.length > 254) {
    return NextResponse.json({ error: 'Email address too long.' }, { status: 422 });
  }

  if (BLOCKED_DOMAINS.has(emailDomain(email))) {
    return NextResponse.json({ error: 'Please use a real email address.' }, { status: 422 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip      = clientIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in an hour.' },
      { status: 429 },
    );
  }

  // ── Primary path: Vercel Postgres ─────────────────────────────────────────
  if (DB_AVAILABLE) {
    try {
      const token  = crypto.randomUUID();
      const result = await upsertSubscriber(email, token, source);

      if (result.status !== 'duplicate') {
        sendConfirmationEmail(email, result.subscriber.token).catch((err) => {
          console.error('[newsletter] Confirmation email failed:', err?.message ?? err);
        });
      }

      return NextResponse.json({ ok: true, message: SUCCESS_MSG });
    } catch (err) {
      // DB write failed for an unexpected reason — fall through to KV capture
      console.error('[newsletter] Postgres upsert failed, falling back to KV:', err instanceof Error ? err.message : err);
    }
  } else {
    console.warn('[newsletter] POSTGRES_URL not set — using KV fallback. Configure Vercel Postgres to enable full double opt-in.');
  }

  // ── Fallback path: KV lead capture ───────────────────────────────────────
  // Stores the email in a Redis set so it can be imported once Postgres is set up.
  // No confirmation email is sent in fallback mode (no token management).
  await kvCaptureLead(email, source);

  return NextResponse.json({ ok: true, message: SUCCESS_MSG });
}
