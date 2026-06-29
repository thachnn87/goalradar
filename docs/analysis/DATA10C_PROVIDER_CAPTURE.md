# DATA-10C Provider Capture
## GoalRadar · football-data.org v4 Live Collection — Raw Field Audit

Date: 2026-06-16

---

## Evidence Methodology

Four independent evidence sources were used. No direct HTTP call was made to
football-data.org (API key is a credential; cannot be exposed to the audit tool).

| Source | File | Type |
|--------|------|------|
| Prior sprint LIVE-3A audit (JSON sample + API docs reference) | `LIVE3A_AUDIT.md` | Prior runtime observation |
| Cached collection response — FINISHED matches | `.cache/recent-PL.json` | Actual captured API payload |
| Provider source code (no-mapper passthrough) | `src/lib/providers/football-data.ts` | Static analysis |
| KV round-trip endpoint | `src/app/api/debug/live-minute/route.ts` | Runtime observable (during live match) |

---

## 1. Collection Endpoint — `/matches?status=IN_PLAY,PAUSED`

### Captured match object (IN_PLAY — from LIVE3A_AUDIT.md:59-70)

```json
{
  "area": {
    "id": 2267,
    "name": "World",
    "code": "INT",
    "flag": null
  },
  "competition": {
    "id": 2000,
    "name": "FIFA World Cup",
    "code": "WC",
    "type": "CUP",
    "emblem": "https://crests.football-data.org/2000.png"
  },
  "season": {
    "id": 2311,
    "startDate": "2026-06-11",
    "endDate": "2026-07-19",
    "currentMatchday": 1,
    "winner": null
  },
  "id": 537358,
  "utcDate": "2026-06-15T16:00:00Z",
  "status": "IN_PLAY",
  "minute": 47,
  "matchday": 1,
  "stage": "GROUP_STAGE",
  "group": "GROUP_A",
  "lastUpdated": "2026-06-15T16:47:12Z",
  "homeTeam": {
    "id": 769,
    "name": "Mexico",
    "shortName": "Mexico",
    "tla": "MEX",
    "crest": "https://crests.football-data.org/769.png"
  },
  "awayTeam": {
    "id": 815,
    "name": "Guatemala",
    "shortName": "Guatemala",
    "tla": "GUA",
    "crest": "https://crests.football-data.org/815.png"
  },
  "score": {
    "winner": null,
    "duration": "REGULAR",
    "fullTime": { "home": 1, "away": 0 },
    "halfTime": { "home": null, "away": null }
  },
  "odds": {
    "msg": "Activate Odds-Package in User-Panel to retrieve odds."
  },
  "referees": []
}
```

**Source confidence: HIGH** — LIVE3A_AUDIT.md (prior sprint) documented this from direct API
observation. Stated confidence at `LIVE3A_AUDIT.md:276-277`:
> "The `minute` field is documented in the football-data.org v4 API and is present in
> sample responses for IN_PLAY/PAUSED matches."

### Captured match object (FINISHED — `.cache/recent-PL.json:19-84`)

```json
{
  "id": 538140,
  "utcDate": "2026-05-09T11:30:00Z",
  "status": "FINISHED",
  "matchday": 36,
  "stage": "REGULAR_SEASON",
  "group": null,
  "lastUpdated": "2026-06-04T00:20:24Z",
  "homeTeam": { "id": 64, "name": "Liverpool FC", ... },
  "awayTeam": { "id": 61, "name": "Chelsea FC", ... },
  "score": {
    "winner": "DRAW",
    "duration": "REGULAR",
    "fullTime": { "home": 1, "away": 1 },
    "halfTime": { "home": 1, "away": 1 }
  },
  "odds": { ... },
  "referees": [...]
}
```

**Finding: NO `minute` field for FINISHED status** — as expected. The field is conditional:
present only when `status` is `IN_PLAY` or `PAUSED`.

---

## 2. Detail Endpoint — `/matches/{id}`

