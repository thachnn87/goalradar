/**
 * Background cache refresh helpers.
 *
 * Used by the Vercel Cron route handlers to proactively populate KV so that
 * user requests always read from cache (never block on a live API call).
 *
 * Key format mirrors kv-cache.ts ("goalradar:<endpoint>") so the same
 * cache entries are served to users by the existing fetchWithKV() flow.
 */

import { kv } from '@vercel/kv';

const BASE_URL   = 'https://api.football-data.org/v4';
const KV_PREFIX  = 'goalradar:';

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

interface RefreshResult {
  endpoint:    string;
  status:      'ok' | 'error';
  fetchedAt:   string;
  freshUntil:  string;
  error?:      string;
}

// ---------------------------------------------------------------------------
// Core: fetch one endpoint and write to KV
// ---------------------------------------------------------------------------

/**
 * Fetches fresh data from football-data.org and stores it in Vercel KV.
 *
 * @param endpoint  API path, e.g. "/competitions/WC/matches?status=SCHEDULED,TIMED"
 * @param freshSec  How long (seconds) the entry is considered fully fresh.
 * @param staleSec  KV TTL — entry auto-expires after this many seconds.
 */
export async function refreshEndpoint(
  endpoint: string,
  freshSec: number,
  staleSec: number,
): Promise<RefreshResult> {
  const start = Date.now();

  let data: unknown;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
      // No next.revalidate — bypass Next.js fetch cache so we always get
      // a live response from the upstream API.
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
    }

    data = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Refresh] FAIL  ${endpoint}: ${msg}`);
    return { endpoint, status: 'error', fetchedAt: new Date(start).toISOString(), freshUntil: '', error: msg };
  }

  const now        = Date.now();
  const freshUntil = now + freshSec * 1000;
  const entry: KVEntry<unknown> = { data, fetchedAt: now, freshUntil };

  try {
    await kv.set(`${KV_PREFIX}${endpoint}`, entry, { ex: staleSec });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Refresh] KV-WRITE-FAIL ${endpoint}: ${msg}`);
    return { endpoint, status: 'error', fetchedAt: new Date(now).toISOString(), freshUntil: '', error: msg };
  }

  const elapsed = Date.now() - start;
  console.log(`[Refresh] OK    ${endpoint} | fresh ${freshSec}s | stale ${staleSec}s | ${elapsed}ms`);

  return {
    endpoint,
    status:    'ok',
    fetchedAt: new Date(now).toISOString(),
    freshUntil: new Date(freshUntil).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Auth helper — shared by both route handlers
// ---------------------------------------------------------------------------

/**
 * Returns true if the request carries a valid CRON_SECRET.
 * Vercel automatically injects `Authorization: Bearer <CRON_SECRET>`
 * on scheduled cron invocations when the secret is set in the project.
 *
 * Fails CLOSED: if CRON_SECRET is not configured the function returns false
 * and the caller responds 401. An absent secret must never be treated as
 * "allow all" — both refresh routes trigger real football-data.org API calls
 * and anonymous access would allow rate-limit exhaustion attacks.
 *
 * To test refresh routes locally, add CRON_SECRET to .env.local and pass
 * the header: curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/refresh/standings
 */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Auth] CRON_SECRET is not set — refresh endpoint denied. Set CRON_SECRET in Vercel environment variables.');
    return false;
  }
  return authHeader === `Bearer ${secret}`;
}
