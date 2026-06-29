# WC_PROVIDER_NORMALIZATION_AUDIT.md — DATA-18WC.9B

**Date:** 2026-06-24
**Method:** Full source read of all provider files + cache write path trace

---

## EXECUTIVE SUMMARY

GoalRadar has **two active data providers** (football-data.org primary, api-football secondary), **one enrichment source** (ESPN), and **one aggregation layer** (ProviderManager). Of these:

- **api-football** fully normalizes status at the boundary. ✅
- **ESPN** never touches status. ✅ (enrichment only)
- **football-data.org** performs **zero normalization**. Raw API JSON is cast to TypeScript types at `res.json() as Promise<T>`. Any status string FD returns — including undocumented values — enters the system verbatim. ❌ **CRITICAL**
- **ProviderManager** performs zero normalization — it is a transparent wrapper. Status poisoning from FD passes through unchanged. ❌

The confirmed consequence: `"LIVE"` from FD API for WC 2026 bypassed all downstream guards, was written to the 30-day DR snapshot for match 537412, and persists on the match page 24h after the match was cancelled.

---

## 1. FOOTBALL-DATA.ORG (PRIMARY PROVIDER)

**File:** `src/lib/providers/football-data.ts`

### 1.1 Architecture

```
HTTP request → fetchRaw<T>() → res.json() as Promise<T> → caller
```

`fetchRaw<T>` is a single generic function used for every endpoint. It fetches, handles errors (403/404/429/5xx), and returns `res.json() as Promise<T>`. There is no response shape validation, no field-level normalization, and no status mapping.

### 1.2 Raw Status Values — Documented

FD API v4 official documentation lists:

| Status | Semantics |
|--------|-----------|
| `SCHEDULED` | Pre-kickoff, no confirmed time |
| `TIMED` | Pre-kickoff, time confirmed |
| `IN_PLAY` | Match in progress |
| `PAUSED` | Match paused (halftime, breaks) |
| `FINISHED` | Match completed |
| `POSTPONED` | Postponed (to be rescheduled) |
| `CANCELLED` | Cancelled (no reschedule) |
| `SUSPENDED` | Suspended mid-match |
| `AWARDED` | Result awarded (walkover, forfeit) — **not in GoalRadar type** |

### 1.3 Raw Status Values — Observed at Runtime

| Status | Observed | Context |
|--------|----------|---------|
| `"LIVE"` | ✅ Confirmed 2026-06-23 | WC 2026 match 537412 in-play; `/api/debug/match-state/537412` returned `detailStatus: "LIVE"` |

`"LIVE"` does not appear in the FD v4 official documentation. It is a WC 2026-specific or API version-specific status alias for `IN_PLAY`.

### 1.4 Existing Normalization Logic

**None.** Every provider method delegates to `fetchRaw<T>`:

```typescript
// football-data.ts — the entire provider, annotated:

getMatch(id: number): Promise<MatchDetail> {
  return fetchRaw(`/matches/${id}`);               // ← no normalization
}
getFixtures(competition: string) {
  return fetchRaw(`/competitions/${competition}/matches?status=SCHEDULED,TIMED`); // ← no normalization
}
getLiveMatches() {
  return fetchRaw('/matches?status=IN_PLAY,PAUSED'); // ← no normalization
}
getAllMatches(competition: string) {
  return fetchRaw(`/competitions/${competition}/matches`); // ← no normalization
}
getTodayMatches() { ... return fetchRaw(`/matches?dateFrom=...`); } // ← no normalization
getResults(competition: string) { ... return fetchRaw(`/competitions/.../matches?dateFrom=...`); } // ← no normalization
getTeamMatches(id: string) {
  return fetchRaw(`/teams/${id}/matches?status=FINISHED&limit=10`); // ← no normalization
}
```

The `?status=` query parameters in request URLs are **server-side filters sent to FD API** — they are not client-side normalization. They reduce which matches are returned, but they do not sanitize the `status` field of each match in the response.

