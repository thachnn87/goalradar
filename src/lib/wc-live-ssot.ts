/**
 * WC Live Single Source of Truth
 *
 * WC-LIVE-SSOT-HARDENING: all WC live-state consumers must import from this
 * module. Do NOT call getWCLiveMatchesCached() directly from pages, and do NOT
 * derive live state by filtering the authority cache (state === 'live').
 *
 * Backing store: KV goalradar:live:matches (written by orchestrator every 30 min).
 * TTL: 30 s (live tier), backed by React.cache() dedup within a single render.
 */

import { getWCLiveMatchesCached } from '@/lib/api';
import type { Match } from '@/lib/types';

/**
 * Returns the current set of live WC matches (IN_PLAY or PAUSED).
 *
 * This is the canonical live-state provider for:
 *   - Home (WCCountdownBanner + WCHero)
 *   - Schedule (/schedule?competition=WC → WCCountdown)
 *   - Hub (/world-cup-2026 → WCCountdown + live match grid)
 *   - Watch-live (/world-cup-2026/watch-live)
 *
 * The Live page (/live) continues to use getLiveMatches() directly because it
 * covers all competitions, not just WC. The WC subset of that list is
 * guaranteed to agree with getCurrentLiveMatches() because both read the same
 * KV key (goalradar:live:matches) written by the same orchestrator run.
 */
export async function getCurrentLiveMatches(): Promise<Match[]> {
  const { matches } = await getWCLiveMatchesCached();
  return matches;
}

/**
 * Returns the set of currently-live WC match IDs.
 *
 * DATA-18B.3E LIVE-SOURCE-UNIFICATION: every WC listing page must derive its
 * "is this match live" decision from `liveMatchIds.has(match.id)` against this
 * set — never from authority `state === 'live'`, `classifyMatchState() === 'live'`,
 * or raw `status === 'IN_PLAY' | 'PAUSED'`. A match the authority cache still
 * marks live but that is absent from this set has ended and must render as
 * finished, not live.
 */
export async function getLiveMatchIdSet(): Promise<Set<number>> {
  const matches = await getCurrentLiveMatches();
  return new Set(matches.map((m) => m.id));
}
