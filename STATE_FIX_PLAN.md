# STATE FIX PLAN — DATA-18B.3D Phase 5

**Task:** DATA-18B.3D Phase 5
**Date:** 2026-06-23
**Input:** STATE_DIVERGENCE_MATRIX.md (0 RED) + STATE_SOURCE_MAP.md.

---

## Why "no page may render LIVE without snapshot confirmation" is the wrong fix

The task proposed: *"Single state source: snapshot overlay must be
authoritative. No page may render LIVE without snapshot confirmation."*

The production data refutes this prescription:

- Match **537394 (Norway vs Senegal)** is genuinely live (authority=live,
  live-cache=live) but **has no snapshot** — snapshots are produced for finished
  matches and by prewarm; a freshly-live match has not been snapshotted yet.
- If pages required snapshot confirmation to render LIVE, this real live match
  would be **hidden** — a worse bug than the divergence we set out to fix.

Snapshots are authoritative for **finished-match enrichment and score**, not for
**live-gating**. Making snapshot a precondition for LIVE inverts its role.

The correct single source for *liveness* is the **live-cache SSOT**
(`getCurrentLiveMatches()`), which is exactly what the prior WC-LIVE-SSOT work
established. This plan completes that direction instead of reversing it.

---

## What the audit actually found

| Finding | Severity | Reaches users? |
|---------|----------|----------------|
| 0 state-flip divergences (auth↔snapshot agree on all 103 snapshotted matches) | — | No divergence exists |
| Live match 537394 has no snapshot | YELLOW | No — detail page cold-builds; listing shows LIVE correctly from authority/live-cache |
| Two live-gating code paths (SSOT vs `m.state==='live'`) | risk | Converge today; future split risk |
| Storage layer transiently gappy (primary authority + live-cache both 30s TTL, expire between writes) | risk | **No** — read path reconstructs (see below) |
| `authority-freshness` reports RED "orchestrator may be down" while orchestrator is GREEN | monitoring | No (false positive) |
| Score drift 537371 (4–0 vs 5–0) | RED (score, not state) | Yes — wrong score on detail; out of this task's scope |

### Why the storage-layer gaps do not reach users

At 02:08 the raw stores showed: primary authority **evicted**, live-cache
**expired**, snapshot **missing** — only stale DR said "live". Yet a page render
stays correct because the **read path** reconstructs state:

- `readAuthorityCache()` → primary miss → DR has live & age 972s > 120s →
  **DR live-staleness guard forces a cold rebuild** → fresh state from FD feed.
- `getCurrentLiveMatches()` → live-cache expired → `getWCLiveMatches()` provider
  fallback refetches IN_PLAY/PAUSED.

Divergence exists at the **storage layer** and is resolved at the **read layer**
before reaching the user. The guard added in WC-LIVE-STATE (`DR_LIVE_STALE_MAX_MS
= 120_000`, `authority-cache.ts:75,482`) is doing precisely its job.

---

## Fix items

### 1. Unify live-gating on the SSOT (closes the live-source split) — RECOMMENDED

Migrate the three pages that derive live from the authority filter to the
live-cache SSOT, matching Hub and Schedule.

| Page | Change |
|------|--------|
| `/world-cup-2026/matches-today` | replace `allTodayMatches.filter(m => m.state === 'live')` with intersection against `getCurrentLiveMatches()` ids |
| `/world-cup-2026/results` | replace `entries.filter(e => e.state === 'live')` likewise |
| `/world-cup-2026-results` | replace `classifyMatchState(m)==='live'` live-bucket with SSOT ids |

Keep authority `state` / `classifyMatchState` for **finished/scheduled** display
— only the *live* decision moves to the SSOT. Result: one live source across all
6 pages.

**Risk:** low. Both paths converge today; this removes the second path.
**Effort:** ~3 small edits.

### 2. Snapshot coverage for live matches (closes the YELLOW)

Ensure a snapshot exists for matches as they transition to live so the detail
page never cold-builds on the first live hit.

- Add live matches to the prewarm set in `/api/cron/prewarm-worldcup` (currently
  prewarms today + finished). Trigger snapshot build on `state` → `live`.
- **Do not** gate listing LIVE rendering on snapshot presence (see top section).

**Risk:** low. **Effort:** small.

### 3. Fix `authority-freshness` false RED (monitoring accuracy)

`authority-freshness` reports `RED "Primary evicted — serving from DR (…s old).
Orchestrator cron may be down."` whenever the primary key is absent. In **live
tier the primary TTL is 30s**, so the primary is legitimately evicted most of
the time between the 30-min orchestrator writes and page-triggered write-backs.

- Cross-check orchestrator `lastSuccess` (from `cron-status`) before declaring an
  outage. Only RED if orchestrator `ageMinutes` exceeds its interval AND DR is
  stale. Otherwise YELLOW/GREEN with "primary expired (expected in live tier)".

**Risk:** none (debug-only). **Effort:** small.

### 4. (Out of scope, flagged) Repair score drift on 537371

Snapshot for Spain vs Saudi shows 5–0 with only 4 goals while authority/FD show
4–0. Run the existing snapshot repair (`/api/debug/integrity-repair` or
`data18c2-bulk-repair`) for match 537371. Tracked under DATA-18F, not DATA-18B.3D.

---

## Non-changes (explicitly rejected)

- ❌ Gate LIVE on snapshot confirmation — would hide genuinely-live un-snapshotted
  matches (proven by 537394).
- ❌ Make snapshot the single state source — snapshot is per-match and lacks
  scheduled matches entirely (61 scheduled have no snapshot by design); it cannot
  be the authority for the full fixture list.
- ❌ Lengthen authority/live-cache TTLs to avoid storage gaps — the read-path
  reconstruction is correct and TTLs are tuned for freshness; longer TTLs trade
  the (invisible) gap for (visible) staleness.

---

**Single state source confirmed already in place:** authority cache (FD +
snapshot overlay) for the fixture list and finished/scheduled state; live-cache
SSOT for liveness. The only structural cleanup is item 1 — collapsing the second
live-gating path onto the SSOT.
