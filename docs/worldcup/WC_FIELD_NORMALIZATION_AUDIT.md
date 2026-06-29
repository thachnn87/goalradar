# WC_FIELD_NORMALIZATION_AUDIT.md — DATA-18WC.9C Phase 2

**Date:** 2026-06-24
**Method:** Full source read of all providers, manager, and cache layers

---

## 1. NORMALIZATION STATUS LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ NORMALIZED | Field is fully mapped to canonical GoalRadar type |
| ⚠️ PARTIAL | Field is partially normalized; some edge cases unhandled |
| ❌ NOT NORMALIZED | Raw provider value passes through without any transformation |
| N/A | Field not produced by this provider |

---

## 2. FOOTBALL-DATA.ORG (PRIMARY PROVIDER)

**File:** `src/lib/providers/football-data.ts`

**Architecture:** `fetchRaw<T>()` → `res.json() as Promise<T>` — zero post-processing.

Every method is a direct `fetchRaw<T>` call. There is no normalization layer. TypeScript types are enforced at compile time only.

| Field | Status | Evidence | Risk |
|-------|--------|----------|------|
| `status` | ❌ NOT NORMALIZED | `fetchRaw<MatchDetail>('/matches/{id}')` — raw cast | CRITICAL — "LIVE" confirmed |
| `score.*` | ❌ NOT NORMALIZED | Direct JSON cast | LOW — FD schema stable |
| `homeTeam.*` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `awayTeam.*` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `utcDate` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `stage` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `group` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `competition.code` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |
| `goals` | N/A | FD detail endpoint returns goals but GoalRadar reads ESPN for events | N/A |
| `referees` | ❌ NOT NORMALIZED | Direct JSON cast | LOW |

**Type coercion pattern:**
```typescript
// football-data.ts — fetchRaw
if (res.ok) return res.json() as Promise<T>;
//                              ^^^^^^^^^^^
// TypeScript type assertion — no runtime validation
// Any value FD sends for status is blindly accepted as MatchStatus
```

**Documented FD v4 statuses not in GoalRadar MatchStatus:**
- `"LIVE"` — **CONFIRMED PRODUCTION** (match 537412, 2026-06-23)
- `"AWARDED"` — documented for walkover/forfeit results

**Impact of missing normalization:** Both `"LIVE"` and any future new FD status string pass into the KV cache, snapshot system, and authority cache without interception.

---

## 3. API-FOOTBALL (SECONDARY / FAILOVER PROVIDER)

**File:** `src/lib/providers/api-football.ts`

**Architecture:** Every response type goes through explicit `normalise*()` functions.

### `status` — ✅ NORMALIZED (via STATUS_MAP)

```typescript
const STATUS_MAP: Record<string, MatchStatus> = {
  NS: 'SCHEDULED', TBD: 'TIMED',
  '1H': 'IN_PLAY', '2H': 'IN_PLAY', ET: 'IN_PLAY', BT: 'IN_PLAY', P: 'IN_PLAY', INT: 'IN_PLAY',
  HT: 'PAUSED',
  FT: 'FINISHED', AET: 'FINISHED', PEN: 'FINISHED',
  PST: 'POSTPONED', CANC: 'CANCELLED', ABD: 'SUSPENDED', SUSP: 'SUSPENDED',
  WO: 'FINISHED',  // walkover → FINISHED (imprecise — no goals, should be AWARDED)
};
function mapStatus(short: string): MatchStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';  // ⚠️ UNKNOWN → SCHEDULED (wrong fallback)
}
```

**Gap 1:** `WO` (walkover) → `'FINISHED'` is semantically imprecise. A walkover has no goals and a notional score. Showing "FT" label is misleading.

**Gap 2:** Unknown codes → `'SCHEDULED'`. If AF adds a new code (e.g. `AWD` for technical loss), it would silently appear as a pre-start fixture. This is a valid `MatchStatus` value so it doesn't break guards, but it is semantically wrong.

**Gap 3:** `AWD` (Technical Win/Loss) is documented in AF API but not in STATUS_MAP.

