import type { Metadata } from 'next';
import { getLiveMatches } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import LiveRefresher from '@/components/LiveRefresher';
import Breadcrumb from '@/components/Breadcrumb';
import AdSlot from '@/components/AdSlot';
import { Match } from '@/lib/types';
// PERF-8 Phase 3: seed KV snapshots for the first visible matches on idle
import SnapshotPrewarmHints from '@/components/SnapshotPrewarmHints';
import { generateTraceId, generateCorrelationId, runWithTrace, isTracingEnabled } from '@/lib/tracing';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Live Football Scores | Live Match Updates | GoalRadar',
  description:
    'Live football scores updated in real time. Follow every goal, card and event from matches currently in play — World Cup 2026, Premier League, Champions League and more.',
  alternates: { canonical: 'https://goalradar.org/live' },
  openGraph: {
    title: 'Live Football Scores | GoalRadar',
    description:
      'Real-time live football scores and match updates from World Cup 2026 and top European leagues.',
    type: 'website',
    url: 'https://goalradar.org/live',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Football Scores | GoalRadar',
    description: 'Real-time live football scores and match updates.',
  },
};

export default async function LivePage() {
  // LIVE-21 Phase 1: wrap request in trace context
  const shouldTrace = isTracingEnabled();
  const traceId = shouldTrace ? generateTraceId() : 'untraced';
  const utcDate = new Date().toISOString();
  const correlationId = generateCorrelationId(0, utcDate); // 0 = live page (no specific match)

  let matches: Match[] = [];
  let error = false;

  try {
    const { matches: data } = await runWithTrace(traceId, correlationId, async () => {
      const result = await getLiveMatches();
      return result;
    });
    matches = data;
  } catch {
    error = true;
  }

  return (
    <div className="space-y-6">
      <SnapshotPrewarmHints ids={matches.slice(0, 10).map((m) => m.id)} />
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
          Live match data is temporarily unavailable. Please try again later.
        </div>
      )}

      {!error && matches.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-gray-300 font-semibold">No live matches right now</p>
          <p className="text-gray-500 text-sm mt-1">Check back during match hours</p>
        </div>
      )}

      <AdSlot slotId="live-top" variant="banner" />

      {!error && matches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}

      <AdSlot slotId="live-bottom" variant="banner" />
    </div>
  );
}