Critically: the FD server filter `?status=IN_PLAY,PAUSED` does not guarantee the response only contains `IN_PLAY` and `PAUSED` values — it filters by FD's server-side status classification. If FD classifies a match as `"LIVE"` but returns it for the `?status=IN_PLAY,PAUSED` query, the response status field would still be `"LIVE"`. (Conversely, FD's `?status=IN_PLAY,PAUSED` may intentionally exclude `"LIVE"` — which is why `"LIVE"` never appeared in the live cache.)

### 1.5 Missing Normalization Logic

| Gap | Impact | Endpoints Affected |
|-----|--------|--------------------|
| `"LIVE"` → `"IN_PLAY"` | CRITICAL — DR poison, guard bypass | `getMatch`, `getAllMatches`, `getTodayMatches`, `getResults` |
| `"AWARDED"` → `"AWARDED"` (or `"FINISHED"`) | MEDIUM — any future walkover result | `getMatch`, `getAllMatches`, `getResults`, `getTodayMatches` |
| Unknown future status | MEDIUM — silent pass-through | ALL endpoints returning `Match[]` or `MatchDetail` |

### 1.6 Unknown-Value Handling

**None.** Unknown status values are passed through with TypeScript type assertion. The TypeScript compiler does not reject them at runtime. No logging, no fallback, no rejection. An unknown value silently becomes an opaque string inside what the rest of the system treats as a `MatchStatus`.

### 1.7 Cache Write Path Impact

Because FD performs no normalization, the raw status enters the KV cache directly:

```
FD API "LIVE" 
  → fetchRaw<MatchDetail>('/matches/537412')
  → MatchDetail { status: "LIVE", ... }
  → providerManager.getMatch(537412)
  → withKVCache() writes KVEntry { data: MatchDetail { status: "LIVE" } } to goalradar:/matches/537412
                   ↳ also writes DR via writeDisasterRecovery()
  → match-snapshot.ts reads detail KV
  → buildSnapshot builds MatchSnapshot { match: { status: "LIVE" } }
  → writeKVSnapshot: isLiveStatus("LIVE") = false → guard PASSES → writes to goalradar:match:537412
  → writeDRSnapshot: isLiveStatus("LIVE") = false → guard PASSES → writes to goalradar:dr:match:537412 (30-day TTL)
```

Every KV write tier is polluted: the SWR primary detail, the SWR DR detail, the snapshot primary, and the snapshot DR.

### 1.8 Snapshot Impact

| Snapshot Key | Impact |
|-------------|--------|
| `goalradar:/matches/537412` (detail primary, SWR) | `status: "LIVE"` — serves "LIVE" for up to 7 days SWR stale TTL |
| `goalradar:dr:/matches/537412` (detail DR, 7 days) | `status: "LIVE"` — rebuilds from here on miss |
| `goalradar:match:537412` (snapshot primary) | `status: "LIVE"` — 15min TTL (default branch) |
| `goalradar:dr:match:537412` (snapshot DR, 30 days) | `status: "LIVE"` — serves as fallback for 30 days |

### 1.9 Authority Cache Impact

The authority cache reads from the `?status=FINISHED` and `?status=SCHEDULED,TIMED` KV feeds — these are pre-filtered server-side. The finished feed correctly returns match 537412 as `CANCELLED` (the FD finished feed uses different endpoint logic than the per-match detail). The authority cache is **not polluted** by `"LIVE"` for this case.

However: `getAllMatches()` (used by authority `coldRebuild` fallback) returns all statuses. If `"LIVE"` appears in that response, the `coldRebuild` filter `m.status === 'SCHEDULED' || m.status === 'TIMED' || m.status === 'IN_PLAY' || m.status === 'PAUSED'` would exclude it (since `"LIVE" !== 'IN_PLAY'`). So authority upcoming count would undercount by 1 per `"LIVE"` match.

---

## 2. API-FOOTBALL (SECONDARY / FAILOVER PROVIDER)

**File:** `src/lib/providers/api-football.ts`

### 2.1 Architecture

```
HTTP request → normaliseMatch() → STATUS_MAP lookup → MatchStatus → caller
```

