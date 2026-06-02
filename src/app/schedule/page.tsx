import { Suspense } from 'react';
import { getUpcomingMatches, getRecentMatches } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import CompetitionSelector from '@/components/CompetitionSelector';
import { Match } from '@/lib/types';

export const revalidate = 300;

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const date = m.utcDate.split('T')[0];
    (acc[date] ??= []).push(m);
    return acc;
  }, {});
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

async function ScheduleContent({ competition }: { competition: string }) {
  let matches: Match[] = [];
  let mode: 'upcoming' | 'recent' = 'upcoming';
  let error = false;

  try {
    const upcoming = await getUpcomingMatches(competition);
    if (upcoming.resultSet.count > 0) {
      matches = upcoming.matches;
      mode = 'upcoming';
    } else {
      const recent = await getRecentMatches(competition);
      // Sort descending — newest first — and cap at 40 matches
      matches = [...recent.matches]
        .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
        .slice(0, 40);
      mode = 'recent';
    }
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
        Could not load matches — check your{' '}
        <code className="text-red-400">FOOTBALL_API_KEY</code>.
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-gray-300 font-medium">No fixtures available</p>
        <p className="text-gray-500 text-sm mt-1">
          Season may not have started yet or no data is available.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(matches);
  // upcoming: ascending; recent: descending (already sorted above)
  const dates =
    mode === 'upcoming'
      ? Object.keys(grouped).sort()
      : Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-8">
      {mode === 'recent' && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2">
          <span>⚠</span>
          <span>No upcoming fixtures — showing recent results (off-season)</span>
        </div>
      )}
      {dates.map((date) => (
        <section key={date}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {formatDate(date)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[date].map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-28 animate-pulse" />
      ))}
    </div>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const { competition = 'PL' } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Match Schedule</h1>
        <p className="text-gray-400 text-sm">Fixtures and results for the current season</p>
      </div>

      <Suspense fallback={null}>
        <CompetitionSelector selected={competition} />
      </Suspense>

      <Suspense fallback={<SkeletonGrid />}>
        <ScheduleContent competition={competition} />
      </Suspense>
    </div>
  );
}
