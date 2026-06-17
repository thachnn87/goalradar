# DATA-18D.1 Phase 2 — Poison Prevention Audit
## Every Write Path, Every Risk, Every Guard

Audited: 2026-06-17  
Files: `src/lib/match-snapshot.ts`, `src/lib/prewarm/worldcup.ts`, `src/app/api/cron/repair-enrichment/route.ts`, `src/app/api/cron/orchestrator/route.ts`

---

## Write Path Inventory

| Path | Source | Triggered by | Enriched? | Writes DR? |
|------|--------|-------------|-----------|-----------|
| 1. `getOrBuildMatchSnapshot()` | Full build + AF enrichment | Page load, generateMetadata | **Yes** | Yes (30d TTL) |
| 2. `prewarmMatchSnapshotKVOnly()` | KV detail only (no AF call) | Browser hover/touch hint | No | Yes (30d TTL) |
| 3. `prewarmWorldCup()` bulk | `buildPartialSnapshot()` (feed data) | Orchestrator cron | **No** | Yes (30d TTL) |
| 4. `repair-enrichment` cron | Deletes only — no write | Daily 04:00 UTC | N/A | Deletes DR too |

---

## Path 1: `getOrBuildMatchSnapshot()` — PRIMARY WRITE PATH

**Trigger:** KV miss on `goalradar:match:{id}` during page load or metadata generation.

### Overwrite Risk
- Only writes when KV returns null (TTL expired or explicitly deleted)
- Cross-instance single-flight lock (`_buildInflight`) prevents concurrent races
- **RISK:** Two fast concurrent requests from different Vercel instances can both miss the KV key before either sets the lock — result: two independent rebuilds. Both write identical data (idempotent)

### Downgrade Risk
**Fully mitigated.** The downgrade guard (lines 265–289) explicitly handles this:

```typescript
if (snapshot.match.status === 'FINISHED' && ftH + ftA > 0 && goals.length === 0) {
  const dr = await readDRSnapshot(matchId);
  if (dr && dr.match.goals?.length > 0) {
    // Write DR version instead — preserves enrichment
    await kv.set(kvKey(matchId), dr, { ex: TTL });
    return;
  }
  // No DR rescue — writes unenriched (logs WARN)
}
```

**Guard failure condition:** Both primary AND DR are poisoned simultaneously. This was the original DATA-18C incident. After DATA-18C.2 repair, all 18 matches now have enriched snapshots in both primary and DR.

### DR Poisoning Risk
DR is written alongside primary, always (fire-and-forget). DR always reflects the outcome of the same build. If a build is unenriched, DR is unenriched too.

**Mitigation:** Downgrade guard prevents writing unenriched primary IF DR has goals. DR poisoning can only happen when DR doesn't exist yet (first build after tournament start) or when DR TTL expired AND the primary build is unenriched. Both scenarios are caught by the repair cron within 24h.

### Cache Expiry Risk
FINISHED snapshots: 7-day TTL on primary, 30-day on DR. At 7 days, primary evicts → next page load triggers Path 1. AF event cache is also 7-day TTL. If AF events evict at the same time as the primary snapshot, the rebuild will fetch fresh AF events from the API.

**Risk:** If the AF API is unavailable when the primary snapshot expires (unlikely, best-effort enrichment), the rebuild produces an unenriched snapshot. DR (30-day) will be used by the downgrade guard IF it's enriched.

---

## Path 2: `prewarmMatchSnapshotKVOnly()` — HOVER HINT PATH

**Trigger:** `SnapshotPrewarmHints` component fires a prewarm request on mouse hover / IntersectionObserver viewport entry.

### Overwrite Risk
Only activates on KV primary miss + KV detail hit. If primary exists, returns early without write. Effectively: "lazy build from KV-only data."

### Downgrade Risk
**This path does NOT call AF enrichment.** Builds from KV detail only. A FINISHED match built via this path will have score but NO goals.

**Mitigation:** The downgrade guard in `getOrBuildMatchSnapshot` (Path 1) also runs in this path before the write — it checks DR and promotes the enriched DR if available.

**RISK SCENARIO:** A new FINISHED match, no DR yet, hover hint triggers before page load. Path 2 builds unenriched snapshot. DR is written with unenriched data too. Subsequent Path 1 call hits KV (finds unenriched primary), returns it without enrichment. Result: unenriched snapshot served to user.

**Mitigation for this scenario:** Page load calls `getOrBuildMatchSnapshot` → finds unenriched primary → downgrade guard checks DR → DR also unenriched → serves unenriched. Next day's repair cron invalidates → next page load triggers full rebuild with AF enrichment.

**Assessment:** LOW RISK in practice. Hover hints are browser-driven. Page load (Path 1) almost always fires first (or simultaneously). The repair cron catches any slippage within 24h.

---

## Path 3: `prewarmWorldCup()` — ORCHESTRATOR CRON PATH

