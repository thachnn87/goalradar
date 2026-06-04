import { MetadataRoute } from 'next';
import { COMPETITIONS } from '@/lib/types';
import { getRecentMatches } from '@/lib/api';

const BASE_URL = 'https://goalradar.org';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  ];

  // Fetch recent matches for all competitions in parallel, ignore individual failures
  const results = await Promise.allSettled(
    COMPETITIONS.map((c) => getRecentMatches(c.code))
  );

  const matchUrls: MetadataRoute.Sitemap = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value.matches : []))
    .filter(
      (match, index, self) =>
        // deduplicate by id (same match can appear in multiple competition queries)
        index === self.findIndex((m) => m.id === match.id)
    )
    .map((match) => ({
      url: `${BASE_URL}/match/${match.id}`,
      lastModified: new Date(match.lastUpdated),
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    }));

  return [...staticRoutes, ...matchUrls];
}
