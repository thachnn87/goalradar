/**
 * src/lib/rate-safe.ts
 *
 * RATE-SAFE MODE — automatic provider circuit-breaker.
 *
 * When football-data.org signals 429 (rate limit) or 403 (disabled), all
 * background refresh operations must stop immediately.  User-facing requests
 * continue to be served from the KV cache (stale-while-revalidate — no user
 * impact).  The mode expires automatically when the Retry-After window passes.
 *
 * ── Two-layer state ──────────────────────────────────────────────────────────
 *
 *   In-process flag  — set synchronously, checked without any I/O overhead.
 *                      Cleared when the TTL expires.  Scope: this serverless
 *                      instance only.  Survives for the process lifetime.
 *
 *   KV key           — goalradar:rate-safe:active (written fire-and-forget).
 *                      Shared across ALL instances / cron invocations.
 *                      TTL = retryAfterMs so it self-deletes when safe to retry.
 *                      Read once at orchestrator startup via readRateSafeFromKV().
 *
 * ── Tier-aware refresh TTLs ──────────────────────────────────────────────────
 *
 *   LIVE     (IN_PLAY / PAUSED)      →   30 s
 *   TODAY    (kicks off today UTC)   →    5 min
 *   NEXT-3D  (within 3 days)         →   15 min
 *   FUTURE   (> 3 days away)         →    6 h
 *   FINISHED                         →   24 h
 *
 * Used by prewarmWorldCup() to skip matches whose cached snapshot is still
 * fresh for their tier — eliminating redundant KV writes and ensuring we
 * never touch the provider for matches that don't need updating.
 *
 * ── Log lines ────────────────────────────────────────────────────────────────
 *
 *   [RATE_SAFE] MODE ENABLED  | reason=rate_limit | retryAfterMs=60000 | expiresAt=...
 *   [RATE_SAFE] MODE DISABLED | refresh operations resumed
 *   [RATE_SAFE] SKIP          | reason=rate_limit | expiresIn=42s
 */

import { kv } from '@vercel/kv';
import type { Match } from './types';

// ---------------------------------------------------------------------------
// KV key
// ---------------------------------------------------------------------------

export const RATE_SAFE_KV_KEY = 'goalradar:rate-safe:active';

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type RateSafeReason = 'rate_limit' | 'disabled' | 'manual';

export interface RateSafeState {
  reason:       RateSafeReason;
  enabledAt:    number;   // epoch ms
  expiresAt:    number;   // epoch ms
  retryAfterMs: number;
}

// ---------------------------------------------------------------------------
// In-process singleton — zero I/O when checking
// ---------------------------------------------------------------------------

let _active = false;
let _state:  RateSafeState | null = null;

// ---------------------------------------------------------------------------
// Tier-aware refresh TTLs
// ---------------------------------------------------------------------------

export type MatchTier = 'live' | 'today' | 'next-3d' | 'future' | 'finished';

/** Minimum seconds between re-seeds for a match at each tier. */
export const TIER_REFRESH_SEC: Record<MatchTier, number> = {
  'live':     30,
  'today':    5  * 60,
  'next-3d':  15 * 60,
  'future':   6  * 3_600,
  'finished': 24 * 3_600,
};

/**
 * Classify a match into a refresh tier based on its current status and
 * time until kick-off (UTC).
 */
