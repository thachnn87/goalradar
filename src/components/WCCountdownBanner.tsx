/**
 * WCCountdownBanner
 *
 * A slim, full-width top-of-page banner showing the countdown to
 * FIFA World Cup 2026 kick-off (Days · Hours · Minutes).
 *
 * States:
 *  - upcoming  → countdown strip (default)
 *  - live       → "🔴 LIVE NOW" strip
 *  - finished   → renders null
 *
 * Server-rendered — accurate at ISR revalidation time (homepage revalidates
 * every 30 s so the countdown is always within 30 s of correct).
 */

import Link from 'next/link';

const OPENING_MATCH_UTC  = '2026-06-11T19:00:00Z';
const TOURNAMENT_END_UTC = '2026-07-19T23:59:00Z';

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function timeLeft(targetISO: string) {
  const diff = Math.max(0, new Date(targetISO).getTime() - Date.now());
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  /    60_000),
  };
}

// ---------------------------------------------------------------------------
// Unit chip  —  e.g.  [ 06 Days ]
// ---------------------------------------------------------------------------

function Chip({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-white font-black text-base sm:text-lg tabular-nums leading-none">
        {display}
      </span>
      <span className="text-yellow-600 text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
        {label}
      </span>
    </span>
  );
}

function Dot() {
  return <span className="text-gray-600 font-bold text-sm select-none">·</span>;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function WCCountdownBanner() {
  const now           = Date.now();
  const openingMs     = new Date(OPENING_MATCH_UTC).getTime();
  const tournamentEnd = new Date(TOURNAMENT_END_UTC).getTime();

  // Don't render after the tournament is over
  if (now > tournamentEnd) return null;

  // Tournament is live
  if (now >= openingMs) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-950 via-gray-900 to-yellow-950 border-b border-yellow-700/30">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          {/* Left — live indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-red-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
              <span className="hidden md:inline">FIFA World Cup 2026 — LIVE NOW</span>
              <span className="md:hidden">WC26 LIVE NOW</span>
            </span>
          </div>

          {/* Right — CTA.
              DATA-1 Phase 2: must land on the live-scores experience (/live),
              not the hub — the label says "Live scores". */}
          <Link
            href="/live"
            className="text-xs font-semibold text-yellow-400 hover:text-yellow-200 transition-colors shrink-0 flex items-center gap-1"
          >
            Live scores <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    );
  }

  // Upcoming — show countdown
  const { days, hours, minutes } = timeLeft(OPENING_MATCH_UTC);

  // UI-2: compact inline countdown for mobile — "🏆 WC26 starts in 1d 4h"
  const compact = days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;

  return (
    <div className="w-full bg-gradient-to-r from-yellow-950 via-gray-900 to-yellow-950 border-b border-yellow-700/30">
      {/* ── Mobile (<768px) — single compact line, no wrapping ──────────── */}
      <div className="md:hidden max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
        <span className="text-yellow-500 text-xs font-semibold whitespace-nowrap truncate">
          <span aria-hidden>🏆</span> WC26 starts in{' '}
          <span className="text-white font-black tabular-nums">{compact}</span>
        </span>
        <Link
          href="/world-cup-2026"
          className="text-xs font-semibold text-yellow-400 hover:text-yellow-200 transition-colors shrink-0 whitespace-nowrap"
        >
          Explore <span aria-hidden>→</span>
        </Link>
      </div>

      {/* ── Tablet / desktop (≥768px) — original chip layout ────────────── */}
      <div className="hidden md:flex max-w-5xl mx-auto px-4 py-2 lg:py-2.5 items-center justify-between gap-4">

        {/* Left — label + countdown */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Trophy + label */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-base leading-none" aria-hidden>🏆</span>
            <span className="text-yellow-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
              FIFA World Cup 2026
            </span>
          </div>

          {/* Divider */}
          <span className="text-gray-700 text-xs select-none">|</span>

          {/* Countdown chips */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Chip value={days}    label="Days"    />
            <Dot />
            <Chip value={hours}   label="Hrs"     />
            <Dot />
            <Chip value={minutes} label="Min"     />
          </div>

          {/* Pre-tournament label */}
          <span className="text-gray-600 text-xs whitespace-nowrap">
            until kick-off
          </span>
        </div>

        {/* Right — CTA */}
        <Link
          href="/world-cup-2026"
          className="text-xs font-semibold text-yellow-400 hover:text-yellow-200 transition-colors shrink-0 flex items-center gap-1 whitespace-nowrap"
        >
          Explore <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
