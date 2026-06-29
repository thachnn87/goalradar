# DATA-11B Audit
## GoalRadar · api-football Post-Match Enrichment — Pre-Ship Audit

Date: 2026-06-16

---

## Files Created / Modified

| File | Type | Description |
|------|------|-------------|
| `src/lib/af-id-map.ts` | NEW | ID mapping, lookup table builder, enrichment function |
| `src/lib/match-snapshot.ts` | MODIFIED | Added enrichment call in `buildSnapshot()` |
| `src/app/api/debug/hybrid-enrichment/[matchId]/route.ts` | NEW | Enrichment state inspector |
| `src/app/api/debug/hybrid-enrichment/refresh-lookup/route.ts` | NEW | Lookup table builder endpoint |
| `.env.local.example` | MODIFIED | Added `ENABLE_AF_ENRICHMENT` documentation |

---

## 1. af-id-map.ts — Function Audit

### `buildMappingKey(match)`

```typescript
export function buildMappingKey(
  match: Pick<Match, 'homeTeam' | 'awayTeam' | 'utcDate'>,
): string
```

**Logic:** `lower(homeTeam) + '|' + lower(awayTeam) + '|' + utcDate[:16] + 'Z'`

- Diacritics stripped via `normalize('NFD').replace(/[̀-ͯ]/g, '')`
- `CANONICAL_ALIASES` resolves known FD/AF divergences
- UTC truncated to minute — handles sub-second timestamp differences between providers
- Pure function: no I/O, no side effects

**Alias table:**

| FD name | Canonical | Reason |
|---------|-----------|--------|
| `czechia` | `czech republic` | FD uses FIFA abbreviation; AF uses full name |
| `bosnia-herzegovina` | `bosnia` | AF shortens hyphenated names |
| `cape verde islands` | `cape verde` | AF drops "Islands" suffix |
| `korea republic` | `south korea` | Defensive — AF may use FIFA code name |
| `cote d'ivoire` | `ivory coast` | Defensive — AF may use French name |

**Collision property:** Within a WC tournament, `(homeTeam + awayTeam + kickoffUTC)` is guaranteed unique — confirmed zero collisions in 20-match sample (DATA11A §4). Rescheduled matches invalidate the 24h TTL naturally.

---

### `resolveAfFixtureId(match)`

```typescript
export async function resolveAfFixtureId(
  match: Pick<Match, 'homeTeam' | 'awayTeam' | 'utcDate'>,
): Promise<number | null>
```

- Reads `goalradar:af:lookup:WC:2026` from KV
- Returns `null` and logs warning on: KV disabled, table absent, key miss
- Never throws — all errors return `null`

**Guard checks in order:**
1. `KV_ENABLED` — false → null immediately
2. KV read success — exception → null + error log
3. Table present — missing → null + warning log
4. Key found — miss → null + warning log (signals alias gap)

---

### `refreshAfLookupTable()`

```typescript
export async function refreshAfLookupTable(): Promise<LookupTableResult>
```

- Calls `ApiFootballProvider.getAllMatches('WC')` — 1 api-football request
- Builds `Record<string, number>` (normalised-key → AF fixture ID)
- Detects and logs collisions (expected: 0)
- Writes to `goalradar:af:lookup:WC:2026` with 24h TTL
- Throws if KV or `API_FOOTBALL_KEY` not configured

**Cost: 1 api-football API call.** Run once at tournament start + daily thereafter.

---

### `enrichMatchWithAFEvents(match)`

```typescript
export async function enrichMatchWithAFEvents(match: MatchDetail): Promise<MatchDetail>
```

**Flow:**

```
1. kv.get('goalradar:af:events:{fdId}')
   ├── HIT  → applyEvents(match, cached) — 0 API calls
   └── MISS ↓

2. resolveAfFixtureId(match)
   ├── null → return match unchanged (lookup miss)
   └── afId ↓

3. ApiFootballProvider.getMatch(afId)         — 2 api-football API calls
   ├── throws → return match unchanged (best-effort)
   └── afDetail ↓

4. kv.set('goalradar:af:events:{fdId}', events, { ex: 7d })  — fire-and-forget
5. return applyEvents(match, events)
```

**`applyEvents()` merge rules:**
- `goals` — always replaced with AF data (FD free tier always returns `[]`)
- `bookings` — always replaced
- `substitutions` — always replaced
- `venue` — FD value takes priority (`match.venue ?? events.venue`); FD free tier returns `null`

**Error isolation:** all errors are caught; original `match` returned unchanged on any failure. Snapshot always writes.

---

## 2. match-snapshot.ts — Enrichment Call Audit

**Location:** `buildSnapshot()`, after match detail fetch, before LIVE overlay.

```typescript
if (
  AF_ENRICHMENT_ENABLED &&
  match.status === 'FINISHED' &&
  match.competition?.code === 'WC' &&
  (match.goals?.length ?? 0) === 0
) {
  match = await enrichMatchWithAFEvents(match);
}
```

**Guard analysis:**

| Guard | Purpose |
|-------|---------|
| `AF_ENRICHMENT_ENABLED` | Feature flag — `ENABLE_AF_ENRICHMENT=true` + key + KV configured |
| `match.status === 'FINISHED'` | Only enrich completed matches — live flow untouched |
| `match.competition?.code === 'WC'` | WC-only — preserves AF quota for tournament |
| `goals.length === 0` | Skip if FD already supplied events (future Tier 2 upgrade safe) |

