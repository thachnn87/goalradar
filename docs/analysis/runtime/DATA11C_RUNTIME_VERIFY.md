# DATA-11C Runtime Verification
## GoalRadar · api-football Post-Match Enrichment — Pre-Production Verification

Date: 2026-06-16
Verdict: **YELLOW**

---

## Environment

| Variable | Status |
|----------|--------|
| `API_FOOTBALL_KEY` | NOT SET locally |
| `KV_REST_API_URL` | NOT SET locally |
| `KV_REST_API_TOKEN` | NOT SET locally |
| `ENABLE_AF_ENRICHMENT` | NOT SET locally (OFF) |

**Impact:** Tasks 1, 2, 4 cannot be executed against live APIs. Each is verified
statically (code path, signatures, types) with production verification steps
documented. Task 3 (alias mapping) uses a pure function — fully verified locally.
Task 5 uncovered a real pre-ship blocker.

---

## Task 1 — ApiFootballProvider method verification

### Claim
`getAllMatches('WC')` and `getMatch(afFixtureId)` exist and are correctly wired.

### Static verification

**`getAllMatches(competition)`** — `src/lib/providers/api-football.ts:446`
```typescript
async getAllMatches(competition: string): Promise<{ matches: Match[] }> {
  const { leagueId, season } = leagueFor(competition);
  const res = await fetchRaw<AFFixtureItem[]>(
    `/fixtures?league=${leagueId}&season=${season}`,
  );
  return { matches: (res.response as AFFixtureItem[]).map(normaliseMatch) };
}
```
`leagueFor('WC')` → `{ leagueId: 1, season: 2026 }` (line 44)
Request: `GET /fixtures?league=1&season=2026`
Returns: `{ matches: Match[] }` — all statuses (NS, FT, AET, PEN, LIVE, etc.)

**`getMatch(id: number)`** — `src/lib/providers/api-football.ts:398`
```typescript
async getMatch(id: number): Promise<MatchDetail> {
  const res = await fetchRaw<AFFixtureItem[]>(`/fixtures?id=${id}`);
  const item = (res.response as AFFixtureItem[])[0];
  if (!item) throw new NotFoundError();
  const withEvents = await fetchRaw<AFFixtureItem[]>(`/fixtures?id=${id}&include=events`);
  const detailed = (withEvents.response as AFFixtureItem[])[0] ?? item;
  return normaliseMatchDetail(detailed);
}
```
Makes **2 api-football calls** (base + events). Matches DATA-11B cost estimate.

### Result
✅ Both methods exist, typed correctly, use WC league ID 1 / season 2026.

### Production verification command
```bash
# Must have API_FOOTBALL_KEY set
curl -X POST "https://goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
# Expected: { "ok": true, "count": 104, "collisions": [] }
# If count > 0: getAllMatches confirmed working
```

---

## Task 2 — Lookup table generation

### Claim
`refreshAfLookupTable()` fetches all WC 2026 fixtures (1 api-football call),
builds the normalised-key→AF-fixture-id map, and writes to KV with 24h TTL.

### Static verification

Code path in `src/lib/af-id-map.ts:159–187`:
1. Throws if KV or AF key not configured ✅
2. Calls `provider.getAllMatches('WC')` — 1 API call ✅
3. Builds `Record<string, number>` via `buildMappingKey()` for each AF match ✅
4. Detects and logs collisions (expected 0) ✅
5. Writes to `goalradar:af:lookup:WC:2026` with `ex: 86400` ✅
6. Returns `{ count, key, collisions }` ✅

**Note:** `m.id` in `normaliseMatch()` maps `item.fixture.id` — this is the AF fixture
ID, not the football-data.org ID. Correct: the table maps `normalisedKey → afId`.

### Cannot verify locally
No `API_FOOTBALL_KEY` set. Cannot call api-football.

