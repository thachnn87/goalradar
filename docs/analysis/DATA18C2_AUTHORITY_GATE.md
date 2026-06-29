# DATA-18C.2 Phase 4 — Shadow Diff Gate (Authority Compare)
## Production Authority Cache Gate Result: GREEN

Endpoint: `/api/debug/authority-compare`  
Timestamp: 2026-06-17T10:29:47Z  
Note: One intermediate run returned RED due to a bug in `canonical-match.ts` (see Bug Fixed below). Final run confirmed GREEN.

---

## Final Gate Result

```json
{
  "gate": "GREEN",
  "checkedAt": "2026-06-17T10:29:47.399Z",
  "benchmarkCount": 4,
  "oldPathCount": 104,
  "newPathCount": 104,
  "benchmarks": [
    {
      "matchId": 537397,
      "scoreIdentical": true,
      "enrichmentApplied": true,
      "goalsLengthMatch": true,
      "stateFinished": true,
      "integrityOk": true,
      "goals": 3
    },
    {
      "matchId": 537392,
      "scoreIdentical": true,
      "enrichmentApplied": true,
      "goalsLengthMatch": true,
      "stateFinished": true,
      "integrityOk": true,
      "goals": 5
    },
    {
      "matchId": 537391,
      "scoreIdentical": true,
      "enrichmentApplied": true,
      "goalsLengthMatch": true,
      "stateFinished": true,
      "integrityOk": true,
      "goals": 4
    },
    {
      "matchId": 537351,
      "scoreIdentical": true,
      "enrichmentApplied": true,
      "goalsLengthMatch": true,
      "stateFinished": true,
      "integrityOk": true,
      "goals": 8
    }
  ]
}
```

**Phase 4 verdict: GREEN** — all 4 benchmark matches pass all 5 checks.

---

## Benchmark Checks Summary

| matchId | Match | scoreIdentical | enrichmentApplied | goalsLengthMatch | stateFinished | integrityOk | Goals |
|---------|-------|:--------------:|:-----------------:|:----------------:|:-------------:|:-----------:|-------|
| 537397 | Argentina vs Algeria | ✓ | ✓ | ✓ | ✓ | ✓ | 3 |
| 537392 | Norway vs Iraq | ✓ | ✓ | ✓ | ✓ | ✓ | 5 |
| 537391 | France vs Senegal | ✓ | ✓ | ✓ | ✓ | ✓ | 4 |
| 537351 | Germany vs Curaçao | ✓ | ✓ | ✓ | ✓ | ✓ | 8 |

All checks: 20/20 PASS (4 matches × 5 checks).

---

## Coverage: All 104 WC Matches Processed

- `oldPathCount=104` — existing path processed all 104 WC matches
- `newPathCount=104` — authority cache new path also processed all 104 WC matches
- No partial failures, no skipped matches

---

## Bug Fixed During Phase 4 (commit 6490f11)

**Error encountered on first authority-compare run:**
```
"new-path error: Cannot read properties of undefined (reading 'length')"
```

**Root cause:** `src/lib/canonical-match.ts` lines 408–410 — `hasEspnEvents` calculation called
`.length` without optional chaining on `snapshot.match.goals`, `snapshot.match.bookings`,
`snapshot.match.substitutions`. For 84 UPCOMING match snapshots these arrays are `undefined`
at runtime (TypeScript types them as `Goal[]` but they are absent from the prewarm-built UPCOMING
snapshots).

**Fix applied:**
```typescript
// BEFORE (throws for UPCOMING snapshots):
const hasEspnEvents =
  snapshot !== null &&
  (snapshot.match.goals.length > 0 ||
   snapshot.match.bookings.length > 0 ||
   snapshot.match.substitutions.length > 0);

// AFTER (safe for all snapshot types):
const hasEspnEvents =
  snapshot !== null &&
  ((snapshot.match.goals?.length ?? 0) > 0 ||
   (snapshot.match.bookings?.length ?? 0) > 0 ||
   (snapshot.match.substitutions?.length ?? 0) > 0);
```

**Impact:** Bug existed in production but was latent — authority cache is currently inactive
(`AUTHORITY_CACHE_ENABLED=false`). When activated, this would have thrown for 84/104 matches
on every authority cache rebuild. Fix committed before gate measurement; second authority-compare
run returned GREEN confirming the fix is correct.
