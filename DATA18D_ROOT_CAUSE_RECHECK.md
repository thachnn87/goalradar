# DATA-18D Phase 1 — Root Cause Prevention Recheck
## Why the Original 18-Match Poisoning Cannot Recur

Audited: 2026-06-17  
Files reviewed: `src/lib/match-snapshot.ts`, `src/lib/af-id-map.ts`, `src/lib/prewarm/worldcup.ts`, `src/app/api/cron/repair-enrichment/route.ts`

---

## Original Failure Mode (Recap)

**What happened:** The prewarm cron rebuilt FINISHED match snapshots from KV bulk-feed data at a time when AF event enrichment wasn't yet cached. The result: snapshots with correct scores (e.g. 7–1 Germany) but `goals.length = 0`. Both primary AND DR snapshots were poisoned simultaneously, preventing the downgrade guard from rescuing the enriched version.

**Root cause chain:**
1. Prewarm detected stale/missing snapshot for a FINISHED match
2. Called `buildMatchSnapshot(id)` → fetched KV detail (score correct, goals=0 from feed data)
3. Called `enrichMatchWithAFEvents()` → AF events key expired → fetched fresh from API (race: events not yet cached at rebuild time)
4. AF enrichment call failed or returned partial data
5. Downgrade guard checked DR → DR also had 0 goals (same rebuild window had poisoned it)
6. Wrote unenriched snapshot to primary + DR

---

## Mechanism Audit

### 1. Downgrade Guard

**Status: ACTIVE**  
**File:** `src/lib/match-snapshot.ts:265–289`

```typescript
if (
  snapshot.match.status === 'FINISHED' &&
  ftH + ftA > 0 &&
  (snapshot.match.goals?.length ?? 0) === 0
) {
  const dr = await readDRSnapshot(matchId);
  if (dr && (dr.match.goals?.length ?? 0) > 0) {
    // Preserve enriched DR snapshot — write it instead
    await kv.set(kvKey(matchId), dr, { ex: getSnapshotTtlSec(dr.match) });
    return;
  }
  // No DR rescue available — writes unenriched (logged at WARN level)
}
```

**Protection:** If a rebuild produces a FINISHED snapshot with score > 0 but 0 goals, the guard reads DR. If DR has goals, DR is restored to primary. This prevents gradual erosion from single-snapshot poisonings.

**Limitation (original failure):** When prewarm poisons both primary AND DR in the same cycle, DR also has 0 goals and the guard cannot rescue. Addressed by mechanisms 3 and 4 below.

---

### 2. DR 30-Day TTL (Overwrite Prevention)

**Status: ACTIVE**  
**File:** `src/lib/match-snapshot.ts:83–85`

```typescript
/** Disaster-recovery TTL: 30 days. Written on every successful snapshot build. */
const DR_TTL_SEC = 30 * 24 * 3_600; // 2_592_000 s
```

DR is written (fire-and-forget) whenever a snapshot is built, but ONLY for non-live matches:
```typescript
function writeDRSnapshot(matchId: string, snapshot: MatchSnapshot): void {
  if (!KV_ENABLED) return;
  if (isLiveStatus(snapshot.match.status)) return; // skip live matches
  kv.set(drKey(matchId), snapshot, { ex: DR_TTL_SEC })...
}
```

**Protection:** Every successful `buildSnapshot()` call writes DR with 30-day TTL. A DR key evicts only if no successful rebuild in 30 days, which cannot happen under normal tournament operation.

**Known state post-DATA-18C.2:** We manually deleted both primary AND DR for all 18 poisoned matches during bulk repair (Phase 2), then rebuilt via `getOrBuildMatchSnapshot()`. All 18 DR keys are now re-written with enriched data and 30-day TTL. Next time any of these matches need a rebuild, the downgrade guard has valid DR to rescue from.

---

### 3. AF Event Cache TTL

**Status: ACTIVE — 7-day TTL (not 30-day)**  
**File:** `src/lib/af-id-map.ts:48–54`

```typescript
export const AF_EVENTS_TTL_SEC = 7 * 24 * 3600;   // 7 days
```

**Important correction:** The task description references "30-day AF event cache". The actual TTL is **7 days**. This is correct for FINISHED match events (they never change) and provides a comfortable window before re-fetching from the API is needed.