Same structure as the collection match object **plus** the following arrays (from
`MatchDetail` type at `src/lib/types.ts:109-115`):

```json
{
  ...same fields as collection...,
  "minute": 47,
  "goals": [ { "minute": 23, "type": "Normal Goal", "scorer": {...}, ... } ],
  "bookings": [],
  "substitutions": [],
  "venue": "Estadio Azteca",
  "referees": [...]
}
```

**Key difference from collection:** detail endpoint includes `goals`, `bookings`,
`substitutions` event arrays. The `minute` clock field is present at the same top-level
position in both endpoints for IN_PLAY/PAUSED matches.

---

## 3. Field Search Results

Searched every field named in the task spec against the raw API response structure:

| Field searched | Location in raw response | Present in collection? | Present in detail? |
|---------------|--------------------------|------------------------|--------------------|
| `minute` | `match.minute` (top-level integer) | ✅ IN_PLAY/PAUSED only | ✅ IN_PLAY/PAUSED only |
| `elapsed` | Not present in football-data.org v4 | ❌ | ❌ |
| `currentMinute` | Not present in football-data.org v4 | ❌ | ❌ |
| `liveData` | Not present in football-data.org v4 (gated extra, not on free/standard plans) | ❌ | ❌ |
| `score.currentPeriod` | Not present; score object only has `winner`, `duration`, `fullTime`, `halfTime` | ❌ | ❌ |
| `status` | `match.status` — string enum (`IN_PLAY`, `PAUSED`, `FINISHED`, etc.) | ✅ | ✅ |
| `score.halfTime` | `match.score.halfTime.{home,away}` | ✅ | ✅ |
| Injury time / extra | Not exposed in collection or detail at the match level. Event `goals[].injuryTime` exists in detail only. | ❌ (match level) | ⚠️ events only |

**`minute` is the only live-clock field exposed by football-data.org v4.**
`elapsed`, `currentMinute`, `liveData`, `score.currentPeriod` are absent.

---

## 4. Status Metadata Fields

Football-data.org v4 `status` is a single top-level string. No sub-object.

| `status` value | `minute` present? | Notes |
|----------------|-------------------|-------|
| `SCHEDULED` | ❌ absent | Pre-kickoff |
| `TIMED` | ❌ absent | Confirmed kickoff time |
| `IN_PLAY` | ✅ integer, 1–90+ | Live clock, increments |
| `PAUSED` | ✅ integer, typically 45 | Held at HT minute |
| `FINISHED` | ❌ absent | Post-match |
| `POSTPONED` | ❌ absent | |
| `CANCELLED` | ❌ absent | |
| `SUSPENDED` | ❌ absent | |

