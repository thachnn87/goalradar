import Link from 'next/link';
import type { CanonicalMatch } from '@/lib/canonical-match';
import { matchPath } from '@/lib/url';
import LiveBannerCTA from '@/components/LiveBannerCTA';

// Opening match: Mexico vs South Africa — confirmed from football-data.org API
const OPENING_MATCH_UTC = '2026-06-11T19:00:00Z';
const OPENING_MATCH_LABEL = 'Mexico vs South Africa';

// Tournament end
const TOURNAMENT_END_UTC = '2026-07-19T23:59:00Z';

// ---------------------------------------------------------------------------
// Time computation (server-side at request time — accurate via ISR)
// ---------------------------------------------------------------------------

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function computeTimeLeft(targetISO: string): TimeLeft {
  const now    = Date.now();
  const target = new Date(targetISO).getTime();
  const diff   = Math.max(0, target - now);

  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000)  /    60_000);
  const seconds = Math.floor((diff % 60_000)      /     1_000);

  return { days, hours, minutes, seconds, totalMs: diff };
}

function formatOpeningDate() {
  return new Date(OPENING_MATCH_UTC).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

// ---------------------------------------------------------------------------
// Unit block
// ---------------------------------------------------------------------------

function Unit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 sm:px-6 sm:py-4 min-w-[64px] sm:min-w-[80px] text-center">
        <span className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
          {display}
        </span>
      </div>
      <span className="text-gray-500 text-xs uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span className="text-gray-600 text-3xl font-bold self-start mt-3 sm:mt-4 select-none">:</span>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function WCCountdown({
  compact = false,
  liveMatches,
  currentPath,
}: {
  compact?: boolean;
  /** LIVE-2: in-play WC matches, passed by pages that already fetch them
   *  (zero extra fetches). Omitted → treated as no live matches (tournament in progress). */
  liveMatches?: Array<Pick<CanonicalMatch, 'id' | 'homeTeam' | 'awayTeam'>>;
  /** LIVE-2: pathname of the rendering page — used by the self-reference guard. */
  currentPath?: string;
}) {
  const now = Date.now();
  const openingMs  = new Date(OPENING_MATCH_UTC).getTime();
  const tournamentEndMs = new Date(TOURNAMENT_END_UTC).getTime();

  // States: upcoming | live | finished
  const isLive     = now >= openingMs && now <= tournamentEndMs;
  const isFinished = now > tournamentEndMs;

  if (isFinished) return null; // no countdown needed after tournament

  if (isLive) {
    // ── LIVE-2: dynamic CTA ──────────────────────────────────────────────
    // Exactly one live match  → "Match Center →"  → canonical match page
    // Multiple live matches   → "View Live Scores →" → /live
    // No live matches         → "Fixtures & Results →" → /world-cup-2026
    const live = liveMatches ?? [];
    const hasLive = live.length > 0;
    let ctaHref:  string;
    let ctaLabel: string;
    let ctaMatchId: number | null = null;

    if (live.length === 1) {
      const m   = live[0];
      ctaHref   = matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name);
      ctaLabel  = 'Match Center →';
      ctaMatchId = m.id;
    } else if (live.length > 1) {
      ctaHref  = '/live';
      ctaLabel = 'View Live Scores →';
    } else {
      ctaHref  = '/world-cup-2026';
      ctaLabel = 'Fixtures & Results →';
    }

    // Safeguard: the CTA must never point at the page it is rendered on.
    if (currentPath && ctaHref === currentPath) {
      ctaHref  = '/live';
      ctaLabel = 'View Live Scores →';
      ctaMatchId = null;
    }

    // Tournament is underway — show in-progress banner.
    // Pulsing red dot and "is LIVE" only appear when matches are actually in play.
    return (
      <div className={`rounded-2xl border border-yellow-700/30 bg-gradient-to-br from-yellow-950/50 to-gray-900 overflow-hidden ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="flex items-center gap-2">
                {hasLive && (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
                <p className="text-white font-bold text-sm sm:text-base">
                  {hasLive ? 'FIFA World Cup 2026 is LIVE' : 'FIFA World Cup 2026'}
                </p>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                {live.length === 1
                  ? `${live[0].homeTeam?.shortName ?? live[0].homeTeam?.name ?? 'TBD'} vs ${live[0].awayTeam?.shortName ?? live[0].awayTeam?.name ?? 'TBD'} — in play`
                  : live.length > 1
                    ? `${live.length} matches in play`
                    : 'No matches live right now'}
              </p>
            </div>
          </div>
          <LiveBannerCTA
            href={ctaHref}
            label={ctaLabel}
            matchId={ctaMatchId}
            liveMatchCount={live.length}
          />
        </div>
      </div>
    );
  }

  // Upcoming — compute countdown
  const { days, hours, minutes } = computeTimeLeft(OPENING_MATCH_UTC);

  return (
    <div className={`rounded-2xl border border-yellow-700/30 bg-gradient-to-br from-yellow-950/50 via-gray-900 to-gray-900 overflow-hidden ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={compact ? 'text-xl' : 'text-2xl'}>🏆</span>
            <h2 className={`font-black text-white ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
              FIFA World Cup 2026
            </h2>
          </div>
          <p className="text-yellow-500/80 text-xs font-medium uppercase tracking-wider">
            Countdown to kick-off
          </p>
        </div>
        <Link
          href="/world-cup-2026"
          className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1"
        >
          Explore →
        </Link>
      </div>

      {/* Countdown units */}
      <div className="flex items-start justify-center gap-2 sm:gap-4 mb-5">
        <Unit value={days}    label="Days"    />
        <Separator />
        <Unit value={hours}   label="Hours"   />
        <Separator />
        <Unit value={minutes} label="Minutes" />
      </div>

      {/* Opening match info */}
      <div className="border-t border-gray-800/60 pt-4 text-center">
        <p className="text-gray-400 text-sm font-medium mb-0.5">
          Opening Match · {OPENING_MATCH_LABEL}
        </p>
        <p className="text-gray-600 text-xs">{formatOpeningDate()}</p>
      </div>

      {/* CTA row */}
      {!compact && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Link
            href="/world-cup-2026"
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            🏆 World Cup Hub
          </Link>
          <Link
            href="/schedule?competition=WC"
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-gray-700"
          >
            📅 WC Fixtures
          </Link>
          <Link
            href="/world-cup-2026/bracket"
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-gray-700"
          >
            🔗 Bracket
          </Link>
        </div>
      )}
    </div>
  );
}
