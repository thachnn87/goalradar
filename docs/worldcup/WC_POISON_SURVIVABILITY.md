# WC_POISON_SURVIVABILITY.md — DATA-18WC.9C Phase 5

**Date:** 2026-06-24
**Method:** Analysis of TTLs, DR promotion rules, write guards, and orchestrator behavior

---

## 1. SURVIVABILITY DEFINITION

**Poison survivability** = the maximum time a poisoned field value can remain as the active serving value without requiring operator intervention.

"Active serving" = the value returned to a user when they load a page. This requires the poison to survive in at least one of:
1. Primary KV key (if fresh)
2. DR KV key (when primary is expired/unavailable)
3. The authority cache (which is rebuilt from DR when stale)

Survival ends when:
- All KV keys for the field expire AND a fresh API fetch produces the correct value
- OR the DR key is explicitly purged
- OR the orchestrator successfully rebuilds the cache from a source that returns the correct value

---

## 2. POISON CYCLE ANALYSIS FOR STATUS="LIVE"

### Cycle Structure

The "LIVE" status poison doesn't just survive — it actively **self-regenerates** through a cycle:

```
Step 1: FD API returns status="LIVE" for in-play match
Step 2: Prewarm toMatchDetail() writes Detail KV with status="LIVE"
Step 3: Detail DR written with status="LIVE" (7d TTL)
Step 4: buildSnapshot() reads Detail KV → isLiveStatus("LIVE")=false → writes Snapshot KV with "LIVE"
Step 5: Snapshot DR written with status="LIVE" (30d TTL)
Step 6: Primary Detail KV expires (tier-based TTL)
Step 7: Next prewarm reads Detail KV → MISS → falls to Detail DR → reads "LIVE" from DR
Step 8: toMatchDetail() again writes Detail KV with status="LIVE" → Go to Step 3
Step 9: buildSnapshot() again writes Snapshot KV with "LIVE" → Go to Step 5
```

**Result:** The cycle resets the 30-day DR Snapshot TTL on every prewarm run. Without intervention, the poison is **perpetual** as long as:
- The prewarm reads from DR (orchestrator stalled or rate-safe active)
- OR the FD API still returns "LIVE" for this match (if match is actually cancelled, this eventually stops)

---

## 3. SURVIVABILITY BY CACHE TIER

### Tier 1: Primary KV Keys (Short TTL)

| Key | Normal TTL | Poison Survival |
|-----|-----------|----------------|
| `goalradar:/matches/{id}` — live tier (today matches) | 1920s | 32 minutes |
| `goalradar:/matches/{id}` — today tier | 1920s | 32 minutes |
| `goalradar:/matches/{id}` — next-24h tier | 1920s | 32 minutes |
| `goalradar:/matches/{id}` — next-3d tier | 9120s | 2.5 hours |
| `goalradar:/matches/{id}` — future tier | 45120s | 12.5 hours |
| `goalradar:/matches/{id}` — finished tier | 7d | 7 days |
| `goalradar:match:{id}` (snapshot) | 900s | 15 minutes |
| `goalradar:wc:authority:v1` — liveCount>0 tier | 300s | 5 minutes |
| `goalradar:wc:authority:v1` — normal tier | 900s | 15 minutes |
| `goalradar:live:matches` | 30s | 30 seconds |

**Conclusion:** Primary KV poison is always time-bounded and relatively short-lived. Worst case: finished-tier Detail KV at 7d.

### Tier 2: Disaster Recovery KV Keys (Long TTL)

| Key | DR TTL | Poison Survival |
|-----|--------|----------------|
| `goalradar:dr:/matches/{id}` | 7 days | **7 days** |
| `goalradar:dr:match:{id}` (snapshot DR) | **30 days** | **30 days** |
| `goalradar:dr:wc:authority:v1` | 7 days | **7 days** |
| `goalradar:dr:wc:matches:all` | 7 days | **7 days** |
| `goalradar:dr:live:matches` | 7 days | **7 days** |

**Conclusion:** DR poison is the dangerous tier. Snapshot DR at 30 days is the worst case. DR is only served when primary is unavailable — but the orchestrator stall makes this a normal operating mode, not an edge case.

---

## 4. SCENARIO ANALYSIS: BEST / EXPECTED / WORST CASE

### Match 537412 (Confirmed Poisoned Match)

#### Scenario A — Best Case
**Conditions:** Orchestrator recovers within minutes; FD API now returns CANCELLED for match 537412

1. Orchestrator runs `wc-finished` → FD returns Match 537412 with status=CANCELLED
2. Prewarm writes Detail KV with status=CANCELLED, Detail DR overwritten
3. `buildSnapshot()` reads CANCELLED from Detail KV → writes Snapshot KV correctly
4. But: DR Snapshot still has status="LIVE" from previous write
5. Primary Snapshot expires (15min) → falls to DR → "LIVE" returns from DR
6. **Poison survives until DR Snapshot TTL expires (30 days from last write)**

