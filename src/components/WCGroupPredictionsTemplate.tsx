/**
 * WCGroupPredictionsTemplate
 *
 * Shared server component for all /world-cup-2026/group-X-predictions pages.
 * Sprint G9: added Group Standings Preview + expanded Team Analysis sections.
 */

import Link from 'next/link';
import { WC_ALL_TEAMS, type WCTeamEntry } from '@/lib/wc-all-teams';
import type { GroupPredictionData } from '@/lib/wc-predictions';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

const BASE_URL = 'https://goalradar.org';

interface Props {
  group: string; // 'A'–'H'
  data: GroupPredictionData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ConfidenceBadge({ label }: { label: 'Very likely' | 'Likely' | 'Possible' | 'Outsider' }) {
  const colours: Record<string, string> = {
    'Very likely': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Likely':      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'Possible':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Outsider':    'bg-gray-800 text-gray-500 border-gray-700',
  };
  return (
    <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${colours[label]}`}>
      {label}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: 'Winner' | 'Runner-up' | 'Dark Horse' | 'Group Exit' }) {
  const styles: Record<string, string> = {
    'Winner':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    'Runner-up':  'bg-green-500/10 text-green-400 border-green-500/20',
    'Dark Horse': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Group Exit': 'bg-gray-800 text-gray-500 border-gray-700',
  };
  const icons: Record<string, string> = {
    'Winner':     '🥇',
    'Runner-up':  '🥈',
    'Dark Horse': '⚡',
    'Group Exit': '❌',
  };
  return (
    <span className={`inline-flex items-center gap-1 border text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[outcome]}`}>
      <span>{icons[outcome]}</span>
      <span>{outcome}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD builder (exported so callers can inline it)
// ---------------------------------------------------------------------------

export function buildGroupJsonLd(group: string, data: GroupPredictionData, pageUrl: string) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                      item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',            item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: `Group ${group} Predictions`, item: pageUrl },
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.metaTitle,
    description: data.metaDesc,
    url: pageUrl,
    datePublished: '2026-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    author:    { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    about: {
      '@type': 'SportsEvent',
      name:        `FIFA World Cup 2026 Group ${group}`,
      startDate:   '2026-06-11',
      endDate:     '2026-07-19',
      location:    { '@type': 'Place', name: 'USA, Canada, Mexico' },
      organizer:   { '@type': 'Organization', name: 'FIFA' },
    },
  };

  return { breadcrumb, faqPage, article };
}

// ---------------------------------------------------------------------------
// Predicted standings table
// ---------------------------------------------------------------------------

// Typical predicted final points per position (illustrative pre-tournament)
const PREDICTED_PTS = [7, 5, 3, 1];
const PREDICTED_GD  = ['+5', '+2', '-2', '-5'];

function GroupStandingsPreview({
  group,
  teams,
  predicted1stSlug,
  predicted2ndSlug,
  darkHorseSlug,
}: {
  group: string;
  teams: WCTeamEntry[];
  predicted1stSlug:  string;
  predicted2ndSlug:  string;
  darkHorseSlug:     string;
}) {
  // Order: 1st → 2nd → darkHorse → other
  const slugOrder = [predicted1stSlug, predicted2ndSlug, darkHorseSlug];
  const other     = teams.filter((t) => !slugOrder.includes(t.slug));
  const ordered   = [
    ...slugOrder.map((s) => teams.find((t) => t.slug === s)).filter((t): t is WCTeamEntry => Boolean(t)),
    ...other,
  ];

  return (
    <section aria-labelledby="standings-heading" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 id="standings-heading" className="text-lg font-bold text-white">
          Predicted Group {group} Standings
        </h2>
        <Link
          href={`/world-cup-2026/group-${group.toLowerCase()}`}
          className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
        >
          Live standings →
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-800/60 px-4 py-2 grid grid-cols-12 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="col-span-1">#</span>
          <span className="col-span-5">Team</span>
          <span className="col-span-2 text-center hidden sm:block">Pts</span>
          <span className="col-span-2 text-center hidden sm:block">GD</span>
          <span className="col-span-4 sm:col-span-2">Prediction</span>
        </div>

        {/* Rows */}
        {ordered.map((team, i) => {
          const advances = i < 2;
          const outcome: 'Winner' | 'Runner-up' | 'Dark Horse' | 'Group Exit' =
            i === 0 ? 'Winner'
            : i === 1 ? 'Runner-up'
            : team.slug === darkHorseSlug ? 'Dark Horse'
            : 'Group Exit';

          return (
            <div
              key={team.slug}
              className={`grid grid-cols-12 items-center px-4 py-3 border-t border-gray-800/50 border-l-2 ${
                advances ? 'border-l-green-500' : 'border-l-transparent'
              } hover:bg-gray-800/30 transition-colors`}
            >
              <span className="col-span-1 text-gray-500 font-mono text-sm">{i + 1}</span>

              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{team.flag}</span>
                <Link
                  href={`/teams/${team.slug}`}
                  className="text-white font-semibold text-sm truncate hover:text-yellow-400 transition-colors"
                >
                  {team.shortName || team.displayName}
                </Link>
              </div>

              <span className="col-span-2 text-center font-bold text-white hidden sm:block">
                {PREDICTED_PTS[i]}
              </span>

              <span className="col-span-2 text-center text-gray-400 text-xs hidden sm:block">
                {PREDICTED_GD[i]}
              </span>

              <div className="col-span-4 sm:col-span-2 flex justify-end sm:justify-start">
                <OutcomePill outcome={outcome} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-3 rounded-sm bg-green-500 shrink-0" />
          <span className="text-gray-500 text-[11px]">Advances to Round of 32</span>
        </div>
        <span className="text-gray-700 text-[11px]">· Pre-tournament prediction (pts &amp; GD are estimates)</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Team Analysis section
// ---------------------------------------------------------------------------

function TeamAnalysis({
  group,
  teams,
  predicted1stSlug,
  predicted2ndSlug,
  darkHorseSlug,
  predicted1stReason,
  predicted2ndReason,
  darkHorseReason,
}: {
  group: string;
  teams: WCTeamEntry[];
  predicted1stSlug:   string;
  predicted2ndSlug:   string;
  darkHorseSlug:      string;
  predicted1stReason: string;
  predicted2ndReason: string;
  darkHorseReason:    string;
}) {
  const slugOrder = [predicted1stSlug, predicted2ndSlug, darkHorseSlug];
  const other     = teams.filter((t) => !slugOrder.includes(t.slug));
  const ordered   = [
    ...slugOrder.map((s) => teams.find((t) => t.slug === s)).filter((t): t is WCTeamEntry => Boolean(t)),
    ...other,
  ];

  const reasons: Record<string, string> = {
    [predicted1stSlug]: predicted1stReason,
    [predicted2ndSlug]: predicted2ndReason,
    [darkHorseSlug]:    darkHorseReason,
  };

  const outcomes: Record<string, 'Winner' | 'Runner-up' | 'Dark Horse' | 'Group Exit'> = {
    [predicted1stSlug]: 'Winner',
    [predicted2ndSlug]: 'Runner-up',
    [darkHorseSlug]:    'Dark Horse',
  };

  const confLabels: Record<string, string> = {
    UEFA:      '🇪🇺 UEFA',
    CONMEBOL:  '🌎 CONMEBOL',
    CONCACAF:  '🌎 CONCACAF',
    CAF:       '🌍 CAF',
    AFC:       '🌏 AFC',
    OFC:       '🌏 OFC',
  };

  return (
    <section aria-labelledby="team-analysis-heading" className="mb-8">
      <h2 id="team-analysis-heading" className="text-lg font-bold text-white mb-4">
        Group {group} Team Analysis
      </h2>

      <div className="space-y-4">
        {ordered.map((team, i) => {
          const outcome = outcomes[team.slug] ?? 'Group Exit';
          const predictionReason = reasons[team.slug];

          return (
            <div
              key={team.slug}
              className={`bg-gray-900 border rounded-2xl p-5 ${
                i === 0 ? 'border-yellow-700/40' : 'border-gray-800'
              }`}
            >
              {/* Team header */}
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{team.flag}</span>
                  <div>
                    <Link
                      href={`/teams/${team.slug}`}
                      className="text-white font-black text-lg hover:text-yellow-400 transition-colors leading-tight block"
                    >
                      {team.displayName}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">FIFA #{team.fifaRanking}</span>
                      <span className="text-gray-700 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{confLabels[team.confederation] ?? team.confederation}</span>
                    </div>
                  </div>
                </div>
                <OutcomePill outcome={outcome} />
              </div>

              {/* Team intro */}
              <p className="text-gray-400 text-sm leading-relaxed mb-3">{team.intro}</p>

              {/* Prediction context */}
              {predictionReason && (
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                    🔮 Our Group {group} Prediction
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed">{predictionReason}</p>
                </div>
              )}

              {/* Team page link */}
              <div className="mt-3">
                <Link
                  href={`/teams/${team.slug}`}
                  className="text-yellow-500 hover:text-yellow-300 text-xs font-semibold transition-colors"
                >
                  {team.displayName} fixtures &amp; squad →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export default function WCGroupPredictionsTemplate({ group, data }: Props) {
  const teams = WC_ALL_TEAMS
    .filter((t) => t.group === group)
    .sort((a, b) => a.fifaRanking - b.fifaRanking);

  const pageUrl = `${BASE_URL}/world-cup-2026/group-${group.toLowerCase()}-predictions`;
  const { breadcrumb, faqPage, article } = buildGroupJsonLd(group, data, pageUrl);

  const otherGroups = ['A','B','C','D','E','F','G','H'].filter((g) => g !== group);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />

      <div className="max-w-5xl mx-auto pb-16 space-y-2">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: `Group ${group} Predictions` },
        ]} />

        <WCPageNav />

        {/* ── Hero ── */}
        <div className="pt-2 pb-2">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
            🔮 FIFA World Cup 2026 · Group Stage Predictions
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Group {group} Predictions &amp; Analysis
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">{data.intro}</p>

          {/* On-page jump links */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Standings Preview', href: '#standings' },
              { label: 'Qualification',     href: '#qualification' },
              { label: 'Team Analysis',     href: '#team-analysis' },
              { label: 'Key Match',         href: '#key-match' },
              { label: 'Full Analysis',     href: '#analysis' },
              { label: 'FAQ',               href: '#faq' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Section 1: Group Standings Preview ── */}
        <div id="standings">
          <GroupStandingsPreview
            group={group}
            teams={teams}
            predicted1stSlug={data.predicted1st.slug}
            predicted2ndSlug={data.predicted2nd.slug}
            darkHorseSlug={data.darkHorse.slug}
          />
        </div>

        {/* ── Section 2: Qualification Predictions ── */}
        <section id="qualification" aria-labelledby="qual-heading" className="mb-8">
          <h2 id="qual-heading" className="text-lg font-bold text-white mb-4">
            Our Group {group} Prediction
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1st place */}
            <div className="bg-gray-900 border border-yellow-700/40 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                  🥇 Group Winner
                </span>
                <ConfidenceBadge label="Very likely" />
              </div>
              <Link
                href={`/teams/${data.predicted1st.slug}`}
                className="flex items-center gap-3 mb-3 group"
              >
                <span className="text-3xl">{data.predicted1st.flag}</span>
                <span className="text-white font-black text-xl group-hover:text-yellow-400 transition-colors">
                  {data.predicted1st.name}
                </span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed">{data.predicted1st.reason}</p>
            </div>

            {/* 2nd place */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  🥈 Runner-up
                </span>
                <ConfidenceBadge label="Likely" />
              </div>
              <Link
                href={`/teams/${data.predicted2nd.slug}`}
                className="flex items-center gap-3 mb-3 group"
              >
                <span className="text-3xl">{data.predicted2nd.flag}</span>
                <span className="text-white font-black text-xl group-hover:text-yellow-400 transition-colors">
                  {data.predicted2nd.name}
                </span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed">{data.predicted2nd.reason}</p>
            </div>

            {/* Dark horse */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  ⚡ Dark Horse
                </span>
                <ConfidenceBadge label="Possible" />
              </div>
              <Link
                href={`/teams/${data.darkHorse.slug}`}
                className="flex items-center gap-3 mb-3 group"
              >
                <span className="text-3xl">{data.darkHorse.flag}</span>
                <span className="text-white font-black text-xl group-hover:text-yellow-400 transition-colors">
                  {data.darkHorse.name}
                </span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed">{data.darkHorse.reason}</p>
            </div>
          </div>
        </section>

        {/* ── Section 3: Team Analysis ── */}
        <div id="team-analysis">
          <TeamAnalysis
            group={group}
            teams={teams}
            predicted1stSlug={data.predicted1st.slug}
            predicted2ndSlug={data.predicted2nd.slug}
            darkHorseSlug={data.darkHorse.slug}
            predicted1stReason={data.predicted1st.reason}
            predicted2ndReason={data.predicted2nd.reason}
            darkHorseReason={data.darkHorse.reason}
          />
        </div>

        {/* ── Section 4: Key Match ── */}
        <section id="key-match" aria-labelledby="key-match-heading" className="mb-8">
          <h2 id="key-match-heading" className="text-lg font-bold text-white mb-4">
            Key Match to Watch
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <span className="text-2xl">⚽</span>
              <div className="flex items-center gap-3 text-xl font-black text-white flex-wrap">
                <span>{data.keyMatch.homeFlag}</span>
                <span>{data.keyMatch.home}</span>
                <span className="text-gray-600 text-base font-normal">vs</span>
                <span>{data.keyMatch.away}</span>
                <span>{data.keyMatch.awayFlag}</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{data.keyMatch.note}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Link
                href="/world-cup-2026/fixtures"
                className="text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
              >
                📅 View all Group {group} fixtures →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Section 5: Full Analysis ── */}
        <section id="analysis" aria-labelledby="analysis-heading" className="mb-8">
          <h2 id="analysis-heading" className="text-lg font-bold text-white mb-4">
            Group {group} Full Analysis
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-300 leading-relaxed">{data.analysis}</p>
          </div>
        </section>

        {/* ── Live Standings CTA ── */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 mb-8 flex items-center gap-4 flex-wrap">
          <span className="text-2xl shrink-0">📊</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Live Group {group} Standings</p>
            <p className="text-gray-400 text-xs mt-0.5">
              Points tables update in real time once matches begin on 11 June 2026.
            </p>
          </div>
          <Link
            href={`/world-cup-2026/group-${group.toLowerCase()}`}
            className="shrink-0 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition-colors"
          >
            View Standings →
          </Link>
        </div>

        {/* ── Section 6: FAQ ── */}
        <section id="faq" aria-labelledby="faq-heading" className="mb-10">
          <h2 id="faq-heading" className="text-xl font-bold text-white mb-4">
            Group {group} Predictions FAQ
          </h2>
          <div className="space-y-3">
            {data.faq.map(({ q, a }) => (
              <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
                <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-800/50 transition-colors">
                  <span className="text-white font-semibold text-sm">{q}</span>
                  <span className="text-gray-500 text-lg shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 pt-1 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Browse other groups ── */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Other Group Predictions
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {otherGroups.map((g) => (
              <Link
                key={g}
                href={`/world-cup-2026/group-${g.toLowerCase()}-predictions`}
                className="bg-gray-900 hover:bg-yellow-500/10 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-2.5 text-center transition-all"
              >
                <span className="text-white font-black text-base">Grp {g}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Related links ── */}
        <WCRelatedLinks links={[
          { href: `/world-cup-2026/group-${group.toLowerCase()}`,             icon: '📊', label: `Group ${group} Standings`, desc: 'Live points table once matches begin' },
          { href: `/teams/${data.predicted1st.slug}`,                        icon: data.predicted1st.flag, label: data.predicted1st.name, desc: 'Fixtures, results and squad' },
          { href: `/teams/${data.predicted2nd.slug}`,                        icon: data.predicted2nd.flag, label: data.predicted2nd.name, desc: 'Fixtures, results and squad' },
          { href: '/world-cup-2026/winner-predictions',                       icon: '🏆', label: 'Winner Predictions',       desc: 'Who will lift the trophy in 2026?' },
          { href: '/world-cup-2026/golden-boot-predictions',                  icon: '⚽', label: 'Golden Boot Predictions',  desc: 'Top scorer predictions for WC 2026' },
          { href: '/world-cup-2026/predictions',                              icon: '🔮', label: 'All Predictions',          desc: 'Full prediction hub — every group and winner' },
          { href: '/world-cup-2026/fixtures',                                 icon: '📅', label: 'WC 2026 Fixtures',         desc: 'All 104 match kick-off times' },
          { href: '/world-cup-2026/groups',                                   icon: '🗂️', label: 'All Group Standings',      desc: 'Live tables for all 12 groups' },
        ]} heading="More World Cup 2026" />
      </div>
    </>
  );
}
