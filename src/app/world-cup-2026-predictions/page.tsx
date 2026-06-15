/**
 * /world-cup-2026-predictions
 *
 * Flat-URL programmatic SEO page targeting:
 *   "world cup 2026 predictions" | "wc 2026 match predictions"
 *   "world cup 2026 score predictions" | "predict world cup 2026 matches"
 *
 * Unique angle vs /world-cup-2026/predictions (editorial winner/golden-boot hub):
 * This page is match-centric — it lists every upcoming WC fixture as an
 * interactive prediction card and links directly to the per-match
 * /predict/{id} and /match/{id} pages.
 *
 * Data layers
 * ──────────────────────────────────────────────────────────────────────────
 * L1 Live (API): getUpcomingMatchesCached('WC') + getRecentMatchesCached('WC')
 *    → filtered to WC, sorted chronologically, renders live fixture cards
 *      with real match IDs so each card links to /predict/{id} & /match/{id}
 *
 *
 * Revalidates every 15 min (same cadence as getUpcomingMatches cache).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
// PERF-4.5
import { getUpcomingMatchesCached, getRecentMatchesCached } from '@/lib/api';
import type { WCGroupFixture } from '@/lib/wc-fixtures';
import { matchPath, predictPath } from '@/lib/url';
import type { Match } from '@/lib/types';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import AdSlot from '@/components/AdSlot';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400; // DATA-9: raised from 900 — predictions content is static, no live data

const BASE_URL    = 'https://goalradar.org';
const CANONICAL   = `${BASE_URL}/world-cup-2026-predictions`;
const MAX_UPCOMING = 18; // prediction cards shown above the fold + scroll
const MAX_RECENT   = 6;  // recent finished matches shown at bottom

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title:       'World Cup 2026 Match Predictions — Score, Win Probability & H2H | GoalRadar',
  description: 'Predict the score for every FIFA World Cup 2026 match. Win probability, head-to-head stats, form guides and AI-assisted score predictions for all 104 matches.',
  alternates:  { canonical: CANONICAL },
  openGraph: {
    title:       'World Cup 2026 Match Predictions | GoalRadar',
    description: 'Predict every FIFA World Cup 2026 match — score predictions, win probabilities and H2H for all 104 games.',
    type:        'website',
    url:         CANONICAL,
  },
  twitter: {
    card:        'summary_large_image',
    title:       'World Cup 2026 Match Predictions | GoalRadar',
    description: 'Score predictions, win probability and H2H stats for every World Cup 2026 match.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'Where can I predict FIFA World Cup 2026 match scores?',
    a: 'GoalRadar offers a prediction page for every World Cup 2026 match. Each page shows the win probability, expected score, head-to-head record and recent form for both teams. Open any match card on this page and click "Predict this match" to make your forecast.',
  },
  {
    q: 'How does GoalRadar calculate World Cup 2026 score predictions?',
    a: 'GoalRadar\'s predictions are based on a statistical model using recent form (last 5–10 matches), head-to-head record, home/away advantage, goal-scoring rates and defensive records. The model outputs win probability percentages and an expected score.',
  },
  {
    q: 'Which World Cup 2026 match is most predicted to be a draw?',
    a: 'Historically, group stage World Cup matches between evenly ranked teams are most likely to end as draws. GoalRadar shows draw probability on each match prediction page — look for games where both teams\' win percentages are closest.',
  },
  {
    q: 'When do World Cup 2026 matches start?',
    a: 'FIFA World Cup 2026 begins on 11 June 2026. Group stage matches run until 30 June. The Round of 32 starts on 27 June and the Final is on 19 July 2026 at MetLife Stadium, New Jersey.',
  },
  {
    q: 'Can I predict all 104 World Cup 2026 matches?',
    a: 'Yes. GoalRadar provides a dedicated prediction page for every one of the 104 FIFA World Cup 2026 matches. As each match approaches, the prediction is updated with the latest form, injury news and head-to-head data.',
  },
  {
    q: 'What is the best World Cup 2026 prediction model?',
    a: 'No model perfectly predicts football — upsets are part of the game. GoalRadar uses recent form, H2H records and statistical averages. For the sharpest forecasts, combine GoalRadar\'s win probability with pre-match injury news and line-up information published closer to kick-off.',
  },
  {
    q: 'Who is predicted to win the FIFA World Cup 2026?',
    a: 'Based on pre-tournament models and betting markets, France are the overall favourite to win the FIFA World Cup 2026, with Brazil, England and Argentina close behind. See our full winner predictions hub for the complete analysis.',
  },
  {
    q: 'How are World Cup 2026 matches sorted on the predictions page?',
    a: 'Upcoming matches are sorted by kick-off date, with the soonest fixtures first. Each card links to a dedicated prediction page with full H2H stats, form guides and expected score.',
  },
] as const;

function JsonLd() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Match Predictions', item: CANONICAL },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type':         'Question',
      name:            q,
      acceptedAnswer:  { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function matchStatusBadge(status: string) {
  if (status === 'IN_PLAY' || status === 'PAUSED')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">LIVE</span>;
  if (status === 'FINISHED')
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 border border-gray-600">FT</span>;
  return null;
}

function scoreOrVs(m: Match): string {
  const h = m.score?.fullTime?.home;
  const a = m.score?.fullTime?.away;
  if (h != null && a != null) return `${h} – ${a}`;
  const ih = m.score?.halfTime?.home;
  const ia = m.score?.halfTime?.away;
  if (ih != null && ia != null) return `${ih} – ${ia}`;
  return 'vs';
}

// ---------------------------------------------------------------------------
// Live match prediction card
// ---------------------------------------------------------------------------

function LiveMatchCard({ match }: { match: Match }) {
  const home    = match.homeTeam?.name ?? 'TBD';
  const away    = match.awayTeam?.name ?? 'TBD';
  const isLive  = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isDone  = match.status === 'FINISHED';
  const pPath   = predictPath(match.id, home, away);
  const mPath   = matchPath(match.id, home, away);
  const stage   = match.stage ? stageLabel(match.stage) : '';
  const group   = match.group ? `· ${match.group.replace('GROUP_', 'Group ')}` : '';

  return (
    <div className={`bg-gray-900 border rounded-2xl overflow-hidden transition-colors ${
      isLive ? 'border-red-500/40' : 'border-gray-800 hover:border-yellow-700/30'
    }`}>
      {/* Match header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide">
          {stage} {group}
        </span>
        <div className="flex items-center gap-1.5">
          {matchStatusBadge(match.status)}
          <span className="text-[10px] text-gray-700">{formatKickoff(match.utcDate)}</span>
        </div>
      </div>

      {/* Score row */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-bold text-white truncate">{home}</span>
        </div>
        <span className="text-white font-black font-mono text-lg px-3 shrink-0">
          {scoreOrVs(match)}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="text-sm font-bold text-white truncate">{away}</span>
        </div>
      </div>

      {/* CTA row */}
      <div className={`px-4 pb-3 flex items-center gap-2 ${isDone ? 'justify-center' : 'justify-between'}`}>
        {!isDone && (
          <Link
            href={pPath}
            title={`Predict ${home} vs ${away} — score, win probability and H2H`}
            aria-label={`Predict ${home} vs ${away}`}
            className="flex-1 text-center text-xs font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-lg py-2 transition-colors"
          >
            🔮 Predict this match
          </Link>
        )}
        <Link
          href={mPath}
          title={`${home} vs ${away} match details — lineup, stats and live updates`}
          aria-label={`${home} vs ${away} match details`}
          className={`text-center text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg py-2 transition-colors ${
            isDone ? 'w-full' : 'flex-1'
          }`}
        >
          Match details →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static fixture card (pre-tournament / API-down fallback)
