/**
 * FrozenMatchDetail — real WC-2026 match page from the frozen FIFA dataset.
 * EPIC-WC-FROZEN-DATA-001 Phase 2C.
 *
 * Rendered by /match/[id] when the frozen gate is active AND the id belongs to
 * the frozen WC-2026 dataset. Serves the authoritative factual record (teams,
 * final score, penalties, stage, group, venue, date, winner) — no KV snapshot,
 * no provider, no synthetic data, no fabricated events/lineups. If frozen data
 * for the id is absent, the caller falls through to its normal path.
 */

import Link from 'next/link';
import { frozenMatchById } from '@/lib/wc-frozen-view';
import Breadcrumb from '@/components/Breadcrumb';
import { matchPath } from '@/lib/url';
import type { Metadata } from 'next';

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

/** True when this numeric id is a frozen WC-2026 match. */
export function isFrozenMatch(id: number): boolean {
  return !!frozenMatchById(id);
}

export function frozenMatchMetadata(id: number): Metadata {
  const m = frozenMatchById(id);
  if (!m) return {};
  const canonical = `${BASE_URL}${matchPath(Number(m.idMatch), m.home.name, m.away.name)}`;
  const title = `${m.home.name} ${m.homeScore}–${m.awayScore} ${m.away.name} — Match Result | FIFA World Cup 2026 | GoalRadar`;
  const stage = STAGE_LABEL[m.stage] ?? m.stage;
  const description = `${m.home.name} ${m.homeScore}–${m.awayScore} ${m.away.name} — FIFA World Cup 2026 ${stage}${m.group ? ` (Group ${m.group})` : ''}. Final result, venue and details.`;
  return {
    title, description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function FrozenMatchDetail({ id }: { id: number }) {
  const m = frozenMatchById(id)!; // caller guarantees presence via isFrozenMatch
  const stage = STAGE_LABEL[m.stage] ?? m.stage;

  const hs = m.homeScore, as = m.awayScore;
  const homeWon = m.winner === m.home.idTeam;
  const awayWon = m.winner === m.away.idTeam;
  const pens = m.homePenalty != null && m.awayPenalty != null
    ? ` (pens ${m.homePenalty}–${m.awayPenalty})` : '';
  const kickoff = new Date(m.dateUtc).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  const jsonLdEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${m.home.name} vs ${m.away.name}`,
    sport: 'Association football',
    startDate: m.dateUtc,
    eventStatus: 'https://schema.org/EventCompleted',
    location: m.venue ? {
      '@type': 'Place', name: m.venue.name,
      address: { '@type': 'PostalAddress', addressLocality: m.venue.city, addressCountry: m.venue.country },
    } : undefined,
    homeTeam: { '@type': 'SportsTeam', name: m.home.name },
    awayTeam: { '@type': 'SportsTeam', name: m.away.name },
    superEvent: { '@type': 'SportsEvent', name: 'FIFA World Cup 2026', url: `${BASE_URL}/world-cup-2026` },
    organizer: { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' },
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: `${m.home.name} vs ${m.away.name}`, item: `${BASE_URL}${matchPath(Number(m.idMatch), m.home.name, m.away.name)}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdEvent) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: `${m.home.name} vs ${m.away.name}` },
        ]} />

        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">FIFA World Cup 2026</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-400">{stage}{m.group ? ` · Group ${m.group}` : ''}</span>
          </div>

          <div className="grid grid-cols-3 items-center gap-4">
            <div className="text-center">
              <p className={`text-lg font-bold ${homeWon ? 'text-white' : 'text-gray-300'}`}>{m.home.name}</p>
              {homeWon && <p className="text-amber-400 text-xs mt-1 font-semibold">Winner</p>}
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-white tabular-nums">{hs}<span className="text-gray-600 mx-1">–</span>{as}</p>
              <p className="text-gray-500 text-xs mt-1">FT{pens}</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${awayWon ? 'text-white' : 'text-gray-300'}`}>{m.away.name}</p>
              {awayWon && <p className="text-amber-400 text-xs mt-1 font-semibold">Winner</p>}
            </div>
          </div>
        </div>

        {/* Facts */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800/60">
          <Row label="Competition" value="FIFA World Cup 2026" />
          <Row label="Stage" value={stage + (m.group ? ` — Group ${m.group}` : '')} />
          <Row label="Kick-off (UTC)" value={kickoff} />
          {m.venue && <Row label="Venue" value={`${m.venue.name}, ${m.venue.city} (${m.venue.country})`} />}
          <Row label="Result" value={`${m.home.name} ${hs}–${as} ${m.away.name}${pens}`} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {m.group && (
            <Link href={`/world-cup-2026/group-${m.group.toLowerCase()}`} className="text-yellow-500 hover:text-yellow-300 transition-colors">Group {m.group} →</Link>
          )}
          <Link href="/world-cup-2026/bracket" className="text-yellow-500 hover:text-yellow-300 transition-colors">Knockout bracket →</Link>
          <Link href="/world-cup-2026/results" className="text-yellow-500 hover:text-yellow-300 transition-colors">All results →</Link>
          <Link href="/world-cup-2026" className="text-yellow-500 hover:text-yellow-300 transition-colors">World Cup 2026 hub →</Link>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value}</span>
    </div>
  );
}
