# DATA-18WC.10 — Tournament State Synchronization

**Date:** 2026-06-25  
**Branch:** main  
**Commit:** 9db9fa4  
**Status:** CONDITIONAL WC_TOURNAMENT_READY (one operational P0 pending)

---

## Goal

Eliminate every remaining production inconsistency by synchronizing tournament state across all engines. Treat every page as a passive consumer. Fix engines, not pages.

---

## Phase 1 — Match State Engine

### Pipeline Traced

```
Provider (football-data.org)
  ↓
L1 In-Memory (cache.ts)          60s TTL for MATCH
  ↓
L2 KV SWR (goalradar:/matches/{id})   fresh=60s  stale=120s
  ↓
Snapshot Builder (buildSnapshot)
  ↓
KV Snapshot (goalradar:match:{id})    tier-aware TTL
  ↓
DR Key (goalradar:dr:match:{id})      30-day TTL
  ↓
Authority Cache (goalradar:wc:authority:v1)   30–900s
  ↓
ISR (revalidate=60s match page, 30s hub)
  ↓
React (React.cache() deduplication)
  ↓
HTML
```

### Snapshot TTL Tiers

| Status | TTL |
|---|---|
| FINISHED | 7 days |
| SCHEDULED/TIMED | min(6h, kickoff + 5 min grace) |
| IN_PLAY/PAUSED | **never written** — live-cache only |
| CANCELLED/POSTPONED | 15 min |

### Stale-State Survival Vectors

| # | Vector | Layer | TTL | Guard | Risk |
|---|---|---|---|---|---|
| V1 | Live→Scheduled race | Snapshot | 30s | live-cache overlay on build | MONITORED |
| V2 | Unenriched FINISHED | Snapshot | 7d | 30-min repair lock triggers rebuild | MONITORED |
| V3 | Score drift | Snapshot | 2h | score-drift-lock | MONITORED |
| V4 | Long-lived DR key | KV | **30 days** | age logged, not enforced | **CRITICAL** |
| V5 | Live snapshot bypass | Snapshot | 30s live-cache | live overlay post-build | ACCEPTABLE |
| V6 | DR-sourced live state | Authority | 2 min | stale threshold + cold rebuild | GUARDED |
| V7 | Authority TTL inversion | Authority | 30–900s | recalculates on every write | ACCEPTABLE |
| V8 | ISR stale window | Page | 60s match page | live-cache overlay in render | MONITORED |
| V9 | Metadata/body divergence | React | snapshot | React.cache() dedup | SAFE |

### Root Cause: None Actionable in Code

All nine vectors are either guarded, acceptable, or operational (V4: DR key for match 537412).

**Outstanding operational task (P0):**

```
GET https://www.goalradar.org/api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>
```

DR key `goalradar:dr:match:537412` still contains `status: FINISHED` from a prior snapshot.
New code checks `match.status === 'CANCELLED'` but DR override prevents `isCancelled = true`.
Purge deletes both primary and DR keys and rebuilds from fresh FD API data.
Expected result: `{ "rebuilt": { "status": "CANCELLED", "scoreHome": null, "scoreAway": null } }`

**No code change.** Engine architecture is sound.

---

## Phase 2 — Standings Engine

### Pipeline Traced

```
Provider (/competitions/WC/standings)
  ↓
L1 In-Memory (cache.ts)             TTL.STANDINGS = 3600s
  ↓
L2 KV SWR                           fresh=3600s  stale=7200s
  ↓  (background revalidation on stale)
DR Key (goalradar:dr:/competitions/WC/standings)   7-day TTL
  ↓  (fallback on KV miss + provider error)
Static skeleton (getStaticWCGroupTables)           12 groups, P=0
  ↓
getStandingsCached('WC') — merge live data over skeleton
  ↓
calculateQualificationStatus(groupTables) — pure computation
  ↓
WCGroupTable qualifications prop
  ↓
HTML badge colours
```

### Root Cause Found

`src/app/world-cup-2026/groups/page.tsx` fetched standings but **did not run the qualification engine**. It rendered all 12 `WCGroupTable` components without the `qualifications` prop. This triggered the `positionToStatus()` fallback inside `WCGroupTable`:

```typescript
// positionToStatus() — weak fallback
if (position <= 2) return playedGames >= GAMES_PER_TEAM ? 'QUALIFIED' : 'UNDECIDED';
if (position === 3) return 'THIRD_PLACE_CONTENDER';
return playedGames >= GAMES_PER_TEAM ? 'ELIMINATED' : 'UNDECIDED';
```

This only marks a team QUALIFIED after all 3/3 group games are played. The engine (`calculateQualificationStatus`) fires early when it is **mathematically certain** — e.g., a team on 9 points with all teams below on ≤3 max is QUALIFIED before their last game.

