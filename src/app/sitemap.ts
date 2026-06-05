import { MetadataRoute } from 'next';
import { COMPETITIONS } from '@/lib/types';
import { getRecentMatches, getUpcomingMatches } from '@/lib/api';
import { matchPath } from '@/lib/url';
import { WC_TEAM_SLUGS } from '@/lib/wc-teams';
import { WC_WATCH_COUNTRY_SLUGS } from '@/lib/wc-watch-countries';
import { WC_TV_COUNTRY_SLUGS } from '@/lib/wc-tv-countries';
import { WC_VENUE_SLUGS } from '@/lib/wc-venues';
import { WC_ALL_TEAM_SLUGS } from '@/lib/wc-all-teams';

const BASE_URL = 'https://goalradar.org';

export const revalidate = 3600;

// WC 2026 group slugs (A–L)
const WC_GROUPS = ['a','b','c','d','e','f','g','h','i','j','k','l'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static routes ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
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
    // World Cup hub
    {
      url: `${BASE_URL}/world-cup-2026`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.95,
    },
    // World Cup fixtures page
    {
      url: `${BASE_URL}/world-cup-2026/fixtures`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    // World Cup groups page
    {
      url: `${BASE_URL}/world-cup-2026/groups`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    // World Cup bracket page
    {
      url: `${BASE_URL}/world-cup-2026/bracket`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    // World Cup results page
    {
      url: `${BASE_URL}/world-cup-2026/results`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    // World Cup evergreen SEO pages
    {
      url: `${BASE_URL}/world-cup-2026/watch-live`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/tv-schedule`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/world-cup-2026/streaming-guide`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    // World Cup group pages (A–L)
    ...WC_GROUPS.map((g) => ({
      url: `${BASE_URL}/world-cup-2026/group-${g}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    })),
    // World Cup team pages
    ...WC_TEAM_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.88,
    })),
    // World Cup Watch Live — country sub-pages
    ...WC_WATCH_COUNTRY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/watch-live/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.82,
    })),
    // Matches today / tomorrow (high priority — real-time search demand)
    {
      url: `${BASE_URL}/world-cup-2026/matches-today`,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.92,
    },
    {
      url: `${BASE_URL}/world-cup-2026/matches-tomorrow`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.88,
    },
    // TV schedule country pages
    ...WC_TV_COUNTRY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/tv-schedule/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.84,
    })),
    // Venue pages
    ...WC_VENUE_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/venues/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.80,
    })),
    // Phase 2 — programmatic flat-URL SEO pages (high-volume keyword targets)
    {
      url: `${BASE_URL}/world-cup-2026-schedule`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.93,
    },
    {
      url: `${BASE_URL}/world-cup-2026-results`,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.92,
    },
    {
      url: `${BASE_URL}/world-cup-2026-standings`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.91,
    },
    {
      url: `${BASE_URL}/world-cup-2026-bracket`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.90,
    },
    {
      url: `${BASE_URL}/world-cup-2026-live-stream`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.88,
    },
    {
      url: `${BASE_URL}/world-cup-2026-tv-guide`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.88,
    },
    {
      url: `${BASE_URL}/world-cup-2026-groups`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.91,
    },
    // Phase 3 — all 48 WC team pages at /world-cup-2026/teams/[slug]
    ...WC_ALL_TEAM_SLUGS.map((slug) => ({
      url: `${BASE_URL}/world-cup-2026/teams/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    })),
  ];

  // ── Match URLs ─────────────────────────────────────────────────────────────
  // Fetch recent + upcoming for every competition (including WC).
  // Upcoming covers future fixtures that getRecentMatches misses.
  const [recentResults, upcomingResults] = await Promise.all([
    Promise.allSettled(COMPETITIONS.map((c) => getRecentMatches(c.code))),
    Promise.allSettled(COMPETITIONS.map((c) => getUpcomingMatches(c.code))),
  ]);

  const allMatches = [
    ...recentResults.flatMap((r) => (r.status === 'fulfilled' ? r.value.matches : [])),
    ...upcomingResults.flatMap((r) => (r.status === 'fulfilled' ? r.value.matches : [])),
  ];

  // Deduplicate by match id
  const seen = new Set<number>();
  const matchUrls: MetadataRoute.Sitemap = [];

  for (const match of allMatches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);

    const isWC = match.competition?.code === 'WC';
    matchUrls.push({
      url: `${BASE_URL}${matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}`,
      lastModified: new Date(match.lastUpdated),
      changeFrequency: isWC ? ('always' as const) : ('hourly' as const),
      priority: isWC ? 0.9 : 0.7,
    });
  }

  return [...staticRoutes, ...matchUrls];
}
