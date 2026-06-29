# DATA-16B Reliability Verification

Date: 2026-06-17
Phase: 7 of 7

---

## DATA-16 Protection 1: Downgrade Guard

**Location:** `src/lib/match-snapshot.ts` — `writeKVSnapshot`

**Specification:** If rebuilding a FINISHED scored match returns 0 goals, read the
disaster-recovery (DR) snapshot. If it has goals, preserve it instead of writing the
degraded version.

**Code verification:**
```typescript
if (
  snapshot.match.status === 'FINISHED' &&
  ftH + ftA > 0 &&
  (snapshot.match.goals?.length ?? 0) === 0
) {
  const dr = await readDRSnapshot(matchId);
  if (dr && (dr.match.goals?.length ?? 0) > 0) {
    // Preserve DR snapshot — writes it to main key
    await kv.set(kvKey(matchId), dr, { ex: getSnapshotTtlSec(dr.match) });
    return;
  }
  // No DR rescue — writes unenriched with a warn log
}
```

**Runtime verification:** Requires a fresh enrichment cycle to produce a FINISHED+scored
snapshot with 0 goals, then confirm the DR rescue triggers. This can only be observed
in production logs after repair + intentional event-cache wipe.

**Status:** ✅ Code confirmed in source. Runtime verification PENDING (requires log access).

---

## DATA-16 Protection 2: 30-Day ESPN Event Cache TTL

**Location:** `src/lib/espn-id-map.ts`

**Specification:** `ESPN_EVENT_TTL_SEC` must equal `30 * 24 * 3600` (2592000 seconds).

**Code verification:**
```typescript
export const ESPN_EVENT_TTL_SEC  = 30 * 24 * 3600; // 30 days — FINISHED events never change
```

**Production verification:** Not directly observable without KV access. The debug endpoint
would show `eventCacheAgeSeconds` + `lookupTtlRemaining` after repair.

**Expected behavior after repair:** event cache written with ex=2592000 (30 days).
A match enriched today will still have warm event cache until ~2026-07-17.

**Status:** ✅ Code confirmed in source. Production observable after repair via debug endpoint.

---

## DATA-16 Protection 3: Repair Cron Endpoint

**Location:** `src/app/api/cron/repair-enrichment/route.ts`

**Specification:** Must exist, require auth, scan 18 WC matches, invalidate degraded ones.

**Verification:**
```
GET https://www.goalradar.org/api/cron/repair-enrichment
→ HTTP 401 {"error":"Unauthorized"}
```

Endpoint exists (HTTP 401 = exists, auth-gated correctly). Without CRON_SECRET, full
behavior cannot be tested. Code inspection confirms the logic is correct.

**Status:** ✅ Endpoint exists and auth-gates correctly. Full runtime test PENDING (CRON_SECRET).

---

## DATA-16 Feature: Enrichment Health Endpoint

**Location:** `src/app/api/debug/enrichment-health/route.ts`

**Specification:** Must exist, require auth, return per-match health data.

**Verification:**
```
GET https://www.goalradar.org/api/debug/enrichment-health
→ HTTP 401 {"error":"Unauthorized"}
```

**Status:** ✅ Endpoint exists and auth-gates correctly.

---

## DATA-16 Feature: ESPN Lineups

**Location:** `src/lib/providers/espn.ts` (parseLineups), `src/lib/espn-id-map.ts` (cache), `src/app/match/[id]/page.tsx` (render)

**Specification:** ESPN `rosters` parsed into `Lineup` type; stored in `CachedEspnEvents.lineups`; rendered in `LineupsSection` as starting XI + bench.

**Production state:** All 18 match pages show "Detailed starting lineups are not available from the current data provider." — this is the fallback when `match.lineups == null`, which is true because no matches have been enriched with the new code yet.

**Post-repair expected:** All 18 matches will have `match.lineups` set. The starting XI section will show:
- Jersey number, player name, position abbreviation (G/CD/CM/CF/etc.)
- ↓ arrow for players subbed off
- Bench section with ↑ arrow for players who came on

**Status:** ✅ Code confirmed. Runtime verification PENDING (requires repair + page load).

---

## DATA-15C Alias: turkey → turkiye

**Location:** `src/lib/providers/espn.ts` `ESPN_ALIASES`

**Specification:** `'turkey': 'turkiye'` must be in alias map.

**Code verification:**
```typescript
const ESPN_ALIASES: Record<string, string> = {
  ...
  'turkey': 'turkiye',  // FD "Turkey" ↔ ESPN "Türkiye" (DATA-15C)
};
```

**Production verification:** 537346 (Australia vs Turkey) should resolve to ESPN ID 760421.
Currently unverifiable without CRON_SECRET (`/api/debug/espn-enrichment/537346`).
After repair, the page should show 2 goals for Australia vs Turkey.

**Status:** ✅ Code confirmed. Production observable post-repair.

---

## Summary

| Protection | Code | Runtime |
|------------|------|---------|
| Downgrade guard | ✅ | PENDING (log access) |
| 30d event TTL | ✅ | PENDING (KV/debug access) |
| Repair cron endpoint | ✅ | ✅ Exists (401) |
| Health audit endpoint | ✅ | ✅ Exists (401) |
| ESPN lineups | ✅ | PENDING (post-repair page load) |
| turkey alias | ✅ | PENDING (post-repair 537346) |
| FAQ no-false-goalless | ✅ | ✅ CONFIRMED LIVE |
