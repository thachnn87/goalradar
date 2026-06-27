/**
 * WCRoundPage — shared server component for the six knockout round landing
 * pages (GROWTH-2A Feature 1):
 *
 *   /world-cup-2026/round-of-32   /world-cup-2026/semi-finals
 *   /world-cup-2026/round-of-16   /world-cup-2026/third-place
 *   /world-cup-2026/quarter-finals /world-cup-2026/final
 *
 * Data: buildKnockoutViewModel() — L1 → readKVOnly → static fallback.
 * ZERO provider calls (PERF-7A invariant). Before fixtures exist in the API,
 * the bundled WC_KNOCKOUT_SLOTS schedule renders so the page is never thin.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import {
  WC_ROUNDS,
  getRoundBySlug,
  getRoundSlots,
  getRoundDateRange,
  getRoundIsoRange,
  type WCRoundConfig,
} from '@/lib/wc-rounds';
import { type WCKnockoutSlot } from '@/lib/wc-fixtures';
import { buildKnockoutViewModel } from '@/lib/knockout-vm';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard, { MatchCardSkeleton } from '@/components/MatchCard';
import AdSlot from '@/components/AdSlot';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import StoryCardStrip from '@/components/StoryCardStrip';
import { buildRoundStoryCards } from '@/lib/match-story-engine';

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Metadata builder — used by each round's page.tsx
// ---------------------------------------------------------------------------

export function buildRoundMetadata(slug: string): Metadata {
  const round = getRoundBySlug(slug);
  if (!round) return { title: 'World Cup 2026 | GoalRadar' };

  const dateRange = getRoundDateRange(round.stage);
  const title =
    round.stage === 'FINAL'
      ? `FIFA World Cup 2026 Final — Date, Teams & Venue | GoalRadar`
      : `World Cup 2026 ${round.label} — Fixtures, Results & Dates | GoalRadar`;
  const description =
    `FIFA World Cup 2026 ${round.label} (${dateRange}): fixtures, kick-off times, ` +
    `results and match details. ${round.blurb}`;
  const url = `${BASE_URL}/world-cup-2026/${round.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph:  { title, description, type: 'website', url },
    twitter:    { card: 'summary_large_image', title, description },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ round, matches }: { round: WCRoundConfig; matches: Match[] }) {
  const url = `${BASE_URL}/world-cup-2026/${round.slug}`;
  const iso = getRoundIsoRange(round.stage);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: round.label,      item: url },
    ],
  };

  const roundEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `FIFA World Cup 2026 ${round.label}`,
    sport: 'Football',
    startDate: iso.start,
    endDate:   iso.end,
    url,
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
    ...(matches.length > 0 && {
      subEvent: matches.map((m) => ({
        '@type': 'SportsEvent',
        name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
        sport: 'Football',
        startDate: m.utcDate,
        url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
      })),
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(roundEvent) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Pre-tournament schedule fallback (teams TBD)
// ---------------------------------------------------------------------------

function ScheduleSlots({ slots }: { slots: WCKnockoutSlot[] }) {
  return (
    <div className="divide-y divide-gray-800/50 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {slots.map((s) => (
        <div key={s.localId} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-300 font-medium truncate flex-1">{s.homeLabel}</span>
          <div className="mx-4 text-center shrink-0">
            <span className="text-gray-500 text-xs">
              {new Date(s.utcDate).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
              })} UTC
            </span>
            <p className="text-gray-500 text-xs">{s.venueCity}</p>
          </div>
          <span className="text-sm text-gray-300 font-medium truncate flex-1 text-right">{s.awayLabel}</span>
        </div>
      ))}
      <div className="px-4 py-2 text-xs text-gray-500">
        Scheduled fixtures — teams confirmed once the previous round completes
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — shown while RoundContent awaits buildKnockoutViewModel
// ---------------------------------------------------------------------------

function RoundContentSkeleton() {
  return (
    <div className="space-y-8">
      {/* Round nav pills skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-800 rounded-lg animate-pulse shrink-0" />
        ))}
      </div>
      {/* Blurb skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-800 rounded animate-pulse" />
      </div>
      {/* Match grid skeleton */}
      <div>
        <div className="h-4 w-36 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async content — all vm-dependent sections
// ---------------------------------------------------------------------------

