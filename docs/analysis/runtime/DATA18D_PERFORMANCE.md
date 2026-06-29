# DATA-18D Phase 3 — Performance Benchmark
## Old Path vs Authority Cache New Path

Benchmark endpoint: `/api/debug/data18d-perf-benchmark`  
To run: `curl "https://www.goalradar.org/api/debug/data18d-perf-benchmark?secret=$CRON_SECRET"`

---

## Expected Performance Characteristics

Based on architecture analysis (fill actual numbers after running the endpoint):

### OLD PATH: `getWCAuthorityMatches()`

Data flow:
1. Read WC results feed from KV: `goalradar:/competitions/WC/matches?status=FINISHED` (1 KV GET)
2. Read WC upcoming feed from KV: `goalradar:/competitions/WC/matches?status=TIMED` (1 KV GET)
3. Read live cache from KV: `goalradar:wc:live` (1 KV GET)
4. Merge and apply `overlayMatchStates()`
5. Return `Match[]`

Estimated: **3 KV commands**, match count ~104, duration ~20–50ms on cache hit.

### NEW PATH: `getWCAuthorityMatchesV2()`

Data flow:
1. Read authority cache primary: `goalradar:wc:authority:v1` (1 KV GET)
   → **HIT**: return 104 `CanonicalMatch[]` immediately
   → **DR**: read `goalradar:dr:wc:authority:v1` (1 more KV GET)
   → **COLD**: read 3 feeds + mget 104 snapshot keys (~107 KV commands)

Estimated (cache HIT): **1 KV command**, duration ~5–15ms.  
Estimated (cold rebuild): **107+ KV commands**, duration ~200–500ms.

---

## Benchmark Results

*(Run the endpoint and paste results here)*

```
curl "https://www.goalradar.org/api/debug/data18d-perf-benchmark?secret=$CRON_SECRET" | jq .
```

### T+0 (Canary Activation)

```json
{
  "PASTE_BENCHMARK_OUTPUT_HERE": true
}
```

### T+1h (Warm Cache)

```json
{
  "PASTE_BENCHMARK_OUTPUT_HERE": true
}
```

---

## Analysis Template

| Metric | Old Path | New Path (HIT) | New Path (COLD) | Target |
|--------|----------|---------------|-----------------|--------|
| KV commands | 3 | 1 | ~107 | New ≤ Old on HIT |
| Duration (ms) | TBD | TBD | TBD | HIT < Old |
| Payload (KB) | TBD | TBD | TBD | New ≤ Old |
| Match count | TBD | TBD | TBD | Both = 104 |

**Payload size note:** `CanonicalMatch` excludes lineups by design (comment in canonical-match.ts:168–173). This reduces the per-match payload from ~10KB (full Match with lineups) to ~2KB for listing purposes. Expected authority cache payload: ~200KB vs ~1MB+ for full Match[]. However, the listing feed `Match[]` from `getWCAuthorityMatches()` also doesn't have lineups (feed-level data), so the payload comparison is against the feed-level `Match` objects.

---

## Performance Gate Criteria (for Phase 5)

- Authority cache HIT path must be faster than or equal to legacy path
- Authority cache must not add >50ms overhead on HIT
- Cold rebuild is acceptable (single-flight guard prevents storms)
- Match count must be identical: both return 104 WC matches
