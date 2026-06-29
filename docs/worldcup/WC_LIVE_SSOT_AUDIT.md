# WC Live SSOT Audit

**Task:** WC-LIVE-SSOT-HARDENING Phase 1
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Objective

Enumerate every caller that reads WC live-match state (live count, in-play list, liveCount field) and identify which KV source they read.

---

## Live-State Callers

### Function-level inventory

| Function | Location | Backing Store | Cadence | Notes |
|----------|----------|--------------|---------|-------|
| `getWCLiveMatchesCached()` | `src/lib/api.ts:479` | KV `goalradar:live:matches` (WC) + snapshot overlay | React.cache dedup | Filters to IN_PLAY/PAUSED after overlay |
| `getLiveMatches()` | `src/lib/api.ts:182` | KV `goalradar:live:matches` (all competitions) | React.cache dedup | Provider fallback on KV miss |
| `getWCAuthorityMatchesV2().filter(state==='live')` | Hub page | KV `goalradar:wc:authority:v1` | Authority cache (live=30s TTL) | Derives live from authority cache |
| `getWCAuthorityMatches().filter(classify==='live')` | Results page | Direct authority rebuild | Cold, uncached | SEO results hub |

### Page-level live-state consumers (pre-fix)

| Page | File | Live Source | Source Type | ISR Cadence |
|------|------|------------|-------------|-------------|
| Home — WCCountdownBanner | `src/app/page.tsx:567` | `getWCLiveMatchesCached()` | KV live-cache | 30 s |
| Home — WCHero (liveCount) | `src/app/page.tsx:567` | `getWCLiveMatchesCached()` | KV live-cache | 30 s |
| Schedule — WCCountdown | `src/app/schedule/page.tsx:218` | `getWCLiveMatchesCached()` | KV live-cache | 300 s |
| Hub — WCCountdown | `src/app/world-cup-2026/page.tsx:297` | Authority cache `filter(state==='live')` | KV authority | 30 s |
| Hub — live match grid | `src/app/world-cup-2026/page.tsx:297` | Authority cache `filter(state==='live')` | KV authority | 30 s |
| Watch-live | `src/app/world-cup-2026/watch-live/page.tsx:5` | `getWCLiveMatchesCached` (alias) | KV live-cache | 60 s |
| Live page | `src/app/live/page.tsx:37` | `getLiveMatches()` | KV live-cache (all) | 30 s |
| Results (`/world-cup-2026/results`) | `src/app/world-cup-2026/results/page.tsx:99` | Authority cache `filter(state==='live')` | KV authority | 300 s |
| Results (`/world-cup-2026-results`) | `src/app/world-cup-2026-results/page.tsx:94` | `getWCAuthorityMatches()` classified | Cold rebuild | 300 s |
| Matches-today | `src/app/world-cup-2026/matches-today/page.tsx:318` | Authority cache `filter(state==='live')` | KV authority | varies |

---

## Two Distinct Live Sources

| Source | KV Key | Written by | Format |
|--------|--------|-----------|--------|
| **Live-cache** | `goalradar:live:matches` | Orchestrator refresh task (every 30 min); provider direct call on KV miss | `Match[]` (IN_PLAY/PAUSED) |
| **Authority-cache** | `goalradar:wc:authority:v1` | Orchestrator `buildWCAuthorityV2()` (every 30 min; write-back after cold rebuild) | `CanonicalMatch[]` with `state: 'live'` derived from snapshot overlay |

**Divergence window**: orchestrator writes live-cache and authority-cache in the same run, but the authority-cache's live state goes through an additional snapshot-overlay step. During a 30-min orchestrator gap, both decay at the same rate. Under DR fallback (primary KV absent), authority-cache has a 7-day DR copy while live-cache may be absent — causing authority-cache to show live matches while live-cache shows 0.

---

## KV Keys Confirmed

| Key | Source | Notes |
|-----|--------|-------|
| `goalradar:live:matches` | Live-cache | All competitions, IN_PLAY/PAUSED; WC-only variant uses competition filter post-read |
| `goalradar:wc:authority:v1` | Authority cache | Primary, TTL 30s (live) / 300s (today) / 900s (normal) |
| `goalradar:dr:wc:authority:v1` | Authority cache DR | 7-day TTL; staleness guard (120s) prevents false live from stale DR |

---

## Summary of Divergence Risk

The Hub page derived `allLive` from authority cache `filter(state==='live')` while Home and Schedule used live-cache `getWCLiveMatchesCached()`. During an orchestrator outage:
- Live-cache expires first (30s TTL) → cold provider rebuild → correct state
- Authority cache lives longer (30s live TTL, fallback to DR at 7 days) → may show stale live

If a match ENDS between orchestrator runs and the snapshot captures it as FINISHED before authority-cache rebuilds, authority-cache could show it as live while live-cache correctly shows 0.

---

**Phase 1: COMPLETE. Two live sources identified. Hub as the outlier (authority cache). Watch-live, Home, Schedule already using live-cache SSOT.**
