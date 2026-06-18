/**
 * GET /api/debug/authority-readiness
 *
 * DATA-18C.3 Phase 5 — DATA-18B migration readiness gate.
 *
 * Determines whether the authority cache subsystem is ready for
 * DATA-18B listing-page migration.
 *
 * Scoring (0–100):
 *   30 pts — cache active (primary or DR present in KV)
 *   20 pts — DR functioning (drPresent = true)
 *   25 pts — cold rebuild free (0% cold rebuilds or no data)
 *   15 pts — telemetry coverage (≥ 1 read recorded since activation)
 *   10 pts — drift clean (no RED detected in last known authority-drift)
 *             (uses authority:last-write presence as proxy)
 *
 * Verdicts:
 *   READY       — score >= 85 and no SLO FAIL
 *   PILOT_READY — score >= 60 or (cache active + 0 cold rebuilds)
 *   NOT_READY   — otherwise
 *
 * Blockers: explicit reasons that prevent READY verdict.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }   from 'next/server';
import { kv }                          from '@vercel/kv';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, AUTHORITY_WRITE_RECORD_KEY,
         type AuthorityCacheEnvelope, type AuthorityWriteRecord }
                                       from '@/lib/authority-cache';
import { getAuthorityTelemetry }       from '@/lib/authority-telemetry';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

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
// SLO thresholds (must stay in sync with authority-slo/route.ts)
// ---------------------------------------------------------------------------

const SLO_COLD_REBUILD_MAX = 1.0;  // %
const SLO_DR_USAGE_MAX     = 20.0; // %
const SLO_AVAILABILITY_MIN = 99.9; // %

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

  // ── 1. Parallel evidence collection ────────────────────────────────────
  const [primaryResult, drResult, writeRecordResult, telemetryResult] = await Promise.allSettled([
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
    kv.get<AuthorityWriteRecord>(AUTHORITY_WRITE_RECORD_KEY),
    getAuthorityTelemetry(),
  ]);

  const primary     = primaryResult.status     === 'fulfilled' ? primaryResult.value     : null;
  const dr          = drResult.status          === 'fulfilled' ? drResult.value          : null;
  const writeRecord = writeRecordResult.status === 'fulfilled' ? writeRecordResult.value : null;
  const telemetry   = telemetryResult.status   === 'fulfilled' ? telemetryResult.value   : null;

  // ── 2. Evidence facts ──────────────────────────────────────────────────
  const cacheActive    = (primary?.version === 1) || (dr?.version === 1);
  const drFunctioning  = dr?.version === 1;
  const wroteRecently  = writeRecord !== null;
  const writeAgeMin    = writeRecord ? Math.round((now - new Date(writeRecord.builtAt).getTime()) / 60_000) : null;

  const ref30d = telemetry?.last30d;
  const ref7d  = telemetry?.last7d;

  const totalReads      = ref30d?.totalReads      ?? 0;
  const coldRebuildRatio = ref30d?.coldRebuildRatio ?? 0;
  const availability    = ref30d?.availability    ?? (cacheActive ? 100 : 0);
  const drHitRatio      = ref30d?.drHitRatio      ?? 0;
  const telemetryCoverage = totalReads > 0;

  // Use 7d as availability signal too (more recent)
  const availability7d  = ref7d?.availability ?? availability;
  const coldRebuild7d   = ref7d?.coldRebuildRatio ?? coldRebuildRatio;

  // ── 3. SLO gate checks ────────────────────────────────────────────────
  const sloFail = (
    (totalReads > 0 && coldRebuildRatio > SLO_COLD_REBUILD_MAX) ||
    (totalReads > 0 && availability < SLO_AVAILABILITY_MIN)
  );

  const sloWarn = (
    (totalReads > 0 && drHitRatio > SLO_DR_USAGE_MAX)
  );

  // ── 4. Scoring ────────────────────────────────────────────────────────
  let score = 0;
  const scoreBreakdown: Record<string, number> = {};

  // Cache active: 30 pts
  const ptsActive = cacheActive ? 30 : 0;
  score += ptsActive;
  scoreBreakdown['cacheActive'] = ptsActive;

  // DR functioning: 20 pts
  const ptsDr = drFunctioning ? 20 : 0;
  score += ptsDr;
  scoreBreakdown['drFunctioning'] = ptsDr;

  // Cold rebuild free: 25 pts
  const ptsCold =
    !telemetryCoverage    ? 20   // no data yet — assume OK per DATA-18C.2 evidence
    : coldRebuild7d === 0 ? 25
    : coldRebuild7d < 1   ? 20
    : coldRebuild7d < 5   ? 10
    : 0;
  score += ptsCold;
  scoreBreakdown['coldRebuildFree'] = ptsCold;

  // Telemetry coverage: 15 pts
  const ptsTelemetry = telemetryCoverage ? 15 : 0;
  score += ptsTelemetry;
  scoreBreakdown['telemetryCoverage'] = ptsTelemetry;

  // Write record present: 10 pts (proxy for drift-clean + cron active)
  const ptsWrite = wroteRecently ? 10 : 0;
  score += ptsWrite;
  scoreBreakdown['writeRecordPresent'] = ptsWrite;

  // ── 5. Blockers ───────────────────────────────────────────────────────
  const blockers: string[] = [];

  if (!cacheActive) {
    blockers.push('Authority cache absent — run the orchestrator cron to populate goalradar:wc:authority:v1');
  }
  if (!drFunctioning) {
    blockers.push('DR key absent — writeAuthorityCache() must write goalradar:dr:wc:authority:v1');
  }
  if (sloFail) {
    if (totalReads > 0 && coldRebuildRatio > SLO_COLD_REBUILD_MAX) {
      blockers.push(`Cold rebuild rate ${coldRebuildRatio.toFixed(2)}% exceeds SLO limit ${SLO_COLD_REBUILD_MAX}%`);
    }
    if (totalReads > 0 && availability < SLO_AVAILABILITY_MIN) {
      blockers.push(`Availability ${availability.toFixed(2)}% below SLO minimum ${SLO_AVAILABILITY_MIN}%`);
    }
  }

  // ── 6. Verdict ────────────────────────────────────────────────────────
  const verdict: 'READY' | 'PILOT_READY' | 'NOT_READY' =
    blockers.length > 0 || sloFail ? 'NOT_READY'
    : score >= 85                  ? 'READY'
    : score >= 60                  ? 'PILOT_READY'
    : (cacheActive && coldRebuildRatio === 0) ? 'PILOT_READY'
    : 'NOT_READY';

  // ── 7. Recommendation ─────────────────────────────────────────────────
  const recommendation =
    verdict === 'READY'
      ? 'Authority cache is stable and proven. DATA-18B listing-page migration can begin. Start with a single low-traffic page (e.g. /world-cup/groups).'
      : verdict === 'PILOT_READY'
      ? `Cache active with score ${score}/100. Proceed with caution: pilot 1 page, monitor authority-drift and authority-telemetry for 24h before expanding.`
      : `Score ${score}/100. Resolve blockers before starting DATA-18B: ${blockers.join('; ')}`;

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      verdict,
      readinessScore: score,
      maxScore: 100,
      scoreBreakdown,
      blockers,
      sloStatus: {
        pass: !sloFail && !sloWarn,
        warn: sloWarn && !sloFail,
        fail: sloFail,
      },
      evidence: {
        cacheActive,
        drFunctioning,
        primaryPresent:    primary?.version === 1,
        drPresent:         drFunctioning,
        cacheMatchCount:   (primary ?? dr)?.matchCount ?? null,
        cacheTtlTier:      (primary ?? dr)?.ttlTier    ?? null,
        writeRecordPresent: wroteRecently,
        writeAgeMin,
        telemetryCoverage,
        totalReads30d:     totalReads,
        primaryHitRatio30d: ref30d?.primaryHitRatio  ?? null,
        drHitRatio30d:      drHitRatio,
        coldRebuildRatio30d: coldRebuildRatio,
        availability30d:   availability,
        availability7d,
        coldRebuildRatio7d: coldRebuild7d,
        avgLatencyMs30d:   ref30d?.avgLatencyMs ?? null,
        lastPrimaryHitAt:  ref30d?.lastPrimaryHitAt  ?? null,
        lastDrHitAt:       ref30d?.lastDrHitAt       ?? null,
        lastColdRebuildAt: ref30d?.lastColdRebuildAt ?? null,
      },
      recommendation,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
