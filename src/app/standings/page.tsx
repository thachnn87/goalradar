import type { Metadata } from 'next';
import { Suspense } from 'react';
// PERF-4.5
import { getStandingsCached } from '@/lib/api';
import StandingsTable from '@/components/StandingsTable';
import CompetitionSelector from '@/components/CompetitionSelector';
import Breadcrumb from '@/components/Breadcrumb';
import AdSlot from '@/components/AdSlot';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import { StandingTable, COMPETITIONS } from '@/lib/types';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Football Standings & League Tables | GoalRadar',
  description:
    'Live football standings and league tables — World Cup 2026 group standings, Premier League table, Champions League, La Liga and all top European leagues updated after every match.',
  alternates: { canonical: 'https://goalradar.org/standings' },
  openGraph: {
    title: 'Football Standings & League Tables | GoalRadar',
    description:
      'Live football league tables — World Cup 2026 groups, Premier League, Champions League and more.',
    type: 'website',
    url: 'https://goalradar.org/standings',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Standings & League Tables | GoalRadar',
    description: 'Live football standings for all top leagues and World Cup 2026 groups.',
  },
};

async function StandingsContent({ competition }: { competition: string }) {
  let standings: StandingTable[] = [];
  let competitionName = '';
  let competitionEmblem = '';
  let error = false;

  try {
    const data = await getStandingsCached(competition);
    standings = data.standings;
    competitionName = data.competition.name;
    competitionEmblem = data.competition.emblem;
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
        Standings are temporarily unavailable. Please try again later.
      </div>
    );
  }

  const totalTable = standings.find((s) => s.type === 'TOTAL');

  if (!totalTable) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
        Standings not available for this competition yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {competitionEmblem && (
            <img src={competitionEmblem} alt="" width={32} height={32} className="object-contain" />
          )}
          <h2 className="text-lg font-semibold text-white">{competitionName}</h2>
        </div>
        <a
          href={`/competition/${competition}`}
          className="text-xs text-gray-500 hover:text-white transition-colors shrink-0"
        >
          Full competition →
        </a>
      </div>
      <StandingsTable table={totalTable.table} />
    </div>
  );
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const { competition = 'PL' } = await searchParams;

  const competitionMeta = COMPETITIONS.find((c) => c.code === competition);
  const competitionName = competitionMeta?.name ?? competition;

  return (
    <div className="space-y-6">
      <AnalyticsTracker event={{
        type:            'competition_view',
        competitionCode: competition,
        competitionName: competitionName,
        context:         'standings',
      }} />
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Standings' },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Standings</h1>
        <p className="text-gray-400 text-sm">Current league tables</p>
      </div>

      <Suspense fallback={null}>
        <CompetitionSelector selected={competition} />
      </Suspense>

      <AdSlot slotId="standings-top" variant="banner" />

      <Suspense
        fallback={
          <div className="bg-gray-900 border border-gray-800 rounded-xl h-96 animate-pulse" />
        }
      >
        <StandingsContent competition={competition} />
      </Suspense>

      <AdSlot slotId="standings-bottom" variant="banner" />
    </div>
  );
}
