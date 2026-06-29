# WC_STATUS_ENUM_AUDIT.md — DATA-18WC.9A

**Date:** 2026-06-24
**Method:** Static analysis of all GoalRadar source files + confirmed production evidence (DATA-18WC.9)

---

## 1. CURRENT MATCHSTATUS TYPE (`src/lib/types.ts:32`)

```typescript
export type MatchStatus =
  | 'SCHEDULED'   // future fixture, no confirmed kickoff time
  | 'TIMED'       // future fixture, kickoff time confirmed
  | 'IN_PLAY'     // currently being played
  | 'PAUSED'      // match paused (halftime, break)
  | 'FINISHED'    // match completed
  | 'POSTPONED'   // rescheduled to a future date
  | 'CANCELLED'   // cancelled, no reschedule
  | 'SUSPENDED';  // suspended mid-match, resolution unclear
```

**8 values.** All uppercase strings. Used as the `Match.status` and `MatchDetail.status` fields throughout the codebase. TypeScript enforces this type — but only at compile time. Runtime values from external APIs are **never validated** at the boundary in the FD provider.

---

## 2. COMPLETE STATUS VALUE CENSUS

### 2.1 Values Declared in Type System

| Status | Source | Count (files) | First Seen | Notes |
|--------|--------|---------------|------------|-------|
| `SCHEDULED` | types.ts | ~44 | origin of codebase | Primary pre-start status |
| `TIMED` | types.ts | ~38 | origin of codebase | Pre-start with confirmed time |
| `IN_PLAY` | types.ts | ~32 | origin of codebase | Live match |
| `PAUSED` | types.ts | ~28 | origin of codebase | Halftime / break |
| `FINISHED` | types.ts | ~48 | origin of codebase | Terminal state |
| `POSTPONED` | types.ts | ~8 | origin of codebase | Aborted, will be rescheduled |
| `CANCELLED` | types.ts | ~8 | origin of codebase | Aborted permanently |
| `SUSPENDED` | types.ts | ~8 | origin of codebase | Aborted mid-match |

### 2.2 Values Observed at Runtime (NOT in Type)

| Status | Source | Count | First Seen | Last Seen | Evidence |
|--------|--------|-------|------------|-----------|----------|
| `"LIVE"` | FD API v4 (WC 2026) | 1+ confirmed | 2026-06-23 (match 537412) | 2026-06-24 (DR snapshot) | `detailStatus: "LIVE"` from `/api/debug/match-state/537412` |

### 2.3 Values Documented in FD API v4 (Not Yet Observed in GoalRadar)

| Status | FD API documentation | Current GoalRadar handling |
|--------|---------------------|---------------------------|
| `AWARDED` | Winner determined by walkover/forfeit | Not in `MatchStatus` type — would fall through all guards exactly like "LIVE" |

---

## 3. STATUS SOURCES

### 3.1 Football-Data.org Provider (`src/lib/providers/football-data.ts`)

**Normalization: NONE.**

`fetchRaw<T>` does `res.json() as Promise<T>` — the JSON response is cast directly to the TypeScript type with no runtime validation. Any status string FD API returns is passed through verbatim, including non-standard values.

| FD API Endpoint | Status Filter | Statuses That Can Appear |
|----------------|---------------|--------------------------|
| `/matches/${id}` | none | Any status FD returns for that match |
| `/competitions/{code}/matches?status=SCHEDULED,TIMED` | SCHEDULED, TIMED | SCHEDULED, TIMED (filtered by FD) |
| `/matches?status=IN_PLAY,PAUSED` | IN_PLAY, PAUSED | IN_PLAY, PAUSED (filtered by FD); **"LIVE" NOT returned here** |
| `/competitions/{code}/matches?status=FINISHED` | FINISHED | FINISHED, AWARDED (FD documented) |
| `/competitions/{code}/matches` (all) | none | All statuses FD has, including "LIVE" |
| `/competitions/{code}/matches?dateFrom=...` | none | All statuses for that date range |

**Critical gap:** The all-matches endpoint (used by authority cache and prewarm) returns all statuses. The `/matches/{id}` endpoint (per-match detail) can return any status FD assigns, including "LIVE".

### 3.2 Api-Football Provider (`src/lib/providers/api-football.ts`)

**Normalization: COMPLETE via STATUS_MAP.**

All api-football short codes are mapped to canonical `MatchStatus` values at line 63–84. Unknown codes fall back to `'SCHEDULED'` (silent failure).

