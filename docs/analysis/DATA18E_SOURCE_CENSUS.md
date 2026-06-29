# DATA-18E Phase 1 — WC Page Source Census

Date: 2026-06-17  
Commit: `0c963a8` (post-Phase 4 migration)

---

## All World Cup Listing Pages — Data Source Inventory

| Page | Route | Data Source (pre-18E) | Data Source (post-18E) | Cache Key | ISR |
|------|-------|----------------------|------------------------|-----------|-----|
| Hub | `/world-cup-2026` | `getWCLiveMatchesCached()` + `getWCAuthorityMatchesCached()` + `getWCKnockoutMatchesCached()` | `getWCAuthorityMatchesV2()` + `getWCKnockoutMatchesCached()` | `goalradar:wc:authority:v1` | 30s |
| Results | `/world-cup-2026/results` | `getWCAuthorityMatches()` (CANARY: `getWCAuthorityMatchesV2()`) | `getWCAuthorityMatchesV2()` | `goalradar:wc:authority:v1` | 300s |
| Fixtures | `/world-cup-2026/fixtures` | `getWCAuthorityMatches()` | `getWCAuthorityMatchesV2()` | `goalradar:wc:authority:v1` | 900s |
| Group | `/world-cup-2026/[group]` | `getWCAuthorityMatches()` | `getWCAuthorityMatchesV2()` | `goalradar:wc:authority:v1` | 3600s |
| Matches Today | `/world-cup-2026/matches-today` | `getWCResultsCached()` + `getWCLiveMatchesCached()` + `getUpcomingMatchesCached('WC')` | `getWCAuthorityMatchesV2()` | `goalradar:wc:authority:v1` | 60s |
| Matches Tomorrow | `/world-cup-2026/matches-tomorrow` | `getUpcomingMatchesCached('WC')` | `getWCAuthorityMatchesV2()` | `goalradar:wc:authority:v1` | 60s |

---

## Authority Cache Key Topology

| KV Key | Written By | TTL | Read By |
|--------|-----------|-----|---------|
| `goalradar:wc:authority:v1` | `writeAuthorityCache(builtAt)` — cron | live=30s, today=300s, normal=900s | `readAuthorityCache()` → `getWCAuthorityMatchesV2()` |
| `goalradar:dr:wc:authority:v1` | `writeAuthorityCache(builtAt)` — cron | 7 days | `readAuthorityCache()` DR fallback |
| `goalradar:live:wc-matches` | live feed cron | 30s | **removed from listing pages** |
| `goalradar:/competitions/WC/matches?status=FINISHED` | results feed cron | 300s | **removed from listing pages** |
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | upcoming feed cron | 300s | **removed from listing pages** |

---

## Non-Listing Pages (not migrated — out of scope)

| Page | Route | Source | Notes |
|------|-------|--------|-------|
| Match detail | `/match/[id]` | `getOrBuildMatchSnapshot()` | Uses per-match snapshot, not authority cache |
| Groups index | `/world-cup-2026/groups` | `getWCAuthorityMatches()` | Legacy — not a listing page |
| Knockout bracket | `/world-cup-2026/bracket` | `getWCKnockoutMatchesCached()` | Separate knockout feed |
| Schedule | `/schedule` | `getUpcomingMatchesCached()` | Multi-competition, not WC-only |
| Live | `/live` | `getWCLiveMatchesCached()` | Live-only feed, correct scope |
