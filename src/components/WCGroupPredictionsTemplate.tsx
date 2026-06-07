/**
 * WCGroupPredictionsTemplate
 *
 * Shared server component for all /world-cup-2026/group-X-predictions pages.
 * Each individual page.tsx passes the group letter + prediction data.
 */

import Link from 'next/link';
import { WC_ALL_TEAMS } from '@/lib/wc-all-teams';
import type { GroupPredictionData } from '@/lib/wc-predictions';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

const BASE_URL = 'https://goalradar.org';

interface Props {
  group: string; // 'A'–'H'
  data: GroupPredictionData;
}

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

export function buildGroupJsonLd(group: string, data: GroupPredictionData, pageUrl: string) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                 item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',       item: `${BASE_URL}/world-cup-2026` },
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
    author: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    about: { '@type': 'SportsEvent', name: `FIFA World Cup 2026 Group ${group}` },
  };

  return { breadcrumb, faqPage, article };
}

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

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: `Group ${group} Predictions` },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              🔮 World Cup 2026 Predictions
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Group {group} Predictions &amp; Analysis
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">{data.intro}</p>
        </div>

        {/* Teams in group */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Teams in Group {group}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {teams.map((team) => (
              <Link
                key={team.slug}
                href={`/world-cup-2026/teams/${team.slug}`}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-2xl p-4 transition-all group text-center"
              >
                <div className="text-3xl mb-2">{team.flag}</div>
                <p className="text-white font-bold text-sm group-hover:text-yellow-400 transition-colors leading-tight">
                  {team.shortName || team.displayName}
                </p>
                <p className="text-gray-600 text-xs mt-0.5">FIFA #{team.fifaRanking}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Prediction summary cards */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Our Group {group} Prediction</h2>
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
                href={`/world-cup-2026/teams/${data.predicted1st.slug}`}
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
                href={`/world-cup-2026/teams/${data.predicted2nd.slug}`}
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
                href={`/world-cup-2026/teams/${data.darkHorse.slug}`}
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

        {/* Key match */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Key Match to Watch</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-2xl">⚽</span>
              <div className="flex items-center gap-3 text-xl font-black text-white">
                <span>{data.keyMatch.homeFlag}</span>
                <span>{data.keyMatch.home}</span>
                <span className="text-gray-600 text-base font-normal">vs</span>
                <span>{data.keyMatch.away}</span>
                <span>{data.keyMatch.awayFlag}</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{data.keyMatch.note}</p>
          </div>
        </section>

        {/* Full analysis */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Group {group} Full Analysis</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-300 leading-relaxed">{data.analysis}</p>
          </div>
        </section>

        {/* Group standings live link */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 mb-8 flex items-center gap-4">
          <span className="text-2xl">📊</span>
          <div className="flex-1">
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

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">Group {group} Predictions FAQ</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {data.faq.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Browse other groups */}
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

        <WCRelatedLinks links={[
          { href: `/world-cup-2026/group-${group.toLowerCase()}`,             icon: '📊', label: `Group ${group} Standings`, desc: 'Live points table for Group ' + group },
          { href: `/world-cup-2026/teams/${data.predicted1st.slug}`,          icon: data.predicted1st.flag, label: data.predicted1st.name, desc: 'Fixtures, results and squad' },
          { href: `/world-cup-2026/teams/${data.predicted2nd.slug}`,          icon: data.predicted2nd.flag, label: data.predicted2nd.name, desc: 'Fixtures, results and squad' },
          { href: '/world-cup-2026/winner-predictions',                       icon: '🏆', label: 'Winner Predictions',    desc: 'Who will lift the trophy in 2026?' },
          { href: '/world-cup-2026/golden-boot-predictions',                  icon: '⚽', label: 'Golden Boot Predictions', desc: 'Top scorer predictions for WC 2026' },
          { href: '/world-cup-2026/groups',                                   icon: '🗂️', label: 'All Group Standings',   desc: 'Live tables for all 12 groups' },
        ]} heading="More World Cup 2026 Predictions" />
      </div>
    </>
  );
}
