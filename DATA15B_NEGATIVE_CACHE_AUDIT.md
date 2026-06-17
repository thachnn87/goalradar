# DATA-15B Negative Cache Audit
## ESPN Lookup Keys — Validity, Sentinels, TTL Strategy

Date: 2026-06-17
Status: **Audit only.** No production writes, no snapshot changes.

---

## Access Constraint & Methodology

Production KV is **not directly readable** from this environment: no `CRON_SECRET`
(required by `/api/debug/kv` and `/api/debug/espn-enrichment`) and no KV REST
credentials in `.env.local` (confirmed in DATA-14B). The `goalradar:espn:lookup:*`
keys therefore could not be enumerated via `kv.scan`.

Instead, the lookup-key population was **reconstructed authoritatively** by
replaying the exact production resolver against live data:

1. Fetched all FINISHED WC 2026 matches from football-data.org (18 matches).
2. Fetched ESPN scoreboards for June 10–17 2026.
3. Ran `findEspnMatch()`'s logic — **using the exact `ESPN_ALIASES` map from
   `src/lib/providers/espn.ts`** (no extra aliases) — over every match, trying
   the UTC date then the prev-day fallback, exactly as production does.

This yields precisely the valid-ID vs `__NOT_FOUND__` outcome production computes.
Script: `scripts/data15b_resolve_check.mjs` (+ the temp replay run). A
production-KV variant (scan + `kv.ttl` per key) is specified in §6 for when
`CRON_SECRET` is available.

---

## 1. Lookup Key Verification (all 18 FINISHED WC matches)

| FD ID | ESPN ID | Resolution | Match | Kickoff UTC |
|-------|---------|-----------|-------|-------------|
| 537327 | 760415 | direct | Mexico vs South Africa | 2026-06-11T19:00Z |
| 537328 | 760414 | prev-day | South Korea vs Czechia | 2026-06-12T02:00Z |
| 537333 | 760416 | direct | Canada vs Bosnia-Herzegovina | 2026-06-12T19:00Z |
| 537345 | 760417 | prev-day | United States vs Paraguay | 2026-06-13T01:00Z |
| 537334 | 760420 | direct | Qatar vs Switzerland | 2026-06-13T19:00Z |
| 537339 | 760419 | direct | Brazil vs Morocco | 2026-06-13T22:00Z |
| 537340 | 760418 | prev-day | Haiti vs Scotland | 2026-06-14T01:00Z |
| **537346** | **__NOT_FOUND__** | **FAIL** | **Australia vs Turkey** | **2026-06-14T04:00Z** |
| 537351 | 760422 | direct | Germany vs Curaçao | 2026-06-14T17:00Z |
| 537357 | 760425 | direct | Netherlands vs Japan | 2026-06-14T20:00Z |
| 537352 | 760423 | direct | Ivory Coast vs Ecuador | 2026-06-14T23:00Z |
| 537358 | 760424 | prev-day | Sweden vs Tunisia | 2026-06-15T02:00Z |
| 537369 | 760428 | direct | Spain vs Cape Verde Islands | 2026-06-15T16:00Z |
| 537363 | 760426 | direct | Belgium vs Egypt | 2026-06-15T19:00Z |
| 537370 | 760429 | direct | Saudi Arabia vs Uruguay | 2026-06-15T22:00Z |
| 537364 | 760427 | prev-day | Iran vs New Zealand | 2026-06-16T01:00Z |
| 537391 | 760432 | direct | France vs Senegal | 2026-06-16T19:00Z |
| 537392 | 760430 | direct | Iraq vs Norway | 2026-06-16T22:00Z |

---

## 2. Counts

| Outcome | Count |
|---------|-------|
| **Valid ESPN IDs** | **17** |
| **`__NOT_FOUND__` sentinels** | **1** |
| Total finished WC matches | 18 |

> Caveat: a lookup key physically exists only for matches whose page was built
> (triggering `enrichMatchWithEspnEvents`). The table above is the *resolution
> outcome* for every finished match; the actual KV key set is a subset. The one
> failing match (537346) is confirmed to have a live sentinel — see §3.

### The single sentinel is a FALSE NEGATIVE

`537346 Australia vs Turkey` **exists on ESPN** as event **760421** (confirmed:
`Australia [AUS] vs Türkiye [TUR]` on the June 14 scoreboard). Production fails to
resolve it because:

- FD team name: **"Turkey"** → `normaliseName` → `turkey`
- ESPN team name: **"Türkiye"** → `normaliseName` → `turkiye` (diacritics stripped)
- ESPN short/abbr: `Türkiye` / `TUR` — none equal `turkey`
- `ESPN_ALIASES` in `providers/espn.ts` has **no `turkey → turkiye` entry**

→ `findEspnMatch` returns null → `resolveEspnMatchId` writes `__NOT_FOUND__` with
a **30-day TTL** → all future enrichment for this match is suppressed until ~July 14.

**Production impact (verified on the live page):** `goalradar.org/match/537346-australia-vs-turkey`
is a **2–0 match** but its FAQ renders *"The match ended goalless (0–0)."* — a
user-facing falsehood caused directly by the suppressed enrichment. (Secondary
bug: `buildFaqs` treats `goals.length === 0` as goalless even when the score is
non-zero; it should say "scorer data unavailable" when score > 0 but no events.)

---

## 3. Age of Each Sentinel

