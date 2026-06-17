# DATA-17 World Cup Authority Layer

Date: 2026-06-17
Commit: 1a4af33

---

## Objective

Create a single World Cup Authority Layer so all WC match pages consume the same
authoritative source, with consistent status classification across every page.

---

## Root Causes Fixed

| ID | Problem | Location |
|----|---------|---------|
| P1 | `getRecentMatchesCached('WC')` used date-scoped key (`dateFrom/dateTo`) — same RC-1 from DATA-16D still present on group pages | `src/app/world-cup-2026/[group]/page.tsx:664` |
| P2 | Results page filtered FINISHED with inline `m.status === 'FINISHED'` instead of `classifyMatchState()` | `src/app/world-cup-2026-results/page.tsx:102` |
| P3 | Results page made 2 parallel calls (`getWCResultsCached + getWCLiveMatchesCached`) instead of one authority call | `src/app/world-cup-2026-results/page.tsx:92` |
| P4 | Fixtures page (`/world-cup-2026/fixtures`) used inline `m.status` checks in JSX | `src/app/world-cup-2026/fixtures/page.tsx` |

---

## Architecture

### Authority Stack

```
getWCAuthorityMatches()
        ↓  (delegates to getWCAuthorityMatchesCached — DATA-4 implementation)
  ┌──────────────────────────────────────────────────────────────────┐
  │  Priority 1: Live cache                                          │
  │    goalradar:live:matches (30s TTL)                              │
  │    Source: refreshLiveMatches → providerManager.getLiveMatches() │
  │    Status: IN_PLAY / PAUSED                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │  Priority 2: WC results feed                                     │
  │    goalradar:/competitions/WC/matches?status=FINISHED (12h TTL) │
  │    Source: orchestrator → providerManager.getResults('WC')       │
  │    Status: FINISHED (never changes after full-time)              │
  ├──────────────────────────────────────────────────────────────────┤
  │  Priority 3: WC upcoming feed                                    │
  │    goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED    │
  │    (30min TTL)                                                   │
  │    Source: orchestrator → providerManager.getFixtures('WC')      │
  │    Status: SCHEDULED / TIMED (before kickoff)                    │
  ├──────────────────────────────────────────────────────────────────┤
  │  Overlay: per-match snapshots                                    │
  │    goalradar:match:{id} (7d TTL for FINISHED; ~kickoff for TIMED)│
  │    Built by: match-snapshot.ts on page visits + orchestrator     │
  │    Contains: ESPN-enriched data (goal scorers, minute)           │
  │    Advances: SCHEDULED/TIMED → FINISHED if snapshot confirms it  │
  └──────────────────────────────────────────────────────────────────┘
        ↓
  CanonicalMatch[]  (= Match, typed alias for call-site clarity)
        ↓
  classifyMatchState(m, todayUTC)
        ↓
  'live' | 'finished' | 'today' | 'upcoming' | 'other'
```

STATE_RANK merge rule: `FINISHED (3) > IN_PLAY/PAUSED (2) > SCHEDULED/TIMED (0)`.
Higher rank always wins when the same match ID appears in multiple feeds.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/api.ts` | Add `CanonicalMatch` type alias + `getWCAuthorityMatches()` public export (delegates to `getWCAuthorityMatchesCached`) |
| `src/app/world-cup-2026-results/page.tsx` | Replace `getWCResultsCached + getWCLiveMatchesCached` (2 calls) with `getWCAuthorityMatches()` (1 call); replace inline `m.status === 'FINISHED'` with `classifyMatchState()` |
| `src/app/world-cup-2026/[group]/page.tsx` | Replace `getUpcomingMatchesCached('WC') + getRecentMatchesCached('WC')` (2 calls, buggy date-scoped key) with `getWCAuthorityMatches()` (1 call); replace inline `m.status === 'FINISHED'` with `classifyMatchState()` |
| `src/app/world-cup-2026/fixtures/page.tsx` | Replace `getWCAuthorityMatchesCached` with `getWCAuthorityMatches()`; replace `m.status === 'FINISHED'` / `m.status === 'IN_PLAY'` JSX checks with `classifyMatchState()` |
| `DATA17_SOURCE_MAP.md` | Phase 1 audit document |

### Pre-existing (no changes needed)

| File | Status |
|------|--------|
| `src/app/world-cup-2026/page.tsx` (Hub) | Already uses `getWCAuthorityMatchesCached` + `classifyMatchState()` ✅ |
| `src/app/world-cup-2026-schedule/page.tsx` | Already uses `getWCAuthorityMatchesCached` + `classifyMatchState()` ✅ |
| `src/app/world-cup-2026-standings/page.tsx` | Match-free page (standings only) — out of scope |
| `src/app/world-cup-2026-groups/page.tsx` | Match-free page (standings only) — out of scope |
| `src/app/live/page.tsx` | Cross-competition page (`getLiveMatches`) — not a WC authority page |

---

## Removed Call Sites

The date-scoped `getRecentMatchesCached('WC')` call that was the original DATA-16D root
cause (RC-1) is now eliminated from **all** WC pages:

| Page | Removed call | Replaced with |
|------|-------------|---------------|
| `/world-cup-2026/[group]` | `getRecentMatchesCached('WC')` | `getWCAuthorityMatches()` |
| `/world-cup-2026/[group]` | `getUpcomingMatchesCached('WC')` (separate) | `getWCAuthorityMatches()` (merged) |
| `/world-cup-2026-results` | `getWCResultsCached()` | `getWCAuthorityMatches()` |
| `/world-cup-2026-results` | `getWCLiveMatchesCached()` | `getWCAuthorityMatches()` |

---

## Validation Evidence

Production validation performed on 2026-06-17 after commit `1a4af33` deployed.

### 4 required matches — confirmed across pages

| Match | Score | Hub | Results | Group page | Schedule |
|-------|-------|-----|---------|------------|---------|
| Argentina vs Algeria | 3 – 0 FT | ✅ Recent Results | ✅ Recent Results | ✅ Group J Results | ✅ NOT shown (correct — finished) |
| Germany vs Curaçao | 7 – 1 FT | ✅ Recent Results | ✅ Recent Results | – | ✅ NOT shown (correct) |
| France vs Senegal | 3 – 1 FT | ✅ Recent Results | ✅ Recent Results | – | ✅ NOT shown (correct) |
| Iraq vs Norway | 1 – 4 FT | ✅ Recent Results | ✅ Recent Results | – | ✅ NOT shown (correct) |

**Score consistency:** identical across all pages (source is the same authority stack).

**Schedule page:** correctly shows only upcoming fixtures — no finished match appears as upcoming. `classifyMatchState()` filters ensure this consistently.

**Group J page (`/world-cup-2026/group-j`):** Argentina 3 – Algeria 0 FT shown in the
Results section. Upcoming fixtures section shows the remaining group matches. The old
`getRecentMatchesCached('WC')` bug that would have caused an empty Results section here
is eliminated.

---

## Constraints Respected

- vercel.json: not touched
- No new provider calls, no new KV keys, no new caches
- TypeScript: `npx tsc --noEmit` — 0 errors
- No new features beyond authority layer consolidation
