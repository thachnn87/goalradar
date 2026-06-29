# WC7_BLOCKERS_VERIFIED.md — DATA-18WC.7A Blocker Verification
**Date:** 2026-06-23  
**Task:** DATA-18WC.7A — Evidence only. No fixes applied.

---

## Final Classification Summary

| Blocker (from WC.7) | Phase | Verdict | Notes |
|---|---|---|---|
| Spain vs Saudi Arabia score drift (537371) | 1 | **CONFIRMED** | Match page shows 5-0; correct is 4-0 |
| 12 stale team pages — zero data | 2 | **PARTIALLY_CONFIRMED** | Turkey: confirmed (slug mismatch). 11 others: did not qualify — speculative pages, not data gaps |
| UPCOMING feed absent from KV | 3 | **FALSE_POSITIVE** | Audit checked primary KV only; DR fallback serves pages correctly |
| Italy placeholder | 4 | **FALSE_POSITIVE** | Intentionally `qualified: false`; page behavior is correct |
| Standings group key mismatch | 5 | **FALSE_POSITIVE** | Only in debug diagnostic; `getStandingsCached` has the DATA-18WC.4 normalization fix |

---

## Phase 1 — Spain vs Saudi Arabia (Match 537371)

### Evidence

| Source | Score | Method |
|---|---|---|
| Match detail page `/match/537371` | **5-0** | HTML content, FULL TIME |
| Match detail page (slug URL) | **5-0** | HTML content |
| Spain team page (recent results) | **4-0** | `/world-cup-2026/teams/spain` |
| Saudi Arabia team page (recent results) | **4-0** | `/world-cup-2026/teams/saudi-arabia` |
| Group H standings (GD arithmetic) | **4-0** | Spain GD = +4, Saudi Arabia GD = -4 |
| Authority cache (`authority-drift` endpoint) | **4-0** | authority_score field |
| Snapshot | **5-0** | snapshot_score field, 35.6h stale |

### Determining the Correct Score

The Group H standings GD arithmetic is definitive:  
- Spain: +4 GD from 2 matches  
- Saudi Arabia: -4 GD  
- Spain's other Group H match was a 0-0 draw  
- A 5-0 win would produce +5 GD for Spain, not +4  
- **4-0 is the correct final score**

### Root Cause

The match detail page reads from the match snapshot KV key (via `getMatchSnapshot`), which is 35.6 hours stale. The snapshot was written when the score may have been partially correct (or corrupted). The authority cache has the correct 4-0 but the match page code path does not read from it.

### Verdict: **CONFIRMED**

The match detail page for Spain vs Saudi Arabia shows the wrong score (5-0) to all users. The correct score confirmed by standings arithmetic and team pages is 4-0.

---

## Phase 2 — 12 Stub Team Pages

### Evidence Table

| Slug | HTTP | Group on Page | In Live Standings? | Fixtures? | Category |
|---|---|---|---|---|---|
| costa-rica | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| honduras | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| venezuela | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| poland | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| **turkey** | 200 | TBD (stub) | **YES — Group D, 4th** | NO | **TEAM_IN_STANDINGS_NOT_IN_PAGE** |
| denmark | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| serbia | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| nigeria | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| cameroon | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| bolivia | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| peru | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |
| ukraine | 200 | TBD (stub) | NO | NO | TEAM_NOT_IN_STANDINGS |

### Turkey — Confirmed Data Bug

Turkey appears in the live Group D standings (4th place, 0 pts, 2 games played) but `/world-cup-2026/teams/turkey` shows the pre-draw stub with no group, no fixtures, no standings.

**Root cause:** The API stores the team as `"Türkiye"` (with diacritics per FIFA naming). The KV key written by the team enrichment pipeline is keyed to `türkiye`, but the team page route uses slug `turkey`. The KV lookup fails, the page falls through to the pre-draw stub template.

### 11 Non-Standing Teams — Speculative Pages

The 11 other teams do not appear in any of the 12 live group standings (Groups A–L, 48 entries confirmed). The actual WC 2026 participants in those confederation slots are different teams. These pages were pre-generated speculatively before qualification was finalized and were never cleared or redirected when those teams failed to qualify.

