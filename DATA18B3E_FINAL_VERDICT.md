# DATA-18B.3E LIVE SOURCE UNIFICATION — FINAL VERDICT

**Date:** 2026-06-23
**Gate: LIVE_SOURCE_UNIFIED ✅**

> Filename note: written as `DATA18B3E_FINAL_VERDICT.md` because a generic
> `FINAL_VERDICT.md` already exists for an unrelated task (DATA-18TEAM.1).

---

## Outcome

Every World Cup page that can render a match as live now derives that decision
**only** from the live SSOT (`getCurrentLiveMatches()` / `getLiveMatchIdSet()` →
KV `goalradar:live:matches`). No page derives LIVE from authority
`state === 'live'`, `classifyMatchState() === 'live'`, or raw `IN_PLAY/PAUSED`.

The reported bug — **France vs Iraq stuck in "Live Now"** on
`/world-cup-2026-results` while its detail page showed FULL TIME — is fixed:
that page now reports `Live Now = 0` and renders France vs Iraq as `3–0 FT`.

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Hub uses `getCurrentLiveMatches()` for live | ✅ (already; buckets now SSOT-gated too) |
| Schedule uses SSOT for live | ✅ (status normalised via `getLiveMatchIdSet()`) |
| Today uses SSOT for live | ✅ (`filter(liveMatchIds.has(id))`) |
| Tomorrow | ✅ (renders no live badge) |
| Results uses SSOT for live | ✅ (308→WC Results; file also migrated) |
| WC Results uses SSOT for live | ✅ (`filter(liveMatchIds.has(id))`) — **bug page** |
| No page derives LIVE from `state==='live'` | ✅ |
| No page derives LIVE from `classifyMatchState()==='live'` | ✅ |
| No page derives LIVE from `IN_PLAY`/`PAUSED` on a list | ✅ |
| Live rendering uses `liveMatchIds.has(match.id)` only | ✅ |

`/api/debug/live-source-map` → `verdict: LIVE_SOURCE_UNIFIED`,
`allLivePagesUseSSOT: true`, `anyPageUsesAuthorityForLive: false`.

---

## Phases

| Phase | Output |
|-------|--------|
| 1 — Inventory | LIVE_SOURCE_INVENTORY.md — 4 pages authority-derived, Hub SSOT, Tomorrow none |
| 2–3 — Migrate | LIVE_SOURCE_MIGRATION.md — `getLiveMatchIdSet()` + per-page `liveMatchIds.has(id)`; commit `37267d0` |
| 4 — Endpoint | `/api/debug/live-source-map` (page / liveSource / usesSSOT / usesAuthority / usesSnapshot) |
| 5 — Validation | LIVE_SOURCE_VALIDATION.md — all 6 pages agree; France vs Iraq & Norway vs Senegal FT everywhere; 0 LIVE badges |
| 6 — Output | this + 3 docs |

---

## Design note

Authority remains the source for the fixture **list** and **finished/scheduled**
state. Only **liveness** is unified onto the SSOT. A match the authority cache
still marks live but that the SSOT no longer lists is normalised to finished
(state + status), so it leaves the live grid and renders as a result rather than
vanishing or showing live.

---

## Honesty note

At validation time the SSOT had 0 live matches (Norway vs Senegal finished as
the deploy landed), so a *currently-live* fixture was not observed rendering
live across pages. Verified instead: the exact bug condition is resolved
(France vs Iraq → FT, Live Now = 0), no page shows a false live badge, and the
live decision is code-bound to `liveMatchIds.has(id)`. The live-direction shares
the same single path; recheck on the next live match via
`/api/debug/live-source-map` + `/api/debug/state-divergence`.

---

## Deliverables

| Document | Status |
|----------|--------|
| LIVE_SOURCE_INVENTORY.md | ✅ |
| LIVE_SOURCE_MIGRATION.md | ✅ |
| LIVE_SOURCE_VALIDATION.md | ✅ |
| `src/lib/wc-live-ssot.ts` `getLiveMatchIdSet()` | ✅ `37267d0` |
| `/api/debug/live-source-map` | ✅ `37267d0` |
| DATA18B3E_FINAL_VERDICT.md | ✅ this document |

---

**DATA-18B.3E: COMPLETE. Gate: LIVE_SOURCE_UNIFIED.**
