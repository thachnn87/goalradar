/**
 * SEO Alias Route  —  /[alias]
 *
 * Handles human-readable match-intent URLs like:
 *   /mexico-vs-south-africa-live-score   → 308 → /match/{id}-{home}-vs-{away}
 *   /england-vs-usa-prediction           → 308 → /predict/{id}-{home}-vs-{away}   (GROWTH-2A)
 *
 * Strategy:
 *   1. generateStaticParams  — pre-builds an alias page for every WC fixture
 *      where both teams are known (one per suffix).
 *   2. generateMetadata      — sets alternates.canonical to the real target URL
 *      so Google sees the alias as equivalent to the canonical.
 *   3. Page component        — issues a 308 permanent redirect to the canonical
 *      URL for the matched suffix.
 *
 * Conflict safety: Next.js static routes take priority over [alias], so
 * /live, /schedule, /standings, etc. are never intercepted.
 *
 * Only slugs ending with a known suffix are handled; all others call notFound().
 */

import { permanentRedirect, notFound } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';

import {
  getUpcomingMatchesCached as getUpcomingMatches,
  getRecentMatchesCached   as getRecentMatches,
} from '@/lib/api';
import { slugify, matchPath, predictPath } from '@/lib/url';
import type { Match } from '@/lib/types';

// Aliases are stable — regenerate daily.
export const revalidate = 86400;

const SUFFIX = '-live-score';
const PREDICT_SUFFIX = '-prediction';
const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aliasFor(m: Match, suffix: string = SUFFIX): string | null {
  if (!m.homeTeam?.name || !m.awayTeam?.name) return null;
  return `${slugify(m.homeTeam.name)}-vs-${slugify(m.awayTeam.name)}${suffix}`;
}

/** Returns the matched suffix for an alias, or null if not a known pattern. */
function matchedSuffix(alias: string): string | null {
  if (alias.endsWith(SUFFIX))         return SUFFIX;
  if (alias.endsWith(PREDICT_SUFFIX)) return PREDICT_SUFFIX;
  return null;
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

function findMatch(alias: string, suffix: string, matches: Match[]): Match | null {
  const body = alias.slice(0, -suffix.length); // strip '-live-score' / '-prediction'
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
      const live = aliasFor(m, SUFFIX);
      if (live) params.push({ alias: live });
      // GROWTH-2A: prediction aliases — only for matches that haven't finished
      // (finished predictions are stale; /predict pages for them are excluded
      // from the sitemap for the same reason).
      if (m.status !== 'FINISHED') {
        const predict = aliasFor(m, PREDICT_SUFFIX);
        if (predict) params.push({ alias: predict });
      }
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

  const suffix = matchedSuffix(alias);
  if (!suffix) return { title: 'GoalRadar' };

  try {
    const matches = await fetchAllWCMatches();
    const m = findMatch(alias, suffix, matches);
    if (!m) return { title: 'Match | GoalRadar' };

    const home = m.homeTeam.name ?? 'TBD';
    const away = m.awayTeam.name ?? 'TBD';

    if (suffix === PREDICT_SUFFIX) {
      // Canonical points at the real prediction URL — alias is just an entry point.
      return {
        title: `${home} vs ${away} Prediction | FIFA World Cup 2026`,
        description: `${home} vs ${away} match prediction, score forecast and betting-free analysis for World Cup 2026.`,
        alternates: { canonical: `${BASE_URL}${predictPath(m.id, home, away)}` },
      };
    }

    return {
      title: `${home} vs ${away} Live Score | FIFA World Cup 2026`,
      description: `Follow ${home} vs ${away} live score, match results and World Cup 2026 updates.`,
      // Canonical points at the real match URL — alias is just an entry point.
      alternates: { canonical: `${BASE_URL}${matchPath(m.id, home, away)}` },
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

  // Only handle our known patterns — anything else is a genuine 404.
  const suffix = matchedSuffix(alias);
  if (!suffix) {
    notFound();
  }

  const matches = await fetchAllWCMatches();
  const m = findMatch(alias, suffix, matches);

  if (!m) {
    notFound();
  }

  // 308 Permanent Redirect → canonical URL for the matched intent.
  // Browsers and crawlers follow this and update their links.
  if (suffix === PREDICT_SUFFIX) {
    permanentRedirect(predictPath(m.id, m.homeTeam.name, m.awayTeam.name));
  }
  permanentRedirect(matchPath(m.id, m.homeTeam.name, m.awayTeam.name));
}
