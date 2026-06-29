# WC_SELF_HEAL_MATRIX.md — DATA-18WC.9C Phase 6

**Date:** 2026-06-24
**Method:** Analysis of cache invalidation paths, orchestrator behavior, and DR write/purge logic

---

## 1. SELF-HEAL DEFINITIONS

- **AUTO-HEALS**: System corrects the value automatically without operator action — either by TTL expiry + correct rebuild, or by a guard that overwrites wrong values
- **MANUAL**: Operator must take action to correct — typically DR key deletion, cache purge, or force-rebuild
- **NEVER (without code change)**: The field will not heal because the poison cycle recreates it on every rebuild

---

## 2. SELF-HEAL MATRIX BY FIELD AND CACHE LAYER

### `status` — Status="LIVE" poison

| Cache Layer | Self-Heals? | Mechanism | Time to Heal | Condition |
|------------|-------------|-----------|-------------|-----------|
| Detail KV (primary) | AUTO | TTL expires → prewarm refetches from FD API | Tier-based (32min–7d) | Only if FD API now returns correct status |
| Detail KV DR | AUTO (slow) | TTL expires (7d) | **7 days** | FD API must return correct status at time of next fetch |
| Snapshot KV (primary) | CONDITIONAL | TTL expires → buildSnapshot() → if isLiveStatus("LIVE")=false → writes "LIVE" again | Does NOT heal | isLiveStatus("LIVE")=false means rebuild re-poisons |
| Snapshot KV DR | NEVER | buildSnapshot() writes DR on every write → DR reset to "LIVE" on every snapshot rebuild | **30-day TTL resets** | Will never heal as long as Detail KV DR has "LIVE" |
| All-Matches KV | AUTO | TTL expires (12h) → orchestrator refetches FD bulk | 12 hours | Only if FD now returns correct status in bulk |
| Authority KV (primary) | AUTO | TTL expires (15min) → coldRebuild() uses FD feeds, not snapshot status | 15 minutes | FD finished/all-matches feed must return correct status |
| Authority KV DR | AUTO (slow) | TTL expires (7d) | 7 days | Heals faster if coldRebuild() runs |
| Live cache | AUTO | TTL expires (30s) | 30 seconds | Live cache uses `?status=IN_PLAY,PAUSED` filter — "LIVE" never enters |

**KEY FINDING:** The snapshot DR will NEVER auto-heal for status="LIVE". Every time `buildSnapshot()` runs (triggered by page load, prewarm, or cold rebuild), it:
1. Reads Detail KV (or Detail DR) — gets "LIVE"
2. `isLiveStatus("LIVE")` = false → proceeds to write
3. `writeDRSnapshot()` — overwrites DR Snapshot with "LIVE"
4. DR Snapshot TTL resets to 30 days

The only way snapshot DR heals naturally is if:
- Detail KV and Detail DR both expire AND
- The fresh FD API call returns the correct status AND
- `buildSnapshot()` is then called with the correct status AND
- `writeDRSnapshot()` writes the correct status to DR

This requires both DR keys (Detail + Snapshot) to be expired AND a correct FD API call. With Detail DR at 7d, this means **at minimum 7 days** before natural healing is possible.

---

### `score.fullTime` — Score drift

| Cache Layer | Self-Heals? | Mechanism | Time to Heal |
|------------|-------------|-----------|-------------|
| Snapshot KV (primary) | AUTO | TTL 900s; buildSnapshot() re-reads score from detail | 15 minutes |
| Snapshot DR | CONDITIONAL | Heals only if correct score in Detail at time of next snapshot build | Same as detail DR |
| Authority KV | AUTO | coldRebuild() re-reads from FD; score guard in buildCanonicalMatch | 15 minutes (authority TTL) |

**The DATA-18WC.7B score-drift guard** in `buildCanonicalMatch()` correctly prevents snapshot score from overriding FD finished feed score when snapshot is older. This guard works correctly.

---

### `state` (CanonicalMatch.state — derived)

| Cache Layer | Self-Heals? | Mechanism | Time to Heal |
|------------|-------------|-----------|-------------|
| Authority KV (primary) | AUTO | Rebuilds from FD feeds; if FD returns correct status → deriveState() produces correct state | 15 minutes |
| Authority KV DR | CONDITIONAL | Heals if coldRebuild() runs before DR expires; otherwise 7d TTL | Up to 7 days |

**Note:** Authority `state` heals faster than snapshot `status` because authority reads from FD status-filtered feeds (finished, upcoming) that correctly categorize the match, bypassing the per-match detail that carries "LIVE".

---

### `homeTeam.tla` / `homeTeam.shortName` (AF failover synthetic values)

| Cache Layer | Self-Heals? | Mechanism | Time to Heal |
|------------|-------------|-----------|-------------|
| All-Matches KV | AUTO | Next orchestrator run → FD primary → correct tla/shortName | 12h (all-matches TTL) |
| Detail KV | AUTO | Next prewarm run → FD primary → correct values | Tier-based |
| Snapshot KV | AUTO | Next snapshot rebuild reads from detail | 15 minutes |
| Snapshot DR | AUTO (slow) | After 30d | 30 days |

