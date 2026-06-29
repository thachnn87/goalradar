# LIVE-3A Minute Indicator Authority Audit
## GoalRadar · Sprint LIVE-3A

Generated: 2026-06-15

---

## Task

Determine whether any live match minute / match clock field exists in raw provider
API payloads, and if so, whether it survives the mapper and reaches the live cache.

Audit scope: `getLiveMatches()`, `getMatchDetail()`, `readKVLiveMatches()`.

---

## Findings

### 1. Internal `Match` type — `src/lib/types.ts`

```typescript
interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null;
  lastUpdated: string;
  competition: Competition;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
}
```

**Result: NO `minute` field.** `MatchDetail extends Match` also has no `minute` field.
`Goal`, `Booking`, `Substitution` each have `minute: number` — these are event timestamps
(minute the event occurred), not a live clock.

---

### 2. football-data.org v4 (PRIMARY provider) — `src/lib/providers/football-data.ts`

**`getLiveMatches()`:**
```typescript
getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchRaw('/matches?status=IN_PLAY,PAUSED');
}
```

`fetchRaw` does:
```typescript
if (res.ok) return res.json() as Promise<T>;
```

**There is no mapper.** The raw API JSON is cast directly to `{ matches: Match[] }`.

The football-data.org v4 API returns `minute: number` in every match object when
the match is IN_PLAY or PAUSED:

```json
{
  "id": 537358,
  "utcDate": "2026-06-15T16:00:00Z",
  "status": "IN_PLAY",
  "minute": 47,
  "score": { ... },
  ...
}
```

Because there is no mapper, this `minute` field:
- IS present on the returned JavaScript object at runtime
- TypeScript does NOT know about it (the type `Match` has no `minute` field)
- survives JSON serialisation into `goalradar:live:matches` via `kvSet`
- survives `kvGet` / `readKVLiveMatches()` JSON round-trip

**Accessing `(match as any).minute` on a football-data.org live match object returns
the current match minute.**

**`getMatch(id)`:**
```typescript
getMatch(id: number): Promise<MatchDetail> {
  return fetchRaw(`/matches/${id}`);
}
```

Same no-mapper pattern. The per-match detail response also contains `minute` at
runtime. The `MatchDetail` object returned has `minute` as an untyped extra property.

---

### 3. api-football (SECONDARY / failover provider) — `src/lib/providers/api-football.ts`

**`AFFixtureStatus` type:**
```typescript
interface AFFixtureStatus { short: string; long: string; elapsed: number | null }
```

`elapsed` is the live clock minute. For a match at 67', `elapsed = 67`.

**`normaliseMatch()` mapper:**
```typescript
function normaliseMatch(item: AFFixtureItem): Match {
  const { group, stage, matchday } = parseRound(item.league.round ?? '');
  return {
    id:          item.fixture.id,
    utcDate:     item.fixture.date,
    status:      mapStatus(item.fixture.status.short),
    matchday,
    stage,
    group,
    lastUpdated: item.fixture.date,
    competition: normaliseCompetition(item.league),
    homeTeam:    normaliseTeam(item.teams.home),
    awayTeam:    normaliseTeam(item.teams.away),
    score:       normaliseScore(item.goals, item.score),
  };
}
```

`item.fixture.status.elapsed` is **silently dropped**. No `minute` in output.

**`getLiveMatches()`:**
```typescript
async getLiveMatches(): Promise<{ matches: Match[] }> {
  const res = await fetchRaw<AFFixtureItem[]>('/fixtures?live=all');
  return { matches: (res.response as AFFixtureItem[]).map(normaliseMatch) };
}
```

**Result:** `elapsed` exists in the raw api-football response and is typed in the
`AFFixtureStatus` interface, but `normaliseMatch()` does not include it. When
api-football is the active provider (failover), live matches in KV will have no
`minute` field.

---

### 4. Live cache (`goalradar:live:matches`) — `src/lib/live-cache.ts`

`refreshLiveMatches()` (called by the orchestrator cron) calls
`getLiveMatches()` → `providerManager.getLiveMatches()` → `FootballDataProvider.getLiveMatches()`
(primary) or `ApiFootballProvider.getLiveMatches()` (failover).

The KV write is a plain `JSON.stringify` of the match array. The KV read is
`JSON.parse`. No field stripping at this layer.

**When primary (football-data.org) is active:**
- KV stores match objects with `minute` present (extra runtime field)
- `readKVLiveMatches()` returns objects with `minute` at runtime
- `(match as any).minute` is reliable

**When secondary (api-football) is active (failover):**
- `normaliseMatch()` strips `elapsed`
- KV stores match objects with NO `minute`
- `(match as any).minute` is `undefined`

