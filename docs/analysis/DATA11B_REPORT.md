# DATA-11B Report
## GoalRadar · api-football Post-Match Enrichment — Implementation Report

Date: 2026-06-16

---

## Summary

Implemented api-football post-match event enrichment for FINISHED WC 2026
matches. The feature is gated behind `ENABLE_AF_ENRICHMENT=true` and is
fully OFF by default. Zero changes to the live match pipeline.

---

## What Was Built

### 1. `src/lib/af-id-map.ts` — new file

Four exported functions:

| Function | Purpose | Cost |
|----------|---------|------|
| `buildMappingKey(match)` | Deterministic cross-provider key | 0 API calls |
| `resolveAfFixtureId(match)` | FD match → AF fixture ID via KV | 0 API calls (KV read) |
| `refreshAfLookupTable()` | Seed/refresh the ID map | 1 api-football call |
| `enrichMatchWithAFEvents(match)` | Apply AF events to a match | 0 (KV hit) or 2 (AF fresh) |

Also exports: `AF_ENRICHMENT_ENABLED`, `AF_LOOKUP_KV_KEY`, `AF_EVENTS_TTL_SEC`,
`afEventsKvKey()`, `CachedAFEvents` (type).

### 2. `src/lib/match-snapshot.ts` — enrichment hook

Added 8 lines to `buildSnapshot()`. The enrichment fires only when all guards
pass: flag enabled, FINISHED, WC competition, and no events already present.

```diff
+  if (
+    AF_ENRICHMENT_ENABLED &&
+    match.status === 'FINISHED' &&
+    match.competition?.code === 'WC' &&
+    (match.goals?.length ?? 0) === 0
+  ) {
+    match = await enrichMatchWithAFEvents(match);
+  }
```

### 3. `src/app/api/debug/hybrid-enrichment/[matchId]/route.ts` — new endpoint

`GET /api/debug/hybrid-enrichment/{fdMatchId}` — inspects enrichment state for
a match without triggering enrichment. Reports lookup table, events cache,
snapshot goal/booking/sub counts, and resolved AF fixture ID.

### 4. `src/app/api/debug/hybrid-enrichment/refresh-lookup/route.ts` — new endpoint

`POST /api/debug/hybrid-enrichment/refresh-lookup` — seeds the AF lookup table.
Must be called once with `API_FOOTBALL_KEY` set before enrichment can work.

### 5. `.env.local.example` — updated

Added `ENABLE_AF_ENRICHMENT=true` (commented out) with documentation.

---

## Architecture

```
Page request → getOrBuildMatchSnapshot(matchId)
                    │
                    ├── KV snapshot hit (goalradar:match:{id}) → serve directly
                    │   (enriched data is already in the snapshot)
                    │
                    └── KV snapshot miss → buildSnapshot()
                              │
                              ├── 1. FD provider: getMatchDetail(matchId)
                              │      → match.goals = []  (FD free tier)
                              │
                              ├── 2. AF enrichment (if FINISHED + WC + flag)
                              │      ├── kv.get(af:events:{id})  → HIT → apply
                              │      └── KV miss:
                              │           ├── resolveAfFixtureId()
                              │           ├── ApiFootballProvider.getMatch(afId)
                              │           └── kv.set(af:events:{id}, 7d TTL)
                              │
                              ├── 3. LIVE overlay (IN_PLAY/PAUSED only — skipped)
                              │
                              └── 4. assembleSnapshot() → write to goalradar:match:{id}
```

---

## KV Layout

```
goalradar:af:lookup:WC:2026   (24h TTL)
  Record<normalised-key, af-fixture-id>
  Example: {"sweden|tunisia|2026-06-15T02:00Z": 868512, ...}
  Size: ~104 entries, ~8 KB

goalradar:af:events:{fd-id}   (7-day TTL)
  CachedAFEvents {
    goals: Goal[],
    bookings: Booking[],
    substitutions: Substitution[],
    venue: string | null,
    afFixtureId: number,
    enrichedAt: number
  }
  Written once per match; read on every snapshot rebuild
```

---

## Request Cost Analysis

| Operation | api-football calls | When |
|-----------|-------------------|------|
| Seed lookup table | 1 | Once (+ daily refresh) |
| First enrichment of a match | 2 | On first post-match snapshot build |
| Subsequent enrichment (KV hit) | 0 | Every other snapshot build |
| Total per WC tournament (104 matches) | 1 + (104 × 2) = **209** | Over 39 days |
| Average per active matchday (12 matches) | 12 × 2 = **24** | First time only |

