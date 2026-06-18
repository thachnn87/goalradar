/**
 * GET /api/debug/predictive-risk
 *
 * DATA-18N Phase 2 — Predictive reliability risk scanner.
 *
 * Reads KV state only — no writes, no mutations, no enrichment.
 *
 * Detects leading-indicator signals that precede degradation:
 *   1. Match snapshots expiring within 24 h (TTL-risk)
 *   2. DR snapshot absence (downgrade-guard disabled)
 *   3. ESPN event-cache expiry approaching (enrichment-at-risk)
 *   4. ESPN lookup-cache absent (enrichment blocked)
 *   5. Rate-safe mode active (provider calls blocked)
 *   6. Feed staleness trajectory (orchestrator stall)
 *   7. Active repair-lock count (self-heal frequency)
 *   8. Health archive trend (consecutive YELLOW/RED)
 *
 * Risk levels:
 *   GREEN  — no predicted degradation within 24 h
 *   YELLOW — possible degradation within 24 h (monitor)
 *   RED    — high probability degradation within 24 h (act now)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { Match }                from '@/lib/types';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import { RATE_SAFE_KV_KEY }          from '@/lib/rate-safe';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, type AuthorityCacheEnvelope } from '@/lib/authority-cache';
import { readHealthRecords }         from '@/lib/health-archive';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Constants (mirrors match-snapshot.ts and espn-id-map.ts)
// ---------------------------------------------------------------------------

const SNAPSHOT_TTL_SEC    = 7 * 24 * 3_600;   // 604 800 s — FINISHED snapshot primary
const DR_SNAPSHOT_TTL_SEC = 30 * 24 * 3_600;  // 2 592 000 s — DR snapshot
const ESPN_EVENT_TTL_SEC  = 30 * 24 * 3_600;  // 2 592 000 s — ESPN event cache
const ESPN_LOOKUP_TTL_SEC = 30 * 24 * 3_600;  // 2 592 000 s — ESPN lookup ID

/** Within this many seconds of expiry → RED risk. */
const EXPIRY_RED_SEC    = 4  * 3_600;   // 4 h
/** Within this many seconds of expiry → YELLOW risk. */
const EXPIRY_YELLOW_SEC = 24 * 3_600;   // 24 h

const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';
const UPCOMING_FEED_KEY = 'goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED';

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Risk factor types
// ---------------------------------------------------------------------------

type RiskSeverity = 'GREEN' | 'YELLOW' | 'RED';

interface RiskFactor {
  factor:   string;
  severity: RiskSeverity;
  detail:   string;
}

