# FINAL CONSOLIDATION
**Sprint:** DATA-18WC.CONSOLIDATE — Phases 8 & 9 + Acceptance  
**Date:** 2026-06-25

---

## Mission

> Eliminate every remaining architectural inconsistency. ONE SOURCE · ONE PIPELINE ·
> ONE VIEW MODEL · ONE COMPONENT · ONE ROUTE for every World Cup feature — exceptions
> **eliminated**, not accepted.

---

## Phase 8 — Architecture enforcement (automated)

Added `scripts/check-wc-architecture.mjs`, wired as `npm run check:wc-arch` **and**
`prebuild` (so `next build` — and therefore Vercel — fails on any violation).

| Rule | Fails build when… |
|---|---|
| R1 | Any file references `getWCKnockoutMatchesCached` (deleted legacy pipeline) |
| R2 | A WC surface (`app/world-cup-2026*` or `components/WC*`) imports `getUpcomingMatchesCached` / `getRecentMatchesCached` / `getWCResultsCached` for WC match collections |
| R3 | `knockout-vm.ts` re-introduces the `AUTHORITY_CACHE_PILOT` gate (second knockout path) |
| R4 | `canonicalToMatch` is defined anywhere other than `canonical-match.ts` |

Current run: **✓ passed** (0 violations). The check caught and forced the migration of
`teams/[slug]` and `watch-live` during this sprint — proving it works.

---

## Phase 9 — Regression audit vs RESET + VERIFY

### Changes this sprint

| Change | File |
|---|---|
| Moved `canonicalToMatch` → its single home | `lib/canonical-match.ts` (+export), `lib/knockout-vm.ts` (import) |
| Removed pilot gate; always authority:v1 | `lib/knockout-vm.ts` |
| Collapsed merged-bucket body → authority:v1 view | `lib/api.ts` (`getWCAuthorityMatchesCached`) |
| Deleted legacy knockout pipeline | `lib/api.ts` (`getWCKnockoutMatchesCached`) |
| Homepage knockout → ViewModel | `app/page.tsx` |
| Predictions → authority:v1 | `app/world-cup-2026-predictions/page.tsx` |
| Team content → authority:v1 | `components/WCTeamPageContent.tsx` |
| Team page → authority:v1 primary; dup fallback deleted | `app/world-cup-2026/teams/[slug]/page.tsx` |
| Watch-live → authority:v1 | `app/world-cup-2026/watch-live/page.tsx` |
| Enforcement script + prebuild hook | `scripts/check-wc-architecture.mjs`, `package.json` |

### Regression matrix

| Prior-sprint feature | Touched? | Status |
|---|---|---|
| RESET — single knockout VM (bracket, round pages, hub, SEO bracket) | Extended (homepage added; pilot gate removed) | ✅ preserved |
| RESET — third-place-playoff 301 redirect | No | ✅ preserved |
| RESET — hub bracket = `bracketMatches` (R16+) | No | ✅ preserved |
| VERIFY — schedule page on authority:v1 | No (already V2) | ✅ preserved |
| VERIFY — D1 root cause (window-limited merge) | **Eliminated at the source** — the merge function itself now reads authority:v1, so no other page can hit the bug | ✅ improved |
| Sprint 14 — positional labels (`injectKnockoutSlotLabels`) | No (still inside the VM) | ✅ preserved |
| Sprint 13 — authority-derived standings | No | ✅ preserved |
| Live SSOT (`getCurrentLiveMatches`) | No | ✅ preserved |

### Build / type checks

- `npx tsc --noEmit` → **clean** (only pre-existing stale `.next/` type-cache entries for the RESET-deleted `third-place-playoff` page; regenerate on build).
- `node scripts/check-wc-architecture.mjs` → **✓ passed**.

---

## Acceptance — ONE × 5

| Invariant | Evidence |
|---|---|
| **ONE SOURCE** | Every WC match-collection consumer reads `goalradar:wc:authority:v1`. The only remaining feed readers are the generic multi-competition pipeline (non-WC pages) and the snapshot-writer infra. See REMAINING_SOURCE_USAGE.md. |
| **ONE PIPELINE** | Matches: `readAuthorityCache` (one engine) behind 3 shaped accessors. Knockout: `buildKnockoutViewModel()` only — pilot gate + legacy `getWCKnockoutMatchesCached` deleted. |
| **ONE VIEW MODEL** | `KnockoutViewModel` for knockout; `classifyMatchState` is the one upcoming/finished classifier reused across all 5 migrated surfaces. No inline feed assembly remains. |
| **ONE COMPONENT** | MatchCard / WCGroupTable / WCBracket / WCRoundPage per surface; `canonicalToMatch` adapter defined once. |
| **ONE ROUTE** | No duplicate routes introduced or remaining (RESET removed third-place-playoff; redirects intact). |

### Rule Zero compliance

No new parallel pipeline, no temporary adapter, no compatibility layer was introduced.
The migrations **reuse** the pre-existing canonical primitives (`readAuthorityCache`,
`canonicalToMatch`, `classifyMatchState`, `buildKnockoutViewModel`). `getWCAuthorityMatchesCached`
remains as a *return-shape view* of the single source — not a second source.

### Exceptions: eliminated, not accepted

| VERIFY exception | Disposition |
|---|---|
| In-VM `AUTHORITY_CACHE_PILOT` dual path | **Eliminated** (gate removed) |
| Merged-bucket divergence (schedule root cause) | **Eliminated** (merge function collapsed onto authority:v1) |
| Legacy knockout pipeline `getWCKnockoutMatchesCached` | **Eliminated** (deleted) |
| Hub bracket R32 = TBD (RESET) | Unchanged — intentional layout, not a source divergence |
| `getWCResultsCached` orphan | Flagged for follow-up deletion (safe; no caller) |

---

## Follow-ups (non-blocking)

1. Delete orphaned `getWCResultsCached()` once confirmed unreferenced by any non-WC path.
2. Production verification after deploy: hub bracket preview, predictions, team pages, watch-live, `/schedule` WC section all render full match sets from authority:v1.

**DATA-18WC.CONSOLIDATE: COMPLETE** — every WC surface traces to `goalradar:wc:authority:v1`, enforced automatically at build time.
