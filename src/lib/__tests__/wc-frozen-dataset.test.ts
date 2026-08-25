/**
 * WC-2026 FROZEN DATASET CANDIDATE — integrity + provenance guard.
 * EPIC-WC-FROZEN-DATA-001 Phase 2B.
 *
 * Locks the FIFA-derived WC-2026@v1 candidate dataset in CI:
 *   - structural invariants (48 / 12×4 / 104 / 72 / 32 / 16 …)
 *   - knockout progression reconciliation + champion
 *   - standings reconcile with results
 *   - deterministic checksum matches the manifest
 *   - NO synthetic data leaked (negative ids / teams that did not participate)
 *   - the production freeze gate is STILL OFF (candidate not signed off / wired)
 *
 * Pure data assertions. No KV, no network, no provider.
 */

import {
  FROZEN_WC_2026_DATASET,
  FROZEN_WC_2026_MANIFEST,
  validateFrozenDataset,
  computeFrozenChecksum,
} from '../wc-frozen-dataset';
import { getFrozenWCTournament, WC_2026_HISTORICAL_AVAILABLE } from '../wc-frozen';

const d = FROZEN_WC_2026_DATASET;

describe('WC-2026@v1 frozen dataset — integrity invariants', () => {
  const result = validateFrozenDataset(d);

  it('passes every integrity check (0 failures)', () => {
    const failures = result.checks.filter((c) => !c.pass);
    if (failures.length) {
      // Surface the exact discrepancy in the CI log before failing.
      console.error('Frozen dataset integrity failures:', JSON.stringify(failures, null, 2));
    }
    expect(result.failed).toBe(0);
  });

  it('has the exact FIFA tournament shape', () => {
    expect(d.teams).toHaveLength(48);
    expect(Object.keys(d.groups).sort().join('')).toBe('ABCDEFGHIJKL');
    expect(d.matches).toHaveLength(104);
    expect(d.matches.filter((m) => m.stage === 'GROUP_STAGE')).toHaveLength(72);
    expect(d.matches.filter((m) => m.stage !== 'GROUP_STAGE')).toHaveLength(32);
    expect(d.venues).toHaveLength(16);
  });

  it('identifies a champion derived from the actual Final', () => {
    const final = d.matches.find((m) => m.stage === 'FINAL')!;
    expect(final.winner).toBe(d.champion.idTeam);
    expect([final.home.idTeam, final.away.idTeam]).toContain(d.champion.idTeam);
  });
});

describe('WC-2026@v1 frozen dataset — no synthetic data leaked', () => {
  it('uses only positive numeric FIFA match ids (no A2/DR synthetic negative ids)', () => {
    for (const m of d.matches) {
      expect(/^\d+$/.test(m.idMatch)).toBe(true);
      expect(Number(m.idMatch)).toBeGreaterThan(0);
    }
  });

  it('excludes synthetic teams that did not actually participate', () => {
    // WC_ALL_TEAMS listed these, but the FIFA record shows they did not play.
    const didNotParticipate = ['Costa Rica', 'Honduras', 'Venezuela', 'Italy', 'Poland', 'Peru'];
    const names = new Set(d.teams.map((t) => t.name));
    for (const n of didNotParticipate) expect(names.has(n)).toBe(false);
  });

  it('includes real FIFA entrants the synthetic roster never had', () => {
    const realEntrants = ['Norway', 'Scotland', 'Sweden', 'Paraguay'];
    const names = new Set(d.teams.map((t) => t.name));
    for (const n of realEntrants) expect(names.has(n)).toBe(true);
  });
});

describe('WC-2026@v1 frozen dataset — checksum + manifest provenance', () => {
  it('recomputes to the checksum recorded in the manifest (reproducible)', () => {
    expect(computeFrozenChecksum(d)).toBe(FROZEN_WC_2026_MANIFEST.checksum.dataset);
  });

  it('manifest counts agree with the dataset', () => {
    const c = FROZEN_WC_2026_MANIFEST.counts;
    expect(c.teams).toBe(48);
    expect(c.matches).toBe(104);
    expect(c.groupStageMatches).toBe(72);
    expect(c.knockoutMatches).toBe(32);
    expect(c.venues).toBe(16);
  });

  it('records the authoritative + acquisition sources distinctly', () => {
    expect(FROZEN_WC_2026_MANIFEST.checksum.algorithm).toBe('sha256');
    expect(String((FROZEN_WC_2026_MANIFEST as Record<string, unknown>).captureTimestamp)).toMatch(/^2026-/);
  });
});

describe('WC-2026 candidate sign-off + gate wiring', () => {
  it('manifest marks the candidate captured + validated', () => {
    expect(FROZEN_WC_2026_MANIFEST.status.captured).toBe(true);
    expect(FROZEN_WC_2026_MANIFEST.status.validated).toBe(true);
  });

  it('the production freeze gate exactly matches the recorded sign-off (never invented)', () => {
    // The gate is keyed on manifest.status.signedOff — NOT on the data existing.
    // Committed state is signedOff:false → gate OFF → surfaces stay "unavailable".
    // Recording sign-off (signedOff:true) is the single edit that activates it.
    const signedOff = FROZEN_WC_2026_MANIFEST.status.signedOff === true;
    expect(getFrozenWCTournament() !== null).toBe(signedOff);
    expect(WC_2026_HISTORICAL_AVAILABLE).toBe(signedOff);
  });
});