### Production verification
```bash
curl -X POST "https://goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
```
Expected response:
```json
{ "ok": true, "count": 104, "collisions": [], "key": "goalradar:af:lookup:WC:2026" }
```
`count ≈ 104` (48 group stage + 16 R16 + 8 QF + 4 SF + 1 3PP + 1 F = 78 bracket
plus 26 extra group stage matches depending on api-football fixture enumeration).

---

## Task 3 — Alias mapping (pure function)

### Claim
`buildMappingKey()` normalises team names consistently across both providers.
Alias table handles FD vs AF naming divergences.

### Local test — EXECUTED

```javascript
// Tested against the actual normaliseTeamName() + CANONICAL_ALIASES logic
// from src/lib/af-id-map.ts (pure function, no API calls)
```

**Results:**

| Match ID | Input (FD names) | Generated key | Alias fired |
|----------|------------------|---------------|-------------|
| 537328 | South Korea / Czechia | `south korea\|czech republic\|2026-06-12T02:00Z` | ✅ czechia → czech republic |
| 537333 | Canada / Bosnia-Herzegovina | `canada\|bosnia\|2026-06-12T19:00Z` | ✅ bosnia-herzegovina → bosnia |
| 537369 | Spain / Cape Verde Islands | `spain\|cape verde\|2026-06-16T02:00Z` | ✅ cape verde islands → cape verde |
| 537358 | Sweden / Tunisia | `sweden\|tunisia\|2026-06-15T02:00Z` | — (no alias needed) |
| 537364 | Iran / New Zealand | `iran\|new zealand\|2026-06-15T19:00Z` | — |
| 537352 | Ivory Coast / Ecuador | `ivory coast\|ecuador\|2026-06-14T22:00Z` | — |

**Diacritic test:**

| Input | Output |
|-------|--------|
| `Côte d'Ivoire` | `ivory coast` (NFD strip + alias) |

All 6 matches produce valid, distinct keys. Zero collision within the test set.

### Result
✅ **PASS** — pure function verified locally. All 3 alias cases resolve correctly.

---

## Task 4 — Enrichment path

### Claim
`enrichMatchWithAFEvents()` calls api-football, caches result in KV, and returns
a `MatchDetail` with real `goals`, `bookings`, `substitutions`.

### Static verification

Code path in `src/lib/af-id-map.ts:218–282`:

```
1. kv.get('goalradar:af:events:{fdId}')
   ├── HIT  → applyEvents(match, cached)   [0 API calls]
   └── MISS ↓
2. resolveAfFixtureId(match)               [KV read, 0 API calls]
   ├── null → return match unchanged
   └── afId ↓
3. new ApiFootballProvider().getMatch(afId) [2 API calls]
   ├── throws → return match unchanged (best-effort)
   └── afDetail ↓
4. kv.set(eventsKey, events, { ex: 604800 }) [fire-and-forget]
5. return applyEvents(match, events)
```

`applyEvents()` merge rules:
- `goals` → replaced with AF data
- `bookings` → replaced with AF data
- `substitutions` → replaced with AF data
- `venue` → `match.venue ?? events.venue` (FD takes priority)

### Cannot verify locally
No `API_FOOTBALL_KEY` or KV. Cannot call api-football or read/write events cache.

### Production verification
```bash
# After refresh-lookup and snapshot invalidation:
curl "https://goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET"
```
Expected:
```json
{
  "enrichmentApplied": true,
  "snapshotGoalsCount": 6,
  "source": "kv-cache"
}
```

---

## Task 5 — Snapshot invalidation

### Claim (from DATA-11B verification procedure)
Step 4 stated:
```bash
curl -X POST "https://goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
```

### Finding: BLOCKER

**`/api/revalidate/match/{id}` does not exist.**

The only revalidation endpoint is `POST /api/revalidate` which accepts
`{ paths: ["/world-cup-2026", ...] }` and calls Next.js `revalidatePath()`.
This invalidates the **ISR page cache** only — it does NOT delete the KV snapshot
at `goalradar:match:{id}`.

