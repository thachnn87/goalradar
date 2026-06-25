import Link from 'next/link';
import type { Metadata } from 'next';

// PERF-4.5
import { getWCKnockoutMatchesCached, getWCAuthorityMatchesV2 } from '@/lib/api';
import { matchPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import type { Match, MatchStatus } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import WCBracket from '@/components/WCBracket';
import { WC_KNOCKOUT_SLOTS, type WCKnockoutSlot } from '@/lib/wc-fixtures';

// DATA-18B.1: Authority cache pilot feature flag.
// Set AUTHORITY_CACHE_PILOT=true in Vercel env vars to activate.
// Remove or set to any other value to revert to getWCKnockoutMatchesCached().
const PILOT_ENABLED = process.env.AUTHORITY_CACHE_PILOT === 'true';

/** Maps CanonicalMatch (authority cache type) to Match (bracket render type). */
function canonicalToMatch(m: CanonicalMatch): Match {
  const statusMap: Record<CanonicalMatch['state'], MatchStatus> = {
    live:      'IN_PLAY',
    finished:  'FINISHED',
    scheduled: 'SCHEDULED',
    cancelled: 'POSTPONED',
  };
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: statusMap[m.state],
    matchday: m.matchday,
    stage: m.stage,
    group: m.group,
    lastUpdated: m.lastUpdated,
    competition: { id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '', area: { id: 2267, name: 'World', code: 'WLD', flag: null } },
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: m.score,
    minute: m.minute ?? null,
  };
}

