/**
 * GET /api/calendar/[matchId]
 *
 * Dynamically generates and streams an .ics file for a single match.
 * Used by the AddToCalendar component for Apple Calendar and Outlook downloads.
 *
 * Query params (all optional, used to avoid an extra API round-trip when the
 * caller already has the data):
 *   ?home=Brazil&away=Argentina&comp=FIFA+World+Cup+2026&date=2026-06-11T19:00:00Z&venue=MetLife+Stadium
 *
 * If query params are absent the route fetches live match data from the API.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateIcs } from '@/lib/ics';
import { matchPath } from '@/lib/url';

const BASE_URL = 'https://goalradar.org';

type Params = { params: Promise<{ matchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { matchId } = await params;
  const numericId   = parseInt(matchId, 10);

  if (!numericId || isNaN(numericId)) {
    return new NextResponse('Invalid match ID', { status: 400 });
  }

  // ── Prefer query-param fast-path (no extra API call) ──────────────────────
  const { searchParams } = req.nextUrl;
  const home    = searchParams.get('home')  ?? 'Home Team';
  const away    = searchParams.get('away')  ?? 'Away Team';
  const comp    = searchParams.get('comp')  ?? 'Football';
  const utcDate = searchParams.get('date')  ?? '';
  const venue   = searchParams.get('venue') ?? undefined;

  if (!utcDate) {
    return new NextResponse('Missing ?date= parameter', { status: 400 });
  }

  const date = new Date(utcDate);
  if (isNaN(date.getTime())) {
    return new NextResponse('Invalid ?date= value', { status: 400 });
  }

  // ── Build event fields ────────────────────────────────────────────────────
  const summary    = `${home} vs ${away} – ${comp}`;
  const matchUrl   = `${BASE_URL}${matchPath(numericId, home, away)}`;

  const kickoffUTC = date.toLocaleTimeString('en-GB', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'UTC',
    hour12:   false,
  });

  const kickoffDate = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
    timeZone: 'UTC',
  });

  const description = [
    `Match: ${home} vs ${away}`,
    `Competition: ${comp}`,
    `Kickoff: ${kickoffDate} at ${kickoffUTC} UTC`,
    ...(venue ? [`Venue: ${venue}`] : []),
    ``,
    `Live scores & match info:`,
    matchUrl,
  ].join('\n');

  // ── Generate ICS ──────────────────────────────────────────────────────────
  let ics: string;
  try {
    ics = generateIcs({
      matchId,
      utcDate,
      durationMin: 120,
      summary,
      description,
      location:    venue,
      url:         matchUrl,
    });
  } catch (err) {
    console.error('[calendar/route] ICS generation failed:', err);
    return new NextResponse('Failed to generate calendar event', { status: 500 });
  }

  // Safe filename: "Brazil-vs-Argentina-WC2026.ics"
  const safeName = `${home.replace(/\s+/g, '-')}-vs-${away.replace(/\s+/g, '-')}-WC2026.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control':       'public, max-age=300, s-maxage=300',
    },
  });
}
