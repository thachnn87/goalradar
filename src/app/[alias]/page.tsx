/**
 * SEO Alias Route  —  /[alias]
 *
 * Handles human-readable "live score" URLs like:
 *   /mexico-vs-south-africa-live-score
 *   /england-vs-usa-live-score
 *
 * Strategy:
 *   1. generateStaticParams  — pre-builds an alias page for every WC fixture
 *      where both teams are known (group stage, 72 matches).
 *   2. generateMetadata      — sets alternates.canonical to the real match URL
 *      so Google sees the alias as equivalent to the canonical.
 *   3. Page component        — issues a 308 permanent redirect to the canonical
 *      match URL (/match/[id]-[home]-vs-[away]).
 *
 * Conflict safety: Next.js static routes take priority over [alias], so
 * /live, /schedule, /standings, etc. are never intercepted.
 *
 * Only slugs ending with -live-score are handled; all others call notFound().
 */

import { permanentRedirect, notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';

import {
  getUpcomingMatchesCached as getUpcomingMatches,
  getRecentMatchesCached   as getRecentMatches,
} from '@/lib/api';
import { slugify, matchPath } from '@/lib/url';
import type { Match } from '@/lib/types';

// Aliases are stable — regenerate daily.
export const revalidate = 86400;

const SUFFIX = '-live-score';
const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aliasFor(m: Match): string | null {
  if (!m.homeTeam?.name || !m.awayTeam?.name) return null;
  return `${slugify(m.homeTeam.name)}-vs-${slugify(m.awayTeam.name)}${SUFFIX}`;
}

// React.cache() deduplicates this across generateMetadata + page component
// within a single request lifecycle. Both callers share one network fetch.
const fetchAllWCMatches = cache(async (): Promise<Match[]> => {
  const [upRes, recentRes] = await Promise.allSettled([
    getUpcomingMatches('WC'),
    getRecentMatches('WC'),
  ]);
  const upcoming = upRes.status     === 'fulfilled' ? upRes.value.matches     : [];
  const recent   = recentRes.status === 'fulfilled' ? recentRes.value.matches : [];
  const seen = new Set<number>();
  return [...upcoming, ...recent].filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
});

function findMatch(alias: string, matches: Match[]): Match | null {
  const body = alias.slice(0, -SUFFIX.length); // strip '-live-score'
  const vsIdx = body.indexOf('-vs-');
  if (vsIdx === -1) return null;

  const homeSlug = body.slice(0, vsIdx);
  const awaySlug = body.slice(vsIdx + 4);

  return matches.find(m =>
    m.homeTeam?.name &&
    m.awayTeam?.name &&
    slugify(m.homeTeam.name) === homeSlug &&
    slugify(m.awayTeam.name) === awaySlug
  ) ?? null;
}

// ---------------------------------------------------------------------------
// generateStaticParams — pre-build every known WC fixture alias
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  try {
    const matches = await fetchAllWCMatches();
    const params: { alias: string }[] = [];

    for (const m of matches) {
      const alias = aliasFor(m);
      if (alias) params.push({ alias });
    }

    console.log(`[Alias] generateStaticParams: ${params.length} WC fixture aliases generated`);
    return params;
  } catch (err) {
    console.error('[Alias] generateStaticParams failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata — canonical points to the match URL, not the alias
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { alias } = await params;

  if (!alias.endsWith(SUFFIX)) return { title: 'GoalRadar' };

  try {
    const matches = await fetchAllWCMatches();
    const m = findMatch(alias, matches);
    if (!m) return { title: 'Match | GoalRadar' };

    const home = m.homeTeam.name ?? 'TBD';
    const away = m.awayTeam.name ?? 'TBD';
    const canonical = `${BASE_URL}${matchPath(m.id, home, away)}`;

    return {
      title: `${home} vs ${away} Live Score | FIFA World Cup 2026`,
      description: `Follow ${home} vs ${away} live score, match results and World Cup 2026 updates.`,
      // Canonical points at the real match URL — alias is just an entry point.
      alternates: { canonical },
    };
  } catch {
    return { title: 'Match | GoalRadar' };
  }
}

// ---------------------------------------------------------------------------
// Page — 308 permanent redirect to canonical match URL
// ---------------------------------------------------------------------------

export default async function AliasPage({ params }: Params) {
  const { alias } = await params;

  // Only handle our known pattern — anything else is a genuine 404.
  if (!alias.endsWith(SUFFIX)) {
    notFound();
  }

  const matches = await fetchAllWCMatches();
  const m = findMatch(alias, matches);

  if (!m) {
    notFound();
  }

  // 308 Permanent Redirect → canonical match URL.
  // Browsers and crawlers follow this and update their links.
  permanentRedirect(matchPath(m.id, m.homeTeam.name, m.awayTeam.name));
}