async function RoundContent({ slug }: { slug: string }) {
  const round = getRoundBySlug(slug)!;
  const vm = await buildKnockoutViewModel();
  const matches = vm.byStage(round.stage);
  const slots   = matches.length === 0 ? getRoundSlots(round.stage) : [];
  const played    = matches.filter((m) => m.status === 'FINISHED').length;

  const idx       = WC_ROUNDS.findIndex((r) => r.slug === round.slug);
  const prevRound = idx > 0 ? WC_ROUNDS[idx - 1] : null;
  const nextRound = idx < WC_ROUNDS.length - 1 ? WC_ROUNDS[idx + 1] : null;

  return (
    <>
      <JsonLd round={round} matches={matches} />

      {/* Round navigation pills */}
      <nav aria-label="Knockout rounds" className="flex flex-wrap gap-2">
        {WC_ROUNDS.map((r) => (
          <Link
            key={r.slug}
            href={`/world-cup-2026/${r.slug}`}
            aria-current={r.slug === round.slug ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${
              r.slug === round.slug
                ? 'bg-yellow-500 text-black border-yellow-400'
                : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border-gray-700'
            }`}
          >
            {r.icon} {r.label}
          </Link>
        ))}
      </nav>

      <AdSlot slotId={`round-${round.slug}-top`} variant="banner" />

      {/* Story cards — winner advances / eliminated / penalty drama */}
      {(() => {
        const cards = buildRoundStoryCards(matches, round.stage);
        return cards.length > 0 ? <StoryCardStrip cards={cards} /> : null;
      })()}

      {/* Intro */}
      <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">{round.blurb}</p>

      {/* Fixtures / results */}
      <section aria-labelledby="round-matches-heading">
        <h2
          id="round-matches-heading"
          className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4"
        >
          {round.label} Fixtures &amp; Results
          {matches.length > 0 && (
            <span className="ml-2 text-gray-600 font-normal normal-case tracking-normal">
              {played}/{matches.length} played
            </span>
          )}
        </h2>
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        ) : (
          <ScheduleSlots slots={slots} />
        )}
      </section>

      {/* Prev / next round */}
      <div className="flex justify-between text-sm">
        {prevRound ? (
          <Link href={`/world-cup-2026/${prevRound.slug}`} className="text-yellow-500 hover:text-yellow-300 transition-colors font-medium">
            ← {prevRound.label}
          </Link>
        ) : <span />}
        {nextRound ? (
          <Link href={`/world-cup-2026/${nextRound.slug}`} className="text-yellow-500 hover:text-yellow-300 transition-colors font-medium">
            {nextRound.label} →
          </Link>
        ) : <span />}
      </div>

      <AdSlot slotId={`round-${round.slug}-bottom`} variant="banner" />

      <WCRelatedLinks links={[
        { href: '/world-cup-2026/bracket',    icon: '🔗', label: 'Knockout Bracket',  desc: 'Full visual bracket from Round of 32 to the Final' },
        { href: '/world-cup-2026-schedule',   icon: '📅', label: 'WC 2026 Schedule',  desc: 'All 104 fixtures with kickoff times' },
        { href: '/world-cup-2026-results',    icon: '🏁', label: 'WC 2026 Results',   desc: 'Latest scores and completed matches' },
        { href: '/world-cup-2026-standings',  icon: '📊', label: 'Group Standings',   desc: 'Final group tables that seeded the knockouts' },
        { href: '/world-cup-2026-predictions',icon: '🔮', label: 'Predictions',       desc: 'Data-driven picks for every knockout tie' },
        { href: '/world-cup-2026-tv-guide',   icon: '📺', label: 'TV Channel Guide',  desc: `What channel is the ${round.label} on?` },
      ]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page shell — renders immediately; RoundContent suspends for the API call
// ---------------------------------------------------------------------------

export default function WCRoundPage({ slug }: { slug: string }) {
  const round = getRoundBySlug(slug)!;
  const dateRange = getRoundDateRange(round.stage);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <Breadcrumb
        items={[
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: round.label },
        ]}
      />

      {/* Hero — uses round config only, no await needed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl" aria-hidden="true">{round.icon}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              World Cup 2026 {round.label}
            </h1>
          </div>
          <p className="text-gray-500 text-sm">
            {dateRange} · {round.matchCount} match{round.matchCount !== 1 ? 'es' : ''}
          </p>
        </div>
        <Link
          href="/world-cup-2026/bracket"
          className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0"
        >
          Full bracket →
        </Link>
      </div>

      {/* Cross-page navigation */}
      <WCPageNav />

      {/* C7: Suspense — skeleton while RoundContent awaits buildKnockoutViewModel */}
      <Suspense fallback={<RoundContentSkeleton />}>
        <RoundContent slug={slug} />
      </Suspense>
    </div>
  );
}
