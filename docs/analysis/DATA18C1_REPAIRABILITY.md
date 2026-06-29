# DATA-18C.1 Phase 3 — Repairability Test
## Success Rate Estimate for All 18 Poisoned Matches

Test timestamp: 2026-06-17T09:56:44Z  
Based on: 3-match controlled rebuild test (Phase 1) + code analysis

---

## Test Cohort Results

3 of 18 poisoned matches were directly tested. All 3 repaired successfully.

| Match | Score | Date finished | Goals | Subs | Lineup | Verdict |
|-------|-------|---------------|-------|------|--------|---------|
| 537351 Germany 7-1 | Jun 14 | 8/8 | ✓ | ✓ | REPAIRED |
| 537391 France 3-1 | Jun 16 | 4/4 | ✓ | ✓ | REPAIRED |
| 537397 Argentina 3-0 | Jun 17 | 3/3 | ✓ | ✓ | REPAIRED |

---

## Repair Mechanism

When `goalradar:match:{id}` (primary snapshot) is deleted:

1. Next `getOrBuildMatchSnapshot(id)` call finds no primary key
2. `buildSnapshot(id)` runs:
   - Reads `goalradar:/matches/{id}` (KV detail, exists, goals=0)
   - `needsEnrichment=true`
   - `enrichMatchWithAFEvents(match)` → reads `goalradar:af:events:{fd-id}`
   - Returns goals + subs + cards + lineups from AF events
3. Rebuilt snapshot written to primary + DR

**Prerequisite for repair:** `goalradar:af:events:{fd-id}` must be present in KV with goals for that match.

---

## AF Events Coverage Assessment

AF events are stored under `goalradar:af:events:{fd-id}` with a 7-day TTL.

The 18 poisoned matches finished between Jun 11 and Jun 17 (all within the last 6 days). The 7-day AF events TTL means events written on Jun 11 expire Jun 18 — all matches are within TTL range.

The 3-match test confirmed AF events ARE available for:
- Germany vs Curaçao (Jun 14, 3 days ago): 8 goals returned ✓
- France vs Senegal (Jun 16, ~1 day ago): 4 goals returned ✓
- Argentina vs Algeria (Jun 17, same day): 3 goals returned ✓

### Match Date Distribution for All 18 Poisoned Matches

From DATA18C0_POISONED_DR.md:

| Match date | Matches | Days since finish | AF events TTL risk |
|-----------|---------|------------------|--------------------|
| Jun 11 | ~2 | 6 days | LOW (expires Jun 18) |
| Jun 12 | ~2 | 5 days | LOW |
| Jun 13 | ~4 | 4 days | LOW |
| Jun 14 | ~4 | 3 days | LOW |
| Jun 15 | ~3 | 2 days | LOW |
| Jun 16 | ~3 | 1 day | LOW |

All 18 matches are within the 7-day AF events TTL. No TTL expiry risk today.

**However:** AF events availability depends on whether AF enrichment was ever successfully run for each match. If a match's events were never fetched (no page visit triggered enrichment, OR AF was rate-limited for that match), the `goalradar:af:events:{fd-id}` key may not exist.

---

## Repair Success Rate Estimate

### Optimistic Case: AF events present for all 18

If AF enrichment successfully ran for all 18 matches at any point between Jun 11–17:
- **Success rate: 18/18 (100%)**
- Repair method: delete primary snapshot → next page visit rebuilds with AF events
- All goals, subs, lineups recovered
- Cards recovered only if AF includes booking data (format-dependent)

### Conservative Case: AF events present for ~80%

If AF events are available for only the matches where page visits occurred:
- Popular matches (Germany, France, Argentina) ← definitely have visitors → AF events cached
- Smaller fixtures (CONCACAF, CONMEBOL group stage) may have fewer visits
- **Estimated success rate: 14–16/18 (80–90%)**
- The 2–4 misses would fall back to ESPN (0 IDs, will fail) → still 0 goals after rebuild
- Those matches need AF events to be populated first (one page visit with AF enrichment triggers caching)

### Pessimistic Case: AF events only for tested 3

If AF events happened to be available only for the 3 tested matches:
- **Success rate: 3/18 (17%)**
- Very unlikely given the WC traffic volume

