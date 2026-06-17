/**
 * GET /api/debug/worldcup-health
 *
 * DATA-18G Phase 4 — World Cup Single Source of Truth health aggregator.
 *
 * Calls five subsystem checks in parallel and returns a single verdict:
 *   GREEN  — all subsystems healthy
 *   YELLOW — non-critical issues (enrichment drift, stale feeds, lineup gaps)
 *   RED    — critical issues (score drift, missing snapshots, authority absent)
 *
 * Subsystems checked:
 *   1. authority-freshness  — cache age and TTL tier
 *   2. authority-drift      — authority vs snapshot diff (score, state, enrichment)
 *   3. feed-integrity       — FINISHED/UPCOMING feed cross-validation
 *   4. data18d1-integrity-audit — per-snapshot goals/lineup/score consistency
 *   5. enrichment-health    — unenriched FINISHED scored matches
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/worldcup-health?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';

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
// Subsystem caller — internal fetch against own API
// ---------------------------------------------------------------------------

type SubsystemVerdict = 'GREEN' | 'YELLOW' | 'RED' | 'ERROR';

interface SubsystemResult {
  name:        string;
  verdict:     SubsystemVerdict;
  durationMs:  number;
  summary:     string;
  detail?:     Record<string, unknown>;
}

async function callSubsystem(
  name:    string,
  baseUrl: string,
  path:    string,
  secret:  string,
): Promise<SubsystemResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}?secret=${encodeURIComponent(secret)}`, {
      headers: { 'Cache-Control': 'no-store' },
      signal: AbortSignal.timeout(25_000),
    });

    const durationMs = Date.now() - t0;

    if (!res.ok) {
      return { name, verdict: 'ERROR', durationMs, summary: `HTTP ${res.status}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const raw  = (data.verdict ?? data.overallVerdict ?? data.gate) as string | undefined;

    const verdict: SubsystemVerdict =
      raw === 'GREEN'  || raw === 'PASS'  ? 'GREEN'
      : raw === 'YELLOW' || raw === 'WARN' ? 'YELLOW'
      : raw === 'RED'  || raw === 'FAIL'  ? 'RED'
      : 'ERROR';

    // Build a compact summary from the most relevant scalar fields
    const summary = buildSummary(name, data);

    return { name, verdict, durationMs, summary, detail: data };
  } catch (err) {
    return {
      name,
      verdict:    'ERROR',
      durationMs: Date.now() - t0,
      summary:    err instanceof Error ? err.message : String(err),
    };
  }
}

function buildSummary(name: string, d: Record<string, unknown>): string {
  switch (name) {
    case 'authority-freshness':
      return `source=${d.source} ageSec=${d.ageSec} ttlTier=${d.ttlTier} stale=${d.stale}`;
    case 'authority-drift':
      return `total=${d.total} green=${d.green} yellow=${d.yellow} red=${d.red}`;
    case 'feed-integrity':
      return `issues=${d.issueCount} red=${d.redCount} yellow=${d.yellowCount}`;
    case 'integrity-audit':
      return `total=${d.totalMatches} pass=${d.pass} warn=${d.warn} fail=${d.fail}`;
    case 'enrichment-health': {
      const m = d as { totalFinished?: number; unenrichedCount?: number; enrichmentRate?: string };
      return `totalFinished=${m.totalFinished} unenriched=${m.unenrichedCount} rate=${m.enrichmentRate}`;
    }
    default:
      return JSON.stringify(d).slice(0, 120);
  }
}

// ---------------------------------------------------------------------------
// Aggregate verdict
// ---------------------------------------------------------------------------

function aggregateVerdict(results: SubsystemResult[]): 'GREEN' | 'YELLOW' | 'RED' {
  const verdicts = results.map(r => r.verdict);
  if (verdicts.includes('RED')   || verdicts.includes('ERROR')) return 'RED';
  if (verdicts.includes('YELLOW'))                               return 'YELLOW';
  return 'GREEN';
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

  const secret  = process.env.CRON_SECRET ?? '';
  // Derive base URL from request — works in both prod and preview deployments
  const reqUrl  = new URL(req.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  const checkedAt = new Date().toISOString();

  // ── Run all 5 subsystems in parallel ─────────────────────────────────────
  const [freshness, drift, feedInt, intAudit, enrichHealth] = await Promise.all([
    callSubsystem('authority-freshness',   baseUrl, '/api/debug/authority-freshness',      secret),
    callSubsystem('authority-drift',       baseUrl, '/api/debug/authority-drift',           secret),
    callSubsystem('feed-integrity',        baseUrl, '/api/debug/feed-integrity',            secret),
    callSubsystem('integrity-audit',       baseUrl, '/api/debug/data18d1-integrity-audit',  secret),
    callSubsystem('enrichment-health',     baseUrl, '/api/debug/enrichment-health',         secret),
  ]);

  const subsystems = [freshness, drift, feedInt, intAudit, enrichHealth];
  const verdict    = aggregateVerdict(subsystems);

  const redSystems    = subsystems.filter(s => s.verdict === 'RED'    || s.verdict === 'ERROR');
  const yellowSystems = subsystems.filter(s => s.verdict === 'YELLOW');

  return NextResponse.json(
    {
      checkedAt,
      verdict,
      subsystems: subsystems.map(s => ({
        name:       s.name,
        verdict:    s.verdict,
        durationMs: s.durationMs,
        summary:    s.summary,
      })),
      redSystems:    redSystems.map(s => s.name),
      yellowSystems: yellowSystems.map(s => s.name),
      note: verdict === 'GREEN'
        ? 'All 5 World Cup health checks GREEN. No action required.'
        : verdict === 'YELLOW'
        ? `Non-critical issues: ${yellowSystems.map(s => s.name).join(', ')}. Monitor.`
        : `Critical issues in: ${redSystems.map(s => s.name).join(', ')}. Immediate action required.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
