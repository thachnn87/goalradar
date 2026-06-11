/**
 * geo-countries.ts — GEO-1 Smart Country Prioritization
 *
 * Priority matrix + geo-aware ordering for the "Your country" chips on
 * match pages.
 *
 * Ordering rules:
 *   1. No geo signal      → tier order (tier 1 then tier 2, by rank).
 *   2. Detected country   → detected first, its regional neighbours next
 *                           (in their listed order), remainder by tier rank.
 *
 * SEO safety: every chip links to an EXISTING canonical page —
 * /world-cup-2026/watch-live/{slug} where a watch page exists, otherwise
 * /world-cup-2026/tv-schedule/{slug}. Singapore & Malaysia have no country
 * page, so they link to the watch-live hub. No new URLs are created.
 */

export interface GeoCountry {
  /** ISO 3166-1 alpha-2 — matches Vercel's x-vercel-ip-country header. */
  code:  string;
  flag:  string;
  label: string;
  /** Canonical destination page (existing URL — never a new route). */
  href:  string;
  /** 1 = major football market, 2 = strategic SEA market. */
  tier:  1 | 2;
  /** Regional neighbours, in display order, boosted when this country is detected. */
  neighbors: string[];
}

/** Tier-ranked matrix. Array order = global priority order (no geo signal). */
export const GEO_COUNTRIES: GeoCountry[] = [
  // ── Tier 1 — major football markets ──────────────────────────────────────
  { code: 'US', flag: '🇺🇸', label: 'USA',       href: '/world-cup-2026/watch-live/us',        tier: 1, neighbors: ['CA', 'MX'] },
  { code: 'GB', flag: '🇬🇧', label: 'UK',        href: '/world-cup-2026/watch-live/uk',        tier: 1, neighbors: ['FR', 'DE', 'ES'] },
  { code: 'CA', flag: '🇨🇦', label: 'Canada',    href: '/world-cup-2026/watch-live/canada',    tier: 1, neighbors: ['US', 'MX'] },
  { code: 'AU', flag: '🇦🇺', label: 'Australia', href: '/world-cup-2026/watch-live/australia', tier: 1, neighbors: [] },
  { code: 'IN', flag: '🇮🇳', label: 'India',     href: '/world-cup-2026/watch-live/india',     tier: 1, neighbors: [] },
  { code: 'BR', flag: '🇧🇷', label: 'Brazil',    href: '/world-cup-2026/tv-schedule/brazil',   tier: 1, neighbors: ['AR', 'MX'] },
  { code: 'MX', flag: '🇲🇽', label: 'Mexico',    href: '/world-cup-2026/tv-schedule/mexico',   tier: 1, neighbors: ['US', 'CA'] },
  { code: 'DE', flag: '🇩🇪', label: 'Germany',   href: '/world-cup-2026/tv-schedule/germany',  tier: 1, neighbors: ['FR', 'ES', 'GB'] },
  { code: 'FR', flag: '🇫🇷', label: 'France',    href: '/world-cup-2026/tv-schedule/france',   tier: 1, neighbors: ['GB', 'DE', 'ES'] },
  { code: 'ES', flag: '🇪🇸', label: 'Spain',     href: '/world-cup-2026/tv-schedule/spain',    tier: 1, neighbors: ['FR', 'DE', 'GB'] },
  // ── Tier 2 — strategic Southeast Asia markets ────────────────────────────
  { code: 'VN', flag: '🇻🇳', label: 'Vietnam',   href: '/world-cup-2026/watch-live/vietnam',   tier: 2, neighbors: ['TH', 'SG', 'MY'] },
  { code: 'TH', flag: '🇹🇭', label: 'Thailand',  href: '/world-cup-2026/watch-live/thailand',  tier: 2, neighbors: ['VN', 'SG', 'MY'] },
  { code: 'SG', flag: '🇸🇬', label: 'Singapore', href: '/world-cup-2026/watch-live',           tier: 2, neighbors: ['MY', 'TH', 'VN'] },
  { code: 'MY', flag: '🇲🇾', label: 'Malaysia',  href: '/world-cup-2026/watch-live',           tier: 2, neighbors: ['SG', 'TH', 'VN'] },
  { code: 'ID', flag: '🇮🇩', label: 'Indonesia', href: '/world-cup-2026/tv-schedule/indonesia',tier: 2, neighbors: ['SG', 'MY', 'TH'] },
  // ── Neighbour-only entry (surfaces when BR/MX detected; tier-2 tail otherwise) ──
  { code: 'AR', flag: '🇦🇷', label: 'Argentina', href: '/world-cup-2026/tv-schedule/argentina',tier: 2, neighbors: ['BR', 'MX'] },
];

const _byCode = new Map(GEO_COUNTRIES.map((c) => [c.code, c]));

/** Normalise common header aliases (Vercel sends 'GB' for the UK). */
function normalize(code: string | null | undefined): string | null {
  if (!code) return null;
  const up = code.toUpperCase();
  return up === 'UK' ? 'GB' : up;
}

/**
 * Geo-aware chip ordering:
 *   detected country → its neighbours (listed order) → remainder by tier rank.
 * Unknown / missing country → tier rank order unchanged.
 */
export function orderCountries(detectedCode?: string | null): GeoCountry[] {
  const code = normalize(detectedCode);
  const detected = code ? _byCode.get(code) : undefined;
  if (!detected) return GEO_COUNTRIES;

  const head = [detected, ...detected.neighbors.map((n) => _byCode.get(n)!).filter(Boolean)];
  const headCodes = new Set(head.map((c) => c.code));
  return [...head, ...GEO_COUNTRIES.filter((c) => !headCodes.has(c.code))];
}
