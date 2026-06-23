# STATE SOURCE MAP — DATA-18B.3D Phase 4

**Task:** DATA-18B.3D Phase 4
**Date:** 2026-06-23
**Scope:** Every WC page that renders match state — source function / live source / state source.

---

## Page matrix

| Page | Source function | Live source | State source (render) | ISR |
|------|-----------------|-------------|-----------------------|-----|
| `/world-cup-2026` (Hub) | `getWCAuthorityMatchesV2(builtAt, …)` | `getCurrentLiveMatches()` (SSOT) | `classifyMatchState(m, today)` | 30s |
| `/world-cup-2026/results` | `getWCAuthorityMatchesV2(builtAt, …)` | `entries.filter(e => e.state === 'live')` | `m.state` (CanonicalMatch) | 300s |
| `/world-cup-2026-results` | `getWCAuthorityMatches()` | `classifyMatchState(m) === 'live'` | `classifyMatchState(m, today)` + `m.status` badge | 300s |
| `/world-cup-2026/matches-today` | `getWCAuthorityMatchesV2(builtAt, …)` | `m.state === 'live'` | `m.state` (CanonicalMatch) | 60s |
| `/world-cup-2026/matches-tomorrow` | `getWCAuthorityMatchesV2(builtAt, …)` | N/A (filter `state !== 'finished'`) | date-based, no live/FT badge | 60s |
| `/schedule` (WC) | `getWCAuthorityMatchesCached()` | `getCurrentLiveMatches()` (SSOT) | `MatchCard` component (from `m.status`) | 300s |

Line references: `world-cup-2026/page.tsx:285,288,298`;
`world-cup-2026/results/page.tsx:96,99`; `world-cup-2026-results/page.tsx:91,92`;
`matches-today/page.tsx:308,318`; `matches-tomorrow/page.tsx:302,305`;
`schedule/page.tsx:83,220,250`.

---

## Source-function chains

### A. Authority cache (display state for all pages)

```
getWCAuthorityMatchesV2(builtAt) | getWCAuthorityMatchesCached() | getWCAuthorityMatches()
  └── readAuthorityCache(builtAt)                     [src/lib/authority-cache.ts:449]
        1. primary  goalradar:wc:authority:v1   (30s/300s/900s TTL)
        2. DR       goalradar:dr:wc:authority:v1 (7d TTL)
              └── DR live-staleness guard: if liveCount>0 AND age>120s → cold rebuild
        3. cold rebuild (FD feeds + snapshot overlay) → write-back primary
  → CanonicalMatch[] with .state ∈ {live, finished, scheduled, cancelled}
```

`CanonicalMatch.state` is itself **snapshot-overlaid**: `buildCanonicalMatch()`
merges the snapshot for finished matches (ESPN enrichment, snapshot score when
newer). So the authority `state` is the product of FD feeds + snapshot, not a
separate competing source.

### B. Snapshot KV (per-match detail + enrichment)

```
goalradar:match:{id}  → MatchSnapshot { match.status, match.score, generatedAt }
```

Written by: orchestrator prewarm, on-demand cold build on match-detail page hit.
Consumed by: authority cold rebuild (overlay), match detail page.
**Not read directly by any listing page for state** — listing pages get
snapshot influence only *through* the authority cache overlay.

### C. Live cache (live-gating SSOT)

```
getCurrentLiveMatches()                               [src/lib/wc-live-ssot.ts]
  └── getWCLiveMatchesCached()                         [src/lib/api.ts:479]
        └── goalradar:live:matches (30s TTL) + overlayMatchStates() + filter IN_PLAY/PAUSED
```

---

## The one inconsistency Phase 4 found

Two distinct mechanisms decide **"is this match live"** depending on the page:

| Mechanism | Pages | Reads |
|-----------|-------|-------|
| **SSOT** — `getCurrentLiveMatches()` | Hub, Schedule | `goalradar:live:matches` |
| **Authority filter** — `m.state === 'live'` / `classifyMatchState()==='live'` | `/world-cup-2026/results`, `/world-cup-2026-results`, `/matches-today` | `goalradar:wc:authority:v1` (overlaid) |

Both ultimately depend on the same live feed (`live-cache` feeds the authority
cold rebuild's `liveMap`), so they **converge in practice** — confirmed by the
matrix (authority live=1 agreed with live-cache live=1 in sample 1). But they
are two code paths, which is the residual divergence *risk* (not a current
divergence). See STATE_FIX_PLAN.md item 1.

---

## Timestamp surfaces (for Phase 3 age math)

| Source | updatedAt field | Granularity |
|--------|-----------------|-------------|
| Authority | `CanonicalMatch.lastUpdated` (per match) + envelope `builtAt` | per-match + batch |
| Snapshot | `snapshot.generatedAt` (epoch ms) | per-match |
| Live cache | batch `fetchedAt` (epoch ms) | whole batch (no per-match) |

---

**Phase 4 complete. 6 pages mapped. One residual live-source split (SSOT vs
authority-filter) identified as the only structural inconsistency.**