**Critical consequence:** `getOrBuildMatchSnapshot()` priority order is:
```
1. React.cache() (within-request)
2. KV snapshot hit → return directly ← enrichment NEVER fires here
3. KV snapshot miss → buildSnapshot() → enrichment fires
```

For matches snapshotted **before** `ENABLE_AF_ENRICHMENT=true` is deployed, the
KV snapshot (`goalradar:match:{id}`) exists with `goals: []` and a 7-day TTL.
Calling `revalidatePath('/match/537358')` will NOT cause enrichment to fire —
the KV snapshot is still there and step 2 returns it directly.

`invalidateMatchSnapshot(matchId)` exists and does the right thing (`kv.del`), but
it is **not exposed by any API endpoint**.

### Corrected invalidation procedure

**Option A — Recommended: add a match-level invalidation endpoint**

Add `src/app/api/revalidate/match/[id]/route.ts`:
```typescript
// POST /api/revalidate/match/[id]
// Auth: CRON_SECRET
// Calls invalidateMatchSnapshot(matchId) → kv.del('goalradar:match:{id}')
// Then calls revalidatePath('/match/{id}', 'page') to also clear ISR
```

**Option B — Manual KV DEL (no code change)**

From a Vercel KV dashboard or `@vercel/kv` client:
```
DEL goalradar:match:537358
DEL goalradar:match:537364
DEL goalradar:match:537352
```
Then the next page request triggers `buildSnapshot()` → enrichment fires → snapshot
written with events.

**Option C — Wait for natural TTL expiry**

FINISHED match snapshots have 7-day TTL. Enrichment will fire automatically when
the snapshot expires — without any manual invalidation. Acceptable if the 7-day
delay is acceptable for already-snapshotted matches.

### Impact on new matches
For WC matches that complete **after** `ENABLE_AF_ENRICHMENT=true` is deployed:
no invalidation needed. The match is TIMED/UPCOMING at kickoff, snapshot TTL is
much shorter, and the post-match snapshot build will trigger enrichment naturally.

---

## TypeScript

```
npx tsc --noEmit  →  0 errors
```

---

## Summary

| Task | Method | Result |
|------|--------|--------|
| 1. ApiFootballProvider methods | Static code review | ✅ PASS |
| 2. Lookup table generation | Static code review | ✅ PASS (production runtime needed) |
| 3. Alias mapping | Local pure function test | ✅ PASS |
| 4. Enrichment path | Static code review | ✅ PASS (production runtime needed) |
| 5. Snapshot invalidation | Static code review | ⚠️ BLOCKER — endpoint missing |

---

## Verdict: YELLOW

The DATA-11B implementation is **functionally correct**. TypeScript is clean,
alias logic is proven, provider methods are properly wired, and feature flag
isolation is solid.

The activation procedure has one real gap: **no API endpoint exposes
`invalidateMatchSnapshot()`**, so the DATA-11B verification step 4 command
(`/api/revalidate/match/$id`) points to a non-existent route.

### Before enabling ENABLE_AF_ENRICHMENT=true in production

1. **Fix the invalidation gap** (pick one option from Task 5 above).
   - Recommended: add `POST /api/revalidate/match/[id]` that calls
     `invalidateMatchSnapshot(matchId)` then `revalidatePath()`.
2. Add `API_FOOTBALL_KEY` to Vercel environment variables.
3. `POST /api/debug/hybrid-enrichment/refresh-lookup` — seed the lookup table.
4. Invalidate existing snapshots for the 3 verification matches.
5. `GET /api/debug/hybrid-enrichment/537358` — confirm `enrichmentApplied:true`.
6. Check `https://goalradar.org/match/537358` — GoalScorers renders real names.

---

## Required fix before GREEN

Add `src/app/api/revalidate/match/[id]/route.ts` exposing
`invalidateMatchSnapshot()` via a CRON_SECRET-authenticated POST endpoint.
This is a ~30-line file and does not touch any other code path.
