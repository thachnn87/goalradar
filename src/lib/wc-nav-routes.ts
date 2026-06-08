/**
 * wc-nav-routes.ts
 *
 * Canonical registry of all World Cup 2026 navigation hrefs.
 *
 * Purposes
 * ────────
 * 1. Single source of truth — every valid WC nav destination in one file.
 * 2. Build-time validation — import WC_VALID_HREFS_SET into any check that
 *    needs to assert href correctness at CI / `tsc --noEmit` time.
 * 3. Dev-mode runtime warning — WCRelatedLinks imports this and logs a
 *    console.warn when an unrecognised href is rendered in development.
 *
 * When to update
 * ──────────────
 * Add an entry whenever a new WC page is created.
 * Remove entries when pages are deleted (to surface stale cards at CI).
 */

// ---------------------------------------------------------------------------
// Flat-URL programmatic SEO pages  (/world-cup-2026-{section})
// ---------------------------------------------------------------------------

export const WC_FLAT_ROUTES = [
  '/world-cup-2026-schedule',
  '/world-cup-2026-results',
  '/world-cup-2026-standings',
  '/world-cup-2026-groups',
  '/world-cup-2026-bracket',
  '/world-cup-2026-live-stream',
  '/world-cup-2026-tv-guide',
] as const;

// ---------------------------------------------------------------------------
// Hub pages  (/world-cup-2026/{section})
// ---------------------------------------------------------------------------

export const WC_HUB_ROUTES = [
  '/world-cup-2026',
  '/world-cup-2026/fixtures',
  '/world-cup-2026/results',
  '/world-cup-2026/groups',
  '/world-cup-2026/bracket',
  '/world-cup-2026/watch-live',
  '/world-cup-2026/tv-schedule',
  '/world-cup-2026/streaming-guide',
  '/world-cup-2026/teams',
  '/world-cup-2026/venues',
  '/world-cup-2026/predictions',
  '/world-cup-2026/winner-predictions',
  '/world-cup-2026/golden-boot-predictions',
  '/world-cup-2026/matches',
  '/world-cup-2026/matches-today',
  '/world-cup-2026/matches-tomorrow',
  '/world-cup-2026/host-cities',
] as const;

// ---------------------------------------------------------------------------
// Cross-site roots used in WC nav  (/live, /schedule, /standings …)
// ---------------------------------------------------------------------------

export const WC_CROSS_ROUTES = [
  '/live',
  '/schedule',
  '/standings',
] as const;

// ---------------------------------------------------------------------------
// Combined set — used for O(1) membership checks
// ---------------------------------------------------------------------------

export const WC_VALID_HREFS_SET: ReadonlySet<string> = new Set([
  ...WC_FLAT_ROUTES,
  ...WC_HUB_ROUTES,
  ...WC_CROSS_ROUTES,
]);

// ---------------------------------------------------------------------------
// TypeScript union type — for strict typing if adopted by card definitions
// ---------------------------------------------------------------------------

export type WCFlatRoute  = (typeof WC_FLAT_ROUTES)[number];
export type WCHubRoute   = (typeof WC_HUB_ROUTES)[number];
export type WCCrossRoute = (typeof WC_CROSS_ROUTES)[number];

/** Union of every recognised WC navigation href. */
export type WCNavHref = WCFlatRoute | WCHubRoute | WCCrossRoute;

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Returns true when `href` is a known WC navigation destination.
 * Used by WCRelatedLinks at runtime (dev mode only) to surface stale hrefs
 * early — before they reach Googlebot or users.
 */
export function isValidWCNavHref(href: string): boolean {
  // Exact match against the canonical set
  if (WC_VALID_HREFS_SET.has(href)) return true;

  // Parametric sub-pages: group detail, team detail, venue detail, watch-live country, tv-schedule country
  if (/^\/world-cup-2026\/group-[a-l]$/.test(href))            return true;
  if (/^\/world-cup-2026\/teams\/[\w-]+$/.test(href))           return true;
  if (/^\/world-cup-2026\/venues\/[\w-]+$/.test(href))          return true;
  if (/^\/world-cup-2026\/watch-live\/[\w-]+$/.test(href))      return true;
  if (/^\/world-cup-2026\/tv-schedule\/[\w-]+$/.test(href))     return true;
  if (/^\/world-cup-2026\/group-[a-h]-predictions$/.test(href)) return true;

  return false;
}
