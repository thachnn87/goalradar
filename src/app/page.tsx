import Link from 'next/link';
import { getTodayMatches } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import { Match } from '@/lib/types';

export const revalidate = 60;

export default async function HomePage() {
  let matches: Match[] = [];
  let error = false;

  try {
    const data = await getTodayMatches();
    matches = data.matches;
  } catch {
    error = true;
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-green-950/60 to-gray-900 rounded-2xl p-8 border border-green-900/30 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">⚽</span>
            <h1 className="text-4xl font-black text-white tracking-tight">GoalRadar</h1>
          </div>
          <p className="text-gray-400 text-lg mb-6 max-w-xl">
            Live scores, standings, and schedules from Europe&apos;s top football leagues.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/live"
              className="bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Live Scores
            </Link>
            <Link
              href="/schedule"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Schedule
            </Link>
            <Link
              href="/standings"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Standings
            </Link>
          </div>
        </div>
      </div>

      {/* Today's Matches */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Today&apos;s Matches</h2>

        {error && (
          <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
            Match data is temporarily unavailable. Please try again later.
          </div>
        )}

        {!error && matches.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-gray-400 font-medium">No matches scheduled for today</p>
          </div>
        )}

        {!error && matches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
