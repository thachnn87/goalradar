/**
 * WC 2026 frozen-dataset gate — INC-WC-DATA-001 Phase 2 (synthetic history containment).
 *
 * WC 2026 is a COMPLETED / archived tournament. There is currently NO verified
 * frozen canonical real-tournament dataset available to the application, and the
 * only in-repo roster (WC_ALL_TEAMS) is a SYNTHETIC pre-draw editorial roster.
 *
 * Governing rule (DGP-001 / ADR-007 v2 Archived stage):
 *   ARCHIVED WC-2026 without FROZEN data  =>  HONEST UNAVAILABLE  =>  NEVER SYNTHETIC
 *
 * Historical WC-2026 surfaces (team pages, group rosters, hub team grid, their
 * FAQ + JSON-LD, and the knockout bracket) MUST consult this gate. While it is
 * false they render an honest "unavailable" state and MUST NOT present the
 * synthetic roster / group membership / bracket as historical fact.
 *
 * This is the single WC-2026-only switch. When a real frozen dataset is produced
 * (EPIC-WC-FROZEN-DATA-001), wire it in here — every gated surface flips at once,
 * with no change to Draft/Live behaviour for genuinely live tournaments and no
 * change to the live-league architecture.
 */

/** Shape reserved for the future frozen canonical dataset (see EPIC-WC-FROZEN-DATA-001). */
export interface FrozenWCTournament {
  version: string;
  teams: unknown[];
  groups: Record<string, unknown[]>;
  matches: unknown[];
  standings: unknown[];
  knockout: unknown;
}

/**
 * Returns the frozen canonical WC-2026 dataset, or null when none is available.
 *
 * Currently ALWAYS null: no verified frozen dataset exists (GO-NOGO-002: NO-GO —
 * blocked on owner-supplied authoritative real data). Do NOT synthesize, guess,
 * or substitute WC_ALL_TEAMS / provider data here.
 */
export function getFrozenWCTournament(): FrozenWCTournament | null {
  return null;
}

/**
 * True only when real frozen WC-2026 historical data is available to serve.
 * While false, historical WC-2026 surfaces must render "unavailable", never the
 * synthetic roster. This is the one flag every historical surface checks.
 */
export const WC_2026_HISTORICAL_AVAILABLE: boolean = getFrozenWCTournament() !== null;
