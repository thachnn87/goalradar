# DATA-18D.2 Phase 1 — Snapshot Creation Matrix
## Every Write Path to goalradar:match:{id} and goalradar:dr:match:{id}

---

## Write Path Inventory

| Path | Source File | Trigger | Enrichment Provider | Can Write goals=0? | Can Poison DR? | Bypasses Downgrade Guard? |
|------|-------------|---------|--------------------|--------------------|----------------|--------------------------|
| **1. Page-load build** | `src/lib/match-snapshot.ts` `getOrBuildMatchSnapshot()` | User visits `/match/{id}` (KV miss) | `enrichMatchWithAFEvents()` via `src/lib/af-id-map.ts` | YES — if AF lookup fails | NO (downgrade guard promotes DR when DR has goals) | NO |
| **2. Prewarm seed** | `src/lib/prewarm/worldcup.ts` `seedMatch()` | Cron (`/api/cron/orchestrator`) every 30 min | **NONE** — uses bulk feed data via `toMatchDetail()` which sets `goals: [], bookings: [], substitutions: []` | **YES — always** for new FINISHED matches | **YES** — writes identical unenriched snap to both primary AND DR | N/A (prewarm bypasses match-snapshot.ts entirely) |
| **3. Priority refresh** | `src/lib/prewarm/worldcup.ts` lines 529–535 | Same cron run — for `next-24h` matches with provider fetch | `enrichMatchWithAFEvents()` indirectly via `getOrBuildMatchSnapshot()` | NO — full build path | NO | NO |
| **4. repair-enrichment cron** | `src/app/api/cron/repair-enrichment/route.ts` | Daily cron at 04:00 UTC | `getOrBuildMatchSnapshot()` (delete → rebuild) | NO — triggers full rebuild | NO | NO |
| **5. integrity-repair endpoint** | `src/app/api/debug/integrity-repair/route.ts` | On-demand debug endpoint | `getOrBuildMatchSnapshot()` (delete both → rebuild) | NO — triggers full rebuild | NO — deletes DR before rebuild | NO |

---

## Vulnerability Analysis

### Path 2 (Prewarm Seed) — CRITICAL GAP

The root cause of the 24h enrichment regression window:

```
prewarmWorldCup()
  → seedMatch(match, tier='finished', existingSnapshot=null)
    → toMatchDetail(match)  ← bulk feed: goals:[], bookings:[], subs:[]
    → buildPartialSnapshot(matchDetail, ...)
    → kv.set(snapshotKey,   snap, { ex: 7d })  ← unenriched primary
    → kv.set(snapshotDRKey, snap, { ex: 30d }) ← unenriched DR ← POISONS DR
```

**Why the downgrade guard does NOT protect here:**
The downgrade guard is in `writeKVSnapshot()` in `match-snapshot.ts` (Path 1). Path 2 (prewarm) writes directly to KV via `kv.set()` — it completely bypasses `writeKVSnapshot()` and its downgrade guard.

**Why Path 4 eventually rescues:**
The `repair-enrichment` cron (daily at 04:00 UTC) calls `getOrBuildMatchSnapshot()` which DOES call `enrichMatchWithAFEvents()`. This is the only automatic rescue. Window: up to 24 hours.

**DR poisoning scenario:**
1. New match finishes (e.g. 3–1 score)
2. Prewarm runs within minutes → writes `goalradar:match:{id}` with goals=[] and `goalradar:dr:match:{id}` with goals=[]
3. Page load triggers `getOrBuildMatchSnapshot()` → downgrade guard fires
4. Guard checks DR → DR also has goals=[] → no rescue → writes unenriched primary
5. Both primary and DR are now poisoned with score>0 but goals=0
6. Match pages show 3–1 score but no goal events for up to 24h

---

## Can Write goals=0? Decision Matrix

| Path | SCHEDULED match | TIMED match | IN_PLAY match | FINISHED match (0-0) | FINISHED match (scored) |
|------|----------------|-------------|---------------|---------------------|------------------------|
| 1. Page-load | N/A (no goals) | N/A | Bypassed (live-cache) | OK (0 goals expected) | **ONLY if AF unavailable** |
| 2. Prewarm | OK | OK | Bypassed (live check) | OK | **ALWAYS** ← THE GAP |
| 4. Repair cron | N/A | N/A | N/A | OK | **ONLY if AF unavailable** |

---

## Can Poison DR? Decision Matrix

| Path | Scenario | Outcome |
|------|----------|---------|
| 1. Page-load | AF unavailable → downgrade guard fires → no DR to rescue → falls through to write | Primary written (unenriched). `writeDRSnapshot()` also fires → **DR poisoned** |
| 2. Prewarm | New FINISHED match → `toMatchDetail()` → unenriched | Both primary AND DR written unenriched → **DR poisoned** |
| 4. Repair cron | Deletes both primary + DR before rebuild → clean state | DR always written enriched after rebuild ← SAFE |

---

## Fix Summary (DATA-18D.2)

| Phase | Fix | Eliminates |
|-------|-----|-----------|
| **Phase 2** | In `seedMatch()`, for FINISHED tier + score > 0, call `enrichMatchWithAFEvents()` before `buildPartialSnapshot()` | Path 2 writing goals=0 snapshots |
| **Phase 3** | Add `FIRST_BUILD_UNENRICHED` WARN log when prewarm writes FINISHED snapshot with score>0 but goals=0 | Silent failures |
| **Phase 4** | In `writeDRSnapshot()` (match-snapshot.ts) AND in prewarm `seedMatch()`: skip DR write if score>0 && goals=0 | Both paths that poison DR |
| **Phase 5** | Simulation test: delete primary+DR+AF cache for 4 matches, rebuild, verify | Regression risk in test environment |

After Phase 2+3+4: the only remaining unenriched window is when both primary AND DR are missing AND AF API is unavailable at rebuild time. Probability: near-zero (AF events cache has 7-day TTL, AF API has 99.9% uptime).
