/**
 * /world-cup-2026/team/[slug]  →  301 permanent redirect
 *
 * The canonical URL for team pages is /world-cup-2026/teams/[slug] (plural).
 * This file captures the singular variant (/team/) so any inbound links,
 * bookmarks or search-engine references using that pattern land correctly
 * without incurring a duplicate-content penalty.
 *
 * All 48 team slugs are pre-generated at build time so the redirect is
 * served as a static response — no SSR overhead.
 *
 * NOTE: The redirect page intentionally has no metadata / OG / canonical
 * output — search engines follow the 308 and index the canonical page.
 */

import { permanentRedirect } from 'next/navigation';
import { WC_ALL_TEAM_SLUGS } from '@/lib/wc-all-teams';

export function generateStaticParams() {
  return WC_ALL_TEAM_SLUGS.map((slug) => ({ slug }));
}

// Runtime redirects are still valid at build time for the known slugs.
// Unknown slugs fall through to a 404 via the not-found boundary.
export default async function WCTeamRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/world-cup-2026/teams/${slug}`);
}
