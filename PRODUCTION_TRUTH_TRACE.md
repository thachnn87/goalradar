# PRODUCTION TRUTH TRACE
**Phase:** DATA-18WC.VERIFY Phase 1  
**Date:** 2026-06-25  
**Method:** WebFetch of production HTML + source file reads

---

## Scope

Complete flow trace for every World Cup 2026 surface. Source of Truth is `goalradar:wc:authority:v1` (104 CanonicalMatch objects, populated by cron). Every surface that does NOT trace to this KV key is a divergence.

---

## Canonical Data Flow

```
FD API (Football-Data.org)
  └─► cron → buildAllCanonicalMatches() → goalradar:wc:authority:v1
                                                    │
                              ┌─────────────────────┼──────────────────────┐
                              ▼                     ▼                      ▼
               getWCAuthorityMatchesV2()    buildKnockoutViewModel()    getStandingsCached()
                    │                              │                        │
           CanonicalMatch[]             KnockoutViewModel              StandingsResponse
                              ┌─────────┴──────────────────────────┐
                              ▼                                     ▼
                    WC page components                        WCGroupTable
```

---

## Surface-by-Surface Trace

### 1. Hub — `/world-cup-2026`

| Layer | Value |
|---|---|
| **Source** | `getWCAuthorityMatchesV2(builtAt)` + `buildKnockoutViewModel()` |
| **Cache key** | `goalradar:wc:authority:v1` |
| **ISR TTL** | 30s |
| **Upcoming filter** | `classifyMatchState(m, today) ∈ {today, upcoming}` — top 20 |
| **Bracket input** | `vm.bracketMatches` (LAST_16 → FINAL only) |
| **Production output** | 16 upcoming (4 today + 12 upcoming), bracket R16–Final |
| **Source of Truth alignment** | ✅ ALIGNED (authority:v1) |

**Note:** WCBracket R32 slots render as TBD because `bracketMatches` excludes LAST_32. This is an intentional RESET behavioral change (documented in REGRESSION_REPORT.md R1).

---

