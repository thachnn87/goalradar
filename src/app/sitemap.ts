import { MetadataRoute } from 'next';
import { COMPETITIONS } from '@/lib/types';
import { getRecentMatches, getUpcomingMatches } from '@/lib/api';
import { matchPath } from '@/lib/url';

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
    // World Cup group pages (A–L)
    ...WC_GROUPS.map((g) => ({
      url: `${BASE_URL}/world-cup-2026/group-${g}`,
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
