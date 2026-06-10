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
import { getTeamCached } from '@/lib/api';
import { teamPath } from '@/lib/url';

// Redirect is stable once the team name is known. Revalidate daily.
export const revalidate = 86400;

type Params = { params: Promise<{ id: string }> };

export default async function TeamIdRedirect({ params }: Params) {
  const { id } = await params;

  // Resolve the team name from KV (never calls provider).
  // getTeamCached returns null on KV miss — permanentRedirect falls back to
  // the bare numeric-ID path (/teams/{id}) which the teams page handles.
  const team = await getTeamCached(id);
  permanentRedirect(teamPath(team?.id ?? id, team?.name));
}
