import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getMatchDetail, getHeadToHead, getUpcomingMatches, getRecentMatches, NotFoundError } from '@/lib/api';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard from '@/components/MatchCard';
import type { BreadcrumbItem } from '@/components/Breadcrumb';
import { matchPath, extractMatchId } from '@/lib/url';
import type {
  Goal,
  Booking,
  Substitution,
  MatchDetail,
  HeadToHead,
  Match,
} from '@/lib/types';

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
    const match = await getMatchDetail(numericId);
    const home = match.homeTeam.name ?? 'TBD';
    const away = match.awayTeam.name ?? 'TBD';
    const isWC = match.competition?.code === 'WC';

    const title = isWC
      ? `${home} vs ${away} Live Score | FIFA World Cup 2026`
      : `${home} vs ${away} Live Score | GoalRadar`;

    const description = isWC
      ? `Follow ${home} vs ${away} live score, match results and World Cup 2026 updates.`
      : `Follow ${home} vs ${away} live score, lineups, stats and match events.`;

    const BASE_URL = 'https://goalradar.org';
    const canonical = `${BASE_URL}${matchPath(match.id, home, away)}`;

    return {
      title,
      description,
      alternates: { canonical },
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

function ScoreHero({ match }: { match: MatchDetail }) {
  const { score, homeTeam, awayTeam, status } = match;
  const showScore = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);
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
        <p className="text-xs text-gray-500 mt-1">{formatMatchDate(match.utcDate)}</p>
      </div>

      <div className="flex justify-center mb-6">
        <StatusPill status={status} />
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        {/* Home */}
        <Link href={`/team/${homeTeam.id}`} className="text-center group block">
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

        {/* Score */}
        <div className="text-center">
          {showScore ? (
            <>
              <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
                {score.fullTime.home ?? 0}
                <span className="text-gray-600 mx-1">–</span>
                {score.fullTime.away ?? 0}
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
        </div>

        {/* Away */}
        <Link href={`/team/${awayTeam.id}`} className="text-center group block">
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
      </div>

      {/* Venue / referee meta */}
      {(match.venue || mainRef) && (
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-gray-500">
          {match.venue && <span>📍 {match.venue}</span>}
          {mainRef && <span>🟡 Referee: {mainRef.name}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match summary
// ---------------------------------------------------------------------------

function MatchSummary({ match }: { match: MatchDetail }) {
  const { score, homeTeam, awayTeam, status } = match;

  let winner = '';
  if (status === 'FINISHED') {
    if (score.winner === 'HOME_TEAM')
      winner = homeTeam.shortName || homeTeam.name;
    else if (score.winner === 'AWAY_TEAM')
      winner = awayTeam.shortName || awayTeam.name;
    else if (score.winner === 'DRAW')
      winner = 'Draw';
  }

  const stats: { label: string; value: string }[] = [
    ...(winner ? [{ label: 'Winner', value: winner }] : []),
    {
      label: 'Full Time',
      value: `${score.fullTime.home ?? '–'} – ${score.fullTime.away ?? '–'}`,
    },
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
// Match report (SEO article, server-rendered)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Match report — structured article content
// ---------------------------------------------------------------------------

interface ReportSection {
  heading: string;
  paragraphs: string[];
}

function buildReportSections(match: MatchDetail): ReportSection[] {
  const home     = match.homeTeam.name     ?? 'The home side';
  const away     = match.awayTeam.name     ?? 'The away side';
  const homeS    = match.homeTeam.shortName || home;
  const awayS    = match.awayTeam.shortName || away;
  const comp     = match.competition?.name ?? 'the competition';
  const { score, status, matchday, stage } = match;
  const ftH      = score.fullTime.home  ?? 0;
  const ftA      = score.fullTime.away  ?? 0;
  const htH      = score.halfTime.home;
  const htA      = score.halfTime.away;
  const totalGoals = ftH + ftA;
  const isWC     = match.competition?.code === 'WC';

  const matchDate = new Date(match.utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const mdLabel = matchday ? `Matchday ${matchday}` : stage ? stage.replace(/_/g, ' ') : '';
  const mdInfix = mdLabel ? ` in ${mdLabel} of` : ' in';
  const compFull = isWC ? 'FIFA World Cup 2026' : comp;

  // ── Introduction ──────────────────────────────────────────────────────────

  let intro: string;
  if (status === 'FINISHED') {
    if (score.winner === 'HOME_TEAM') {
      intro =
        `${home} secured a ${ftH}–${ftA} victory over ${away}${mdInfix} the ${compFull} on ${matchDate}. ` +
        `The home side delivered a confident performance, taking all three points in front of their supporters ` +
        `and putting down a firm marker to the rest of the competition. ` +
        `It was a result that underlined ${homeS}'s quality and their ability to perform under pressure.`;
    } else if (score.winner === 'AWAY_TEAM') {
      intro =
        `${away} produced an impressive ${ftH}–${ftA} victory at ${home}${mdInfix} the ${compFull} on ${matchDate}. ` +
        `The visitors were clinical throughout, travelling back with three valuable points from what is always a demanding fixture. ` +
        `It was a display that highlighted ${awayS}'s strength and their credentials as genuine contenders this season.`;
    } else {
      intro =
        `${home} and ${away} shared the spoils in a ${ftH}–${ftA} draw${mdInfix} the ${compFull} on ${matchDate}. ` +
        `In a closely fought contest, neither team could find the decisive moment that would have separated the sides, ` +
        `and both will take a point from an encounter that ultimately reflected the balance between the two squads.`;
    }
  } else if (status === 'IN_PLAY' || status === 'PAUSED') {
    intro =
      `${home} are currently locked in a ${compFull} encounter against ${away} on ${matchDate}. ` +
      `The match is live and the score currently stands at ${ftH}–${ftA}${status === 'PAUSED' ? ' at half-time' : ''}. ` +
      `Both sides are competing hard for a result that could prove significant in the context of the season.`;
  } else {
    intro =
      `${home} are set to host ${away}${mdInfix} the ${compFull} on ${matchDate}. ` +
      `The fixture promises to be a compelling contest between two sides with plenty at stake. ` +
      `Both managers will have prepared their squads meticulously, knowing that the points on offer could have a real bearing on their campaign.`;
  }

  // ── First Half ─────────────────────────────────────────────────────────────

  let firstHalf: string;
  if (htH !== null && htA !== null) {
    if (htH > htA) {
      firstHalf =
        `${homeS} made a strong start to the match, taking the initiative in the opening exchanges ` +
        `and translating their dominance into a ${htH}–${htA} lead at half-time. ` +
        `Their pressing game and organisation in the final third made life difficult for the ${awayS} defence throughout the opening 45 minutes. ` +
        `The hosts went into the break with confidence, having firmly established control of the encounter.`;
    } else if (htA > htH) {
      firstHalf =
        `${awayS} were the brighter side in the opening period, working hard against a home side that struggled to impose themselves. ` +
        `Clinical in front of goal, the visitors went into the half-time break with a ${htH}–${htA} advantage. ` +
        `The first half showed ${awayS}'s composure and tactical discipline, as ${homeS} looked to find a way back into the game.`;
    } else {
      firstHalf =
        `The opening 45 minutes produced an absorbing battle with neither side able to break the deadlock, ` +
        `the teams heading into the interval level at ${htH}–${htA}. ` +
        `Both sets of players were disciplined defensively, with moments of quality at both ends of the pitch. ` +
        `The first half laid the foundation for what would be a tightly contested second period.`;
    }
  } else if (status === 'SCHEDULED' || status === 'TIMED') {
    firstHalf =
      `The first half is expected to set the tone for the match, with both ${homeS} and ${awayS} likely to probe for early openings. ` +
      `${homeS} will look to exploit their home advantage from the off, while ${awayS} will be disciplined and alert to counter-attacking opportunities. ` +
      `The tactical shape and energy in the opening 45 minutes will be crucial in determining how the game unfolds.`;
  } else {
    firstHalf =
      `The first half is currently in progress, with both teams fighting for possession and territory. ` +
      `${homeS} will want to use their home crowd as a twelfth player, while ${awayS} look to stay compact and take their chances when they arrive.`;
  }

  // ── Second Half ────────────────────────────────────────────────────────────

  let secondHalf: string;
  if (status === 'FINISHED') {
    const secondHalfGoals = (htH !== null && htA !== null)
      ? (ftH - htH) + (ftA - htA)
      : totalGoals;

    if (htH !== null && htA !== null && htH === ftH && htA === ftA) {
      secondHalf =
        `The second half largely mirrored the first, with ${homeS} and ${awayS} continuing to test each other ` +
        `without managing to alter the scoreline. ` +
        `Despite both teams pushing for a goal that would have changed the match, the defences stood firm and the score remained ${ftH}–${ftA}. ` +
        `Substitutions and tactical adjustments were made by both managers but ultimately could not unlock the deadlock.`;
    } else if (secondHalfGoals === 0) {
      secondHalf =
        `After the break, both sides remained committed and organised at the back, denying each other any clear scoring chances. ` +
        `The second period was a patient, tactical battle that neither team was willing to lose by taking unnecessary risks. ` +
        `The final score of ${ftH}–${ftA} was a fair reflection of a match where defensive quality prevailed.`;
    } else {
      const lead2ndH = htH !== null && htA !== null
        ? `from ${htH}–${htA} ` : '';
      secondHalf =
        `The second half saw the match open up further, with ${secondHalfGoals} more goal${secondHalfGoals === 1 ? '' : 's'} added ${lead2ndH}to bring the final score to ${ftH}–${ftA}. ` +
        `Both managers made tactical changes in an effort to influence the outcome, with substitutions and shifts in formation creating new dynamics on the pitch. ` +
        `The closing stages were played at a high tempo, with both sides aware of what was at stake in the final minutes.`;
    }
  } else if (status === 'SCHEDULED' || status === 'TIMED') {
    secondHalf =
      `The second half will be where the game's decisive moments are likely to be found, particularly if the match is finely poised at the interval. ` +
      `Fitness, bench depth and managerial decisions will all play a key role as the game enters its latter stages. ` +
      `With three points at stake, neither side is expected to sit back, and the second period should produce the defining moments of the encounter.`;
  } else {
    secondHalf =
      `The second half will be crucial in determining the outcome of today's fixture. ` +
      `Whoever can impose their game plan most effectively after the break is likely to emerge victorious. ` +
      `Fans should expect further chances and tactical adjustments as both sides chase the decisive goal.`;
  }

  // ── Result Impact ──────────────────────────────────────────────────────────

  let resultImpact: string;
  if (status === 'FINISHED') {
    if (score.winner === 'HOME_TEAM') {
      resultImpact =
        `The victory delivers three vital points to ${homeS}, boosting their position and strengthening confidence heading into their next fixture. ` +
        `For ${awayS}, it is a result to put behind them quickly as they refocus on their next challenge. ` +
        `Every point in ${compFull} carries weight, and this result shapes the outlook for both clubs as the season continues.`;
    } else if (score.winner === 'AWAY_TEAM') {
      resultImpact =
        `Three points on the road is always a significant achievement, and ${awayS} will be delighted to collect maximum points from this trip. ` +
        `${homeS} now face the task of responding in their next encounter, with this defeat a reminder of the unforgiving nature of top-level football. ` +
        `The result will have an effect on the wider standings, adding further intrigue to the ${compFull} table.`;
    } else {
      resultImpact =
        `A draw sees both teams share the spoils, a result that will generate mixed feelings depending on where each side is in their campaign. ` +
        `For the team with higher ambitions, a point may feel like two dropped; for the other, it could represent a valuable addition to their tally. ` +
        `The ${compFull} table remains finely balanced, and this result adds another layer to what promises to be an exciting remainder of the season.`;
    }
  } else if (status === 'IN_PLAY' || status === 'PAUSED') {
    resultImpact =
      `With the match still ongoing, the full impact of the result remains to be seen. ` +
      `Every goal and tactical shift in the remaining minutes could prove decisive for both sides' seasons. ` +
      `Fans following the action will know that the points awarded here carry real significance in the ${compFull}.`;
  } else {
    resultImpact =
      `The three points on offer in this fixture will be crucial for both clubs' ambitions this season. ` +
      `A win for either side could prove to be a pivotal moment in their campaign, while a draw would leave both looking over their shoulders at the congested table. ` +
      `The importance of this match cannot be understated — every result in ${compFull} matters.`;
  }

  // ── Competition Context ─────────────────────────────────────────────────────

  const compContext =
    `${mdLabel ? `This match formed part of ${mdLabel} of the ${compFull}` : `This fixture was contested in the ${compFull}`}. ` +
    `${isWC
      ? `The FIFA World Cup 2026, hosted across the United States, Canada and Mexico, is the biggest football tournament on the planet, bringing together 48 nations in a 104-match competition spanning 11 June to 19 July 2026.`
      : `${compFull} is one of the most prestigious and competitive football competitions in the world, featuring the best clubs and attracting global audiences match after match.`
    } ` +
    `Follow GoalRadar for live scores, in-depth match reports, group standings and full coverage of every ${compFull} fixture throughout the season.`;

  return [
    { heading: 'Introduction',        paragraphs: [intro] },
    { heading: 'First Half',          paragraphs: [firstHalf] },
    { heading: 'Second Half',         paragraphs: [secondHalf] },
    { heading: 'Result Impact',       paragraphs: [resultImpact] },
    { heading: 'Competition Context', paragraphs: [compContext] },
  ];
}

function MatchReport({ match }: { match: MatchDetail }) {
  const sections   = buildReportSections(match);
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
              <span className="text-lg leading-none">⚽</span>
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
              <span className="text-base leading-none">🔄</span>
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
                  className="bg-blue-500 transition-all"
                  style={{ width: `${homePct}%` }}
                />
                <div
                  className="bg-orange-500 transition-all"
                  style={{ width: `${awayPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 mt-4 text-center">
        Statistics computed from match events. Possession and shot data not available on this plan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

function LineupsSection() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Lineups')}
      <p className="text-sm text-gray-500 text-center py-6">
        Detailed starting lineups are not available from the current data provider.
      </p>
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
      const slug  = match.group.toLowerCase().replace('_', '-');     // group-a
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
  const groupSlug  = group ? group.toLowerCase().replace('_', '-') : null;
  const groupLabel = group ? group.replace('GROUP_', 'Group ') : null;
  const compCode   = match.competition?.code;
  const compName   = match.competition?.name ?? 'Competition';

  type LinkItem = { href: string; icon: string; label: string; desc: string };

  const links: LinkItem[] = isWC
    ? [
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
            className="flex flex-col gap-0.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-xl p-3 transition-all group"
          >
            <span className="text-lg leading-none mb-1">{icon}</span>
            <span className="text-white text-xs font-semibold group-hover:text-green-400 transition-colors leading-tight">
              {label}
            </span>
            <span className="text-gray-600 text-[10px] leading-tight">{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ match }: { match: MatchDetail }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    sport: 'Football',
    startDate: match.utcDate,
    eventStatus:
      match.status === 'FINISHED'
        ? 'https://schema.org/EventScheduled'
        : 'https://schema.org/EventScheduled',
    competitor: [
      { '@type': 'SportsTeam', name: match.homeTeam.name, image: match.homeTeam.crest },
      { '@type': 'SportsTeam', name: match.awayTeam.name, image: match.awayTeam.crest },
    ],
    location: {
      '@type': 'Place',
      name: match.venue ?? match.competition?.name ?? 'Football Stadium',
    },
    organizer: {
      '@type': 'Organization',
      name: match.competition?.name ?? 'Football',
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
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

  let match: MatchDetail | null = null;
  type MatchError = 'not_found' | 'unavailable' | null;
  let matchError: MatchError = null;

  try {
    match = await getMatchDetail(numericId);

    if (!match) {
      // API returned success but null body — treat as unavailable
      console.error(`[MatchPage] id=${numericId} API returned null body`);
      matchError = 'unavailable';
    } else {
      // Redirect old numeric-only URLs to the canonical slug URL.
      // e.g. /match/537327 → /match/537327-mexico-vs-south-africa
      const canonical = matchPath(match.id, match.homeTeam.name, match.awayTeam.name);
      if (slug === numericId) {
        redirect(canonical);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (err instanceof NotFoundError) {
      // Genuine 404 from football-data — match does not exist in their system.
      // Per product requirement: show graceful fallback, do NOT call notFound().
      console.error(`[MatchPage] id=${numericId} not found in football-data API`);
      matchError = 'not_found';
    } else {
      // Transient failure: timeout, 429 rate-limit, 403 plan restriction, network error.
      console.error(`[MatchPage] id=${numericId} temporarily unavailable:`, errMsg);
      matchError = 'unavailable';
    }
  }

  if (matchError || !match) {
    const isNotFound = matchError === 'not_found';
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Match' }]} />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">{isNotFound ? '🔍' : '⚽'}</div>
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

  const isWC       = match.competition?.code === 'WC';
  const hasGroup   = Boolean(match.group);

  // Fetch h2h + (for WC group matches) all group matches — in parallel
  const [h2hResult, wcUpcomingResult, wcRecentResult] = await Promise.allSettled([
    getHeadToHead(numericId),
    isWC && hasGroup ? getUpcomingMatches('WC') : Promise.resolve(null),
    isWC && hasGroup ? getRecentMatches('WC')   : Promise.resolve(null),
  ]);

  const h2h: HeadToHead | null = h2hResult.status === 'fulfilled' ? h2hResult.value : null;

  // All WC matches for this group (upcoming + recent), excluding current
  const allWCGroupMatches: Match[] = (() => {
    if (!isWC || !match.group) return [];
    const upcoming: Match[] =
      wcUpcomingResult.status === 'fulfilled' && wcUpcomingResult.value
        ? wcUpcomingResult.value.matches.filter((m) => m.group === match.group)
        : [];
    const recent: Match[] =
      wcRecentResult.status === 'fulfilled' && wcRecentResult.value
        ? wcRecentResult.value.matches.filter((m) => m.group === match.group)
        : [];
    // Deduplicate by id
    const seen = new Set<number>();
    return [...upcoming, ...recent].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })();

  // All WC matches for related matches (any match involving either team)
  const allWCMatches: Match[] = (() => {
    if (!isWC) return [];
    const upcoming: Match[] =
      wcUpcomingResult.status === 'fulfilled' && wcUpcomingResult.value
        ? wcUpcomingResult.value.matches : [];
    const recent: Match[] =
      wcRecentResult.status === 'fulfilled' && wcRecentResult.value
        ? wcRecentResult.value.matches : [];
    const seen = new Set<number>();
    return [...upcoming, ...recent].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })();

  const hasEvents =
    (match.goals?.length ?? 0) > 0 ||
    (match.bookings?.length ?? 0) > 0 ||
    (match.substitutions?.length ?? 0) > 0;

  const showStats = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);

  return (
    <>
      <JsonLd match={match} />

      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        {/* Context-aware breadcrumb: Home > WC 2026 > Group A > Match */}
        <Breadcrumb items={buildBreadcrumb(match)} />

        <ScoreHero match={match} />

        {showStats && <MatchSummary match={match} />}

        <MatchReport match={match} />

        {showStats && hasEvents && <MatchStatistics match={match} />}

        <GoalsSection match={match} />

        <BookingsSection match={match} />

        <SubstitutionsSection match={match} />

        <LineupsSection />

        {h2h && <HeadToHeadSection h2h={h2h} match={match} />}

        {/* Other matches in the same WC group */}
        {isWC && hasGroup && (
          <OtherGroupMatches
            groupMatches={allWCGroupMatches}
            currentId={match.id}
          />
        )}

        {/* Related matches involving either team */}
        {isWC && (
          <RelatedMatches
            homeTeamId={match.homeTeam.id}
            awayTeamId={match.awayTeam.id}
            competitionName={match.competition?.name ?? 'World Cup 2026'}
            matches={allWCMatches}
            currentId={match.id}
          />
        )}

        {/* Contextual competition links */}
        <CompetitionLinks match={match} />
      </div>
    </>
  );
}
