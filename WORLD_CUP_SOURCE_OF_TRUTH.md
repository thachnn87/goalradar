# WORLD CUP SOURCE OF TRUTH
**Created:** 2026-06-25  
**Status:** ACTIVE — do not modify without sprint review  
**Sprint:** DATA-18WC.RESET

This document is the single canonical reference for the World Cup 2026 feature. Every architectural decision during the RESET sprint must be reconciled against this document.

---

## 1. The ONE Pipeline

```
Football Data API (FD)
  └─► Authority Cache  (goalradar:wc:authority:v1, KV, 30s/300s/900s TTL)
        └─► buildKnockoutViewModel()     → knockout consumers
        └─► computeWCStandingsFromAuthority() → standings fallback
        └─► getWCAuthorityMatchesV2()    → hub page / general match data
```

**There is ONE source.** Every WC feature reads from the authority cache. No WC page calls a provider directly. No WC page constructs its own data pipeline.

---

## 2. The ONE ViewModels

| Domain | ViewModel Function | Location |
|---|---|---|
| Knockout stages | `buildKnockoutViewModel()` | `src/lib/knockout-vm.ts` |
| Group standings | `getStandingsCached('WC')` | `src/lib/api.ts` |
| Upcoming matches | `getWCAuthorityMatchesV2()` | `src/lib/api.ts` |
| Team detail | `getTeamCached(id)` | `src/lib/api.ts` |

**Every page consumes a ViewModel. No page assembles raw matches into a view structure.**

---

## 3. The ONE Component per surface

| Surface | Component | Location |
|---|---|---|
| Match card | `MatchCard` | `src/components/MatchCard.tsx` |
| Group table | `WCGroupTable` | `src/components/WCGroupTable.tsx` |
| Knockout bracket tree | `WCBracket` | `src/components/WCBracket.tsx` |
| Round page | `WCRoundPage` | `src/components/WCRoundPage.tsx` |
| Page navigation | `WCPageNav` | `src/components/WCPageNav.tsx` |
| Competition tabs | `CompetitionSelector` | `src/components/CompetitionSelector.tsx` |

---

## 4. Canonical Routes

Each feature has ONE canonical route. All other URLs must redirect to it or be deleted.

| Feature | Canonical URL | Notes |
|---|---|---|
| Hub | `/world-cup-2026` | Primary WC entry point |
| Standings | `/world-cup-2026-standings` | SEO page; /world-cup-2026/standings DOES NOT EXIST |
| Groups overview | `/world-cup-2026-groups` | SEO page |
| Group detail | `/world-cup-2026/[group]` | Dynamic `[a-l]` |
| Bracket | `/world-cup-2026/bracket` | Interactive bracket |
| Round of 32 | `/world-cup-2026/round-of-32` | |
| Round of 16 | `/world-cup-2026/round-of-16` | |
| Quarter-finals | `/world-cup-2026/quarter-finals` | |
| Semi-finals | `/world-cup-2026/semi-finals` | |
| Third-place | `/world-cup-2026/third-place` | CANONICAL — `/third-place-playoff` must redirect here |
| Final | `/world-cup-2026/final` | |
| Schedule | `/world-cup-2026-schedule` | SEO page |
| Results | `/world-cup-2026-results` | SEO page |

---

## 5. Cache Ownership

| Cache Key | Owner | TTL | Purpose |
|---|---|---|---|
| `goalradar:wc:authority:v1` | `authority-cache.ts` | 30s/300s/900s | 104 CanonicalMatch objects — PRIMARY SOURCE |
| `goalradar:dr:wc:authority:v1` | `authority-cache.ts` | 7 days | Disaster recovery copy |
| `/competitions/WC/matches` | providerManager | 6h | Legacy KV (pilot=false path) |
| `/competitions/WC/standings` | providerManager | 1h | Group standings |
| `goalradar:live:matches` | `live-cache.ts` | 30s | Cross-competition live match state |
| `goalradar:match:{id}` | `match-snapshot.ts` | tier-based | Per-match snapshot (EPA, lineup) |

---

## 6. Non-Negotiable Invariants

1. **ZERO provider calls from pages.** Pages call `*Cached()` functions only.
2. **buildKnockoutViewModel() is the ONLY entry point** for knockout data.  
   — Any page that calls `getWCKnockoutMatchesCached()` directly is a violation.
3. **injectKnockoutSlotLabels() is called ONLY inside `buildKnockoutViewModel()`.**  
   — No page or component calls it directly.
4. **canonicalToMatch() lives ONLY in `knockout-vm.ts`.**  
   — No page defines its own conversion function.
5. **AUTHORITY_CACHE_PILOT gate lives ONLY in `buildKnockoutViewModel()`.**  
   — All consumers automatically get the same source.
6. **Competition Tabs (`CompetitionSelector`) MUST be present on all WC standings surfaces.**
7. **`/world-cup-2026/standings` DOES NOT EXIST** — never create it; the canonical URL is `/world-cup-2026-standings`.

---

## 7. Known Violations (as of RESET start, 2026-06-25)

| Violation | File | Status |
|---|---|---|
| Hub page calls `getWCKnockoutMatchesCached()` directly | `src/app/world-cup-2026/page.tsx:6` | MUST FIX |
| Hub page calls `getWCAuthorityMatchesV2()` for upcoming | `src/app/world-cup-2026/page.tsx:5` | Acceptable — not knockout |
| `/world-cup-2026/third-place-playoff` duplicate route exists | `src/app/world-cup-2026/third-place-playoff/page.tsx` | MUST DELETE |
| Deprecated API routes still exist | `src/app/api/refresh/wc-fixtures/route.ts`, etc. | SHOULD DELETE |
| `fetchFromAPI()` dead code in api.ts | `src/lib/api.ts:43` | SHOULD DELETE |

---

## 8. Production Domain

`https://www.goalradar.org`  
Verify against live production only. TypeScript compile success is NOT evidence of correctness.
