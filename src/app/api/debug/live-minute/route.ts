/**
 * GET /api/debug/live-minute
 *
 * LIVE-3A: Returns all matches currently in the live KV cache with their
 * minute field. Used to verify that the primary provider is supplying
 * minute data and that it survives the KV round-trip.
 *
 * Response shape:
 *   {
 *     generatedAt: string;       // ISO timestamp
 *     count: number;             // number of live matches in KV
 *     matches: Array<{
 *       id: number;
 *       status: string;
 *       minute: number | null;   // null = primary down / no data
 *       score: { home: number | null; away: number | null };
 *       homeTeam: string;
 *       awayTeam: string;
 *     }>;
 *   }
 */

import { NextResponse } from 'next/server';
import { readKVLiveMatches } from '@/lib/live-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const matches = await readKVLiveMatches();

    if (!matches) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        count: 0,
        kvEmpty: true,
        matches: [],
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: matches.length,
      kvEmpty: false,
      matches: matches.map((m) => ({
        id:       m.id,
        status:   m.status,
        minute:   m.minute ?? null,
        score:    { home: m.score.fullTime.home, away: m.score.fullTime.away },
        homeTeam: m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?',
        awayTeam: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?',
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'live cache unavailable', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
