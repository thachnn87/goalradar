# DATA-18E Phase 2 — Authority Adoption Matrix

Date: 2026-06-17  
Commit: `0c963a8`

---

## Classification Per Page

| Page | Route | Classification | Source Function | Match Type | State Field |
|------|-------|---------------|----------------|------------|-------------|
| Hub | `/world-cup-2026` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` | `m.state` |
| Results | `/world-cup-2026/results` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` (via `ResultsEntry`) | `entry.state` |
| Fixtures | `/world-cup-2026/fixtures` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` | `classifyMatchState(m)` |
| Group | `/world-cup-2026/[group]` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` | `classifyMatchState(m)` |
| Matches Today | `/world-cup-2026/matches-today` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` | `m.state` |
| Matches Tomorrow | `/world-cup-2026/matches-tomorrow` | **AUTHORITY** | `getWCAuthorityMatchesV2()` | `CanonicalMatch` | `m.state` |

---

## Classification Legend

| Class | Meaning |
|-------|---------|
| **AUTHORITY** | Reads from `goalradar:wc:authority:v1` via `getWCAuthorityMatchesV2()`. Returns real `CanonicalMatch[]`. Single source, no merge. |
| **LIVE_CACHE** | Reads from `goalradar:live:wc-matches` — live-only feed (correct scope, not replaced). |
| **SNAPSHOT** | Per-match `goalradar:match:{id}` — used only by match detail page. |
| **LEGACY** | Uses `getWCAuthorityMatches()` (type lie — returns `Match[]` from 3-feed merge). **None remain on listing pages after Phase 4.** |

---

## Feed Merge Elimination

**Before DATA-18E:** Hub page made 4 API calls and merged results:
```
getWCLiveMatchesCached()        → live feed
getWCAuthorityMatchesCached()   → 3-feed merge: upcoming + finished + live overlay
getWCKnockoutMatchesCached()    → knockout feed
getStandingsCached()            → standings
```

**After DATA-18E:** Hub page makes 3 calls (down from 4):
```
getWCAuthorityMatchesV2()       → single authority cache (all 104 WC matches)
getWCKnockoutMatchesCached()    → knockout feed (bracket display, separate concern)
getStandingsCached()            → standings
```

Matches-today previously made **3 separate feed calls** (results + live + upcoming), now **1 call**.

---

## Type Compatibility Summary

`CanonicalMatch` vs `Match` fields used by listing pages:

| Field | Match | CanonicalMatch | Compatible? |
|-------|-------|---------------|-------------|
| `id` | ✓ | ✓ | ✓ |
| `utcDate` | ✓ | ✓ | ✓ |
| `group` | ✓ | ✓ | ✓ |
| `stage` | ✓ | ✓ | ✓ |
| `minute` | ✓ | ✓ | ✓ |
| `score.fullTime.home/away` | ✓ | ✓ | ✓ |
| `score.winner` | ✓ | ✓ (CanonicalScore = Score) | ✓ |
| `score.duration` | ✓ | ✓ | ✓ |
| `homeTeam.name/shortName/crest` | ✓ | ✓ | ✓ |
| `status` | ✓ `FINISHED\|IN_PLAY\|...` | ✗ — use `state` | `effectiveStatus()` in MatchCard |
| `state` | ✗ | ✓ `finished\|live\|scheduled\|cancelled` | `classifyMatchState()` updated |
| `competition.name` | ✓ | ✗ — use `competitionCode` | `effectiveCompName()` in MatchCard |
| `enrichmentApplied` | ✗ | ✓ | authority-only field |
| `integrity` | ✗ | ✓ | authority-only field |