api-football returns a completely different response shape from FD. The provider's `normaliseMatch()` function explicitly maps every api-football field to GoalRadar canonical types. Status is always mapped through `STATUS_MAP`.

### 2.2 Raw Status Values — Documented (api-football short codes)

| api-football Code | Meaning | Maps to |
|------------------|---------|---------|
| `NS` | Not Started | `SCHEDULED` |
| `TBD` | Time To Be Defined | `TIMED` |
| `1H` | First Half | `IN_PLAY` |
| `2H` | Second Half | `IN_PLAY` |
| `ET` | Extra Time | `IN_PLAY` |
| `BT` | Break Time (between ET halves) | `IN_PLAY` |
| `P` | Penalty In Progress | `IN_PLAY` |
| `INT` | Match Interrupted | `IN_PLAY` |
| `HT` | Halftime | `PAUSED` |
| `FT` | Full Time | `FINISHED` |
| `AET` | After Extra Time | `FINISHED` |
| `PEN` | After Penalties | `FINISHED` |
| `PST` | Postponed | `POSTPONED` |
| `CANC` | Cancelled | `CANCELLED` |
| `ABD` | Abandoned | `SUSPENDED` |
| `SUSP` | Suspended | `SUSPENDED` |
| `WO` | Walkover | `FINISHED` |
| `AWD` | Technical Loss (not currently in map) | — |
| `LIVE` | Live (alternate code) | — (not in STATUS_MAP) |

### 2.3 Existing Normalization Logic

```typescript
const STATUS_MAP: Record<string, MatchStatus> = {
  NS:   'SCHEDULED',
  TBD:  'TIMED',
  '1H': 'IN_PLAY',
  '2H': 'IN_PLAY',
  ET:   'IN_PLAY',
  BT:   'IN_PLAY',
  P:    'IN_PLAY',
  INT:  'IN_PLAY',
  HT:   'PAUSED',
  FT:   'FINISHED',
  AET:  'FINISHED',
  PEN:  'FINISHED',
  PST:  'POSTPONED',
  CANC: 'CANCELLED',
  ABD:  'SUSPENDED',
  SUSP: 'SUSPENDED',
  WO:   'FINISHED',   // walkover → FINISHED
};

function mapStatus(short: string): MatchStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';  // ← fallback: unknown → SCHEDULED
}
```

This is applied in `normaliseMatch()` for every `Match` built from the api-football response.

### 2.4 Missing Normalization Logic

| Gap | Impact |
|-----|--------|
| `AWD` (Technical Loss / Technical Win) not in STATUS_MAP | Would fall to `'SCHEDULED'` — wrong |
| `LIVE` not in STATUS_MAP (if api-football also adopts this) | Would fall to `'SCHEDULED'` — wrong |
| Unknown future codes → `'SCHEDULED'` fallback | Silent wrong value — maps to VALID enum value, but semantically incorrect |

### 2.5 Unknown-Value Handling

```typescript
return STATUS_MAP[short] ?? 'SCHEDULED';
```

Unknown codes silently become `'SCHEDULED'`. This is **less dangerous** than FD's pass-through (it produces a valid `MatchStatus` value), but it is **semantically wrong** for unknown in-play or terminal states. A match `ABD`d (abandoned) that maps to `CANCELLED` is correct; a hypothetical new code that maps to `SCHEDULED` would create a ghost "upcoming" fixture from a completed match.

### 2.6 WO Mapping Concern

`WO → 'FINISHED'` is pragmatic but imprecise. A walkover match was never played; it has no goals, halftime score, or duration. Presenting it as `FINISHED` gives it a "FT" status badge with `0-0` score, which may be misleading. The proposed `AWARDED` canonical status (from DATA-18WC.9A audit) would distinguish walkovers from completed matches.

### 2.7 Cache Write Path Impact

api-football's normalization fires before any data reaches the ProviderManager or cache layer. The cache receives a `Match` or `MatchDetail` with a canonical `MatchStatus` value. All cache write guards (`isLiveStatus`, `getSnapshotTtlSec`) behave correctly for data from this provider.

### 2.8 Authority Cache Impact

