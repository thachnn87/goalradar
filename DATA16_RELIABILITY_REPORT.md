# DATA-16 Reliability Report
## Snapshot Enrichment Reliability — Implementation

Date: 2026-06-17
Verdict: **GREEN** — all 6 objectives implemented; `tsc --noEmit` → 0 errors.

Constraints respected: no Team Identity activation, no Match Identity activation,
no new provider integration.

---

## Objectives

### Obj 1 — Downgrade guard in `writeKVSnapshot`

**File:** `src/lib/match-snapshot.ts`

Before writing a FINISHED snapshot with 0 goals for a scored match, `writeKVSnapshot`
now reads the disaster-recovery (DR) snapshot. If the DR snapshot has goals, it is
written to the main key instead, preserving the enriched result.

```
score=2-0, rebuilt=0 goals → check DR → DR has 2 goals → preserve DR → log DOWNGRADE-GUARD
```

Failure modes handled:
- Transient ESPN API failure during rebuild → DR rescues enriched data
- Event cache expires during snapshot TTL window → DR rescues on first rebuild
- No DR available (match never enriched before) → writes unenriched with a warn log

---

### Obj 2 — ESPN event cache TTL extended to 30 days

**File:** `src/lib/espn-id-map.ts`

```diff
- export const ESPN_EVENT_TTL_SEC  = 12 * 3600;       // 12 hours
+ export const ESPN_EVENT_TTL_SEC  = 30 * 24 * 3600; // 30 days — FINISHED events never change
```

FINISHED match events are immutable. 12h TTL was the direct root cause of the production
regression described in DATA-15C.1. 30 days matches `ESPN_LOOKUP_TTL_SEC` (positive lookup cache).

Impact: after the next successful enrichment, event caches persist through the tournament
and beyond. Snapshot rebuilds (from revalidation or TTL expiry) always find warm event caches.

---

### Obj 3 — Enrichment-health audit endpoint

**File:** `src/app/api/debug/enrichment-health/route.ts`

```
GET /api/debug/enrichment-health?secret=$CRON_SECRET
```

Scans all 18 finished WC 2026 match snapshots in parallel. Returns:

```json
{
  "checkedAt": "2026-06-17T...",
  "total": 18,
  "ok": 17,
  "unenriched": 1,
  "noSnapshot": 0,
  "matches": [
    {
      "matchId": 537346,
      "home": "AUS",
      "away": "TUR",
      "score": "2–0",
      "scoreTotal": 2,
      "goalsCount": 0,
      "snapshotAgeHours": 26.3,
      "hasLineups": false,
      "status": "unenriched"
    }
  ],
  "degradedIds": [537346]
}
```

`degradedIds` is a convenience list for the repair-enrichment cron.

---

### Obj 4 — Daily repair cron endpoint

**File:** `src/app/api/cron/repair-enrichment/route.ts`

```
GET /api/cron/repair-enrichment?secret=$CRON_SECRET
```

1. Reads all 18 WC finished match snapshots
2. Identifies matches where score > 0 and goals.length === 0 (or no snapshot)
3. For each degraded match: calls `invalidateMatchSnapshot` (clears main + event cache via DATA-14B fix) plus belt-and-suspenders `kv.del(espnEventKvKey(id))`
4. Returns a summary with succeeded/failed lists

**Wire the cron schedule** in Vercel dashboard or external scheduler:
```
Path:     /api/cron/repair-enrichment
Schedule: 0 4 * * *   (04:00 UTC daily)
```

`vercel.json` is not modified per project constraint.

---

### Obj 5 — ESPN rosters surfaced as Lineups section

**Files:** `src/lib/types.ts`, `src/lib/providers/espn.ts`, `src/lib/espn-id-map.ts`, `src/app/match/[id]/page.tsx`

**New types in `types.ts`:**
```typescript
interface LineupPlayer { id, name, position, jersey, starter, formationPlace, subbedIn, subbedOut }
interface Lineup { team: Team; players: LineupPlayer[] }
// Added to MatchDetail:
lineups?: { home: Lineup; away: Lineup } | null;
```

**ESPN provider (`providers/espn.ts`):**
- Added `EspnRosterEntry`, `EspnRoster` internal interfaces
- Added `rosters?: EspnRoster[]` to `EspnSummaryResponse`
- Added `lineups` field to `EspnMatchEvents`
- Added `parseRosters` / `parseLineups` functions
- `getEspnMatchEvents` now returns lineups from the existing summary fetch (no extra API call)

**`espn-id-map.ts`:**
- `CachedEspnEvents` now includes `lineups`
- `applyEspnEvents` now applies `lineups` to the enriched `MatchDetail`

**Page component (`page.tsx`):**
- `LineupsSection` now accepts `{ match: MatchDetail }`
- If `match.lineups` is absent → shows "not available" (same as before, no regression)
- If `match.lineups` is present → renders two-column table (home | away) with:
  - Starting XI: jersey, name, position abbreviation, ↓ if subbed out
  - Substitutes: jersey, name, position, ↑ if subbed in

No extra ESPN API call — rosters come from the same summary endpoint already fetched for goals/cards/subs.

---

### Obj 6 — MatchStatistics validation log

**File:** `src/lib/espn-id-map.ts` (`applyEspnEvents`)

Added a runtime warning when the enriched goal count doesn't match the FD score:

```
[ESPN-ENRICH] STATS-MISMATCH match:537364
  | fdScore=2-2 (total=4) | espnGoals=4 | espnId=760427
```

This log will fire for own-goal edge cases or future ESPN data quality issues,
enabling quick diagnosis without waiting for user reports.

---

## Type safety

```
npx tsc --noEmit → 0 errors
```

Files changed:
- `src/lib/types.ts`
- `src/lib/providers/espn.ts`
- `src/lib/espn-id-map.ts`
- `src/lib/match-snapshot.ts`
- `src/app/match/[id]/page.tsx`
- `src/app/api/debug/enrichment-health/route.ts` (new)
- `src/app/api/cron/repair-enrichment/route.ts` (new)

---

## Objective status

| # | Objective | Status |
|---|-----------|--------|
| 1 | Downgrade guard — no unenriched overwrite | ✅ |
| 2 | ESPN event cache 30 days | ✅ |
| 3 | Enrichment-health audit endpoint | ✅ |
| 4 | Daily repair cron endpoint | ✅ |
| 5 | ESPN rosters as Lineups section | ✅ |
| 6 | MatchStatistics validation log | ✅ |