**Best case survival: 15 minutes before DR promotion reactivates poison.**

#### Scenario B — Expected Case
**Conditions:** Orchestrator stalled 2+ hours; FD API called on-demand by match page load

1. User loads `/match/537412`
2. `getOrBuildMatchSnapshot(537412)` → Snapshot KV = MISSING (expired)
3. Reads Detail KV → MISSING (expired)
4. Falls to DR Detail KV → reads status="LIVE"
5. `toMatchDetail()` spreads "LIVE" → `buildSnapshot()` → `isLiveStatus('LIVE')=false` → writes Snapshot KV with "LIVE"
6. `writeDRSnapshot()` overwrites DR Snapshot with "LIVE" (resets 30d clock)
7. User sees "LIVE" status on page

**Expected case survival: indefinite as long as orchestrator is stalled and DR Detail has "LIVE".**

#### Scenario C — Worst Case
**Conditions:** Orchestrator enters rate-safe mode (429 from FD); Rate-safe blocks prewarm for 1 hour

1. All primary keys expire during rate-safe window
2. On primary expiry: every consumer falls through to DR
3. DR Detail has "LIVE" → Snapshot builds → shows "LIVE"
4. Prewarm blocked (rate-safe active) → cannot refresh Detail KV with correct value
5. Rate-safe clears after 1h; orchestrator reruns; FD returns CANCELLED
6. `toMatchDetail()` writes CANCELLED to Detail KV (overrides DR)
7. But: DR Snapshot still has "LIVE" from step 3's `writeDRSnapshot()` call
8. After Snapshot KV expires (15min): falls to DR → "LIVE" again
9. **Full resolution requires: Detail KV → CANCELLED, Snapshot KV → new build, AND DR Snapshot → overwrite**

**Worst case survival: 30 days (DR Snapshot TTL) if not explicitly purged.**

---

## 5. OPERATOR INTERVENTION SCENARIOS

### Without any DR purge

| Action | Effect on poison |
|--------|----------------|
| Restart orchestrator | Fixes primary Detail KV; does NOT fix DR Snapshot |
| Purge primary Snapshot KV | Correct value rebuilt on next demand, but may fall to DR first |
| Force authority rebuild | Authority corrects state='cancelled'; but match page still shows "LIVE" from snapshot |
| Wait for natural TTL | Snapshot primary: 15min; Snapshot DR: up to 30d from last write |

### With DR purge

| Action | Effect on poison |
|--------|----------------|
| Delete `goalradar:dr:match:537412` | Next snapshot build uses Detail KV or fresh API — correct value |
| Delete `goalradar:dr:/matches/537412` | Next detail request fetches from API — correct value |
| Delete both DR keys | Complete cleanup; next prewarm rebuilds with correct status |

**Current state:** No DR purge tooling exists. `WC_MATCH_STATE_DIVERGENCE.md` fix F5 calls for adding explicit DR purge capability.

---

## 6. AUTHORITY CACHE SURVIVABILITY

The authority cache is built by `coldRebuild()` which reads from KV feeds (all-matches, finished, upcoming). The authority cache is correct even when snapshots are poisoned because:

1. `buildCanonicalMatch()` uses FD feeds as primary
2. FD finished feed returns correct status for match 537412 (CANCELLED from `?status=FINISHED` feed)
3. STATE_RANK forward-only logic prevents "LIVE" in snapshot from advancing past FINISHED rank

**Exception:** If the snapshot's "LIVE" status has rank 0 (SCHEDULED level) and the FD bulk feed also returns "LIVE", then STATE_RANK uses the FD feed value. Since the FD finished feed uses `?status=FINISHED` filter, match 537412 won't appear there while the match is actually cancelled — it will only appear in the unfiltered all-matches feed.

**Confirmed:** Authority shows `cancelled: 1` at 02:17 UTC scan. Authority is NOT poisoned. Authority correctly shows CANCELLED for match 537412.

---

## 7. CONSUMER EXPOSURE TIMELINE

When match 537412 was in-play (2026-06-23):

| Time | Primary KV State | DR State | Consumer Sees |
|------|-----------------|----------|--------------|
| T+0 | Detail KV: "LIVE" | Detail DR: "LIVE" | "LIVE" (wrong) |
| T+0 | Snapshot KV: "LIVE" | Snapshot DR: "LIVE" | "LIVE" (wrong) |
| T+15min | Snapshot KV: expired | Snapshot DR: "LIVE" | "LIVE" from DR |
| T+32min | Detail KV: expired | Detail DR: "LIVE" | DR Detail → Snapshot → "LIVE" |
| T+7d | Detail DR: expired | — | Fresh API fetch (CANCELLED) |
| T+30d | Snapshot DR: expired | — | Correct snapshot from fresh Detail |

**Effective user-visible poison window (without intervention): 7 days (Detail DR TTL).**
**Full system clean (all DR expired): 30 days (Snapshot DR TTL).**
