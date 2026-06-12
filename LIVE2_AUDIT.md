# LIVE-2 Audit — World Cup Live Banner CTA
## GoalRadar · Sprint LIVE-2

Generated: 2026-06-12

---

## The offending component

`src/components/WCCountdown.tsx` — the tournament-state banner used on:

| Page | Usage | Problem |
|------|-------|---------|
| `/world-cup-2026` hub | `<WCCountdown compact />` | live-state CTA `Live →` hard-linked **`/world-cup-2026`** — **self-referencing** (the dead action reported) |
| `/schedule?competition=WC` | `<WCCountdown compact />` | same hard link — not self-referencing, but lands on the hub, not a live experience |

(Not to be confused with `WCCountdownBanner` — the slim homepage strip,
whose live CTA was already fixed to `/live` in DATA-1.)

## Live match routing audit

- Live match set: `getWCLiveMatchesCached()` — KV live cache (30 s),
  snapshot-overlaid (DATA-2; finished matches filtered). The hub already
  calls it on every render → **the live list is available for free**.
- Canonical match URL: `matchPath(id, home, away)` →
  `/match/{id}-{home}-vs-{away}` (used everywhere; 308-canonicalised).
- `/live` page: exists, ISR 30 s, lists in-play matches — the correct
  multi-match destination.
- The schedule page does NOT fetch live data — adding a fetch there would
  violate "no provider calls added" spirit; instead the CTA defaults to
  `/live` when no live list is provided.

## Design

`WCCountdown` gains optional props (server-computed, no fetches added):

- `liveMatches?: Match[]` — passed by pages that already have them (hub).
- `currentPath?: string` — enables the self-reference guard.

CTA decision (live state only):

| Live count | Label | Destination |
|-----------|-------|-------------|
| exactly 1 | `Match Center →` | canonical match page (e.g. `/match/537328-korea-republic-vs-czechia`) |
| 0 or ≥ 2 (or list not provided) | `View Live Scores →` | `/live` |
| any, when destination === currentPath | `View Live Scores →` | `/live` (guard) |

Subtitle upgrades alongside: single match shows "X vs Y — in play",
multiple shows "N matches in play".

Telemetry: CTA rendered through new client `LiveBannerCTA` →
`live_banner_click` GA4 event `{match_id, destination, live_match_count}`
(server components cannot attach onClick — this is the only client part).
