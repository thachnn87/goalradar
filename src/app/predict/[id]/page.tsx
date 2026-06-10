/**
 * /predict/[id] — Match prediction landing page.
 *
 * URL format: /predict/{matchId}-{home-slug}-vs-{away-slug}
 *   e.g.  /predict/537327-france-vs-england
 *
 * If the segment contains only a numeric ID (no slugified team names),
 * we fetch the match and redirect to the canonical slug URL.
 *
 * Data flow (server-only, SSR):
 *   1. getMatchDetail(numericId)          — sequential (need team IDs)
 *   2. getHeadToHead(numericId)           — parallel
 *      getTeamMatches(homeTeamId)         — parallel
 *      getTeamMatches(awayTeamId)         — parallel
 *
 * All prediction logic lives in src/lib/prediction.ts (pure functions,
 * no API calls, deterministic).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getTeamMatchesCached as getTeamMatches } from '@/lib/api';
import { getOrBuildMatchSnapshot } from '@/lib/match-snapshot';
import {
  extractForm,
  computeProbabilities,
  predictScore,
  confidenceLevel,
  toDecimalOdds,
  teamResult,
  type FormRecord,
  type WinProbabilities,
  type ScorePrediction,
  type ConfidenceLevel,
} from '@/lib/prediction';
import { extractMatchId, predictPath, matchPath, teamPath } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';
import AffiliateBlock from '@/components/AffiliateBlock';
import type { HeadToHead, Match, MatchDetail, Team } from '@/lib/types';

// Revalidate every hour — predictions don't need real-time updates.
export const revalidate = 3600;

const BASE_URL = 'https://goalradar.org';

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Per-request deduplication
// getOrBuildMatchSnapshot is already wrapped with React.cache() internally:
// generateMetadata and the page component share a single snapshot fetch.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: slug } = await params;
  const numericId = extractMatchId(slug);
  if (!numericId) return { title: 'Match Prediction | GoalRadar' };

  try {
    const { match } = await getOrBuildMatchSnapshot(numericId);
    const home  = match.homeTeam?.name ?? 'TBD';
    const away  = match.awayTeam?.name ?? 'TBD';
    const comp  = match.competition?.name ?? 'Football';
    const isWC  = match.competition?.code === 'WC';

    const title = `${home} vs ${away} Prediction — Score, H2H & Win Probability | GoalRadar`;
    const description =
      `${home} vs ${away} match prediction: expected score, win probability, head-to-head record, recent form and betting odds analysis. ${isWC ? 'FIFA World Cup 2026.' : comp + '.'}`;

    const canonical = `${BASE_URL}${predictPath(match.id, home, away)}`;

    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: { title, description, type: 'article', url: canonical },
      twitter:   { card: 'summary_large_image', title, description },
    };
  } catch {
    return { title: 'Match Prediction | GoalRadar' };
  }
}

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

function SportsEventJsonLd({ match }: { match: MatchDetail }) {
  const home = match.homeTeam?.name ?? 'TBD';
  const away = match.awayTeam?.name ?? 'TBD';
  const schema = {
    '@context':  'https://schema.org',
    '@type':     'SportsEvent',
    name:        `${home} vs ${away}`,
    sport:       'Football',
    startDate:   match.utcDate,
    url:         `${BASE_URL}${matchPath(match.id, home, away)}`,
    location:    { '@type': 'Place', name: match.venue ?? match.competition?.name ?? 'TBD' },
    organizer:   match.competition?.code === 'WC'
      ? { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' }
      : { '@type': 'Organization', name: match.competition?.name ?? 'Football Association' },
    homeTeam:    { '@type': 'SportsTeam', name: home },
    awayTeam:    { '@type': 'SportsTeam', name: away },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

function ArticleJsonLd({
  match,
  probs,
  score,
}: {
  match:  MatchDetail;
  probs:  WinProbabilities;
  score:  ScorePrediction;
}) {
  const home = match.homeTeam?.name ?? 'TBD';
  const away = match.awayTeam?.name ?? 'TBD';
  const url  = `${BASE_URL}${predictPath(match.id, home, away)}`;
  const schema = {
    '@context':        'https://schema.org',
    '@type':           'Article',
    headline:          `${home} vs ${away} Prediction: ${score.home}-${score.away} — Win Probability & H2H`,
    description:       `Statistical prediction for ${home} vs ${away}. Predicted score ${score.home}-${score.away}. Home win probability ${probs.home}%, Draw ${probs.draw}%, Away win ${probs.away}%.`,
    url,
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    about:     { '@type': 'SportsEvent', name: `${home} vs ${away}`, startDate: match.utcDate },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

function FaqJsonLd({ faqs }: { faqs: { q: string; a: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

// ---------------------------------------------------------------------------
// FAQ generator — static content derived from match + prediction data
// ---------------------------------------------------------------------------

function buildFaqs(
  match:  MatchDetail,
  probs:  WinProbabilities,
  score:  ScorePrediction,
  h2h:    HeadToHead | null,
  isWC:   boolean,
): { q: string; a: string }[] {
  const home   = match.homeTeam?.name ?? 'TBD';
  const away   = match.awayTeam?.name ?? 'TBD';
  const comp   = match.competition?.name ?? 'football';
  const isPast = match.status === 'FINISHED';

  const matchDate = new Date(match.utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const matchTime = new Date(match.utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  // Winner label for probability question
  const likelyWinner =
    probs.home > probs.away
      ? home
      : probs.away > probs.home
      ? away
      : 'either side';
  const drawNote = probs.draw >= 25 ? ` A draw (${probs.draw}%) is also a realistic outcome.` : '';

  // H2H text
  let h2hText = 'No head-to-head data is available between these teams.';
  if (h2h && h2h.aggregates.numberOfMatches > 0) {
    const t = h2h.aggregates.numberOfMatches;
    const hw = h2h.aggregates.homeTeam.wins;
    const aw = h2h.aggregates.awayTeam.wins;
    const d  = t - hw - aw;
    h2hText = `In ${t} previous meetings, ${home} have won ${hw}, ${away} have won ${aw}, and ${d} ended in a draw. The two sides have produced an average of ${(h2h.aggregates.totalGoals / t).toFixed(1)} goals per game.`;
  }

  return [
    {
      q: `Who will win ${home} vs ${away}?`,
      a: isPast
        ? `This match has already been played. Check the match result page for the full-time score and match report.`
        : `Our statistical model gives ${home} a ${probs.home}% chance of winning, a draw ${probs.draw}%, and ${away} a ${probs.away}% chance. ${likelyWinner !== 'either side' ? `${likelyWinner} are the slight favourites based on recent form and head-to-head record.` : 'This is a closely contested match where either side could win.'}${drawNote}`,
    },
    {
      q: `What is the predicted score for ${home} vs ${away}?`,
      a: isPast
        ? `This match has been played. See the result page for the full-time score.`
        : `Our model predicts a scoreline of ${home} ${score.home}–${score.away} ${away}. This is based on each team's recent goal-scoring and defensive record over their last five matches, blended with head-to-head historical data.`,
    },
    {
      q: `What is the head-to-head record between ${home} and ${away}?`,
      a: h2hText,
    },
    {
      q: `When and where is ${home} vs ${away}?`,
      a: `${home} vs ${away} takes place on ${matchDate} at ${matchTime} UTC${match.venue ? ` at ${match.venue}` : ''}. The match is part of the ${comp}.`,
    },
    {
      q: `What are the odds for ${home} vs ${away}?`,
      a: isPast
        ? `This match has been played. Odds are no longer available.`
        : `Based on our statistical model, the implied odds are: ${home} win ${toDecimalOdds(probs.home)}, Draw ${toDecimalOdds(probs.draw)}, ${away} win ${toDecimalOdds(probs.away)}. These are model-derived estimates, not bookmaker prices. Always compare with official bookmakers and gamble responsibly.`,
    },
    {
      q: `Where can I watch ${home} vs ${away} live?`,
      a: isWC
        ? `You can find broadcast information for FIFA World Cup 2026 matches on our live stream guide at goalradar.org/world-cup-2026-live-stream. Coverage varies by country.`
        : `Check our live scores page at goalradar.org/live for the latest match information. Broadcast rights vary by country and competition.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {children}
    </h2>
  );
}

// ── Match info strip ────────────────────────────────────────────────────────

function MatchInfoStrip({ match }: { match: MatchDetail }) {
  const matchDate = new Date(match.utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const matchTime = new Date(match.utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const statusLabel =
    match.status === 'FINISHED'   ? 'Full Time'
    : match.status === 'IN_PLAY'  ? 'Live Now'
    : match.status === 'PAUSED'   ? 'Half Time'
    : null;

  const ftHome = match.score?.fullTime?.home;
  const ftAway = match.score?.fullTime?.away;
  const hasScore = match.status === 'FINISHED' && ftHome != null && ftAway != null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center space-y-3">
      <Link
        href={`/competition/${match.competition?.code}`}
        className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-medium"
      >
        {match.competition?.name}
        {match.matchday ? ` · Matchday ${match.matchday}` : ''}
      </Link>

      {/* Teams row */}
      <div className="grid grid-cols-3 items-center gap-4 pt-1">
        <Link
          href={teamPath(match.homeTeam.id, match.homeTeam.name)}
          className="text-center group"
        >
          {match.homeTeam.crest && (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.name}
              width={56}
              height={56}
              className="object-contain mx-auto mb-2 group-hover:opacity-80 transition-opacity"
            />
          )}
          <p className="text-white font-bold text-sm leading-tight group-hover:text-green-400 transition-colors">
            {match.homeTeam.shortName || match.homeTeam.name}
          </p>
          <p className="text-gray-600 text-[10px] mt-0.5">Home</p>
        </Link>

        <div className="text-center">
          {hasScore ? (
            <>
              <div className="text-3xl font-black text-white tabular-nums">
                {ftHome}
                <span className="text-gray-600 mx-1">–</span>
                {ftAway}
              </div>
              {statusLabel && (
                <span className="text-xs text-gray-500 font-semibold">{statusLabel}</span>
              )}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-600">vs</div>
              {statusLabel && (
                <span className="text-xs text-red-400 font-bold">{statusLabel}</span>
              )}
            </>
          )}
        </div>

        <Link
          href={teamPath(match.awayTeam.id, match.awayTeam.name)}
          className="text-center group"
        >
          {match.awayTeam.crest && (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.name}
              width={56}
              height={56}
              className="object-contain mx-auto mb-2 group-hover:opacity-80 transition-opacity"
            />
          )}
          <p className="text-white font-bold text-sm leading-tight group-hover:text-green-400 transition-colors">
            {match.awayTeam.shortName || match.awayTeam.name}
          </p>
          <p className="text-gray-600 text-[10px] mt-0.5">Away</p>
        </Link>
      </div>

      <p className="text-xs text-gray-500 pt-1">
        {matchDate} · {matchTime} UTC
        {match.venue ? ` · ${match.venue}` : ''}
      </p>

      {/* Link to full match page */}
      <Link
        href={matchPath(match.id, match.homeTeam.name, match.awayTeam.name)}
        className="inline-block text-xs text-green-400 hover:text-green-300 transition-colors font-medium"
      >
        View full match page →
      </Link>
    </div>
  );
}