No impact beyond the `WO → FINISHED` semantic ambiguity. All other statuses are correctly normalized.

---

## 3. ESPN ENRICHMENT

**File:** `src/lib/providers/espn.ts`
**ID mapping:** `src/lib/espn-id-map.ts`

### 3.1 Architecture

ESPN is a secondary enrichment source, not a primary data provider. It is never called for:
- Match status
- Score
- Kickoff time
- Fixture scheduling

It is only called for:
- Goals (scorer, minute, assist, type)
- Bookings (card type, player, minute)
- Substitutions (players in/out, minute)
- Lineups (starters, bench, formation positions)

### 3.2 Status Exposure

ESPN's `getEspnMatchEvents()` returns `EspnMatchEvents`:

```typescript
export interface EspnMatchEvents {
  espnMatchId:   string;
  goals:         Goal[];
  bookings:      Booking[];
  substitutions: Substitution[];
  lineups:       { home: Lineup; away: Lineup } | null;
}
```

No `status` field. ESPN never sets or modifies `match.status`. The enrichment is merged into `MatchDetail` by the snapshot builder, which splices in `goals`, `bookings`, `substitutions`, and `lineups` while leaving `status`, `score`, and `utcDate` unchanged from the FD source.

### 3.3 Status Normalization Required

**None.** ESPN is not a status pollution vector.

### 3.4 Indirect Risk

ESPN-sourced event data is written to KV keys:
- `goalradar:espn:event:{matchId}` (12-hour TTL)
- `goalradar:espn:lookup:{matchId}` (30-day TTL)

If a match snapshot is rebuilt from KV after status was poisoned, ESPN events are merged in but they don't affect the `status` field. The `"LIVE"` status in a rebuilt snapshot comes only from the FD detail KV or FD DR — ESPN has no role in producing or perpetuating it.

---

## 4. PROVIDERMANAGER (FAILOVER LAYER)

**File:** `src/lib/providers/manager.ts`

### 4.1 Architecture

```
caller → withFailover(endpoint, primaryFn, secondaryFn)
           ├─ try PRIMARY → success → return result AS-IS
           └─ catch ApiUnavailableError
                ├─ try SECONDARY → success → return result AS-IS
                └─ both fail → throw
```

`withFailover` is a pure error-routing wrapper. It does not inspect, transform, or validate response data. The caller receives exactly what the provider returned.

### 4.2 Status Normalization

**None.** By design — the manager delegates to providers which are expected to return canonical types. This design assumption is correct for api-football (which normalizes) but incorrect for football-data.org (which does not).

### 4.3 Implication

The gap is in the FD provider, not in the manager. Adding normalization at the manager level would be wrong architecture — it would require the manager to know about API-specific status quirks, violating the provider abstraction. The correct fix is at each provider's response boundary.

---

## 5. CACHE WRITE PATH AUDIT

The status value flows from the provider through these layers before reaching persistent KV storage:

```
Provider response
  │
  ├─ [FD] No normalization ──→ raw status in data
  ├─ [AF] STATUS_MAP ─────────→ canonical status in data
  │
  └─ ProviderManager.withFailover() [no transform]
       │
       └─ api.ts withKVCache() / withCache()
            │  Writes: KVEntry { data: Match/MatchDetail, fetchedAt, freshUntil }
            │  Also writes DR: KVEntry (7-day TTL)
            │  ← NO STATUS CHECK. Any status passes through.
            │
            └─ match-snapshot.ts buildSnapshot()
                 │  Assembles MatchSnapshot { match: MatchDetail }
                 │
                 ├─ writeKVSnapshot()
                 │    Guard: if (isLiveStatus(snapshot.match.status)) return;
                 │    ← isLiveStatus checks IN_PLAY | PAUSED only
                 │    ← "LIVE" bypasses → snapshot written (15min TTL)
                 │
                 └─ writeDRSnapshot()
                      Guard: if (isLiveStatus(snapshot.match.status)) return;
                      ← same guard, same bypass
                      ← "LIVE" written to 30-day DR
```

### 5.1 Cache Key Impact Table