export const revalidate = 900; // 15 min — bracket scores update during active knockout rounds

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/bracket`;

// Stages that belong to the knockout phase
const KNOCKOUT_STAGES = new Set([
  'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL',
]);

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
    <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-6 text-center text-gray-600 text-sm">
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
      <div className="px-4 py-2 text-[10px] text-gray-700">
        ℹ️ Scheduled fixtures — teams TBD after group stage qualifies
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Third Place match card — distinct gold/bronze styling
// ---------------------------------------------------------------------------

function ThirdPlaceCard({ match }: { match: Match }) {
  const { score, status } = match;
  const showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);
  const isLive = status === 'IN_PLAY' || status === 'PAUSED';
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const hWins = score.winner === 'HOME_TEAM';
  const aWins = score.winner === 'AWAY_TEAM';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)} prefetch={true}
      className="block bg-gradient-to-br from-amber-950/40 to-gray-900 border border-amber-700/30 rounded-2xl p-5 hover:border-amber-600/50 transition-all"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🥉</span>
        <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">
          Third Place Play-off
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-red-400 text-xs font-bold">
            <span className="relative flex h-2 w-2">
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
              {score.fullTime.home ?? 0}–{score.fullTime.away ?? 0}
            </span>
          ) : (
            <div>
              <span className="text-gray-600 font-bold text-lg">vs</span>
              <p className="text-gray-600 text-xs mt-1">{formatKickoff(match.utcDate)}</p>
            </div>
          )}
          {status === 'FINISHED' && <p className="text-gray-500 text-xs mt-1">FT</p>}
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
  const { score, status } = match;
  const showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);
  const isLive = status === 'IN_PLAY' || status === 'PAUSED';
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const hWins = score.winner === 'HOME_TEAM';
  const aWins = score.winner === 'AWAY_TEAM';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)} prefetch={true}
      className="block bg-gradient-to-br from-yellow-950/60 via-gray-900 to-gray-900 border border-yellow-600/40 rounded-2xl p-6 hover:border-yellow-500/60 transition-all"
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">🏆</span>
        <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">
          The Final
        </span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-red-400 text-xs font-bold">
            <span className="relative flex h-2 w-2">
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
          {hWins && <p className="text-yellow-400 text-xs mt-1 font-semibold">🥇 Champions</p>}
        </div>
        <div className="text-center">
          {showScore ? (
            <div className="text-3xl font-black text-white tabular-nums">
              {score.fullTime.home ?? 0}
              <span className="text-gray-600 mx-1">–</span>
              {score.fullTime.away ?? 0}
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-gray-600">vs</div>
              <p className="text-gray-600 text-xs mt-1">{formatKickoff(match.utcDate)}</p>
            </div>
          )}
          {status === 'FINISHED' && <p className="text-gray-500 text-xs mt-1">FULL TIME</p>}
        </div>
        <div className="text-center">
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" width={56} height={56} className="object-contain mx-auto mb-3" />
          )}
          <p className={`text-sm font-bold leading-tight ${aWins ? 'text-yellow-400' : 'text-gray-200'}`}>{an}</p>
          {aWins && <p className="text-yellow-400 text-xs mt-1 font-semibold">🥇 Champions</p>}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCBracketPage() {
  // DATA-18B.1: pilot gate — authority cache path when AUTHORITY_CACHE_PILOT=true
  let allWCMatches: Match[] = [];
  try {
    if (PILOT_ENABLED) {
      const builtAt = new Date().toISOString();
      const data = await getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026/bracket', sourceType: 'page' });
      allWCMatches = data.matches.map(canonicalToMatch);
    } else {
      const data = await getWCKnockoutMatchesCached();
      allWCMatches = data.matches;
    }
  } catch {
    // graceful degradation — fall back to local slot schedule below
  }

  const knockoutMatches = allWCMatches
    .filter((m) => KNOCKOUT_STAGES.has(m.stage))
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  // When API is unavailable, use local pre-tournament knockout slots
  const useLocalSlots = knockoutMatches.length === 0;
  const localSlots = (round: WCKnockoutSlot['round']) =>
    useLocalSlots ? WC_KNOCKOUT_SLOTS.filter((s) => s.round === round) : [];

  // Group by stage
  const byStage = (stage: string) =>
    knockoutMatches.filter((m) => m.stage === stage);

  const r32Matches    = byStage('LAST_32');
  const r16Matches    = byStage('LAST_16');
  const thirdMatches  = byStage('THIRD_PLACE');
  const finalMatches  = byStage('FINAL');

  // Matches that feed into WCBracket (R16 → Final)
  const bracketMatches = knockoutMatches.filter((m) =>
    ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'].includes(m.stage)
  );

  // Round progress summary
  const roundSummary = ROUND_ORDER.map((r) => {
    const ms = byStage(r.stage);
    const played = ms.filter((m) => m.status === 'FINISHED').length;
    return { ...r, total: ms.length, played };
  });

  return (
    <>
      <JsonLd knockoutMatches={knockoutMatches} />

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
              <span className="text-3xl">🏆</span>
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
            <span className="text-gray-700 text-xs">16 matches · 2–9 July 2026</span>
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
            <p className="text-xs text-gray-700 mt-4 text-center">
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
                    <span className="text-gray-700 text-xs">{sl[0].utcDate.slice(0,10)} →</span>
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
            <span className="text-gray-700 text-xs">25 July 2026 · MetLife Stadium</span>
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
            <span className="text-gray-700 text-xs">26 July 2026 · MetLife Stadium</span>
          </div>
          {finalMatches.length > 0 ? (
            <FinalCard match={finalMatches[0]} />
          ) : localSlots('FINAL').length > 0 ? (
            <div className="bg-gradient-to-br from-yellow-950/60 via-gray-900 to-gray-900 border border-yellow-600/40 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏆</span>
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
          <h2 id="all-matches-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            All Knockout Matches
          </h2>
          <div className="space-y-6">
            {ROUND_ORDER.map((round) => {
              const matches = byStage(round.stage);
              if (matches.length === 0) return null;
              return (
                <div key={round.stage}>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    {round.label}
                    <span className="text-gray-600 text-xs font-normal">
                      {matches.filter((m) => m.status === 'FINISHED').length}/{matches.length} played
                    </span>
                  </h3>
                  <div className="divide-y divide-gray-800/50 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    {matches.map((m) => {
                      const hn = m.homeTeam?.shortName || m.homeTeam?.name || 'TBD';
                      const an = m.awayTeam?.shortName || m.awayTeam?.name || 'TBD';
                      const { score, status } = m;
                      const showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);
                      const isLive = status === 'IN_PLAY' || status === 'PAUSED';
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
                            <span className={`text-sm font-medium truncate ${score.winner === 'HOME_TEAM' ? 'text-white' : 'text-gray-300'}`}>
                              {hn}
                            </span>
                          </div>

                          <div className="mx-4 text-center shrink-0">
                            {isLive ? (
                              <span className="text-red-400 text-xs font-bold">LIVE</span>
                            ) : showScore ? (
                              <span className="text-white font-black tabular-nums text-sm">
                                {score.fullTime.home ?? 0}–{score.fullTime.away ?? 0}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs">{formatKickoff(m.utcDate)}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                            <span className={`text-sm font-medium truncate text-right ${score.winner === 'AWAY_TEAM' ? 'text-white' : 'text-gray-300'}`}>
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
      </div>
    </>
  );
}