**Lookup cache** (which AF fixture ID maps to which FD ID) uses 24h TTL:
```typescript
export const AF_LOOKUP_TTL_SEC = 24 * 3600; // 24 h
```

**Protection against original failure:** After the bulk repair (DATA-18C.2), all 18 AF event caches were populated via `enrichMatchWithAFEvents()`. These won't expire for 7 days. Even after expiry, the next `getOrBuildMatchSnapshot()` call will re-fetch from the AF API — a cache miss triggers a fresh fetch, not a permanent gap.

**Why original failure won't recur for current 20 matches:** AF event keys at `goalradar:af:events:{fd-id}` are now populated and valid until 2026-06-24. Any future rebuild for these matches will get a KV HIT on the AF events key.

---

### 4. Repair-Enrichment Cron (Daily Catchall)

**Status: ACTIVE — but has stale hardcoded ID list**  
**File:** `src/app/api/cron/repair-enrichment/route.ts`

```typescript
const WC_FINISHED_IDS = [
  537327, 537328, 537333, 537334, 537339, 537340, 537345, 537346,
  537351, 537352, 537357, 537358, 537363, 537364, 537369, 537370,
  537391, 537392,
  // MISSING: 537397 (Argentina vs Algeria — added after list was last updated)
];
```

**Function:** Runs daily at 04:00 UTC. Scans all listed FINISHED matches. For any match with score > 0 but goals = 0, invalidates both the snapshot key and the ESPN event cache key, so the next page request triggers a fresh enrichment attempt.

**Gap:** 537397 (Argentina vs Algeria) is not in the list. If this match's snapshot were to become unenriched, the repair cron would not detect it.

**Recommendation (not blocking for canary):** Add 537397 to `WC_FINISHED_IDS` in the repair cron. Also update to use the dynamic FINISHED feed (same refactor applied to enrichment-health in DATA-18C.2) so the list auto-grows as the tournament progresses.

---

### 5. Prewarm FINISHED Tier Skip-If-Exists Guard

**Status: ACTIVE**  
**File:** `src/lib/prewarm/worldcup.ts`

```typescript
// ── PERF-10: FINISHED — reseed only when missing ─────────────────────────
// Scores never change; any existing snapshot is valid until KV evicts it.
if (tier === 'finished' && existingSnapshot) {
  return { seededDetail: false, seededSnapshot: false, skipped: true, live: false };
}
```

**Protection:** If a FINISHED match snapshot already exists, the prewarm skips it entirely. This prevents the original failure mode where prewarm would rebuild a FINISHED snapshot from feed data, discarding AF enrichment.

**When this guard doesn't help:** If a snapshot is missing (TTL expiry, manual delete, or first-time build). In that case the prewarm will rebuild. The enrichment outcome depends on AF event cache presence.

---

## Failure Recurrence Analysis

| Scenario | Probability | Protection |
|----------|-------------|------------|
| Prewarm rebuilds already-enriched FINISHED snapshot | **Blocked** | Skip-if-exists guard |
| Rebuild produces unenriched FINISHED snapshot, DR has enriched version | **Blocked** | Downgrade guard |
| Both primary and DR poisoned simultaneously (original failure) | **Low** | Repair cron at T+24h; 7-day AF cache reduces re-fetch window |
| AF event cache expires (7d) and API call fails during rebuild | **Low** | Best-effort: write unenriched → repair cron catches at T+24h max |
| New FINISHED match after round completes — AF events not yet cached | **Medium** | First-time build without AF cache → unenriched. Repair cron catches next day |

---

## Verdict

The original 18-match poisoning **cannot recur for matches already enriched** — the skip-if-exists guard prevents overwriting, and the downgrade guard provides a second line of defense.

**One gap remains:** The repair-enrichment cron hardcoded ID list is missing 537397 and will not auto-grow as new matches finish. This is a **MEDIUM** risk item for future match days, not a blocker for the canary.

**Recommended fix before Phase 5 global activation:** Update `repair-enrichment/route.ts` to read from the dynamic FINISHED KV feed (same pattern as `enrichment-health` after DATA-18C.2).