| KV Key Pattern | Written By | Status Guard | "LIVE" Behavior | TTL |
|---------------|-----------|-------------|-----------------|-----|
| `goalradar:/matches/{id}` | withKVCache in api.ts | None | Written as-is | SWR fresh ~60s |
| `goalradar:dr:/matches/{id}` | writeDisasterRecovery in kv-cache.ts | None | Written as-is | 7 days |
| `goalradar:match:{id}` | writeKVSnapshot | `isLiveStatus()` — broken | **Written** (passes guard) | 15 min (default branch) |
| `goalradar:dr:match:{id}` | writeDRSnapshot | `isLiveStatus()` — broken | **Written** (passes guard) | **30 days** |
| `goalradar:live:matches` | live-cache.ts | FD query filter | Not written (FD filter) | 30 seconds |
| `goalradar:wc:authority:v1` | authority-cache.ts | FINISHED feed source | Not affected | 15 min (900s TTL) |

---

## 6. FUTURE PROVIDER RISK ASSESSMENT

If a third provider is added, the system's normalization posture depends entirely on what the provider implements.

| Scenario | Risk |
|----------|------|
| New provider with STATUS_MAP (like api-football) | Manageable — new codes default to whatever fallback is set |
| New provider with no normalization (like FD) | CRITICAL — any new status string poisons downstream |
| New provider with partial normalization | MEDIUM — known codes correct, unknown pass-through |

There is currently **no enforcement mechanism** that prevents a future provider from returning raw status strings. The `MatchProvider` interface declares `getMatch(): Promise<MatchDetail>` — TypeScript trusts the provider to return a valid `MatchDetail` with a valid `MatchStatus`, but this is a compile-time contract only.

---

## 7. PROPOSED NORMALIZATION LAYER ARCHITECTURE

### 7.1 Design Principles

1. **Boundary normalization only.** Status is normalized once, at the provider's output boundary, before it enters any cache or downstream logic. No other layer needs to handle provider-specific status strings.

2. **Each provider owns its normalization.** The FD provider normalizes FD statuses. The AF provider already normalizes AF codes. The manager does not normalize. Callers do not normalize.

3. **Unknown values produce a safe canonical value with a warning.** Never silently produce a wrong canonical status. Never throw (would break the request path). Log and return a defensible canonical value.

4. **Fail-safe is `'SUSPENDED'`, not `'SCHEDULED'`.** An unknown status during or after play is more likely to be a terminal or in-progress state than a pre-start state. `SUSPENDED` (rank 1 in STATE_RANK) communicates "something went wrong" without pretending the match hasn't started.

5. **Normalization is a pure function.** It takes a raw string, returns a `MatchStatus`. No side effects, no I/O. Easily testable.

### 7.2 Proposed Module: `src/lib/providers/normalize-status.ts`