// ── Predicted score ─────────────────────────────────────────────────────────

function PredictedScoreSection({
  homeTeam,
  awayTeam,
  score,
  confidence,
}: {
  homeTeam:   Team;
  awayTeam:   Team;
  score:      ScorePrediction;
  confidence: ConfidenceLevel;
}) {
  const confidenceConfig: Record<ConfidenceLevel, { label: string; color: string }> = {
    high:   { label: 'High confidence',   color: 'text-green-400' },
    medium: { label: 'Medium confidence', color: 'text-yellow-400' },
    low:    { label: 'Low confidence',    color: 'text-gray-500' },
  };
  const conf = confidenceConfig[confidence];

  return (
    <section aria-labelledby="prediction-heading">
      <SectionHeading>Predicted Score</SectionHeading>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-4">
        <p className="text-gray-400 text-sm">Our statistical model predicts:</p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1 truncate max-w-[80px]">
              {homeTeam.shortName || homeTeam.name}
            </p>
            <p className="text-5xl font-black text-white tabular-nums">{score.home}</p>
          </div>
          <p className="text-gray-600 text-2xl font-bold">–</p>
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-1 truncate max-w-[80px]">
              {awayTeam.shortName || awayTeam.name}
            </p>
            <p className="text-5xl font-black text-white tabular-nums">{score.away}</p>
          </div>
        </div>
        <p className={`text-xs font-semibold ${conf.color}`}>
          {conf.label}
        </p>
        <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
          Based on each team's recent goals scored and conceded over their last five matches,
          blended with historical head-to-head data where available.
        </p>
      </div>
    </section>
  );
}

