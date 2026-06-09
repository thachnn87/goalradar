/**
 * Dynamic XML sitemap index.
 *
 * Next.js serves this as a sitemap index at /sitemap.xml pointing to:
 *   /sitemap/0.xml  — core & static pages
 *   /sitemap/1.xml  — WC flat-URL SEO pages
 *   /sitemap/2.xml  — WC hub pages (groups, teams, venues, watch-live, tv)
 *   /sitemap/3.xml  — competition & league pages
 *   /sitemap/4.xml  — match pages (recent + upcoming, dynamic)
 *
 * Splitting by section keeps each child under 50 k URLs (Google's limit)
 * and lets Googlebot crawl high-priority WC pages on a separate budget.
 *
 * Revalidates every hour so match pages stay fresh without a full rebuild.
 */

import { MetadataRoute } from 'next';
import { kv } from '@vercel/kv';
import { COMPETITIONS } from '@/lib/types';
import { getRecentMatches, getUpcomingMatches, getStandings } from '@/lib/api';
import { matchPath, predictPath, teamPath } from '@/lib/url';
import { WC_TEAM_SLUGS } from '@/lib/wc-teams';
import { WC_WATCH_COUNTRY_SLUGS } from '@/lib/wc-watch-countries';
import { WC_TV_COUNTRY_SLUGS } from '@/lib/wc-tv-countries';
import { WC_VENUE_SLUGS } from '@/lib/wc-venues';
import { WC_ALL_TEAM_SLUGS } from '@/lib/wc-all-teams';

export const revalidate = 3600;
// Never pre-generate sitemaps at build time — the API is unavailable during
// `next build` and the timeout (60s) is shorter than the full fetch chain.
// Sitemaps are generated on first request and cached by ISR (revalidate=3600).
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// KV availability guard (same pattern used across the codebase)
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

/** Sitemap cache TTL: 24 hours.  Dynamic sitemaps are written here on every
 *  successful build so a future API failure can serve the last known-good list. */
const SITEMAP_CACHE_TTL_SEC = 24 * 3_600;

async function getCachedSitemap(key: string): Promise<MetadataRoute.Sitemap | null> {
  if (!KV_ENABLED) return null;
  try {
    return await kv.get<MetadataRoute.Sitemap>(key);
  } catch {
    return null;
  }
}

function setCachedSitemap(key: string, entries: MetadataRoute.Sitemap): void {
  if (!KV_ENABLED) return;
  kv.set(key, entries, { ex: SITEMAP_CACHE_TTL_SEC }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Last-resort URLs — served when a sitemap segment fails completely
// ---------------------------------------------------------------------------

/** Googlebot must always receive valid XML.  These URLs are returned when both
 *  the API fetch and the KV sitemap cache fail for any dynamic segment. */
const CRITICAL_URLS: MetadataRoute.Sitemap = [
  { url: BASE_URL,                          lastModified: new Date(), changeFrequency: 'daily',  priority: 1.0 },
  { url: `${BASE_URL}/world-cup-2026`,      lastModified: new Date(), changeFrequency: 'always', priority: 0.95 },
  { url: `${BASE_URL}/schedule`,            lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
  { url: `${BASE_URL}/standings`,           lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
  { url: `${BASE_URL}/live`,                lastModified: new Date(), changeFrequency: 'always', priority: 0.9 },
];

// WC 2026 group slugs A–L
const WC_GROUPS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

// ---------------------------------------------------------------------------
// Sitemap registry
// ---------------------------------------------------------------------------

export async function generateSitemaps() {
  return [
    { id: 0 }, // core static pages
    { id: 1 }, // WC flat-URL SEO pages
    { id: 2 }, // WC hub pages
    { id: 3 }, // competition & league pages
    { id: 4 }, // match pages (dynamic)
    { id: 5 }, // team pages (dynamic — built from standings)
  ];
}

export default async function sitemap({
  id: idParam,
}: {
  id: number | Promise<string | undefined>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await idParam);
  try {
    switch (id) {
      case 0:
        return coreStaticSitemap();
      case 1:
        return wcFlatSeoSitemap();
      case 2:
        return wcHubSitemap();
      case 3:
        return competitionSitemap();
      case 4:
        return matchSitemap();
      case 5:
        return teamSitemap();
      default:
        return [];
    }
  } catch (err) {
    console.error(
      `[SITEMAP] FALLBACK sitemap/${id} | unhandled error: ${err instanceof Error ? err.message : String(err)} | serving critical URLs`,
    );
    return CRITICAL_URLS;
  }
}

// ---------------------------------------------------------------------------
// 0 — Core static pages
// ---------------------------------------------------------------------------

function coreStaticSitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/live`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/schedule`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/standings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy-policy`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/affiliate-disclosure`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}

// ---------------------------------------------------------------------------
// 1 — WC flat-URL programmatic SEO pages
// ---------------------------------------------------------------------------

function wcFlatSeoSitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/world-cup-2026-schedule`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.93,
    },
    {
      url: `${BASE_URL}/world-cup-2026-results`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.92,
    },
    {
      url: `${BASE_URL}/world-cup-2026-standings`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.91,
    },
    {
      url: `${BASE_URL}/world-cup-2026-bracket`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026-groups`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.91,
    },
    {
      url: `${BASE_URL}/world-cup-2026-live-stream`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.88,
    },
    {
      url: `${BASE_URL}/world-cup-2026-tv-guide`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.88,
    },
    {
      url: `${BASE_URL}/world-cup-2026-predictions`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.92,
    },
  ];
}