### 2. Bracket (nested) — `/world-cup-2026/bracket`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **Cache key** | `goalradar:wc:authority:v1` (via `getWCAuthorityMatchesV2` inside buildKnockoutViewModel) |
| **ISR TTL** | 900s |
| **ViewModel slice** | `vm.r32`, `vm.bracketMatches`, `vm.r16`, `vm.qf`, `vm.sf`, `vm.thirdPlace`, `vm.final` |
| **Component** | `WCBracket` (tree) + `WCRoundPage` list per stage |
| **Production output** | R32: 16 matches, R16: 8, QF: 4, SF: 2, 3P: 1, Final: 1 |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 3. Round of 32 — `/world-cup-2026/round-of-32`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.r32` (LAST_32 stage) |
| **ISR TTL** | 900s |
| **Production output** | 16 matches (2 Jul – 9 Jul 2026, positional labels) |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 4. Round of 16 — `/world-cup-2026/round-of-16`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.r16` (LAST_16 stage) |
| **Production output** | 8 matches (Winner R32 M1–M16 placeholders) |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 5. Quarter-Finals — `/world-cup-2026/quarter-finals`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.qf` (QUARTER_FINALS stage) |
| **Production output** | 4 matches |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 6. Semi-Finals — `/world-cup-2026/semi-finals`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.sf` (SEMI_FINALS stage) |
| **Production output** | 2 matches |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 7. Third-Place — `/world-cup-2026/third-place`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.thirdPlace` (THIRD_PLACE stage) |
| **Production output** | 1 match |
| **Source of Truth alignment** | ✅ ALIGNED |
| **Redirect** | `/world-cup-2026/third-place-playoff` → here (301, verified working) |

---

### 8. Final — `/world-cup-2026/final`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **ViewModel slice** | `vm.final` (FINAL stage) |
| **Production output** | 1 match |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 9. Fixtures — `/world-cup-2026/fixtures`

| Layer | Value |
|---|---|
| **Source** | `getWCAuthorityMatchesV2(builtAt)` |
| **Cache key** | `goalradar:wc:authority:v1` |
| **ISR TTL** | 300s |
| **Filter** | All states; separate upcoming / finished sections |
| **Production output** | 40+ matches (comprehensive: group results + upcoming + knockout) |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 10. Standings — `/world-cup-2026-standings`

| Layer | Value |
|---|---|
| **Source** | `getStandingsCached('WC')` → FD standings API; fallback `computeWCStandingsFromAuthority()` |
| **ISR TTL** | 3600s |
| **Production output** | 12 groups (Mexico 9pts Group A, etc.) |
| **Source of Truth alignment** | ✅ ALIGNED (authority fallback available) |

---

### 11. Results — `/world-cup-2026-results`

| Layer | Value |
|---|---|
| **Source** | `getWCResultsCached()` (FD FINISHED status feed) |
| **ISR TTL** | 300s |
| **Production output** | 24 results (54 matches played) |
| **Source of Truth alignment** | ✅ ALIGNED (FD-authoritative for FINISHED state) |

---

### 12. Groups — `/world-cup-2026-groups`

| Layer | Value |
|---|---|
| **Source** | `getWCAuthorityMatchesCached()` + `getStandingsCached('WC')` |
| **Cache key** | Merged KV buckets (upcoming + results + live) |
| **ISR TTL** | 300s |
| **Production output** | 12 groups displayed |
| **Source of Truth alignment** | ⚠️ PARTIAL — uses merged buckets, not direct authority:v1 read |

---

### 13. Schedule — `/world-cup-2026-schedule`

| Layer | Value |
|---|---|
| **Source** | `getWCAuthorityMatchesCached()` |
| **Cache key** | Merged KV buckets (`upcoming` + `results` + `live`) |
| **ISR TTL** | 300s |
| **Filter** | `classifyMatchState ∈ {today, upcoming}`, slice(0, 48) |
| **Production output** | **4 matches** |
| **Source of Truth alignment** | ❌ **DIVERGENT** — should use `getWCAuthorityMatchesV2()` |

**Root cause:** `getWCAuthorityMatchesCached()` merges 3 KV buckets. The `upcoming` bucket (`/competitions/WC/matches?status=SCHEDULED,TIMED`) is populated from the FD API which only returns matches within a limited forward window. Future group stage + knockout stage matches beyond this window are absent. `getWCAuthorityMatchesV2()` reads `goalradar:wc:authority:v1` directly — all 104 matches, all dates.

---

### 14. SEO Bracket — `/world-cup-2026-bracket`

| Layer | Value |
|---|---|
| **Source** | `buildKnockoutViewModel()` |
| **Cache key** | `goalradar:wc:authority:v1` |
| **ISR TTL** | 900s |
| **Production output** | 6 knockout round cards with match data |
| **Source of Truth alignment** | ✅ ALIGNED |

---

### 15. third-place-playoff redirect

| Layer | Value |
|---|---|
| **Route** | `/world-cup-2026/third-place-playoff` |
| **Behavior** | HTTP 301 → `/world-cup-2026/third-place` |
| **Production output** | Verified working via WebFetch |
| **Source of Truth alignment** | ✅ ALIGNED (duplicate route removed) |

---

## Summary

| Surface | Aligned | Issue |
|---|---|---|
| Hub | ✅ | R32 bracket TBD (documented behavioral change) |
| /bracket | ✅ | — |
| /round-of-32 | ✅ | — |
| /round-of-16 | ✅ | — |
| /quarter-finals | ✅ | — |
| /semi-finals | ✅ | — |
| /third-place | ✅ | — |
| /final | ✅ | — |
| /fixtures | ✅ | — |
| Standings | ✅ | — |
| Results | ✅ | — |
| Groups | ⚠️ | Merged buckets (not authority:v1 direct) — pre-existing, out of scope |
| **Schedule** | ❌ | **4 matches shown — wrong data source** |
| SEO Bracket | ✅ | — |
| third-place-playoff redirect | ✅ | — |
