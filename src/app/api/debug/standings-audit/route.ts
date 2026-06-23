/**
 * GET /api/debug/standings-audit
 *
 * DATA-18WC.4 — WC standings source audit.
 *
 * Reads the raw KV entry for /competitions/WC/standings and returns:
 *   - KV entry presence / freshness
 *   - Raw group keys as returned by football-data.org
 *   - First-team P/W/D/L/GD/PTS per group (shows if data is live or zeroed)
 *   - Merge diagnostic: which static groups were overridden vs fell back
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getStaticWCGroupTables } from '@/lib/wc-static-groups';
import type { StandingTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KV_KEY    = 'goalradar:/competitions/WC/standings';
const DR_KEY    = 'goalradar:dr:/competitions/WC/standings';

interface KVEntry {
  data:       unknown;
  fetchedAt:  number;
  freshUntil: number;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();

  // ── 1. Read raw KV entries ──────────────────────────────────────────────────
  const [mainEntry, drEntry] = await Promise.all([
    kv.get<KVEntry>(KV_KEY).catch(() => null),
    kv.get<KVEntry>(DR_KEY).catch(() => null),
  ]);
  const [mainTtl, drTtl] = await Promise.all([
    kv.ttl(KV_KEY).catch(() => null),
    kv.ttl(DR_KEY).catch(() => null),
  ]);

  const mainExists = mainEntry !== null;
  const drExists   = drEntry   !== null;

  // ── 2. Analyse the raw standings data ──────────────────────────────────────
  type RawStandings = { standings?: StandingTable[]; competition?: { name: string; emblem: string } };

  function analyseStandings(raw: unknown) {
    if (!raw || typeof raw !== 'object') return { error: 'not an object' };
    const s = raw as RawStandings;
    const standings = s.standings ?? [];
    const total = standings.filter(st => st.type === 'TOTAL');
    return {
      totalStandingsCount: standings.length,
      totalTypeCount:      total.length,
      competitionName:     s.competition?.name ?? null,
      groups: total.map(st => {
        const first = st.table[0];
        return {
          group:       st.group,
          stage:       st.stage,
          type:        st.type,
          tableLength: st.table.length,
          firstTeam:   first ? {
            name:        first.team?.name,
            playedGames: first.playedGames,
            won:         first.won,
            draw:        first.draw,
            lost:        first.lost,
            points:      first.points,
            goalDifference: first.goalDifference,
          } : null,
        };
      }),
    };
  }

  // ── 3. Merge diagnostic ─────────────────────────────────────────────────────
  function mergeDiagnostic(raw: unknown) {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as RawStandings;
    const standings = (s.standings ?? []).filter(st => st.type === 'TOTAL');
    const liveByGroup = new Map(standings.map(st => [st.group, st]));
    const staticTables = getStaticWCGroupTables();

    return staticTables.map(staticEntry => {
      const liveMatch = liveByGroup.get(staticEntry.group);
      return {
        staticGroup:   staticEntry.group,
        liveFound:     !!liveMatch,
        liveGroupKey:  liveMatch ? liveMatch.group : null,
        source:        liveMatch ? 'LIVE' : 'STATIC',
        liveP:         liveMatch?.table[0]?.playedGames ?? null,
        livePTS:       liveMatch?.table[0]?.points      ?? null,
      };
    });
  }

  const mainAnalysis = mainExists ? analyseStandings(mainEntry!.data) : null;
  const drAnalysis   = drExists   ? analyseStandings(drEntry!.data)   : null;
  const mergeResult  = mainExists ? mergeDiagnostic(mainEntry!.data)
                     : drExists   ? mergeDiagnostic(drEntry!.data)
                     : null;

  // ── 4. Summary verdict ──────────────────────────────────────────────────────
  const liveOverrides = mergeResult?.filter(r => r.source === 'LIVE').length ?? 0;
  const staticFallbacks = mergeResult?.filter(r => r.source === 'STATIC').length ?? 0;
  const dataSource = mainExists ? 'KV_MAIN' : drExists ? 'KV_DR' : 'STATIC_SEED';

  let verdict: string;
  if (!mainExists && !drExists) {
    verdict = 'KV_MISS — serving static seed data (P=0, PTS=0 everywhere)';
  } else if (liveOverrides === 0) {
    verdict = 'KV_HIT_BUT_NO_MATCH — group key mismatch, all 12 groups use static seed';
  } else if (staticFallbacks > 0) {
    verdict = `KV_PARTIAL — ${liveOverrides}/12 groups from live, ${staticFallbacks} from static`;
  } else {
    verdict = `KV_FULL — all 12 groups from live data`;
  }

  return NextResponse.json({
    checkedAt:     new Date(now).toISOString(),
    verdict,
    dataSource,

    main: {
      exists:     mainExists,
      ttlSec:     mainTtl,
      fetchedAt:  mainEntry ? new Date(mainEntry.fetchedAt).toISOString()  : null,
      freshUntil: mainEntry ? new Date(mainEntry.freshUntil).toISOString() : null,
      isFresh:    mainEntry ? mainEntry.freshUntil > now                   : false,
    },
    dr: {
      exists:     drExists,
      ttlSec:     drTtl,
      fetchedAt:  drEntry ? new Date(drEntry.fetchedAt).toISOString()  : null,
      freshUntil: drEntry ? new Date(drEntry.freshUntil).toISOString() : null,
    },

    analysis:   mainAnalysis ?? drAnalysis,
    mergeResult,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
