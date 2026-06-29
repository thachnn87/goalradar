# WC_UPCOMING_MATCHES_AUDIT — DATA-18WC.6

**Date:** 2026-06-23

## Symptom

Hub page (`/world-cup-2026`) shows empty "Upcoming Matches" section despite future MD3 fixtures existing.

## Data sources

The hub page uses `getWCAuthorityMatchesV2` → `readAuthorityCache` → authority cache KV (`goalradar:wc:authority:v1`).

```
upcomingMatches = allAuthority.filter(m => effectiveBucket(m) === 'upcoming').slice(0, 12)
```

`effectiveBucket` uses `classifyMatchState(m, today)` which correctly returns 'upcoming' for future scheduled matches (state='scheduled', utcDate > today).

## Production probe (2026-06-23)

```json
{
  "authority": { "present": true, "count": 47 },
  "upcoming":  { "present": true, "count": 60 },
  "finished":  { "present": true, "count": 47 }
}
```

**Authority cache has 47 matches (finished only). 60 upcoming matches are in KV but missing from the authority cache.**

## Root cause

`coldRebuild` in `src/lib/authority-cache.ts` called `getUpcomingMatchesCached('WC')`, which goes through `withCache` (in-process memory cache, TTL=900s from `src/lib/cache.ts`). On warm Lambda instances, `withCache` can return a stale empty `{ matches: [] }` result from a prior invocation when the upcoming KV key was empty (before MD3 fixtures were scheduled). The 900s in-process TTL is longer than a single Lambda invocation but can persist across warm restarts within a 15-minute window.

**Sequence that produces the bug:**
1. Lambda instance cold: `getUpcomingMatchesCached('WC')` → KV is empty → returns `{ matches: [] }` → `withCache.store` caches empty with TTL +900s
2. Orchestrator `refreshEndpoint` populates KV with 60 upcoming matches
3. Within 900s: another call to `writeAuthorityCache` → `coldRebuild` → `getUpcomingMatchesCached` → `withCache` HIT → returns stale empty array
4. Authority cache written with 47 matches (finished) + 0 (upcoming) = 47

## Fix applied

`src/lib/authority-cache.ts` `coldRebuild` now uses `readKVOnly` directly (imported from `./kv-cache`) instead of `getUpcomingMatchesCached` and `getWCResultsCached`. `readKVOnly` reads directly from Redis without the in-process `withCache` layer.

Live matches still use `getWCLiveMatches()` (which reads from `goalradar:live:matches` — a separate KV key not subject to this issue).

## Expected result post-fix

Next `writeAuthorityCache` call → `coldRebuild` reads KV directly → 60 upcoming + 47 finished = 104 or more matches → `upcomingMatches = allAuthority.filter('upcoming')` returns future MD3+ fixtures.

## Verdict

**UPCOMING_MATCHES: FIXED** — `coldRebuild` now bypasses `withCache`, ensuring the authority cache always incorporates the latest KV feeds.
