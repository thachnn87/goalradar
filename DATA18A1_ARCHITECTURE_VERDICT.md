# DATA-18A.1 Architecture Verdict

Date: 2026-06-17
Reviewer: Architecture review — no code changes.

---

## 1. Top 10 Architecture Risks

### R1 — BLOCKING: Stale Snapshot Score Overwrite (S-1 from Score Integrity review)

**File:** `src/lib/canonical-match.ts:234`  
**Severity:** Blocking  

`buildCanonicalMatch()` unconditionally prefers `snapshot.match.score` over
`fdMatch.score` for FINISHED matches, with no timestamp comparison. A 7-day-old
snapshot with a stale score would overwrite the corrected FD results feed score.

**Fix:** Add `snapshot.generatedAt > new Date(fdMatch.lastUpdated).getTime()` guard
before preferring snapshot score.

---

### R2 — BLOCKING: Dead Code in `deriveState()` — Both Branches Return `'scheduled'`

**File:** `src/lib/canonical-match.ts:156–160`  
**Severity:** Blocking (logic error)  

```typescript
if (status === 'SCHEDULED' || status === 'TIMED') {
  const matchDay = utcDate.split('T')[0];
  return matchDay <= todayUTC ? 'scheduled' : 'scheduled';  // ← BOTH RETURN 'scheduled'
}
```

The conditional `matchDay <= todayUTC` does nothing — both branches return the
same value. This was presumably meant to distinguish "today's matches" from
"future matches," but since `CanonicalMatch.state` has no `'today'` variant,
both branches correctly return `'scheduled'`. However, the dead conditional is
misleading and hides the fact that it does nothing.

**Fix:** Simplify to `return 'scheduled';` (remove the dead branch). This is a
correctness-of-reasoning fix, not a runtime behaviour change.

---

### R3 — BLOCKING: `inferFdFeed()` Infers Incorrectly for Live Matches

**File:** `src/lib/canonical-match.ts:167–171`  
**Severity:** Blocking (incorrect provenance)  

```typescript
function inferFdFeed(status: MatchStatus): CanonicalMatchSource['fdBulkFeed'] {
  if (status === 'FINISHED') return 'results';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'all';
}
```

`inferFdFeed()` uses `fdMatch.status` to guess which feed the match came from.
But `IN_PLAY` status returns `'all'` — the match didn't come from a bulk "all"
feed; it came from the scheduled feed and was promoted by the live cache. The
inference is semantically wrong for live matches.

**Fix:** Change `buildCanonicalMatch()` signature to accept `fdFeed: 'scheduled' | 'results' | 'all'` explicitly from the caller instead of inferring from status. The caller (`buildAllCanonicalMatches()`) knows exactly which feed each match came from.

---

### R4 — High: `buildCanonicalMatch()` Signature Exposes Awkward Dual Parameters

**File:** `src/lib/canonical-match.ts:200`  
**Severity:** High (API design — not yet used, correctable in DATA-18B)  

```typescript
export function buildCanonicalMatch(
  fdMatch:     Match,
  snapshot:    MatchSnapshot | null,
  liveStatus:  MatchStatus | null,     // ← awkward split
  liveMinute:  number | undefined,     // ← awkward split
  ...
```

`liveStatus` and `liveMinute` are separate parameters but represent a single
concept (the live cache entry for this match). A caller can pass
`liveStatus = 'IN_PLAY'` with `liveMinute = undefined` — inconsistent.

**Fix (before DATA-18B):** Replace with a single optional live entry parameter:

```typescript
liveEntry: { status: MatchStatus; minute?: number } | null
```

---

### R5 — High: Shadow Comparison Marked "Optional" in S2

**File:** `DATA18A_MIGRATION_PLAN.md`  
**Severity:** High (process risk)  

The only mechanism to validate output parity between old and new paths before
any page reads canonical data is the S2 shadow comparison endpoint. Marking it
"optional" means S3 could proceed without parity evidence. If `buildCanonicalMatch()`
has a bug (e.g., R1 score staleness), it would ship to the Results page without detection.

