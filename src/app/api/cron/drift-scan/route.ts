/**
 * GET /api/cron/drift-scan
 *
 * DATA-18F Phase 3 — Nightly authority-vs-snapshot drift scanner.
 *
 * Schedule: 04:30 UTC daily (30 min after repair-enrichment at 04:00 UTC)
 *
 * Reads every FINISHED WC match from authority cache and its match snapshot,
 * then logs any drift found. Does NOT repair — logging only.
 *
 * Log format (structured, Vercel-parseable):
 *   [DriftScan] DRIFT matchId=<id> reason=<reason> severity=<RED|YELLOW>
 *   [DriftScan] SUMMARY total=<n> green=<n> yellow=<n> red=<n>
 *   [DriftScan] ALERT red=<n> — score drift detected, manual repair required
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Wire in Vercel dashboard or external scheduler:
 *   Path:     /api/cron/drift-scan
 *   Schedule: 30 4 * * *  (04:30 UTC daily)
 */

import { NextRequest, NextResponse }          from 'next/server';
import { kv }                                from '@vercel/kv';
import { readAuthorityCache }                from '@/lib/authority-cache';
import type { CanonicalMatch }               from '@/lib/canonical-match';
import type { MatchSnapshot }                from '@/lib/match-snapshot';
import { recordCronRun, detectTriggerSource } from '@/lib/cron-recorder';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

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
// State normaliser
// ---------------------------------------------------------------------------

function stateFromStatus(status: string): string {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED') return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'cancelled';
}

// ---------------------------------------------------------------------------
// Drift check — returns list of drift reasons for a single match pair
// ---------------------------------------------------------------------------

interface DriftEntry {
  matchId:   number;
  home:      string;
  away:      string;
  score:     string;
  severity:  'RED' | 'YELLOW';
  reasons:   string[];
}

function detectDrift(
  auth: CanonicalMatch,
  snap: MatchSnapshot | null,
): DriftEntry | null {
  const reasons: string[] = [];

  const authHome = auth.score?.fullTime?.home ?? null;
  const authAway = auth.score?.fullTime?.away ?? null;

  if (!snap) {
    return {
      matchId:  auth.id,
      home:     auth.homeTeam?.name ?? '?',
      away:     auth.awayTeam?.name ?? '?',
      score:    `${authHome ?? '?'}–${authAway ?? '?'}`,
      severity: 'RED',
      reasons:  ['snapshot missing from KV'],
    };
  }

  const m        = snap.match;
  const snapHome = m.score?.fullTime?.home ?? null;
  const snapAway = m.score?.fullTime?.away ?? null;

  // Score drift — RED (user-visible)
  if (snapHome !== authHome || snapAway !== authAway) {
    reasons.push(`score drift: authority=${authHome}–${authAway} snapshot=${snapHome}–${snapAway}`);
  }

  // State drift — RED (user-visible)
  const snapState = stateFromStatus(m.status ?? '');
  if (snapState !== auth.state) {
    reasons.push(`state drift: authority=${auth.state} snapshot=${snapState}`);
  }

  // Enrichment drift — YELLOW (non-critical)
  const snapEnrich = (m as { enrichmentApplied?: boolean }).enrichmentApplied;
  if (snapEnrich !== undefined && snapEnrich !== auth.enrichmentApplied) {
    reasons.push(`enrichment drift: authority=${auth.enrichmentApplied} snapshot=${snapEnrich}`);
  }

  // Goals count drift — YELLOW
  const authGoals = auth.goals?.length ?? 0;
  const snapGoals = (m.goals ?? []).length;
  if (authGoals !== snapGoals) {
    reasons.push(`goals drift: authority=${authGoals} snapshot=${snapGoals}`);
  }

  // Lineup missing in snapshot — YELLOW
  const lineupOk = (m.lineups?.home?.players?.length ?? 0) > 0 &&
                   (m.lineups?.away?.players?.length ?? 0) > 0;
  if (!lineupOk) {
    const total = (authHome ?? 0) + (authAway ?? 0);
    if (total > 0) {
      reasons.push('lineup missing in snapshot for scored match');
    }
  }

  if (reasons.length === 0) return null;

  const hasRedReason = reasons.some(r =>
    r.includes('score drift') || r.includes('state drift'),
  );

  return {
    matchId:  auth.id,
    home:     auth.homeTeam?.name ?? m.homeTeam?.name ?? '?',
    away:     auth.awayTeam?.name ?? m.awayTeam?.name ?? '?',
    score:    `${authHome ?? '?'}–${authAway ?? '?'}`,
    severity: hasRedReason ? 'RED' : 'YELLOW',
    reasons,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const _start        = Date.now();
  const triggerSource = detectTriggerSource(req);

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    await recordCronRun('drift-scan', Date.now() - _start, 'error', triggerSource);
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now     = Date.now();
  const builtAt = new Date(now).toISOString();

  // ── 1. Read authority cache ────────────────────────────────────────────────
  let allMatches: CanonicalMatch[];
  try {
    allMatches = await readAuthorityCache(builtAt);
  } catch (err) {
    console.error(`[DriftScan] authority cache read failed: ${err instanceof Error ? err.message : String(err)}`);
    await recordCronRun('drift-scan', Date.now() - _start, 'error', triggerSource);
    return NextResponse.json({ error: 'Authority cache unavailable' }, { status: 503 });
  }

  const finished = allMatches.filter(m => m.state === 'finished');

  // ── 2. Batch-read match snapshots ─────────────────────────────────────────
  const snapResults = await Promise.allSettled(
    finished.map(m => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
  );

  // ── 3. Detect drift ───────────────────────────────────────────────────────
  const driftEntries: DriftEntry[] = [];
  let green = 0;
  let yellow = 0;
  let red = 0;

  for (let i = 0; i < finished.length; i++) {
    const auth = finished[i];
    const res  = snapResults[i];
    const snap = res.status === 'fulfilled' ? res.value : null;

    const drift = detectDrift(auth, snap);

    if (!drift) {
      green++;
    } else {
      driftEntries.push(drift);
      if (drift.severity === 'RED') {
        red++;
        // Log each RED drift — structured for Vercel log alerts
        for (const reason of drift.reasons) {
          console.warn(`[DriftScan] DRIFT matchId=${drift.matchId} reason="${reason}" severity=RED`);
        }
      } else {
        yellow++;
        for (const reason of drift.reasons) {
          console.log(`[DriftScan] DRIFT matchId=${drift.matchId} reason="${reason}" severity=YELLOW`);
        }
      }
    }
  }

  console.log(`[DriftScan] SUMMARY total=${finished.length} green=${green} yellow=${yellow} red=${red} scannedAt=${builtAt}`);

  if (red > 0) {
    console.error(`[DriftScan] ALERT red=${red} — score/state drift detected, manual repair required`);
  }

  await recordCronRun('drift-scan', Date.now() - _start, 'ok', triggerSource);

  return NextResponse.json(
    {
      scannedAt: builtAt,
      total:     finished.length,
      green,
      yellow,
      red,
      verdict:   red > 0 ? 'RED' : yellow > 0 ? 'YELLOW' : 'GREEN',
      driftEntries,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