**Sentinel age is NOT recoverable from the stored value.** The lookup value is a
bare string — either an ESPN ID or the literal `'__NOT_FOUND__'`:

```ts
kv.set(lookupKey, espnId ?? '__NOT_FOUND__', { ex: ESPN_LOOKUP_TTL_SEC });
```

No timestamp, reason, or attempt count is stored. Two consequences:

1. **Age is only derivable via remaining TTL:** `age = 30d − kv.ttl(key)`. This
   requires a live KV read (unavailable here) and works only because the original
   TTL is a known constant.
2. **The debug endpoint cannot report it.** `/api/debug/espn-enrichment/[matchId]`
   declares and returns `lookupAgeSeconds` but **never assigns it** (it has no
   write-time source and does not call `kv.ttl`). It is always `null`. The doc
   comment "seconds since lookup was cached" is unfulfillable with the current
   schema.

**Estimated age for 537346:** the sentinel was written when its page first built
after the match finished (June 14) — i.e. ~3 days old as of 2026-06-17, with
~27 days of TTL remaining. It will keep suppressing re-resolution until ~July 14,
beyond the match's relevance window.

---

## 4. Recommended TTL Strategy

### Problem

Positive and negative results share **one 30-day TTL**. That conflates two
opposite lifetimes:

| Result kind | Correct lifetime | Current TTL | Verdict |
|-------------|------------------|-------------|---------|
| Valid ESPN ID | Permanent (IDs immutable) | 30 d | Fine (could be longer) |
| `__NOT_FOUND__` | Short — most misses are transient | 30 d | **Far too long** |

A miss is usually transient: the match isn't on ESPN *yet* (queried near kickoff),
or an alias/date gap that gets fixed in code. A 30-day negative TTL cements these
false negatives for the entire tournament.

### Recommendation — split positive/negative TTLs + structured sentinel

1. **Positive TTL: keep 30 d** (or extend to 60 d; ESPN event IDs never change).

2. **Negative TTL: short, with backoff.** Replace the 30-day sentinel TTL with:
   - **6 hours** flat, OR
   - exponential backoff: 15 min → 1 h → 6 h → 24 h (cap), keyed on attempt count.

   Cost is negligible: a re-miss costs one ESPN scoreboard call (DATA-13E measured
   ~0 steady-state ESPN calls; even hourly retries across all misses are trivial).

3. **Store a structured sentinel, not a bare string**, so age and policy are
   observable:
   ```ts
   interface LookupMiss {
     status: 'NOT_FOUND';
     reason: 'no-scoreboard-match' | 'name-mismatch' | 'date-window';
     firstMissAt: number;   // epoch ms — enables true age
     lastAttemptAt: number;
     attempts: number;      // drives backoff
   }
   ```
   Positive entries can stay a bare ID string (or mirror with `{ status:'OK', espnId, resolvedAt }`).

4. **Distinguish miss reasons.** A `name-mismatch` (the match IS on the scoreboard
   but no name variant matched — detectable by date-only scoreboard presence)
   should **alert + short-TTL**, because it signals an alias gap (a code fix), not
   a genuinely absent match. This is exactly the 537346 case.

5. **Make `lookupAgeSeconds` real:** populate it from `firstMissAt`, or have the
   debug endpoint call `kv.ttl()` and compute `30d − ttl`.

### Immediate remediation (operational, post-deploy — not part of this audit)

- Add `turkey → turkiye` (and audit all 48 WC team names) to the alias map.
- Delete the stale sentinel: `kv.del('goalradar:espn:lookup:537346')`, then
  revalidate `/api/revalidate/match/537346`. (Requires `CRON_SECRET`.)

This alias gap is the motivating case for the **Team Identity Layer** —
see `DATA15B_TEAM_IDENTITY_DESIGN.md`.

---

## 5. Findings Summary

| # | Finding | Severity |
|---|---------|----------|
| F1 | 1 of 18 finished matches is a false-negative sentinel (537346 Australia/Turkey) — match exists on ESPN as 760421 | **High** (user-facing: 2-0 match shown as "goalless") |
| F2 | Root cause: `ESPN_ALIASES` lacks `turkey → turkiye`; alias maps are partial and drift across files | High |
| F3 | Negative cache shares the 30-day positive TTL → false negatives persist all tournament | High |
| F4 | Sentinel stores no timestamp/reason → age unobservable, retry policy untunable | Medium |
| F5 | `lookupAgeSeconds` in the debug endpoint is always `null` (never assigned) | Low |
| F6 | `buildFaqs` reports "goalless (0–0)" for a non-zero score when events are missing | Medium |

---

## 6. Production-KV Audit Procedure (for when CRON_SECRET is available)

```bash
# Enumerate + age every ESPN lookup key directly from production KV.
# Extend /api/debug/kv to scan goalradar:espn:lookup:* (read-only), or run:

curl -s "https://goalradar.org/api/debug/kv?secret=$CRON_SECRET" | jq .
# Then for each lookup key:
#   value === '__NOT_FOUND__'  → sentinel
#   ttlRemaining = kv.ttl(key)
#   ageSeconds   = (30*24*3600) - ttlRemaining
```

Expected result given §1: ~17 keys holding valid ESPN IDs, 1 holding
`'__NOT_FOUND__'` (537346) with ~27 days TTL remaining (~3 days old).
