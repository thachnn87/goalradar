# DATA-18A.1 Migration Risk Review

Date: 2026-06-17
Reviewer: Architecture review — no code changes.
Source: DATA18A_MIGRATION_PLAN.md

---

## Review Methodology

Each stage reviewed for:
1. Risk level (revised if different from original)
2. Rollback quality
3. Operational complexity
4. Hidden assumptions
5. Whether the stage should be split further

---

## S0 — Dormant (Current stage)

**Original risk:** None  
**Revised risk:** None  

**Review:** Correct. `src/lib/canonical-match.ts` is not imported by anything.
`npx tsc --noEmit` passes. Zero production impact.

**Rollback quality:** Excellent — delete one file.

**Hidden assumption:** The file will not be accidentally imported by another developer
between S0 and S1. No guard prevents this (no `@internal` annotation, no barrel-file
gating). Low probability but worth documenting.

**Recommendation:** Add a top-of-file comment to `canonical-match.ts`:

```typescript
// DATA-18A DORMANT — do not import this module until DATA-18B activates it.
// Importing this file in a page or API module before S3 is a migration error.
```

**Should split:** No.

---

## S1 — Side-by-Side Build

**Original risk:** None  
**Revised risk:** None  

**Review:** Correct in principle. New dormant files, not imported by pages.

**Rollback quality:** Good — delete 2 files.

**Operational complexity:** Low. Requires writing `src/lib/authority-cache.ts`
with `writeAuthorityCache()` and `readAuthorityCache()`. Both are standalone
modules that touch only KV.

**Hidden assumptions:**

1. The plan states `getWCAuthorityMatchesV2()` is added dormant to `api.ts`. This is a
   modification of an existing production file (`src/lib/api.ts`). Modifying `api.ts`
   carries a non-zero risk of introducing TypeScript errors or import cycles.
   **Risk is low but it is not "zero" as stated.**

2. The plan says `buildAllCanonicalMatches()` reads "bulk feeds + snapshots — same
   sources as `getWCAuthorityMatchesCached()`". But `getWCAuthorityMatchesCached()`
   calls `getUpcomingMatchesCached()` which internally calls `overlayMatchStates()`.
   The new path bypasses `overlayMatchStates()`. This is INTENTIONAL (the new path
   uses `buildCanonicalMatch()` which subsumes overlay) but needs explicit documentation
   so it doesn't look like a regression.

3. S1 does not specify a unit test target. The plan says "Unit test: `buildCanonicalMatch()`
   with mock inputs → expected `CanonicalMatch` shape." This is vague. Before S1 merges,
   the test should specifically validate:
   - State resolution with all combinations of fdStatus × snapshotStatus × liveStatus
   - Score preference (snapshot vs FD) with timestamp comparison
   - Team ID reconciliation check (C2 from integrity layer)

**Should split:** No — but tighten the test requirements.

---

## S2 — Shadow Validation

**Original risk:** None  
**Revised risk:** **LOW** (revised up from None)

**Why revised:**

1. **Shadow comparison endpoint is marked optional** — "optional, internal-only".
   This is the only mechanism to verify output parity between old and new paths
   BEFORE any page reads new data. Making it optional means S3 could proceed
   without validated parity evidence. This is a gap.

   **Recommendation:** Make the shadow comparison endpoint **required, not optional**.
   S3 must not proceed until the shadow comparison endpoint shows 0 degraded matches
   across all 4 benchmark matches.

2. **AUTHORITY_CACHE_ENABLED defaults false** — this is correct for safety but means
   S2 adds an orchestrator modification (to write the authority cache) that is
   guarded by a flag. If the flag is never set, S2 effectively does nothing in
   production. The plan needs an explicit "activate S2 in production" step.

3. The orchestrator modification in S2 is described as modifying the cron function.
   The current cron function is not audited in this review — its modification scope
   should be minimised (append-only: call `writeAuthorityCache()` after existing
   refresh logic, wrapped in `AUTHORITY_CACHE_ENABLED` guard).