// ---------------------------------------------------------------------------
// 2 — WC hub pages (fixtures, groups, bracket, teams, venues, watch-live, tv)
// ---------------------------------------------------------------------------

function wcHubSitemap(): MetadataRoute.Sitemap {
  return [
    // Hub root
    {
      url: `${BASE_URL}/world-cup-2026`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.95,
    },
    // Live sub-pages
    {
      url: `${BASE_URL}/world-cup-2026/fixtures`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026/results`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026/groups`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    // Sprint G5 — prediction hub + money pages
    {
      url: `${BASE_URL}/world-cup-2026/predictions`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.93,
    },
    {
      url: `${BASE_URL}/world-cup-2026/winner-predictions`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.92,
    },
    {
      url: `${BASE_URL}/world-cup-2026/golden-boot-predictions`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.92,
    },
    ...['a','b','c','d','e','f','g','h'].map((g) => ({
      url: `${BASE_URL}/world-cup-2026/group-${g}-predictions`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.88,
    })),
    // Sprint D2 — programmatic SEO hub pages
    {
      url: `${BASE_URL}/world-cup-2026/teams`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026/matches`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026/host-cities`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/bracket`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026/matches-today`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.92,
    },
    {
      url: `${BASE_URL}/world-cup-2026/matches-tomorrow`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.88,
    },
    // Evergreen content
    {
      url: `${BASE_URL}/world-cup-2026/watch-live`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/tv-schedule`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/streaming-guide`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/venues`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    // Group pages A–L
    ...WC_GROUPS.map((g) => ({
      url: `${BASE_URL}/world-cup-2026/group-${g}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.87,
    })),
    // Featured nation pages (legacy slugs: /world-cup-2026/argentina etc.)
    ...WC_TEAM_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.88,
    })),
    // All 48 WC team detail pages
    ...WC_ALL_TEAM_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/teams/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    })),
    // Watch Live country pages
    ...WC_WATCH_COUNTRY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/watch-live/${slug}`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly' as const,
      priority: 0.82,
    })),
    // TV schedule country pages
    ...WC_TV_COUNTRY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/tv-schedule/${slug}`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly' as const,
      priority: 0.84,
    })),
    // Venue detail pages
    ...WC_VENUE_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/venues/${slug}`,
      lastModified: new Date('2026-05-01'),
      changeFrequency: 'weekly' as const,
      priority: 0.80,
    })),
  ];
}

// ---------------------------------------------------------------------------
// 3 — Competition & league pages
// ---------------------------------------------------------------------------

function competitionSitemap(): MetadataRoute.Sitemap {
  // League competitions only (WC hub is handled by sitemap/2)
  const leagueComps = COMPETITIONS.filter((c) => c.code !== 'WC');

  return [
    // /competition/[code] — combined standings + fixtures + results per competition
    ...COMPETITIONS.map((comp) => ({
      url: `${BASE_URL}/competition/${comp.code}`,
      lastModified: new Date(),
      changeFrequency: (comp.code === 'WC' ? 'always' : 'hourly') as
        | 'always'
        | 'hourly',
      priority: comp.code === 'WC' ? 0.92 : 0.82,
    })),
    // /schedule?competition=X — supplemental crawl-discovery entries
    // Canonical for each is /competition/[code] — kept here to help discovery
    ...leagueComps.map((comp) => ({
      url: `${BASE_URL}/schedule?competition=${comp.code}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.70,
    })),
    // /standings?competition=X — supplemental crawl-discovery entries
    ...leagueComps.map((comp) => ({
      url: `${BASE_URL}/standings?competition=${comp.code}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.70,
    })),
  ];
}

// ---------------------------------------------------------------------------
// 4 — Match pages (dynamic)
// ---------------------------------------------------------------------------

async function matchSitemap(): Promise<MetadataRoute.Sitemap> {
  const KV_KEY = 'goalradar:sitemap:matches';

  try {
    const [recentResults, upcomingResults] = await Promise.all([
      Promise.allSettled(COMPETITIONS.map((c) => getRecentMatches(c.code))),
      Promise.allSettled(COMPETITIONS.map((c) => getUpcomingMatches(c.code))),
    ]);

    const allMatches = [
      ...recentResults.flatMap((r) =>
        r.status === 'fulfilled' ? r.value.matches : [],
      ),
      ...upcomingResults.flatMap((r) =>
        r.status === 'fulfilled' ? r.value.matches : [],
      ),
    ];

    // Deduplicate by match id
    const seen = new Set<number>();
    const entries: MetadataRoute.Sitemap = [];

    for (const match of allMatches) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);

      const isWC       = match.competition?.code === 'WC';
      const isLive     = ['IN_PLAY', 'PAUSED'].includes(match.status);
      const isFinished = match.status === 'FINISHED';
      const isUpcoming = match.status === 'SCHEDULED' || match.status === 'TIMED';

      // Match detail page
      entries.push({
        url: `${BASE_URL}${matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}`,
        lastModified: match.lastUpdated ? new Date(match.lastUpdated) : new Date(),
        changeFrequency: isLive
          ? ('always' as const)
          : isFinished
            ? ('weekly' as const)
            : ('hourly' as const),
        priority: isWC
          ? isLive ? 0.95 : 0.88
          : isLive ? 0.85 : 0.70,
      });

      // Prediction page — only for upcoming and live matches (finished predictions are stale)
      if (isUpcoming || isLive) {
        entries.push({
          url: `${BASE_URL}${predictPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}`,
          lastModified: match.lastUpdated ? new Date(match.lastUpdated) : new Date(),
          changeFrequency: isLive ? ('hourly' as const) : ('daily' as const),
          priority: isWC ? 0.82 : 0.65,
        });
      }
    }

    // Seed the KV cache for future fallback use
    if (entries.length > 0) setCachedSitemap(KV_KEY, entries);

    return entries;

  } catch (err) {
    console.error(
      `[SITEMAP] FALLBACK sitemap/4 | fetch error: ${err instanceof Error ? err.message : String(err)} | checking KV cache`,
    );
    const cached = await getCachedSitemap(KV_KEY);
    if (cached && cached.length > 0) {
      console.warn(`[SITEMAP] FALLBACK sitemap/4 | serving ${cached.length} cached match entries`);
      return cached;
    }
    console.warn(`[SITEMAP] FALLBACK sitemap/4 | no cache available — returning empty`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 5 — Team pages (built from standings across all tracked competitions)
// ---------------------------------------------------------------------------

async function teamSitemap(): Promise<MetadataRoute.Sitemap> {
  const KV_KEY = 'goalradar:sitemap:teams';

  try {
    // Fetch standings for every tracked competition in parallel.
    // Safe to fail per-competition — standings for other comps still included.
    const leagueComps = COMPETITIONS.filter((c) => c.code !== 'WC');

    const results = await Promise.allSettled(
      leagueComps.map((c) => getStandings(c.code)),
    );

    const seenTeamIds = new Set<number>();
    const entries:     MetadataRoute.Sitemap = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const totalTable = result.value.standings.find((s) => s.type === 'TOTAL');
      if (!totalTable) continue;

      for (const row of totalTable.table) {
        if (seenTeamIds.has(row.team.id)) continue;
        seenTeamIds.add(row.team.id);

        entries.push({
          url:             `${BASE_URL}${teamPath(row.team.id, row.team.name)}`,
          lastModified:    new Date(),
          changeFrequency: 'daily',
          priority:        0.70,
        });
      }
    }

    // Seed the KV cache for future fallback use
    if (entries.length > 0) setCachedSitemap(KV_KEY, entries);

    return entries;

  } catch (err) {
    console.error(
      `[SITEMAP] FALLBACK sitemap/5 | fetch error: ${err instanceof Error ? err.message : String(err)} | checking KV cache`,
    );
    const cached = await getCachedSitemap(KV_KEY);
    if (cached && cached.length > 0) {
      console.warn(`[SITEMAP] FALLBACK sitemap/5 | serving ${cached.length} cached team entries`);
      return cached;
    }
    console.warn(`[SITEMAP] FALLBACK sitemap/5 | no cache available — returning empty`);
    return [];
  }
}
