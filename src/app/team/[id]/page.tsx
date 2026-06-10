/**
 * /team/[id] — permanent redirect to the canonical SEO team page.
 *
 * The old numeric-ID URL (/team/57) is retained as a redirect source so
 * existing external links, bookmarks, and any un-updated internal links
 * all reach the canonical page at /teams/57-arsenal-fc without a dead end.
 *
 * SEO-6 FIX 4 — single-hop redirect guarantee:
 *   The team name must be resolved BEFORE redirecting, otherwise the
 *   destination is a non-canonical slug (/teams/57-tbd) that the
 *   /teams/[slug] page 308s again — a 2-hop chain that dilutes redirect
 *   signal. Name resolution order (all KV-only, never calls provider):
 *     1. goalradar:/teams/{id}              — team detail KV entry
 *     2. League standings KV (orchestrator-seeded, always warm) — scan
 *        every tracked competition's table for the team ID
 *   Only if both miss does the redirect fall back to the bare-ID form,
 *   which the /teams/[slug] page resolves with one extra hop.
 *
 * 308 Permanent Redirect: tells crawlers and browsers to update their
 * records; the new /teams/[slug] page carries the canonical authority.
 */

import { permanentRedirect } from 'next/navigation';
import { getTeamCached, getStandingsCached } from '@/lib/api';
import { teamPath } from '@/lib/url';
import { COMPETITIONS } from '@/lib/types';

// Redirect is stable once the team name is known. Revalidate daily.
export const revalidate = 86400;

type Params = { params: Promise<{ id: string }> };

/** Find the team name in any tracked competition's standings (KV-only). */
async function resolveNameFromStandings(id: number): Promise<string | null> {
  const leagueComps = COMPETITIONS.filter((c) => c.code !== 'WC');
  const results = await Promise.allSettled(
    leagueComps.map((c) => getStandingsCached(c.code)),
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const table of r.value.standings) {
      if (table.type !== 'TOTAL') continue;
      const row = table.table.find((t) => t.team.id === id);
      if (row) return row.team.name;
    }
  }
  return null;
}

export default async function TeamIdRedirect({ params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);

  // 1. Team detail KV entry (never calls provider)
  const team = await getTeamCached(id);
  let name: string | null | undefined = team?.name;

  // 2. Standings fallback — orchestrator-seeded, warm for all league teams
  if (!name && Number.isFinite(numId)) {
    name = await resolveNameFromStandings(numId);
  }

  if (name) {
    // Single-hop: /team/57 → /teams/57-arsenal-fc (final canonical)
    permanentRedirect(teamPath(team?.id ?? id, name));
  }

  // Last resort: bare-ID form. /teams/[slug] resolves it (one extra hop,
  // only when both the team KV entry and all standings tables miss).
  permanentRedirect(`/teams/${id}`);
}