**Fix:** Mark shadow comparison endpoint as **required gate for S3**. S3 must not
proceed until all 4 benchmark matches show `integrity.status === 'ok'` on the new path.

---

### R6 — High: Live Refresh Loop Design Incomplete for S4

**File:** `DATA18A_CACHE_STRATEGY.md`  
**Severity:** High (blocking for live-match accuracy in S4)  

The cache strategy describes a live refresh loop that "reads the current canonical
cache, applies live entries on top, writes back with TTL=30s." But this loop:
- Is not described in the migration plan as a prerequisite for any stage
- Is not part of any DATA-18B scope definition
- Does not exist yet in `refresh.ts`

Without this loop, the Hub page (`revalidate=30`) will read a potentially 30s-stale
canonical cache during live matches — which means live scores could be 30s stale on
the Hub even with the new authority cache.

**Fix:** Design and implement the live refresh loop in DATA-18B. It must be active
BEFORE the Hub page migrates to the authority cache (S4a).

---

### R7 — Medium: `enrichmentApplied` Conflates "Attempted" and "Produced Events"

**File:** `src/lib/canonical-match.ts:309`  
**Severity:** Medium  

```typescript
enrichmentApplied: goals.length > 0 || cards.length > 0 || substitutions.length > 0,
```

`false` means both "enrichment was never attempted" and "enrichment was attempted
but the match genuinely had no events" (e.g., 0-0 draw with no bookings). These
two states are indistinguishable from the outside.

**Impact:** Monitoring based on `enrichmentApplied=false` will false-positive on
0-0 matches that were successfully enriched.

**Fix:** Add `enrichmentAttempted: boolean` alongside `enrichmentApplied`. Set
`enrichmentAttempted=true` whenever a snapshot with enrichment infrastructure exists
(ESPN lookup was run), regardless of whether events were found.

---

### R8 — Medium: No Integrity Validation in `CanonicalMatch`

**File:** `src/lib/canonical-match.ts`  
**Severity:** Medium (operational gap)  

`CanonicalMatch` has no `integrity` field. The DATA-14A bug class (ESPN team IDs
not reconciled) would go undetected in the authority cache path if it regressed.
The shadow comparison in S2 would catch it, but only if the comparison is run.

**Fix:** Add `integrity: IntegrityResult` to `CanonicalMatch` and implement
`validateCanonicalMatch()` before S1. Minimum viable: C2 (team ID reconciliation)
and C3 (score completeness).

---

### R9 — Medium: S4 Migrates 4 Pages Simultaneously

**File:** `DATA18A_MIGRATION_PLAN.md`  
**Severity:** Medium (operational risk)  

If S4 has a bug (e.g., Group page breaks because `m.group` behaves differently
on `CanonicalMatch` vs `Match`), all 4 pages are affected simultaneously. The
rollback is "5+ file revert" which is manageable but wide.

**Fix:** Split S4 into S4a (Hub + Schedule) and S4b (Fixtures + Group). Hub and
Schedule are simpler (no group filtering, no multi-section logic).

---

### R10 — Low: `statusBadge()` on Results Page Still Reads `m.status`

**File:** `src/app/world-cup-2026-results/page.tsx:76`  
**Severity:** Low (will cause TypeScript error if not caught)  

```typescript
function statusBadge(m: Match): { label: string; cls: string } {
  if (m.status === 'IN_PLAY') ...
  if (m.status === 'PAUSED') ...
  if (m.status === 'FINISHED') ...
```

When S3 migrates the Results page to `CanonicalMatch`, `m.status` no longer exists
on the type. `CanonicalMatch` uses `m.state` ('live' / 'finished' / 'scheduled').
TypeScript will catch this if `statusBadge(m: CanonicalMatch)` is updated — but
if the function signature is not updated, the compiler will allow it (since
`statusBadge` currently accepts `Match`, and `CanonicalMatch` is structurally
different). The result would be a runtime bug: all matches show the default branch
(empty label, gray badge).

