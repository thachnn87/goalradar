# LIVE SOURCE INVENTORY — DATA-18B.3E Phase 1

**Task:** DATA-18B.3E LIVE-SOURCE-UNIFICATION
**Date:** 2026-06-23
**Method:** grep across `src/app/**/page.tsx` for `state === 'live'`, `classifyMatchState`, `IN_PLAY`, `PAUSED`, `LIVE NOW`, and the SSOT providers.

---

## Bug that triggered this task

Production showed:
- `/live` — no live matches
- `/world-cup-2026-results` — **France vs Iraq inside "Live Now"**
- France vs Iraq detail page — **FULL TIME**

→ at least one page derived liveness from authority state, not the live SSOT.

---

## Pre-migration live-determination callers (the 6 target pages)

| Page | File | Live decision (BEFORE) | Source class |
|------|------|------------------------|--------------|
| Hub | `world-cup-2026/page.tsx:301,407` | `allLive = getCurrentLiveMatches()` → live grid | **SSOT** ✅ |
| Schedule | `schedule/page.tsx:83,180` | MatchCard reads `match.status` (authority) | **Authority** ❌ |
| Today | `world-cup-2026/matches-today/page.tsx:318,191,62` | `filter(m.state === 'live')` + MatchRow `m.state` | **Authority** ❌ |
| Tomorrow | `world-cup-2026/matches-tomorrow/page.tsx:305` | filter `state !== 'finished'`; never renders live badge | none |
| Results | `world-cup-2026/results/page.tsx:99,78` | `entries.filter(e.state === 'live')` | **Authority** ❌ |
| WC Results | `world-cup-2026-results/page.tsx:94,92` | `classifyMatchState(m) === 'live'` | **Authority** ❌ |

**The bug page:** `/world-cup-2026-results` — `classifyMatchState(m) === 'live'` read authority `status`/`state`, which lagged behind the live-cache after France vs Iraq ended.

> Routing note: `/world-cup-2026/results` 308-redirects to `/world-cup-2026-results`
> (confirmed in production; `sitemap.ts:20` SITEMAP-3). The two "Results" pages
> collapse to one served page. The redirected file was still migrated for
> defense-in-depth.

---

## Other live-status references (NOT in scope — single-match detail / non-WC)

These read `status === IN_PLAY/PAUSED` for a **single match they already own** (detail
pages, predict pages, bracket) — they are not listing pages choosing which matches
are live from a list, so they are correct as-is:

| File | Lines | Why out of scope |
|------|-------|------------------|
| `match/[id]/page.tsx` | 70,187,233,… | single-match detail; status IS the match's own state |
| `predict/[id]/page.tsx` | 254,255 | single-match prediction |
| `world-cup-2026-predictions/page.tsx` | 143,167 | per-card status display |
| `world-cup-2026/bracket/page.tsx` | 25,228,… | bracket node status |
| `world-cup-2026/fixtures/page.tsx` | 244,251 | classify for finished/live *badge* on the legacy fixtures page (not a WC live "Live Now" section) |
| `world-cup-2026/[group]/page.tsx` | 663 | classify for group bucketing |
| `live/page.tsx` | 37 | `getLiveMatches()` — all-competition SSOT, same KV key |
| `page.tsx` (Home) | 568,603 | already uses `getCurrentLiveMatches()`; `liveStrays` merges authority IN_PLAY into the SSOT list, not a competing source |

---

## Canonical live source (target for all)

```
getCurrentLiveMatches() / getLiveMatchIdSet()   [src/lib/wc-live-ssot.ts]
  └── getWCLiveMatchesCached()                   [src/lib/api.ts]
        └── KV goalradar:live:matches (30s) + overlay + filter IN_PLAY/PAUSED
```

**Phase 1 complete: 4 pages (Schedule, Today, Results, WC Results) derived live
from authority and must migrate. Hub already SSOT. Tomorrow renders no live.**
