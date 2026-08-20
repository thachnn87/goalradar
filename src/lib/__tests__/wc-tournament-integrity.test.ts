/**
 * WC 2026 Tournament Data-Integrity Guard.
 *
 * Locks the structural invariants of the World Cup tournament model and — most
 * importantly — asserts that the TWO in-repo tournament authorities agree:
 *
 *   1. JSON data layer   — src/data/worldcup/{teams,groups,fixtures}.json
 *                          (consumed via data/worldcup/loader.ts)
 *   2. WC_ALL_TEAMS       — src/lib/wc-all-teams.ts
 *                          (consumed via getStaticWCGroupTables() →
 *                           getStandingsCached('WC') → Standings/Groups/Hub)
 *
 * These two rosters drifted in production (Group A held 5 teams incl. a
 * fabricated "Norway", Group G held 3, Germany/Turkey were swapped, Italy was
 * left as TBD) which corrupted Standings and desynced Standings from Groups.
 * This test is the regression guard: any future drift between the JSON layer
 * and WC_ALL_TEAMS — or any violation of the 48-team / 12×4 model — fails CI.
 *
 * Pure data assertions. No KV, no network, no provider.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { WC_ALL_TEAMS } from '../wc-all-teams';
import { WC_TEAMS } from '../wc-teams';
import { WC_KNOCKOUT_SLOTS } from '../wc-fixtures';
import teamsData from '../../data/worldcup/teams.json';
import groupsData from '../../data/worldcup/groups.json';
import fixturesData from '../../data/worldcup/fixtures.json';

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

interface JsonTeam { slug: string; name: string; group: string; }
interface JsonFixture { stage: string; group?: string; homeTeam?: string; awayTeam?: string; }

const teams = teamsData as JsonTeam[];
const groups = groupsData as Record<string, string[]>;
const fixtures = fixturesData as JsonFixture[];

// ---------------------------------------------------------------------------
// teams.json
// ---------------------------------------------------------------------------

describe('teams.json roster', () => {
  it('has exactly 48 teams', () => {
    expect(teams).toHaveLength(48);
  });

  it('has no duplicate slugs', () => {
    const slugs = teams.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(48);
  });

  it('assigns every team to a valid group A–L', () => {
    for (const t of teams) {
      expect(GROUP_LETTERS).toContain(t.group as (typeof GROUP_LETTERS)[number]);
    }
  });

  it('has exactly 4 teams in each of the 12 groups', () => {
    const counts: Record<string, number> = {};
    for (const t of teams) counts[t.group] = (counts[t.group] ?? 0) + 1;
    expect(Object.keys(counts).sort()).toEqual([...GROUP_LETTERS]);
    for (const g of GROUP_LETTERS) expect(counts[g]).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// groups.json
// ---------------------------------------------------------------------------

describe('groups.json structure', () => {
  it('has exactly 12 groups A–L', () => {
    expect(Object.keys(groups).sort()).toEqual([...GROUP_LETTERS]);
  });

  it('has exactly 4 teams per group and 48 total, with no team in two groups', () => {
    const all: string[] = [];
    for (const g of GROUP_LETTERS) {
      expect(groups[g]).toHaveLength(4);
      all.push(...groups[g]);
    }
    expect(all).toHaveLength(48);
    expect(new Set(all).size).toBe(48); // no duplicated teams across groups
  });

  it('agrees with teams.json on every group membership', () => {
    for (const g of GROUP_LETTERS) {
      const fromTeams = teams.filter((t) => t.group === g).map((t) => t.slug).sort();
      const fromGroups = [...groups[g]].sort();
      expect(fromGroups).toEqual(fromTeams);
    }
  });
});

// ---------------------------------------------------------------------------
// WC_ALL_TEAMS  ⟷  JSON layer consistency  (the drift that caused the incident)
// ---------------------------------------------------------------------------

describe('WC_ALL_TEAMS ⟷ groups.json consistency', () => {
  it('has exactly 48 entries', () => {
    expect(WC_ALL_TEAMS).toHaveLength(48);
  });

  it('has no duplicate slugs', () => {
    const slugs = WC_ALL_TEAMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(48);
  });

  it('assigns every team to a real group A–L (no TBD, no stray group)', () => {
    for (const t of WC_ALL_TEAMS) {
      expect(GROUP_LETTERS).toContain(t.group as (typeof GROUP_LETTERS)[number]);
    }
  });

  it('has exactly 4 teams in each group', () => {
    const counts: Record<string, number> = {};
    for (const t of WC_ALL_TEAMS) counts[t.group] = (counts[t.group] ?? 0) + 1;
    for (const g of GROUP_LETTERS) expect(counts[g]).toBe(4);
  });

  it('contains no team absent from the canonical teams.json roster', () => {
    const canonical = new Set(teams.map((t) => t.slug));
    const foreign = WC_ALL_TEAMS.filter((t) => !canonical.has(t.slug)).map((t) => t.slug);
    // Guards against fabricated entries such as the injected "norway".
    expect(foreign).toEqual([]);
  });

  it('has identical group membership to groups.json for all 12 groups', () => {
    for (const g of GROUP_LETTERS) {
      const fromWcAll = WC_ALL_TEAMS.filter((t) => t.group === g).map((t) => t.slug).sort();
      const fromGroups = [...groups[g]].sort();
      expect(fromWcAll).toEqual(fromGroups);
    }
  });
});

// ---------------------------------------------------------------------------
// fixtures.json — schedule integrity (Round of 32 + full knockout tree)
// ---------------------------------------------------------------------------

describe('fixtures.json schedule', () => {
  const byStage = (stage: string) => fixtures.filter((f) => f.stage === stage);

  it('has 104 fixtures with the correct stage distribution', () => {
    expect(fixtures).toHaveLength(104);
    expect(byStage('GROUP_STAGE')).toHaveLength(72);
    expect(byStage('LAST_32')).toHaveLength(16);   // Round of 32
    expect(byStage('LAST_16')).toHaveLength(8);
    expect(byStage('QUARTER_FINALS')).toHaveLength(4);
    expect(byStage('SEMI_FINALS')).toHaveLength(2);
    expect(byStage('THIRD_PLACE')).toHaveLength(1);
    expect(byStage('FINAL')).toHaveLength(1);
  });

  it('gives every group a full 6-match round-robin (C(4,2) = 6)', () => {
    for (const g of GROUP_LETTERS) {
      expect(byStage('GROUP_STAGE').filter((f) => f.group === g)).toHaveLength(6);
    }
  });

  it('only pairs teams from the same group, all present in teams.json', () => {
    const slugByGroup = new Map<string, Set<string>>(GROUP_LETTERS.map((g) => [g, new Set(groups[g])]));
    for (const f of byStage('GROUP_STAGE')) {
      const members = slugByGroup.get(f.group!)!;
      expect(members.has(f.homeTeam!)).toBe(true);
      expect(members.has(f.awayTeam!)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// WC_TEAMS (featured 6) ⟷ canonical roster   [Workstream B — Phase 1 guard]
//
// Locks the featured-team editorial layer to the canonical roster on identity
// fields. fifaRanking is intentionally NOT asserted: it currently diverges
// (usa 13 vs 11, england 4 vs 5, canada 47 vs 40 between WC_ALL_TEAMS and
// WC_TEAMS) and is tracked as a separate WS-B data-reconciliation item — this
// guard locks what is consistent today without turning that finding into a
// red build.
// ---------------------------------------------------------------------------

describe('WC_TEAMS featured subset ⟷ canonical roster', () => {
  const canonicalSlugs = new Set(teams.map((t) => t.slug));
  const rosterBySlug = new Map(WC_ALL_TEAMS.map((t) => [t.slug, t]));

  it('every featured team is a real canonical slug', () => {
    for (const slug of Object.keys(WC_TEAMS)) {
      expect(canonicalSlugs.has(slug)).toBe(true);
    }
  });

  it('each entry key matches its own slug field', () => {
    for (const [key, t] of Object.entries(WC_TEAMS)) {
      expect(t.slug).toBe(key);
    }
  });

  it('shares identity (apiName + flag) with WC_ALL_TEAMS', () => {
    for (const [slug, t] of Object.entries(WC_TEAMS)) {
      const roster = rosterBySlug.get(slug);
      expect(roster).toBeDefined();
      expect(t.apiName).toBe(roster!.apiName);
      expect(t.flag).toBe(roster!.flag);
    }
  });
});

// ---------------------------------------------------------------------------
// WC_KNOCKOUT_SLOTS ⟷ fixtures.json knockout structure   [WS-B Phase 1 guard]
//
// The two hardcoded knockout sources (WC_KNOCKOUT_SLOTS + fixtures.json's
// knockout rows) are a known duplication (WS-B deletion candidate). Until one
// is derived from the other, lock them to the SAME structural shape so they
// cannot silently diverge.
// ---------------------------------------------------------------------------

describe('WC_KNOCKOUT_SLOTS ⟷ fixtures.json knockout structure', () => {
  const KO_STAGES = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'] as const;
  const EXPECTED: Record<string, number> = {
    LAST_32: 16, LAST_16: 8, QUARTER_FINALS: 4, SEMI_FINALS: 2, THIRD_PLACE: 1, FINAL: 1,
  };
  const countBy = (arr: string[]) =>
    arr.reduce<Record<string, number>>((o, r) => ((o[r] = (o[r] ?? 0) + 1), o), {});

  it('has the canonical 32-slot distribution', () => {
    expect(WC_KNOCKOUT_SLOTS).toHaveLength(32);
    const dist = countBy(WC_KNOCKOUT_SLOTS.map((s) => s.round));
    for (const st of KO_STAGES) expect(dist[st]).toBe(EXPECTED[st]);
  });

  it('matches the fixtures.json knockout distribution exactly', () => {
    const fxKo = countBy(fixtures.filter((f) => f.stage !== 'GROUP_STAGE').map((f) => f.stage));
    const slotKo = countBy(WC_KNOCKOUT_SLOTS.map((s) => s.round));
    expect(slotKo).toEqual(fxKo);
  });

  it('numbers matches 1..N contiguously within each round', () => {
    for (const st of KO_STAGES) {
      const nums = WC_KNOCKOUT_SLOTS.filter((s) => s.round === st)
        .map((s) => s.matchNumber)
        .sort((a, b) => a - b);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  });
});

// ---------------------------------------------------------------------------
// WC-2026 standings must NEVER fall back to the synthetic skeleton
// (INC-WC-DATA-001). A completed tournament shows REAL standings (KV-hit merge
// or authority-derived) or an honest "unavailable" state — never WC_ALL_TEAMS.
// Source-level guard: fails if a synthetic terminal fallback is reintroduced
// into getStandingsCachedImpl.
// ---------------------------------------------------------------------------

describe('WC standings never serve the synthetic skeleton (INC-WC-DATA-001)', () => {
  const apiSrc = readFileSync(join(__dirname, '..', 'api.ts'), 'utf8');

  it('no WC standings branch returns getStaticWCGroupTables()', () => {
    // The removed synthetic fallbacks returned `standings: getStaticWCGroupTables()`.
    // The surviving KV-hit merge uses `const staticTables = getStaticWCGroupTables()`
    // (a scaffold, never returned directly), so this pattern must be absent.
    expect(apiSrc).not.toMatch(/standings:\s*getStaticWCGroupTables\(\)/);
  });

  it('getStaticWCGroupTables survives only as the KV-hit merge scaffold (exactly one call site)', () => {
    const calls = (apiSrc.match(/getStaticWCGroupTables\(\)/g) ?? []).length;
    expect(calls).toBe(1);
  });
});