**No live match impact:** The guard explicitly rejects `IN_PLAY` and `PAUSED`. The live code path (`readKVLiveMatches`, Step 1/2/3 of `/api/live-score`) is not touched.

**Snapshot write-through:** `getOrBuildMatchSnapshot` writes the snapshot (including enriched events) to `goalradar:match:{id}` with 7-day TTL for FINISHED matches. Subsequent requests are served from the snapshot — enrichment fires only once per snapshot lifecycle.

---

## 3. Debug Endpoint Audit

### `GET /api/debug/hybrid-enrichment/[matchId]`

**Auth:** CRON_SECRET or `NODE_ENV=development`

**Returns:**

```json
{
  "fdMatchId": "537358",
  "checkedAt": "2026-06-16T17:00:00.000Z",
  "enrichmentEnabled": true,
  "apiFootballKeySet": true,
  "kvEnabled": true,
  "lookupTablePresent": true,
  "lookupTableEntries": 104,
  "mappingKey": "sweden|tunisia|2026-06-15T02:00Z",
  "afFixtureId": 868512,
  "eventsCachePresent": true,
  "eventsCacheAgeSeconds": 3600,
  "snapshotStatus": "FINISHED",
  "snapshotGoalsCount": 6,
  "snapshotBookingsCount": 2,
  "snapshotSubsCount": 8,
  "eventsGoalsCount": 6,
  "eventsBookingsCount": 2,
  "eventsSubsCount": 8,
  "enrichmentApplied": true,
  "source": "kv-cache"
}
```

**`source` values:**

| Value | Meaning |
|-------|---------|
| `kv-cache` | Events found in `goalradar:af:events:{id}` |
| `api-football-fresh` | Lookup table present but events not yet cached (would fetch on next snapshot build) |
| `lookup-miss` | Lookup table present but no entry for this match |
| `not-enabled` | `ENABLE_AF_ENRICHMENT` is false or key/KV not configured |
| `not-finished` | Match is not FINISHED — enrichment not applicable |

### `POST /api/debug/hybrid-enrichment/refresh-lookup`

**Auth:** same as above

**Effect:** Calls `refreshAfLookupTable()`. Returns count, key, and any collision list.

---

## 4. KV Key Inventory

| Key | TTL | Written by | Read by |
|-----|-----|------------|---------|
| `goalradar:af:lookup:WC:2026` | 24h | `refreshAfLookupTable()` via POST endpoint | `resolveAfFixtureId()` |
| `goalradar:af:events:{fd-id}` | 7 days | `enrichMatchWithAFEvents()` | same function (cache check) + debug endpoint |

No existing KV keys are modified. The enrichment writes to two new namespaces.

---

## 5. Feature Flag Behaviour

| `ENABLE_AF_ENRICHMENT` | `API_FOOTBALL_KEY` | `KV` | Enrichment fires? |
|------------------------|-------------------|------|-------------------|
| `true` | set | configured | ✅ YES |
| `true` | set | not configured | ❌ NO |
| `true` | not set | configured | ❌ NO |
| `false` | set | configured | ❌ NO |
| absent | set | configured | ❌ NO (defaults OFF) |

`AF_ENRICHMENT_ENABLED` is evaluated once at module load — no runtime overhead when disabled.

---

## 6. Live Match Flow — Confirmed Untouched

The enrichment guard `match.status === 'FINISHED'` ensures no enrichment call is made for live matches.

Additional isolation:
- `buildSnapshot()` checks LIVE overlay AFTER enrichment — the live overlay can't overwrite enriched events
- Live score pipeline (`/api/live-score`, `readKVLiveMatches`, cron) is not imported or modified
- `goalradar:live:matches` KV key is not read or written by any new code
- `api-football` provider instantiation in `enrichMatchWithAFEvents` is independent of `providerManager` — no failover stats affected

---

## 7. TypeScript

```
npx tsc --noEmit
→ 0 errors
```

All new files compile clean. No `any` casts introduced.

---

## 8. Pre-Activation Checklist

Before setting `ENABLE_AF_ENRICHMENT=true` in Vercel:

1. [ ] `API_FOOTBALL_KEY` added to Vercel environment variables
2. [ ] Lookup table seeded:
   ```
   curl -X POST "https://goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
   ```
   Expected: `{"ok":true,"count":104,"collisions":[]}`
3. [ ] Verify lookup table contains Sweden vs Tunisia match:
   ```
   curl "https://goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET"
   ```
   Expected: `"lookupTablePresent":true`, `"afFixtureId":<non-null number>`
4. [ ] Invalidate existing snapshot to force rebuild with enrichment:
   ```
   curl -X POST "https://goalradar.org/api/revalidate/match/537358?secret=$CRON_SECRET"
   ```
5. [ ] Verify enrichment applied:
   ```
   curl "https://goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET"
   ```
   Expected: `"enrichmentApplied":true`, `"snapshotGoalsCount":6`
6. [ ] Check match page renders scorer names: `https://goalradar.org/match/537358`