**Fix:** Update `statusBadge()` before S3 to accept `CanonicalMatch` and read
`m.state` / `m.minute`.

---

## 2. Top 10 Architecture Strengths

1. **Pure merge engine.** `buildCanonicalMatch()` has zero KV reads, zero network
   calls, zero side effects. It can be unit-tested deterministically with mock inputs.
   This is architecturally correct and rare in this codebase.

2. **Forward-only state promotion.** `STATE_RANK` prevents any data layer from
   downgrading a match from FINISHED. A 7-day-old snapshot cannot regress a match
   to SCHEDULED. This invariant is proven in the existing `overlayMatchStates()` and
   correctly carried into `buildCanonicalMatch()`.

3. **ESPN never owns score — structurally enforced.** The score resolution in
   `buildCanonicalMatch()` only reads from `fdMatch.score` or `snapshot.match.score`
   (which is FD-sourced). ESPN events populate `goals/cards/subs` but never touch
   the `score` field. This eliminates the whole class of "ESPN returns wrong score"
   bugs.

4. **Single authority entry point for all WC pages.** DATA-17 already achieved
   this — `getWCAuthorityMatches()` is the only function any WC page calls. DATA-18B
   only changes what that function returns, not where it's called from.

5. **Explicit provenance in `CanonicalMatchSource`.** Every canonical object carries
   `source.builtAt`, `source.fdBulkFeed`, and snapshot metadata. This makes debugging
   "why did this match show X" answerable from the object itself, without reading logs.

6. **107× KV read reduction on listing pages.** Current path: 3 bulk reads + 104-key
   mget per page per ISR cycle. Authority cache path: 1 read. At `revalidate=30` for
   the Hub during a live match, this is ~3,570 KV reads/hour → ~30 reads/hour.

7. **DR copy at 7d.** The authority cache DR covers a 7-day outage window, longer
   than any individual component's DR TTL. This is an improvement over the current
   fragmented per-page DR strategy.

8. **Staged migration with rollback at every stage.** S0 → S5 each have a clean
   rollback. No stage requires a database migration, schema change, or coordination
   across services. The risk at any individual stage is bounded.

9. **`CanonicalMatch` is a real interface, not a type alias.** The DATA-17 `type
   CanonicalMatch = Match` alias provided no structural guarantees. The DATA-18A
   real interface enforces field ownership at the type level — pages cannot silently
   receive unenriched `Match` objects as `CanonicalMatch`.

10. **`buildCanonicalMatch()` is timestamp-aware for `lastUpdated`.** It computes
    `max(fdLastUpdated, snapshotGeneratedAt)` rather than picking one arbitrarily.
    This means `CanonicalMatch.lastUpdated` correctly reflects the most recent data
    update, regardless of which layer was newer.

---

## 3. Blocking Issues Before DATA-18B

| # | Issue | File | Required fix |
|---|-------|------|-------------|
| B1 | Stale snapshot score overwrite (R1) | `canonical-match.ts:234` | Add `snapIsNewer` timestamp guard |
| B2 | Dead code in `deriveState()` (R2) | `canonical-match.ts:158` | Simplify to `return 'scheduled'` |
| B3 | `inferFdFeed()` incorrect for live (R3) | `canonical-match.ts:167` | Accept `fdFeed` parameter explicitly |
| B4 | Awkward dual live parameters (R4) | `canonical-match.ts:200` | Replace with `liveEntry` object parameter |
| B5 | Shadow comparison not mandatory (R5) | `DATA18A_MIGRATION_PLAN.md` | Mark as required S3 gate |

All 5 blocking issues are in dormant code or documentation — zero production impact today.
All 5 fixes are localized to `canonical-match.ts` and the migration plan document.

---

## 4. Non-Blocking Issues

