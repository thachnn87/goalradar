/**
 * FrozenTeamProfile — real WC-2026 per-team page from the frozen FIFA dataset.
 * EPIC-WC-FROZEN-DATA-001 Phase 2C.
 *
 * Rendered by /world-cup-2026/teams/[slug] when the frozen gate is active.
 * Every fact (group, results, standing, knockout run, finishing position) comes
 * from the frozen FIFA dataset — no synthetic WC_ALL_TEAMS content, no fabricated
 * editorial prose. If the slug is a preserved legacy URL for a nation that did NOT
 * play in WC-2026, an honest "did not take part" page is shown instead.
 */

import Link from 'next/link';
import {
  frozenTeamBySlug,
  frozenMatches,
  frozenStandings,
  frozenChampion,
} from '@/lib/wc-frozen-view';
import { deriveMatchDisplay } from '@/lib/match-display';
import { calculateQualificationStatus, type QualificationStatus } from '@/lib/wc-qualification';
import type { Match } from '@/lib/types';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import WCGroupTable from '@/components/WCGroupTable';
import AdSlot from '@/components/AdSlot';
import { matchPath } from '@/lib/url';

const BASE_URL = 'https://goalradar.org';

const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS: 'Semi-final',
  THIRD_PLACE: 'Third-place play-off',
  FINAL: 'Final',
};
const STAGE_ORDER = ['GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

function fmtDate(utc: string) {
  return new Date(utc).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Title-case a URL slug for a display name (used only for legacy "absent" slugs). */
function slugToName(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Team resolution shared with generateMetadata. Purely frozen-driven: a slug is
 * 'played' iff it is in the frozen roster; any other (known legacy) slug is
 * 'absent'. NO synthetic roster is read here. The caller (page) is responsible
 * for 404-ing slugs that are not in the known route set.
 */
export function resolveFrozenTeamStatus(slug: string):
  | { kind: 'played'; name: string }
  | { kind: 'absent'; name: string } {
  const frozen = frozenTeamBySlug(slug);
  if (frozen) return { kind: 'played', name: frozen.name };
  return { kind: 'absent', name: slugToName(slug) };
}

export default async function FrozenTeamProfile({ slug }: { slug: string }) {
  const status = resolveFrozenTeamStatus(slug);

  const canonicalUrl = `${BASE_URL}/world-cup-2026/teams/${slug}`;

  // ── Legacy URL for a nation that did NOT play WC-2026 → honest "absent" page ──
  if (status.kind === 'absent') {
    const jsonLdBreadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
        { '@type': 'ListItem', position: 3, name: `${status.name} — WC 2026`, item: canonicalUrl },
      ],
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
        <div className="max-w-3xl mx-auto pb-16">
          <Breadcrumb items={[
            { label: 'Home', href: '/' },
            { label: 'World Cup 2026', href: '/world-cup-2026' },
            { label: 'Teams', href: '/world-cup-2026/teams' },
            { label: status.name },
          ]} />
          <div className="mt-3 mb-6"><WCPageNav /></div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center mt-6">
            <p className="text-4xl mb-3">🌍</p>
            <h1 className="text-2xl font-black text-white mb-2">{status.name} at World Cup 2026</h1>
            <p className="text-gray-300 font-semibold">{status.name} did not take part in the FIFA World Cup 2026.</p>
            <p className="text-gray-500 text-sm mt-1">
              The 48-team field for the completed tournament did not include {status.name}. Browse the teams that did compete below.
            </p>
            <Link href="/world-cup-2026/teams" className="inline-block mt-4 text-yellow-500 hover:text-yellow-300 text-sm font-medium transition-colors">
              ← All 48 World Cup 2026 teams
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ── Real participant ────────────────────────────────────────────────────────
  const team = frozenTeamBySlug(slug)!;
  const teamId = Number(team.idTeam);

  const all = frozenMatches().filter((m) => m.homeTeam?.id === teamId || m.awayTeam?.id === teamId);
  const sortedAsc = [...all].sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const knockout = sortedAsc.filter((m) => m.stage !== 'GROUP_STAGE');

  // Group standing table (real, from frozen standings)
  const tables = frozenStandings();
  const groupTable = tables.find((t) => (t.group ?? '').endsWith(`_${team.group}`)) ?? null;
  const qualMap = calculateQualificationStatus(tables);
  const groupQualStatus = new Map<number, QualificationStatus>();
  for (const [id, q] of qualMap) if (q.group === team.group) groupQualStatus.set(id, q.qualificationStatus);
  const standingEntry = groupTable?.table.find((e) => e.team.id === teamId) ?? null;

  // Finishing position
  const champion = frozenChampion();
  const isChampion = champion.idTeam === team.idTeam;
  const isRunnerUp = champion.runnerUp?.idTeam === team.idTeam;
  const isThird = champion.third?.idTeam === team.idTeam;
  let finishLabel: string;
  if (isChampion) finishLabel = '🏆 Champions';
  else if (isRunnerUp) finishLabel = '🥈 Runners-up';
  else if (isThird) finishLabel = '🥉 Third place';
  else {
    const furthest = [...all].sort(
      (a, b) => STAGE_ORDER.indexOf(b.stage ?? '') - STAGE_ORDER.indexOf(a.stage ?? '')
    )[0];
    finishLabel = furthest && furthest.stage !== 'GROUP_STAGE'
      ? `Eliminated in the ${STAGE_LABEL[furthest.stage] ?? furthest.stage}`
      : 'Eliminated in the Group Stage';
  }

  const wins = all.filter((m) => {
    const home = m.homeTeam?.id === teamId;
    const hs = m.score.fullTime.home ?? 0, as = m.score.fullTime.away ?? 0;
    return hs !== as && (home ? hs > as : as > hs);
  }).length;

  const jsonLdTeam = {
    '@context': 'https://schema.org', '@type': 'SportsTeam',
    name: team.name, memberOf: { '@type': 'SportsOrganization', name: 'FIFA' },
    sport: 'Football (Soccer)', url: canonicalUrl,
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: `${team.name} — WC 2026`, item: canonicalUrl },
    ],
  };
  const faq = [
    {
      q: `Did ${team.name} play at the World Cup 2026?`,
      a: `Yes. ${team.name} competed in Group ${team.group} at the FIFA World Cup 2026, hosted by the United States, Canada and Mexico. Final result: ${finishLabel.replace(/^[^\w]+/, '')}.`,
    },
    {
      q: `What group were ${team.name} in at World Cup 2026?`,
      a: `${team.name} were drawn in Group ${team.group}.`,
    },
    {
      q: `How did ${team.name} finish at World Cup 2026?`,
      a: `${finishLabel.replace(/^[^\w]+/, '')} — ${team.name} won ${wins} of their ${all.length} matches at the tournament.`,
    },
  ];
  const jsonLdFaq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTeam) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Teams', href: '/world-cup-2026/teams' },
          { label: team.name },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              {team.flag} FIFA World Cup 2026{team.confederation ? ` · ${team.confederation}` : ''}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
            {team.name} at World Cup 2026
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {team.name} competed in Group {team.group} at the FIFA World Cup 2026. {finishLabel.replace(/^[^\w]+/, '')}.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
              Group {team.group}
            </span>
            <span className="bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-1 rounded-full">
              {finishLabel}
            </span>
            {team.confederation && (
              <span className="bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-1 rounded-full">
                {team.confederation}
              </span>
            )}
          </div>
        </div>

        <AdSlot slotId={`team-${slug}-top`} variant="banner" />

        {/* Group standing */}
        {groupTable && standingEntry && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">Group {team.group} — Final Standings</h2>
            <WCGroupTable group={groupTable.group ?? ''} table={groupTable.table} qualifications={groupQualStatus} />
            <Link href={`/world-cup-2026/group-${team.group.toLowerCase()}`}
              className="inline-block mt-2 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
              Full Group {team.group} details →
            </Link>
          </section>
        )}

        {/* Knockout run */}
        {knockout.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">Knockout Run</h2>
            <div className="space-y-2">
              {knockout.map((m) => <ResultRow key={m.id} m={m} teamId={teamId} />)}
            </div>
          </section>
        )}

        {/* All matches */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">All {team.name} Matches</h2>
          <div className="space-y-2">
            {sortedAsc.map((m) => <ResultRow key={m.id} m={m} teamId={teamId} />)}
          </div>
        </section>

        <AdSlot slotId={`team-${slug}-mid`} variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">{team.name} at World Cup 2026 — FAQ</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <WCRelatedLinks links={[
          { href: `/world-cup-2026/group-${team.group.toLowerCase()}`, icon: '🗂️', label: `Group ${team.group}`, desc: `Final table, fixtures and results for Group ${team.group}` },
          { href: '/world-cup-2026/bracket',   icon: '🔗', label: 'Knockout Bracket', desc: 'Round of 32 through to the Final' },
          { href: '/world-cup-2026/results',   icon: '🏁', label: 'WC 2026 Results',  desc: 'Full-time scores for every match' },
          { href: '/world-cup-2026/teams',     icon: '👥', label: 'All 48 Teams',     desc: 'Every nation at World Cup 2026' },
        ]} />
      </div>
    </>
  );
}

function ResultRow({ m, teamId }: { m: Match; teamId: number }) {
  const d = deriveMatchDisplay(m);
  const home = m.homeTeam?.id === teamId;
  const hs = m.score.fullTime.home ?? 0, as = m.score.fullTime.away ?? 0;
  const result = hs === as ? 'D' : (home ? hs > as : as > hs) ? 'W' : 'L';
  const label = STAGE_LABEL[m.stage ?? ''] ?? m.stage ?? '';
  return (
    <Link href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
      className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border ${
          result === 'W' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
          result === 'D' ? 'bg-gray-700 text-gray-300 border-gray-600' :
          'bg-red-500/20 text-red-400 border-red-500/30'
        }`}>{result}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors truncate">
            {m.homeTeam?.name} vs {m.awayTeam?.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{label} · {fmtDate(m.utcDate)}</p>
        </div>
      </div>
      <span className="text-white font-bold font-mono text-sm shrink-0">
        {d.homeScore ?? '–'} – {d.awayScore ?? '–'}
        {d.showPenalty ? ' (P)' : ''}
      </span>
    </Link>
  );
}
