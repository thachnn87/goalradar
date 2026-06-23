import { Suspense } from 'react';
// PERF-4.5 / DATA-4 unified authority
import { getUpcomingMatchesCached, getRecentMatchesCached, getWCAuthorityMatchesCached } from '@/lib/api';
// WC-LIVE-SSOT: single source of truth for live WC match state
import { getCurrentLiveMatches, getLiveMatchIdSet } from '@/lib/wc-live-ssot';
import MatchCard from '@/components/MatchCard';
import CompetitionSelector from '@/components/CompetitionSelector';
import Breadcrumb from '@/components/Breadcrumb';
import WCCountdown from '@/components/WCCountdown';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import AdSlot from '@/components/ads/AdSlot';
import TimezoneBanner from '@/components/TimezoneBanner';
import LocalTime from '@/components/LocalTime';
import type { Metadata } from 'next';
import { Match, COMPETITIONS } from '@/lib/types';
// PERF-8 Phase 3: seed KV snapshots for the first visible matches on idle
import SnapshotPrewarmHints from '@/components/SnapshotPrewarmHints';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Football Schedule | GoalRadar',
    description:
      'Live football fixtures, match schedules and recent results from Europe top leagues.',
    alternates: { canonical: 'https://goalradar.org/schedule' },
    openGraph: {
      title: 'Football Schedule | GoalRadar',
      description:
        'Live football fixtures, match schedules and recent results from Europe top leagues.',
      type: 'website',
      url: 'https://goalradar.org/schedule',
    },
  };
}

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, match) => {
    const date = match.utcDate.split('T')[0];
    (acc[date] ??= []).push(match);
    return acc;
  }, {});
}


function formatDate(iso: string) {
  const date = new Date(iso);

  const today = new Date()
    .toISOString()
    .split('T')[0];

  const tomorrow = new Date(
    Date.now() + 86400000
  )
    .toISOString()
    .split('T')[0];

  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';

  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

async function ScheduleContent({
  competition,
}: {
  competition: string;
}) {
  let matches: Match[] = [];

  let mode: 'upcoming' | 'recent' = 'upcoming';

  try {
    if (competition === 'WC') {
      // DATA-4 unified: authority function merges SCHEDULED/TIMED + FINISHED so a
      // finished match is never shown as upcoming. Schedule shows SCHEDULED/TIMED
      // matches going forward; past matches have correct FT scores via MatchCard.
      const [authority, liveMatchIds] = await Promise.all([
        getWCAuthorityMatchesCached(),
        getLiveMatchIdSet().catch(() => new Set<number>()),
      ]);
      // DATA-18B.3E: live is decided ONLY by the live SSOT (liveMatchIds), never
      // by authority status. Normalise status so MatchCard (which reads
      // match.status) never shows a non-SSOT match as live: SSOT-live → IN_PLAY;
      // authority-live but absent from SSOT (ended) → FINISHED.
      matches = authority.matches.map((m) => {
        const authLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
        if (liveMatchIds.has(m.id)) return authLive ? m : { ...m, status: 'IN_PLAY' as Match['status'] };
        return authLive ? { ...m, status: 'FINISHED' as Match['status'] } : m;
      });
      mode = 'upcoming';
    } else {
      const upcoming = await getUpcomingMatchesCached(competition);

      if (upcoming.resultSet.count > 0) {
        matches = upcoming.matches;
        mode = 'upcoming';
      } else {
        const recent = await getRecentMatchesCached(competition);

        matches = [...recent.matches]
          .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
          .slice(0, 40);

        mode = 'recent';
      }
    }
  } catch (error) {
    console.error(
      '[Schedule] Fixtures unavailable, falling back:',
      error instanceof Error ? error.message : String(error)
    );

    try {
      const recent = await getRecentMatchesCached(competition);

      matches = [...recent.matches]
        .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
        .slice(0, 40);

      mode = 'recent';
    } catch (fallbackError) {
      console.error(
        '[Schedule] Fallback also unavailable:',
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      );

      return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
          <div className="text-gray-400 font-medium">
            Fixtures temporarily unavailable
          </div>
          <div className="text-gray-500 text-sm mt-2">
            Please try again in a few minutes.
          </div>
        </div>
      );
    }
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-gray-300 font-medium">No fixtures available</p>
        <p className="text-gray-500 text-sm mt-1">Season may not have started yet.</p>
      </div>
    );
  }

  // DATA-4: snapshot state overlay now happens inside the *Cached functions.
  const grouped = groupByDate(matches);

  const dates =
    mode === 'upcoming'
      ? Object.keys(grouped).sort()
      : Object.keys(grouped).sort((a, b) =>
          b.localeCompare(a)
        );

  return (
    <div className="space-y-8">
      {/* PERF-8 Phase 3: seed KV snapshots for the first visible matches */}
      <SnapshotPrewarmHints
        ids={dates.flatMap((d) => grouped[d]).slice(0, 10).map((m) => m.id)}
      />
      {mode === 'recent' && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2">
          <span>⚠</span>

          <span>
            No upcoming fixtures — showing recent
            results (off-season)
          </span>
        </div>
      )}

      {dates.map((date) => (
        <section key={date}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {formatDate(date)}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[date].map((match) => (
              <MatchCard
                key={match.id}
                match={match}
              />
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
        <div
          key={i}
          className="bg-gray-900 border border-gray-800 rounded-xl h-28 animate-pulse"
        />
      ))}
    </div>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    competition?: string;
  }>;
}) {
  const {
    competition = 'WC', // World Cup is the default competition
  } = await searchParams;

  const competitionMeta = COMPETITIONS.find((c) => c.code === competition);
  const competitionName = competitionMeta?.name ?? competition;

  const wcLiveMatches: Match[] = competition === 'WC'
    ? await getCurrentLiveMatches()
    : [];

  return (
    <div className="space-y-6">
      <AnalyticsTracker event={{
        type:            'competition_view',
        competitionCode: competition,
        competitionName: competitionName,
        context:         'schedule',
      }} />
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Schedule' },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Match Schedule
        </h1>

        <p className="text-gray-400 text-sm">
          Fixtures and results for the
          current season
        </p>
      </div>

      {/* Show compact countdown when WC tab is selected, with real live match data */}
      {competition === 'WC' && (
        <WCCountdown compact currentPath="/schedule" liveMatches={wcLiveMatches} />
      )}

      {/* Above-fold banner — height reserved to prevent CLS */}
      <AdSlot slotId="schedule-top" variant="banner" />

      {/* Timezone banner — client island, no hydration mismatch */}
      <TimezoneBanner />

      <Suspense fallback={null}>
        <CompetitionSelector
          selected={competition}
        />
      </Suspense>

      <Suspense fallback={<SkeletonGrid />}>
        <ScheduleContent
          competition={competition}
        />
      </Suspense>

      {/* Mid-page rectangle — desktop 300×250, centered */}
      <AdSlot slotId="schedule-mid" variant="rectangle" className="mx-auto" />

      {/* Below-fold banner */}
      <AdSlot slotId="schedule-bottom" variant="banner" />
    </div>
  );
}