| # | Issue | Recommended stage |
|---|-------|------------------|
| N1 | Live refresh loop not yet designed (R6) | Design in DATA-18B; implement before S4a |
| N2 | `enrichmentApplied` ambiguity (R7) | Fix in S1 alongside `buildAllCanonicalMatches()` |
| N3 | No integrity validation (R8) | Add in S1; minimum viable: C2 + C3 |
| N4 | S4 migrates 4 pages at once (R9) | Split into S4a + S4b in migration plan |
| N5 | `statusBadge()` reads `m.status` (R10) | Fix in S3 scope definition |
| N6 | Lineups inflate cache payload | Strip lineups from authority bulk key; store in sidecar |
| N7 | `canonical-match.ts` has no "do not import" warning | Add comment before S1 |
| N8 | `getRecentMatchesCached` still used by snapshot builder | Audit before S5 |
| N9 | `enrichmentAttempted` missing (R7 companion) | Add in S1 |

---

## 5. Recommended Architecture

The DATA-18A design is fundamentally correct. The recommended architecture remains:

```
FD bulk feeds (SCHEDULED/TIMED/FINISHED)
+ live cache (30s, IN_PLAY/PAUSED)
+ per-match snapshots (ESPN-enriched, 7d TTL)
        ↓
buildCanonicalMatch() [pure, per-match]
        ↓
CanonicalMatch[104] + integrity metadata
        ↓
goalradar:wc:authority:v1 (Option A, with lineups excluded from bulk)
        ↓
getWCAuthorityMatches() → CanonicalMatch[]
        ↓
All WC pages
```

**One architectural change recommended:** Store lineups in the per-match snapshot
only (they already are). Strip `lineups` from the `CanonicalMatch` in the authority
bulk cache key. Listing pages never display lineups. Match detail pages read directly
from `getOrBuildMatchSnapshot()`. This reduces the bulk payload from ~1.1 MB (all
enriched) to ~200 KB and removes an unnecessary dependency between the match detail
rendering layer and the listing page caching layer.

---

## 6. Final Verdict

### **YELLOW — Proceed to DATA-18A.2 first**

**Rationale:**

There are 5 blocking issues (B1–B5) that must be fixed in `canonical-match.ts`
before DATA-18B activates `buildCanonicalMatch()`. These are all small, localized
fixes in a dormant file — none affect production today. But shipping DATA-18B with
these issues unresolved would put known bugs into the first live version of the
authority builder.

DATA-18A.2 is a small remediation task:
1. Fix B1 (score staleness timestamp guard) — ~5 lines
2. Fix B2 (dead code in `deriveState`) — ~3 lines
3. Fix B3 (`inferFdFeed` → explicit `fdFeed` parameter) — ~10 lines + signature change
4. Fix B4 (dual live params → `liveEntry` object) — ~10 lines + signature change
5. Update migration plan: shadow comparison mandatory, S4 split → S4a + S4b

After DATA-18A.2, the architecture is **GREEN** to proceed to DATA-18B.

### DATA-18B should NOT proceed immediately.

DATA-18A.2 (remediation of B1–B5 in `canonical-match.ts`) must come first.

---

## 7. Executive Summary

The DATA-18A architecture for World Cup Single Source of Truth is **sound in
concept and mostly correct in implementation**. The core decisions — pure merge
engine, FD as fixture authority, ESPN never owning score, single authority cache
key, staged migration — are all correct and represent a significant improvement
over the current fragmented per-page composition.

**Five issues require remediation before DATA-18B:**

The most important is R1 (stale snapshot score overwrite) — a dormant bug in
`buildCanonicalMatch()` where snapshot score unconditionally overrides FD score
for FINISHED matches, without checking which is newer. In the rare event of a
score correction, this would display the wrong score for up to 7 days.

The remaining four are API design issues (dead code, incorrect inference, awkward
parameter split) and a process risk (shadow comparison optional in S2) — all
correctable in a single small remediation PR.

After those five fixes, the architecture is ready for DATA-18B implementation.

| Category | Finding count |
|----------|--------------|
| Blocking (must fix before DATA-18B) | 5 |
| Non-blocking (fix during migration) | 9 |
| Architecture strengths | 10 |
| **Final verdict** | **YELLOW → DATA-18A.2 required** |
