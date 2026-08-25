/**
 * wc-frozen-gate — freeze contract guard. EPIC-WC-FROZEN-DATA-001 Phase 2C (hardening).
 *
 * Proves the hardened gate serves the historical record ONLY when the COMPLETE
 * freeze contract holds, and degrades to honest "unavailable" (never synthetic)
 * on any failure: committed OFF, invalid checksum, incomplete manifest, missing
 * data, or lifecycle not ARCHIVED. Also audits the frozen adapter for forbidden
 * synthetic/provider sources.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FROZEN_WC_2026_DATASET,
  FROZEN_WC_2026_MANIFEST,
  computeFrozenChecksum,
} from '../wc-frozen-dataset';
import { evaluateFreezeContract, type FreezeManifestView } from '../wc-frozen-gate';
import { getFrozenWCTournament, WC_2026_HISTORICAL_AVAILABLE, getFreezeDecision } from '../wc-frozen';

const dataset = FROZEN_WC_2026_DATASET;

/** A manifest that satisfies EVERY freeze-contract check (for the ON case). */
function validManifest(): FreezeManifestView {
  return {
    datasetId: 'WC-2026',
    version: dataset.version,
    status: {
      captured: true, validated: true, signedOff: true, frozen: true, lifecycle: 'ARCHIVED',
    },
    checksum: { dataset: computeFrozenChecksum(dataset) },
    integrityChecks: { total: 30, passed: 30, failed: 0 },
    signOff: { status: 'SIGNED_OFF', approvals: ['Business owner', 'Historical Authority'] },
  };
}

describe('A — committed state: gate OFF, no frozen data served', () => {
  it('the real in-repo contract evaluates INACTIVE (safety: must stay OFF until governed flip)', () => {
    const d = getFreezeDecision();
    expect(d.active).toBe(false);
    expect(getFrozenWCTournament()).toBeNull();
    expect(WC_2026_HISTORICAL_AVAILABLE).toBe(false);
  });

  it('committed manifest is COMPLETED, not ARCHIVED (sign-off pending)', () => {
    expect(FROZEN_WC_2026_MANIFEST.status.lifecycle).toBe('COMPLETED');
    expect(FROZEN_WC_2026_MANIFEST.status.signedOff).toBe(false);
    expect(FROZEN_WC_2026_MANIFEST.status.frozen).toBe(false);
  });
});

describe('B — gate ON with a valid dataset + complete contract', () => {
  it('evaluates ACTIVE when every check passes', () => {
    const d = evaluateFreezeContract(dataset, validManifest());
    if (!d.active) console.error('unexpected inactive:', d.reasons);
    expect(d.active).toBe(true);
    expect(d.lifecycle).toBe('ARCHIVED');
    expect(Object.values(d.checks).every(Boolean)).toBe(true);
  });
});

describe('C — invalid checksum → unavailable', () => {
  it('is INACTIVE when the manifest checksum does not match the dataset', () => {
    const m = validManifest();
    m.checksum = { dataset: 'f'.repeat(64) };
    const d = evaluateFreezeContract(dataset, m);
    expect(d.active).toBe(false);
    expect(d.checks.checksumValid).toBe(false);
  });

  it('is INACTIVE when the dataset is mutated but the checksum is not', () => {
    const tampered = { ...dataset, teams: dataset.teams.slice(0, 47) }; // drop a team
    const d = evaluateFreezeContract(tampered, validManifest());
    expect(d.active).toBe(false);
    expect(d.checks.checksumValid).toBe(false);
  });
});

describe('D — incomplete manifest → unavailable', () => {
  it('is INACTIVE when sign-off / frozen / lifecycle are missing', () => {
    const m = validManifest();
    m.status = { captured: true, validated: true }; // no signedOff/frozen/lifecycle
    const d = evaluateFreezeContract(dataset, m);
    expect(d.active).toBe(false);
    expect(d.checks.signOffValid).toBe(false);
    expect(d.checks.archivedServing).toBe(false);
  });

  it('is INACTIVE when signedOff:true but approvals are empty (no invented approval)', () => {
    const m = validManifest();
    m.signOff = { status: 'SIGNED_OFF', approvals: [] };
    expect(evaluateFreezeContract(dataset, m).active).toBe(false);
  });

  it('is INACTIVE when integrity checks are failing', () => {
    const m = validManifest();
    m.integrityChecks = { total: 30, passed: 29, failed: 1 };
    const d = evaluateFreezeContract(dataset, m);
    expect(d.active).toBe(false);
    expect(d.checks.integrityPass).toBe(false);
  });
});

describe('E — Archived but frozen data missing/invalid → unavailable', () => {
  it('is INACTIVE when the dataset is missing entirely', () => {
    const d = evaluateFreezeContract(null, validManifest());
    expect(d.active).toBe(false);
    expect(d.checks.datasetPresent).toBe(false);
  });

  it('is INACTIVE when lifecycle is not ARCHIVED (COMPLETED)', () => {
    const m = validManifest();
    m.status = { ...m.status, lifecycle: 'COMPLETED' };
    const d = evaluateFreezeContract(dataset, m);
    expect(d.active).toBe(false);
    expect(d.checks.archivedServing).toBe(false);
  });

  it('is INACTIVE on datasetId / version mismatch', () => {
    const m1 = validManifest(); m1.datasetId = 'WC-2030';
    expect(evaluateFreezeContract(dataset, m1).active).toBe(false);
    const m2 = validManifest(); m2.version = 'v9';
    expect(evaluateFreezeContract(dataset, m2).active).toBe(false);
  });
});

describe('F — Archived serves NO provider/KV/authority/synthetic fallback', () => {
  // Strip comments so header docs that *name* forbidden sources aren't false hits.
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', '..', rel), 'utf8'));

  // Every module in the frozen SERVING path (adapter, gate, and the two rendered
  // frozen components). None may import a synthetic roster / provider / authority.
  const FROZEN_PATH = {
    'wc-frozen-view.ts':    read('lib/wc-frozen-view.ts'),
    'wc-frozen-gate.ts':    read('lib/wc-frozen-gate.ts'),
    'FrozenTeamProfile.tsx': read('components/FrozenTeamProfile.tsx'),
    'FrozenMatchDetail.tsx': read('components/FrozenMatchDetail.tsx'),
  };

  const FORBIDDEN_MODULES = ['wc-all-teams', 'wc-fixtures', 'wc-static-groups', '/api'];
  const FORBIDDEN_IDENTS = [
    'getStaticGroupMatches', 'getStaticKnockoutMatches', 'getStaticWCGroupTables',
    'getStandingsCached', 'getWCAuthorityMatchesV2', 'getWCTeam', 'WC_ALL_TEAMS',
    'football-data', 'api-football',
  ];
  const importedModules = (src: string) =>
    [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

  for (const [name, src] of Object.entries(FROZEN_PATH)) {
    it(`${name} imports no synthetic/provider module and references no synthetic source`, () => {
      const mods = importedModules(src);
      for (const bad of FORBIDDEN_MODULES) {
        expect(mods.some((mod) => mod.includes(bad))).toBe(false);
      }
      for (const bad of FORBIDDEN_IDENTS) expect(src.includes(bad)).toBe(false);
    });
  }
});
