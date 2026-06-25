# CACHE OWNERSHIP — FINAL
**Sprint:** DATA-18WC.CONSOLIDATE — Phase 7  
**Date:** 2026-06-25

---

## Principle

Every dataset has **exactly one owner**. No dataset is written by two pipelines or
read through two competing source functions.

---

## Registry

### Dataset: WC match collection (all 104 matches, canonical state)

| Field | Value |
|---|---|
| **Cache owner** | `goalradar:wc:authority:v1` |
| **Writer** | Cron `buildAllCanonicalMatches()` → `writeAuthorityCache()` |
| **DR key** | `goalradar:wc:authority:dr:v1` |
| **Readers** | `readAuthorityCache()` ← `getWCAuthorityMatchesV2()` (raw `CanonicalMatch[]`), `getWCAuthorityMatchesCached()` (Match-shaped view), `buildKnockoutViewModel()` (knockout slice) |
| **TTL** | Cron-overwritten (~15 min cadence); read path has DR fallback → cold rebuild |
| **Invalidation** | Cron overwrite; ISR revalidate per page |
| **Revalidation** | Hub 30s · fixtures/predictions(86400)/schedule/results 300s · knockout 900s · teams 3600s |
| **Fallback** | DR key → `buildAllCanonicalMatches()` cold rebuild; pages add try/catch empty-state |

> Single read engine (`readAuthorityCache`) feeds all three accessors. The accessors
> differ only in **return shape**, not in source — so there is one owner and one reader path.

### Dataset: WC standings (12 group tables)

| Field | Value |
|---|---|
| **Cache owner** | `goalradar:wc:standings:v1` |
| **Writer** | Standings cron |
| **Reader** | `getStandingsCached('WC')` |
| **TTL** | 3600s (page ISR) |
| **Fallback** | `computeWCStandingsFromAuthority()` (derives from authority:v1) → static group tables. FD `/standings` returns 403 (tier), so the authority-derived path is the effective live source. |

### Dataset: WC live state

| Field | Value |
|---|---|
| **Cache owner** | `goalradar:live:matches` |
| **Writer** | Live-score cron |
| **Reader** | `getCurrentLiveMatches()` / `getLiveMatchIdSet()` (the live SSOT module) |
| **TTL** | 30s |
| **Note** | Overlaid by pages at render time on top of authority:v1; never baked into authority cache |

### Dataset: per-match snapshot (detail + ESPN enrichment)

| Field | Value |
|---|---|
| **Cache owner** | `goalradar:match:{id}` |
| **Writer** | `match-snapshot.ts` (snapshot builder; reads generic feeds + standings for enrichment context) |
| **Reader** | match detail pages |
| **TTL** | 900s (FINISHED up to 7d) |

### Dataset: generic multi-competition feeds (NON-WC)

| Field | Value |
|---|---|
| **Cache owner** | `/competitions/{code}/matches?status=…` (per competition) |
| **Reader** | `getUpcomingMatchesCached(code)` / `getRecentMatchesCached(code)` |
| **Scope** | Non-WC competitions only (and the snapshot writer). No WC display surface reads these post-CONSOLIDATE. |

---

## Removed / orphaned owners

| Item | Status |
|---|---|
| `/competitions/WC/matches` (6h KV via `getWCKnockoutMatchesCached`) | **Removed** — function deleted; no longer read |
| 3-bucket merge inside `getWCAuthorityMatchesCached` (upcoming+results+live) | **Removed** — body now reads authority:v1 |
| `getWCResultsCached()` (`?status=FINISHED`) | **Orphaned** — no reader; flagged for follow-up deletion |

---

## Duplicate-ownership check

| Dataset | # writers | # reader entry points | Verdict |
|---|---|---|---|
| WC matches | 1 (cron) | 1 engine (`readAuthorityCache`), 3 shaped accessors | ✅ single owner |
| WC standings | 1 | 1 (`getStandingsCached`) | ✅ |
| WC live | 1 | 1 (live SSOT) | ✅ |
| Per-match snapshot | 1 | 1 | ✅ |

No dataset has more than one owner.
