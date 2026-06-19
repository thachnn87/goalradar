/**
 * GET /api/debug/full-audit
 *
 * DATA-18B.3A: Full 104-match consistency audit.
 *
 * Reads ALL matches from the authority cache (not a sample), batch-reads
 * every snapshot from KV, and produces a complete consistency matrix.
 *
 * Checks per match:
 *   - Unique matchId (no duplicates)
 *   - Valid state (scheduled | live | finished | cancelled)
 *   - Valid score structure
 *   - Valid teams (homeTeam.id, awayTeam.id non-zero)
 *   - Valid stage and group assignment
 *   - Snapshot existence (for finished matches)
 *   - Snapshot state/score/kickoff consistency with authority record
 *
 * Auth: ?secret=<CRON_SECRET>  or  Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { readAuthorityCache }        from '@/lib/authority-cache';
import type { CanonicalMatch }       from '@/lib/canonical-match';
import type { MatchSnapshot }        from '@/lib/match-snapshot';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET ?? '';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ??
                 req.nextUrl.searchParams.get('secret') ?? '';
  return !!secret && secret === CRON_SECRET;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchGate = 'GREEN' | 'YELLOW' | 'RED';

export interface MatchRow {
  matchId:    number;
  home:       string;
  away:       string;
  utcDate:    string;
  state:      string;
  score:      string;
  group:      string | null;
  stage:      string;

  // Authority audit
  authorityGate:   MatchGate;
  authorityIssues: string[];

  // Snapshot audit
  snapshotPresent: boolean;
  snapshotGate:    MatchGate;
  snapshotIssues:  string[];

  // Cross-layer consistency
  consistencyGate:   MatchGate;
  consistencyIssues: string[];
}

export interface StructuralStats {
  teams:        Set<number> | number;
  groups:       Set<string> | string[];
  stages:       Record<string, number>;
  groupCounts:  Record<string, number>;
  duplicateIds: number[];
}

// ---------------------------------------------------------------------------
// Batch-read snapshots
// ---------------------------------------------------------------------------

async function batchReadSnapshots(ids: number[]): Promise<Map<number, MatchSnapshot>> {
  const map  = new Map<number, MatchSnapshot>();
  if (ids.length === 0) return map;

  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk    = ids.slice(i, i + CHUNK);
    const keys     = chunk.map(id => `goalradar:match:${id}`);
    try {
      const results = await kv.mget<(MatchSnapshot | null)[]>(...keys);
      for (let j = 0; j < results.length; j++) {
        const snap = results[j];
        if (snap !== null && snap !== undefined) {
          map.set(chunk[j], snap);
        }
      }
    } catch (err) {
      console.error('[full-audit] snapshot mget error:', err instanceof Error ? err.message : String(err));
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Validate a single authority record
// ---------------------------------------------------------------------------

const VALID_STATES = new Set(['scheduled', 'live', 'finished', 'cancelled']);

function auditAuthority(m: CanonicalMatch): { gate: MatchGate; issues: string[] } {
  const issues: string[] = [];

  if (!VALID_STATES.has(m.state)) {
    issues.push(`invalid state: ${m.state}`);
  }
  // Knockout scheduled matches legitimately have id=0 (teams not yet determined).
  // Flag as YELLOW (TBD placeholder) not RED.
  const isTBDSlot = m.state === 'scheduled' && m.stage !== 'GROUP_STAGE';
  if (!isTBDSlot) {
    if (!m.homeTeam?.id || m.homeTeam.id === 0) {
      issues.push('homeTeam.id missing or zero');
    }
    if (!m.awayTeam?.id || m.awayTeam.id === 0) {
      issues.push('awayTeam.id missing or zero');
    }
  } else if (!m.homeTeam?.id || m.homeTeam.id === 0) {
    // Expected TBD — YELLOW severity only
    issues.push('TBD: knockout teams not yet determined (expected)');
  }
  if (!m.score?.fullTime) {
    issues.push('score.fullTime missing');
  } else {
    if (m.state === 'finished') {
      if (typeof m.score.fullTime.home !== 'number') issues.push('score.fullTime.home not a number');
      if (typeof m.score.fullTime.away !== 'number') issues.push('score.fullTime.away not a number');
    }
  }
  if (!m.stage) {
    issues.push('stage missing');
  }
  if (!m.utcDate) {
    issues.push('utcDate missing');
  }
  // For group-stage matches, group must be set
  if (m.stage?.includes('GROUP') && !m.group) {
    issues.push('group stage match missing group');
  }

  if (issues.length === 0) return { gate: 'GREEN', issues: [] };
  // Score/state issues are RED; enrichment/group issues are YELLOW
  const hasRedIssue = issues.some(i =>
    i.startsWith('invalid state') ||
    i.startsWith('score.fullTime.home') ||
    i.startsWith('score.fullTime.away') ||
    (i.startsWith('homeTeam') && !i.includes('TBD')) ||
    (i.startsWith('awayTeam') && !i.includes('TBD')),
  );
  return { gate: hasRedIssue ? 'RED' : 'YELLOW', issues };
}

// ---------------------------------------------------------------------------
// Validate snapshot against authority record
// ---------------------------------------------------------------------------

function auditSnapshot(
  m:    CanonicalMatch,
  snap: MatchSnapshot | undefined,
): { present: boolean; gate: MatchGate; issues: string[] } {
  if (!snap) {
    // Snapshots are only expected for finished matches (match page has been visited)
    if (m.state === 'finished') {
      return { present: false, gate: 'YELLOW', issues: ['snapshot missing for finished match'] };
    }
    return { present: false, gate: 'GREEN', issues: [] };
  }

  const issues: string[] = [];
  const md = snap.match;

  if (!md) {
    return { present: true, gate: 'RED', issues: ['snapshot.match is null/undefined'] };
  }

  // State consistency
  const snapFinished = md.status === 'FINISHED';
  const authFinished = m.state === 'finished';
  if (authFinished && !snapFinished) {
    issues.push(`state mismatch: authority=finished snapshot=${md.status}`);
  }
  if (!authFinished && snapFinished && m.state !== 'cancelled') {
    issues.push(`state mismatch: authority=${m.state} snapshot=FINISHED`);
  }

  // Score consistency (only for finished)
  if (m.state === 'finished' && md.status === 'FINISHED') {
    const aH = m.score?.fullTime?.home;
    const aA = m.score?.fullTime?.away;
    const sH = md.score?.fullTime?.home;
    const sA = md.score?.fullTime?.away;
    if (typeof aH === 'number' && typeof sH === 'number' && aH !== sH) {
      issues.push(`score home mismatch: authority=${aH} snapshot=${sH}`);
    }
    if (typeof aA === 'number' && typeof sA === 'number' && aA !== sA) {
      issues.push(`score away mismatch: authority=${aA} snapshot=${sA}`);
    }
  }

  // Kickoff consistency
  if (m.utcDate && md.utcDate && m.utcDate !== md.utcDate) {
    issues.push(`utcDate mismatch: authority=${m.utcDate} snapshot=${md.utcDate}`);
  }

  if (issues.length === 0) return { present: true, gate: 'GREEN', issues: [] };
  const hasRedIssue = issues.some(i => i.includes('score') && i.includes('mismatch') && !i.includes('utcDate'));
  const hasStateMismatch = issues.some(i => i.includes('state mismatch'));
  return {
    present: true,
    gate:    (hasRedIssue || hasStateMismatch) ? 'RED' : 'YELLOW',
    issues,
  };
}

// ---------------------------------------------------------------------------
// Overall row gate
// ---------------------------------------------------------------------------

function worstGate(gates: MatchGate[]): MatchGate {
  if (gates.includes('RED'))    return 'RED';
  if (gates.includes('YELLOW')) return 'YELLOW';
  return 'GREEN';
}

function scoreStr(m: CanonicalMatch): string {
  if (m.state === 'scheduled') return '–';
  const h = m.score?.fullTime?.home ?? '?';
  const a = m.score?.fullTime?.away ?? '?';
  return `${h}–${a}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auditStart = Date.now();
  const builtAt    = new Date().toISOString();

  // ── 1. Read all authority cache matches ──────────────────────────────────
  let allMatches: CanonicalMatch[];
  try {
    allMatches = await readAuthorityCache(builtAt, {
      source:     '/api/debug/full-audit',
      sourceType: 'debug',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Authority cache read failed', detail: String(err) },
      { status: 500 },
    );
  }

  // ── 2. Duplicate check ───────────────────────────────────────────────────
  const idCount  = new Map<number, number>();
  for (const m of allMatches) {
    idCount.set(m.id, (idCount.get(m.id) ?? 0) + 1);
  }
  const duplicateIds = [...idCount.entries()]
    .filter(([, c]) => c > 1)
    .map(([id]) => id);

  // ── 3. Batch-read all snapshots ──────────────────────────────────────────
  const allIds      = allMatches.map(m => m.id);
  const snapMap     = await batchReadSnapshots(allIds);

  // ── 4. Audit each match ──────────────────────────────────────────────────
  const rows: MatchRow[] = [];

  // Structural counters
  const teamIds   = new Set<number>();
  const groups    = new Set<string>();
  const stageMap  = new Map<string, number>();

  for (const m of allMatches) {
    // Structural tracking
    if (m.homeTeam?.id) teamIds.add(m.homeTeam.id);
    if (m.awayTeam?.id) teamIds.add(m.awayTeam.id);
    if (m.group)        groups.add(m.group);
    stageMap.set(m.stage, (stageMap.get(m.stage) ?? 0) + 1);

    const auth  = auditAuthority(m);
    const snap  = snapMap.get(m.id);
    const sAudit = auditSnapshot(m, snap);

    // Cross-layer consistency
    const consistencyIssues: string[] = [...sAudit.issues.filter(i =>
      i.includes('score') || i.includes('state mismatch') || i.includes('utcDate'),
    )];
    const consistencyGate = worstGate([
      auth.gate,
      sAudit.gate,
    ]);

    rows.push({
      matchId:    m.id,
      home:       m.homeTeam?.name ?? '?',
      away:       m.awayTeam?.name ?? '?',
      utcDate:    m.utcDate,
      state:      m.state,
      score:      scoreStr(m),
      group:      m.group ?? null,
      stage:      m.stage,

      authorityGate:   auth.gate,
      authorityIssues: auth.issues,

      snapshotPresent: sAudit.present,
      snapshotGate:    sAudit.gate,
      snapshotIssues:  sAudit.issues,

      consistencyGate,
      consistencyIssues,
    });
  }

  // ── 5. Summary stats ─────────────────────────────────────────────────────
  const byAuthGate  = { GREEN: 0, YELLOW: 0, RED: 0 };
  const bySnapGate  = { GREEN: 0, YELLOW: 0, RED: 0 };
  const byConsGate  = { GREEN: 0, YELLOW: 0, RED: 0 };
  let snapshotPresent = 0;
  let snapshotMissing = 0;

  for (const r of rows) {
    byAuthGate[r.authorityGate]++;
    bySnapGate[r.snapshotGate]++;
    byConsGate[r.consistencyGate]++;
    if (r.snapshotPresent) snapshotPresent++; else snapshotMissing++;
  }

  // State distribution
  const byState: Record<string, number> = {};
  for (const m of allMatches) {
    byState[m.state] = (byState[m.state] ?? 0) + 1;
  }

  // Stage distribution
  const stages: Record<string, number> = {};
  stageMap.forEach((count, stage) => { stages[stage] = count; });

  // Group distribution
  const groupCounts: Record<string, number> = {};
  for (const m of allMatches) {
    if (m.group) {
      groupCounts[m.group] = (groupCounts[m.group] ?? 0) + 1;
    }
  }

  // RED/YELLOW rows for quick review
  const nonGreenRows = rows.filter(r =>
    r.authorityGate !== 'GREEN' || r.snapshotGate !== 'GREEN',
  ).map(r => ({
    matchId:          r.matchId,
    home:             r.home,
    away:             r.away,
    state:            r.state,
    score:            r.score,
    authorityGate:    r.authorityGate,
    authorityIssues:  r.authorityIssues,
    snapshotGate:     r.snapshotGate,
    snapshotIssues:   r.snapshotIssues,
    consistencyGate:  r.consistencyGate,
    consistencyIssues: r.consistencyIssues,
  }));

  const durationMs = Date.now() - auditStart;

  return NextResponse.json({
    auditedAt:   builtAt,
    durationMs,
    totalMatches: allMatches.length,

    // State breakdown
    byState,

    // Authority audit
    authority: {
      ...byAuthGate,
      total: allMatches.length,
      duplicateIds,
    },

    // Snapshot audit
    snapshots: {
      ...bySnapGate,
      present: snapshotPresent,
      missing: snapshotMissing,
      total:   allMatches.length,
    },

    // Consistency
    consistency: {
      ...byConsGate,
      total: allMatches.length,
    },

    // Structural validation
    structure: {
      teamCount:   teamIds.size,
      groupCount:  groups.size,
      groups:      [...groups].sort(),
      stages,
      groupCounts,
      matchCount:  allMatches.length,
    },

    // Issues
    nonGreenRows,

    // Full matrix (all 104 rows)
    matrix: rows,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