4. **What if S2 shadow comparison shows divergence?** The plan has no
   remediation path for "shadow comparison fails." It should specify: if any
   benchmark match shows `integrity.status === 'degraded'` on the new path, halt
   S3 and file a DATA-18A.2 remediation task.

**Rollback quality:** Good — set `AUTHORITY_CACHE_ENABLED=false`.

**Should split:** No — but add the mandatory shadow comparison gate.

---

## S3 — Page Opt-In (Results Page)

**Original risk:** Low  
**Revised risk:** **LOW-MEDIUM** (revised up slightly)

**Why revised:**

1. **`AUTHORITY_CACHE_ENABLED=true` is a prerequisite for S3.** The plan states
   this. But if the flag was not set in S2 (because S2 was not validated), and S3
   deploys, the Results page would cold-rebuild the authority cache on every ISR
   revalidation. This is correct behaviour (cold rebuild falls through to
   `buildAndCacheAuthority()`) but adds ~200ms latency to the Results page ISR cycle.
   Not a user-facing regression, but unexpected.

2. **The Results page is a good canary choice**, BUT: the Results page only shows
   score + FT status for each match. It does NOT display goals/cards/lineups.
   This means S3 validation cannot confirm that event data (goals, scorers) is
   correctly populated in the canonical object — only that scores are correct.

   **Recommendation:** Add a separate internal validation step in S3 that inspects
   the `CanonicalMatch.goals` array for the 4 benchmark matches (e.g., via the
   debug endpoint from S2, or via the match detail page which still reads from
   the old snapshot path in S3).

