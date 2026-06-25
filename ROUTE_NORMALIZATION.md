# ROUTE NORMALIZATION
**Phase:** DATA-18WC.RESET Phase 7  
**Date:** 2026-06-25

---

## Principle

One canonical URL per feature. All others redirect (301) or are deleted.

---

## Route Audit

### Duplicates — Action Required

| Feature | Canonical URL | Duplicate URL | Action |
|---|---|---|---|
| Third-place match | `/world-cup-2026/third-place` | `/world-cup-2026/third-place-playoff` | Add 301 redirect; delete page file |

### Dual-Purpose Routes — Both Justified

| Feature | Route A | Route B | Rationale |
|---|---|---|---|
| Bracket | `/world-cup-2026/bracket` | `/world-cup-2026-bracket` | Nested = interactive (WCBracket tree + all rounds). Root = SEO narrative (round descriptions). Different content/purpose. |
| Standings | `/world-cup-2026-standings` | `/world-cup-2026/[group]` | Root = all 12 groups overview. Nested = single group detail. Different scope. |
| Results | `/world-cup-2026-results` | `/world-cup-2026/results` | Root = SEO. Nested = WCPageNav target. Keep both. |
| Fixtures | `/world-cup-2026-schedule` | `/world-cup-2026/fixtures` | Root = SEO. Nested = WCPageNav target. Keep both. |

---

## Redirect Implementation

### `/world-cup-2026/third-place-playoff` → `/world-cup-2026/third-place`

Add to `next.config.js` redirects array:

```javascript
{
  source: '/world-cup-2026/third-place-playoff',
  destination: '/world-cup-2026/third-place',
  permanent: true,
}
```

Then delete `src/app/world-cup-2026/third-place-playoff/page.tsx`.

---

## Non-Existent Routes — NEVER CREATE

| URL | Status |
|---|---|
| `/world-cup-2026/standings` | DOES NOT EXIST — canonical is `/world-cup-2026-standings` |
| `/world-cup-2026/live` | Does not exist |

The Navbar is already fixed (Sprint 15) to link to `/world-cup-2026-standings` not `/world-cup-2026/standings`.

---

## Final Route Map (Canonical URLs)

```
/world-cup-2026                     ← Hub
/world-cup-2026/[group]             ← Group detail (a-l)
/world-cup-2026/bracket             ← Interactive bracket
/world-cup-2026/round-of-32         ← Round detail
/world-cup-2026/round-of-16
/world-cup-2026/quarter-finals
/world-cup-2026/semi-finals
/world-cup-2026/third-place         ← CANONICAL (third-place-playoff redirects here)
/world-cup-2026/final
/world-cup-2026/fixtures            ← WCPageNav schedule target
/world-cup-2026/results             ← WCPageNav results target
/world-cup-2026/matches             ← All matches
/world-cup-2026/teams               ← Team list
/world-cup-2026/teams/[slug]        ← Team detail
/world-cup-2026/watch-live          ← Live streaming guide
/world-cup-2026/watch-live/[country]
/world-cup-2026/tv-schedule         ← TV guide
/world-cup-2026/tv-schedule/[country]
/world-cup-2026/venues              ← Venues
/world-cup-2026/venues/[venue]
/world-cup-2026-standings           ← SEO standings (all 12 groups)
/world-cup-2026-groups              ← SEO groups guide
/world-cup-2026-bracket             ← SEO bracket narrative
/world-cup-2026-schedule            ← SEO schedule
/world-cup-2026-results             ← SEO results
/world-cup-2026-predictions         ← Predictions
/world-cup-2026-live-stream         ← SEO streaming
/world-cup-2026-tv-guide            ← SEO TV guide
```