**Condition:** Heals only if FD primary becomes available again (rate-safe cleared or FD recovers). While rate-safe is active, AF failover values persist.

---

### `goals[]` — ESPN team ID mismatch (C2_TEAM_ID)

| Cache Layer | Self-Heals? | Mechanism | Time to Heal |
|------------|-------------|-----------|-------------|
| Snapshot KV | AUTO | Next prewarm → re-runs ESPN enrichment → if ESPN data consistent, new goals written | Tier-based |
| Snapshot DR | AUTO (slow) | After 30d or next write with correct data | 30 days |

**Note:** C2_TEAM_ID is a flag on the `integrity` field in CanonicalMatch, not a blocking guard. Wrong goal data could be served while the flag is present.

---

### `stage` — AF failover raw round string

| Cache Layer | Self-Heals? | Mechanism | Time to Heal |
|------------|-------------|-----------|-------------|
| All-Matches KV | AUTO | FD primary returns structured stage | 12h |
| Detail KV | AUTO | FD primary returns structured stage | Tier-based |
| Snapshot KV | AUTO | Reads from detail | 15min |

---

## 3. FIELDS THAT NEVER AUTO-HEAL

| Field | Cache Layer | Why It Won't Heal |
|-------|------------|------------------|
| `status = "LIVE"` | Snapshot DR (`goalradar:dr:match:{id}`) | `writeDRSnapshot()` resets 30d clock on every snapshot build that reads poisoned Detail KV/DR |
| `status = "LIVE"` | Snapshot KV (primary) | `isLiveStatus("LIVE")=false` → write guard passes → re-poisons on every rebuild |

---

## 4. FIELDS THAT AUTO-HEAL WITHIN 15 MINUTES

| Field | Cache Layer | Healing Path |
|-------|------------|-------------|
| `status` | Authority KV primary | coldRebuild() reads FD status-filtered feeds → correct status → correct state |
| `state` | Authority KV primary | Same |
| `score.fullTime` | Snapshot KV primary | Re-reads from Detail KV (if Detail has correct value) |
| `minute` | Live cache | 30s TTL; re-reads from FD `/matches?status=IN_PLAY,PAUSED` |

---

## 5. ORCHESTRATOR ROLE IN SELF-HEALING

The orchestrator (`/api/cron/orchestrator/route.ts`) is the only mechanism that refreshes primary KV keys proactively. It runs 12 tasks sequentially:

1. `wc-all-matches` (43200s) — writes All-Matches KV
2. `wc-upcoming` (1800s) — writes Upcoming KV
3. `wc-finished` (43200s) — writes Finished KV
4. `wc-recent` (1800s) — writes Recent KV
5. `today-matches` (120s) — writes Today Matches KV
6. `live-matches` (30s) — writes Live Cache
7. `standings` × 7 groups (7200s) — writes Standings KVs
8. Team detail refresh loop (up to 25 teams)
9. `prewarmWorldCup()` — writes per-match Detail KVs
10. `writeAuthorityCache()` — writes Authority KV
11. `revalidateWCPaths()` — triggers ISR revalidation

**Healing dependency:**
- For status poison in Detail KV: orchestrator task #9 (`prewarmWorldCup`) must run and FD must return correct status
- For authority state: orchestrator task #10 (`writeAuthorityCache`) + `coldRebuild()`
- For Snapshot KV: triggered by page demand (not orchestrator) — builds from Detail KV
- For DR keys: no orchestrator task purges DR; DR only overwritten when primary is refreshed and snapshot rebuilt

**Current state:** Orchestrator is stalled (2h+). Tasks #1-#10 are not running. Primary keys are expiring. Consumers are falling through to DR.

---

## 6. HEAL PATH SUMMARY

| Field | Best-Case Heal | Worst-Case Heal | Requires Operator? |
|-------|---------------|----------------|---------------------|
| `status` in Detail KV primary | 32 minutes (orchestrator recovery) | 7 days (Detail DR TTL) | No (TTL-based) |
| `status` in Detail KV DR | 7 days | 7 days | MANUAL (or wait) |
| `status` in Snapshot KV primary | 15 minutes | NEVER (re-poisoned) | MANUAL |
| `status` in Snapshot DR | NEVER (re-poisoned) | NEVER | **MANUAL (DR key delete)** |
| `state` in Authority KV | 15 minutes | 7 days (Authority DR) | No (TTL-based) |
| `score.fullTime` | 15 minutes | 30 days (Snapshot DR) | No (eventually) |
| `homeTeam.tla` (AF) | 12 hours | 30 days | No (TTL-based) |
| `goals[]` C2 mismatch | Tier-based | 30 days | No (eventually) |