| api-football Code | Canonical Status | Semantics |
|-------------------|------------------|-----------|
| `NS` | `SCHEDULED` | Not started |
| `TBD` | `TIMED` | Time TBD |
| `1H`, `2H`, `ET`, `BT`, `P`, `INT` | `IN_PLAY` | Various in-play states |
| `HT` | `PAUSED` | Halftime |
| `FT`, `AET`, `PEN`, `WO` | `FINISHED` | All completion variants |
| `PST` | `POSTPONED` | Postponed |
| `CANC` | `CANCELLED` | Cancelled |
| `ABD`, `SUSP` | `SUSPENDED` | Abandoned / Suspended |
| *(unknown)* | `SCHEDULED` | **Silent fallback — incorrect for new codes** |

**Risk:** If api-football adds new codes (e.g., `LIVE` or `WO` variants), the `?? 'SCHEDULED'` fallback silently normalizes them as pre-start. This is less dangerous than FD's pass-through because the fallback produces a *valid* enum value, but it produces the *wrong* one.

### 3.3 ESPN Provider (`src/lib/providers/espn.ts`)

**No status production.** ESPN is enrichment-only (goals, cards, subs for FINISHED matches). It does not set or override match status.

---

## 4. STATUS CONSUMERS (Per Status)

### `SCHEDULED`
| Consumer | File | Line | Usage |
|----------|------|------|-------|
| Authority cache fallback filter | authority-cache.ts | ~329 | Included in client-side filter when upcoming KV absent |
| Snapshot TTL | match-snapshot.ts | 106 | TTL = min(6h, time-to-kickoff+5min) |
| Snapshot staleness check | match-snapshot.ts | ~233 | If kickoff passed, force rebuild |
| Canonical state | canonical-match.ts | ~228 | → state `'scheduled'` |
| Live cache exclusion | authority-cache.ts | ~356 | Not IN_PLAY/PAUSED → excluded from liveMap |
| Prewarm filter | prewarm/worldcup.ts | ~277 | Included in upcoming tier |
| FD query filter | football-data.ts | 190 | `?status=SCHEDULED,TIMED` |
| BracketMatchCard | WCBracket.tsx | 74 | `showScore` = false; date shown |

### `TIMED`
Same consumers as `SCHEDULED`. Treated identically throughout the codebase.