### `homeTeam` / `awayTeam` — ⚠️ PARTIAL

```typescript
function normaliseTeam(t: AFTeam): Team {
  return {
    id:        t.id,
    name:      t.name,
    shortName: t.name,     // ⚠️ shortName = name (AF has no shortName field)
    tla:       t.name.slice(0, 3).toUpperCase(),  // ⚠️ synthetic TLA
    crest:     t.logo ?? '',
  };
}
```

**Gap:** `shortName` is always `name`. `tla` is always the first 3 chars uppercased. For well-known teams this is wrong (e.g. "Argentina" → tla "ARG" is correct by accident, "South Korea" → tla "SOU" is wrong; FD returns "KOR").

**Risk:** Match page uses `shortName` for compact display. If failover occurs, team display changes style.

### `stage` / `group` — ⚠️ PARTIAL (via `parseRound()`)

```typescript
function parseRound(round: string): { group: string | null; stage: string; matchday: number | null } {
  const groupMatch = round.match(/Group\s+([A-L])/i);
  const dayMatch   = round.match(/[-–]\s*(\d+)$/);
  return {
    group:    groupMatch ? `GROUP_${groupMatch[1].toUpperCase()}` : null,
    stage:    round.includes('Group') ? 'GROUP_STAGE'
            : round.includes('Round of 32') ? 'LAST_32'
            : round.includes('Round of 16') ? 'LAST_16'
            : round.includes('Quarter') ? 'QUARTER_FINALS'
            : round.includes('Semi') ? 'SEMI_FINALS'
            : round.includes('Final') ? 'FINAL'
            : round,  // ⚠️ falls through to raw string for unknown rounds
    matchday: dayMatch ? parseInt(dayMatch[1], 10) : null,
  };
}
```

**Gap:** If AF uses unexpected round names (e.g. "3rd Place Playoff"), the stage falls through to the raw string. This breaks bracket routing which expects exact stage constants.

**Gap:** Groups only matched A–L (FIFA WC 2026 has 12 groups A–L). If future tournaments use different naming, regex fails.

### `score` — ✅ NORMALIZED (via `normaliseScore()`)

```typescript
function normaliseScore(goals: { home: number | null; away: number | null }, score: AFScore): Score {
  const winner = goals.home !== null && goals.away !== null
    ? goals.home > goals.away ? 'HOME_TEAM'
    : goals.away > goals.home ? 'AWAY_TEAM'
    : 'DRAW'
    : null;
  const duration = score.penalty?.home !== null ? 'PENALTY_SHOOTOUT'
    : score.extratime?.home !== null ? 'EXTRA_TIME'
    : 'REGULAR';
  return { winner, duration, fullTime: { home: goals.home, away: goals.away }, halfTime: { ... } };
}
```

Correctly derives `winner` and `duration`. No gaps identified.

### `competition` — ⚠️ PARTIAL

```typescript
code: Object.keys(COMPETITION_MAP).find(k => COMPETITION_MAP[k].leagueId === league.id) ?? ''
```

**Gap:** If `leagueId` not in COMPETITION_MAP, code becomes `''` (empty string). Match page `competition?.code === 'WC'` check fails, breaking WC-specific routing.

---

## 4. ESPN ENRICHMENT

**File:** `src/lib/providers/espn.ts`

ESPN never produces `status`, `score`, `stage`, `group`, or any Match-level fields. It only produces:

| Field | Status | Notes |
|-------|--------|-------|
| `goals[].minute` | ✅ NORMALIZED | `espnClockToMinute()` handles cumulative vs per-half formats |
| `goals[].type` | ✅ NORMALIZED | `isOwnGoal` detection from type.text |
| `bookings[].card` | ✅ NORMALIZED | type.id: `94→YELLOW, 95→RED, 96→YELLOW_RED` |
| `substitutions[].playerIn/Out` | ✅ NORMALIZED | Positional: index 0=in, index 1=out (validated) |
| `lineups[].position` | ⚠️ PARTIAL | ESPN abbreviation used directly (null if missing) |
| `team.id` | ❌ NOT NORMALIZED | ESPN uses string IDs; `parseInt(espnTeam.id, 10) || 0` fallback |
| `team.name` | ⚠️ PARTIAL | ESPN team names normalized via `normaliseName()` + `ESPN_ALIASES` for matching only, not stored |

