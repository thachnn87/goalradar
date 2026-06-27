/**
 * MatchTimeline — DATA-18WC.EXPERIENCE.V2
 *
 * Chronological spine of match events: goals, bookings, substitutions.
 * Events from goals[], bookings[], substitutions[] are merged by minute
 * and rendered on a horizontal time axis split at half-time.
 *
 * Data: MatchDetail.goals / .bookings / .substitutions (already in snapshot).
 * Does NOT fetch. Receives MatchDetail as prop.
 *
 * Reuses: MatchDetail, Goal, Booking, Substitution from @/lib/types
 */

import type { MatchDetail, Goal, Booking, Substitution } from '@/lib/types';

// ---------------------------------------------------------------------------
// Internal event union
// ---------------------------------------------------------------------------

type EventKind = 'GOAL' | 'GOAL_OWN' | 'GOAL_PENALTY' | 'YELLOW' | 'RED' | 'YELLOW_RED' | 'SUB';

interface TimelineEvent {
  minute:    number;
  injuryTime?: number | null;
  kind:      EventKind;
  teamId:    number;
  primary:   string;   // scorer / booked player / player out
  secondary?: string;  // assist / player in
  icon:      string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minuteLabel(minute: number, injuryTime?: number | null): string {
  return injuryTime ? `${minute}+${injuryTime}'` : `${minute}'`;
}

function mergeEvents(match: MatchDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const g of match.goals ?? []) {
    const kind: EventKind =
      g.type === 'OWN'     ? 'GOAL_OWN' :
      g.type === 'PENALTY' ? 'GOAL_PENALTY' :
      'GOAL';
    events.push({
      minute:    g.minute,
      injuryTime: g.injuryTime,
      kind,
      teamId:    g.team?.id ?? 0,
      primary:   g.scorer?.name ?? 'Unknown',
      secondary: g.assist?.name,
      icon: kind === 'GOAL_OWN' ? '⚽ (OG)' : kind === 'GOAL_PENALTY' ? '⚽ (P)' : '⚽',
    });
  }

  for (const b of match.bookings ?? []) {
    const kind: EventKind =
      b.card === 'RED'         ? 'RED'         :
      b.card === 'YELLOW_RED'  ? 'YELLOW_RED'  :
      'YELLOW';
    events.push({
      minute:  b.minute,
      kind,
      teamId:  b.team?.id ?? 0,
      primary: b.player?.name ?? 'Unknown',
      icon: kind === 'RED' ? '🟥' : kind === 'YELLOW_RED' ? '🟧' : '🟨',
    });
  }

  for (const s of match.substitutions ?? []) {
    events.push({
      minute:    s.minute,
      kind:      'SUB',
      teamId:    s.team?.id ?? 0,
      primary:   s.playerOut?.name ?? 'Unknown',
      secondary: s.playerIn?.name,
      icon: '🔄',
    });
  }

  return events.sort((a, b) => {
    const ma = a.minute * 100 + (a.injuryTime ?? 0);
    const mb = b.minute * 100 + (b.injuryTime ?? 0);
    return ma - mb;
  });
}

// ---------------------------------------------------------------------------
// Single event bubble
// ---------------------------------------------------------------------------

function EventBubble({
  event,
  isHome,
}: {
  event: TimelineEvent;
  isHome: boolean;
}) {
  const label = minuteLabel(event.minute, event.injuryTime);

  return (
    <div className={`flex items-start gap-1.5 ${isHome ? '' : 'flex-row-reverse text-right'}`}>
      <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">
        {event.icon}
      </span>
      <div className={`flex flex-col ${isHome ? '' : 'items-end'}`}>
        <span className="text-white text-xs font-semibold leading-tight">{event.primary}</span>
        {event.secondary && (
          <span className="text-gray-500 text-[10px] leading-tight">
            {event.kind === 'SUB' ? `↑ ${event.secondary}` : `↗ ${event.secondary}`}
          </span>
        )}
        <span className="text-gray-600 text-[10px]">{label}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function MatchTimeline({ match }: { match: MatchDetail }) {
  const allEvents = mergeEvents(match);
  if (!allEvents.length) return null;

  const firstHalf  = allEvents.filter((e) => e.minute <= 45 || (e.minute === 45 && (e.injuryTime ?? 0) > 0));
  const secondHalf = allEvents.filter((e) => e.minute > 45);

  const homeId = match.homeTeam.id;
  const homeShort = match.homeTeam.shortName || match.homeTeam.name;
  const awayShort = match.awayTeam.shortName || match.awayTeam.name;

  function renderHalf(events: TimelineEvent[], label: string) {
    if (!events.length) return null;
    return (
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{label}</p>
        <div className="space-y-2">
          {events.map((e, i) => (
            <EventBubble key={i} event={e} isHome={e.teamId === homeId} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
        Match Timeline
      </h2>

      {/* Team headers */}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-4">
        <span>{homeShort}</span>
        <span className="text-right">{awayShort}</span>
      </div>

      {/* Two-column layout: home events left, away events right */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        {/* First half — home side */}
        <div className="space-y-3">
          {firstHalf.filter(e => e.teamId === homeId).length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">1st Half</p>
              <div className="space-y-2">
                {firstHalf.filter(e => e.teamId === homeId).map((e, i) => (
                  <EventBubble key={i} event={e} isHome={true} />
                ))}
              </div>
            </>
          )}
        </div>
        {/* First half — away side */}
        <div className="space-y-3">
          {firstHalf.filter(e => e.teamId !== homeId).length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">1st Half</p>
              <div className="space-y-2">
                {firstHalf.filter(e => e.teamId !== homeId).map((e, i) => (
                  <EventBubble key={i} event={e} isHome={false} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Half-time divider — spans both columns */}
        {secondHalf.length > 0 && (
          <>
            <div className="col-span-2 flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest px-2">
                Half Time
              </span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Second half — home side */}
            <div className="space-y-2">
              {secondHalf.filter(e => e.teamId === homeId).map((e, i) => (
                <EventBubble key={i} event={e} isHome={true} />
              ))}
            </div>
            {/* Second half — away side */}
            <div className="space-y-2">
              {secondHalf.filter(e => e.teamId !== homeId).map((e, i) => (
                <EventBubble key={i} event={e} isHome={false} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