---

### 5. `getMatchDetail()` path — `src/lib/match-snapshot.ts`

`buildSnapshot()` → `readMatchDetailFromKV(matchId)` reads from `goalradar:/matches/{id}`.
This KV key is populated by `withKVCache(() => getMatchDetail(matchId))` which calls
`FootballDataProvider.getMatch()` (primary, no mapper). So the per-match detail KV
object also has `minute` at runtime when the primary is active.

However, the LIVE-2 overlay in `buildSnapshot()` already replaces `match.score` and
`match.status` from `readKVLiveMatches()`. Minute should be sourced from the same
live cache object for consistency.

---

## Authority Rule (post-audit)

```
minute source priority:
  1. live-cache match object  (match as any).minute         — football-data.org primary only
  2. per-match detail object  (detail as any).minute        — same, fallback
  3. api-football elapsed     item.fixture.status.elapsed   — secondary, NOT yet mapped
  4. derived from utcDate     elapsed = now - kickoff       — last resort, imprecise
  5. null                                                   — no minute shown
```

For the UI, minute should be read from the live cache match object (step 1). This
is the same object used by `MatchLiveZone` via `/api/live-score`. No derivation
needed when primary is active.

---

## Fields available per provider

| Field | football-data.org v4 | api-football |
|-------|----------------------|--------------|
| `minute` (live clock) | ✅ present in raw JSON, no mapper drops it | ❌ `elapsed` dropped by `normaliseMatch()` |
| `score.fullTime` | ✅ | ✅ mapped |
| `status` | ✅ | ✅ mapped |
| `goals[]` (events) | ✅ in `MatchDetail` only | ✅ in `normaliseMatchDetail()` |
| scorer names | ✅ in `MatchDetail.goals[].scorer.name` | ✅ in `normaliseMatchDetail()` |

---

## Implementation plan (if approved)

### Step 1 — Add `minute` to `Match` type (`src/lib/types.ts`)

```typescript
interface Match {
  ...
  minute?: number | null;   // live clock minute; only present for IN_PLAY/PAUSED
}
```

### Step 2 — api-football mapper (`src/lib/providers/api-football.ts`)

In `normaliseMatch()`, add:
```typescript
minute: item.fixture.status.elapsed ?? null,
```

This surfaces `elapsed` for all matches (null for non-live). Consistent with
football-data.org which also emits `null` / omits the field for non-live matches.

### Step 3 — `/api/live-score` endpoint

Include `minute` in the response body:
```typescript
return NextResponse.json({
  matchId: ...,
  status: ...,
  score: ...,
  minute: (liveMatch as Match).minute ?? null,
  source: 'kv-live',
});
```

### Step 4 — `MatchLiveZone` client component

Add `minute` state. Display logic:
```
status=PAUSED          → "HT"
status=IN_PLAY, ≤45    → `LIVE ${minute}'`
status=IN_PLAY, >45, ≤90, no injuryTime → `LIVE ${minute}'`
injuryTime field (not yet typed)         → `LIVE 45+2'` etc.
status=FINISHED        → "FT"
```

Injury time: football-data.org v4 does NOT return `minuteOfFirstHalfEnd` etc. in
the live clock. The `minute` value for stoppage time increments naturally (e.g. 47
at 45+2'). Display as `LIVE 47'` — no `+` notation without additional data.

### Step 5 — UI surfaces

- `/live` cards: add minute chip to live match cards
- `/match/[id]` ScoreHero: `MatchLiveZone` already owns the center slot; add minute display
- `/schedule` live cards: add minute chip
- WC Hub live cards: add minute chip

### Step 6 — `/api/debug/live-minute` endpoint

Returns current live matches from KV with minute field for observability.

---

## What is NOT in scope for LIVE-3A

- Scorer names / goal events in live display — see `LIVE3B_SCORERS_AUDIT.md`
- Injury time `+N` notation — requires separate field or `minuteOfFirstHalfEnd`
- api-football `elapsed` for non-live (SCHEDULED/TIMED) matches — always null anyway

---

## Confidence

**HIGH** for football-data.org: no mapper means extra fields are guaranteed to
survive. The `minute` field is documented in the football-data.org v4 API and is
present in sample responses for IN_PLAY/PAUSED matches.

**HIGH** for api-football: `elapsed: number | null` is a typed field in the local
`AFFixtureStatus` interface. It exists in the raw response. The gap is only in
the mapper (`normaliseMatch` does not include it).

**MEDIUM** for live-cache minute availability: primary must be active (not in
failover) for `minute` to exist in KV. During failover windows, `minute` will be
undefined. Display logic must treat `null` / `undefined` as "minute unknown" and
fall back to no clock display (or derived estimate).
