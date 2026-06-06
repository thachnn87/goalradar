'use client';

/**
 * AnalyticsTracker
 *
 * Zero-render client component that fires a single GA4 custom event
 * on first mount.  Drop it inside any server component's JSX — it renders
 * null so it has no impact on layout or hydration.
 *
 * Usage:
 *   // match page (server component)
 *   <AnalyticsTracker event={{
 *     type:        'match_view',
 *     matchId:     match.id,
 *     homeTeam:    match.homeTeam.name,
 *     awayTeam:    match.awayTeam.name,
 *     competition: match.competition.code,
 *     status:      match.status,
 *   }} />
 */

import { useEffect } from 'react';
import { trackMatchView, trackTeamView, trackCompetitionView } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Event payload union — one discriminated type per custom event
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | {
      type:        'match_view';
      matchId:     number;
      homeTeam:    string;
      awayTeam:    string;
      competition: string;
      status?:     string;
    }
  | {
      type:     'team_view';
      teamId:   number | string;
      teamName: string;
    }
  | {
      type:            'competition_view';
      competitionCode: string;
      competitionName: string;
      context?:        'schedule' | 'standings' | 'overview';
    };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsTracker({ event }: { event: AnalyticsEvent }) {
  useEffect(() => {
    switch (event.type) {
      case 'match_view':
        trackMatchView({
          matchId:     event.matchId,
          homeTeam:    event.homeTeam,
          awayTeam:    event.awayTeam,
          competition: event.competition,
          status:      event.status,
        });
        break;

      case 'team_view':
        trackTeamView({
          teamId:   event.teamId,
          teamName: event.teamName,
        });
        break;

      case 'competition_view':
        trackCompetitionView({
          competitionCode: event.competitionCode,
          competitionName: event.competitionName,
          context:         event.context,
        });
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire exactly once on mount — event identity is fixed at render time

  return null;
}
