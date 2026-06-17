# DATA-18C.1 Phase 5 — Authority Cache Impact & Gate Forecast
## Shadow Diff Simulation With Repaired Snapshots

Forecast timestamp: 2026-06-17T10:10:00Z  
Based on: rebuild test results + canonical-match.ts analysis + authority-compare/route.ts gate criteria

---

## 1. Shadow Diff Gate Criteria

The `/api/debug/authority-compare` endpoint checks 5 conditions per benchmark match:

```
benchmarkIds = [537397, 537392, 537391, 537351]

Per-match gate is GREEN iff ALL pass:
  ✓ scoreIdentical     — FD score.fullTime.home/away matches authority path
  ✓ enrichmentApplied  — CanonicalMatch.enrichmentApplied === true
  ✓ goalsLengthMatch   — goals array length > 0 AND old/new paths agree
  ✓ stateFinished      — CanonicalMatch.state === 'finished'
  ✓ integrityOk        — CanonicalMatch.integrity.status === 'ok'

Overall gate is GREEN iff all 4 benchmark matches pass all 5 checks.
```

`enrichmentApplied` in `canonical-match.ts`:
```typescript
const enrichmentApplied = goals.length > 0 || cards.length > 0 || substitutions.length > 0;
```

This is `true` iff the snapshot had any goals, cards, or substitutions. It maps directly to `goals.length > 0` for the FINISHED WC matches in question (all scored).

---

## 2. Current Gate State (Pre-Repair)

Based on DATA-18C.0 findings (all 4 benchmark matches have 0-goal snapshots):

| Match | Score | scoreIdentical | enrichmentApplied | goalsLengthMatch | stateFinished | integrityOk | Gate |
|-------|-------|---------------|-------------------|-----------------|--------------|-------------|------|
| 537351 Germany 7-1 | 7-1 | PASS | **FAIL** (goals=0) | **FAIL** | PASS | PASS | **RED** |
| 537391 France 3-1 | 3-1 | PASS | **FAIL** (goals=0) | **FAIL** | PASS | PASS | **RED** |
| 537392 Iraq 1-4 | 1-4 | PASS | **FAIL** (goals=0) | **FAIL** | PASS | PASS | **RED** |
| 537397 Argentina 3-0 | 3-0 | PASS | **FAIL** (goals=0) | **FAIL** | PASS | PASS | **RED** |

**Current gate: RED. 0/4 matches pass.**

---

## 3. Simulated Gate State (Post-Repair)

Based on rebuild test results for 537351, 537391, 537397 and extrapolation for 537392:

### 537351 — Germany vs Curaçao (TESTED)

```
After repair:
  snapshot.goals = 8  (Felix Nmecha, Schlotterbeck, Havertz×2, Musiala, Brown, Undav, Comenencia)
  snapshot.subs  = 8
  snapshot.hasLineup = true

buildCanonicalMatch(fdMatch, snapshot, espnId=undefined):
  goals.length = 8  → enrichmentApplied = true  ✓
  state = 'finished'                              ✓
  scoreIdentical: FD 7-1 vs canonical 7-1        ✓
  goalsLengthMatch: 8 goals ≠ 0                  ✓
  integrityOk: snapshot present, score consistent ✓

Gate: GREEN ✓
```

### 537391 — France vs Senegal (TESTED)

```
After repair:
  snapshot.goals = 4  (Mbappé×2, Barcola, Ibrahim Mbaye)
  snapshot.subs  = 7
  snapshot.hasLineup = true

buildCanonicalMatch result:
  enrichmentApplied = true  ✓
  state = 'finished'        ✓
  scoreIdentical: 3-1       ✓
  goalsLengthMatch: 4 ≠ 0   ✓
  integrityOk: ✓

Gate: GREEN ✓
```

### 537397 — Argentina vs Algeria (TESTED)

```
After repair:
  snapshot.goals = 3  (Lionel Messi hat-trick: 17', 60', 76')
  snapshot.subs  = 10
  snapshot.hasLineup = true

buildCanonicalMatch result:
  enrichmentApplied = true  ✓
  state = 'finished'        ✓
  scoreIdentical: 3-0       ✓
  goalsLengthMatch: 3 ≠ 0   ✓
  integrityOk: ✓

Gate: GREEN ✓
```

### 537392 — Iraq vs Norway (NOT DIRECTLY TESTED)

Match: Jun 16, FD score 1-4. Not in the 3-match test set but is a benchmark match.

Extrapolation from 537391 (France vs Senegal, also Jun 16):
- Same match date → same prewarm batch → same poisoning mechanism
- Same repair path → AF events would be populated for Jun 16 matches
- Expected repair: goals ≥ 5 (1 Iraq goal + 4 Norway goals), subs, lineups recovered

```
Expected after repair:
  snapshot.goals ≥ 5  (Iraq × 1, Norway × 4)
  enrichmentApplied = true  ✓
  state = 'finished'        ✓
  scoreIdentical: 1-4       ✓
  integrityOk: ✓

Gate: GREEN (projected) ✓
```