3. **TypeScript field access changes.** In S3, the Results page migrates from
   `Match` shape to `CanonicalMatch` shape. The Results page currently uses:
   - `m.status === 'FINISHED'` → replaced by `m.state === 'finished'` ✅
   - `classifyMatchState(m, today)` → replaced by `m.state` directly ✅
   - `m.score.fullTime.home` → identical field path ✅
   - `statusBadge(m)` which reads `m.status === 'IN_PLAY'` etc. → **must be updated** to read `m.state === 'live'` or retain the FD status string

   The `statusBadge()` function in `world-cup-2026-results/page.tsx` reads `m.status`:
   ```typescript
   function statusBadge(m: Match): { label: string; cls: string } {
     if (m.status === 'IN_PLAY') return { label: m.minute != null ? `${m.minute}'` : 'LIVE', ... };
     if (m.status === 'PAUSED') return { label: 'HT', ... };
     if (m.status === 'FINISHED') return { label: 'FT', ... };
   ```
   
   `CanonicalMatch` does not have a `status` field — only `state`. The `statusBadge()`
   function must be updated to read `m.state` (and `m.minute`). This is straightforward
   but is a real code change that must be verified.

   **This is the hidden assumption that could cause a TypeScript error at S3 if missed.**

**Rollback quality:** Good — revert one import line. But the `statusBadge` function
change would also need reverting.

**Should split:** No — but document the `statusBadge` migration explicitly.

---

## S4 — Full Cutover

**Original risk:** Medium  
**Revised risk:** **MEDIUM-HIGH** (revised up)

**Why revised:**

1. **All 4 remaining pages migrated in one PR.** The plan migrates Hub, Schedule,
   Fixtures, and Group pages simultaneously. These pages have different ISR intervals,
   different field access patterns, and different validation complexity.

   **Recommendation: Split S4 into two sub-stages:**

   - **S4a:** Hub + Schedule (simpler pages, no group filtering)
   - **S4b:** Fixtures + Group pages (more complex — group filtering, multiple sections)

   This splits the blast radius. If S4a works and S4b has a bug (e.g., group filter
   fails because `m.group` behaves differently on `CanonicalMatch`), S4b can be
   reverted independently.

2. **`getWCAuthorityMatchesCached()` is deprecated in S4.** The plan says it "no
   longer called from the authority path." But `match-snapshot.ts` still imports
   `getUpcomingMatchesCached` and `getRecentMatchesCached` from `api.ts` (for
   `wcGroupMatches` in the snapshot). Removing `getWCAuthorityMatchesCached()` from
   `api.ts` must not break the snapshot path.

3. **`overlayMatchStates()` is still used by `getUpcomingMatchesCached()`** (non-WC
   pages). Removing it from the WC authority path in S4 does NOT remove it from
   `api.ts`. It must remain until S5.

4. **The `type CanonicalMatch = Match` alias in `api.ts` is replaced with the real
   interface import in S4.** Any code that currently assigns a raw `Match` to a
   `CanonicalMatch` typed variable will break. TypeScript will catch this, but it
   means S4 requires a full audit of all `CanonicalMatch` typed assignments.

5. **The Hub page's `revalidate=30` ISR** means the Hub will read from the authority
   cache every 30s during a live match. The authority cache must have TTL=30s during
   live matches for this to serve fresh data. If the live refresh loop is not
   implemented in S4 (it was described in the cache strategy but is an S4
   implementation detail), the Hub could show stale live scores for up to the
   authority cache TTL.

   **This is a blocking assumption:** The live refresh loop that updates the authority
   cache must be active BEFORE the Hub migrates to the authority cache (S4).

**Rollback quality:** Moderate — 5+ file revert. Old path must remain in codebase.
Old `getWCAuthorityMatchesCached()` must NOT be removed in S4 (it's the rollback target).

**Should split:** **YES — split into S4a (Hub + Schedule) and S4b (Fixtures + Group).**

---

## S5 — Legacy Removal

**Original risk:** Low  
**Revised risk:** Low  

**Review:** Correct — by S5, S4 has been stable for ≥1 week. The main risk is
accidentally removing something still used.

**Rollback quality:** Git revert of S5 commit. Good.

**Hidden assumptions:**

1. `overlayMatchStates()` is used by non-WC pages (e.g., `getUpcomingMatchesCached`
   for league competitions). S5 must NOT remove `overlayMatchStates()` unless all
   non-WC pages have also migrated. The plan says "if no callers remain" — the audit
   must confirm this before removal.

2. `getRecentMatchesCached()` is still called by `match-snapshot.ts` for building
   `wcGroupMatches` in the snapshot. It cannot be removed in S5 until the snapshot
   builder is updated to use the authority cache for group matches.

**Should split:** No — but add the "confirm 0 callers" gate explicitly.

---

## Stage Risk Summary (revised)

| Stage | Original risk | Revised risk | Split recommended |
|-------|-------------|-------------|------------------|
| S0 | None | None | No |
| S1 | None | None | No |
| S2 | None | **Low** | No (but shadow comparison is mandatory, not optional) |
| S3 | Low | **Low-Medium** | No (but `statusBadge` migration must be explicit) |
| S4 | Medium | **Medium-High** | **Yes — split into S4a and S4b** |
| S5 | Low | Low | No |

---

## Critical Path Issues

| Issue | Stage affected | Severity | Action |
|-------|---------------|----------|--------|
| Shadow comparison is optional in S2 | S2 | **Blocking** | Make mandatory — S3 requires validated shadow parity |
| `statusBadge()` must migrate to `m.state` | S3 | **Must-fix** | Document and verify in S3 |
| Live refresh loop not yet designed | S4 | **Blocking for live accuracy** | Design in DATA-18B; implement before S4 |
| S4 migrates 4 pages simultaneously | S4 | Medium | Split into S4a + S4b |
| `getRecentMatchesCached()` still used by snapshot | S5 | Medium | Audit callers before S5 |
| `overlayMatchStates()` still used by non-WC | S5 | Low | Confirm 0 WC callers before removal |
