# WC Live State Inventory

**Task:** WC-LIVE-STATE-CONSISTENCY-AUDIT Phase 1
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Objective

Map every UI surface that displays a "LIVE" state signal and identify its data source.

---

## Live-State Decision Points

### 1. Home Page — `WCCountdownBanner` (`src/app/page.tsx:676`, `src/components/WCCountdownBanner.tsx`)

| Field | Value |
|-------|-------|
| Signal | "FIFA World Cup 2026 — LIVE NOW" / "WC26 LIVE NOW" |
| Decision logic (pre-fix) | `now >= openingMs` — **date-only check** |
| Data source (pre-fix) | None — purely time-based |
| Always shows "LIVE NOW" during | 2026-06-11 → 2026-07-19 (entire tournament) |
| Component accepts live data | No — no props |
| Verdict | **BUG: false positive** |

### 2. Home Page — `WCHero` (`src/app/page.tsx:680`, inline component)

| Field | Value |
|-------|-------|
| Signal | "LIVE NOW" badge, "N LIVE" count, live match grid |
| Decision logic | `wcLive.length > 0` |
| Data source | `getWCLiveMatchesCached()` → KV `goalradar:live:matches` |
| Correctly shows | Live count only when matches IN_PLAY/PAUSED |
| Verdict | **CORRECT** |

### 3. Schedule Page — `WCCountdown` (`src/app/schedule/page.tsx:244`, `src/components/WCCountdown.tsx`)

| Field | Value |
|-------|-------|
| Signal | "FIFA World Cup 2026 is LIVE" (pulsing red dot) |
| Decision logic (pre-fix) | `now >= openingMs && now <= tournamentEndMs` — **date-only check** |
| `liveMatches` prop passed | No — omitted entirely |
| `live` array value (pre-fix) | Always `[]` (default) |
| Subtitle rendered (pre-fix) | "USA · Canada · Mexico" — static fallback when `live.length === 0` |
| Verdict | **BUG: shows "is LIVE" + pulsing dot always during tournament** |

### 4. World Cup Hub — `WCCountdown` (`src/app/world-cup-2026/page.tsx:360`, `src/components/WCCountdown.tsx`)

| Field | Value |
|-------|-------|
| Signal | "FIFA World Cup 2026 is LIVE" (when `allLive.length > 0`) |
| Decision logic | `isLive (date) && liveMatches.length > 0` for red dot / "is LIVE" text |
| `liveMatches` prop | `allLive` — derived from `getWCAuthorityMatchesV2()` filtered to `state === 'live'` |
| Verdict | **CORRECT** (already passes real data) |

### 5. Live Page (`src/app/live/page.tsx`)

| Field | Value |
|-------|-------|
| Signal | Actual match list or "No live matches right now" |
| Decision logic | `getLiveMatches()` → KV `goalradar:live:matches` |
| Verdict | **CORRECT** |

---

## Divergence Matrix

| Page | Signal | Data Source | When LIVE shown |
|------|--------|-------------|-----------------|
| Home — WCCountdownBanner | "LIVE NOW" | Date range | Always (Jun 11 – Jul 19) |
| Home — WCHero | "LIVE NOW" / count | KV live cache | Only when IN_PLAY/PAUSED |
| Schedule | "is LIVE" + pulsing dot | Date range | Always (Jun 11 – Jul 19) |
| Hub | "is LIVE" + pulsing dot | Authority cache live filter | Only when IN_PLAY/PAUSED |
| Live page | Match list | KV live cache | Only when IN_PLAY/PAUSED |

**Three distinct data sources for the same signal** — date range, KV live cache, authority cache filtered.

---

## Root Signal: What Is Authoritative?

The canonical "are matches live right now?" answer is:

- **Primary**: `getWCLiveMatchesCached()` → KV `goalradar:live:matches` (written by orchestrator every 30 min)
- **Secondary**: `getWCAuthorityMatchesV2()` filtered to `state === 'live'` (same data, different access path)
- **Wrong**: `now >= openingMs && now <= tournamentEndMs` — this means "tournament is underway", not "matches are in play"

---

## Live State Surfaces Inventory

| Surface | File | Line | Component | Issue |
|---------|------|------|-----------|-------|
| Top banner | `WCCountdownBanner.tsx` | 69 | `WCCountdownBanner` | No live prop — always "LIVE NOW" |
| Schedule widget | `WCCountdown.tsx` | 92 + 135 | `WCCountdown` | No `liveMatches` passed from schedule page |
| Results hub CTA | `world-cup-2026-results/page.tsx` | 233 | inline `<Link>` | Text says "with stats" — destination has no stats |

---

**Phase 1: COMPLETE. 3 divergence points identified, 1 CTA text bug identified.**
