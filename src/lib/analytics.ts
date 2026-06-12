/**
 * Google Analytics 4 event helpers.
 *
 * Safe to call from any client component — all functions guard against
 * server-side execution and missing/blocked gtag (ad-blockers, slow load).
 *
 * The GA4 script is injected in src/app/layout.tsx when the env var
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is set.  This module has no side-effects
 * and never imports browser APIs at module scope.
 *
 * Custom events fired by GoalRadar:
 *   page_view        — automatic via GA4 config (send_page_view: true)
 *   match_view       — user lands on a specific match detail page
 *   team_view        — user lands on a team profile page
 *   competition_view — user views a competition (schedule, standings, overview)
 */

// Extend the global Window type so TypeScript knows about gtag.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag:      (...args: any[]) => void;
    dataLayer: unknown[];
  }
}

// ---------------------------------------------------------------------------
// Internal send helper
// ---------------------------------------------------------------------------

function send(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;      // SSR guard
  if (typeof window.gtag !== 'function') return;  // not loaded / blocked
  window.gtag('event', eventName, params ?? {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Re-fire a page_view (useful for client-side navigation in hybrid layouts). */
export function trackPageView(url: string, title?: string): void {
  send('page_view', {
    page_location: url,
    ...(title ? { page_title: title } : {}),
  });
}

/** Fire when a user views a specific match detail page. */
export function trackMatchView(params: {
  matchId:     number;
  homeTeam:    string;
  awayTeam:    string;
  competition: string;
  status?:     string;
}): void {
  send('match_view', {
    match_id:     params.matchId,
    home_team:    params.homeTeam,
    away_team:    params.awayTeam,
    competition:  params.competition,
    match_status: params.status ?? '',
    content_type: 'match',
  });
}

/** LIVE-2: fire when a user clicks the World Cup live banner CTA. */
export function trackLiveBannerClick(params: {
  matchId?:       number | string | null;
  destination:    string;
  liveMatchCount: number;
}): void {
  send('live_banner_click', {
    match_id:         params.matchId != null ? String(params.matchId) : '',
    destination:      params.destination,
    live_match_count: params.liveMatchCount,
  });
}

/** GEO-1: fire when a user clicks a "Your country" chip on a match page. */
export function trackCountryChipClick(params: {
  country:  string;
  matchId:  number | string;
  pageType: string;
}): void {
  send('country_chip_click', {
    country:   params.country,
    match_id:  String(params.matchId),
    page_type: params.pageType,
  });
}

/** Fire when a user views a team profile page. */
export function trackTeamView(params: {
  teamId:   number | string;
  teamName: string;
}): void {
  send('team_view', {
    team_id:      String(params.teamId),
    team_name:    params.teamName,
    content_type: 'team',
  });
}

/** Fire when a user adds a match to their calendar. */
export function trackCalendarSubscribe(params: {
  matchId:     number | string;
  homeTeam:    string;
  awayTeam:    string;
  competition: string;
  /** 'google' | 'apple' | 'outlook' */
  calendarType: string;
}): void {
  send('calendar_subscribe', {
    match_id:      String(params.matchId),
    home_team:     params.homeTeam,
    away_team:     params.awayTeam,
    competition:   params.competition,
    calendar_type: params.calendarType,
    content_type:  'match',
  });
}

/** Fire when a user views a competition (schedule, standings, or hub). */
export function trackCompetitionView(params: {
  competitionCode: string;
  competitionName: string;
  context?:        'schedule' | 'standings' | 'overview';
}): void {
  send('competition_view', {
    competition_code: params.competitionCode,
    competition_name: params.competitionName,
    view_context:     params.context ?? 'overview',
    content_type:     'competition',
  });
}