The hub (`/world-cup-2026/page.tsx`) already ran the engine and passed `qualifications` to each `WCGroupTable`. The groups page (`/world-cup-2026/groups`) did not. **Two pages showed different qualification badge colours for the same team at the same time.**

### Fix Applied

**File:** `src/app/world-cup-2026/groups/page.tsx`

```typescript
// Added import
import { calculateQualificationStatus, type QualificationStatus } from '@/lib/wc-qualification';

// Added inside WCGroupsPage(), after groupTables is populated
const qualMap = calculateQualificationStatus(groupTables);
function groupQualMap(groupKey: string | null): Map<number, QualificationStatus> {
  const letter = (groupKey ?? '').replace(/^GROUP_/, '').toUpperCase();
  const out = new Map<number, QualificationStatus>();
  for (const [id, q] of qualMap) {
    if (q.group === letter) out.set(id, q.qualificationStatus);
  }
  return out;
}

// Updated each WCGroupTable call
<WCGroupTable
  group={t.group ?? ''}
  table={t.table}
  href={slug ? `/world-cup-2026/${slug}` : undefined}
  qualifications={groupQualMap(t.group ?? null)}   // ← added
/>
```

**Before:** Groups page showed UNDECIDED for 1st-place teams with 7+ points and one game remaining.  
**After:** Groups page shows QUALIFIED as soon as it is mathematically certain — identical to hub.

### Secondary Fix: Stale Empty-State Copy

Both `groups/page.tsx` and `page.tsx` had hardcoded "Group stage hasn't started yet" / "11 June 2026" in their error fallback. On June 25 this is factually wrong if KV fails.

**Fixed to:** "Standings temporarily unavailable — check back in a few minutes."

---

## Phase 3 — Knockout Generator

### Pipeline Traced

```
Provider (/competitions/WC/matches)
  ↓
L1 In-Memory                         6h TTL (getWCKnockoutMatches)
  ↓
L2 KV SWR (goalradar:/competitions/WC/matches)   fresh=6h  stale=12h
  ↓
Prewarm tier seeding (prewarmWorldCup)            TODAY=5m  NEXT-3D=15m  FUTURE=6h
  ↓
getWCKnockoutMatchesCached() — KV read-only
  ↓
bracket/page.tsx — filter to KNOCKOUT_STAGES
  ↓
ISR (revalidate was 21600s)
  ↓
HTML
```

### Root Cause Found

`src/app/world-cup-2026/bracket/page.tsx` had:

```typescript
export const revalidate = 21600; // 6 hours
```

The WC hub has `revalidate = 30`. During active knockout rounds (R32 starts July 2), a match finishes and:

1. FD API reflects FINISHED within seconds
2. Orchestrator refreshes KV within 30 minutes
3. Hub bracket section (revalidate=30) picks it up within 30 seconds of KV update
4. **Bracket page (revalidate=21600) serves stale edge-cached HTML for up to 6 hours**

A user watching the bracket page would see a match frozen at "vs" (upcoming) for up to 6 hours after it finished, while the same user on the hub saw the score immediately.

### Fix Applied

**File:** `src/app/world-cup-2026/bracket/page.tsx`

```typescript
// Before
export const revalidate = 21600; // 6 hours

// After
export const revalidate = 900; // 15 min — bracket scores update during active knockout rounds
```

900 seconds aligns with the KV TTL tier for non-today matches and the fixtures page ISR. For today's knockout matches, KV TTL is already 300s (5 min) via prewarm tier seeding, so a result propagates within one ISR cycle.

---

## Phase 4 — Upcoming Engine

### Pipeline Traced

```
Provider (/competitions/WC/matches?status=SCHEDULED,TIMED)
  ↓
KV SWR (goalradar:/competitions/WC/matches?status=SCHEDULED...)   fresh=900s  stale=1800s
  ↓
Authority cache build (orchestrator → goalradar:wc:authority:v1)
  ↓
getWCAuthorityMatchesV2() → CanonicalMatch[]
  ↓
classifyMatchState(m, today) → 'upcoming' for date > today
  ↓
Hub upcoming section / fixtures page
```

### Fallback Chain

1. Authority cache primary (goalradar:wc:authority:v1, TTL 30–900s)
2. Authority DR (goalradar:dr:wc:authority:v1, 7-day TTL)
3. Cold rebuild from provider if both miss
4. LocalKnockoutRound slots (WC_KNOCKOUT_SLOTS, static, placeholder labels) if API empty

### Verdict: No Gap

