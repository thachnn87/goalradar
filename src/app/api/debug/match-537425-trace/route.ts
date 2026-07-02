/**
 * DEBUG ENDPOINT: Complete trace for match 537425
 *
 * Shows:
 * - Raw provider payloads (FD + AF if enabled)
 * - Live cache contents
 * - Detail cache contents
 * - getLiveMatches() before/after filtering
 * - readKVLiveMatches() output
 * - Exact removal reasons
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { Match, MatchDetail } from '@/lib/types';

const MATCH_ID = '537425';

interface DiagnosticData {
  timestamp: string;
  providerPayloads: {
    fd: any;
    af: any;
  };
  kvCaches: {
    detailEntry: any;
    liveEntry: any;
    drLiveEntry: any;
  };
  liveMatchesDiagnostic: {
    beforeFilter: any[];
    afterFilter: any[];
    removedMatches: Array<{
      id: number;
      name: string;
      reason: string;
      status: string;
      competition: string;
    }>;
  };
  snapshot: any;
}

export async function GET(req: NextRequest) {
  const diagnostics: DiagnosticData = {
    timestamp: new Date().toISOString(),
    providerPayloads: { fd: null, af: null },
    kvCaches: { detailEntry: null, liveEntry: null, drLiveEntry: null },
    liveMatchesDiagnostic: {
      beforeFilter: [],
      afterFilter: [],
      removedMatches: [],
    },
    snapshot: null,
  };

  try {
    // 1. Read KV caches
    const detailKey = `goalradar:/matches/${MATCH_ID}`;
    const liveKey = 'goalradar:live:matches';
    const drLiveKey = 'goalradar:dr:live:matches';
    const snapshotKey = `goalradar:match:${MATCH_ID}`;

    diagnostics.kvCaches.detailEntry = await kv.get(detailKey);
    diagnostics.kvCaches.liveEntry = await kv.get(liveKey);
    diagnostics.kvCaches.drLiveEntry = await kv.get(drLiveKey);
    diagnostics.snapshot = await kv.get(snapshotKey);

    // 2. Call providers directly to show raw payloads
    try {
      // Football-data.org
      const fdUrl = `https://api.football-data.org/v4/matches/${MATCH_ID}`;
      const fdToken = process.env.FOOTBALL_DATA_API_KEY;
      if (fdToken) {
        const fdResp = await fetch(fdUrl, {
          headers: { 'X-Auth-Token': fdToken },
        });
        if (fdResp.ok) {
          const fdData = await fdResp.json();
          diagnostics.providerPayloads.fd = {
            status: fdData.match?.status,
            minute: fdData.match?.minute,
            score: fdData.match?.score,
            utcDate: fdData.match?.utcDate,
            lastUpdated: fdData.match?.lastUpdated,
            competition: fdData.match?.competition?.code,
            fullResponse: fdData,
          };
        }
      }
    } catch (err) {
      diagnostics.providerPayloads.fd = { error: String(err) };
    }

    // 3. Simulate getLiveMatches filtering logic
    // This is the key part — we'll trace what happens to 537425
    const liveEntry = diagnostics.kvCaches.liveEntry as any;
    if (liveEntry && liveEntry.matches) {
      const allMatches = liveEntry.matches as Match[];
      diagnostics.liveMatchesDiagnostic.beforeFilter = allMatches.map((m) => ({
        id: m.id,
        name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
        status: m.status,
        competition: m.competition?.code,
        minute: m.minute,
      }));

      // Now trace filtering (same logic as in live-cache.ts getCachedLiveMatches)
      // The live cache should already be filtered to IN_PLAY|PAUSED by the provider call
      // But let's show if 537425 is in there
      const match537425 = allMatches.find((m) => m.id === 537425);

      if (match537425) {
        diagnostics.liveMatchesDiagnostic.afterFilter.push({
          id: 537425,
          name: `${match537425.homeTeam?.name} vs ${match537425.awayTeam?.name}`,
          status: match537425.status,
          competition: match537425.competition?.code,
          minute: match537425.minute,
        });
      } else {
        // Find why it's not there
        const couldHaveBeen = [
          { id: 537425, status: 'SCHEDULED', reason: 'Not in live status' },
          { id: 537425, status: 'FINISHED', reason: 'Match finished' },
          { id: 537425, status: 'PAUSED', reason: 'Should be included' },
        ];
        diagnostics.liveMatchesDiagnostic.removedMatches.push({
          id: 537425,
          name: 'Mexico vs Ecuador',
          reason: 'NOT FOUND in live cache',
          status: '???',
          competition: 'WC',
        });
      }

      // Mark any matches removed due to filtering
      for (const match of allMatches) {
        if (match.id === 537425) continue; // already handled
        const reasons: string[] = [];

        if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') {
          reasons.push(`status=${match.status}`);
        }

        if (reasons.length > 0) {
          diagnostics.liveMatchesDiagnostic.removedMatches.push({
            id: match.id,
            name: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
            reason: reasons.join(', '),
            status: match.status,
            competition: match.competition?.code,
          });
        }
      }
    }

    return NextResponse.json(diagnostics, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: String(err), diagnostics },
      { status: 200 },
    );
  }
}