```typescript
// Architecture only — do not implement yet

import type { MatchStatus } from '@/lib/types';

// Canonical set of all valid GoalRadar statuses
const CANONICAL: ReadonlySet<string> = new Set([
  'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED',
  'AWARDED', 'POSTPONED', 'CANCELLED', 'SUSPENDED',
]);

// FD-specific status aliases (non-canonical values observed or documented from FD API)
const FD_ALIASES: Readonly<Record<string, MatchStatus>> = {
  'LIVE':    'IN_PLAY',   // WC 2026 in-play alias — confirmed production
  'AWARDED': 'AWARDED',   // FD v4 documented walkover/forfeit status
};

// api-football short code → canonical (extends existing STATUS_MAP)
const AF_STATUS_MAP: Readonly<Record<string, MatchStatus>> = {
  NS:   'SCHEDULED',
  TBD:  'TIMED',
  '1H': 'IN_PLAY',
  '2H': 'IN_PLAY',
  ET:   'IN_PLAY',
  BT:   'IN_PLAY',
  P:    'IN_PLAY',
  INT:  'IN_PLAY',
  HT:   'PAUSED',
  FT:   'FINISHED',
  AET:  'FINISHED',
  PEN:  'FINISHED',
  PST:  'POSTPONED',
  CANC: 'CANCELLED',
  ABD:  'SUSPENDED',
  SUSP: 'SUSPENDED',
  WO:   'AWARDED',    // walkover → AWARDED (more precise than FINISHED)
  AWD:  'AWARDED',    // technical loss/win → AWARDED
};

/**
 * Normalize a raw status string from football-data.org to a canonical MatchStatus.
 *
 * Handles:
 *   - All 9 canonical values (pass-through)
 *   - "LIVE" alias → IN_PLAY
 *   - Any unknown value → SUSPENDED (logged)
 */
export function normalizeFDStatus(raw: string | undefined | null): MatchStatus {
  if (!raw) return 'SUSPENDED';
  if (CANONICAL.has(raw)) return raw as MatchStatus;
  if (raw in FD_ALIASES) return FD_ALIASES[raw];
  console.warn(`[normalize-status] Unknown FD status "${raw}" → SUSPENDED`);
  return 'SUSPENDED';
}

/**
 * Normalize a raw short-code from api-football to a canonical MatchStatus.
 *
 * Handles all documented AF short codes.
 * Unknown codes → SUSPENDED (logged).
 */
export function normalizeAFStatus(short: string | undefined | null): MatchStatus {
  if (!short) return 'SUSPENDED';
  if (short in AF_STATUS_MAP) return AF_STATUS_MAP[short];
  console.warn(`[normalize-status] Unknown AF status "${short}" → SUSPENDED`);
  return 'SUSPENDED';
}

/**
 * Normalize a Match[] from any FD endpoint — applies normalizeFDStatus to every match.
 * Returns a new array; original objects are not mutated.
 */
export function normalizeFDMatches(matches: Match[]): Match[] {
  return matches.map(m => ({ ...m, status: normalizeFDStatus(m.status) }));
}

/**
 * Normalize a MatchDetail from any FD endpoint.
 * Returns a new object; original is not mutated.
 */
export function normalizeFDMatchDetail(detail: MatchDetail): MatchDetail {
  return { ...detail, status: normalizeFDStatus(detail.status) };
}
```

### 7.3 FD Provider Integration Points

Each method in `FootballDataProvider` that returns `Match[]` or `MatchDetail` wraps its `fetchRaw` result through the normalizer:

| Method | Payload | Normalization call |
|--------|---------|-------------------|
| `getMatch(id)` | `MatchDetail` | `normalizeFDMatchDetail(result)` |
| `getFixtures(competition)` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getResults(competition)` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getLiveMatches()` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getAllMatches(competition)` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getTodayMatches()` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getTeamMatches(id)` | `{ matches: Match[] }` | `normalizeFDMatches(result.matches)` |
| `getHeadToHead(matchId)` | `HeadToHead` | None (no status field) |
| `getStandings(competition)` | standings response | None (no status field) |
| `getTeam(id)` | `TeamDetail` | None (no status field) |

### 7.4 AF Provider Integration Points

Replace the inline `STATUS_MAP` fallback with `normalizeAFStatus()`:

| Current | Proposed |
|---------|----------|
| `STATUS_MAP[short] ?? 'SCHEDULED'` | `normalizeAFStatus(short)` |

Add `AWD` to the AF_STATUS_MAP in the centralized module.

### 7.5 ProviderManager Integration Points

**None.** The manager should remain a transparent wrapper. Normalization is each provider's responsibility.

### 7.6 ESPN Integration Points

**None.** ESPN never produces or modifies match status.

---

## 8. NORMALIZATION LAYER DATA FLOW (AFTER FIX)

```
FD API response: { status: "LIVE", ... }
  │
  └─ normalizeFDMatchDetail()
       ├─ FD_ALIASES["LIVE"] = "IN_PLAY"
       └─ returns { ...detail, status: "IN_PLAY" }
              │
              └─ ProviderManager (unchanged, transparent)
                   │
                   └─ withKVCache writes: { data: { status: "IN_PLAY" } }
                        │
                        └─ buildSnapshot: MatchSnapshot { match: { status: "IN_PLAY" } }
                             │
                             ├─ writeKVSnapshot: isLiveStatus("IN_PLAY") = true → SKIPPED ✅
                             └─ writeDRSnapshot: isLiveStatus("IN_PLAY") = true → SKIPPED ✅
