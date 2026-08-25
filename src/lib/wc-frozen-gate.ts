/**
 * wc-frozen-gate.ts — the WC-2026 freeze contract evaluator.
 * EPIC-WC-FROZEN-DATA-001 Phase 2C (hardening).
 *
 * The frozen historical dataset may be served ONLY when the COMPLETE freeze
 * contract is satisfied — not merely because a sign-off boolean is set. This
 * encodes the DGP-001 / ADR-007 v2 progression as an explicit, testable gate:
 *
 *   CAPTURED → VALIDATED → CHECKSUMMED → VERSIONED → SIGNED_OFF → FROZEN/ARCHIVED
 *
 * `evaluateFreezeContract` is a PURE function of (dataset, manifest) so every
 * failure mode (bad checksum, incomplete manifest, missing data, not archived)
 * is unit-testable and, at runtime, degrades to honest "unavailable" — NEVER to
 * synthetic data.
 *
 * Lifecycle vocabulary (ADR-007 v2, as recorded in
 * docs/analysis/production-recovery-2026-07-28/INC-WC-DATA-001-CLOSEOUT.md):
 *   DRAFT | LIVE | COMPLETED | ARCHIVED
 * Only ARCHIVED (with the full contract satisfied) permits serving the frozen
 * historical record.
 */

import { computeFrozenChecksum, type FrozenDataset } from './wc-frozen-dataset';

export type Lifecycle = 'DRAFT' | 'LIVE' | 'COMPLETED' | 'ARCHIVED';

/** Shape of the fields the gate reads from the manifest (loose — validated here). */
export interface FreezeManifestView {
  datasetId?: unknown;
  version?: unknown;
  status?: {
    captured?: unknown;
    validated?: unknown;
    signedOff?: unknown;
    frozen?: unknown;
    lifecycle?: unknown;
  };
  checksum?: { dataset?: unknown };
  integrityChecks?: { total?: unknown; passed?: unknown; failed?: unknown };
  signOff?: { status?: unknown; approvals?: unknown };
}

export interface FreezeDecision {
  /** True only when EVERY contract check passes → frozen data may be served. */
  active: boolean;
  lifecycle: Lifecycle | 'UNKNOWN';
  /** Per-check pass/fail — surfaced for diagnostics + tests. */
  checks: Record<string, boolean>;
  /** Human-readable reasons the contract is NOT satisfied (empty when active). */
  reasons: string[];
}

const EXPECTED_DATASET_ID = 'WC-2026';

function isValidLifecycle(v: unknown): v is Lifecycle {
  return v === 'DRAFT' || v === 'LIVE' || v === 'COMPLETED' || v === 'ARCHIVED';
}

/**
 * Evaluate the complete freeze contract. Pure — no IO. Returns a decision with
 * per-check detail. `active` is true only when ALL checks pass.
 */
export function evaluateFreezeContract(
  dataset: FrozenDataset | null | undefined,
  manifest: FreezeManifestView | null | undefined,
): FreezeDecision {
  const checks: Record<string, boolean> = {};
  const reasons: string[] = [];
  const fail = (key: string, reason: string) => { checks[key] = false; reasons.push(reason); };
  const pass = (key: string) => { checks[key] = true; };

  const lifecycleRaw = manifest?.status?.lifecycle;
  const lifecycle: Lifecycle | 'UNKNOWN' = isValidLifecycle(lifecycleRaw) ? lifecycleRaw : 'UNKNOWN';

  // 1. dataset exists (with real content)
  const datasetPresent =
    !!dataset &&
    Array.isArray(dataset.teams) && dataset.teams.length > 0 &&
    Array.isArray(dataset.matches) && dataset.matches.length > 0;
  datasetPresent ? pass('datasetPresent') : fail('datasetPresent', 'frozen dataset missing or empty');

  // 2. manifest exists
  const manifestPresent = !!manifest && !!manifest.status;
  manifestPresent ? pass('manifestPresent') : fail('manifestPresent', 'manifest missing');

  // 3. datasetId matches (dataset ↔ manifest ↔ expected)
  const datasetIdMatch =
    !!dataset && dataset.datasetId === EXPECTED_DATASET_ID && manifest?.datasetId === EXPECTED_DATASET_ID;
  datasetIdMatch ? pass('datasetIdMatch') : fail('datasetIdMatch', 'datasetId mismatch');

  // 4. version valid + consistent
  const versionValid =
    !!dataset && typeof dataset.version === 'string' && /^v\d+$/.test(dataset.version) &&
    dataset.version === manifest?.version;
  versionValid ? pass('versionValid') : fail('versionValid', 'version invalid or inconsistent');

  // 5. checksum exists
  const checksumPresent = typeof manifest?.checksum?.dataset === 'string' && (manifest.checksum.dataset as string).length === 64;
  checksumPresent ? pass('checksumPresent') : fail('checksumPresent', 'manifest checksum missing');

  // 6. checksum verification passes (recompute over the actual dataset)
  let checksumValid = false;
  if (datasetPresent && checksumPresent) {
    try {
      checksumValid = computeFrozenChecksum(dataset as FrozenDataset) === manifest!.checksum!.dataset;
    } catch { checksumValid = false; }
  }
  checksumValid ? pass('checksumValid') : fail('checksumValid', 'dataset checksum does not match manifest (tamper/ drift)');

  // 7. integrityChecks all PASS
  const ic = manifest?.integrityChecks;
  const integrityPass =
    !!ic && typeof ic.total === 'number' && ic.total > 0 &&
    ic.passed === ic.total && ic.failed === 0;
  integrityPass ? pass('integrityPass') : fail('integrityPass', 'integrity checks incomplete or failing');

  // 8. sign-off exists and is valid
  const signedOff = manifest?.status?.signedOff === true;
  const signOffValid =
    signedOff &&
    manifest?.signOff?.status === 'SIGNED_OFF' &&
    Array.isArray(manifest?.signOff?.approvals) && (manifest!.signOff!.approvals as unknown[]).length > 0;
  signOffValid ? pass('signOffValid') : fail('signOffValid', 'sign-off not recorded/valid (DGP-001 G8)');

  // 9. lifecycle/frozen state explicitly permits Archived serving
  const frozenState = manifest?.status?.frozen === true;
  const lifecycleArchived = lifecycle === 'ARCHIVED';
  const archivedServing = frozenState && lifecycleArchived;
  archivedServing ? pass('archivedServing') : fail('archivedServing', 'lifecycle not ARCHIVED / not frozen');

  const active = Object.values(checks).every(Boolean);
  return { active, lifecycle, checks, reasons };
}