**Best estimate: 15–18/18 (85–100%)** based on the evidence that all 3 tested matches (Jun 14, Jun 16, Jun 17) had AF events available.

---

## Repair Prerequisites per Match

For each of the 18 poisoned matches, repair succeeds when:

| Condition | Required | Available? |
|-----------|----------|------------|
| AF enabled (`ENABLE_AF_ENRICHMENT=true`) | YES | YES (confirmed from buildSnapshot running AF enrichment) |
| AF lookup table (`goalradar:af:lookup:WC:2026`) | YES | LIKELY (3 tested matches all resolved) |
| AF events (`goalradar:af:events:{fd-id}`) | YES | LIKELY for all 18 (within 7-day TTL, WC traffic) |
| Primary snapshot deleted | YES | Must be done explicitly |

---

## DR Snapshot Repair

The DR snapshot (`goalradar:dr:match:{id}`) was NOT deleted during the rebuild test — only the primary was removed. From the Phase 1 results:

- 537351: DR was updated to 8 goals (primary write AND DR write completed within ~432ms)
- 537391: DR still shows 0 goals (write was still pending at read time)
- 537397: DR still shows 0 goals (write still pending)

**Implication:** When `buildSnapshot` runs and writes a repaired snapshot, it writes to both primary (`goalradar:match:{id}`) and DR (`goalradar:dr:match:{id}`). The DR write is the secondary write (after primary). For the first page visit after repair, both DR and primary will be updated with correct data within ~500ms.

If the DR snapshot is NOT deleted (as in this test), the downgrade guard in `readKVSnapshot` compares primary vs DR. A repaired primary (8 goals) vs old DR (0 goals) triggers the downgrade guard check — the guard blocks downgrades (newer/higher state wins), so this comparison is: primary has 8 goals, DR has 0 goals → primary WINS → no downgrade blocked. The correct repaired snapshot is used.

For full integrity: if DR is also deleted before repair, the downgrade guard is bypassed entirely and both are rebuilt fresh from the same `buildSnapshot` call.

---

## Repair Method Options

### Option A — Organic Repair (0 lines of code)
Delete primary snapshots. Next page visit rebuilds with AF enrichment.

- **Trigger:** Page visit to `/match/{id}` or Hub ISR rebuild
- **Latency:** 266–432ms per rebuild (measured)
- **Coverage:** All matches with existing page traffic
- **Risk:** Matches with no page visits (unlikely for WC, but possible for small games)

### Option B — Targeted Repair Script
Delete primary snapshots for all 18 matches in bulk, then trigger prewarm or page visits.

```
// 18 KV keys to delete:
goalradar:match:537351
goalradar:match:537352
...
goalradar:match:537392
```

After deletion: either run the prewarm cron (which calls `getOrBuildMatchSnapshot` for all FINISHED matches) or visit each match page once.

- **Trigger:** Bulk KV delete + prewarm cron trigger
- **Coverage:** All 18 matches guaranteed (no traffic dependency)
- **Time to fix:** ~5 min for deletion + ~10 min for prewarm rebuild

### Option C — DR-Inclusive Repair
Delete BOTH primary and DR snapshots for all 18 matches before triggering rebuild.

- Ensures clean state — no downgrade guard interference
- Safer for full integrity verification
- Slightly higher KV write volume (2×18 deletes vs 18 deletes)

**Recommendation: Option B or C.** Organic repair (A) works for popular matches but may leave obscure group stage matches in poisoned state for hours if no page visits occur.

---

## Repairability Summary

| Metric | Value |
|--------|-------|
| Tested matches | 3/18 |
| Test success rate | 3/3 (100%) |
| Estimated full-set success rate | 15–18/18 (85–100%) |
| Repair method | Delete primary snapshot → AF enrichment on rebuild |
| Rebuild latency | 266–432ms per match |
| AF events TTL risk | None (all within 7-day window) |
| Cards recovery | Conditional (depends on match having bookings) |
| Goals recovery | CONFIRMED for tested matches |
| Lineup recovery | CONFIRMED for tested matches |
| Time to repair all 18 | ~5 min (delete) + ~10 min (rebuild via prewarm) |
