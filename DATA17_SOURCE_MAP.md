# DATA-17 World Cup Source Map

Date: 2026-06-17
Phase: 1 of 6

---

## Page Inventory

| Page | Route | File |
|------|-------|------|
| Hub | `/world-cup-2026` | `src/app/world-cup-2026/page.tsx` |
| Results | `/world-cup-2026-results` | `src/app/world-cup-2026-results/page.tsx` |
| Schedule | `/world-cup-2026-schedule` | `src/app/world-cup-2026-schedule/page.tsx` |
| Fixtures | `/world-cup-2026/fixtures` | `src/app/world-cup-2026/fixtures/page.tsx` |
| Live | `/live` | `src/app/live/page.tsx` |
| Standings | `/world-cup-2026-standings` | `src/app/world-cup-2026-standings/page.tsx` |
| Groups (index) | `/world-cup-2026-groups` | `src/app/world-cup-2026-groups/page.tsx` |
| Group (detail) | `/world-cup-2026/[group]` | `src/app/world-cup-2026/[group]/page.tsx` |

---

## Source Map — Pre-DATA-17

| Page | Data Source(s) | Cache Key(s) | Status Logic | Issues |
|------|---------------|--------------|--------------|--------|
| Hub | `getWCAuthorityMatchesCached()` + `getWCLiveMatchesCached()` + `getWCKnockoutMatchesCached()` + `getStandingsCached('WC')` | `/competitions/WC/matches?status=SCHEDULED,TIMED` + `/competitions/WC/matches?status=FINISHED` + `live:matches` + `/competitions/WC/standings` | `classifyMatchState()` ✅ | None — already fully migrated in DATA-16D |
| Results | `getWCResultsCached()` + `getWCLiveMatchesCached()` | `/competitions/WC/matches?status=FINISHED` + `live:matches` | Inline `m.status === 'FINISHED'` ⚠️ | Does not use `classifyMatchState()`; 2 separate fetches |
| Schedule | `getWCAuthorityMatchesCached()` | `/competitions/WC/matches?status=SCHEDULED,TIMED` + `/competitions/WC/matches?status=FINISHED` + `live:matches` | `classifyMatchState()` ✅ | None — already fully migrated |
| Fixtures | `getWCAuthorityMatchesCached()` | Same as Schedule | `m.status` inline ⚠️ | Inline status checks, not classifyMatchState |
| Live | `getLiveMatches()` | `goalradar:live:matches` (30s TTL) | None | Cross-competition page — not a WC-authority page; out of scope for authority migration |
| Standings | `getStandingsCached('WC')` | `/competitions/WC/standings` | N/A — no match data | None |
| Groups (index) | `getStandingsCached('WC')` | `/competitions/WC/standings` | N/A — no match data | None |
| Group (detail) | `getStandingsCached('WC')` + `getUpcomingMatchesCached('WC')` + **`getRecentMatchesCached('WC')`** | `…?status=SCHEDULED,TIMED` + **`…?dateFrom=…&dateTo=…`** (date-scoped, unstable) | Inline `m.status === 'FINISHED'` ⚠️ | **HIGH**: `getRecentMatchesCached` uses the date-scoped key from RC-1 (DATA-16D root cause). Still present on group pages. |

---

## Problems Identified

### P1 — Group page uses `getRecentMatchesCached('WC')` [HIGH]
`src/app/world-cup-2026/[group]/page.tsx:664`

Uses the date-scoped key (`/competitions/WC/matches?dateFrom=…&dateTo=…`) that:
- Rotates daily at midnight UTC (empty window on rollover)
- Has no disaster-recovery fallback
- Is dispatched to `getAllMatches` not `getResults` by `dispatchToProvider`

Fix: replace `getUpcomingMatchesCached + getRecentMatchesCached` with `getWCAuthorityMatches()` and split via `classifyMatchState()`.

### P2 — Results page inline status check [LOW]
`src/app/world-cup-2026-results/page.tsx:102`

`results.filter((m) => m.status === 'FINISHED' && !liveIds.has(m.id))` — bypasses `classifyMatchState()`.

Fix: use `classifyMatchState(m, today) === 'finished'`.

### P3 — Results page uses 2 separate fetches [LOW]
`src/app/world-cup-2026-results/page.tsx:92-95`

Two `Promise.allSettled` calls to `getWCResultsCached()` + `getWCLiveMatchesCached()`. A single call to `getWCAuthorityMatches()` provides both, simplifying the page.

### P4 — Fixtures page inline status check [LOW]
`src/app/world-cup-2026/fixtures/page.tsx`

Uses `getWCAuthorityMatchesCached()` but splits by `m.status` inline rather than `classifyMatchState()`.

---

## Authority Layer Design (DATA-17 target state)

```
getWCAuthorityMatches()
        ↓
  Live cache  (goalradar:live:matches, 30s)          ← IN_PLAY / PAUSED
  WC results  (/competitions/WC/matches?status=FINISHED, 12h)  ← FINISHED
  WC upcoming (/competitions/WC/matches?status=SCHEDULED,TIMED, 30m)  ← SCHEDULED / TIMED
  Snapshot overlay (goalradar:match:{id}, ESPN-enriched, 7d for FINISHED)
        ↓
  CanonicalMatch[]  — all 104 WC matches in authoritative state
        ↓
  classifyMatchState(m, today)
        ↓
  live / finished / today / upcoming / other
```

All WC pages read from `getWCAuthorityMatches()` and split via `classifyMatchState()`.

---

## Cache Key Summary

| Cache key | TTL | Written by | Read by |
|-----------|-----|-----------|---------|
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 30 min | Orchestrator → `getFixtures('WC')` | `getUpcomingMatchesCached` (→ `getWCAuthorityMatches`) |
| `goalradar:/competitions/WC/matches?status=FINISHED` | 12 h | Orchestrator → `getResults('WC')` | `getWCResultsCached` (→ `getWCAuthorityMatches`) |
| `goalradar:live:matches` | 30 s | `refreshLiveMatches` | `getWCLiveMatches` (→ `getWCAuthorityMatches`) |
| `goalradar:match:{id}` | 30s–7d | `match-snapshot.ts` | `overlayMatchStates` (inside `getWCAuthorityMatches`) |
| `goalradar:/competitions/WC/standings` | 1 h | Orchestrator → `getStandings('WC')` | `getStandingsCached('WC')` |
| `goalradar:/competitions/WC/matches?dateFrom=…&dateTo=…` | 30 min | Orchestrator → `getAllMatches('WC')` | **DEPRECATED** — removed from all WC pages in DATA-17 |