```

With normalization at the FD boundary, `"LIVE"` never reaches `isLiveStatus()`, `getSnapshotTtlSec()`, `STATE_RANK`, `StatusPill`, `BracketMatchCard`, the authority cache filter, or any other downstream consumer. All existing guards work correctly without modification.

---

## 9. RISK MATRIX

| Provider | Gap | Severity | Blast Radius | Fix Location |
|----------|-----|----------|-------------|-------------|
| football-data.org | No status normalization; `"LIVE"` confirmed, `"AWARDED"` likely | CRITICAL | DR snapshot (30d), SWR cache (7d) | `football-data.ts` — each `get*` method |
| football-data.org | No unknown-value guard | HIGH | Any future FD API addition | `normalizeFDStatus()` fallback |
| api-football | `WO → FINISHED` (imprecise) | LOW | Score display, badge for walkover matches | `AF_STATUS_MAP` |
| api-football | Unknown codes → `'SCHEDULED'` (wrong fallback) | MEDIUM | Phantom upcoming matches | `normalizeAFStatus()` fallback change |
| ESPN | None | — | N/A | N/A |
| ProviderManager | No normalization (by design) | — | N/A — correct design | N/A |

---

## 10. IMPLEMENTATION CHECKLIST (architecture only — do not implement)

```
[ ] Create src/lib/providers/normalize-status.ts
    [ ] normalizeFDStatus(raw): MatchStatus
    [ ] normalizeAFStatus(short): MatchStatus
    [ ] normalizeFDMatches(Match[]): Match[]
    [ ] normalizeFDMatchDetail(MatchDetail): MatchDetail
    [ ] FD_ALIASES: { "LIVE" → "IN_PLAY", "AWARDED" → "AWARDED" }
    [ ] AF_STATUS_MAP: all current STATUS_MAP codes + AWD, WO→AWARDED
    [ ] CANONICAL set for pass-through check
    [ ] Unknown-value warning + SUSPENDED fallback (both providers)

[ ] Update src/lib/providers/football-data.ts
    [ ] Import normalizeFDMatchDetail, normalizeFDMatches
    [ ] getMatch: return normalizeFDMatchDetail(await fetchRaw(...))
    [ ] getFixtures: return { ...result, matches: normalizeFDMatches(result.matches) }
    [ ] getResults: same pattern
    [ ] getLiveMatches: same pattern
    [ ] getAllMatches: same pattern
    [ ] getTodayMatches: same pattern
    [ ] getTeamMatches: same pattern

[ ] Update src/lib/providers/api-football.ts
    [ ] Import normalizeAFStatus
    [ ] Replace STATUS_MAP + mapStatus() with normalizeAFStatus()
    [ ] Remove local STATUS_MAP constant

[ ] Add AWARDED to src/lib/types.ts MatchStatus type

[ ] Update STATE_RANK in src/lib/match-state-overlay.ts
    [ ] AWARDED: 3 (same rank as FINISHED — terminal, cannot be demoted)

[ ] Update canonical-match.ts deriveState()
    [ ] AWARDED → state: 'finished'

[ ] Update classifyMatchState() in src/lib/match-classify.ts
    [ ] AWARDED → bucket 'finished' (or 'other')

[ ] Purge existing poisoned KV keys for match 537412
    [ ] kv.del('goalradar:/matches/537412')
    [ ] kv.del('goalradar:dr:/matches/537412')
    [ ] kv.del('goalradar:match:537412')
    [ ] kv.del('goalradar:dr:match:537412')

[ ] Write unit tests for normalize-status.ts
    [ ] All canonical values pass through unchanged
    [ ] "LIVE" → "IN_PLAY"
    [ ] "AWARDED" → "AWARDED"
    [ ] Unknown → "SUSPENDED" + console.warn
```

---

**Gate: DO_NOT_IMPLEMENT — architecture complete, awaiting approval.**
