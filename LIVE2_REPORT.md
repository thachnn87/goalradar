# LIVE-2 Report — World Cup Live Banner CTA Fix
## GoalRadar · Sprint LIVE-2

Generated: 2026-06-12
Audit: `LIVE2_AUDIT.md`.

---

## Changes

| File | Change |
|------|--------|
| `src/components/WCCountdown.tsx` | Live-state CTA is now dynamic: 1 live match → `Match Center →` to the canonical match page; 0/many → `View Live Scores →` to `/live`; self-reference guard falls back to `/live` whenever the computed destination equals `currentPath`. Subtitle shows "X vs Y — in play" / "N matches in play". New optional props `liveMatches` / `currentPath` (no fetches inside the component). |
| `src/components/LiveBannerCTA.tsx` | NEW client CTA — fires `live_banner_click` `{match_id, destination, live_match_count}` on click; `prefetch={true}`. |
| `src/lib/analytics.ts` | `trackLiveBannerClick` |
| `src/app/world-cup-2026/page.tsx` | passes its already-fetched `liveMatches` + `currentPath="/world-cup-2026"` |
| `src/app/schedule/page.tsx` | passes `currentPath="/schedule"` (no live fetch on this page → CTA defaults to `/live`) |

## Behavior matrix

| Situation | CTA | Destination |
|-----------|-----|-------------|
| Exactly 1 live WC match (hub) | `Match Center →` | `/match/{id}-{home}-vs-{away}` |
| 2+ live matches (hub) | `View Live Scores →` | `/live` |
| 0 live (between matches, tournament running) | `View Live Scores →` | `/live` |
| Schedule page (no live list passed) | `View Live Scores →` | `/live` |
| Any case where destination = current page | `View Live Scores →` | `/live` (guard) |

The previous hard-coded `Live →` → `/world-cup-2026` (a no-op on the hub
itself) is gone in every state.

## Verification

- Running app (hub + schedule, rendered moments after the live match
  finished → 0 in play): both render `View Live Scores →` with
  `href="/live"`; the old self-referencing label/href no longer appears in
  the HTML.
- Case A (`Match Center →`) is data-driven by the same `liveMatches` array
  verified live in OPS-1 (hub correctly tracked 537328 as LIVE); next
  kickoff exercises it in production.
- `tsc --noEmit` 0 errors · production build passes.

## Success criteria

| Criterion | Result |
|-----------|--------|
| No self-referencing CTA | ✅ guard + hub passes its own path |
| Single live match → match center | ✅ canonical `matchPath` URL |
| Multiple live → `/live` | ✅ |
| Build passes | ✅ |
| No provider calls added | ✅ hub reuses its existing live list; schedule adds no fetch |
| No SEO changes | ✅ no routes/metadata/sitemap touched; one internal link target improved |
