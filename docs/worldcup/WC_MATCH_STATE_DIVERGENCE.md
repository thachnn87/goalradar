# WC_MATCH_STATE_DIVERGENCE.md — DATA-18WC.9

**Date:** 2026-06-24
**Method:** Production-only audit — debug API + live HTML extraction

---

## 1. VERDICT

**CONFIRMED: Non-standard FD API status "LIVE" bypassed all live-state guards in the snapshot pipeline.**

Match 537412 (Panama vs Croatia) was in play when the FD API returned `status: "LIVE"` (not the canonical `"IN_PLAY"` this codebase expects). GoalRadar's `isLiveStatus()` guard checks only for `IN_PLAY` and `PAUSED` — "LIVE" slips through, gets committed to the 30-day DR snapshot, and persists indefinitely after the match was cancelled.

---

## 2. EVIDENCE TABLE — PHASE 1 (Match 537412)

| Layer | Status | Score | Age | Notes |
|-------|--------|-------|-----|-------|
| FD live endpoint (`/matches?status=IN_PLAY,PAUSED`) | NOT_IN_LIVE_CACHE | — | — | Never captured — "LIVE" ≠ "IN_PLAY" |
| FD all-matches feed (wc-all-matches KV) | LIVE | — | 12h TTL | Written when match was in play |
| Detail KV (`goalradar:/matches/537412`) | **LIVE** | 0–1 AWAY | 68s | FD "LIVE" status persisted |
| Snapshot KV (`goalradar:match:537412`) | **LIVE** | 0–1 AWAY | 68s | Built from stale detail, 15-min TTL |
| Authority cache (`goalradar:wc:authority:v1`) | **CANCELLED** | — | 39 min (DR) | Built from FD FINISHED feed — correct |
| Live cache (`goalradar:live:matches`) | ABSENT | — | — | 30s TTL expired — no live matches |

---

## 3. PAGE-BY-PAGE FINDINGS — PHASE 3

| Page | Rendered count | Status shown for 537412 | Source |
|------|---------------|--------------------------|--------|
| `/match/537412-panama-vs-croatia` | 1 match | **LIVE** | Per-match snapshot KV |
| `/world-cup-2026/fixtures` | 47 matches | **CANC** | Authority cache |
| `/world-cup-2026` (hub) | 26 items | Not listed | Authority cache |
| `/live` | 0 matches | Not present | Live cache (empty) |

---

## 4. PHASE 2 — AUTHORITY CACHE STATE COUNTS

From `/api/debug/state-divergence` (checked 2026-06-24T00:52:32):

```
Authority distribution:
  FINISHED:  46
  CANCELLED:  1   ← match 537412

Snapshot distribution:
  FINISHED:  46
  MISSING/UNRECOGNIZED: 1  ← match 537412 (status="LIVE" not in recognized set)

Live cache:
  present: false
  liveCount: 0
```

From `/api/debug/authority-freshness`:
```
source: "dr"
builtAt: "2026-06-24T00:13:00.915Z"
ageSec: 2368 (~39 min)
stale: true
matchCount: 47
liveCount: 0
verdict: "RED"
```

---

## 5. PHASE 4 — FIRST DIVERGENCE POINT

**File: `src/lib/match-snapshot.ts`, line 182**

```typescript
function isLiveStatus(status: MatchDetail['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}
```

This function is used by three write guards:

| Guard | Line | Effect |
|-------|------|--------|
| `writeKVSnapshot()` | 265 | `if (isLiveStatus(...)) return;` — skip writing live snapshots |
| `writeDRSnapshot()` | 342 | `if (isLiveStatus(...)) return;` — skip writing live DR snapshots |
| `getOrBuildMatchSnapshot()` | ~674 | score-drift guard skips live matches |

The FD API returned `status: "LIVE"` (not `"IN_PLAY"`) for match 537412 when it was in play. "LIVE" fails all three `isLiveStatus` checks → the snapshot is committed to both primary KV AND DR (30-day TTL).

**File: `src/lib/match-snapshot.ts`, line 118**

```typescript
return 15 * 60; // 900 s — default (POSTPONED, SUSPENDED, CANCELLED …)
```

Because `"LIVE"` doesn't match any specific status check, it falls to the 15-minute default TTL — not the 30-second live TTL. The snapshot stays cached for 15 minutes and rebuilds from the stale DR detail, perpetuating the cycle.

**File: `src/lib/match-snapshot.ts`, line 463**

```typescript
if (live && isLiveStatus(live.status)) {
  match = { ...match, score: live.score, status: live.status };
```

The LIVE overlay reads from the live cache. But the live cache polls `/matches?status=IN_PLAY,PAUSED`. FD's "LIVE" status was never written to the live cache because it didn't match the filter. So no live cache overlay was applied — the snapshot retained `status: "LIVE"` from the detail KV.

---

## 6. ROOT CAUSE CHAIN

```
FD API returns status="LIVE" for match 537412 (non-standard, new WC 2026 status value)
  ↓
Orchestrator prewarm reads all-matches KV → writes detail KV with status="LIVE"
  ↓
buildSnapshot() reads detail KV with status="LIVE"
  ↓
isLiveStatus("LIVE") = false → write guards PASS
  ↓
Snapshot committed to primary (15-min TTL) AND DR (30-day TTL)
  ↓
Match is abandoned/cancelled → FD finished feed shows CANCELLED
  ↓
Authority cache rebuilt → correctly shows CANCELLED (from finished feed)
  ↓
Per-match DR snapshot still shows "LIVE" (30-day TTL = persists 30 days)
  ↓
Every page visit → buildSnapshot reads stale DR detail → status="LIVE" again
  ↓
writeKVSnapshot: isLiveStatus("LIVE")=false → commits new primary with "LIVE"
  ↓
CYCLE PERSISTS indefinitely until DR snapshot expires or is purged
```

