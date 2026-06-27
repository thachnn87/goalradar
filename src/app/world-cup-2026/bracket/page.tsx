import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import { matchPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import type { Match } from '@/lib/types';
import { deriveMatchDisplay } from '@/lib/match-display';
import MatchCard, { MatchCardSkeleton } from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import WCBracket from '@/components/WCBracket';
import { WC_KNOCKOUT_SLOTS, type WCKnockoutSlot } from '@/lib/wc-fixtures';
import { buildKnockoutViewModel } from '@/lib/knockout-vm';

export const revalidate = 900; // 15 min — bracket scores update during active knockout rounds

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/bracket`;


// Rounds in display order for the list view and JSON-LD.
// slug → per-round landing page (GROWTH-2A): /world-cup-2026/{slug}
const ROUND_ORDER = [
  { stage: 'LAST_32',       label: 'Round of 32',    short: 'R32', slug: 'round-of-32'    },
  { stage: 'LAST_16',       label: 'Round of 16',    short: 'R16', slug: 'round-of-16'    },
  { stage: 'QUARTER_FINALS',label: 'Quarter-finals', short: 'QF',  slug: 'quarter-finals' },
  { stage: 'SEMI_FINALS',   label: 'Semi-finals',    short: 'SF',  slug: 'semi-finals'    },
  { stage: 'THIRD_PLACE',   label: 'Third Place',    short: '3rd', slug: 'third-place'    },
  { stage: 'FINAL',         label: 'Final',          short: 'F',   slug: 'final'          },
] as const;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Knockout Bracket – Round of 32 to Final | GoalRadar',
  description:
    'Follow the FIFA World Cup 2026 complete knockout bracket. View all matches from the Round of 32 through Quarter-finals, Semi-finals, Third Place and the Final.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Knockout Bracket | GoalRadar',
    description:
      'Complete knockout bracket for FIFA World Cup 2026 — Round of 32, Round of 16, Quarter-finals, Semi-finals, Third Place and Final.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 Knockout Bracket | GoalRadar',
    description: 'Full World Cup 2026 knockout bracket — all rounds from R32 to the Final.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ knockoutMatches }: { knockoutMatches: Match[] }) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Knockout Bracket', item: PAGE_URL },
    ],
  };

  const matchEvents = knockoutMatches.map((m) => ({
    '@type': 'SportsEvent',
    name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
    sport: 'Football',
    startDate: m.utcDate,
    url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
    description: `${ROUND_ORDER.find((r) => r.stage === m.stage)?.label ?? m.stage} — FIFA World Cup 2026`,
    location: {
      '@type': 'Place',
      name: 'FIFA World Cup 2026 Venue',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    superEvent: {
      '@type': 'SportsEvent',
      name: 'FIFA World Cup 2026',
      url: `${BASE_URL}/world-cup-2026`,
    },
  }));

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'FIFA World Cup 2026 Knockout Bracket',
    description:
      'Complete knockout bracket for FIFA World Cup 2026, from the Round of 32 to the Final.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: matchEvents,
  };

  const sortedDates = knockoutMatches.map((m) => m.utcDate).sort();
  const knockoutEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026 Knockout Stage',
    sport: 'Football',
    startDate: sortedDates[0]  ?? '2026-06-28',
    endDate: sortedDates[sortedDates.length - 1] ?? '2026-07-19',
    url: PAGE_URL,
    location: {
      '@type': 'Place',
      name: 'United States, Canada & Mexico',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    organizer: { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' },
    superEvent: {
      '@type': 'SportsEvent',
      name: 'FIFA World Cup 2026',
      url: `${BASE_URL}/world-cup-2026`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(knockoutEvent) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {children}
    </h2>
  );
}

function EmptyRound({ label }: { label: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-6 text-center text-gray-500 text-sm">
      {label} fixtures will appear once teams qualify from the previous round.
    </div>
  );
}

/** Pre-tournament schedule for a knockout round — shown when API is unavailable. */
function LocalKnockoutRound({ slots }: { slots: WCKnockoutSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div className="divide-y divide-gray-800/50 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {slots.map((s) => (
        <div key={s.localId} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm text-gray-300 font-medium truncate">{s.homeLabel}</span>
          </div>
          <div className="mx-4 text-center shrink-0">
            <span className="text-gray-500 text-xs">
              {new Date(s.utcDate).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
              })} UTC
            </span>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-sm text-gray-300 font-medium truncate text-right">{s.awayLabel}</span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2 text-xs text-gray-500">
        Scheduled fixtures — teams TBD after group stage qualifies
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Third Place match card — distinct bronze styling
// ---------------------------------------------------------------------------

function ThirdPlaceCard({ match }: { match: Match }) {
  const d      = deriveMatchDisplay(match);
  const { showScore, winner } = d;
  const isLive = d.showLiveBadge;
  const hn     = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an     = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const hWins  = winner === 'home';
  const aWins  = winner === 'away';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)} prefetch={true}
      className="block bg-gradient-to-br from-amber-950/40 to-gray-900 border border-amber-700/30 rounded-2xl p-5 hover:border-amber-600/50 transition-[border-color,background-color,box-shadow] duration-150"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg" aria-hidden="true">🥉</span>
        <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">
          Third Place Play-off
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-red-400 text-xs font-bold">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            LIVE
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <div className="text-center">
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" width={40} height={40} className="object-contain mx-auto mb-2" />
          )}
          <p className={`text-sm font-bold ${hWins ? 'text-white' : 'text-gray-300'}`}>{hn}</p>
        </div>
        <div className="text-center">
          {showScore ? (
            <span className="text-2xl font-black text-white tabular-nums">
              {d.homeScore ?? '–'}–{d.awayScore ?? '–'}
            </span>
          ) : (
            <div>
              <span className="text-gray-500 font-bold text-lg">vs</span>
              <p className="text-gray-500 text-xs mt-1">{formatKickoff(match.utcDate)}</p>
            </div>
          )}
          {d.badgeStyle === 'finished' && <p className="text-gray-500 text-xs mt-1">FT</p>}
        </div>
        <div className="text-center">
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" width={40} height={40} className="object-contain mx-auto mb-2" />
          )}
          <p className={`text-sm font-bold ${aWins ? 'text-white' : 'text-gray-300'}`}>{an}</p>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Final match card — distinct gold styling
// ---------------------------------------------------------------------------

function FinalCard({ match }: { match: Match }) {
  const d      = deriveMatchDisplay(match);
  const { showScore, winner } = d;
  const isLive = d.showLiveBadge;
  const hn     = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an     = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const hWins  = winner === 'home';
  const aWins  = winner === 'away';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)} prefetch={true}
      className="block bg-gradient-to-br from-yellow-950/60 via-gray-900 to-gray-900 border border-yellow-600/40 rounded-2xl p-6 hover:border-yellow-500/60 transition-[border-color,background-color,box-shadow] duration-150"
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl" aria-hidden="true">🏆</span>
        <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">
          The Final
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-red-400 text-xs font-bold">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            LIVE
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-center gap-6">
        <div className="text-center">
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" width={56} height={56} className="object-contain mx-auto mb-3" />
          )}
          <p className={`text-sm font-bold leading-tight ${hWins ? 'text-yellow-400' : 'text-gray-200'}`}>{hn}</p>
          {hWins && <p className="text-yellow-400 text-xs mt-1 font-semibold" aria-hidden="true">🥇 Champions</p>}
        </div>
        <div className="text-center">
          {showScore ? (
            <div className="text-3xl font-black text-white tabular-nums">
              {d.homeScore ?? '–'}
              <span className="text-gray-600 mx-1">–</span>
              {d.awayScore ?? '–'}
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-gray-500">vs</div>
              <p className="text-gray-500 text-xs mt-1">{formatKickoff(match.utcDate)}</p>
            </div>
          )}
          {d.badgeStyle === 'finished' && <p className="text-gray-500 text-xs mt-1">FULL TIME</p>}
        </div>
        <div className="text-center">
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" width={56} height={56} className="object-contain mx-auto mb-3" />
          )}
          <p className={`text-sm font-bold leading-tight ${aWins ? 'text-yellow-400' : 'text-gray-200'}`}>{an}</p>
          {aWins && <p className="text-yellow-400 text-xs mt-1 font-semibold" aria-hidden="true">🥇 Champions</p>}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — shown while BracketContent awaits buildKnockoutViewModel
// ---------------------------------------------------------------------------

function BracketSkeleton() {
  return (
    <div className="space-y-10">
      {/* Round pills skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-14 bg-gray-800 rounded-full animate-pulse shrink-0" />
        ))}
      </div>
      {/* R32 section skeleton */}
      <div>
        <div className="h-4 w-24 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </div>
      {/* Visual bracket skeleton */}
      <div>
        <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-48 animate-pulse" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async content — all vm-dependent sections
// ---------------------------------------------------------------------------

async function BracketContent() {
  const vm = await buildKnockoutViewModel();

  const { r32: r32Matches, thirdPlace: thirdMatches, final: finalMatches, bracketMatches } = vm;

  const useLocalSlots = !vm.hasApiData;
  const localSlots = (round: WCKnockoutSlot['round']) =>
    useLocalSlots ? WC_KNOCKOUT_SLOTS.filter((s) => s.round === round) : [];

  const roundSummary = ROUND_ORDER.map((r) => {
    const ms = vm.byStage(r.stage);
    const played = ms.filter((m) => m.status === 'FINISHED').length;
    return { ...r, total: ms.length, played };
  });

  return (
    <>
      <JsonLd knockoutMatches={vm.matches} />

      {/* ── Round progress pills — link to per-round pages (GROWTH-2A) ── */}
      <nav aria-label="Knockout rounds" className="flex flex-wrap gap-2">
        {roundSummary.map((r) => {
          const complete = r.total > 0 && r.played === r.total;
          const started  = r.played > 0;
          return (
            <Link
              key={r.stage}
              href={`/world-cup-2026/${r.slug}`}
              title={`World Cup 2026 ${r.label} — fixtures & results`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:border-yellow-500/50 ${
                complete
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : started
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-gray-800 text-gray-500 border-gray-700'
              }`}
            >
              {r.short}
              {r.total > 0 && (
                <span className="ml-1 opacity-70">{r.played}/{r.total}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Round of 32 ────────────────────────────────────────────── */}
      <section aria-labelledby="r32-heading">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 id="r32-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            <Link href="/world-cup-2026/round-of-32" className="hover:text-yellow-400 transition-colors">
              Round of 32 →
            </Link>
          </h2>
          <span className="text-gray-500 text-xs">16 matches · 2–9 July 2026</span>
        </div>
        {r32Matches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {r32Matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        ) : localSlots('LAST_32').length > 0 ? (
          <LocalKnockoutRound slots={localSlots('LAST_32')} />
        ) : (
          <EmptyRound label="Round of 32" />
        )}
      </section>

      {/* Ad: between R32 and visual bracket */}
      <AdSlot slotId="bracket-mid" variant="banner" />

      {/* ── Visual bracket: R16 → Final ────────────────────────────── */}
      <section aria-labelledby="bracket-heading">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 id="bracket-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Round of 16 → Final
          </h2>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
          <WCBracket matches={bracketMatches} />
          <p className="text-xs text-gray-500 mt-4 text-center">
            Each card links to the full match detail page · Scroll horizontally on small screens
          </p>
        </div>
      </section>

      {/* ── Round of 16 → QF → SF — local schedule when API down ─────── */}
      {useLocalSlots && (
        <>
          {(['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'] as const).map((round) => {
            const sl = localSlots(round);
            if (!sl.length) return null;
            const label = sl[0].roundLabel;
            return (
              <section key={round} aria-labelledby={`${round}-heading`}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 id={`${round}-heading`} className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    {label}
                  </h2>
                  <span className="text-gray-500 text-xs">{sl[0].utcDate.slice(0,10)} →</span>
                </div>
                <LocalKnockoutRound slots={sl} />
              </section>
            );
          })}
        </>
      )}

      {/* ── Third Place ─────────────────────────────────────────────── */}
      <section aria-labelledby="third-heading">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 id="third-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Third Place Play-off
          </h2>
          <span className="text-gray-500 text-xs">25 July 2026 · MetLife Stadium</span>
        </div>
        {thirdMatches.length > 0 ? (
          <ThirdPlaceCard match={thirdMatches[0]} />
        ) : localSlots('THIRD_PLACE').length > 0 ? (
          <LocalKnockoutRound slots={localSlots('THIRD_PLACE')} />
        ) : (
          <EmptyRound label="Third Place Play-off" />
        )}
      </section>

      {/* ── The Final ───────────────────────────────────────────────── */}
      <section aria-labelledby="final-heading">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 id="final-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            The Final
          </h2>
          <span className="text-gray-500 text-xs">26 July 2026 · MetLife Stadium</span>
        </div>
        {finalMatches.length > 0 ? (
          <FinalCard match={finalMatches[0]} />
        ) : localSlots('FINAL').length > 0 ? (
          <div className="bg-gradient-to-br from-yellow-950/60 via-gray-900 to-gray-900 border border-yellow-600/40 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl" aria-hidden="true">🏆</span>
              <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">The Final</span>
            </div>
            {localSlots('FINAL').map((s) => (
              <div key={s.localId} className="text-center text-gray-300 text-sm">
                <p className="font-semibold text-white mb-1">{s.homeLabel} vs {s.awayLabel}</p>
                <p className="text-xs text-gray-500">
                  {new Date(s.utcDate).toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
                  })} UTC · MetLife Stadium
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyRound label="Final" />
        )}
      </section>

      {/* ── All knockout matches by round ───────────────────────────── */}
      <section aria-labelledby="all-matches-heading">
        <SectionHeading>All Knockout Matches</SectionHeading>
        <div className="space-y-6" id="all-matches-heading">
          {ROUND_ORDER.map((round) => {
            const matches = vm.byStage(round.stage);
            if (matches.length === 0) return null;
            return (
              <div key={round.stage}>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  {round.label}
                  <span className="text-gray-500 text-xs font-normal">
                    {matches.filter((m) => m.status === 'FINISHED').length}/{matches.length} played
                  </span>
                </h3>
                <div className="divide-y divide-gray-800/50 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {matches.map((m) => {
                    const hn = m.homeTeam?.shortName || m.homeTeam?.name || 'TBD';
                    const an = m.awayTeam?.shortName || m.awayTeam?.name || 'TBD';
                    const md      = deriveMatchDisplay(m);
                    const isLive  = md.showLiveBadge;
                    return (
                      <Link
                        key={m.id}
                        href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)} prefetch={true}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {m.homeTeam?.crest && (
                            <img src={m.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
                          )}
                          <span className={`text-sm font-medium truncate ${md.winner === 'home' ? 'text-white' : 'text-gray-300'}`}>
                            {hn}
                          </span>
                        </div>

                        <div className="mx-4 text-center shrink-0">
                          {isLive ? (
                            <span className="text-red-400 text-xs font-bold">LIVE</span>
                          ) : md.showScore ? (
                            <span className="text-white font-black tabular-nums text-sm">
                              {md.homeScore ?? '–'}–{md.awayScore ?? '–'}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">{formatKickoff(m.utcDate)}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                          <span className={`text-sm font-medium truncate text-right ${md.winner === 'away' ? 'text-white' : 'text-gray-300'}`}>
                            {an}
                          </span>
                          {m.awayTeam?.crest && (
                            <img src={m.awayTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ad: page bottom */}
      <AdSlot slotId="bracket-bottom" variant="banner" />

      <WCRelatedLinks links={[
        { href: '/world-cup-2026-bracket',    icon: '🔗', label: 'Knockout Round Guide', desc: 'Round narrative guide with key dates' },
        { href: '/world-cup-2026-results',    icon: '🏁', label: 'WC 2026 Results',     desc: 'Live and full-time scores for every match' },
        { href: '/world-cup-2026-standings',  icon: '📊', label: 'Group Standings',     desc: 'Live tables for all 12 groups' },
        { href: '/world-cup-2026-schedule',   icon: '📅', label: 'Match Schedule',      desc: 'All 104 fixtures with kickoff times' },
        { href: '/world-cup-2026-groups',     icon: '🗂️', label: 'Group Stage Guide',   desc: 'All 12 draws and qualification rules' },
        { href: '/world-cup-2026-live-stream',icon: '📡', label: 'Watch Live',          desc: 'Stream every match free or cheaply online' },
      ]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCBracketPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      <Breadcrumb
        items={[
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Bracket' },
        ]}
      />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl" aria-hidden="true">🏆</span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Knockout Bracket
            </h1>
          </div>
          <p className="text-gray-500 text-sm">
            FIFA World Cup 2026 · 32 matches · 6 rounds
          </p>
        </div>
        <Link
          href="/world-cup-2026"
          className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0"
        >
          ← World Cup Hub
        </Link>
      </div>

      {/* Cross-page navigation */}
      <WCPageNav />

      {/* C4: Suspense — skeleton while buildKnockoutViewModel() resolves */}
      <Suspense fallback={<BracketSkeleton />}>
        <BracketContent />
      </Suspense>
    </div>
  );
}
