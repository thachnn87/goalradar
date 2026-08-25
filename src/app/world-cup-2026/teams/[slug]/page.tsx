/**
 * /world-cup-2026/teams/[slug]
 *
 * Programmatic SEO pages for the World Cup 2026 teams.
 *
 * EPIC-WC-FROZEN-DATA-001 Phase 2C: when the frozen FIFA dataset is active the
 * page renders a real, FIFA-derived team profile (group, results, standing,
 * knockout run) via FrozenTeamProfile — including honest "did not take part"
 * pages for preserved legacy URLs whose nation was not in the 48-team field.
 * While the gate is off it renders an honest "unavailable" shell and never
 * asserts synthetic WC_ALL_TEAMS participation.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WC_ALL_TEAM_SLUGS, getWCTeam } from '@/lib/wc-all-teams';
import { WC_2026_HISTORICAL_AVAILABLE } from '@/lib/wc-frozen';
import { frozenTeamSlugs } from '@/lib/wc-frozen-view';
import FrozenTeamProfile, { resolveFrozenTeamStatus } from '@/components/FrozenTeamProfile';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';

export const revalidate = 3600;

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Static params & metadata
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  // Union of legacy editorial slugs (preserve existing URLs) + real frozen-roster
  // slugs (12 nations the synthetic roster never had). Legacy-only slugs for
  // nations that did not play resolve to an honest "did not take part" page.
  const slugs = new Set<string>([...WC_ALL_TEAM_SLUGS, ...frozenTeamSlugs()]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canonicalUrl = `${BASE_URL}/world-cup-2026/teams/${slug}`;

  // Frozen dataset active → real, FIFA-derived metadata (or an honest
  // "did not take part" title for a preserved legacy URL).
  if (WC_2026_HISTORICAL_AVAILABLE) {
    const known = new Set<string>([...WC_ALL_TEAM_SLUGS, ...frozenTeamSlugs()]);
    if (!known.has(slug)) return {};
    const st = resolveFrozenTeamStatus(slug);
    if (st.kind === 'absent') {
      return {
        title: `${st.name} & the FIFA World Cup 2026 | GoalRadar`,
        description: `${st.name} did not take part in the FIFA World Cup 2026. See the 48 nations that competed.`,
        alternates: { canonical: canonicalUrl },
      };
    }
    const title = `${st.name} at World Cup 2026 — Group, Results & Knockout Run | GoalRadar`;
    const description = `${st.name}'s FIFA World Cup 2026 campaign: group, every match result, final standing and knockout run.`;
    return {
      title, description,
      alternates: { canonical: canonicalUrl },
      openGraph: { title, description, type: 'website', url: canonicalUrl },
      twitter: { card: 'summary_large_image', title, description },
    };
  }

  // Gate off: neutral metadata that makes no historical claim.
  const team = getWCTeam(slug);
  if (!team) return {};
  return {
    title: 'World Cup 2026 Team | GoalRadar',
    description: 'FIFA World Cup 2026 team information.',
    alternates: { canonical: canonicalUrl },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Frozen dataset active → real FIFA-derived team profile. Only serve known
  // routes (frozen roster + preserved legacy slugs); anything else is a 404.
  if (WC_2026_HISTORICAL_AVAILABLE) {
    const known = new Set<string>([...WC_ALL_TEAM_SLUGS, ...frozenTeamSlugs()]);
    if (!known.has(slug)) notFound();
    return <FrozenTeamProfile slug={slug} />;
  }

  // Gate off: only serve known (legacy) routes, as an honest "unavailable" shell.
  const team = getWCTeam(slug);
  if (!team) notFound();

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Breadcrumb items={[
        { label: 'Home', href: '/' },
        { label: 'World Cup 2026', href: '/world-cup-2026' },
        { label: 'Teams', href: '/world-cup-2026/teams' },
        { label: 'Team' },
      ]} />
      <div className="mt-3 mb-6"><WCPageNav /></div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center mt-6">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-gray-300 font-semibold">Team information unavailable</p>
        <p className="text-gray-500 text-sm mt-1">
          Confirmed World Cup 2026 data for this team is not available right now. Please check back soon.
        </p>
        <Link href="/world-cup-2026" className="inline-block mt-4 text-yellow-500 hover:text-yellow-300 text-sm font-medium transition-colors">
          ← World Cup 2026 hub
        </Link>
      </div>
    </div>
  );
}
