import Link from 'next/link';
import type { Metadata } from 'next';

import { getWCResults } from '@/lib/api';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 60;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/results`;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Results – All Scores and Match Reports | GoalRadar',
  description:
    'All FIFA World Cup 2026 results with full-time scores, match reports and group stage outcomes. Follow every result from the opening match to the Final.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Results | GoalRadar',
    description: 'Complete FIFA World Cup 2026 match results — group stage and knockout rounds.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Results | GoalRadar',
    description: 'All World Cup 2026 scores and match results in one place.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ results }: { results: Match[] }) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Results',         item: PAGE_URL },
    ],
  };

  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'FIFA World Cup 2026 Results',
    description: 'All FIFA World Cup 2026 match results, scores and links to full match reports.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: results.map((m) => ({
      '@type': 'SportsEvent',
      name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
      sport: 'Football',
      startDate: m.utcDate,
      url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
      description: `Full-time: ${m.score.fullTime.home ?? '–'} – ${m.score.fullTime.away ?? '–'}`,
      superEvent: {
        '@type': 'SportsEvent',
        name: 'FIFA World Cup 2026',
        url: `${BASE_URL}/world-cup-2026`,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE:    'Group Stage',
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS:    'Semi-finals',
  THIRD_PLACE:    'Third Place Play-off',
  FINAL:          'Final',
};

function formatDayHeading(isoDate: string) {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Result row — compact, link to full match report
// ---------------------------------------------------------------------------

function ResultRow({ match }: { match: Match }) {
  const { score } = match;
  const hn    = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an    = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const hWins = score.winner === 'HOME_TEAM';
  const aWins = score.winner === 'AWAY_TEAM';
  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage.replace(/_/g, ' ');
  const groupLabel = match.group ? ` · ${match.group.replace('GROUP_', 'Group ')}` : '';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/60 transition-colors group"
    >
      {/* Stage badge */}
      <span className="text-gray-700 text-[10px] uppercase tracking-wider w-20 shrink-0 leading-tight hidden sm:block">
        {stageLabel}{groupLabel}
      </span>

      {/* Home team */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {match.homeTeam?.crest && (
          <img src={match.homeTeam.crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
        <span className={`text-sm font-semibold truncate text-right ${hWins ? 'text-white' : 'text-gray-400'}`}>
          {hn}
        </span>
      </div>

      {/* Score */}
      <div className="text-center shrink-0 w-20">
        <span className="text-white font-black tabular-nums text-base tracking-tight">
          {score.fullTime.home ?? '–'} – {score.fullTime.away ?? '–'}
        </span>
        {score.duration !== 'REGULAR' && (
          <p className="text-gray-600 text-[10px] mt-0.5">
            {score.duration === 'EXTRA_TIME' ? 'AET' : 'PSO'}
          </p>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`text-sm font-semibold truncate ${aWins ? 'text-white' : 'text-gray-400'}`}>
          {an}
        </span>
        {match.awayTeam?.crest && (
          <img src={match.awayTeam.crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
      </div>

      {/* Arrow — visible on hover */}
      <span className="text-gray-700 group-hover:text-gray-400 transition-colors text-xs shrink-0">→</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Stats summary bar
// ---------------------------------------------------------------------------

function StatsSummary({ results }: { results: Match[] }) {
  const totalGoals  = results.reduce((s, m) => s + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0), 0);
  const homeWins    = results.filter((m) => m.score.winner === 'HOME_TEAM').length;
  const draws       = results.filter((m) => m.score.winner === 'DRAW').length;
  const awayWins    = results.filter((m) => m.score.winner === 'AWAY_TEAM').length;
  const avgGoals    = results.length > 0 ? (totalGoals / results.length).toFixed(1) : '–';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Matches Played', value: String(results.length) },
        { label: 'Total Goals',    value: String(totalGoals), sub: `${avgGoals} per match` },
        { label: 'Home / Draw / Away', value: `${homeWins} / ${draws} / ${awayWins}` },
        { label: 'Clean Sheets',  value: String(results.filter((m) => (m.score.fullTime.home ?? 1) === 0 || (m.score.fullTime.away ?? 1) === 0).length) },
      ].map(({ label, value, sub }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-xl font-black text-white">{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCResultsPage() {
  let results: Match[] = [];
  try {
    const data = await getWCResults();
    results = [...data.matches].sort(
      (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
    );
  } catch {
    // graceful degradation — show empty state
  }

  const byDate = groupByDate(results);
  const dates  = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // newest first

  return (
    <>
      <JsonLd results={results} />

      <div className="max-w-3xl mx-auto space-y-8 pb-12">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Home',           href: '/' },
            { label: 'World Cup 2026', href: '/world-cup-2026' },
            { label: 'Results' },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🏁</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Results</h1>
            </div>
            <p className="text-gray-500 text-sm">
              FIFA World Cup 2026 · All match scores
            </p>
          </div>
          <Link
            href="/world-cup-2026"
            className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1"
          >
            ← World Cup Hub
          </Link>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/world-cup-2026"              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">🏆 Hub</Link>
          <Link href="/world-cup-2026/bracket"      className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">🔗 Bracket</Link>
          <Link href="/schedule?competition=WC"     className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">📅 Fixtures</Link>
          <Link href="/world-cup-2026/group-a"      className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">📊 Groups</Link>
        </div>

        {/* Stats summary */}
        {results.length > 0 && <StatsSummary results={results} />}

        {/* Results by date */}
        {results.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">🏁</div>
            <p className="text-gray-300 font-semibold text-lg">No results yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Results will appear here once the tournament kicks off on 11 June 2026.
            </p>
            <Link
              href="/schedule?competition=WC"
              className="inline-block mt-4 text-sm text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              View upcoming fixtures →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => {
              const dayMatches = byDate[date];
              // Determine the highest stage played on this date for labelling
              const stages = [...new Set(dayMatches.map((m) => m.stage))];
              const stagesLabel = stages.map((s) => STAGE_LABELS[s] ?? s.replace(/_/g, ' ')).join(' · ');

              return (
                <section key={date} aria-labelledby={`date-${date}`}>
                  {/* Date heading */}
                  <div className="flex items-baseline gap-3 mb-2">
                    <h2
                      id={`date-${date}`}
                      className="text-sm font-bold text-gray-200"
                    >
                      {formatDayHeading(date)}
                    </h2>
                    <span className="text-gray-600 text-xs">{stagesLabel}</span>
                    <span className="text-gray-700 text-xs ml-auto shrink-0">
                      {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  {/* Results card */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
                    {dayMatches.map((m) => (
                      <ResultRow key={m.id} match={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Footer links */}
        <div className="border-t border-gray-800 pt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <Link href="/world-cup-2026"          className="hover:text-white transition-colors">🏆 Tournament Hub</Link>
          <Link href="/world-cup-2026/bracket"  className="hover:text-white transition-colors">🔗 Knockout Bracket</Link>
          <Link href="/schedule?competition=WC" className="hover:text-white transition-colors">📅 Upcoming Fixtures</Link>
          <Link href="/live"                    className="hover:text-white transition-colors">🔴 Live Scores</Link>
        </div>
      </div>
    </>
  );
}