**Free tier (100 req/day):**
- Peak matchday first-time enrichment: 24 req < 100 ✅
- After first enrichment: 0 req (KV cached) ✅
- Daily lookup refresh: 1 req ✅

---

## Verification Procedure

The three requested matches (all FINISHED, all with goals):

| Match | FD ID | FT score | Expected goals |
|-------|-------|----------|----------------|
| Sweden vs Tunisia | 537358 | 5-1 | 6 goal events |
| Iran vs New Zealand | 537364 | 2-2 | 4 goal events |
| Ivory Coast vs Ecuador | 537352 | 1-0 | 1 goal event |

### Step 1: Set API_FOOTBALL_KEY in Vercel env

Requires a free api-football account at https://dashboard.api-football.com

### Step 2: Set ENABLE_AF_ENRICHMENT=true in Vercel env

### Step 3: Seed lookup table

```bash
curl -X POST "https://goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
```

Expected:
```json
{ "ok": true, "count": 104, "collisions": [], "refreshedAt": "2026-06-16T..." }
```

### Step 4: Invalidate snapshots to force rebuild with enrichment

```bash
for id in 537358 537364 537352; do
  curl -X POST "https://goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
  echo "invalidated $id"
done
```

### Step 5: Verify enrichment state

```bash
curl "https://goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET"
```

Expected response:
```json
{
  "fdMatchId": "537358",
  "enrichmentEnabled": true,
  "lookupTablePresent": true,
  "lookupTableEntries": 104,
  "mappingKey": "sweden|tunisia|2026-06-15T02:00Z",
  "afFixtureId": <non-null>,
  "eventsCachePresent": true,
  "snapshotGoalsCount": 6,
  "snapshotBookingsCount": <non-null>,
  "snapshotSubsCount": <non-null>,
  "enrichmentApplied": true,
  "source": "kv-cache"
}
```

### Step 6: Verify GoalScorers renders real names

Open `https://goalradar.org/match/537358` (Sweden vs Tunisia).

Expected: `GoalScorers` component shows real scorer names and minutes, e.g.:
```
⚽  Isak  23'
⚽  Forsberg  37'  (pen)
...
```

If `snapshotGoalsCount: 0` — enrichment did not fire. Check:
- `enrichmentEnabled: true` (both flag and key configured)
- `lookupTablePresent: true` with `afFixtureId: <non-null>` (lookup table seeded)
- `source` field for diagnosis

---

## Alias Verification Needed

Three team name aliases were added defensively based on known api-football v3
naming conventions. Once `API_FOOTBALL_KEY` is set and `refreshAfLookupTable()`
is called, confirm the following matches appear in the lookup table:

| FD name | Expected canonical key | Match to check |
|---------|----------------------|----------------|
| Czechia (FD) vs South Korea | `czechia→czech republic` | 537328 |
| Canada vs Bosnia-Herzegovina | `bosnia-herzegovina→bosnia` | 537333 |
| Spain vs Cape Verde Islands | `cape verde islands→cape verde` | 537369 |

Check with:
```bash
curl "https://goalradar.org/api/debug/hybrid-enrichment/537328?secret=$CRON_SECRET"
# → "mappingKey": "south korea|czech republic|2026-06-12T02:00Z"
# → "afFixtureId": <non-null>  ← confirms alias worked
```

If `afFixtureId: null` for these matches, add the missing alias to
`CANONICAL_ALIASES` in `src/lib/af-id-map.ts` and re-seed the lookup table.

---

## TypeScript

```
npx tsc --noEmit  →  0 errors
```

---

## Constraints Respected

| Constraint | Status |
|-----------|--------|
| Do not touch live match flow | ✅ Live path unchanged |
| Do not increase live provider traffic | ✅ Enrichment only fires for FINISHED |
| Feature flag must fully disable enrichment when false | ✅ `AF_ENRICHMENT_ENABLED` gates all enrichment paths |
| Cache events for 7 days | ✅ `goalradar:af:events:{id}` with `ex: 7*24*3600` |
| Debug endpoint returns required fields | ✅ All 8 fields present |
| TypeScript clean | ✅ 0 errors |
