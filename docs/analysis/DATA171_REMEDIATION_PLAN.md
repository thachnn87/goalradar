# DATA-17.1 Phase 5 — Remediation Plan
## Design-Only: Minimal-Risk Fixes for All 7 Production Symptoms

Date: 2026-06-17  
Status: DESIGN ONLY — no code changes in this document.

---

## Constraint

> STOP AFTER DESIGN. DO NOT build. DO NOT modify production logic.

All 7 fixes below are described at design level. Implementation belongs in a later DATA-17.2
or DATA-18x task after this plan is reviewed and approved.

---

## Fix 1 — Symptom #2: Austria vs Jordan in "Today's Matches"

**Root cause:** `classifyMatchState()` returns `'today'` for any SCHEDULED/TIMED match with
a past kickoff date. Austria vs Jordan is still SCHEDULED/TIMED in the authority set because:
(a) The FINISHED KV key may not have been written yet (cron delay), or
(b) No per-match snapshot exists to overlay the FINISHED state.

**Minimal fix (design):**

Option A — Fix `classifyMatchState()` for past-kickoff SCHEDULED/TIMED:
```typescript
// match-classify.ts, branch for SCHEDULED/TIMED:
if (s === 'SCHEDULED' || s === 'TIMED') {
  const matchDay = match.utcDate.split('T')[0];
  if (matchDay === todayUTC) return 'today';
  if (matchDay > todayUTC) return 'upcoming';
  // matchDay < todayUTC: kickoff was in the past; status hasn't advanced
  return 'other';  // ← changed from 'today' to 'other'
}
```

**Trade-off:** If a match is SCHEDULED with a past date AND is legitimately expected to
still play (postponement not yet recorded), it would no longer appear in "Today's Matches".
This is the SAFER choice — showing a ghost match is worse than hiding a legitimately delayed
one. The Hub's "Today's Matches" section should show KNOWN matches, not guesses.

Option B — FINISHED feed speed-up (not minimal):  
Reduce the `wc-finished` cron skip-if-fresh window from 30 min to 5 min during WC active
hours. More aggressive cron runs; higher provider API usage. Not recommended as primary fix.