interface MatchRisk {
  matchId:       number;
  home:          string;
  away:          string;
  score:         string;
  riskType:      'snapshot-expiry' | 'dr-absent' | 'espn-event-expiry' | 'espn-lookup-absent';
  expiresInSec:  number | null;
  severity:      RiskSeverity;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expirySeverity(ttlSec: number | null): RiskSeverity {
  if (ttlSec === null || ttlSec < 0) return 'RED';    // absent
  if (ttlSec <= EXPIRY_RED_SEC)    return 'RED';
  if (ttlSec <= EXPIRY_YELLOW_SEC) return 'YELLOW';
  return 'GREEN';
}

function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  const rank = { GREEN: 0, YELLOW: 1, RED: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now = Date.now();
  const riskFactors: RiskFactor[] = [];
  const matchesAtRisk: MatchRisk[] = [];

  // ── 1. Read FINISHED feed for match IDs ────────────────────────────────────
  const [feedEntry, upcomingEntry, rateSafeRaw, authPrimary, authDR] = await Promise.allSettled([
    kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
    kv.get<KVEntry<{ matches: Match[] }>>(UPCOMING_FEED_KEY),
    kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
  ]);

  const finishedFeed   = feedEntry.status     === 'fulfilled' ? feedEntry.value     : null;
  const upcomingFeed   = upcomingEntry.status === 'fulfilled' ? upcomingEntry.value : null;
  const rateSafeState  = rateSafeRaw.status   === 'fulfilled' ? rateSafeRaw.value   : null;
  const authCache      = authPrimary.status   === 'fulfilled' ? authPrimary.value   : null;
  const authCacheDR    = authDR.status        === 'fulfilled' ? authDR.value        : null;

  // ── 2. Rate-safe mode ─────────────────────────────────────────────────────
  const rateSafeActive = !!rateSafeState;
  const rateSafeExpiresAt = rateSafeActive && rateSafeState?.expiresAt
    ? new Date(rateSafeState.expiresAt).toISOString()
    : null;
  if (rateSafeActive) {
    riskFactors.push({
      factor:   'rate-safe-mode',
      severity: 'RED',
      detail:   `Provider circuit-breaker is ACTIVE — all refresh ops blocked until ${rateSafeExpiresAt ?? 'unknown'}. Expiring snapshots cannot be rebuilt.`,
    });
  }

  // ── 3. Authority cache ────────────────────────────────────────────────────
  const authAbsent = !authCache?.version && !authCacheDR?.version;
  if (authAbsent) {
    riskFactors.push({
      factor:   'authority-cache-absent',
      severity: 'YELLOW',
      detail:   'Authority cache KV key absent — cold rebuild on every authority-drift call. Risk of rate-limit cascade under load.',
    });
  }

  // ── 4. Feed freshness trajectory ─────────────────────────────────────────
  const finishedFeedAgeH = finishedFeed
    ? Math.round((now - finishedFeed.fetchedAt) / 3_600_000 * 10) / 10
    : null;
  const upcomingFeedAgeH = upcomingFeed
    ? Math.round((now - upcomingFeed.fetchedAt) / 3_600_000 * 10) / 10
    : null;

  if (finishedFeedAgeH === null) {
    riskFactors.push({ factor: 'finished-feed-absent', severity: 'RED', detail: 'FINISHED feed missing from KV — orchestrator cron likely stalled.' });
  } else if (finishedFeedAgeH > 4) {
    riskFactors.push({ factor: 'finished-feed-stale', severity: 'YELLOW', detail: `FINISHED feed is ${finishedFeedAgeH}h old — approaching feed-integrity RED threshold (6h).` });
  }

  // ── 5. Per-match snapshot TTL analysis ────────────────────────────────────
  const finishedMatches = (finishedFeed?.data?.matches ?? []).filter(m => m.status === 'FINISHED');
  const finishedIds = finishedMatches.map(m => m.id);

  // Batch-read snapshots + DR snapshots + ESPN event caches + ESPN lookup caches
  const snapKeys    = finishedIds.map(id => `goalradar:match:${id}`);
  const drKeys      = finishedIds.map(id => `goalradar:dr:match:${id}`);
  const espnEvtKeys = finishedIds.map(id => `goalradar:espn:event:${id}`);
  const espnLupKeys = finishedIds.map(id => `goalradar:espn:lookup:${id}`);

  const [snapResults, snapTtlResults, drTtlResults, espnEvtTtlResults, espnLupResults] = await Promise.all([
    Promise.allSettled(snapKeys.map(k => kv.get<MatchSnapshot>(k))),
    Promise.allSettled(snapKeys.map(k => kv.ttl(k))),
    Promise.allSettled(drKeys.map(k => kv.ttl(k))),
    Promise.allSettled(espnEvtKeys.map(k => kv.ttl(k))),
    Promise.allSettled(espnLupKeys.map(k => kv.ttl(k))),
  ]);

  let snapshotsExpiring24h = 0;
  let snapshotsExpiring4h  = 0;
  let drAbsentCount        = 0;
  let espnEvtExpiring24h   = 0;
  let espnLupAbsentCount   = 0;

  for (let i = 0; i < finishedIds.length; i++) {
    const id    = finishedIds[i];
    const fm    = finishedMatches[i];
    const _snapR   = snapResults[i];
    const _snapTR  = snapTtlResults[i];
    const _drTR    = drTtlResults[i];
    const _evtTR   = espnEvtTtlResults[i];
    const _lupR    = espnLupResults[i];
    const snap     = _snapR.status  === 'fulfilled' ? _snapR.value  : null;
    const snapTtl  = _snapTR.status === 'fulfilled' ? _snapTR.value : null;
    const drTtl    = _drTR.status   === 'fulfilled' ? _drTR.value   : null;
    const evtTtl   = _evtTR.status  === 'fulfilled' ? _evtTR.value  : null;
    const lupTtl   = _lupR.status   === 'fulfilled' ? _lupR.value   : null;

    const home = fm.homeTeam?.shortName || fm.homeTeam?.name || '?';
    const away = fm.awayTeam?.shortName || fm.awayTeam?.name || '?';
    const ftH  = snap?.match?.score?.fullTime?.home ?? fm.score?.fullTime?.home ?? 0;
    const ftA  = snap?.match?.score?.fullTime?.away ?? fm.score?.fullTime?.away ?? 0;
    const score = `${ftH}–${ftA}`;

    // Snapshot expiry risk (snapTtl: -2=absent, -1=no expiry, N=seconds remaining)
    const snapSec = (snapTtl === null || snapTtl === -2) ? 0 : snapTtl === -1 ? Infinity : snapTtl;
    const snapSev = expirySeverity(snapSec === Infinity ? 999999 : (snapSec as number));
    if (snapSev === 'RED')    snapshotsExpiring4h++;
    if (snapSev !== 'GREEN')  snapshotsExpiring24h++;
    if (snapSev !== 'GREEN') {
      matchesAtRisk.push({
        matchId: id, home, away, score,
        riskType: 'snapshot-expiry',
        expiresInSec: snapTtl === -2 ? 0 : (snapTtl as number),
        severity: snapSev,
      });
    }

    // DR absent risk
    const drAbsent = drTtl === -2 || drTtl === null;
    if (drAbsent) {
      drAbsentCount++;
      matchesAtRisk.push({
        matchId: id, home, away, score,
        riskType: 'dr-absent',
        expiresInSec: null,
        severity: 'YELLOW',
      });
    }

    // ESPN event cache expiry
    const evtSec = (evtTtl === null || evtTtl === -2) ? null : evtTtl === -1 ? 999999 : evtTtl;
    if (evtSec !== null) {
      const evtSev = expirySeverity(evtSec);
      if (evtSev !== 'GREEN') {
        espnEvtExpiring24h++;
        matchesAtRisk.push({
          matchId: id, home, away, score,
          riskType: 'espn-event-expiry',
          expiresInSec: evtSec,
          severity: evtSev,
        });
      }
    }

    // ESPN lookup absent — can't enrich without the ESPN match ID
    const lupAbsent = lupTtl === -2 || lupTtl === null;
    if (lupAbsent) {
      espnLupAbsentCount++;
      matchesAtRisk.push({
        matchId: id, home, away, score,
        riskType: 'espn-lookup-absent',
        expiresInSec: null,
        severity: 'YELLOW',
      });
    }
  }

  if (snapshotsExpiring4h > 0) {
    riskFactors.push({
      factor:   'snapshots-expiring-4h',
      severity: 'RED',
      detail:   `${snapshotsExpiring4h} FINISHED snapshot(s) expire within 4 h. If provider is unavailable, rebuilt snapshot will be unenriched.`,
    });
  } else if (snapshotsExpiring24h > 0) {
    riskFactors.push({
      factor:   'snapshots-expiring-24h',
      severity: 'YELLOW',
      detail:   `${snapshotsExpiring24h} FINISHED snapshot(s) expire within 24 h.`,
    });
  }

  if (drAbsentCount > 0) {
    riskFactors.push({
      factor:   'dr-snapshots-absent',
      severity: 'YELLOW',
      detail:   `${drAbsentCount} match(es) have no DR snapshot — downgrade guard disabled for those matches.`,
    });
  }

  if (espnEvtExpiring24h > 0) {
    riskFactors.push({
      factor:   'espn-events-expiring',
      severity: 'YELLOW',
      detail:   `${espnEvtExpiring24h} ESPN event cache(s) expire within 24 h — next enrichment will need a live ESPN call.`,
    });
  }

  if (espnLupAbsentCount > 0) {
    riskFactors.push({
      factor:   'espn-lookup-absent',
      severity: 'YELLOW',
      detail:   `${espnLupAbsentCount} ESPN lookup ID(s) absent — ESPN enrichment will fail until IDs are resolved.`,
    });
  }

  // ── 6. Repair-lock count (self-heal frequency proxy) ─────────────────────
  const repairLockKeys = finishedIds.map(id => `goalradar:repair-lock:${id}`);
  const repairTtls = await Promise.allSettled(repairLockKeys.map(k => kv.ttl(k)));
  const activeRepairLocks = repairTtls.filter(
    r => r.status === 'fulfilled' && r.value !== null && r.value > 0,
  ).length;

  if (activeRepairLocks >= 5) {
    riskFactors.push({
      factor:   'high-repair-frequency',
      severity: 'RED',
      detail:   `${activeRepairLocks} active repair-lock(s) — widespread self-heal activity, possible systematic corruption.`,
    });
  } else if (activeRepairLocks >= 2) {
    riskFactors.push({
      factor:   'elevated-repair-frequency',
      severity: 'YELLOW',
      detail:   `${activeRepairLocks} active repair-lock(s) — multiple matches under self-heal. Monitor.`,
    });
  }

  // ── 7. Health archive trend ───────────────────────────────────────────────
  const since24h = now - 24 * 3_600_000;
  const archiveRecords = await readHealthRecords(since24h, now).catch(() => []);

  let consecutiveNonGreen = 0;
  let maxConsecutiveNonGreen = 0;
  for (const rec of [...archiveRecords].reverse()) {
    if (rec.overall !== 'GREEN') {
      consecutiveNonGreen++;
      maxConsecutiveNonGreen = Math.max(maxConsecutiveNonGreen, consecutiveNonGreen);
    } else {
      break;
    }
  }

  const enrichmentTrend = archiveRecords.length >= 3
    ? archiveRecords.slice(-3).map(r => r.enrichment.unenriched ?? 0)
    : null;
  const enrichmentRising = enrichmentTrend !== null &&
    enrichmentTrend[2] > enrichmentTrend[0] && enrichmentTrend[2] > 0;

  if (consecutiveNonGreen >= 5) {
    riskFactors.push({
      factor:   'archive-trajectory-red',
      severity: 'RED',
      detail:   `${consecutiveNonGreen} consecutive non-GREEN health records — persistent degradation trajectory.`,
    });
  } else if (consecutiveNonGreen >= 3) {
    riskFactors.push({
      factor:   'archive-trajectory-yellow',
      severity: 'YELLOW',
      detail:   `${consecutiveNonGreen} consecutive non-GREEN health records — trending toward incident.`,
    });
  }

  if (enrichmentRising) {
    riskFactors.push({
      factor:   'enrichment-unenriched-rising',
      severity: 'YELLOW',
      detail:   `Unenriched match count increasing in last 3 archive records (${enrichmentTrend!.join(' → ')}) — DATA-18K class degradation in progress.`,
    });
  }

  // ── 8. Aggregate risk level ───────────────────────────────────────────────
  let riskLevel: RiskSeverity = 'GREEN';
  for (const f of riskFactors) {
    riskLevel = maxSeverity(riskLevel, f.severity);
  }

  // Deduplicate matchesAtRisk by matchId+riskType (no exact duplicates expected, but guard)
  const seen = new Set<string>();
  const uniqueMatchesAtRisk = matchesAtRisk.filter(m => {
    const key = `${m.matchId}:${m.riskType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(
    {
      checkedAt: new Date(now).toISOString(),
      riskLevel,
      matchesAtRisk:     uniqueMatchesAtRisk,
      expiringCaches: {
        snapshotsExpiring4h,
        snapshotsExpiring24h,
        snapshotTotal:     finishedIds.length,
        espnEventsExpiring24h: espnEvtExpiring24h,
        drAbsentCount,
        espnLookupAbsent:  espnLupAbsentCount,
        authorityCacheAbsent: authAbsent,
      },
      staleFeeds: {
        finishedFeedAgeHours:  finishedFeedAgeH,
        upcomingFeedAgeHours:  upcomingFeedAgeH,
      },
      repairFrequency: {
        activeRepairLocks,
        note: 'Active repair-lock = self-heal triggered within last 30 min',
      },
      selfHealFrequency: {
        consecutiveNonGreenRecords: consecutiveNonGreen,
        archiveRecords24h:          archiveRecords.length,
        enrichmentUnenrichedTrend:  enrichmentTrend,
      },
      rateSafeMode: {
        active:    rateSafeActive,
        expiresAt: rateSafeExpiresAt,
      },
      riskFactors,
      note: riskLevel === 'GREEN'
        ? 'No predicted degradation within 24 h.'
        : riskLevel === 'YELLOW'
        ? 'Possible degradation within 24 h — monitor and consider pre-emptive action.'
        : 'High probability of degradation within 24 h — immediate action recommended.',
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