// ---------------------------------------------------------------------------

function StaticFixtureCard({ fixture }: { fixture: WCGroupFixture }) {
  const groupPath = `/world-cup-2026/group-${fixture.group.toLowerCase()}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide">
          Group {fixture.group} · MD{fixture.matchday}
        </span>
        <span className="text-[10px] text-gray-700">{formatKickoff(fixture.utcDate)}</span>
      </div>

      {/* Teams */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-white truncate flex-1">
          {fixture.homeFlag} {fixture.homeLabel}
        </span>
        <span className="text-gray-600 font-bold font-mono text-sm px-2 shrink-0">vs</span>
        <span className="text-sm font-bold text-white truncate flex-1 text-right">
          {fixture.awayLabel} {fixture.awayFlag}
        </span>
      </div>

      {/* CTA */}
      <div className="px-4 pb-3">
        <Link
          href={groupPath}
          title={`Group ${fixture.group} standings, fixtures and results`}
          aria-label={`View Group ${fixture.group} page for ${fixture.homeLabel} vs ${fixture.awayLabel}`}
          className="w-full block text-center text-xs font-semibold text-gray-400 hover:text-yellow-400 bg-gray-800 hover:bg-gray-800/80 rounded-lg py-2 transition-colors"
        >
          Group {fixture.group} page → prediction available from 11 June
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage label helper
// ---------------------------------------------------------------------------

const STAGE_LABEL_MAP: Record<string, string> = {
  GROUP_STAGE:    'Group Stage',
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-Final',
  SEMI_FINALS:    'Semi-Final',
  THIRD_PLACE:    'Third-Place Play-off',
  FINAL:          'Final',
};

function stageLabel(stage: string): string {
  return STAGE_LABEL_MAP[stage] ?? stage.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WC2026PredictionsPage() {
  // ── Fetch live data ────────────────────────────────────────────────────────
  let upcoming: Match[] = [];
  let recent: Match[]   = [];

  try {
    const [upRes, recRes] = await Promise.allSettled([
      getUpcomingMatchesCached('WC'),
      getRecentMatchesCached('WC'),
    ]);

    if (upRes.status === 'fulfilled') {
      upcoming = upRes.value.matches
        .filter((m) => m.competition?.code === 'WC' || !m.competition)
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
        .slice(0, MAX_UPCOMING);
    }

    if (recRes.status === 'fulfilled') {
      recent = recRes.value.matches
        .filter((m) =>
          (m.competition?.code === 'WC' || !m.competition) &&
          m.status === 'FINISHED',
        )
        .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
        .slice(0, MAX_RECENT);
    }
  } catch { /* render with static fallback */ }

  const staticFixtures: WCGroupFixture[] = [];

  const isLive   = upcoming.length > 0 || recent.length > 0;
  const total    = upcoming.length + recent.length;

  return (
    <>
      <JsonLd />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Match Predictions' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* ── Hero ── */}
        <div className="mt-4 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            🔮 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Match Predictions
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
            Score predictions, win probabilities and head-to-head stats for every FIFA World Cup
            2026 match. Pick any fixture to see the full pre-match analysis and make your forecast.
          </p>
          {isLive && (
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs text-green-400 font-medium">
                Live data — {total} World Cup match{total !== 1 ? 'es' : ''} loaded
              </span>
            </div>
          )}
          {!isLive && (
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
              <span className="text-xs text-yellow-600 font-medium">
                Pre-tournament view · prediction pages go live on 11 June 2026
              </span>
            </div>
          )}
        </div>

        <AdSlot slotId="wc-predictions-top" variant="banner" />

        {/* ── Upcoming / Live match prediction cards ── */}
        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-heading" className="mb-10">
            <h2 id="upcoming-heading" className="text-lg font-bold text-white mb-4">
              Upcoming Matches — Predict Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map((m) => (
                <LiveMatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}

        {/* ── Static fallback fixture cards ── */}
        {staticFixtures.length > 0 && (
          <section aria-labelledby="schedule-heading" className="mb-10">
            <h2 id="schedule-heading" className="text-lg font-bold text-white mb-2">
              Upcoming Fixtures — Group Stage
            </h2>
            <p className="text-gray-500 text-xs mb-4">
              Prediction pages go live once match data is published by FIFA.
              Each card links to the group page — return from 11 June 2026 for live predictions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {staticFixtures.map((f) => (
                <StaticFixtureCard key={f.localId} fixture={f} />
              ))}
            </div>
          </section>
        )}

        {/* ── No data state ── */}
        {upcoming.length === 0 && staticFixtures.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center mb-10">
            <p className="text-3xl mb-3">🔮</p>
            <p className="text-white font-semibold">All group stage matches have been played</p>
            <p className="text-gray-500 text-sm mt-1">
              Knockout predictions will appear as matches are scheduled.
            </p>
            <Link href="/world-cup-2026-bracket"
              className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
              View knockout bracket →
            </Link>
          </div>
        )}

        <AdSlot slotId="wc-predictions-mid" variant="rectangle" className="mx-auto mb-10" />

        {/* ── Recently completed — link to match + predict pages ── */}
        {recent.length > 0 && (
          <section aria-labelledby="recent-heading" className="mb-10">
            <h2 id="recent-heading" className="text-lg font-bold text-white mb-4">
              Recent Results &amp; Post-Match Analysis
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((m) => (
                <LiveMatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}

        {/* ── How it works ── */}
        <section aria-labelledby="how-heading" className="mb-10">
          <h2 id="how-heading" className="text-lg font-bold text-white mb-4">
            How Match Predictions Work on GoalRadar
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            {[
              {
                step: '1',
                title: 'Pick a match',
                body:  'Click any match card above and hit "Predict this match" to open the full prediction page for that fixture.',
              },
              {
                step: '2',
                title: 'Review the analysis',
                body:  'Each prediction page shows win probability (%), expected score, last 5 form for both teams, head-to-head history and key stat comparisons.',
              },
              {
                step: '3',
                title: 'Make your forecast',
                body:  'The model shows the statistically most likely score — use the data to form your own prediction and back it with context.',
              },
              {
                step: '4',
                title: 'Check back at kick-off',
                body:  'Predictions update as team news, line-ups and market movements emerge in the 24 hours before kick-off.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mt-0.5">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="faq-heading" className="mb-10">
          <h2 id="faq-heading" className="text-lg font-bold text-white mb-4">
            World Cup 2026 Predictions — FAQ
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details
                key={q}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer list-none hover:bg-gray-800/50 transition-colors">
                  <span className="text-white font-semibold text-sm">{q}</span>
                  <span className="text-gray-600 shrink-0 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <AdSlot slotId="wc-predictions-bottom" variant="banner" />

        {/* ── Internal links ── */}
        <WCRelatedLinks links={[
          { href: '/world-cup-2026/predictions',          icon: '🏆', label: 'Winner Predictions Hub',    desc: 'Expert winner odds, Golden Boot picks and knockout forecasts' },
          { href: '/world-cup-2026/winner-predictions',   icon: '🥇', label: 'Who Will Win?',             desc: 'Full contender analysis — France, Brazil, England, Argentina' },
          { href: '/world-cup-2026/golden-boot-predictions', icon: '👟', label: 'Golden Boot Predictions', desc: 'Top scorer forecast — Mbappé, Haaland, Vinicius Jr and more' },
          { href: '/world-cup-2026-schedule',             icon: '📅', label: 'Full Schedule',             desc: 'All 104 fixtures with kickoff times and venues' },
          { href: '/world-cup-2026-results',              icon: '🏁', label: 'Live Results',              desc: 'Scores for every completed World Cup 2026 match' },
          { href: '/world-cup-2026-standings',            icon: '📊', label: 'Group Standings',           desc: 'Live points tables for all 12 groups' },
          { href: '/world-cup-2026-bracket',              icon: '🔗', label: 'Knockout Bracket',          desc: 'Round of 32 draw and path to the Final' },
          { href: '/world-cup-2026',                      icon: '🌍', label: 'WC 2026 Hub',               desc: 'Full tournament overview — fixtures, results and standings' },
        ]} />
      </div>
    </>
  );
}
