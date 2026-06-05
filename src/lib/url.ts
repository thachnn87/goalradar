/**
 * URL utilities for GoalRadar.
 * Centralises slug generation so every link on the site uses the same format.
 */

/**
 * Convert a team name to a URL-safe slug segment.
 * Examples:
 *   "South Africa"     → "south-africa"
 *   "Curaçao"          → "curacao"
 *   "TBD" / null       → "tbd"
 */
export function slugify(text: string | null | undefined): string {
  if (!text) return 'tbd';
  return text
    .toLowerCase()
    .normalize('NFD')                       // decompose "é" → "e" + combining accent
    .replace(/[̀-ͯ]/g, '')        // strip combining marks
    .replace(/[^a-z0-9\s-]/g, '')          // keep letters, digits, spaces, hyphens
    .replace(/\s+/g, '-')                  // spaces → hyphens
    .replace(/-{2,}/g, '-')                // collapse repeated hyphens
    .replace(/^-+|-+$/g, '')               // trim leading/trailing hyphens
    || 'tbd';                              // fallback if everything was stripped
}

/**
 * Build the canonical path for a match detail page.
 * Format: /match/{id}-{home-team}-vs-{away-team}
 * Examples:
 *   matchPath(537327, "Mexico",       "South Africa")  → "/match/537327-mexico-vs-south-africa"
 *   matchPath(537417, null,           null)             → "/match/537417-tbd-vs-tbd"
 *   matchPath(538155, "Sunderland AFC","Chelsea FC")    → "/match/538155-sunderland-afc-vs-chelsea-fc"
 */
export function matchPath(
  id: number,
  homeTeamName: string | null | undefined,
  awayTeamName: string | null | undefined,
): string {
  return `/match/${id}-${slugify(homeTeamName)}-vs-${slugify(awayTeamName)}`;
}

/**
 * Extract the numeric match ID from a slug segment.
 * Handles both old format ("537327") and new format ("537327-mexico-vs-south-africa").
 * Returns null if the segment doesn't start with digits.
 */
export function extractMatchId(slug: string): string | null {
  return /^(\d+)/.exec(slug)?.[1] ?? null;
}