export function getMatchTier(match: Match): MatchTier {
  if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return 'live';
  if (match.status === 'FINISHED') return 'finished';

  const now     = Date.now();
  const kickoff = new Date(match.utcDate).getTime();

  // End of today in UTC
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  if (kickoff <= todayEnd.getTime()) return 'today';

  const msUntil = kickoff - now;
  if (msUntil <= 3 * 24 * 3_600 * 1000) return 'next-3d';
  return 'future';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when rate-safe mode is active in this process.
 * Checks expiry and auto-clears if the window has passed.
 * Zero I/O — safe to call on every refresh tick.
 */
export function isRateSafeModeActive(): boolean {
  if (!_active) return false;
  if (_state && Date.now() >= _state.expiresAt) {
    _active = false;
    _state  = null;
    console.log('[RATE_SAFE] MODE EXPIRED | refresh operations automatically resumed');
    return false;
  }
  return true;
}

/** Returns current state, or null when not active. */
export function getRateSafeState(): RateSafeState | null {
  return isRateSafeModeActive() ? _state : null;
}

/**
 * Enable rate-safe mode.
 *
 * @param reason        What triggered the mode (rate_limit | disabled | manual).
 * @param retryAfterMs  How long to suspend refresh (default 5 min).
 *                      Pass the Retry-After header value when available.
 */
export function enableRateSafeMode(
  reason:       RateSafeReason,
  retryAfterMs: number = 5 * 60_000,
): void {
  // Clamp: never suspend for less than 60 s or more than 1 hour (unless disabled).
  const clampedMs = reason === 'disabled'
    ? Math.max(retryAfterMs, 3_600_000)   // disabled → at least 1 h
    : Math.min(Math.max(retryAfterMs, 60_000), 3_600_000);

  const now     = Date.now();
  _state  = { reason, enabledAt: now, expiresAt: now + clampedMs, retryAfterMs: clampedMs };
  _active = true;

  console.warn(
    `[RATE_SAFE] MODE ENABLED | reason=${reason}` +
    ` | retryAfterMs=${clampedMs}` +
    ` | expiresAt=${new Date(_state.expiresAt).toISOString()}` +
    ` | all provider refresh suspended`,
  );

  // Persist to KV so OTHER serverless instances (next cron tick) see the flag.
  if (KV_ENABLED) {
    const ttlSec = Math.ceil(clampedMs / 1000);
    kv.set(RATE_SAFE_KV_KEY, _state, { ex: ttlSec }).catch((err) =>
      console.error('[RATE_SAFE] KV write failed:', err instanceof Error ? err.message : String(err)),
    );
  }
}

/**
 * Manually disable rate-safe mode (e.g. via an admin endpoint).
 * Also deletes the KV key so other instances see the change.
 */
export function disableRateSafeMode(): void {
  _active = false;
  _state  = null;
  console.log('[RATE_SAFE] MODE DISABLED | refresh operations resumed');
  if (KV_ENABLED) {
    kv.del(RATE_SAFE_KV_KEY).catch(() => undefined);
  }
}

/**
 * Read rate-safe state from KV and sync the in-process flag.
 * Call once at orchestrator startup to pick up state set by OTHER instances.
 * Returns the active state, or null if not in rate-safe mode.
 */
export async function readRateSafeFromKV(): Promise<RateSafeState | null> {
  if (!KV_ENABLED) return null;
  try {
    const stored = await kv.get<RateSafeState>(RATE_SAFE_KV_KEY);
    if (!stored) return null;

    const now = Date.now();
    if (now >= stored.expiresAt) {
      // KV TTL should have removed it, but guard against clock skew
      return null;
    }

    // Sync in-process flag so subsequent checks are zero-I/O
    _active = true;
    _state  = stored;
    console.warn(
      `[RATE_SAFE] MODE ACTIVE (from KV) | reason=${stored.reason}` +
      ` | expiresIn=${Math.round((stored.expiresAt - now) / 1000)}s`,
    );
    return stored;
  } catch (err) {
    console.error('[RATE_SAFE] KV read failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Log a skip event with remaining TTL.  Call when a refresh is skipped
 * because rate-safe mode is active.
 */
export function logRateSafeSkip(label: string): void {
  if (!_state) return;
  const expiresIn = Math.max(0, Math.round((_state.expiresAt - Date.now()) / 1000));
  console.warn(`[RATE_SAFE] SKIP ${label} | reason=${_state.reason} | expiresIn=${expiresIn}s`);
}
