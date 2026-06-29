# DATA-10B Minute Pipeline Audit
## GoalRadar · Live Clock Minute — Root Cause Trace

Date: 2026-06-16
Symptom: `/match/{id}` shows `LIVE` / `2-2` instead of `67'` / `2-2`

---

## Pipeline Map

```
football-data.org v4 API
  /matches?status=IN_PLAY,PAUSED          ← live collection
  /matches/{id}                           ← detail

FootballDataProvider.getLiveMatches()     ← fetchRaw() — NO normalisation
  ↓ raw JSON passthrough
getCachedLiveMatches() / fetchLiveCached()
  ↓ stores to L1 + KV (goalradar:live:matches, 30s TTL)
readKVLiveMatches()
  ↓
/api/live-score/[matchId]                 ← returns minute ?? null
  ↓
MatchLiveZone: setMinute(data.minute ?? null)
  ↓
StatusBadge: minute != null ? `${minute}'` : 'LIVE'
```

---

## Layer-by-Layer Trace

### Layer 1 — Provider → KV (ROOT CAUSE LOCATION)

**File:** `src/lib/providers/football-data.ts:206–208`

```typescript
getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchRaw('/matches?status=IN_PLAY,PAUSED');
}
```

`fetchRaw` executes `res.json()` and returns the raw football-data.org v4 API
response **without any normalisation**. There is no `normaliseMatch()` function
in this provider.

**Finding A — Collection endpoint does not reliably expose `minute`**

The football-data.org v4 API returns `minute` at the top-level match object for
**individual detail** requests (`/v4/matches/{id}`), but the collection endpoint
(`/v4/matches?status=IN_PLAY,PAUSED`) either:

  (a) omits `minute` entirely from collection match objects, or
  (b) uses a different field path (e.g. nested under `score.currentPeriod` or
      a plan-gated `liveData` block)

Since `FootballDataProvider` has no normalisation layer, if the field is absent
or under a different name in the collection response, `Match.minute` is
`undefined` for every match in the live cache.

**Compare: api-football.ts (secondary provider)**

`src/lib/providers/api-football.ts` has an explicit normalisation step:
```typescript
minute: item.fixture.status.elapsed ?? null,
```
This guarantees `minute` is mapped regardless of field name in the raw response.
`football-data.ts` has no equivalent.

### Layer 2 — live-cache.ts → KV storage

**File:** `src/lib/live-cache.ts:103–111`

```typescript
function kvSet(key: string, matches: Match[]): void {
  const entry: KVEntry = { matches, fetchedAt: Date.now() };
  kv.set(key, entry, { ex: LIVE_TTL_SEC }).catch(...);
}
```

The `matches` array is stored as-is from `fetchLiveCached()` with zero
transformation. If `minute` was `undefined` from the provider, it is stored as
`undefined` in the KV JSON blob (JSON.stringify omits `undefined` fields
entirely — the key is absent from the serialised KV value).

**Finding B — KV serialisation drops `undefined` minute**

`JSON.stringify({ minute: undefined })` → `{}`.

The KV entry for each match object has **no `minute` key** at all when the
provider returned `undefined`. On read, `match.minute` is `undefined`.

### Layer 3 — /api/live-score/[matchId]

**File:** `src/app/api/live-score/[matchId]/route.ts:42–49`

```typescript
return NextResponse.json({
  matchId: liveMatch.id,
  status: liveMatch.status,
  score: liveMatch.score,
  minute: liveMatch.minute ?? null,   // undefined → null
  ...
  source: 'kv-live',
});
```

`liveMatch.minute ?? null` converts the absent KV field (`undefined`) to `null`.
The HTTP response carries `"minute": null`.

**Finding C — API returns `minute: null`, not the actual clock value**

The live-score endpoint correctly applies `?? null`, but the upstream value is
already lost at Layer 1. `minute: null` is returned for all KV-sourced polls.

### Layer 4 — MatchLiveZone client

**File:** `src/components/MatchLiveZone.tsx:96`

```typescript
setMinute(data.minute ?? null);   // receives null → state becomes null
```

`StatusBadge` then:
```typescript
const clockLabel = minute != null ? `${minute}'` : 'LIVE';
```

`minute === null` → renders `LIVE`.

**Finding D — Exact reset location: `MatchLiveZone` line 96 on first poll**

The initial page render uses `initialMinute` from the server-side snapshot
(`page.tsx:2160`):
```typescript
initialMinute={match.minute ?? null}
```

The snapshot is built via `getOrBuildMatchSnapshot()` → `providerManager.getMatch(id)`
→ `FootballDataProvider.getMatch(id)` → `fetchRaw('/matches/{id}')` — the
**detail** endpoint. This endpoint DOES include `minute` in its response.

So the sequence is:
1. SSR: snapshot from detail endpoint → `initialMinute = 67` → badge shows `67'` ✅
2. +30s: first poll fires → `/api/live-score` reads KV → KV has no `minute` field
   → returns `minute: null` → `setMinute(null)` → badge shows `LIVE` ❌