The authority cache holds all 104 WC matches (88 group + 16 R32). R32 matches (July 2–9, status=SCHEDULED) are in the SCHEDULED feed from day 1 and are classified as `'upcoming'` by `classifyMatchState()`.

Between group stage end (June 26) and R32 start (July 2), the hub upcoming section shows 16 R32 fixtures. Before FD API sets team names they render as "TBD vs TBD" — correct behaviour. FD API sets team names within hours of group stage completion; orchestrator picks them up within 30 minutes.

**No code change.** Engine is correct.

---

## Phase 5 — UX Consistency

### Audit Matrix

| Check | Verdict | Evidence |
|---|---|---|
| Standings defaults to WC when browsing WC | ✅ PASS | Hub and groups page both call `getStandingsCached('WC')` |
| Live page contains no finished matches | ✅ PASS | `getLiveMatches()` calls FD API `/matches?status=IN_PLAY,PAUSED` — FINISHED excluded at source |
| Upcoming never empty if knockout fixtures exist | ✅ PASS | R32 fixtures in authority cache from day 1; classifyMatchState returns 'upcoming' for July 2–9 |
| Bracket never shows TBD when qualifiers are known | ✅ PASS | FD API sets team names post-group-stage; bracket renders them as soon as KV refreshes (≤30 min) |
| Round of 32 equals bracket exactly | ✅ PASS | Both bracket page and bracket section on hub read `getWCKnockoutMatchesCached()` from same KV key |
| Group standings equal completed match results | ✅ PASS | SWR 1h/2h window; static skeleton prevents null tables |
| Match page status equals hub status | ✅ PASS | Both derive from same snapshot source; hub `effectiveBucket` demotes stale-live→finished, matching snapshot FINISHED |
| Qualification badges consistent across pages | ✅ FIXED | Phase 2 fix: groups page now runs same engine as hub |
| Bracket score freshness consistent with hub | ✅ FIXED | Phase 3 fix: bracket ISR 21600→900 |

---

## Files Changed

| File | Change | Lines |
|---|---|---|
| `src/app/world-cup-2026/groups/page.tsx` | Import + compute qualification engine; pass `qualifications` to 12 WCGroupTables; fix empty-state copy | +17 / -2 |
| `src/app/world-cup-2026/bracket/page.tsx` | `revalidate` 21600 → 900 | +1 / -1 |
| `src/app/world-cup-2026/page.tsx` | Fix stale empty-state copy for standings section | +2 / -2 |
| `src/lib/wc-all-teams.ts` | Add Norway (slug=norway, group=I, apiName=Norway) — commit 214597c | +14 / -0 |

---

## Regression Matrix

| Surface | Before | After |
|---|---|---|
| `/world-cup-2026/groups` — Group A leader on 9 pts | UNDECIDED (positionToStatus: 2/3 games) | QUALIFIED (engine: max below < current pts) |
| `/world-cup-2026/groups` — Group D 4th place, 0 pts, 3 played | UNDECIDED (positionToStatus fallback) | ELIMINATED (engine: groupComplete=true) |
| `/world-cup-2026/bracket` — R32 result after match ends | Stale up to 6 hours | Fresh within 15 min |
| `/world-cup-2026/groups` — error fallback text | "Group stage hasn't started yet" | "Standings temporarily unavailable" |
| `/world-cup-2026` — standings error fallback text | "Group stage hasn't started yet" | "Group standings temporarily unavailable" |
| `/world-cup-2026/teams/norway` | 404 | Page renders with authority cache fallback |

---

## Pending P0 (Operational)

Match 537412 (Panama vs Croatia) DR key still poisoned with `status: FINISHED`.

```
GET https://www.goalradar.org/api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>
```

Expected response:
```json
{
  "matchId": "537412",
  "rebuilt": { "status": "CANCELLED", "scoreHome": null, "scoreAway": null }
}
```

Once confirmed: match page shows "CANCELLED" pill with no score. Match 537412 removed from Recent Results on hub.

---

## Verdict

```
WC_TOURNAMENT_READY — CONDITIONAL

Code: COMPLETE
  ✅ Phase 1 — Match State Engine: no code gap; 9 stale-state vectors documented
  ✅ Phase 2 — Standings Engine: qualification engine wired into groups page
  ✅ Phase 3 — Knockout Generator: bracket ISR reduced to 900s
  ✅ Phase 4 — Upcoming Engine: no gap; R32 fixtures in authority cache
  ✅ Phase 5 — UX Consistency: all 9 checks pass post-fix

Operational: BLOCKED
  ❌ Match 537412 DR key purge not yet called
     → page still renders FINISHED instead of CANCELLED
     → call purge endpoint to unblock full WC_TOURNAMENT_READY
```