**Key finding:** ESPN event `team.id` integers (from `parseInt(espnTeam.id, 10)`) are ESPN internal IDs, not FD match IDs. The C2_TEAM_ID integrity check in `validateCanonicalMatch()` catches mismatched team IDs — but only in the CanonicalMatch validation path, not in the raw snapshot.

---

## 5. PROVIDERMANAGER

**File:** `src/lib/providers/manager.ts`

`withFailover()` is a transparent wrapper. **Zero normalization.** All response data passes through unchanged from whichever provider served the request.

**Design note:** Normalization belongs in each provider, not the manager. The manager's role is error routing only. However, the absence of a shared normalization contract means a provider can return non-canonical data without any interception at the manager layer.

---

## 6. PREWARM LAYER (`toMatchDetail()`)

**File:** `src/lib/prewarm/worldcup.ts:197`

```typescript
function toMatchDetail(m: Match): MatchDetail {
  return {
    ...m,              // ← spreads Match including status — NO normalization
    goals:         [],
    bookings:      [],
    substitutions: [],
    venue:         null,
    referees:      [],
  } as MatchDetail;
}
```

**Gap:** `status` is spread from `m` (the FD bulk feed Match) with no normalization. If the bulk feed contains `"LIVE"`, it propagates into the detail KV key.

**Note:** For the all-matches feed (`/competitions/WC/matches`), FD returns "LIVE" for in-play WC 2026 matches. `toMatchDetail()` spreads this through unchanged, poisoning the detail KV written by prewarm.

---

## 7. SNAPSHOT LAYER (`buildSnapshot()`)

**File:** `src/lib/match-snapshot.ts`

| Field | Normalization |
|-------|--------------|
| `status` | ❌ Read from detail KV as-is. `isLiveStatus()` guard checks only IN_PLAY/PAUSED — "LIVE" bypasses |
| `score` | Score-drift guard for FINISHED matches; no normalization |
| `goals/bookings/subs` | Applied from ESPN/AF enrichment if present; not normalized beyond ESPN parsing |
| `venue` | Read from detail KV as-is |

**LIVE-2 overlay logic:**
```typescript
if (live && isLiveStatus(live.status)) {
  match = { ...match, score: live.score, status: live.status };
}
```
The live cache overlay would correct a "LIVE" snapshot to "IN_PLAY" if the live cache had captured the match with "IN_PLAY". But since FD's `/matches?status=IN_PLAY,PAUSED` query never returned "LIVE" matches, the live cache has no entry, and the overlay never fires.

---

## 8. NORMALIZATION GAP SUMMARY

| Field | Provider | Gap Type | Severity |
|-------|----------|----------|---------|
| `status = "LIVE"` | FD | Missing alias mapping | CRITICAL |
| `status = "AWARDED"` | FD | Missing enum value | HIGH |
| `status` (unknown future) | FD | No fallback guard | HIGH |
| `status` (AF unknown codes) | AF | Fallback → `'SCHEDULED'` (wrong) | MEDIUM |
| `homeTeam.shortName` | AF | Synthetic (= name) | MEDIUM |
| `homeTeam.tla` | AF | Synthetic (first 3 chars) | MEDIUM |
| `stage` (unknown round) | AF | Falls through to raw string | MEDIUM |
| `competition.code` (unknown) | AF | Falls through to `''` | MEDIUM |
| `goals[].team.id` | ESPN | ESPN integer ID ≠ FD team ID | MEDIUM |
| `status` spread in toMatchDetail | Prewarm | Spreads Match.status unchanged | HIGH |
| `WO → FINISHED` | AF | Semantically imprecise | LOW |
