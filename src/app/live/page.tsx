import { getLiveMatches } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import LiveRefresher from '@/components/LiveRefresher';
import Breadcrumb from '@/components/Breadcrumb';
import { Match } from '@/lib/types';

export const revalidate = 30;

export default async function LivePage() {
  let matches: Match[] = [];
  let error = false;

  try {
    const data = await getLiveMatches();
    matches = data.matches;
  } catch {
    error = true;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Live Scores' },
        ]}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            Live Scores
          </h1>
          <p className="text-gray-400 text-sm">Matches currently in play</p>
        </div>
        <LiveRefresher />
      </div>

      {error && (
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
          Could not load live matches — check your{' '}
          <code className="text-red-400">FOOTBALL_API_KEY</code>.
        </div>
      )}

      {!error && matches.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-gray-300 font-semibold">No live matches right now</p>
          <p className="text-gray-500 text-sm mt-1">Check back during match hours</p>
        </div>
      )}

      {!error && matches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
