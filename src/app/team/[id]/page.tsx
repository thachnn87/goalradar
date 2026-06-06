/**
 * /team/[id] — permanent redirect to the canonical SEO team page.
 *
 * The old numeric-ID URL (/team/57) is retained as a redirect source so
 * existing external links, bookmarks, and any un-updated internal links
 * all reach the canonical page at /teams/57-arsenal-fc without a dead end.
 *
 * 308 Permanent Redirect: tells crawlers and browsers to update their
 * records; the new /teams/[slug] page carries the canonical authority.
 */

import { permanentRedirect } from 'next/navigation';
import { getTeam } from '@/lib/api';
import { teamPath } from '@/lib/url';

// Redirect is stable once the team name is known. Revalidate daily.
export const revalidate = 86400;

type Params = { params: Promise<{ id: string }> };

export default async function TeamIdRedirect({ params }: Params) {
  const { id } = await params;

  try {
    const team = await getTeam(id);
    permanentRedirect(teamPath(team.id, team.name));
  } catch {
    // Team not found or API unavailable — redirect to the slug pattern so the
    // /teams/[slug] page can handle the 404 or show an error state itself.
    permanentRedirect(`/teams/${id}`);
  }
}