Risk: If AF events for 537392 happen to be unavailable (e.g., this specific match wasn't in the AF database at lookup time), it would still be RED after repair. Mitigation: run the repair and verify.

---

## 4. Post-Repair Gate Forecast

| Match | Score | Post-repair goals | enrichmentApplied | Gate |
|-------|-------|------------------|-------------------|------|
| 537351 Germany | 7-1 | 8 (CONFIRMED) | true | **GREEN** ✓ |
| 537391 France | 3-1 | 4 (CONFIRMED) | true | **GREEN** ✓ |
| 537392 Iraq/Norway | 1-4 | 5 (PROJECTED) | true | **GREEN** (projected) |
| 537397 Argentina | 3-0 | 3 (CONFIRMED) | true | **GREEN** ✓ |

**Forecast gate: GREEN for 3/4 confirmed, 4/4 projected.**

Confidence: HIGH (85–95%). The only risk is 537392 AF events being unavailable, which is addressable with a single organic page visit to `/match/537392` before running the shadow diff.

---

## 5. Authority Cache Activation Readiness

### What Changes After Snapshot Repair

Before repair:
```
readAuthorityCache() → buildAllCanonicalMatches()
  → snapshotMap.get('537351') = { goals: [] }  // poisoned
  → buildCanonicalMatch(fdMatch, snapshot) → enrichmentApplied = false
  → shadow diff returns RED
```

After repair (primary snapshot deleted → organic rebuild on page visit):
```
readAuthorityCache() → buildAllCanonicalMatches()
  → snapshotMap.get('537351') = { goals: [8 scored goals] }  // repaired
  → buildCanonicalMatch(fdMatch, snapshot) → enrichmentApplied = true
  → shadow diff returns GREEN
```

### Remaining Blockers (Updated from DATA18C0_READINESS_GATE)

| Blocker | Original | Revised | Status |
|---------|----------|---------|--------|
| 18/20 snapshots with 0 goals | BLOCKING | **BLOCKING** | Requires repair (delete + rebuild) |
| 0/20 ESPN IDs | BLOCKING | **NON-BLOCKING** | AF confirmed working; ESPN not needed |
| FINISHED feed no DR | HIGH | HIGH | Self-heals; re-check before activation |

**Single remaining blocker: repair the 18 poisoned snapshots.**

### Repair Execution Plan

1. Delete primary snapshot KV keys for all 18 poisoned matches:
   ```
   goalradar:match:{id} for each of the 18 poisoned match IDs
   ```

2. Trigger organic rebuild (one of):
   - **Option A**: Visit each match detail page once (page visit triggers `getOrBuildMatchSnapshot`)
   - **Option B**: Trigger prewarm cron (`/api/cron/prewarm` with CRON_SECRET) — batch-rebuilds all FINISHED matches
   - **Option C**: Run repair script that calls `getOrBuildMatchSnapshot` for each ID directly

3. Verify: call `/api/debug/authority-compare` → expect GREEN for all 4 benchmark matches

4. If all GREEN: activate Authority Cache (`AUTHORITY_CACHE_ENABLED=true` in Vercel env)

### Time to GREEN Estimate

| Step | Time |
|------|------|
| Delete 18 primary snapshot keys | ~1 min |
| Trigger prewarm cron | ~30 sec |
| Wait for prewarm to complete (18 AF enrichment calls) | ~5 min |
| Re-run shadow diff | ~1 min |
| **Total** | **~7 min** |

This is a significant revision from the DATA-18C.0 estimate of ~2 hours (which included ESPN ID investigation). With AF enrichment confirmed working, the ESPN investigation step is eliminated.

---

## 6. ESPN-Free Authority Cache Operation

Once activated, `writeAuthorityCache()` calls `buildAllCanonicalMatches(snapshotMap, espnIdMap)`.

With `espnIdMap = new Map()` (empty, as currently):
- `buildCanonicalMatch(fdMatch, snapshot, espnIdMap)` → `espnMatchId = undefined`
- `CanonicalMatch.espnMatchId = undefined`
- All other fields populated from FD + AF-enriched snapshot

The shadow diff checks `enrichmentApplied` (goals/cards/subs present), not `espnMatchId`. An empty ESPN map does not affect gate passage.

**The Authority Cache will operate correctly with 0 ESPN IDs** for all fields that are displayed to users (score, goals, scorers, subs, lineups, state, group standings). ESPN IDs would only matter if the canonical match links to ESPN match pages — which is a future feature, not a gate criterion.

---

## 7. Gate Forecast Summary

| Condition | Pre-repair | Post-repair |
|-----------|-----------|------------|
| `scoreIdentical` (all 4) | PASS | PASS |
| `enrichmentApplied` (537351) | FAIL | **PASS** (8 goals confirmed) |
| `enrichmentApplied` (537391) | FAIL | **PASS** (4 goals confirmed) |
| `enrichmentApplied` (537392) | FAIL | **PASS** (projected) |
| `enrichmentApplied` (537397) | FAIL | **PASS** (3 goals confirmed) |
| `goalsLengthMatch` (all 4) | FAIL | **PASS** |
| `stateFinished` (all 4) | PASS | PASS |
| `integrityOk` (all 4) | PASS | PASS |
| **Overall gate** | **RED** | **GREEN** |

**Recommendation: Proceed with repair. Expected time to green: ~7 min.**

After green gate: DATA-18C activation (set `AUTHORITY_CACHE_ENABLED=true`, wire `writeAuthorityCache()` into cron) is unblocked.
