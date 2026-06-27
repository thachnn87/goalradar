import Link from 'next/link';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import LocalTime from '@/components/LocalTime';
import AddToCalendar from '@/components/AddToCalendar';

import { NotFoundError } from '@/lib/api';
import { getOrBuildMatchSnapshot, getGroupTable, type MatchSnapshot } from '@/lib/match-snapshot';
import { getDataSourceStats } from '@/lib/data-source-tracker';
import { recordMatchRender } from '@/lib/match-perf-tracker';
import MatchNavTelemetry from '@/components/MatchNavTelemetry';
import CountryChips from '@/components/CountryChips';
import type { MatchRenderSource } from '@/lib/match-perf-tracker';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import WCGroupTable from '@/components/WCGroupTable';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard from '@/components/MatchCard';
import type { BreadcrumbItem } from '@/components/Breadcrumb';
import { matchPath, extractMatchId, teamPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import AffiliateBlock from '@/components/AffiliateBlock';
import MatchLiveZone from '@/components/MatchLiveZone';
import NewsletterSignup from '@/components/NewsletterSignup';
import PushNotificationButton from '@/components/PushNotificationButton';
import { WC_TEAMS } from '@/lib/wc-teams';
import type {
  Goal,
  Booking,
  Substitution,
  MatchDetail,
  HeadToHead,
  Match,
} from '@/lib/types';
import { buildStoryContext, buildStoryReport, buildStoryCards, type ReportSection } from '@/lib/match-story-engine';
import { deriveMatchPageState, type MatchPageState } from '@/lib/match-page-state';
import { deriveRuntimeState, versionFromTimestamp, type EffectiveScore } from '@/lib/match-runtime-state';
import StoryCardStrip from '@/components/StoryCardStrip';
import MatchTimeline from '@/components/MatchTimeline';
import RoadToFinal from '@/components/RoadToFinal';

export const revalidate = 60;

// The [id] segment accepts both legacy numeric IDs ("537327") and slug URLs
// ("537327-mexico-vs-south-africa"). We always extract the numeric portion.
type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: slug } = await params;
  const numericId = extractMatchId(slug);
  if (!numericId) return { title: 'Match Details | GoalRadar' };

  try {
    // PERF-4 Phase 7: use snapshot instead of a bare getMatchDetail() call.
    //
    // Benefits:
    //   • React.cache() deduplicates this call with the Suspense deferred
    //     components (HeadToHeadDeferred, WCGroupSectionDeferred) — 0 extra work.
    //   • Snapshot has tier-aware TTL (6 h upcoming, 7 d finished) vs
    //     SWR.MATCH (60 s / 120 s) — far fewer bg-revalidation provider calls.
    //   • Prewarm seeds goalradar:match:{id} → snapshot KV hit on first user.
    //   • Provider is NEVER called from this path on a warm cache.
    const snapshot = await getOrBuildMatchSnapshot(numericId);
    const { match, effectiveScore: es } = deriveRuntimeState(snapshot);
    const home  = match.homeTeam.name ?? 'TBD';
    const away  = match.awayTeam.name ?? 'TBD';
    const comp  = match.competition?.name ?? 'Football';
    const isWC  = match.competition?.code === 'WC';
    const compSuffix = isWC ? 'FIFA World Cup 2026' : comp;

    const isFinished  = match.status === 'FINISHED';
    const isCancelled = match.status === 'CANCELLED' || match.status === 'SUSPENDED';
    const isLive      = match.status === 'IN_PLAY' || match.status === 'PAUSED';
    const ftH = es?.home ?? null;
    const ftA = es?.away ?? null;
    const hasScore = isFinished && !isCancelled && ftH != null && ftA != null;

    // Build a rich, status-aware title
    let title: string;
    if (isCancelled) {
      title = isWC
        ? `${home} vs ${away} – Cancelled | FIFA World Cup 2026 | GoalRadar`
        : `${home} vs ${away} – Cancelled | ${comp} | GoalRadar`;
    } else if (hasScore) {
      // e.g. "Arsenal 2-1 Chelsea – Match Result | Premier League | GoalRadar"
      title = `${home} ${ftH}–${ftA} ${away} – Match Result | ${compSuffix} | GoalRadar`;
    } else if (isLive) {
      title = isWC
        ? `${home} vs ${away} LIVE Score | FIFA World Cup 2026`
        : `${home} vs ${away} LIVE Score | ${comp} | GoalRadar`;
    } else {
      // Upcoming — include matchday for context
      const md = match.matchday ? ` Matchday ${match.matchday}` : '';
      title = isWC
        ? `${home} vs ${away} Preview | FIFA World Cup 2026${md}`
        : `${home} vs ${away} Preview | ${comp}${md} | GoalRadar`;
    }

    // Build a rich description
    let description: string;
    if (isCancelled) {
      description = `${home} vs ${away} was cancelled. See full ${compSuffix} fixtures, results and standings on GoalRadar.`;
    } else if (hasScore) {
      const winner =
        match.score.winner === 'HOME_TEAM' ? `${home} won` :
        match.score.winner === 'AWAY_TEAM' ? `${away} won` :
        'The match ended in a draw';
      const goals = (match.goals ?? [])
        .sort((a, b) => a.minute - b.minute)
        .map((g) => `${g.scorer?.name} ${g.minute}'`)
        .join(', ');
      description = `Final score: ${home} ${ftH}–${ftA} ${away}. ${winner}. ${goals ? `Goals: ${goals}. ` : ''}Full match report, stats and head-to-head on GoalRadar.`;
    } else if (isLive) {
      description = isWC
        ? `${home} vs ${away} is LIVE now. Follow the World Cup 2026 score, goals and match events in real time.`
        : `${home} vs ${away} is LIVE. Follow the score, goals and match events in real time on GoalRadar.`;
    } else {
      const matchDate = new Date(match.utcDate).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      });
      const matchTime = new Date(match.utcDate).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      });
      const venue = match.venue ? ` at ${match.venue}` : '';
      description = `${home} vs ${away} — ${matchDate} at ${matchTime} UTC${venue}. Match preview, head-to-head stats and live score on GoalRadar.`;
    }

    const BASE_URL = 'https://goalradar.org';
    const canonical = `${BASE_URL}${matchPath(match.id, home, away)}`;

    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        type: 'website',
        url: canonical,
        ...(isWC && { siteName: 'GoalRadar — FIFA World Cup 2026' }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(isWC && { site: '@GoalRadar' }),
      },
    };
  } catch {
    return {
      title: 'Match Details | GoalRadar',
      description: 'Football live scores and match details.',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMatchDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatShortDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function minuteLabel(minute: number, injuryTime?: number | null) {
  return `${minute}${injuryTime ? `+${injuryTime}` : ''}'`;
}

function goalSuffix(type: string): string {
  if (type === 'PENALTY'  || type === 'Penalty')  return '(P)';
  if (type === 'OWN_GOAL' || type === 'Own Goal') return '(OG)';
  return '';
}

function GoalScorers({ match, effectiveScore }: { match: MatchDetail; effectiveScore: EffectiveScore | null }) {
  const goals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
  if (!goals.length) return null;
  if (!['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) return null;

  // For FINISHED matches, effectiveScore is authoritative (already reconciled).
  // If total is 0 but events exist, the events are stale/disallowed — suppress.
  if (match.status === 'FINISHED') {
    const total = (effectiveScore?.home ?? 0) + (effectiveScore?.away ?? 0);
    if (total === 0) return null;
  }

  const homeGoals = goals.filter((g) => g.team?.id === match.homeTeam.id);
  const awayGoals = goals.filter((g) => g.team?.id !== match.homeTeam.id);

  function ScorerRow({ g, reverse }: { g: Goal; reverse?: boolean }) {
    const suffix = goalSuffix(g.type);
    return (
      <div className={`flex items-baseline gap-1.5 text-xs text-gray-300 ${reverse ? 'flex-row-reverse' : ''}`}>
        <span className="text-sm leading-none shrink-0" aria-hidden="true">⚽</span>
        <span className={`font-medium truncate ${reverse ? 'text-right' : ''}`}>{g.scorer?.name}</span>
        {suffix && <span className="text-gray-500 shrink-0">{suffix}</span>}
        <span className={`text-gray-500 shrink-0 tabular-nums ${reverse ? 'mr-auto' : 'ml-auto'}`}>
          {minuteLabel(g.minute, g.injuryTime)}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {homeGoals.map((g, i) => <ScorerRow key={i} g={g} />)}
        </div>
        <div className="space-y-1.5">
          {awayGoals.map((g, i) => <ScorerRow key={i} g={g} reverse />)}
        </div>
      </div>
    </div>
  );
}

function sectionTitle(label: string) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {label}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: MatchDetail['status'] }) {
  if (status === 'IN_PLAY') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-sm font-bold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === 'PAUSED')
    return (
      <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold">
        HALF TIME
      </span>
    );
  if (status === 'FINISHED')
    return (
      <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-bold">
        FULL TIME
      </span>
    );
  if (status === 'CANCELLED' || status === 'SUSPENDED')
    return (
      <span className="bg-red-900/30 text-red-400 border border-red-800/50 px-3 py-1 rounded-full text-sm font-bold">
        CANCELLED
      </span>
    );
  if (status === 'SCHEDULED' || status === 'TIMED')
    return (
      <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-sm font-bold">
        UPCOMING
      </span>
    );
  return (
    <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-sm font-bold">
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score hero
// ---------------------------------------------------------------------------

function ScoreHero({ match, effectiveScore, centerSlot }: { match: MatchDetail; effectiveScore: EffectiveScore | null; centerSlot?: React.ReactNode }) {
  const { score, homeTeam, awayTeam, status } = match;
  const showScore   = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);
  const isUpcoming  = ['SCHEDULED', 'TIMED'].includes(status);
  const mainRef = match.referees?.find((r) => r.type === 'REFEREE') ?? match.referees?.[0];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      <div className="text-center mb-4">
        <Link
          href={`/competition/${match.competition?.code}`}
          className="text-xs text-gray-500 uppercase tracking-wider font-medium hover:text-white transition-colors"
        >
          {match.competition?.name}
          {match.matchday ? ` · Matchday ${match.matchday}` : ''}
        </Link>
        <p className="text-xs text-gray-500 mt-1">{formatMatchDate(match.utcDate)} UTC</p>
        {/* Local time — client-side island, renders after hydration only */}
        <LocalTime utcDate={match.utcDate} variant="with-label" className="mt-2" />
        {/* Add to Calendar — upcoming matches only */}
        {isUpcoming && (
          <div className="mt-4 flex justify-center">
            <AddToCalendar
              matchId={match.id}
              utcDate={match.utcDate}
              homeTeam={homeTeam.name}
              awayTeam={awayTeam.name}
              competition={
                match.competition?.code === 'WC'
                  ? 'FIFA World Cup 2026'
                  : (match.competition?.name ?? 'Football')
              }
              venue={match.venue ?? undefined}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        {/* Home */}
        {homeTeam.id > 0 ? (
          <Link href={teamPath(homeTeam.id, homeTeam.name)} className="text-center group block">
            {homeTeam.crest && (
              <img
                src={homeTeam.crest}
                alt={homeTeam.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-3 group-hover:opacity-80 transition-opacity"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base leading-tight group-hover:text-green-400 transition-colors">
              {homeTeam.shortName || homeTeam.name}
            </p>
          </Link>
        ) : (
          <div className="text-center">
            {homeTeam.crest && (
              <img
                src={homeTeam.crest}
                alt={homeTeam.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-3 opacity-50"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base leading-tight">
              {homeTeam.shortName || homeTeam.name}
            </p>
          </div>
        )}

        {/* Score / live zone */}
        <div className="text-center">
          {centerSlot ?? (
            <>
              <div className="flex justify-center mb-4">
                <StatusPill status={status} />
              </div>
              {showScore ? (
                <>
                  <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
                    {effectiveScore?.home ?? '–'}
                    <span className="text-gray-600 mx-1">–</span>
                    {effectiveScore?.away ?? '–'}
                  </div>
                  {score.halfTime.home !== null && (
                    <p className="text-xs text-gray-500 mt-2">
                      HT {score.halfTime.home} – {score.halfTime.away}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-3xl font-bold text-gray-600">vs</div>
              )}
            </>
          )}
        </div>

        {/* Away */}
        {awayTeam.id > 0 ? (
          <Link href={teamPath(awayTeam.id, awayTeam.name)} className="text-center group block">
            {awayTeam.crest && (
              <img
                src={awayTeam.crest}
                alt={awayTeam.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-3 group-hover:opacity-80 transition-opacity"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base leading-tight group-hover:text-green-400 transition-colors">
              {awayTeam.shortName || awayTeam.name}
            </p>
          </Link>
        ) : (
          <div className="text-center">
            {awayTeam.crest && (
              <img
                src={awayTeam.crest}
                alt={awayTeam.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-3 opacity-50"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base leading-tight">
              {awayTeam.shortName || awayTeam.name}
            </p>
          </div>
        )}
      </div>

      {/* Venue / referee meta */}
      {(match.venue || mainRef) && (
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-gray-500">
          {match.venue && <span>📍 {match.venue}</span>}
          {mainRef && <span>🟡 Referee: {mainRef.name}</span>}
        </div>
      )}

      {/* Goal scorers — compact above-fold summary */}
      <GoalScorers match={match} effectiveScore={effectiveScore} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match summary
// ---------------------------------------------------------------------------

function MatchSummary({ match, effectiveScore }: { match: MatchDetail; effectiveScore: EffectiveScore | null }) {
  const { score, homeTeam, awayTeam, status } = match;

  // Derive winner from effectiveScore when score.winner is absent
  let winner = '';
  if (status === 'FINISHED') {
    if (score.winner === 'HOME_TEAM') {
      winner = homeTeam.shortName || homeTeam.name;
    } else if (score.winner === 'AWAY_TEAM') {
      winner = awayTeam.shortName || awayTeam.name;
    } else if (score.winner === 'DRAW') {
      winner = 'Draw';
    } else if (effectiveScore) {
      // score.winner absent — derive from effectiveScore
      if (effectiveScore.home > effectiveScore.away)
        winner = homeTeam.shortName || homeTeam.name;
      else if (effectiveScore.away > effectiveScore.home)
        winner = awayTeam.shortName || awayTeam.name;
      else
        winner = 'Draw';
    }
  }

  const ftDisplay = effectiveScore
    ? `${effectiveScore.home} – ${effectiveScore.away}`
    : '–';

  const stats: { label: string; value: string }[] = [
    ...(winner ? [{ label: 'Winner', value: winner }] : []),
    { label: 'Full Time', value: ftDisplay },
    ...(score.halfTime.home !== null
      ? [{ label: 'Half Time', value: `${score.halfTime.home} – ${score.halfTime.away}` }]
      : []),
    ...(score.duration !== 'REGULAR'
      ? [{ label: 'Duration', value: score.duration.replace('_', ' ') }]
      : []),
    { label: 'Competition', value: match.competition?.name ?? '–' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Match Summary')}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-gray-800/50 rounded-xl p-3 text-center">
            <dt className="text-xs text-gray-500 mb-1">{label}</dt>
            <dd className="text-white font-bold text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match report — structured article content
// ---------------------------------------------------------------------------

function MatchReport({ match }: { match: MatchDetail }) {
  const sections   = buildStoryReport(buildStoryContext(match));
  const home       = match.homeTeam.name ?? 'TBD';
  const away       = match.awayTeam.name ?? 'TBD';
  const comp       = match.competition?.name ?? 'Football';
  const md         = match.matchday ? ` Matchday ${match.matchday}` : '';
  const headline   = `Match Report: ${home} vs ${away} – ${comp}${md}`;
  const datePublished = match.utcDate.split('T')[0];
  const dateModified  = match.lastUpdated?.split('T')[0] ?? datePublished;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: 'GoalRadar', url: 'https://goalradar.org' },
    publisher: {
      '@type': 'Organization',
      name: 'GoalRadar',
      url: 'https://goalradar.org',
      logo: { '@type': 'ImageObject', url: 'https://goalradar.org/favicon.ico' },
    },
    description: `${home} vs ${away} match report — ${comp}${md}. Covering the first half, second half, result and competition context.`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://goalradar.org${matchPath(match.id, match.homeTeam.name, match.awayTeam.name)}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <article className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-white mb-6">Match Report</h2>
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.heading}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                {section.heading}
              </h3>
              {section.paragraphs.map((para, i) => (
                <p key={i} className="text-gray-300 text-sm leading-relaxed">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </>
  );
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

function GoalsSection({ match }: { match: MatchDetail }) {
  const goals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
  if (!goals.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Goals')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {goals.map((goal: Goal, i) => {
          const isHome = goal.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 mt-0.5 text-center">
                {minuteLabel(goal.minute, goal.injuryTime)}
              </span>
              <span className="text-lg leading-none" aria-hidden="true">⚽</span>
              <div className={`flex flex-col ${isHome ? '' : 'items-end'}`}>
                <span className="text-white text-sm font-medium">{goal.scorer?.name}</span>
                {goal.assist && (
                  <span className="text-gray-500 text-xs">assist: {goal.assist.name}</span>
                )}
                {goal.type && goal.type !== 'REGULAR' && (
                  <span className="text-gray-600 text-xs capitalize">
                    {goal.type.toLowerCase().replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

function BookingsSection({ match }: { match: MatchDetail }) {
  const bookings = [...(match.bookings ?? [])].sort((a, b) => a.minute - b.minute);
  if (!bookings.length) return null;

  const cardIcon = (card: Booking['card']) =>
    card === 'YELLOW' ? '🟨' : card === 'YELLOW_RED' ? '🟧' : '🟥';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Bookings')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {bookings.map((b: Booking, i) => {
          const isHome = b.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 text-center">
                {minuteLabel(b.minute)}
              </span>
              <span>{cardIcon(b.card)}</span>
              <span className="text-white text-sm">{b.player?.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

function SubstitutionsSection({ match }: { match: MatchDetail }) {
  const subs = [...(match.substitutions ?? [])].sort((a, b) => a.minute - b.minute);
  if (!subs.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Substitutions')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {subs.map((s: Substitution, i) => {
          const isHome = s.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 mt-0.5 text-center">
                {minuteLabel(s.minute)}
              </span>
              <span className="text-base leading-none" aria-hidden="true">🔄</span>
              <div className={`flex flex-col text-sm ${isHome ? '' : 'items-end'}`}>
                <span className="text-green-400">{s.playerIn?.name}</span>
                <span className="text-gray-500">{s.playerOut?.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match statistics (computed from events — API free tier only)
// ---------------------------------------------------------------------------

function MatchStatistics({ match }: { match: MatchDetail }) {
  const goals = match.goals ?? [];
  const bookings = match.bookings ?? [];
  const subs = match.substitutions ?? [];

  const homeGoals = goals.filter((g) => g.team?.id === match.homeTeam.id).length;
  const awayGoals = goals.filter((g) => g.team?.id === match.awayTeam.id).length;
  const homeYellows = bookings.filter(
    (b) => b.team?.id === match.homeTeam.id && b.card === 'YELLOW'
  ).length;
  const awayYellows = bookings.filter(
    (b) => b.team?.id === match.awayTeam.id && b.card === 'YELLOW'
  ).length;
  const homeReds = bookings.filter(
    (b) => b.team?.id === match.homeTeam.id && (b.card === 'RED' || b.card === 'YELLOW_RED')
  ).length;
  const awayReds = bookings.filter(
    (b) => b.team?.id === match.awayTeam.id && (b.card === 'RED' || b.card === 'YELLOW_RED')
  ).length;
  const homeSubs = subs.filter((s) => s.team?.id === match.homeTeam.id).length;
  const awaySubs = subs.filter((s) => s.team?.id === match.awayTeam.id).length;

  const rows = [
    { label: 'Goals', home: homeGoals, away: awayGoals },
    { label: 'Yellow Cards', home: homeYellows, away: awayYellows },
    { label: 'Red Cards', home: homeReds, away: awayReds },
    { label: 'Substitutions', home: homeSubs, away: awaySubs },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Match Statistics')}
      <div className="space-y-3">
        {rows.map(({ label, home, away }) => {
          const total = home + away;
          const homePct = total === 0 ? 50 : Math.round((home / total) * 100);
          const awayPct = 100 - homePct;
          return (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white font-medium w-8 text-left">{home}</span>
                <span className="text-gray-400 text-xs">{label}</span>
                <span className="text-white font-medium w-8 text-right">{away}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
                <div
                  className="bg-blue-500 transition-[width]"
                  style={{ width: `${homePct}%` }}
                />
                <div
                  className="bg-orange-500 transition-[width]"
                  style={{ width: `${awayPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-4 text-center">
        Statistics computed from match events. Possession and shot data not available on this plan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

function LineupsSection({ match }: { match: MatchDetail }) {
  const lineups = match.lineups;
  if (!lineups) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        {sectionTitle('Lineups')}
        <p className="text-sm text-gray-500 text-center py-6">
          Detailed starting lineups are not available from the current data provider.
        </p>
      </div>
    );
  }

  const renderTeam = (lineup: typeof lineups.home, label: string) => {
    const starters = lineup.players.filter((p) => p.starter);
    const bench    = lineup.players.filter((p) => !p.starter);
    return (
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2 text-center">
          {label}
        </p>
        <div className="space-y-1">
          {starters.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 w-5 text-right text-xs">{p.jersey ?? ''}</span>
              <span className="text-white truncate">{p.name}</span>
              {p.position && (
                <span className="text-gray-500 text-xs ml-auto shrink-0">{p.position}</span>
              )}
              {p.subbedOut && <span className="text-orange-400 text-xs shrink-0">↓</span>}
            </div>
          ))}
          {bench.length > 0 && (
            <>
              <p className="text-xs text-gray-600 pt-2 pb-1">Substitutes</p>
              {bench.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm opacity-60">
                  <span className="text-gray-500 w-5 text-right text-xs">{p.jersey ?? ''}</span>
                  <span className="text-gray-300 truncate">{p.name}</span>
                  {p.position && (
                    <span className="text-gray-600 text-xs ml-auto shrink-0">{p.position}</span>
                  )}
                  {p.subbedIn && <span className="text-green-400 text-xs shrink-0">↑</span>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Lineups')}
      <div className="flex gap-6">
        {renderTeam(lineups.home, match.homeTeam.shortName || match.homeTeam.name)}
        <div className="w-px bg-gray-800 self-stretch" />
        {renderTeam(lineups.away, match.awayTeam.shortName || match.awayTeam.name)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

function HeadToHeadSection({
  h2h,
  match,
}: {
  h2h: HeadToHead;
  match: MatchDetail;
}) {
  const { aggregates, matches } = h2h;
  if (!aggregates || !aggregates.numberOfMatches) return null;

  // aggregates.homeTeam refers to the home side of the h2h query (same as match.homeTeam)
  const homeStat = aggregates.homeTeam;
  const awayStat = aggregates.awayTeam;
  const total = aggregates.numberOfMatches;

  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5);

  function resultFor(m: Match) {
    const isHome = m.homeTeam.id === match.homeTeam.id;
    const winner = m.score.winner;
    if (!winner) return 'D';
    if (winner === 'DRAW') return 'D';
    if ((winner === 'HOME_TEAM' && isHome) || (winner === 'AWAY_TEAM' && !isHome)) return 'W';
    return 'L';
  }

  const resultColor: Record<string, string> = {
    W: 'bg-green-500/20 text-green-400 border-green-500/30',
    D: 'bg-gray-700 text-gray-300 border-gray-600',
    L: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Head to Head')}

      {/* Win/draw/loss bar */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-white font-bold">{homeStat.wins}W</span>
        <span className="text-gray-400 text-xs self-center">
          {total} meetings · {aggregates.totalGoals} goals
        </span>
        <span className="text-white font-bold">{awayStat.wins}W</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-1">
        {homeStat.wins > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${(homeStat.wins / total) * 100}%` }}
          />
        )}
        {homeStat.draws > 0 && (
          <div
            className="bg-gray-600"
            style={{ width: `${(homeStat.draws / total) * 100}%` }}
          />
        )}
        {awayStat.wins > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${(awayStat.wins / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-5">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span>{homeStat.draws}D</span>
        <span>{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>

      {/* Recent meetings */}
      {recentMatches.length > 0 && (
        <>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Meetings</p>
          <div className="space-y-2">
            {recentMatches.map((m: Match) => {
              const res = resultFor(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-gray-600 text-xs w-20 shrink-0">
                    {formatShortDate(m.utcDate)}
                  </span>
                  <span className="text-gray-300 flex-1 truncate text-xs">
                    {m.homeTeam.shortName || m.homeTeam.name}
                    {' '}
                    <span className="text-white font-bold">
                      {m.score.fullTime.home ?? '–'} – {m.score.fullTime.away ?? '–'}
                    </span>
                    {' '}
                    {m.awayTeam.shortName || m.awayTeam.name}
                  </span>
                  <span
                    className={`text-xs font-bold border px-1.5 py-0.5 rounded ${resultColor[res]}`}
                  >
                    {res}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb builder — context-aware
// ---------------------------------------------------------------------------

function buildBreadcrumb(match: MatchDetail): BreadcrumbItem[] {
  const isWC   = match.competition?.code === 'WC';
  const hn     = match.homeTeam.shortName || match.homeTeam.name || 'TBD';
  const an     = match.awayTeam.shortName || match.awayTeam.name || 'TBD';
  const matchLabel = `${hn} vs ${an}`;

  if (isWC) {
    if (match.group) {
      // GROUP_A → 'group-a' / 'Group A'
      const slug  = match.group.toLowerCase().replace(/[\s_]+/g, '-'); // group-a (handles GROUP_A and "Group A")
      const label = match.group.replace('GROUP_', 'Group ');          // Group A
      return [
        { label: 'Home',           href: '/' },
        { label: 'World Cup 2026', href: '/world-cup-2026' },
        { label: label,            href: `/world-cup-2026/${slug}` },
        { label: matchLabel },
      ];
    }
    // Knockout (no group)
    return [
      { label: 'Home',           href: '/' },
      { label: 'World Cup 2026', href: '/world-cup-2026' },
      { label: 'Bracket',        href: '/world-cup-2026/bracket' },
      { label: matchLabel },
    ];
  }

  // Non-WC
  return [
    { label: 'Home',  href: '/' },
    {
      label: match.competition?.name ?? 'League',
      href: match.competition?.code ? `/competition/${match.competition.code}` : '/standings',
    },
    { label: matchLabel },
  ];
}

// ---------------------------------------------------------------------------
// Other Group Matches
// ---------------------------------------------------------------------------

function OtherGroupMatches({
  groupMatches,
  currentId,
}: {
  groupMatches: Match[];
  currentId: number;
}) {
  const others = groupMatches
    .filter((m) => m.id !== currentId)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  if (!others.length) return null;

  // Split into results (finished) and upcoming
  const results  = others.filter((m) => m.status === 'FINISHED').reverse();
  const upcoming = others.filter((m) => m.status !== 'FINISHED');

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Other Group Matches
      </h2>
      <div className="space-y-3">
        {[...results, ...upcoming].slice(0, 5).map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Related Matches — broader competition context
// ---------------------------------------------------------------------------

function RelatedMatches({
  homeTeamId,
  awayTeamId,
  competitionName,
  matches,
  currentId,
}: {
  homeTeamId: number;
  awayTeamId: number;
  competitionName: string;
  matches: Match[];
  currentId: number;
}) {
  // Find recent matches involving either team in the same competition
  const related = matches
    .filter((m) => m.id !== currentId)
    .filter((m) => (
      m.homeTeam.id === homeTeamId || m.awayTeam.id === homeTeamId ||
      m.homeTeam.id === awayTeamId || m.awayTeam.id === awayTeamId
    ))
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 4);

  if (!related.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Related Matches · {competitionName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {related.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competition Links — contextual internal navigation
// ---------------------------------------------------------------------------

function CompetitionLinks({ match }: { match: MatchDetail }) {
  const isWC  = match.competition?.code === 'WC';
  const group = match.group;
  const groupSlug  = group ? group.toLowerCase().replace(/[\s_]+/g, '-') : null;
  const groupLabel = group ? group.replace('GROUP_', 'Group ') : null;
  const compCode   = match.competition?.code;
  const compName   = match.competition?.name ?? 'Competition';

  type LinkItem = { href: string; icon: string; label: string; desc: string };

  const homePath = teamPath(match.homeTeam.id, match.homeTeam.name);
  const awayPath = teamPath(match.awayTeam.id, match.awayTeam.name);
  const homeLabel = match.homeTeam.shortName || match.homeTeam.name || 'Home team';
  const awayLabel = match.awayTeam.shortName || match.awayTeam.name || 'Away team';

  const links: LinkItem[] = isWC
    ? [
        { href: homePath,                  icon: '🔵', label: homeLabel,          desc: 'Team page' },
        { href: awayPath,                  icon: '🔴', label: awayLabel,          desc: 'Team page' },
        { href: '/world-cup-2026',         icon: '🏆', label: 'World Cup Hub',    desc: 'Scores, fixtures, standings' },
        { href: '/world-cup-2026/bracket', icon: '🔗', label: 'Knockout Bracket', desc: 'Full tournament bracket' },
        ...(groupSlug && groupLabel
          ? [{ href: `/world-cup-2026/${groupSlug}`, icon: '📊', label: groupLabel, desc: 'Group standings & fixtures' }]
          : []
        ),
        { href: '/world-cup-2026',         icon: '📅', label: 'All WC Fixtures',  desc: 'Upcoming matches' },
        { href: '/standings',              icon: '🏅', label: 'Standings',         desc: 'League tables' },
        { href: '/live',                   icon: '🔴', label: 'Live Scores',       desc: 'Matches in play' },
      ]
    : [
        { href: homePath,  icon: '🔵', label: homeLabel, desc: 'Team page' },
        { href: awayPath,  icon: '🔴', label: awayLabel, desc: 'Team page' },
        ...(compCode
          ? [{ href: `/competition/${compCode}`, icon: '📊', label: compName,    desc: 'Standings & fixtures' }]
          : []
        ),
        { href: '/standings',  icon: '🏅', label: 'All Standings', desc: 'League tables' },
        { href: '/schedule',   icon: '📅', label: 'Schedule',      desc: 'Upcoming fixtures' },
        { href: '/live',       icon: '🔴', label: 'Live Scores',   desc: 'Matches in play' },
      ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Competition Links
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {links.map(({ href, icon, label, desc }) => (
          <Link
            key={href + label}
            href={href}
            className="flex flex-col gap-0.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-xl p-3 transition-[border-color,background-color,box-shadow] group"
          >
            <span className="text-lg leading-none mb-1">{icon}</span>
            <span className="text-white text-xs font-semibold group-hover:text-green-400 transition-colors leading-tight">
              {label}
            </span>
            <span className="text-gray-500 text-xs leading-tight">{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group standings preview (WC only)
// ---------------------------------------------------------------------------

function GroupStandingsPreview({
  table,
  apiGroup,
  groupSlug,
  groupLabel,
}: {
  table: import('@/lib/types').StandingEntry[];
  apiGroup: string;
  groupSlug: string;
  groupLabel: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {groupLabel} Standings
        </h2>
        <Link
          href={`/world-cup-2026/${groupSlug}`}
          className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
        >
          Full group →
        </Link>
      </div>
      <WCGroupTable
        group={apiGroup}
        table={table}
        href={`/world-cup-2026/${groupSlug}`}
      />
      <p className="text-xs text-gray-700 mt-2 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-sm bg-green-500 shrink-0" />
        Top 2 advance to knockout stage
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WC Navigation box
// ---------------------------------------------------------------------------

function WCNavBox({
  groupSlug,
  groupLabel,
  homeTeam,
  awayTeam,
}: {
  groupSlug:  string | null;
  groupLabel: string | null;
  homeTeam:   { id: number; name: string; shortName: string; crest: string };
  awayTeam:   { id: number; name: string; shortName: string; crest: string };
}) {
  const navLinks = [
    { href: teamPath(homeTeam.id, homeTeam.name), icon: '🔵', label: homeTeam.shortName || homeTeam.name, desc: 'Team page' },
    { href: teamPath(awayTeam.id, awayTeam.name), icon: '🔴', label: awayTeam.shortName || awayTeam.name, desc: 'Team page' },
    { href: '/schedule?competition=WC',   icon: '📅', label: 'WC Fixtures', desc: 'Upcoming matches'         },
    { href: '/world-cup-2026/results',    icon: '🏁', label: 'Results',     desc: 'All scores & reports'     },
    { href: '/world-cup-2026/bracket',    icon: '🔗', label: 'Bracket',     desc: 'Knockout tournament tree'  },
    ...(groupSlug && groupLabel
      ? [{ href: `/world-cup-2026/${groupSlug}`, icon: '📊', label: groupLabel, desc: 'Group standings & fixtures' }]
      : [{ href: '/world-cup-2026',              icon: '📊', label: 'Groups',    desc: 'All group standings'        }]
    ),
    { href: '/world-cup-2026',            icon: '🏆', label: 'WC Hub',      desc: 'Tournament overview'       },
    { href: '/world-cup-2026/watch-live', icon: '📺', label: 'Watch Live',  desc: 'Broadcasters by country'   },
    { href: '/live',                      icon: '🔴', label: 'Live Scores', desc: 'Matches in play'           },
  ];

  return (
    <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg" aria-hidden="true">🏆</span>
        <h2 className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest">
          FIFA World Cup 2026
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {navLinks.map(({ href, icon, label, desc }) => (
          <Link
            key={href + label}
            href={href}
            className="flex flex-col gap-0.5 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/40 hover:border-yellow-700/40 rounded-xl p-3 transition-[border-color,background-color,box-shadow] group"
          >
            <span className="text-base leading-none mb-1">{icon}</span>
            <span className="text-white text-xs font-semibold group-hover:text-yellow-400 transition-colors leading-tight">
              {label}
            </span>
            <span className="text-gray-500 text-xs leading-tight">{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next / Previous match navigation
// ---------------------------------------------------------------------------

function NextPrevNav({
  allGroupMatches,
  currentId,
}: {
  allGroupMatches: Match[];
  currentId: number;
}) {
  const sorted = [...allGroupMatches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  const idx  = sorted.findIndex((m) => m.id === currentId);
  const prev = idx > 0               ? sorted[idx - 1] : null;
  const next = idx < sorted.length-1 ? sorted[idx + 1] : null;

  if (!prev && !next) return null;

  function MatchPill({ m, direction }: { m: Match; direction: 'prev' | 'next' }) {
    const hn = m.homeTeam?.shortName || m.homeTeam?.name || 'TBD';
    const an = m.awayTeam?.shortName || m.awayTeam?.name || 'TBD';
    const date = new Date(m.utcDate).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
    const showScore = m.status === 'FINISHED';

    return (
      <Link
        href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
        className="flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-3 transition-[border-color,background-color,box-shadow] flex-1 min-w-0"
      >
        <span className="text-gray-500 text-xs uppercase tracking-wider">
          {direction === 'prev' ? '← Previous' : 'Next →'}
        </span>
        <span className="text-gray-300 text-xs truncate font-medium">{hn} vs {an}</span>
        <span className="text-gray-500 text-xs">
          {showScore
            ? `${m.score.fullTime.home ?? '–'} – ${m.score.fullTime.away ?? '–'} · FT`
            : date}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex gap-3">
      {prev ? <MatchPill m={prev} direction="prev" /> : <div className="flex-1" />}
      {next ? <MatchPill m={next} direction="next" /> : <div className="flex-1" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue funnel — WC-only CTAs
// ---------------------------------------------------------------------------

// ── 1. Above-fold: compact "How to watch" strip ──────────────────────────────

function WCAboveFoldCTA({ matchId }: { matchId: number | string }) {
  return (
    <div className="bg-gradient-to-r from-yellow-950/40 via-gray-900 to-gray-900 border border-yellow-800/30 rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl shrink-0" aria-hidden="true">📺</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">How to Watch This Match</p>
            <p className="text-xs text-yellow-400/80 leading-tight">FIFA World Cup 2026</p>
          </div>
        </div>
        {/* Quick-access nav buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/world-cup-2026/watch-live"
            className="inline-flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>📺</span> Watch Live
          </Link>
          <Link
            href="/world-cup-2026/tv-schedule"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
          >
            <span>🗓️</span> TV Schedule
          </Link>
          <Link
            href="/world-cup-2026/streaming-guide"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
          >
            <span>📡</span> Streaming
          </Link>
        </div>
      </div>
      {/* GEO-1: geo-aware, tier-prioritised country chips (6 + More on mobile) */}
      <CountryChips matchId={matchId} pageType="match" />
    </div>
  );
}

// ── 2. Mid-content: 2-card affiliate grid ────────────────────────────────────

function WCMidFunnel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold px-0.5">
        Watch World Cup 2026
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AffiliateBlock
          title="📺 Stream Every Match Live"
          description="Official broadcasters in the US, UK, Canada, Australia and more — no illegal streams."
          cta="Find a Stream"
          url="#"
          tag="match-mid-watch-live"
        />
        <AffiliateBlock
          title="📡 Full Streaming Guide"
          description="Compare every platform: Fubo TV, Peacock, SBS On Demand, BBC iPlayer, TSN and more."
          cta="View Streaming Guide"
          url="#"
          tag="match-mid-streaming"
          variant="green"
        />
      </div>
    </div>
  );
}

// ── 3. Bottom: comprehensive revenue funnel ───────────────────────────────────

const ALL_WC_TEAMS_LIST = Object.values(WC_TEAMS);

function WCBottomFunnel({
  match,
  matchGroupSlug,
  matchGroupLabel,
}: {
  match: MatchDetail;
  matchGroupSlug: string | null;
  matchGroupLabel: string | null;
}) {
  const homeWCTeam = ALL_WC_TEAMS_LIST.find((t) => t.apiName === match.homeTeam.name);
  const awayWCTeam = ALL_WC_TEAMS_LIST.find((t) => t.apiName === match.awayTeam.name);

  const homeShort = match.homeTeam.shortName || match.homeTeam.name || 'Home';
  const awayShort = match.awayTeam.shortName || match.awayTeam.name || 'Away';

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="border-t border-white/8 pt-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          World Cup 2026 — Watch &amp; Explore
        </h2>

        {/* Row 1: Watch Live / TV Channels / Streaming Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Link
            href="/world-cup-2026/watch-live"
            className="group flex flex-col gap-1 bg-gradient-to-br from-yellow-950/40 to-gray-900 border border-yellow-800/30 hover:border-yellow-600/50 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
          >
            <span className="text-2xl mb-1" aria-hidden="true">📺</span>
            <span className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
              Watch Live
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              Official broadcasters by country — US, UK, Australia and more
            </span>
          </Link>

          <Link
            href="/world-cup-2026/tv-schedule"
            className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
          >
            <span className="text-2xl mb-1">🗓️</span>
            <span className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
              TV Channel Guide
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              Fox, ITV, BBC, Telemundo — which channel shows each match
            </span>
          </Link>

          <Link
            href="/world-cup-2026/streaming-guide"
            className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
          >
            <span className="text-2xl mb-1">📡</span>
            <span className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
              Streaming Guide
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              Fubo TV, Peacock, SBS, BBC iPlayer, TSN+ compared
            </span>
          </Link>
        </div>

        {/* Row 2: Team Pages (conditional) + Group Page */}
        {(homeWCTeam || awayWCTeam || matchGroupSlug) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {homeWCTeam && (
              <Link
                href={`/world-cup-2026/${homeWCTeam.slug}`}
                className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-blue-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
              >
                <span className="text-2xl mb-1">{homeWCTeam.flag}</span>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">
                  {homeShort} Team Page
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  Squad, fixtures &amp; group
                </span>
              </Link>
            )}

            {awayWCTeam && (
              <Link
                href={`/world-cup-2026/${awayWCTeam.slug}`}
                className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-blue-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
              >
                <span className="text-2xl mb-1">{awayWCTeam.flag}</span>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">
                  {awayShort} Team Page
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  Squad, fixtures &amp; group
                </span>
              </Link>
            )}

            {matchGroupSlug && matchGroupLabel && (
              <Link
                href={`/world-cup-2026/${matchGroupSlug}`}
                className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-green-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
              >
                <span className="text-2xl mb-1">📊</span>
                <span className="text-xs font-bold text-white group-hover:text-green-400 transition-colors leading-tight">
                  {matchGroupLabel} Standings
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  Table, results &amp; fixtures
                </span>
              </Link>
            )}

            {/* Fallback filler — always show WC Hub */}
            <Link
              href="/world-cup-2026"
              className="group flex flex-col gap-1 bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow]"
            >
              <span className="text-2xl mb-1" aria-hidden="true">🏆</span>
              <span className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors leading-tight">
                WC 2026 Hub
              </span>
              <span className="text-xs text-gray-500 leading-tight">
                Scores, fixtures &amp; standings
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Affiliate: VPN CTA */}
      <AffiliateBlock
        title="🌍 Watching from Abroad?"
        description="Access your home broadcaster from anywhere. Fast VPN servers in 100+ countries, 30-day money-back guarantee."
        cta="Get a VPN"
        url="#"
        tag="match-bottom-vpn"
        variant="blue"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Page State Machine — ONE VIEW MODEL → MANY STATES
// ---------------------------------------------------------------------------
// MatchPageState and deriveMatchPageState are imported from @/lib/match-page-state
// (DATA-18WC.RUNTIME.TRUTH Phase 2 — moved to shared lib so MatchRuntimeState can import them).
// The type alias below preserves local usages without renaming every call site.

const STAGE_LABELS: Record<string, string> = {
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS:    'Semi-finals',
  THIRD_PLACE:    'Third Place Play-off',
  FINAL:          'Final',
};

const STAGE_NEXT: Record<string, string> = {
  LAST_32:        'Round of 16',
  LAST_16:        'Quarter-finals',
  QUARTER_FINALS: 'Semi-finals',
  SEMI_FINALS:    'Final',
};

// ---------------------------------------------------------------------------
// PROJECTED hero — knockout match, teams TBD
// ---------------------------------------------------------------------------

function ProjectedHero({ match }: { match: MatchDetail }) {
  const isWC       = match.competition?.code === 'WC';
  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage?.replace(/_/g, ' ') ?? 'Knockout Stage';
  const nextRound  = STAGE_NEXT[match.stage] ?? null;
  const homeLabel  = match.homeTeam?.name || 'TBD';
  const awayLabel  = match.awayTeam?.name || 'TBD';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      {/* Stage header */}
      <div className="text-center mb-6">
        <Link
          href={isWC ? '/world-cup-2026/bracket' : `/competition/${match.competition?.code}`}
          className="inline-flex items-center gap-1.5 text-xs text-yellow-400/80 uppercase tracking-wider font-semibold hover:text-yellow-400 transition-colors"
        >
          <span aria-hidden="true">🏆</span>
          {isWC ? 'FIFA World Cup 2026' : (match.competition?.name ?? 'Football')} · {stageLabel}
        </Link>
        <p className="text-xs text-gray-500 mt-1">{formatMatchDate(match.utcDate)} UTC</p>
        <LocalTime utcDate={match.utcDate} variant="with-label" className="mt-2" />
        <AddToCalendar
          matchId={match.id}
          utcDate={match.utcDate}
          homeTeam={homeLabel}
          awayTeam={awayLabel}
          competition={isWC ? 'FIFA World Cup 2026' : (match.competition?.name ?? 'Football')}
          venue={match.venue ?? undefined}
        />
      </div>

      {/* Team slots */}
      <div className="grid grid-cols-3 items-center gap-4 mb-6">
        <div className="text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
            <span className="text-xl sm:text-2xl text-gray-500">?</span>
          </div>
          <p className="font-bold text-white text-sm sm:text-base leading-tight">{homeLabel}</p>
          <p className="text-gray-500 text-xs mt-1">Home team</p>
        </div>

        <div className="text-center space-y-2">
          <span className="inline-block bg-blue-500/15 text-blue-400 border border-blue-500/25 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
            UPCOMING
          </span>
          <div className="text-2xl font-bold text-gray-600">vs</div>
          {nextRound && (
            <p className="text-xs text-gray-500 leading-tight">Winner → {nextRound}</p>
          )}
        </div>

        <div className="text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
            <span className="text-xl sm:text-2xl text-gray-500">?</span>
          </div>
          <p className="font-bold text-white text-sm sm:text-base leading-tight">{awayLabel}</p>
          <p className="text-gray-500 text-xs mt-1">Away team</p>
        </div>
      </div>

      {/* Qualification status + venue */}
      <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-gray-800 text-xs">
        <span className="inline-flex items-center gap-1.5 text-amber-400/80 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-1.5">
          <span aria-hidden="true">⏳</span> Teams to be confirmed after group stage
        </span>
        {match.venue && (
          <span className="inline-flex items-center gap-1.5 text-gray-400">
            <span>📍</span> {match.venue}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CANCELLED hero
// ---------------------------------------------------------------------------

function CancelledHero({ match }: { match: MatchDetail }) {
  const isWC       = match.competition?.code === 'WC';
  const homeLabel  = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const awayLabel  = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      <div className="text-center mb-4">
        <Link
          href={isWC ? '/world-cup-2026' : `/competition/${match.competition?.code}`}
          className="text-xs text-gray-500 uppercase tracking-wider font-medium hover:text-white transition-colors"
        >
          {isWC ? 'FIFA World Cup 2026' : (match.competition?.name ?? '')}
        </Link>
        <p className="text-xs text-gray-500 mt-1">{formatMatchDate(match.utcDate)} UTC</p>
      </div>
      <div className="grid grid-cols-3 items-center gap-4 mb-6">
        <div className="text-center opacity-50">
          {match.homeTeam.crest && <img src={match.homeTeam.crest} alt={homeLabel} width={64} height={64} className="object-contain mx-auto mb-3" />}
          <p className="font-bold text-white text-sm leading-tight">{homeLabel}</p>
        </div>
        <div className="text-center">
          <span className="inline-block bg-red-900/30 text-red-400 border border-red-800/50 px-3 py-1 rounded-full text-sm font-bold mb-2">
            CANCELLED
          </span>
          <div className="text-3xl font-bold text-gray-700">–</div>
        </div>
        <div className="text-center opacity-50">
          {match.awayTeam.crest && <img src={match.awayTeam.crest} alt={awayLabel} width={64} height={64} className="object-contain mx-auto mb-3" />}
          <p className="font-bold text-white text-sm leading-tight">{awayLabel}</p>
        </div>
      </div>
      {match.venue && (
        <p className="text-center text-xs text-gray-500 pt-3 border-t border-gray-800">
          📍 {match.venue}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROJECTED content — below-fold sections for TBD knockout matches
// ---------------------------------------------------------------------------

function ProjectedContent({
  match,
  matchGroupSlug,
  matchGroupLabel,
}: {
  match: MatchDetail;
  matchGroupSlug: string | null;
  matchGroupLabel: string | null;
}) {
  const isWC       = match.competition?.code === 'WC';
  const homeLabel  = match.homeTeam?.name || 'TBD';
  const awayLabel  = match.awayTeam?.name || 'TBD';
  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage?.replace(/_/g, ' ') ?? 'Knockout Stage';
  const nextRound  = STAGE_NEXT[match.stage] ?? null;

  const detailRows: { label: string; value: string }[] = [
    { label: 'Stage',       value: stageLabel },
    { label: 'Competition', value: match.competition?.name ?? '–' },
    {
      label: 'Date',
      value: new Date(match.utcDate).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      }),
    },
    {
      label: 'Kickoff',
      value: new Date(match.utcDate).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC',
    },
    ...(match.venue  ? [{ label: 'Venue',      value: match.venue }]    : []),
    ...(nextRound    ? [{ label: 'Next Round', value: nextRound }]       : []),
  ];

  return (
    <>
      {/* Match details grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        {sectionTitle('Match Details')}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {detailRows.map(({ label, value }) => (
            <div key={label} className="bg-gray-800/50 rounded-xl p-3 text-center">
              <dt className="text-xs text-gray-500 mb-1">{label}</dt>
              <dd className="text-white font-bold text-sm leading-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Qualification status panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        {sectionTitle('Qualification Status')}
        <div className="space-y-3">
          {[
            { label: homeLabel, side: 'Home team' },
            { label: awayLabel, side: 'Away team' },
          ].map(({ label, side }) => (
            <div key={side} className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gray-700 border-2 border-dashed border-gray-500 flex items-center justify-center text-base shrink-0">
                ?
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-gray-500 text-xs">{side} · Qualification in progress</p>
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-0.5 shrink-0">
                Awaiting
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center leading-relaxed">
          Teams will be confirmed once the group stage is complete.
          Page updates automatically when slots are resolved.
        </p>
      </div>

      {/* Bracket path */}
      {isWC && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          {sectionTitle('Bracket Path')}
          {nextRound && (
            <p className="text-sm text-gray-400 mb-4">
              The winner of this {stageLabel} match advances to the <strong className="text-white">{nextRound}</strong>.
            </p>
          )}
          <Link
            href="/world-cup-2026/bracket"
            className="flex items-center justify-between bg-gray-800/60 hover:bg-gray-800 border border-gray-700 hover:border-yellow-700/40 rounded-xl p-4 transition-[border-color,background-color,box-shadow] group"
          >
            <div>
              <p className="text-white text-sm font-semibold group-hover:text-yellow-400 transition-colors">
                View Full Knockout Bracket
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Track all {stageLabel} fixtures and beyond
              </p>
            </div>
            <span className="text-gray-400 group-hover:text-yellow-400 transition-colors text-lg">→</span>
          </Link>
        </div>
      )}

      {/* WC navigation */}
      {isWC && (
        <>
          <WCMidFunnel />
          <WCNavBox
            groupSlug={matchGroupSlug}
            groupLabel={matchGroupLabel}
            homeTeam={{ id: 0, name: homeLabel, shortName: homeLabel, crest: '' }}
            awayTeam={{ id: 0, name: awayLabel, shortName: awayLabel, crest: '' }}
          />
          <WCBottomFunnel
            match={match}
            matchGroupSlug={matchGroupSlug}
            matchGroupLabel={matchGroupLabel}
          />
        </>
      )}

      <NewsletterSignup
        source="match-page"
        variant="inline"
        heading={isWC ? 'Get World Cup 2026 alerts' : 'Get football updates'}
      />
      <AdSlot slotId="match-bottom" variant="banner" />
    </>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ match, effectiveScore }: { match: MatchDetail; effectiveScore: EffectiveScore | null }) {
  const isFinished  = match.status === 'FINISHED';
  const isLive      = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isCancelled = match.status === 'CANCELLED' || match.status === 'SUSPENDED';
  const isPostponed = match.status === 'POSTPONED';

  // endDate: kick-off + 2 h (120 min) — used for finished matches
  const endDate = match.utcDate
    ? new Date(new Date(match.utcDate).getTime() + 120 * 60 * 1000).toISOString()
    : undefined;

  // Correct eventStatus mapping per schema.org/EventStatusType
  const eventStatus = isCancelled
    ? 'https://schema.org/EventCancelled'
    : isPostponed
    ? 'https://schema.org/EventPostponed'
    : isFinished
    ? 'https://schema.org/EventCompleted'
    : isLive
    ? 'https://schema.org/EventInProgress'
    : 'https://schema.org/EventScheduled';

  const homeScore = effectiveScore?.home ?? null;
  const awayScore = effectiveScore?.away ?? null;
  const hasScore  = isFinished && homeScore != null && awayScore != null;

  const compName     = match.competition?.name ?? 'Football';
  const canonicalUrl = `https://goalradar.org${matchPath(match.id, match.homeTeam.name, match.awayTeam.name)}`;

  // Rich description with context regardless of match status
  const description = hasScore
    ? `Final score: ${match.homeTeam.name} ${homeScore}–${awayScore} ${match.awayTeam.name}. ${compName} football match, including score, statistics, timeline and head-to-head records.`
    : isLive
    ? `${match.homeTeam.name} vs ${match.awayTeam.name} is live now. ${compName} football match — live score, statistics and timeline.`
    : `${match.homeTeam.name} vs ${match.awayTeam.name} — ${compName} football match, including score, statistics, timeline and head-to-head records.`;

  // Best available image: competition emblem → home crest → away crest
  const image = match.competition?.emblem || match.homeTeam.crest || match.awayTeam.crest || undefined;

  const homeTeamSchema: Record<string, unknown> = {
    '@type': 'SportsTeam',
    name:  match.homeTeam.name,
    url:   `https://goalradar.org${teamPath(match.homeTeam.id, match.homeTeam.name)}`,
    ...(match.homeTeam.crest ? { image: match.homeTeam.crest } : {}),
  };
  const awayTeamSchema: Record<string, unknown> = {
    '@type': 'SportsTeam',
    name:  match.awayTeam.name,
    url:   `https://goalradar.org${teamPath(match.awayTeam.id, match.awayTeam.name)}`,
    ...(match.awayTeam.crest ? { image: match.awayTeam.crest } : {}),
  };

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'SportsEvent',
    name:        `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    description,
    sport:       'Association football',
    url:         canonicalUrl,
    startDate:   match.utcDate,
    ...(isFinished && endDate ? { endDate } : {}),
    eventStatus,
    eventAttendanceMode: isLive
      ? 'https://schema.org/MixedEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    ...(image ? { image } : {}),
    // Both homeTeam/awayTeam (legacy) and competitor (current spec)
    homeTeam:   homeTeamSchema,
    awayTeam:   awayTeamSchema,
    competitor: [homeTeamSchema, awayTeamSchema],
    // performer — required by Google Rich Results for SportsEvent
    performer: [homeTeamSchema, awayTeamSchema],
    location: {
      '@type': 'Place',
      name: match.venue || compName || 'Football Stadium',
      ...(match.competition?.area?.name
        ? { address: { '@type': 'PostalAddress', addressLocality: match.competition.area.name } }
        : {}),
    },
    organizer: {
      '@type': 'Organization',
      name:    compName,
      url:     match.competition?.code
                 ? `https://goalradar.org/competition/${match.competition.code}`
                 : 'https://goalradar.org',
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: buildBreadcrumb(match).map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `https://goalradar.org${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// FAQ — structured data + visible section for rich-snippet eligibility
// ---------------------------------------------------------------------------

interface Faq { q: string; a: string }

function buildFaqs(match: MatchDetail, h2h: HeadToHead | null, effectiveScore?: EffectiveScore | null): Faq[] {
  const home  = match.homeTeam.name  ?? 'Home';
  const away  = match.awayTeam.name  ?? 'Away';
  const homeS = match.homeTeam.shortName || home;
  const awayS = match.awayTeam.shortName || away;
  const comp  = match.competition?.name ?? 'the competition';

  const dateStr = new Date(match.utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const timeStr = new Date(match.utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const isFinished = match.status === 'FINISHED';
  const isLive     = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isUpcoming = !isFinished && !isLive;
  const ftH = effectiveScore?.home ?? 0;
  const ftA = effectiveScore?.away ?? 0;
  const md  = match.matchday ? `, Matchday ${match.matchday}` : '';

  const faqs: Faq[] = [];

  // ── Upcoming / live: when / where / what competition ───────────────────────
  if (isUpcoming || isLive) {
    faqs.push({
      q: `When is ${home} vs ${away}?`,
      a: isLive
        ? `${home} vs ${away} is currently in progress${match.status === 'PAUSED' ? ' — it is half-time' : ''}.`
        : `${home} vs ${away} is scheduled for ${dateStr} at ${timeStr} UTC.`,
    });

    faqs.push({
      q: `Where is ${home} vs ${away} being played?`,
      a: match.venue
        ? `${home} vs ${away} is being played at ${match.venue}.`
        : `The venue for ${home} vs ${away} has not yet been confirmed.`,
    });

    faqs.push({
      q: `What competition is ${home} vs ${away}?`,
      a: `${home} vs ${away} is a ${comp} fixture${md}.`,
    });
  }

  // ── Finished: result / winner / scorers / when / where ─────────────────────
  if (isFinished) {
    const resultLine =
      match.score.winner === 'DRAW'
        ? `${home} and ${away} drew ${ftH}–${ftA}`
        : match.score.winner === 'HOME_TEAM'
        ? `${home} beat ${away} ${ftH}–${ftA}`
        : `${away} beat ${home} ${ftH}–${ftA}`;

    faqs.push({
      q: `What was the ${home} vs ${away} result?`,
      a: `${resultLine} in ${comp}${md} on ${dateStr}.`,
    });

    faqs.push({
      q: `Who won ${home} vs ${away}?`,
      a: match.score.winner === 'DRAW'
        ? `The match ended in a ${ftH}–${ftA} draw — neither side took all three points.`
        : match.score.winner === 'HOME_TEAM'
        ? `${home} won the match ${ftH}–${ftA}.`
        : `${away} won the match ${ftH}–${ftA}.`,
    });

    const goals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
    if (goals.length > 0) {
      const scorerLines = goals
        .map((g) => `${g.scorer?.name} ${g.minute}'${g.injuryTime ? `+${g.injuryTime}` : ''} (${g.team?.id === match.homeTeam.id ? homeS : awayS})`)
        .join('; ');
      faqs.push({
        q: `Who scored in ${home} vs ${away}?`,
        a: `Goals: ${scorerLines}.`,
      });
    } else if (ftH + ftA > 0) {
      // Score is non-zero but no goal events are available (enrichment missing
      // or not yet applied). NEVER claim "goalless" — that would be false. (DATA-15C.1)
      faqs.push({
        q: `Who scored in ${home} vs ${away}?`,
        a: `${home} ${ftH}–${ftA} ${away}. Detailed scorer information is currently unavailable for this match.`,
      });
    } else {
      faqs.push({
        q: `Were there any goals in ${home} vs ${away}?`,
        a: `The match ended goalless (0–0).`,
      });
    }

    faqs.push({
      q: `When and where was ${home} vs ${away} played?`,
      a: match.venue
        ? `The match took place at ${match.venue} on ${dateStr}.`
        : `The match took place on ${dateStr}.`,
    });
  }

  // ── H2H (any status, if data available) ────────────────────────────────────
  if (h2h?.aggregates?.numberOfMatches) {
    const total  = h2h.aggregates.numberOfMatches;
    const hWins  = h2h.aggregates.homeTeam.wins;
    const aWins  = h2h.aggregates.awayTeam.wins;
    const draws  = h2h.aggregates.homeTeam.draws;
    faqs.push({
      q: `What are the head-to-head stats between ${home} and ${away}?`,
      a: `Across ${total} meetings, ${homeS} have won ${hWins} time${hWins === 1 ? '' : 's'}, ${awayS} have won ${aWins} time${aWins === 1 ? '' : 's'}, and ${draws} match${draws === 1 ? '' : 'es'} ended in a draw. A total of ${h2h.aggregates.totalGoals} goals have been scored across all encounters.`,
    });
  }

  return faqs;
}

/** JSON-LD only — no visible output */
function MatchFaqJsonLd({ faqs }: { faqs: Faq[] }) {
  if (!faqs.length) return null;
  const schema = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name:    q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** Visible FAQ section — satisfies Google's requirement that FAQ content be
 *  user-visible, not schema-only */
function MatchFaqSection({ faqs }: { faqs: Faq[] }) {
  if (!faqs.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
        Match FAQ
      </h2>
      <dl className="space-y-4">
        {faqs.map(({ q, a }, i) => (
          <div
            key={i}
            className={`${i < faqs.length - 1 ? 'border-b border-gray-800 pb-4' : ''}`}
          >
            <dt className="text-sm font-semibold text-white mb-1.5">{q}</dt>
            <dd className="text-sm text-gray-400 leading-relaxed">{a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspense skeleton components
// ---------------------------------------------------------------------------

function HeadToHeadSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-28 bg-gray-700 rounded mb-4" />
      <div className="h-2 bg-gray-800 rounded mb-3" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-5 w-12 bg-gray-800 rounded" />
            <div className="h-5 flex-1 bg-gray-800 rounded" />
            <div className="h-5 w-6 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WCGroupSectionSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
          <div className="h-3 w-32 bg-gray-700 rounded mb-4" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-8 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deferred async server components (rendered inside Suspense boundaries)
// These call getOrBuildMatchSnapshot — which may trigger provider fetches.
// They stream in AFTER the score hero renders from the fast-path getMatchDetail.
// ---------------------------------------------------------------------------

/**
 * Streams in the Head-to-Head section once the snapshot resolves.
 * React.cache() ensures getOrBuildMatchSnapshot is called only once per render
 * even if WCGroupSectionDeferred also calls it.
 */
async function HeadToHeadDeferred({
  matchId,
  match,
}: {
  matchId: string;
  match: MatchDetail;
}) {
  try {
    const snapshot = await getOrBuildMatchSnapshot(matchId);
    if (!snapshot.headToHead) return null;
    return <HeadToHeadSection h2h={snapshot.headToHead} match={snapshot.match} />;
  } catch {
    return null; // graceful degradation — section omitted if snapshot unavailable
  }
}

/**
 * Streams in WC group-stage sections (standings preview, other group matches,
 * related matches, next/prev navigation) once the snapshot resolves.
 */
async function WCGroupSectionDeferred({
  matchId,
  match,
}: {
  matchId: string;
  match: MatchDetail;
}) {
  const isWC = match.competition?.code === 'WC';
  if (!isWC) return null;

  try {
    const snapshot     = await getOrBuildMatchSnapshot(matchId);
    const sm           = snapshot.match; // use snapshot's match for consistency
    const hasGroup     = Boolean(sm.group);
    const wcGroupTable = getGroupTable(snapshot);
    const groupMatches = snapshot.wcGroupMatches;
    const allMatches   = snapshot.wcAllMatches;
    const groupSlug    = sm.group ? sm.group.toLowerCase().replace(/[\s_]+/g, '-') : null;
    const groupLabel   = sm.group ? sm.group.replace('GROUP_', 'Group ') : null;

    return (
      <>
        {hasGroup && wcGroupTable && groupSlug && groupLabel && (
          <GroupStandingsPreview
            table={wcGroupTable}
            apiGroup={sm.group!}
            groupSlug={groupSlug}
            groupLabel={groupLabel}
          />
        )}
        {hasGroup && (
          <OtherGroupMatches
            groupMatches={groupMatches}
            currentId={sm.id}
          />
        )}
        <RelatedMatches
          homeTeamId={sm.homeTeam.id}
          awayTeamId={sm.awayTeam.id}
          competitionName={sm.competition?.name ?? 'World Cup 2026'}
          matches={allMatches}
          currentId={sm.id}
        />
        {hasGroup && (
          <NextPrevNav
            allGroupMatches={groupMatches}
            currentId={sm.id}
          />
        )}
      </>
    );
  } catch {
    return null; // graceful degradation
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MatchDetailPage({ params }: Params) {
  const { id: slug } = await params;

  // Extract the numeric ID from either "537327" or "537327-mexico-vs-south-africa"
  const numericId = extractMatchId(slug);
  if (!numericId) {
    // Completely non-numeric segment — treat as unavailable
    console.error(`[MatchPage] Non-numeric slug: ${slug}`);
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Match' }]} />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🔍</div>
          <h1 className="text-white font-bold text-lg">Match Not Found</h1>
          <p className="text-gray-400 text-sm">This match URL is invalid.</p>
          <Link href="/schedule" className="text-sm text-green-400 hover:text-green-300 transition-colors">Browse schedule</Link>
        </div>
      </div>
    );
  }

  // ── PERF-4: Snapshot-first (Phases 2, 3, 7) ──────────────────────────────
  //
  // Sequence (post-PERF-4):
  //   generateMetadata()  ───┐
  //   MatchDetailPage()   ───┤→ getOrBuildMatchSnapshot(id)  ← React.cache() dedup
  //   HeadToHeadDeferred  ───┤      │
  //   WCGroupDeferred     ───┘      ├─ 1. KV snapshot hit → instant (~10 ms)
  //                                 ├─ 2. KV detail hit → buildSnapshot, 0 provider
  //                                 ├─ 3. Static WC fallback for group fixtures
  //                                 └─ 4. Provider (last resort only)
  //
  // All four callers share the same React.cache() promise — work runs exactly once.
  // Score hero renders from snapshot.match; Suspense boundaries get H2H + WC data
  // from the same snapshot at near-zero cost.
  //
  // Provider is NEVER called when the KV snapshot is warm (prewarm-seeded on
  // every orchestrator run, TTL: upcoming=6h, finished=7d).

  // PERF-4 Phase 2/3: snapshot-first — single KV read serves score hero +
  // H2H + WC group sections.  React.cache() means generateMetadata already
  // populated this promise; the await here returns instantly on warm cache.
  //
  // Priority: KV snapshot → KV detail (no SWR trigger) → static WC → provider
  let snapshot: MatchSnapshot | null = null;
  type MatchError = 'not_found' | 'unavailable' | null;
  let matchError: MatchError = null;

  const _statsBefore = getDataSourceStats();
  const _t0          = Date.now();

  try {
    snapshot = await getOrBuildMatchSnapshot(numericId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof NotFoundError) {
      console.error(`[MatchPage] id=${numericId} not found`);
      matchError = 'not_found';
    } else {
      console.error(`[MatchPage] id=${numericId} temporarily unavailable:`, errMsg);
      matchError = 'unavailable';
    }
  }

  // Redirect old numeric-only URLs to the canonical slug URL.
  // GEO-1 fix: this must live OUTSIDE the try block — redirect() works by
  // throwing NEXT_REDIRECT, which the catch above was swallowing and turning
  // into the "Match Details Unavailable" card for every bare /match/{id} URL.
  // PROJECTED matches redirect to /match/{id}-tbd-vs-tbd to avoid slot-label slugs.
  if (snapshot && slug === numericId) {
    const m     = snapshot.match;
    const state = deriveMatchPageState(m);
    const home  = state === 'PROJECTED' ? null : m.homeTeam.name;
    const away  = state === 'PROJECTED' ? null : m.awayTeam.name;
    redirect(matchPath(m.id, home, away));
  }

  // ── Performance logging ──────────────────────────────────────────────────
  const _latencyMs   = Date.now() - _t0;
  const _statsAfter  = getDataSourceStats();
  const _renderSource: MatchRenderSource =
    _statsAfter.footballDataHits > _statsBefore.footballDataHits ? 'football-data' :
    _statsAfter.apiFootballHits  > _statsBefore.apiFootballHits  ? 'api-football'  :
    _statsAfter.kvHits           > _statsBefore.kvHits           ? 'kv'            : 'l1';

  console.log(`[MATCH_RENDER] ${_renderSource} | matchId=${numericId} | ms=${_latencyMs}`);
  console.log(`[MATCH_LATENCY] ms=${_latencyMs} | matchId=${numericId} | source=${_renderSource}`);
  recordMatchRender(_renderSource, _latencyMs);

  if (matchError || !snapshot) {
    const isNotFound = matchError === 'not_found';
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Match' }]} />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl" aria-hidden="true">{isNotFound ? '🔍' : '⚽'}</div>
          <h1 className="text-white font-bold text-lg">
            {isNotFound ? 'Match Not Found' : 'Match Details Unavailable'}
          </h1>
          <p className="text-gray-400 text-sm">
            {isNotFound
              ? 'This match could not be found. It may have been removed or the link may be incorrect.'
              : 'Match data is temporarily unavailable. Please try again in a few moments.'}
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/world-cup-2026" className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors">
              World Cup hub
            </Link>
            <Link href="/schedule" className="text-sm text-green-400 hover:text-green-300 transition-colors">
              Browse schedule
            </Link>
            <Link href="/live" className="text-sm text-gray-400 hover:text-white transition-colors">
              Live scores
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // match is always non-null here (error guard above exits otherwise)
  // DATA-18WC.RUNTIME.TRUTH Phase 2: derive MatchRuntimeState once — all sub-components
  // read version, pageState, storyContext from this object, never re-derive.
  const runtimeState   = deriveRuntimeState(snapshot);
  const match          = runtimeState.match;
  const pageState      = runtimeState.pageState;
  const matchVersion   = runtimeState.version;
  const effectiveScore = runtimeState.effectiveScore;

  // ── Data derived from snapshot (score hero, events, report) ─────────────
  const isWC     = match.competition?.code === 'WC';
  const hasGroup = Boolean(match.group);

  // Group slug/label derived from match detail — no snapshot needed
  const matchGroupSlug  = match.group ? match.group.toLowerCase().replace(/[\s_]+/g, '-') : null;
  const matchGroupLabel = match.group ? match.group.replace('GROUP_', 'Group ') : null;

  const hasEvents =
    (match.goals?.length ?? 0) > 0 ||
    (match.bookings?.length ?? 0) > 0 ||
    (match.substitutions?.length ?? 0) > 0;

  const showStats = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);

  // FAQs built from match detail only (no H2H — that data is in deferred Suspense).
  // The H2H FAQ entry is excluded here; the H2H section itself streams in separately.
  const faqs = buildFaqs(match, null, effectiveScore);

  return (
    <>
      {/* PERF-8 Phase 4: click→content-visible telemetry beacon */}
      <MatchNavTelemetry matchId={numericId} />
      <JsonLd match={match} effectiveScore={effectiveScore} />
      <MatchFaqJsonLd faqs={faqs} />
      <AnalyticsTracker event={{
        type:        'match_view',
        matchId:     match.id,
        homeTeam:    match.homeTeam?.name ?? '',
        awayTeam:    match.awayTeam?.name ?? '',
        competition: match.competition?.code ?? '',
        status:      match.status,
      }} />

      {/* data-match-version: Phase 5 runtime version embedding.
          Allows check-runtime-version.mjs to verify all components show the same version.
          Value = Unix seconds derived from snapshot.generatedAt. */}
      <div className="max-w-2xl mx-auto space-y-4 pb-10" data-match-version={matchVersion} data-match-id={match.id}>
        {/* Breadcrumb: Home > WC 2026 > Group A > Match */}
        <Breadcrumb items={buildBreadcrumb(match)} />

        {/* Accessibility + SEO: every match page needs exactly one <h1>.
            Visually hidden — the ScoreHero is the visual heading. */}
        <h1 className="sr-only">
          {(match.homeTeam.name ?? 'TBD')} vs {(match.awayTeam.name ?? 'TBD')}
          {match.competition?.code === 'WC' ? ' — FIFA World Cup 2026' : match.competition?.name ? ` — ${match.competition.name}` : ''}
        </h1>

        {/* State-driven hero — ONE VIEW MODEL → MANY STATES */}
        {pageState === 'PROJECTED' ? (
          <ProjectedHero match={match} />
        ) : pageState === 'CANCELLED' ? (
          <CancelledHero match={match} />
        ) : (
          <ScoreHero
            match={match}
            effectiveScore={effectiveScore}
            centerSlot={
              pageState === 'LIVE' ? (
                <MatchLiveZone
                  matchId={String(match.id)}
                  initialStatus={match.status}
                  initialEffectiveScore={effectiveScore}
                  initialMinute={match.minute ?? null}
                  initialVersion={matchVersion}
                />
              ) : undefined
            }
          />
        )}

        {/* ── Above-fold revenue funnel (WC only, not for cancelled) ──────── */}
        {isWC && pageState !== 'CANCELLED' && <WCAboveFoldCTA matchId={match.id} />}

        {/* Ad: below score hero — high visibility placement */}
        <AdSlot slotId="match-top" variant="banner" />

        {/* ── PERF-11: everything below the fold streams independently ──────
            BelowTheFoldDeferred awaits the same React.cache-memoised snapshot,
            so on warm renders it resolves in the same flush; on dynamic/MISS
            renders the hero block above flushes FIRST while this subtree is
            still rendering server-side. */}
        <Suspense fallback={<BelowFoldSkeleton />}>
          <BelowTheFoldDeferred matchId={numericId} effectiveScore={effectiveScore} />
        </Suspense>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PERF-11: below-the-fold subtree — streamed behind Suspense
// ---------------------------------------------------------------------------

/**
 * Defers client paint cost until the section nears the viewport.
 * content-visibility keeps the HTML fully present (SEO-safe, no JS) while
 * letting the browser skip layout/paint for offscreen content.
 */
function LazySection({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_600px]">
      {children}
    </div>
  );
}

function BelowFoldSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl h-40" />
      <div className="bg-gray-900 border border-gray-800 rounded-2xl h-64" />
      <div className="bg-gray-900 border border-gray-800 rounded-2xl h-48" />
    </div>
  );
}

async function BelowTheFoldDeferred({ matchId, effectiveScore }: { matchId: string; effectiveScore: EffectiveScore | null }) {
  // Same memoised promise as the page body — never a second fetch.
  const snapshot = await getOrBuildMatchSnapshot(matchId);
  const match    = snapshot.match;
  const pageState = deriveMatchPageState(match);

  const isWC            = match.competition?.code === 'WC';
  const matchGroupSlug  = match.group ? match.group.toLowerCase().replace(/[\s_]+/g, '-') : null;
  const matchGroupLabel = match.group ? match.group.replace('GROUP_', 'Group ') : null;

  // PROJECTED: dedicated template — no events, no H2H, no report
  if (pageState === 'PROJECTED') {
    return (
      <ProjectedContent
        match={match}
        matchGroupSlug={matchGroupSlug}
        matchGroupLabel={matchGroupLabel}
      />
    );
  }

  // CANCELLED: minimal content — no events, no H2H, no report
  if (pageState === 'CANCELLED') {
    return (
      <>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          {sectionTitle('Match Information')}
          <p className="text-sm text-gray-400 text-center py-4">
            This match was cancelled or suspended. No result was recorded.
          </p>
          {match.venue && (
            <p className="text-xs text-gray-500 text-center">Scheduled venue: {match.venue}</p>
          )}
        </div>
        {isWC && (
          <WCNavBox
            groupSlug={matchGroupSlug}
            groupLabel={matchGroupLabel}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}
        <AdSlot slotId="match-bottom" variant="banner" />
      </>
    );
  }

  const hasEvents =
    (match.goals?.length ?? 0) > 0 ||
    (match.bookings?.length ?? 0) > 0 ||
    (match.substitutions?.length ?? 0) > 0;
  const showStats = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);
  const faqs = buildFaqs(match, null, effectiveScore);

  // Story cards — pure derivation from match data, no I/O
  const storyCards = buildStoryCards(match);

  return (
    <>
      {/* ── Story Cards — auto-generated narrative chips ───────────────────── */}
      {storyCards.length > 0 && (
        <StoryCardStrip cards={storyCards} />
      )}

      <LazySection>
        {showStats && (
          <MatchSummary match={match} effectiveScore={effectiveScore} />
        )}

        {/* ── Match Timeline — unified chronological event spine ─────────── */}
        {hasEvents && <MatchTimeline match={match} />}

        {(pageState === 'QUALIFIED' || pageState === 'PRE_MATCH' || pageState === 'LIVE' || pageState === 'FINISHED') && (
          <MatchReport match={match} />
        )}

        {/* ── Road to Final — WC knockout only ────────────────────────────── */}
        {isWC && <RoadToFinal match={match} />}

        {/* ── Mid-content revenue funnel (WC only) ────────────────────────── */}
        {isWC && <WCMidFunnel />}
      </LazySection>

      <LazySection>
        {showStats && hasEvents && <MatchStatistics match={match} />}

        <GoalsSection match={match} />

        <BookingsSection match={match} />

        <SubstitutionsSection match={match} />

        <LineupsSection match={match} />
      </LazySection>

      {/* Head-to-head — deferred: streams in after snapshot resolves. */}
      <Suspense fallback={<HeadToHeadSkeleton />}>
        <HeadToHeadDeferred matchId={matchId} match={match} />
      </Suspense>

      <LazySection>
        {/* FAQ — visible Q&A section + FAQPage JSON-LD for rich snippets */}
        <MatchFaqSection faqs={faqs} />

        {/* Ad: mid-page — between FAQ and group content */}
        <AdSlot slotId="match-mid" variant="rectangle" className="mx-auto" />
      </LazySection>

      {/* WC group sections — deferred: group standings, other matches, related, next/prev.
          All resolved from the same getOrBuildMatchSnapshot call (React.cache dedup). */}
      {isWC && (
        <Suspense fallback={<WCGroupSectionSkeleton />}>
          <WCGroupSectionDeferred matchId={matchId} match={match} />
        </Suspense>
      )}

      <LazySection>
        {/* WC navigation box (replaces generic CompetitionLinks for WC matches) */}
        {isWC
          ? <WCNavBox groupSlug={matchGroupSlug} groupLabel={matchGroupLabel} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          : <CompetitionLinks match={match} />
        }

        {/* ── Bottom revenue funnel (WC only) ─────────────────────────────── */}
        {isWC && (
          <WCBottomFunnel
            match={match}
            matchGroupSlug={matchGroupSlug}
            matchGroupLabel={matchGroupLabel}
          />
        )}

        {/* Push notifications — WC matches only */}
        {isWC && (
          <PushNotificationButton
            variant="button"
            matchId={String(match.id)}
            matchLabel={`${match.homeTeam?.name ?? ''} vs ${match.awayTeam?.name ?? ''}`}
          />
        )}

        {/* Newsletter — contextual copy for WC vs non-WC matches */}
        <NewsletterSignup
          source="match-page"
          variant="inline"
          heading={
            isWC
              ? 'Get World Cup 2026 alerts'
              : `Get ${match.competition?.name ?? 'football'} updates`
          }
        />

        {/* Ad: bottom of page */}
        <AdSlot slotId="match-bottom" variant="banner" />
      </LazySection>
    </>
  );
}