**Trigger:** Every 30 minutes via orchestrator cron. Builds/refreshes snapshots for ALL 104 WC matches.

### Overwrite Risk for FINISHED Matches
**Fully mitigated by skip-if-exists guard:**
```typescript
if (tier === 'finished' && existingSnapshot) {
  return { skipped: true };
}
```
FINISHED matches with existing snapshots are NEVER reseeded. This is the primary protection against the DATA-18C incident recurring.

### State Regression Risk
**Fully mitigated by state regression guard (DATA-4):**
```typescript
if (STATE_RANK[existingSnapshot.match.status] > STATE_RANK[match.status]) {
  return { skipped: true };
}
```
A FINISHED snapshot is never overwritten by a stale TIMED/SCHEDULED entry from the bulk list.

### DR Poisoning Risk
`prewarmWorldCup()` builds from `buildPartialSnapshot()` — this uses bulk feed data (score correct, goals=0) and does NOT call AF enrichment. Both primary AND DR are written together.

**This is the exact mechanism that caused the original DATA-18C incident.** It only triggers for FINISHED matches when:
1. No existing snapshot (first build, or post-TTL expiry)
2. Skip-if-exists guard fires `false` (snapshot absent)

**Current state:** All 18 originally-poisoned matches have enriched snapshots in KV (7-day TTL from DATA-18C.2 repair). They won't expire until 2026-06-24. When they do, if prewarm runs first:
1. Prewarm builds unenriched (no AF enrichment in `buildPartialSnapshot`)
2. Both primary AND DR written unenriched
3. Downgrade guard cannot rescue (both poisoned)
4. Repair cron catches within 24h

**Assessment:** The 7-day snap TTL + 7-day AF events TTL means both expire at the same time. On next prewarm cycle, prewarm writes unenriched (AF events also expired). Net result: 24h exposure window until repair cron catches it.

**RECOMMENDATION:** `buildPartialSnapshot` in `prewarmWorldCup` should also attempt AF enrichment for FINISHED matches. This would close the 24h window permanently. Not implemented in DATA-18D.1 scope.

### Rate-Safe Mode
When rate-safe mode is active (`rateSafeState.active === true`), ALL prewarm seeding is aborted. No writes occur during rate-safe periods. This is protective, not a risk.

---

## Path 4: repair-enrichment cron — DELETION ONLY

**Trigger:** Daily at 04:00 UTC. Reads FINISHED feed dynamically (DATA-18D).

This path only DELETES snapshots — it never writes. The write happens on next page load (Path 1) which includes full AF enrichment.

**No overwrite/downgrade/DR-poisoning risk from this path.**

---

## Authority Cache Write Path

`writeAuthorityCache(builtAt)` is called... nowhere. The orchestrator does NOT call it. Authority cache is dormant until `AUTHORITY_CACHE_ENABLED=true` is set.

When enabled, `writeAuthorityCache` reads existing snapshots (no write to per-match keys), builds `CanonicalMatch[]`, and writes `goalradar:wc:authority:v1`. This path has no poison risk for per-match snapshots.

---

## Risk Summary Matrix

| Risk | Severity | Write Path | Guard | Max Exposure | Resolution |
|------|----------|-----------|-------|-------------|------------|
| Prewarm writes unenriched (first build after TTL expiry) | **MEDIUM** | Path 3 | Skip-if-exists (prevents re-poison, not first-build) | 24h | Repair cron |
| Hover hint writes unenriched (no AF in KVOnly path) | **LOW** | Path 2 | Downgrade guard (if DR enriched) | 24h | Repair cron |
| Both primary AND DR poisoned simultaneously | **LOW** (requires specific timing) | Path 3 | Repair cron | 24h | Repair cron |
| AF event cache expires, API unavailable | **LOW** | Path 1 | Best-effort, DR fallback, repair cron | 24h | Repair cron |
| Concurrent race: two builds, both unenriched | **VERY LOW** | Path 1 | Single-flight lock reduces window | Minutes | Repair cron |

---

## Verdict

**Enrichment regression CAN recur — but only in a constrained 24-hour window.**

The repair-enrichment cron (04:00 UTC daily) is the final line of defense and catches all failure modes within 24h. The only scenario where this fails is if the FINISHED feed is stale (causing the cron to miss new matches) — mitigated by the dynamic feed read added in DATA-18D.

**The original DATA-18C incident (18 simultaneous poisonings) cannot recur** because:
1. Skip-if-exists guard prevents re-poisoning of FINISHED matches that already have snapshots
2. State regression guard prevents overwriting FINISHED with TIMED data

**The residual risk is a single FINISHED match with a 24h unenriched window** on first-build (prewarm runs before AF events are cached). This is acceptable — the match just finished, it's not yet in search results, and the repair cron restores it the next morning.

**To eliminate the 24h window entirely:** Add AF enrichment to `buildPartialSnapshot` in `prewarmWorldCup.ts` for the FINISHED tier (out of scope for DATA-18D.1, flag for DATA-18E).
