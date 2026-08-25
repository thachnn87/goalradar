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
import { evaluateFreezeContract, type FreezeDecision } from './wc-frozen-gate';

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
 * The evaluated freeze contract for the in-repo WC-2026 dataset/manifest.
 * Exposed for diagnostics and tests — the gate is the AND of every check.
 */
export function getFreezeDecision(): FreezeDecision {
  return evaluateFreezeContract(FROZEN_WC_2026_DATASET, FROZEN_WC_2026_MANIFEST);
}

/**
 * Returns the frozen canonical WC-2026 dataset, or null unless the COMPLETE
 * freeze contract is satisfied.
 *
 * EPIC-WC-FROZEN-DATA-001 Phase 2C (hardened): serving the historical record is
 * NOT gated on a single `signedOff` boolean. `evaluateFreezeContract` (wc-frozen-gate.ts)
 * must confirm ALL of: dataset present, manifest present, datasetId match, valid
 * version, checksum present, checksum RECOMPUTES to the manifest value, all
 * integrity checks pass, sign-off recorded + valid, and lifecycle === ARCHIVED
 * with frozen === true. Any failure → null → honest "unavailable", NEVER synthetic.
 *
 * Committed state is deliberately OFF (signedOff:false, frozen:false,
 * lifecycle:"COMPLETED"), so this is safe to merge without activating anything.
 *
 * ACTIVATION (governed flip, no code change): once the Business + Historical-
 * Authority sign-off is recorded, update src/data/wc-2026-frozen/manifest.json —
 * status.signedOff:true, status.frozen:true, status.lifecycle:"ARCHIVED",
 * freezeTimestamp, signOff.status:"SIGNED_OFF" + signOff.approvals[…]. The contract
 * then evaluates active and every gated surface serves real FIFA data at once.
 * Never set these without recorded approval (DGP-001 G8).
 */
export function getFrozenWCTournament(): FrozenWCTournament | null {
  if (!getFreezeDecision().active) return null;
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