### `IN_PLAY`
| Consumer | File | Line | Usage |
|----------|------|------|-------|
| `isLiveStatus()` | match-snapshot.ts | 182 | True — snapshot write guard fires |
| Snapshot TTL | match-snapshot.ts | 102 | 30s (guarded — won't be committed anyway) |
| Authority liveMap | authority-cache.ts | ~356 | → liveMap, `liveCount++` |
| Authority fallback filter | authority-cache.ts | ~329 | Included in fallback |
| Live cache | live-cache.ts | ~208 | FD endpoint `?status=IN_PLAY,PAUSED` |
| Canonical state | canonical-match.ts | ~226 | → state `'live'` |
| Rate-safe tier | rate-safe.ts | ~113 | TTL tier = 'live' (30s) |
| STATE_RANK | match-state-overlay.ts | ~38 | Rank = 2 |
| Match page `isLive` | match/[id]/page.tsx | 70 | `true` → "LIVE Score" title |
| StatusPill | match/[id]/page.tsx | ~233 | Renders animated LIVE badge |
| BracketMatchCard | WCBracket.tsx | 75 | `isLive = true` → red border, "LIVE" label |

### `PAUSED`
Same consumers as `IN_PLAY`. Treated identically throughout.

### `FINISHED`
| Consumer | File | Line | Usage |
|----------|------|------|-------|
| Snapshot TTL | match-snapshot.ts | 104 | 7 days |
| Authority cache "finished" bucket | authority-cache.ts | ~200 | `distribution.authority.finished` |
| Authority feed source | authority-cache.ts | ~315 | Read from `?status=FINISHED` KV key |
| Canonical state | canonical-match.ts | ~227 | → state `'finished'` |
| Rate-safe tier | rate-safe.ts | ~114 | TTL tier = 'finished' (24h) |
| STATE_RANK | match-state-overlay.ts | ~40 | Rank = 3 (highest — cannot be demoted) |
| Match page score | match/[id]/page.tsx | ~232 | `StatusPill` → "FT" |
| BracketMatchCard | WCBracket.tsx | 124 | "FT" label |

### `POSTPONED`
| Consumer | File | Line | Usage |
|----------|------|------|-------|
| Snapshot TTL | match-snapshot.ts | 118 | Default 15min |
| Canonical state | canonical-match.ts | ~229 | → state `'cancelled'` |
| STATE_RANK | match-state-overlay.ts | ~35 | Rank = 1 |
| Match page StatusPill | match/[id]/page.tsx | ~254 | Renders "Postponed" |
| classifyMatchState | match-classify.ts | ~53 | → bucket 'other' |

### `CANCELLED`
Same consumers as `POSTPONED`. Both → canonical state `'cancelled'`, rank 1.

### `SUSPENDED`
Same consumers as `POSTPONED`.

---

## 5. THE "LIVE" STATUS — PRODUCTION EVIDENCE

### 5.1 Confirmed Runtime Observation

| Field | Value |
|-------|-------|
| Match | 537412 (Panama vs Croatia) |
| Observed | 2026-06-24T00:52 UTC |
| Source | FD API `/matches/537412` |
| KV key | `goalradar:/matches/537412` → `status: "LIVE"` |
| Snapshot key | `goalradar:match:537412` → `status: "LIVE"` |
| DR snapshot key | `goalradar:dr:match:537412` → `status: "LIVE"` |
| Authority cache | `status: CANCELLED` (correct — from finished feed) |

### 5.2 Why "LIVE" Appears in KV

FD API v4 has introduced `status: "LIVE"` for WC 2026 in-play matches alongside or instead of `"IN_PLAY"`. The FD provider has NO normalization — `fetchRaw<MatchDetail>('/matches/537412')` returns the raw FD JSON, cast directly to `MatchDetail` via TypeScript type assertion. TypeScript does not validate this at runtime.

### 5.3 What Each Consumer Does With "LIVE"

| Consumer | Behavior With `"LIVE"` | Correct? |
|----------|------------------------|----------|
| `isLiveStatus()` | Returns `false` — "LIVE" ≠ "IN_PLAY" ≠ "PAUSED" | **WRONG** |
| `writeKVSnapshot` guard | Fires (guard condition = `isLiveStatus`) → snapshot IS written | **WRONG** |
| `writeDRSnapshot` guard | Fires → "LIVE" written to DR (30-day TTL) | **WRONG** |
| `getSnapshotTtlSec` | Falls to default 15min branch (line 118) | **WRONG** (should be 30s) |
| Authority cache liveMap | `"LIVE" !== 'IN_PLAY' && "LIVE" !== 'PAUSED'` → not in liveMap | **WRONG** |
| Authority fallback filter | `"LIVE"` not in `['SCHEDULED','TIMED','IN_PLAY','PAUSED']` → excluded | **WRONG** |
| FD live query | `?status=IN_PLAY,PAUSED` — FD never returns "LIVE" here | Never captured |
| `STATE_RANK` | `"LIVE"` not in map → `undefined` rank | **WRONG** (undefined behavior) |
| Canonical `deriveState` | No case for "LIVE" → falls to implicit `else` → `'cancelled'`? | **WRONG** |
| Match page `isLive` | `"LIVE" !== 'IN_PLAY' && "LIVE" !== 'PAUSED'` → false → "Preview" title | **WRONG** |
| `StatusPill` | No case → `default` → renders raw `{status}` text "LIVE" | Accidentally shows something |
| `BracketMatchCard` | `showScore = ['FINISHED','IN_PLAY','PAUSED'].includes("LIVE")` → false | **WRONG** |
| `rate-safe.ts` tier | `"LIVE"` not checked → doesn't match 'live' tier | **WRONG** |

### 5.4 Why "LIVE" Doesn't Appear in Live Center

The live cache is populated by `getLiveMatches()` → `/matches?status=IN_PLAY,PAUSED`. FD API's `?status=IN_PLAY,PAUSED` filter at the FD server level never returns matches with `status: "LIVE"` — those are a separate status bucket on FD's side. So the match was never captured in the live cache. Live center correctly shows 0 live matches.

---

## 6. STATUS BRANCHING — COVERAGE MAP

All status branching in the codebase uses if-else chains. No switch statements exist. The following table shows where each status is and is NOT handled:

| Consumer | SCHED | TIMED | IN_PLAY | PAUSED | FINISHED | POST | CANC | SUSP | **LIVE** | AWARDED |
|----------|-------|-------|---------|--------|----------|------|------|------|----------|---------|
| `isLiveStatus()` | — | — | ✅ | ✅ | — | — | — | ❌ | ❌ |
| `getSnapshotTtlSec()` | ✅ | ✅ | ✅ | ✅ | ✅ | ~15m | ~15m | ~15m | ❌ 15m | ❌ 15m |
| `STATE_RANK` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ undef | ❌ undef |
| `deriveState()` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ fallth | ❌ fallth |
| `classifyMatchState()` | ✅ | ✅ | ✅ | ✅ | ✅ | ~other | ~other | ~other | ❌ other | ❌ other |
| `StatusPill` | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | — | ❌ raw | ❌ raw |
| `BracketMatchCard` | — | — | ✅ | ✅ | ✅ | — | — | — | ❌ | ❌ |
| Authority liveMap | — | — | ✅ | ✅ | — | — | — | — | ❌ | ❌ |
| Authority fallback filter | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ❌ | ❌ |
| `rate-safe.ts` tier | — | — | ✅ | ✅ | ✅ | — | — | — | ❌ | ❌ |

Legend: ✅ = handled correctly, ❌ = not handled (falls through or produces wrong output), ~x = bucketed into catch-all, — = not applicable

---

## 7. FD API v4 STATUS SURFACE AREA

The FD API v4 **documented** statuses are:

| FD Status | Semantics | In GoalRadar type? | Normalization |
|-----------|-----------|-------------------|---------------|
| `SCHEDULED` | Pre-kickoff, time TBD | ✅ | Pass-through |
| `TIMED` | Pre-kickoff, time confirmed | ✅ | Pass-through |
| `IN_PLAY` | In progress | ✅ | Pass-through |
| `PAUSED` | Paused (halftime etc.) | ✅ | Pass-through |
| `FINISHED` | Completed | ✅ | Pass-through |
| `POSTPONED` | Postponed | ✅ | Pass-through |
| `CANCELLED` | Cancelled | ✅ | Pass-through |
| `SUSPENDED` | Suspended | ✅ | Pass-through |
| `AWARDED` | Walkover / forfeit | ❌ MISSING | None — would pass through raw |
| `LIVE` | In play (observed WC 2026) | ❌ MISSING | None — passes through raw (CONFIRMED) |

---

## 8. PROPOSED CANONICAL MATCHSTATUS ENUM

**Design goal:** One exhaustive enum that GoalRadar uses internally. All providers normalize to this at the API boundary. No runtime surprises.

```typescript
export type MatchStatus =
  // Pre-start
  | 'SCHEDULED'    // future, no confirmed kickoff time
  | 'TIMED'        // future, kickoff time confirmed

  // Live
  | 'IN_PLAY'      // first half, second half, extra time (canonical live)
  | 'PAUSED'       // halftime or injury break

  // Terminal — with result
  | 'FINISHED'     // match completed normally
  | 'AWARDED'      // result awarded (walkover, forfeit) — NEW

  // Terminal — no result
  | 'POSTPONED'    // to be rescheduled
  | 'CANCELLED'    // no reschedule
  | 'SUSPENDED';   // suspended mid-match, resolution unclear
```

### 8.1 Normalization Map

All incoming status values from all providers must be normalized to the canonical enum at the provider boundary:

| Incoming Value | Provider | Canonical | Rationale |
|----------------|----------|-----------|-----------|
| `"LIVE"` | FD API | `IN_PLAY` | WC 2026 in-play alias; same semantics |
| `"AWARDED"` | FD API | `AWARDED` | Distinct terminal state — not FINISHED (no goals) |
| `"NS"` | api-football | `SCHEDULED` | Not started |
| `"TBD"` | api-football | `TIMED` | Time TBD → maps to TIMED (time known but TBD semantics) |
| `"1H"`,`"2H"`,`"ET"`,`"BT"`,`"P"`,`"INT"` | api-football | `IN_PLAY` | In-play variants |
| `"HT"` | api-football | `PAUSED` | Halftime |
| `"FT"`,`"AET"`,`"PEN"` | api-football | `FINISHED` | Completion variants |
| `"WO"` | api-football | `AWARDED` | Walkover → AWARDED (more precise than FINISHED) |
| `"PST"` | api-football | `POSTPONED` | Postponed |
| `"CANC"` | api-football | `CANCELLED` | Cancelled |
| `"ABD"`,`"SUSP"` | api-football | `SUSPENDED` | Abandoned/Suspended |
| *(unknown)* | any | `SUSPENDED` | **Fail-safe: unknown in-flight state** (not SCHEDULED) |

> **Note on `WO` mapping:** Current code maps `WO → FINISHED`. The proposed mapping is `WO → AWARDED`. This is a semantic improvement — walkover matches have no goals and a score of 0–0 or similar; showing them as "FT" is misleading. Evaluate impact on score display before implementing.

> **Note on unknown fallback:** Current api-football fallback is `?? 'SCHEDULED'`. Proposing `SUSPENDED` as the safer fallback — if an unknown status appears during play, treating it as pre-start is wrong; treating it as suspended is less harmful.

### 8.2 Required isLiveStatus() Expansion

```typescript
// Current (broken):
function isLiveStatus(status: MatchDetail['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

// Target (after normalization — "LIVE" no longer reaches this function):
function isLiveStatus(status: MatchStatus): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}
// With normalization at the boundary, this function is already correct.
// The normalization layer intercepts "LIVE" → "IN_PLAY" before it propagates.
```

Alternatively, without boundary normalization (defensive-in-depth):
```typescript
function isLiveStatus(status: MatchStatus | string): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE';
}
```

### 8.3 STATE_RANK Expansion

```typescript
export const STATE_RANK: Record<string, number> = {
  SCHEDULED:  0,
  TIMED:      0,
  POSTPONED:  1,
  SUSPENDED:  1,
  CANCELLED:  1,
  AWARDED:    3,   // NEW — terminal state, same rank as FINISHED
  IN_PLAY:    2,
  PAUSED:     2,
  FINISHED:   3,
};
```

---

## 9. NORMALIZATION INSERTION POINTS

Three locations where status normalization should be applied:

| Layer | File | Location | What to do |
|-------|------|----------|-----------|
| **FD Provider** | `src/lib/providers/football-data.ts` | After `fetchRaw()` for every endpoint returning `Match[]` or `MatchDetail` | Apply `normalizeFDStatus(status)` mapping before returning |
| **Prewarm `toMatchDetail()`** | `src/lib/prewarm/worldcup.ts` | `toMatchDetail()` function, line 197 | Apply `normalizeFDStatus(m.status)` when spreading |
| **api-football fallback** | `src/lib/providers/api-football.ts` | `mapStatus()` line 83 | Change `?? 'SCHEDULED'` → `?? 'SUSPENDED'` |

A single `normalizeFDStatus()` utility in `src/lib/providers/football-data.ts` or a shared `src/lib/status-normalize.ts`:

```typescript
const FD_STATUS_ALIASES: Record<string, MatchStatus> = {
  LIVE:    'IN_PLAY',   // WC 2026 observed
  AWARDED: 'AWARDED',  // documented FD v4
};

export function normalizeFDStatus(raw: string): MatchStatus {
  if (raw in FD_STATUS_ALIASES) return FD_STATUS_ALIASES[raw];
  // Validate it's a known canonical value; if not, log and treat as SUSPENDED
  const known: readonly string[] = [
    'SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED',
    'POSTPONED','CANCELLED','SUSPENDED','AWARDED',
  ];
  if (known.includes(raw)) return raw as MatchStatus;
  console.warn(`[status-normalize] Unknown FD status "${raw}" → SUSPENDED`);
  return 'SUSPENDED';
}
```

---

## 10. SUMMARY

| Issue | Severity | Affected Status | Impact |
|-------|----------|-----------------|--------|
| `"LIVE"` not in `MatchStatus` type | CRITICAL | LIVE | DR snapshot poisoned 30 days; match page shows "LIVE" |
| FD provider has no normalization | CRITICAL | LIVE, AWARDED (+ any future FD additions) | Any new FD status passes through as opaque string |
| `isLiveStatus()` misses "LIVE" | CRITICAL | LIVE | Write guards bypassed; snapshot committed |
| `STATE_RANK` missing "LIVE", "AWARDED" | HIGH | LIVE, AWARDED | `undefined` rank → state promotion logic undefined |
| `AWARDED` not in type | MEDIUM | AWARDED | Would behave identically to "LIVE" if encountered |
| api-football unknown fallback is `'SCHEDULED'` | LOW | future new codes | Silent wrong normalization (valid enum value, wrong semantics) |

**Root fix:** Add a `normalizeFDStatus()` at the FD provider boundary. All downstream code (isLiveStatus, STATE_RANK, canonical-match, StatusPill) stays correct because it never sees "LIVE" or "AWARDED" as raw strings — they arrive as "IN_PLAY" and "AWARDED" respectively.

---

**Gate: DO_NOT_IMPLEMENT — audit complete, implementation requires separate approval.**