// ── Win probability ─────────────────────────────────────────────────────────

function WinProbabilitySection({
  homeTeam,
  awayTeam,
  probs,
}: {
  homeTeam: Team;
  awayTeam: Team;
  probs:    WinProbabilities;
}) {
  const homeName = homeTeam.shortName || homeTeam.name;
  const awayName = awayTeam.shortName || awayTeam.name;

  return (
    <section aria-labelledby="probability-heading">
      <SectionHeading>Win Probability</SectionHeading>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">

        {/* Three-column percentage display */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-green-400 text-2xl font-black">{probs.home}%</p>
            <p className="text-gray-400 text-xs mt-1 truncate">{homeName} Win</p>
          </div>
          <div>
            <p className="text-gray-300 text-2xl font-black">{probs.draw}%</p>
            <p className="text-gray-400 text-xs mt-1">Draw</p>
          </div>
          <div>
            <p className="text-orange-400 text-2xl font-black">{probs.away}%</p>
            <p className="text-gray-400 text-xs mt-1 truncate">{awayName} Win</p>
          </div>
        </div>

        {/* Probability bar */}
        <div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${probs.home}%` }}
              title={`${homeName} win: ${probs.home}%`}
            />
            <div
              className="bg-gray-600 transition-all"
              style={{ width: `${probs.draw}%` }}
              title={`Draw: ${probs.draw}%`}
            />
            <div
              className="bg-orange-500 transition-all"
              style={{ width: `${probs.away}%` }}
              title={`${awayName} win: ${probs.away}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1.5">
            <span>{homeName}</span>
            <span>Draw</span>
            <span>{awayName}</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 text-center leading-relaxed">
          Probabilities are derived from recent form and historical H2H data.
          They represent statistical estimates, not guaranteed outcomes.
        </p>
      </div>
    </section>
  );
}

// ── Recent form ─────────────────────────────────────────────────────────────

function FormBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const cfg = {
    W: 'bg-green-500/20 text-green-400 border border-green-500/30',
    D: 'bg-gray-700 text-gray-300 border border-gray-600',
    L: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg[result]}`}>
      {result}
    </span>
  );
}

function TeamFormCard({ team, form }: { team: Team; form: FormRecord }) {
  const name = team.shortName || team.name;
  const ppg = form.played > 0
    ? ((form.won * 3 + form.drawn) / form.played).toFixed(1)
    : '—';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {team.crest && (
            <img src={team.crest} alt="" width={24} height={24} className="object-contain shrink-0" />
          )}
          <p className="text-white font-semibold text-sm truncate">{name}</p>
        </div>
        <p className="text-gray-600 text-xs shrink-0 ml-2">
          {form.played > 0 ? `${ppg} pts/game` : 'No data'}
        </p>
      </div>

      {form.played > 0 ? (
        <>
          {/* Form string */}
          <div className="flex items-center gap-1.5">
            {form.matches.map((m, i) => (
              <FormBadge key={i} result={teamResult(m, team.id)} />
            ))}
            <span className="text-gray-600 text-[10px] ml-1">(recent →)</span>
          </div>

          {/* Mini match list */}
          <div className="space-y-1.5">
            {form.matches.map((m) => {
              const res     = teamResult(m, team.id);
              const isHome  = m.homeTeam?.id === team.id;
              const opp     = isHome ? m.awayTeam : m.homeTeam;
              const gf      = (isHome ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
              const ga      = (isHome ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
              const dateStr = new Date(m.utcDate).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              });
              return (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <FormBadge result={res} />
                  <span className="text-gray-400 flex-1 truncate">
                    {isHome ? 'vs' : '@'} {opp?.shortName || opp?.name}
                  </span>
                  <span className="text-white font-bold tabular-nums">{gf}–{ga}</span>
                  <span className="text-gray-600 w-12 text-right shrink-0">{dateStr}</span>
                </div>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="flex gap-4 pt-1 border-t border-gray-800 text-xs text-gray-500">
            <span><strong className="text-white">{form.won}</strong>W</span>
            <span><strong className="text-white">{form.drawn}</strong>D</span>
            <span><strong className="text-white">{form.lost}</strong>L</span>
            <span className="ml-auto">
              <strong className="text-white">{form.goalsFor}</strong> GF ·{' '}
              <strong className="text-white">{form.goalsAgainst}</strong> GA
            </span>
          </div>
        </>
      ) : (
        <p className="text-gray-600 text-sm">No recent match data available.</p>
      )}
    </div>
  );
}

function RecentFormSection({
  homeTeam,
  awayTeam,
  homeForm,
  awayForm,
}: {
  homeTeam: Team;
  awayTeam: Team;
  homeForm: FormRecord;
  awayForm: FormRecord;
}) {
  return (
    <section aria-labelledby="form-heading">
      <SectionHeading>Recent Form — Last 5 Matches</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamFormCard team={homeTeam} form={homeForm} />
        <TeamFormCard team={awayTeam} form={awayForm} />
      </div>
    </section>
  );
}

// ── Head to head ─────────────────────────────────────────────────────────────

function H2HSection({
  h2h,
  homeTeam,
  awayTeam,
}: {
  h2h:      HeadToHead | null;
  homeTeam: Team;
  awayTeam: Team;
}) {
  if (!h2h || h2h.aggregates.numberOfMatches === 0) {
    return (
      <section aria-labelledby="h2h-heading">
        <SectionHeading>Head to Head</SectionHeading>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center text-gray-500 text-sm">
          No head-to-head data is available for this fixture.
        </div>
      </section>
    );
  }

  const { aggregates, matches } = h2h;
  const total   = aggregates.numberOfMatches;
  const homeStat = aggregates.homeTeam;
  const awayStat = aggregates.awayTeam;
  const draws   = total - homeStat.wins - awayStat.wins;
  const gpm     = (aggregates.totalGoals / total).toFixed(1);

  const recentMeetings = [...matches]
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5);

  function resultFor(m: Match) {
    const isHome = m.homeTeam?.id === homeTeam.id;
    const w = m.score.winner;
    if (!w || w === 'DRAW') return 'D';
    if ((w === 'HOME_TEAM' && isHome) || (w === 'AWAY_TEAM' && !isHome)) return 'W';
    return 'L';
  }

  const homeName = homeTeam.shortName || homeTeam.name;
  const awayName = awayTeam.shortName || awayTeam.name;

  return (
    <section aria-labelledby="h2h-heading">
      <SectionHeading>Head to Head</SectionHeading>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-blue-400 text-2xl font-black">{homeStat.wins}</p>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{homeName} Wins</p>
          </div>
          <div>
            <p className="text-gray-300 text-2xl font-black">{draws}</p>
            <p className="text-gray-500 text-xs mt-0.5">Draws</p>
          </div>
          <div>
            <p className="text-orange-400 text-2xl font-black">{awayStat.wins}</p>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{awayName} Wins</p>
          </div>
        </div>

        {/* Win/draw/loss bar */}
        <div>
          <div className="flex h-2.5 rounded-full overflow-hidden">
            {homeStat.wins > 0 && (
              <div className="bg-blue-500" style={{ width: `${(homeStat.wins / total) * 100}%` }} />
            )}
            {draws > 0 && (
              <div className="bg-gray-600" style={{ width: `${(draws / total) * 100}%` }} />
            )}
            {awayStat.wins > 0 && (
              <div className="bg-orange-500" style={{ width: `${(awayStat.wins / total) * 100}%` }} />
            )}
          </div>
          <p className="text-center text-xs text-gray-600 mt-1.5">
            {total} meetings · {aggregates.totalGoals} total goals · {gpm} goals/game avg
          </p>
        </div>

        {/* Recent meetings */}
        {recentMeetings.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Meetings</p>
            <div className="space-y-2">
              {recentMeetings.map((m) => {
                const res     = resultFor(m);
                const dateStr = new Date(m.utcDate).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                });
                return (
                  <Link
                    key={m.id}
                    href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                    className="flex items-center gap-2 text-xs hover:bg-gray-800 rounded-lg px-2 py-1.5 transition-colors group"
                  >
                    <span className="text-gray-600 w-20 shrink-0">{dateStr}</span>
                    <span className="text-gray-300 flex-1 truncate group-hover:text-white transition-colors">
                      {m.homeTeam?.shortName || m.homeTeam?.name}
                      {' '}
                      <span className="text-white font-bold tabular-nums">
                        {m.score.fullTime.home ?? '–'} – {m.score.fullTime.away ?? '–'}
                      </span>
                      {' '}
                      {m.awayTeam?.shortName || m.awayTeam?.name}
                    </span>
                    <FormBadge result={res} />
                  </Link>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-700 mt-2 text-center">
              W/D/L shown from {homeName}'s perspective
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Betting odds block ────────────────────────────────────────────────────────

function BettingOddsSection({
  probs,
  homeTeam,
  awayTeam,
}: {
  probs:    WinProbabilities;
  homeTeam: Team;
  awayTeam: Team;
}) {
  const homeName = homeTeam.shortName || homeTeam.name;
  const awayName = awayTeam.shortName || awayTeam.name;

  const rows = [
    { label: `${homeName} Win`,   prob: probs.home,  odds: toDecimalOdds(probs.home) },
    { label: 'Draw',              prob: probs.draw,  odds: toDecimalOdds(probs.draw) },
    { label: `${awayName} Win`,   prob: probs.away,  odds: toDecimalOdds(probs.away) },
  ];

  return (
    <section aria-labelledby="odds-heading">
      <SectionHeading>Betting Odds Analysis</SectionHeading>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">

        {/* Implied odds table */}
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Implied decimal odds derived from our statistical model:
          </p>
          <div className="space-y-2">
            {rows.map(({ label, prob, odds }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-gray-300 text-sm flex-1 truncate">{label}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-8 text-right">{prob}%</span>
                  <span className="text-white font-bold text-sm w-12 text-right tabular-nums">
                    {odds}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-800 pt-4 space-y-2">
          <p className="text-xs text-gray-600 leading-relaxed">
            ⚠️ <strong className="text-gray-500">These are model-derived estimates, not bookmaker prices.</strong>{' '}
            Always compare with official licensed bookmakers. Odds fluctuate with team news,
            injuries and market movement — always check current prices before placing a bet.
          </p>
          <p className="text-xs text-gray-700">
            🔞 18+ only. Gambling can be addictive. Please play responsibly.{' '}
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 underline transition-colors"
            >
              BeGambleAware.org
            </a>
          </p>
        </div>

        {/* Affiliate slot — renders nothing until url is configured */}
        <AffiliateBlock
          title="Compare Betting Odds"
          description="Find the best odds for this match across all major bookmakers."
          cta="Compare Odds"
          url="#"
          variant="green"
        />
      </div>
    </section>
  );
}

// ── FAQ section ───────────────────────────────────────────────────────────────

function FaqSection({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="faq-heading">
      <SectionHeading>Frequently Asked Questions</SectionHeading>
      <dl className="space-y-3">
        {faqs.map(({ q, a }, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <dt className="text-sm font-semibold text-white mb-1.5">{q}</dt>
            <dd className="text-sm text-gray-400 leading-relaxed">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── Internal links ────────────────────────────────────────────────────────────

function InternalLinks({ match }: { match: MatchDetail }) {
  const isWC     = match.competition?.code === 'WC';
  const groupSlug = match.group ? match.group.toLowerCase().replace(/[\s_]+/g, '-') : null;

  type Chip = { href: string; label: string; icon: string };

  const chips: Chip[] = [
    {
      href:  matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name),
      label: 'Match Details',
      icon:  '⚽',
    },
    {
      href:  teamPath(match.homeTeam.id, match.homeTeam.name),
      label: match.homeTeam.shortName || match.homeTeam.name,
      icon:  '🏠',
    },
    {
      href:  teamPath(match.awayTeam.id, match.awayTeam.name),
      label: match.awayTeam.shortName || match.awayTeam.name,
      icon:  '✈️',
    },
    ...(match.competition?.code
      ? [{ href: `/competition/${match.competition.code}`, label: match.competition.name, icon: '🏆' }]
      : []),
    ...(isWC
      ? [
          { href: '/world-cup-2026',          label: 'WC 2026 Hub',     icon: '🌍' },
          { href: '/world-cup-2026-standings', label: 'WC Standings',   icon: '📊' },
          { href: '/world-cup-2026-results',   label: 'WC Results',     icon: '🏁' },
          ...(groupSlug
            ? [{ href: `/world-cup-2026/${groupSlug}`, label: match.group!.replace('GROUP_', 'Group '), icon: '📋' }]
            : []),
          { href: '/world-cup-2026-live-stream', label: 'Watch Live', icon: '📺' },
        ]
      : [
          { href: '/standings', label: 'All Standings', icon: '📊' },
          { href: '/schedule',  label: 'Schedule',      icon: '📅' },
          { href: '/live',      label: 'Live Scores',   icon: '🔴' },
        ]),
  ];

  return (
    <section aria-label="Related pages">
      <SectionHeading>Explore More</SectionHeading>
      <div className="flex flex-wrap gap-2">
        {chips.map(({ href, label, icon }) => (
          <Link
            key={href + label}
            href={href}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-300 hover:text-white transition-all"
          >
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PredictionPage({ params }: Params) {
  const { id: slug } = await params;
  const numericId = extractMatchId(slug);
  if (!numericId) notFound();

  // Load the composite snapshot (React.cache() deduplicates with generateMetadata).
  // The snapshot includes match detail, H2H, standings, and WC group matches.
  // Falls back to the disaster-recovery key (30-day TTL) when the API is unavailable.
  let match: MatchDetail;
  let h2h: HeadToHead | null = null;
  try {
    const snapshot = await getOrBuildMatchSnapshot(numericId);
    match = snapshot.match;
    h2h   = snapshot.headToHead;
  } catch {
    notFound();
  }

  const home = match.homeTeam?.name ?? 'TBD';
  const away = match.awayTeam?.name ?? 'TBD';

  // Redirect bare numeric slugs to canonical form
  const canonicalSlug = `${numericId}-${home.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-vs-${away.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (slug === numericId) {
    redirect(predictPath(match.id, home, away));
  }

  const isWC   = match.competition?.code === 'WC';
  const isPast = match.status === 'FINISHED';

  // Parallel: team recent matches (for form).
  // H2H is already supplied by the snapshot above.
  const [homeMatchesResult, awayMatchesResult] = await Promise.allSettled([
    getTeamMatches(String(match.homeTeam.id)),
    getTeamMatches(String(match.awayTeam.id)),
  ]);

  const homeMatches = homeMatchesResult.status === 'fulfilled' ? homeMatchesResult.value.matches : [];
  const awayMatches = awayMatchesResult.status === 'fulfilled' ? awayMatchesResult.value.matches : [];

  // Compute prediction
  const homeForm = extractForm(homeMatches, match.homeTeam.id);
  const awayForm = extractForm(awayMatches, match.awayTeam.id);
  const probs    = computeProbabilities(h2h, homeForm, awayForm);
  const score    = predictScore(h2h, homeForm, awayForm);
  const conf     = confidenceLevel(homeForm, awayForm, h2h);

  // Breadcrumb — context-aware like the match page
  const breadcrumbItems = isWC
    ? match.group
      ? [
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: match.group.replace('GROUP_', 'Group '), href: `/world-cup-2026/${match.group.toLowerCase().replace(/[\s_]+/g, '-')}` },
          { label: `${home} vs ${away} Prediction` },
        ]
      : [
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: `${home} vs ${away} Prediction` },
        ]
    : [
        { label: 'Home', href: '/' },
        {
          label: match.competition?.name ?? 'Football',
          href:  match.competition?.code ? `/competition/${match.competition.code}` : '/standings',
        },
        { label: `${home} vs ${away} Prediction` },
      ];

  const faqs = buildFaqs(match, probs, score, h2h, isWC);

  const canonical = `${BASE_URL}${predictPath(match.id, home, away)}`;

  return (
    <>
      {/* JSON-LD */}
      <SportsEventJsonLd match={match} />
      {!isPast && <ArticleJsonLd match={match} probs={probs} score={score} />}
      <FaqJsonLd faqs={faqs} />

      <div className="max-w-3xl mx-auto space-y-8 pb-12">

        <Breadcrumb items={breadcrumbItems} />

        {/* H1 */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {home} vs {away} Prediction
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isPast ? 'Post-match analysis' : 'Score prediction, win probability & H2H'}{' '}
            · {match.competition?.name}
            {isWC && ' 2026'}
          </p>
        </div>

        {/* Match info */}
        <MatchInfoStrip match={match} />

        {/* Prediction sections — only for upcoming/live matches */}
        {!isPast && (
          <>
            <PredictedScoreSection
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              score={score}
              confidence={conf}
            />
            <WinProbabilitySection
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              probs={probs}
            />
          </>
        )}

        {/* Finished match — show actual result note */}
        {isPast && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
            <p className="text-yellow-400 font-semibold text-sm">This match has been played.</p>
            <p className="text-gray-400 text-sm mt-1">
              See the{' '}
              <Link
                href={matchPath(match.id, home, away)}
                className="text-green-400 hover:text-green-300 underline transition-colors"
              >
                full match report
              </Link>{' '}
              for the result, goals and statistics.
            </p>
          </div>
        )}

        {/* Form and H2H — always shown */}
        <RecentFormSection
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homeForm={homeForm}
          awayForm={awayForm}
        />

        <H2HSection
          h2h={h2h}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
        />

        {/* Betting odds — only for upcoming/live */}
        {!isPast && (
          <BettingOddsSection
            probs={probs}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
          />
        )}

        {/* FAQ */}
        <FaqSection faqs={faqs} />

        {/* Internal links */}
        <InternalLinks match={match} />

        {/* Canonical self-reference note */}
        <p className="text-[10px] text-gray-700 text-center">
          Canonical URL:{' '}
          <a href={canonical} className="hover:text-gray-500 transition-colors">{canonical}</a>
        </p>
      </div>
    </>
  );
}
