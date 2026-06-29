# DATA-18J.1 Phase 3 — Writers of `goalradar:match:{id}`

Date: 2026-06-17  **AUDIT ONLY.**

Every code path that writes (or deletes) the primary snapshot key.

---

## Matrix

| # | Writer | File:line | Mechanism | Enrichment before write | Can write goals=0? | Can overwrite enriched? | Downgrade guard? |
|---|--------|-----------|-----------|--------------------------|--------------------|--------------------------|------------------|
| 1 | `writeKVSnapshot` (normal) | match-snapshot.ts:293 | `kv.set(kvKey,…)` | (caller-supplied) | yes, if caller passed goals=0 **and** no DR rescue | yes | **YES** (275-289) |
| 2 | `writeKVSnapshot` (DR-rescue) | match-snapshot.ts:282 | `kv.set(kvKey, dr,…)` | writes DR's enriched copy | no (writes DR goals>0) | no (improves it) | n/a (is the guard) |
| 3 | `getOrBuildMatchSnapshot` → buildSnapshot | match-snapshot.ts:676 → 386 | calls writer #1 | **AF + ESPN** (409,415) | only if both providers fail | via #1 | via #1 |
| 4 | `prewarmMatchSnapshotKVOnly` | match-snapshot.ts:561 → 560 | calls writer #1 | **none** (assembleSnapshot only) | yes | via #1 (guard runs) | via #1 |
| 5 | **`seedMatch` (orchestrator prewarm)** | **worldcup.ts:380** | **raw `kv.set(snapshotKey,…)`** | **AF only (354) — no ESPN** | **YES** | **only when slot empty (skips existing FINISHED, line 293)** | **NO — bypasses `writeKVSnapshot` entirely** |
| 6 | `invalidateMatchSnapshot` (repair) | match-snapshot.ts:710 | `kv.del(kvKey)` + del ESPN cache | — | deletes (→ empties slot) | deletes | n/a |

---

## Reading the matrix

- **Writers 1–4** all funnel through `writeKVSnapshot()` → the **downgrade guard (275-289)** fires: a goals=0 FINISHED write triggers a DR read, and if DR has goals>0 it rescues (writes the enriched DR copy instead). These writers are *guarded*.

- **Writer 5 (`seedMatch`) is the only writer that bypasses the guard** — it calls `kv.set(snapshotKey(...))` directly (worldcup.ts:380). It also enriches with **AF only**, never ESPN. So when AF is unavailable (production: AF lookup table absent → `lookup-miss`), it writes **goals=0** with **no DR rescue path**.

- Writer 5 is rate-limited by the FINISHED reseed guard (worldcup.ts:293): it only writes when **no snapshot exists**. So it does not clobber a *live* enriched snapshot — but it **re-creates an evicted/invalidated one as goals=0**, and runs on the orchestrator cron, so it reliably wins the race to refill an empty slot before a sporadic page visit could rebuild via the ESPN-capable path (writer 3).

- **Writer 6 (repair cron)** deletes degraded snapshots to force a rebuild — but it empties the slot, handing the next write back to whichever of writer 3 (ESPN-capable) or writer 5 (AF-only) runs first. On the cron cadence, writer 5 typically wins.

---

## The pin mechanism

```
buildSnapshot (writer 3) runs once  → primary=3, DR=3, ESPN cache populated   (~14h ago)
   ↓  primary evicted / repair-invalidated  → slot empty
orchestrator prewarm (writer 5) runs → AF-only → goals=0 → raw kv.set → primary=0   (no guard, no DR rescue)
   ↓  every later prewarm: FINISHED + existing → SKIP (293)
page visit → getOrBuildMatchSnapshot → KV HIT (goals=0) → returned as-is, never re-enriched (607)
```

The goals=0 written by **writer 5** is pinned because **writer 3 never runs again** (the KV-hit short-circuit at match-snapshot.ts:607 returns the unenriched snapshot without rebuilding).
