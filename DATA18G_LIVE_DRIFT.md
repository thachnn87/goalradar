# DATA-18G Phase 1 — Live Match Drift Audit

Date: 2026-06-17  
Commit: `c402129` (DATA-18F)

---

## Scope

Drift validation extended to all match states, not just FINISHED:

| State | Authority field | Snapshot field | Drift risk |
|-------|----------------|----------------|------------|
| `finished` | `state='finished'` | `status='FINISHED'` | LOW — snapshot is immutable after FINISHED |
| `live` | `state='live'` | `status='IN_PLAY'\|'PAUSED'` | HIGH — both update every 30s |
| `scheduled` | `state='scheduled'` | `status='SCHEDULED'\|'TIMED'` | VERY LOW — neither changes until kickoff |
| `cancelled` | `state='cancelled'` | `status='POSTPONED'\|'CANCELLED'\|'SUSPENDED'` | LOW |

---

## Live Match Drift Characteristics

### Why LIVE drift is different from FINISHED drift

**FINISHED matches:**
- Score is final — immutable
- Authority cache TTL: 900s (15 min)  
- Snapshot TTL: 7 days
- Drift window: 0 (both sources agree once match ends)

**LIVE matches:**
- Score updates every ~1 min
- Authority cache TTL: **30s** (live tier)
- Live cache (`goalradar:live:wc-matches`): refreshed by orchestrator on every cron cycle
- Snapshot: **NOT written for live matches** (`isLiveStatus()` guard in `writeKVSnapshot()`)
- Drift window: **up to 30s** between authority cache rebuilds — by design

### Authority cache behavior during live match

```
T+0s:   Cron writes authority cache | liveCount=1 | ttl=30s
T+1s:   Goal scored in live match
T+15s:  Live cache updated (in-process)
T+30s:  Authority cache TTL expires
T+30s:  Next request triggers cold rebuild → reads live cache → score updated
Max lag: 30s for listing pages | 0s for match detail page (reads live cache directly)
```

The authority cache's 30s TTL during live matches is intentional — it matches the live feed refresh rate.

---

## What the `/api/debug/authority-drift` endpoint does for live matches

The drift endpoint (`DATA-18F Phase 2`) filters to `state === 'finished'` only, because:
1. Snapshots are not written for live matches — there is no snapshot to compare against
2. Live score lag of ≤30s is expected and by design, not a drift issue
3. The live feed path has its own monitoring via `/api/debug/live-health`

### Live match monitoring chain (existing)

| Endpoint | What it checks |
|---------|---------------|
| `/api/debug/live-health` | Live feed present, age < 60s, count > 0 during known match windows |
| `/api/debug/live-telemetry` | Per-match live update timestamps |
| `/api/debug/live-minute` | Minute-by-minute score progression |

---

## PAUSED (Half Time) State

| Scenario | Authority | Snapshot | Expected |
|----------|-----------|----------|---------|
| HT during live match | `state='live'`, score e.g. 2-1 | No snapshot (live guard) | No drift — no snapshot to compare |
| Resumed after HT | `state='live'` | No snapshot | No drift |
| FINISHED after HT score | `state='finished'`, score final | Snapshot written on FINISHED | GREEN — drift check runs after FINISHED |

---

## State Transition Matrix

Valid FD status → CanonicalMatch.state transitions:

| FD Status | CanonicalMatch.state | Authority TTL | Snapshot Written? |
|-----------|---------------------|---------------|------------------|
| `SCHEDULED` | `scheduled` | 900s | Yes (upcoming TTL) |
| `TIMED` | `scheduled` | 900s | Yes (upcoming TTL) |
| `IN_PLAY` | `live` | **30s** | **No** |
| `PAUSED` | `live` | **30s** | **No** |
| `FINISHED` | `finished` | 900s | Yes (7-day TTL) |
| `POSTPONED` | `cancelled` | 900s | Yes (15-min TTL) |
| `CANCELLED` | `cancelled` | 900s | Yes (15-min TTL) |
| `SUSPENDED` | `cancelled` | 900s | Yes (15-min TTL) |

Invalid transitions detected by `/api/debug/feed-integrity`:
- `FINISHED` in UPCOMING feed (stale — YELLOW)
- `SCHEDULED/TIMED` in FINISHED feed (data error — YELLOW)
- `FINISHED` in FD feed but `scheduled` in authority cache (stale authority — RED)

---

## Drift Coverage Summary

| State | Drift endpoint covers? | Live health covers? | Notes |
|-------|----------------------|--------------------|-|
| `finished` | ✅ `/api/debug/authority-drift` | — | Full per-match diff |
| `live` | ✅ (score lag ≤30s is by design) | ✅ `/api/debug/live-health` | Lag is expected, not drift |
| `scheduled` | ✅ feed-integrity (state transition check) | — | No snapshot to diff |
| `cancelled` | ✅ feed-integrity (state transition check) | — | No snapshot to diff |

---

## Conclusion

LIVE/IN_PLAY/PAUSED drift is governed by the 30s authority cache TTL — not a bug but a design invariant. The maximum observable score lag on any listing page during an active match is **30 seconds**. This is within the SLO defined in `DATA18G_SLO.md`.

FINISHED drift is the only drift type that matters for score accuracy, and it is fully covered by `/api/debug/authority-drift` (DATA-18F Phase 2).