The current stub content ("Group TBD after draw", "Check back from 11 June 2026") is misleading — it implies the team is in the tournament but awaiting draw assignment. A cleaner message (like Italy's "did not qualify") would be appropriate, but this is a UX issue, not a data pipeline failure.

The WC.7 claim "25% of participants missing" is not supported — these 11 teams are not participants.

### Verdict: **PARTIALLY_CONFIRMED**

- Turkey: **CONFIRMED** (qualified, playing, page broken due to `turkey` vs `türkiye` slug mismatch)
- 11 others: **NOT CONFIRMED as a data gap** — these teams did not qualify for WC 2026; their stub pages are stale pre-draw speculative content

---

## Phase 3 — UPCOMING Feed Source Trace

### Evidence

**Homepage and schedule page** (`/` and `/schedule`): Both show the 3 MD3 matches as **SCHEDULED**:
- Portugal vs Uzbekistan — 17:00 UTC
- England vs Ghana — 20:00 UTC
- Panama vs Croatia — 23:00 UTC

**Source chain from code:**
```
homepage → getWCAuthorityMatchesCached() → getUpcomingMatchesCached('WC') → readKVOnly()
```

**`readKVOnly()` (src/lib/kv-cache.ts):**
1. Reads primary key: `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED`
2. On miss, falls back to DR key: `goalradar:dr:/competitions/WC/matches?status=SCHEDULED,TIMED` (7-day TTL)
3. Returns null only if both are absent

**`/api/debug/feed-integrity` audit code:** Reads `kv.get(UPCOMING_FEED_KEY)` — **primary key only, no DR fallback**

### Asymmetry

The feed-integrity audit at 08:42 reported the primary KV key absent and declared "UPCOMING feed ABSENT". However, `readKVOnly()` (used by all page renders) checks the DR fallback key before returning null. The DR copy has a 7-day TTL and was populated from a prior successful CRON run.

The audit code does not replicate the DR fallback logic → it reports ABSENT when the DR copy is actively serving pages. The 3 upcoming matches displaying correctly on the homepage confirm the DR key is populated and serving.

### Verdict: **FALSE_POSITIVE**

The "UPCOMING feed absent" finding from WC.7 was an audit asymmetry. Pages render upcoming matches correctly via the DR fallback. The primary KV key was briefly absent (missed CRON run), but pages were never broken. The feed-integrity debug endpoint should be updated to also check the DR key for a complete picture.

---

## Phase 4 — Italy Status

### Evidence (from `src/lib/wc-all-teams.ts`)

```typescript
{
  slug: 'italy',
  group: 'TBD',
  qualified: false,
  intro: 'Italy, four-time world champions, did not qualify for the FIFA World Cup 2026,
           failing to advance through the UEFA qualifying process.',
  metaDesc: 'Italy did not qualify for the FIFA World Cup 2026. Gli Azzurri were eliminated
              in UEFA qualifying.',
}
```

- `qualified: false` — explicit
- `group: 'TBD'` — filtered out of `getStaticWCGroupTables()` by the TBD guard (DATA-18WC.6 fix)
- Team page shows "did not qualify" message
- Italy does not appear in any standings group
- Italy has no match data in the authority cache

Italy was included in `wc-all-teams.ts` intentionally so the team page renders a graceful non-qualification message rather than 404. This is the correct design.

### Verdict: **FALSE_POSITIVE**

Italy is not a participant. Its inclusion is intentional. No data gap exists.

---

## Phase 5 — Group Key Format Verification

### Evidence (from `src/lib/api.ts:429-433`)

```typescript
// DATA-18WC.4: football-data.org returns "Group A" but static tables use
// "GROUP_A". Normalise the live key so the map lookup succeeds for both forms.
const toGroupKey = (g: string | null | undefined) =>
  (g ?? '').startsWith('GROUP_') ? (g ?? '') :
  'GROUP_' + (g ?? '').replace(/^Group\s*/i, '').trim().toUpperCase();
const liveByGroup = new Map(
  standings.filter(s => s.type === 'TOTAL').map(st => [toGroupKey(st.group), st])
);
```

The `getStandingsCached('WC')` function already normalizes group keys as part of the DATA-18WC.4 fix. `"Group A"` → `"GROUP_A"` before the map is built.

**`/api/debug/standings-audit/route.ts:95-113` — `mergeDiagnostic()`:**
```typescript
const liveByGroup = new Map(standings.map(st => [st.group, st]));  // no normalization
// ...
const liveMatch = liveByGroup.get(staticEntry.group);  // "GROUP_A" lookup fails for "Group A"
```

The debug endpoint's `mergeDiagnostic` does NOT call `toGroupKey`. It always reports `liveFound: false` for all groups. This is a diagnostic bug in the endpoint.

The same endpoint's `effectiveVerdict` section (lines 141-156) calls `getStandingsCached('WC')` directly and reports:  
`"FIX_ACTIVE — 12/12 groups have playedGames > 0"` — confirming the real rendering path works.

### Verdict: **FALSE_POSITIVE**

The group key mismatch is a bug in the `mergeDiagnostic()` function inside the debug-only `standings-audit` route. Production standings rendering has been correctly normalized since the DATA-18WC.4 fix. The WC.7 finding "live merge disabled for all 12 groups" does not reflect the actual state of `getStandingsCached`.

---

## Revised Blocker List for WC_DATA_READY

| Issue | Original WC.7 Severity | Verified Severity | Action |
|---|---|---|---|
| Spain vs Saudi Arabia score (537371) | P0 RED | **P0 — CONFIRMED** | Fix: match detail page must read score from authority cache, not snapshot |
| Turkey page stub (slug mismatch) | — (not previously isolated) | **P1 — CONFIRMED** | Fix: normalize `turkey` slug to `türkiye` in team KV writer, or add slug alias |
| 11 stale non-qualifier pages | P1 HIGH | **P3 UX-only** | Non-participants; update stub message to "did not qualify" |
| UPCOMING feed absent | P1 HIGH | **FALSE POSITIVE** | DR fallback serving correctly; audit endpoint needs DR check |
| Standings group key mismatch | P2 YELLOW | **FALSE POSITIVE** | DATA-18WC.4 fix already in place in `getStandingsCached` |
| Italy placeholder | P3 INFO | **FALSE POSITIVE** | Intentional; correct behavior |

**Confirmed active blockers: 2 (not 3)**  
1. Match detail page score drift for match 537371 — P0
2. Turkey team page slug mismatch (`turkey` → `türkiye`) — P1