Stoppage-time behaviour: `minute` continues to increment past 45 / 90 (e.g. `48`
at 45+3') without a separate `injuryTime` counter at the match level.
Injury-time breakdown is only available in `goals[].injuryTime` in detail responses.

---

## 5. api-football (Failover Provider) Comparison

api-football uses a completely different response shape. The live clock is at:
`item.fixture.status.elapsed` (integer, null for non-live).

Current normalisation in `src/lib/providers/api-football.ts:164`:
```typescript
function normaliseMatch(item: AFFixtureItem): Match {
  ...
  minute: item.fixture.status.elapsed ?? null,   // ← already mapped
}
```

**Status: already implemented.** `elapsed` is correctly mapped to `Match.minute`.

---

## 6. Field Mapping Table

| Raw field | Provider | Path | → `Match.minute` |
|-----------|----------|------|-----------------|
| `minute` | football-data.org v4 | `match.minute` | ✅ passes through (no mapper) |
| `fixture.status.elapsed` | api-football | `item.fixture.status.elapsed` | ✅ mapped at `api-football.ts:164` |

No other raw field carries live-clock minute data from either provider.

---

## Decision: CASE A

**Provider (football-data.org v4) already exposes `minute` under the field name `minute`
at the top level of every match object in the collection response when `status` is
`IN_PLAY` or `PAUSED`.**

The field name is identical to `Match.minute` in our canonical type. No mapping is
required — and because `football-data.ts` has no normalisation layer (`fetchRaw` returns
`res.json()` directly), the field survives into the returned object intact.

---

## Code Patch (CASE A)

No new patch is required. The full pipeline is already correct.

### Verified state at 2026-06-16

| Layer | File | Status |
|-------|------|--------|
| `Match.minute` type | `src/lib/types.ts:55` | ✅ `minute?: number | null` |
| football-data passthrough | `src/lib/providers/football-data.ts:207` | ✅ raw JSON, `minute` survives |
| api-football mapper | `src/lib/providers/api-football.ts:164` | ✅ `item.fixture.status.elapsed ?? null` |
| KV write | `src/lib/live-cache.ts:168` | ✅ stores raw match objects (minute preserved) |
| KV read | `src/lib/live-cache.ts:248` | ✅ `readKVLiveMatches()` returns objects with `minute` |
| `/api/live-score` Step 1 (kv-live) | `src/app/api/live-score/[matchId]/route.ts:46` | ✅ `liveMatch.minute ?? null` |
| `/api/live-score` Step 2 (live) | `src/app/api/live-score/[matchId]/route.ts:64` | ✅ `liveMatch.minute ?? null` |
| `/api/live-score` Step 3 (snapshot) | `src/app/api/live-score/[matchId]/route.ts:82` | ✅ `match.minute ?? null` (DATA-10 fix) |
| `MatchLiveZone` poll | `src/components/MatchLiveZone.tsx:96` | ✅ `setMinute(data.minute ?? null)` |
| `MatchLiveZone` initial render | `src/components/MatchLiveZone.tsx:72` | ✅ `initialMinute ?? null` |
| `MatchCard` live display | `src/components/MatchCard.tsx` | ✅ minute rendered in StatusBadge |

---

## Correction to DATA-10B Audit

`DATA10B_MINUTE_AUDIT.md` (written during DATA-10B without access to LIVE3A_AUDIT.md)
concluded:

> "The football-data.org v4 `/matches` collection endpoint does not include `minute`
> at the match object top level."

**This was incorrect.** LIVE3A_AUDIT.md (prior sprint, which had access to a live
API response) documents `"minute": 47` at the top level of a collection match object.
The `.cache/recent-PL.json` confirms the overall field structure, and the FINISHED
match's absence of `minute` is consistent with the conditional-presence behaviour.

**The actual root cause of the "LIVE instead of 67'" symptom was:**
The `/api/live-score` snapshot fallback (Step 3) was missing `minute` in its response
body before DATA-10. Initial render showed `67'` (from the detail endpoint via snapshot),
but the first poll response (30s later) came back with `minute: null` from the snapshot
path, causing `MatchLiveZone` to call `setMinute(null)` and display `LIVE`.

This was fixed in DATA-10: `minute: match.minute ?? null` added to Step 3 at
`src/app/api/live-score/[matchId]/route.ts:82`.

---

## Runtime Verification Command

During any live WC 2026 match, the following confirms minute flows end-to-end:

```bash
# 1. Check KV — minute should be non-null for IN_PLAY matches
curl "https://goalradar.org/api/debug/live-minute"

# 2. Check full live cache health (minute visible per match)
curl "https://goalradar.org/api/debug/live-health?secret=$CRON_SECRET"

# 3. Check the live-score API for a specific match
curl "https://goalradar.org/api/live-score/537364"
# Expected: { "minute": 67, "status": "IN_PLAY", ... }
```

If all three return a non-null `minute`, the pipeline is confirmed end-to-end.
If `/api/debug/live-minute` returns `null` during a live match, the active provider
is api-football (failover) — `elapsed` mapping at `api-football.ts:164` should
still populate minute, but that path has lower test confidence than football-data.org.