---

## 7. WHY EACH PAGE SHOWS WHAT IT SHOWS

### Q: Why does `/match/537412` show "LIVE"?

The match page calls `getOrBuildMatchSnapshot('537412')` at page.tsx line 61. The snapshot returns `match.status = "LIVE"`. The `StatusPill` component (line 232) handles `IN_PLAY` → "LIVE" badge, but for `status = "LIVE"` (the string) it falls through to the generic case (line 263):
```typescript
return <span className="...">{status}</span>  // renders "LIVE" as raw text
```
This is a visible "LIVE" label — but it's the generic fallthrough, not the animated LIVE badge.

The page title says **"Preview"** (not "LIVE Score") because:
```typescript
const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
```
`"LIVE" !== "IN_PLAY"` → `isLive = false` → title falls to "Preview" branch at page.tsx line 86.

### Q: Why does `/world-cup-2026/fixtures` show "CANC"?

The fixtures page uses `getWCAuthorityMatchesV2` → `readAuthorityCache` → authority cache (built from FD FINISHED feed). The FD finished feed correctly shows match 537412 as CANCELLED. The authority cache was built at 00:13 with `status: CANCELLED`. Fixtures page correctly shows "CANC".

### Q: Why does `/live` show "No live matches"?

The live center reads `goalradar:live:matches` (30s TTL). This key is written by `refreshLiveMatches()` → `providerManager.getLiveMatches()` → `/matches?status=IN_PLAY,PAUSED`. FD returned `status: "LIVE"` for this match — that status was never included in the IN_PLAY,PAUSED filter. Match 537412 was **never captured by the live cache**. Live center correctly shows 0 matches (no match with IN_PLAY/PAUSED status exists).

### Q: Why does the WC hub show "No upcoming fixtures" in the Upcoming section?

The WC hub reads from the authority cache. The DATA-18WC.8B fix (deployed this session) adds a fallback to the all-matches key when the upcoming feed is absent. However: the authority cache has not been rebuilt since DATA-18WC.8B was deployed (authority is served from 39-min-old DR). Once the orchestrator runs next and writes a fresh authority cache, the hub will include upcoming Round of 32 fixtures.

---

## 8. WHICH CACHE IS STALE / WHICH SOURCE IS AUTHORITATIVE

| Question | Answer |
|----------|--------|
| **Which page is wrong?** | `/match/537412-panama-vs-croatia` — shows "LIVE" from a stale snapshot |
| **Which cache is stale?** | Per-match snapshot KV (`goalradar:match:537412`) and detail KV (`goalradar:/matches/537412`), both poisoned with `status: "LIVE"` from FD API's non-standard status |
| **Which source is authoritative?** | Authority cache — built from FD canonical FINISHED feed, shows CANCELLED correctly |
| **Is "LIVE" a bug in GoalRadar or FD API?** | FD API returning a new `"LIVE"` status that GoalRadar's `MatchStatus` type doesn't enumerate. The GoalRadar bug is that `isLiveStatus()` doesn't cover all live-adjacent statuses. |

---

## 9. SECONDARY ISSUES (non-divergence, observed)

| Issue | Severity | Details |
|-------|----------|---------|
| Authority cache stale (serving from DR, 39 min old) | YELLOW | `verdict: "RED"` from `/api/debug/authority-freshness`. Orchestrator appears stalled (rate-safe mode was active). Primary authority key evicted. |
| FINISHED feed 1.6h old | YELLOW | Orchestrator cron likely stalled since rate-safe mode activation |
| UPCOMING feed absent (primary + DR) | YELLOW | DATA-18WC.8B fix deployed but authority not yet rebuilt |
| WC hub "No upcoming fixtures" | YELLOW | Will self-heal on next orchestrator run after DATA-18WC.8B deployment |

---

## 10. FIX REQUIREMENTS (do not implement until root cause verified)

| Fix | File | Change |
|-----|------|--------|
| **F1**: Expand `isLiveStatus()` to include FD's "LIVE" status | `src/lib/match-snapshot.ts:182` | `return status === 'IN_PLAY' || status === 'PAUSED' || (status as string) === 'LIVE';` |
| **F2**: Expand `MatchStatus` type to include "LIVE" | `src/lib/types.ts:32` | Add `\| 'LIVE'` to the union |
| **F3**: Expand `getSnapshotTtlSec` to give "LIVE" the 30s TTL | `src/lib/match-snapshot.ts:101` | `if ((status as string) === 'LIVE') return 30;` or gate on expanded `isLiveStatus` |
| **F4**: Add "LIVE" to `StatusPill` handler | `src/app/match/[id]/page.tsx:233` | Treat "LIVE" same as "IN_PLAY" |
| **F5**: Purge stale DR snapshot for 537412 | KV operation | `kv.del('goalradar:dr:match:537412')` and `kv.del('goalradar:dr:/matches/537412')` |
| **F6**: Expand live cache query to include "LIVE" status | `src/lib/refresh.ts:269` | Change FD endpoint to `status=IN_PLAY,PAUSED,LIVE` |

**Priority order:** F1+F3 (prevent future poison) → F5 (purge existing poison) → F2+F4+F6 (full normalization)

---

**Gate: DO_NOT_FIX_UNTIL_APPROVED** — root cause proven, fix plan documented above.
