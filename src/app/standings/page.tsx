import { Suspense } from 'react';
import { getStandings } from '@/lib/api';
import StandingsTable from '@/components/StandingsTable';
import CompetitionSelector from '@/components/CompetitionSelector';
import Breadcrumb from '@/components/Breadcrumb';
import { StandingTable } from '@/lib/types';

export const revalidate = 3600;

async function StandingsContent({ competition }: { competition: string }) {
  let standings: StandingTable[] = [];
  let competitionName = '';
  let competitionEmblem = '';
  let error = false;

  try {
    const data = await getStandings(competition);
    standings = data.standings;
    competitionName = data.competition.name;
    competitionEmblem = data.competition.emblem;
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
        Could not load standings — check your{' '}
        <code className="text-red-400">FOOTBALL_API_KEY</code>.
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

  return (
    <div className="space-y-6">
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

      <Suspense
        fallback={
          <div className="bg-gray-900 border border-gray-800 rounded-xl h-96 animate-pulse" />
        }
      >
        <StandingsContent competition={competition} />
      </Suspense>
    </div>
  );
}
