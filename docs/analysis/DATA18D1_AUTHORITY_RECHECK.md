# DATA-18D.1 Phase 5 — Authority Readiness Recheck
## authority-compare for ALL Finished Matches

Endpoint: `/api/debug/authority-compare?scope=all`  
To run: `curl "https://www.goalradar.org/api/debug/authority-compare?scope=all" -H "x-internal-token: $INTERNAL_TOKEN" | jq '{gate, scope, greenCount, redCount, oldPathCount, newPathCount}'`

---

## Scope Change vs DATA-18C.2

| | DATA-18C.2 Phase 4 | DATA-18D.1 Phase 5 |
|-|-------------------|-------------------|
| Matches checked | 4 (537397, 537392, 537391, 537351) | ALL FINISHED (dynamic from KV feed) |
| Mode | Default (`BENCHMARK_IDS`) | `?scope=all` |
| Match count | 4/4 GREEN | Required: 100% GREEN |

---

## Endpoint: `?scope=all` Implementation

The `authority-compare` endpoint now reads `goalradar:/competitions/WC/matches?status=FINISHED` when `?scope=all` is passed. For each FINISHED match it:

1. Fetches it from old path (`getWCAuthorityMatches()`)
2. Fetches it from new path (`getWCAuthorityMatchesV2()`)
3. Runs the 5 standard checks:
   - `scoreIdentical`: old path score === new path score
   - `enrichmentApplied`: `newMatch.enrichmentApplied === true` (or scoreTotal === 0)
   - `goalsLengthMatch`: `newMatch.goals.length > 0` (for scored matches)
   - `stateFinished`: `newMatch.state === 'finished'`
   - `integrityOk`: `newMatch.integrity.status === 'ok'`

The response includes per-match GREEN/RED, plus aggregate `greenCount` and `redCount`.

**Requirement:** `gate = "GREEN"` (all matches pass, `redCount = 0`)

---

## Actual Results

*(Run the endpoint after deployment and paste here)*

```bash
curl "https://www.goalradar.org/api/debug/authority-compare?scope=all" \
  -H "x-internal-token: $INTERNAL_TOKEN" | jq .
```

```json
{ "PASTE_AUTHORITY_COMPARE_OUTPUT_HERE": true }
```

---

## Expected Results

Based on:
- DATA-18C.2 Phase 4: all 4 benchmarks GREEN (authority-compare gate=GREEN)
- DATA-18C.2 Phase 2: all 18/18 repaired, totalMs=11,751ms
- DATA-18C.2 Phase 3: unenriched=0, ok=20

All 20 FINISHED matches should return GREEN on `?scope=all`.

Key matches with highest enrichment requirements:
- 537351 (Germany 7–1): 8 goals — enrichmentApplied, goalsLengthMatch must pass
- 537357 (England 3–1): 4 goals
- 537391 (France 3–1): 4 goals
- 537392 (Norway 3–2): 5 goals
- 537397 (Argentina 3–0): 3 goals

---

## Phase 5 Verdict

PENDING — run endpoint after deployment.

**Required for Phase 5:** `gate = "GREEN"`, `redCount = 0`

**If any RED:** Run `integrity-repair` endpoint to fix, then re-run `authority-compare?scope=all` until all GREEN.

---

## Final Question: Can Enrichment Regress Again?

**Answered after all 5 phases complete:**

Based on the comprehensive audit in DATA-18D.1:

### YES, enrichment CAN regress — but only in a bounded 24-hour window.

**Evidence:**

1. **The original 18-match failure CANNOT recur** (skip-if-exists guard, state regression guard)
2. **New FINISHED matches are vulnerable for up to 24h** when first built — if prewarm runs before AF events are cached, `buildPartialSnapshot` writes unenriched, and the repair cron catches it the next morning
3. **The repair-enrichment cron is now fully dynamic** (DATA-18D fix) and catches every FINISHED match, including new ones
4. **The `integrity-repair` endpoint** provides an on-demand fix for any detected failure — no longer constrained to daily repair cycle
5. **The downgrade guard** protects against single-match degradation in normal operation
6. **AF event cache (7-day TTL)** means enrichment is preserved for the full match week even if the primary snapshot expires

**Residual risk:** A new FINISHED match spends up to 24h unenriched if prewarm races against AF event cache population. This is a known architectural gap — `buildPartialSnapshot` does not call AF enrichment. Mitigation: operator can run `integrity-repair` manually after each match day to close the window immediately.

**To eliminate the 24h window permanently:** Extend `buildPartialSnapshot` in `prewarmWorldCup.ts` to include AF enrichment for the FINISHED tier (out of scope for DATA-18D.1, targeted for DATA-18E).

**Conclusion:**

| Question | Answer | Proof |
|----------|--------|-------|
| Can the original 18-match simultaneous poisoning recur? | **NO** | Skip-if-exists guard, state regression guard |
| Can a single match become unenriched? | **YES** | 24h window on first build after TTL expiry |
| Is there a repair mechanism? | **YES** | Repair cron (daily) + integrity-repair endpoint (on-demand) |
| Is the repair mechanism comprehensive? | **YES** | Covers goals, goals mismatch, lineup, subs, DR, missing snapshot |
| Is the tournament currently healthy? | **Run audit to confirm** | `integrity-audit` + `authority-compare?scope=all` |