**Recommendation:** Option A. One-line change in `match-classify.ts`. Zero KV/API impact.
Risk: near-zero (correctly hides matches with past kickoff that haven't yet been marked FINISHED).

---

## Fix 2 — Symptom #3 and #4: Results page shows only 4 matches / incorrect stats

**Root cause:** `getWCResultsCached()` returns only what the FINISHED KV key contains. If
the key was written when only 4 matches had finished, it stays stale for up to 12 h.
`readKVOnly` does not trigger SWR revalidation, so no background refresh fires from the page.

**Minimal fix (design):**

`getWCResultsCached()` currently:
```typescript
const data = await withCache(key, TTL.FIXTURES, async () => {
  const inner = await readKVOnly<{ matches: Match[] }>(key);
  if (inner) return inner;
  return { matches: [] };  // ← no SWR trigger on miss
});
```

Change to trigger SWR on miss AND on stale reads by using `withKVCache()` instead of
`readKVOnly()` inside the fallback:
```typescript
const data = await withCache(key, TTL.FIXTURES, async () =>
  withKVCache(key, SWR.FIXTURES, () => providerManager.getResults('WC'))
);
```

This is actually exactly what `getWCResults()` (the non-Cached variant) already does.
`getWCResultsCached()` can simply be collapsed to call `getWCResults()` directly.

**Trade-off:** Pages would then trigger background SWR refreshes for the FINISHED feed.
This was previously avoided (DATA-16D) to prevent page-triggered provider calls during
rapid ISR cycles. However, with `COALESCE_LOCK_SEC=30` and a 30-min skip-if-fresh guard
in the orchestrator, background SWR from pages is safe and bounded.

**Alternative minimal fix (zero-code-change):** Reduce the cron schedule from 30 min to 
5 min during WC tournament active hours. This fixes the staleness window without any code
change, at the cost of higher orchestrator invocation count (288/day vs 48/day).

**Recommendation:** Reduce cron cadence to 5–10 min during WC active hours (via EasyCron
schedule), plus apply the `withKVCache` change to `getWCResultsCached()` so pages can
self-heal when the cron is delayed. Total risk: low.

---

## Fix 3 — Symptom #5: Older finished matches lost Event Enrichment

**Root cause:** Two independent failure modes:

**Mode A — Prewarm race condition:** ESPN ID not mapped at first snapshot build → 0-goal
snapshot + 0-goal DR key. Subsequent rebuilds after ESPN timeline purge cannot recover.

**Mode B — ESPN timeline purge:** ESPN stops serving timeline data for matches >72h old.
Snapshot rebuilds after Day 3 produce 0-goal snapshots. DR key protection fails if DR was
also built without enrichment.

**Minimal fix A — Repair poisoned DR keys (design):**

A one-time repair script reads all `goalradar:dr:match:{id}` DR keys for FINISHED WC
matches where `goals.length === 0` AND the match has a non-zero score. For each such match,
it attempts to fetch enrichment from ESPN (if timeline available) and re-writes the DR key.

This is a cron/script action, not a page change. Estimated scope: ~15–20 affected matches.

**Minimal fix B — Extend ESPN event cache TTL from 12 h to 7 days (design):**

```typescript
// espn-id-map.ts or wherever the ESPN event cache TTL is set
const ESPN_EVENT_CACHE_TTL = 7 * 24 * 3600; // 7 days (was: 12 h)
```

If the ESPN event data is cached for 7 days, the window where enrichment succeeds extends
from "12h after match" to "7 days after match" — matching the snapshot TTL exactly. This
eliminates Mode B entirely (enrichment succeeds on first rebuild within the 7-day window).

**Minimal fix C — Write DR key AFTER enrichment (not before) (design):**

Currently `writeKVSnapshot()` writes both primary and DR atomically. If enrichment
succeeds, both get goals. If enrichment fails, both get 0 goals (poisoning the DR).

Change: write the DR key only when `goals.length > 0`, and write it SEPARATELY after
enrichment. The DR key then functions as "the last known good enriched snapshot" rather
than "a copy of whatever was written".

```typescript
// Pseudocode change in writeKVSnapshot():
await kv.set(primaryKey, snapshot, { ex: ttl }); // always write primary
if (snapshot.match.goals?.length > 0) {
  await kv.set(drKey, snapshot, { ex: DR_TTL }); // only write DR if enriched
}
```

**Recommendation:** Fix B (extend ESPN cache TTL) is the lowest-risk change. Fix C is the
correct architectural fix but requires snapshot.ts changes. Fix A (repair script) is a
one-time production recovery step.

---

## Fix 4 — Symptom #6: Austria vs Jordan still has scorer enrichment

**Status: This is CORRECT behaviour, not a bug.** Austria vs Jordan is a recent match.
Its snapshot is within the 7-day TTL and was built when ESPN timeline data was available.
No fix required. Document this as expected behaviour for reference.

---

## Fix 5 — Symptom #7: API-AUDIT duplicate FINISHED feed warnings

**Root cause:** Triple `overlayMatchStates()` call per authority page request.

**Minimal fix (design) — remove the redundant third overlay:**

In `getWCAuthorityMatchesCached()`:
```typescript
// BEFORE (3 overlays):
return { matches: await overlayMatchStates([...byId.values()]) };

// AFTER (1 overlay — remove the outer call, trust the component feeds):
return { matches: [...byId.values()] };
```

The merged `byId` map already contains overlaid matches from each component feed.
The third overlay reads 104 snapshot keys that were already read twice, gaining nothing.

**However:** This change must be validated carefully. The third overlay has a subtle purpose:
it can catch FINISHED transitions that occurred AFTER the SCHEDULED feed was last written,
if a per-match snapshot exists at `goalradar:match:{id}` with status=FINISHED. Removing it
means the authority set relies solely on the FINISHED KV key (cron-driven) for state
advancement. This is acceptable once the FINISHED feed cron cadence is tightened (Fix 2).

**Dependency:** Fix 5 depends on Fix 2. Do not remove the third overlay until the FINISHED
feed is updated frequently enough to catch matches within the ISR window.

**Alternative minimal fix (no code change):** Accept the duplicate reads. The COALESCE_LOCK_SEC
in `kv-cache.ts` prevents concurrent SWR refreshes. The mget calls are read-only and fast
(<5 ms for 104 keys). The API-AUDIT warning is cosmetic. Low priority if KV costs are acceptable.

---

## Symptom #1 Recap — Not a Bug

**Symptom #1:** Austria vs Jordan is FT 3-1 on the Match Detail page.

**Status: CORRECT.** The Match Detail page reads `goalradar:match:{id}` — a per-match snapshot
built from the FD match detail API and enriched from ESPN. The score and enrichment are accurate.
No fix required.

---

## Fix Priority and Risk Matrix

| Fix | Symptom(s) | Risk | Effort | Dependencies |
|-----|-----------|------|--------|-------------|
| Fix 1: `classifyMatchState` past-kickoff → `'other'` | #2 | Very low | 1 line | None |
| Fix 2A: Reduce cron cadence to 5–10 min | #3, #4 | Low (cost) | Config change | None |
| Fix 2B: `getWCResultsCached` → use `withKVCache` | #3, #4 | Low | 3 lines | None |
| Fix 3A: Repair script for poisoned DR keys | #5 | Low (one-time) | Script | None |
| Fix 3B: Extend ESPN event cache TTL to 7 days | #5 | Low | 1 constant | None |
| Fix 3C: Write DR only when enriched | #5 | Medium | match-snapshot.ts refactor | None |
| Fix 5: Remove redundant third overlay | #7 | Medium | 1 line + validation | Requires Fix 2 first |

---

## Recommended Sequence

1. **Fix 1** — Deploy immediately: 1-line change to `match-classify.ts`. Eliminates the
   "ghost match in Today's Matches" with zero risk.

2. **Fix 2A** — Tighten cron cadence to 10 min during WC active hours. No code change.
   Reduces FINISHED feed staleness from 30 min to 10 min.

3. **Fix 3B** — Extend ESPN event cache TTL to 7 days. 1 constant change. Prevents new
   enrichment regressions for all future matches.

4. **Fix 3A** — Run one-time repair script for already-poisoned DR keys. Recovers existing
   group stage matches.

5. **Fix 2B** — After cron cadence is tightened and validated, add SWR trigger to
   `getWCResultsCached()` as a self-healing fallback.

6. **Fix 5** — After Fix 2 is stable, remove the redundant third overlay. Monitor
   API-AUDIT logs to confirm warnings cease.

7. **Fix 3C** — Architecture fix for the DR write ordering. Lower urgency after Fix 3A+3B
   prevent new poisoning.

---

## What This Plan Does NOT Include

- **No Authority Cache changes** — DATA-18B is already complete; this plan does not
  interact with `src/lib/authority-cache.ts`
- **No DATA-18C or later steps** — shadow validation and cache activation are a separate track
- **No new KV keys or schema changes**
- **No new API providers or endpoints**
- **No ISR revalidate value changes**