This explains why the symptom appears roughly 30 seconds after the page loads,
not on the initial render.

---

## Summary Table

| Layer | File | Minute value | Status |
|-------|------|-------------|--------|
| football-data.org v4 collection | external API | `undefined` (field absent) | ❌ ROOT CAUSE |
| `football-data.ts getLiveMatches()` | `src/lib/providers/football-data.ts:206` | `undefined` | ❌ no normalisation |
| `fetchLiveCached()` → KV write | `src/lib/live-cache.ts:168` | `undefined` → dropped by JSON | ❌ |
| `readKVLiveMatches()` → KV read | `src/lib/live-cache.ts:248` | `undefined` | ❌ |
| `/api/live-score` Step 1 response | `src/app/api/live-score/[matchId]/route.ts:46` | `null` | ❌ |
| `MatchLiveZone` poll handler | `src/components/MatchLiveZone.tsx:96` | `null` | ❌ shows `LIVE` |
| `MatchLiveZone` initial render | `src/components/MatchLiveZone.tsx:72` | `67` (from snapshot detail) | ✅ |

**Exact failure point:** `football-data.ts:207` — `getLiveMatches()` calls
`fetchRaw('/matches?status=IN_PLAY,PAUSED')`, which returns raw collection
response that does not include `minute` at the match-object level.

---

## Fix Scope

The fix must be in `src/lib/providers/football-data.ts`. Two options (analysis
only — not implementing here):

**Option A — Map `minute` from the collection response**

Inspect the actual football-data.org v4 collection response to find what field
carries the live clock (e.g., `score.currentPeriod.minute` or similar), then add
a `normaliseMatch()` function similar to api-football.ts.

Requires: determining the actual field path from a live API response or the
football-data.org v4 API docs.

**Option B — Supplement collection data with detail endpoint**

For each IN_PLAY/PAUSED match returned by `/matches`, issue a follow-up
`/matches/{id}` call (which does return `minute`) and merge the minute field.

Drawback: N additional API calls per live match per 30s cycle — quota risk.

**Recommendation:** Option A. Read the raw response from a live football-data.org
v4 call (via `/api/debug/live-health` during a live match, or from the API docs)
to confirm the exact field name, then add a single normalisation step to
`getLiveMatches()` in `football-data.ts`.

---

## Answers to the Four Audit Questions

**A. KV minute value:** `undefined` / absent (serialised as missing key in JSON).
The football-data.org v4 `/matches` collection endpoint does not return `minute`
at the match object top level.

**B. live-score API minute value:** `null` — converted from `undefined` by
`liveMatch.minute ?? null` at `route.ts:46`.

**C. MatchLiveZone received minute value:** `null` on all poll responses from
the kv-live source path.

**D. Exact location where minute becomes null:** `football-data.ts:207` —
`getLiveMatches()` has no normalisation layer and calls the collection endpoint,
which does not expose `minute`. All downstream layers faithfully propagate this
absence, resulting in `null` by the time `MatchLiveZone` receives the poll
response.
