# END-TO-END ACCEPTANCE
**Sprint:** DATA-18WC.END-TO-END  
**Date:** 2026-06-25  
**Domain:** https://www.goalradar.org

---

## New acceptance gate

Previous sprints accepted on **data** correctness alone. This sprint adds a
**runtime user-journey gate** that fails on navigation breakage even when the
underlying data is correct:

```
Data → Route → URL → Page → SSR → Navigation
```

A step FAILS (and the whole sprint FAILS) when a URL:
- returns non-2xx (404 / 5xx / network error / timeout),
- renders an error card ("Match Not Found", "Match Details Unavailable",
  "This page couldn't load", "could not be found", "Application error"),
- dead-ends (the next journey step's link cannot be discovered), or
- (bracket parity) the SEO and nested brackets expose different match identities.

Gate: `scripts/check-wc-journeys.mjs` → `npm run check:wc-journeys`
(set `CRAWL_BASE_URL=https://www.goalradar.org` to gate production).

---

## Three reported P0/P1 issues — disposition

### 1. Match detail route `/match/537417-…` "won't open"

**Investigation:** On current production the route returns **HTTP 200 and renders
real content** — Journey 1 and Journey 6 both reach `/match/537417-1st-group-a-vs-3rd-bcd`
and pass the gate. The failure mode is **provider-dependent**: `buildSnapshot`
falls back to the live provider on a KV-detail miss, and for a knockout fixture
with placeholder ("TBD") teams the provider can throw `NotFoundError` →
"Match Not Found" on a cold cache.

**Fix (defensive, ONE SOURCE):** `buildSnapshot` now falls back to **authority:v1**
before surfacing NotFound. `buildDetailFromAuthority()` builds a minimal
`MatchDetail` from the canonical match (teams, date, stage, score, venue, referee)
using the single `canonicalToMatch` adapter. Every match present in authority:v1
(all 104) now opens, regardless of provider/cold-cache state.

**Status:** ✅ Fixed (hardened). Route confirmed working on prod.

### 2. SEO bracket vs nested bracket show different match counts

**Investigation:** Confirmed on production by the parity gate — SEO exposed **16**
match ids, nested **32**. Root cause: the SEO page sliced each round to 4 matches
(`stageMatches.slice(0, 4)`), while the nested page renders all. Both already read
the same `buildKnockoutViewModel` (post-CONSOLIDATE), so the divergence was purely
presentational.

**Fix:** removed the `slice(0, 4)` (and the local-fallback slice) in
`/world-cup-2026-bracket`. Both pages now render all matches per round from the
same ViewModel → identical 32 knockout match ids.

**Status:** ✅ Fixed (deterministic). Parity gate passes post-deploy.

### 3. Acceptance only checked data, not the user journey

**Fix:** added `scripts/check-wc-journeys.mjs` — the runtime gate above, encoding
all 6 mandatory journeys + bracket parity. It follows **real links** between steps
(not hardcoded URLs) so a broken handoff anywhere fails the journey.

**Status:** ✅ Fixed (gate added).

---

## Production baseline (pre-deploy run, current code)

```
✅ Journey 1 — Home → Bracket → Round32 → Match → Back
✅ Journey 2 — Standings → Group → Team → Match
✅ Journey 3 — Fixtures → Match
✅ Journey 4 — Results → Match
✅ Journey 5 — Schedule → Match
✅ Journey 6 — SEO Bracket → Round → Match
❌ Bracket parity — SEO 16 vs nested 32  (← fixed by this sprint's code change)
```

All 6 navigation journeys already PASS on production. The single remaining failure
(parity) is resolved by the `slice` removal and must be re-confirmed after deploy.

---

## Post-deploy acceptance — ✅ CONFIRMED PASS

Re-run against production after deploy of commit `7101d9c`:

```
$ CRAWL_BASE_URL=https://www.goalradar.org node scripts/check-wc-journeys.mjs

  ✅ Journey 1 — Home → Bracket → Round32 → Match → Back
  ✅ Journey 2 — Standings → Group → Team → Match
  ✅ Journey 3 — Fixtures → Match
  ✅ Journey 4 — Results → Match
  ✅ Journey 5 — Schedule → Match
  ✅ Journey 6 — SEO Bracket → Round → Match
  ✅ Bracket parity — SEO 32 == nested 32 match ids

✅ ALL 7 JOURNEYS PASS — end-to-end navigation healthy.  (exit 0)
```

**Sprint verdict: PASS.** All 6 mandatory journeys + bracket parity are green on
production. The parity fix (slice removal) took effect after the bracket page's ISR
cache regenerated post-deploy — SEO and nested now expose the identical 32 knockout
match identities.

---

## Findings carried forward (non-blocking)

| # | Finding | Recommendation |
|---|---|---|
| F1 | WC group standings (`WCGroupTable`) link team rows to the generic `/teams/{id}` page, a separate multi-competition surface with no WC match links — a soft dead-end for the match journey (the WC journey is still navigable via the WC team links the group page also renders). | Add an opt-in WC-team-link mode to `WCGroupTable` so WC pages route rows to `/world-cup-2026/teams/{slug}`. |
| F2 | `getWCResultsCached()` orphaned (from CONSOLIDATE). | Delete in a follow-up once confirmed unreferenced. |
