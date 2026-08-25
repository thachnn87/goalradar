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

import { FROZEN_WC_2026_DATASET, FROZEN_WC_2026_MANIFEST } from './wc-frozen-dataset';

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
 * Returns the frozen canonical WC-2026 dataset, or null when it is not yet active.
 *
 * EPIC-WC-FROZEN-DATA-001 Phase 2C: the VALIDATED FIFA-derived dataset
 * (WC-2026@v1) is present in the repo, but the gate is keyed on the manifest's
 * `status.signedOff` flag — NOT merely on the data existing. While signedOff is
 * false the tournament reads as null (WC_2026_HISTORICAL_AVAILABLE === false) and
 * every historical surface stays honestly "unavailable", so this change is safe
 * to merge without activating anything.
 *
 * ACTIVATION (one commit): once the required Business + Historical-Authority
 * sign-off is recorded, set `status.signedOff: true` (+ approvals + freezeTimestamp)
 * in src/data/wc-2026-frozen/manifest.json. That single edit flips this gate ON
 * and every gated surface switches from "unavailable" to real FIFA data at once —
 * no code change, no provider/KV/cron dependency. Never set signedOff true without
 * recorded approval (DGP-001 G8).
 */
export function getFrozenWCTournament(): FrozenWCTournament | null {
  if (FROZEN_WC_2026_MANIFEST.status?.signedOff !== true) return null;
  const d = FROZEN_WC_2026_DATASET;
  return {
    version: d.version,
    teams: d.teams,
    groups: d.groups as unknown as Record<string, unknown[]>,
    matches: d.matches,
    standings: d.standings,
    knockout: d.knockout as unknown[],
  };
}

/**
 * True only when real frozen WC-2026 historical data is available to serve.
 * While false, historical WC-2026 surfaces must render "unavailable", never the
 * synthetic roster. This is the one flag every historical surface checks.
 */
export const WC_2026_HISTORICAL_AVAILABLE: boolean = getFrozenWCTournament() !== null;
