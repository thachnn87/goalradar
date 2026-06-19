# DATA-18B.3A Drift Analysis

**Date:** 2026-06-19
**Scope:** All 104 WC 2026 matches
**Source:** `/api/debug/full-audit` (03:30 UTC)

---

## Summary

| Drift Class | Count | User Visible? | Cause |
|-------------|-------|---------------|-------|
| RED — score mismatch | **0** | N/A | — |
| RED — state mismatch | **0** | N/A | — |
| RED — invalid authority record | **0** | N/A | — |
| YELLOW — TBD team slots | 32 | No | Expected tournament structure |
| YELLOW — snapshot missing for live match | 1 | No | First-visit snapshot not yet built |
| **Total drift** | **0 user-visible** | — | — |

---

## RED Drift — None Found

No RED issues across all 104 matches at any layer (authority, snapshot, consistency).

### Previous RED Incident: Full-Audit TBD Bug (Fixed)

**Date:** 2026-06-19 (earlier in session)
**Symptom:** First run of `/api/debug/full-audit` showed 32 RED entries.
**Root Cause:** `auditAuthority()` checked `homeTeam.id === 0` as RED universally, without accounting for knockout matches where teams are not yet determined.
**Fix:** Added `isTBDSlot = m.state === 'scheduled' && m.stage !== 'GROUP_STAGE'` guard. TBD entries now classified YELLOW (expected) not RED.
**Commit:** `9c46a0b`
**Status:** RESOLVED.

---

## YELLOW Drift — Two Classes

### Class 1: TBD Knockout Placeholder Matches (32 matches)

**Classification:** YELLOW — expected, not a defect
**Matches affected:** All 32 knockout stage matches (LAST_32 × 16, LAST_16 × 8, QF × 4, SF × 2, THIRD_PLACE × 1, FINAL × 1)
**Authority issue:** `homeTeam.id = 0 / awayTeam.id = 0`
**Reason:** WC 2026 knockout round participants are determined after the group stage. The authority cache correctly stores placeholder slots with `state: 'scheduled'` and no assigned teams until after June 26 (final group stage matchdays).
**User impact:** NONE — bracket page uses `canonicalToMatch()` which handles TBD: `homeTeam?.name ?? 'TBD'`, conditional crest rendering: `match.homeTeam?.crest && (...)`.
**Resolution:** Structural, not operational. Will self-resolve as group stage concludes and teams are written into authority cache.

### Class 2: Missing Snapshot for Live Match 537330 (1 match)

**Classification:** YELLOW — temporary gap, not a defect
**Match:** 537330 Mexico vs South Korea (live at 03:30 UTC, finished by ~04:00 UTC)
**Authority state:** `live` (correct)
**Snapshot:** ABSENT — key `goalradar:match:537330` returned null from `kv.mget()`
**Reason:** Snapshot KV is populated on first visit to `/match/537330`. No visitor had triggered the snapshot build at audit time.
**User impact:** NONE — match detail page performs a live fetch when snapshot is absent (first-visit path). Score and state are rendered from live data, not a stale snapshot.
**Resolution:** Snapshot is built automatically on first page visit. Post-audit visit to match page confirms this.

---

## Historical Drift Incidents (Resolved)

### LIVE-STATE-AUDIT: Canada vs Qatar (537336) — DR Staleness

**Date:** 2026-06-18 (earlier session)
**Symptom:** World Cup Hub showed Canada vs Qatar as LIVE; match page showed FULL TIME.
**Root cause:** DR cache (`goalradar:dr:wc:authority:v1`, TTL: 7 days) had no staleness guard for live-tier data. When the orchestrator cron gap exceeded the DR's last write containing `state: live` for 537336, the DR continued serving stale live-state to ISR pages.
**Fix:** Added `DR_LIVE_STALE_MAX_MS = 120_000` (2-minute threshold). When DR has `liveCount > 0` and is older than 2 minutes, cold rebuild is triggered.
**Commit:** (earlier in session — DR staleness guard)
**Status:** RESOLVED. 537336 now shows `state: finished` across all layers.

### Thundering Herd — DR Staleness Guard Side-Effect

**Date:** 2026-06-19
**Symptom:** After DR staleness guard was deployed, cold rebuild rate jumped from ~0% to 26.83%. Average read latency rose from 51ms to 293ms. Readiness score dropped from 100 to 75.
**Root cause:** DR staleness guard falls through to `coldRebuild()` but the cold rebuild result was NOT written back to primary KV. Every ISR revalidation (30s interval × 6 routes × ~12 regions) triggered a separate cold rebuild, as primary KV was empty and DR kept failing the staleness check.
**Fix:** Added fire-and-forget write-back after cold rebuild: `kv.set(AUTHORITY_KEY, envelope, { ex: ttlSec })`. Subsequent reads within the TTL window serve from primary, breaking the thundering herd.
**Commit:** `32a95c6`
**Status:** RESOLVED. Authority source: primary, stale: false, liveCount: 0.

---

## Drift Prevention Architecture

The following mechanisms prevent score/state drift from occurring:

1. **Single authority source**: All listing pages (Hub, Live, Fixtures, Results, Groups, Bracket) read from `readAuthorityCache()` → `goalradar:wc:authority:v1`. No page reads directly from Football-Data legacy path for WC matches.
2. **`classifyMatchState()`**: Shared classifier in `src/lib/match-classify.ts` — `match.state === 'live'` check first (CanonicalMatch path), falls back to `match.status` (legacy). No divergent classification logic.
3. **STATE_RANK forward-only merge**: `{ SCHEDULED: 0, TIMED: 0, POSTPONED: 1, SUSPENDED: 1, CANCELLED: 1, IN_PLAY: 2, PAUSED: 2, FINISHED: 3 }` — prevents state regression during merges.
4. **DR staleness guard**: 2-minute threshold for live-tier data prevents stale live-state from DR.
5. **Write-back after cold rebuild**: Self-healing primary KV when orchestrator is unavailable.
