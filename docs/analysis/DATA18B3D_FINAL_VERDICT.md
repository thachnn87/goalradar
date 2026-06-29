# DATA-18B.3D STATE DIVERGENCE AUDIT — FINAL VERDICT

**Date:** 2026-06-23
**Verdict: PASS (no state-flip divergence) — 1 YELLOW coverage gap, 1 cleanup recommended**

> Filename note: written as `DATA18B3D_FINAL_VERDICT.md` because a generic
> `FINAL_VERDICT.md` already exists for an unrelated task (DATA-18TEAM.1).

---

## Headline

**No match renders a different live/finished/scheduled state on the detail view
versus the listing pages.** Across 104 matches and 3 production samples, the
authority cache and the snapshot KV agreed on the state of every one of the 103
matches that have a snapshot (42 finished == 42, 61 scheduled == 61). **Zero RED
state-flip divergences.**

The dangerous patterns the audit targeted — `authority=live / snapshot=finished`,
`authority=finished / snapshot=live`, `authority=scheduled / snapshot=live` — do
**not exist** in production.

---

## Phase results

| Phase | Output | Result |
|-------|--------|--------|
| 1 — Collect 3-source state | `/api/debug/state-divergence` (new) | 104 matches × {authority, snapshot, live-cache} captured |
| 2 — Divergence matrix | STATE_DIVERGENCE_MATRIX.md | 0 RED, 1 YELLOW |
| 3 — Trace source timestamps | matrix + `match-state/537394` probe | staleness localised: storage gaps, read-path resolves |
| 4 — Page source audit | STATE_SOURCE_MAP.md | 6 pages mapped; 1 live-source split found |
| 5 — Fix plan | STATE_FIX_PLAN.md | 1 recommended cleanup; task's snapshot-gating prescription rejected with evidence |
| 6 — Output | this + 3 docs | complete |

---

## The one divergence (YELLOW, not RED)

Match **537394 Norway vs Senegal** — genuinely live (authority=live,
live-cache=live) but **no snapshot yet**. A coverage gap on an in-progress match,
not a state flip. Detail page cold-builds the snapshot on demand.

---

## Why there are no RED divergences (the mechanism)

State divergence exists transiently at the **storage layer** — the primary
authority key (30s live TTL) and live-cache key (30s TTL) both expire between
writes, and a freshly-live match has no snapshot. But it is resolved at the
**read layer** before any user sees it:

- **DR live-staleness guard** (`DR_LIVE_STALE_MAX_MS = 120s`): when the DR
  authority copy carries live matches and is >2 min old, `readAuthorityCache()`
  forces a cold rebuild from the FD feed rather than serving stale live-state.
- **Live-cache SSOT** with provider fallback: an expired live-cache triggers a
  fresh fetch, not a "0 live" render.

These were the WC-LIVE-STATE / WC-LIVE-SSOT fixes. This audit confirms they hold
under live-tournament conditions (1 match live at audit time).

---

## Important correction to the proposed fix

The task asked to make snapshot authoritative and **"render LIVE only with
snapshot confirmation."** Production evidence shows this would **hide genuinely
live matches** (537394 is live with no snapshot). Snapshot is the authority for
**finished-match enrichment and score**, not for **live-gating**. The correct
single source for liveness is the live-cache SSOT — already in place. See
STATE_FIX_PLAN.md.

---

## Recommended action (1 cleanup)

Collapse the residual second live-gating path: migrate `/matches-today`,
`/world-cup-2026/results`, and `/world-cup-2026-results` from
`m.state === 'live'` / `classifyMatchState()==='live'` onto the SSOT
`getCurrentLiveMatches()`, matching Hub and Schedule. Low risk; the paths
converge today. (Not applied in this audit — audit-only task.)

## Separately flagged (out of scope)

- **Score drift 537371** (Spain vs Saudi: authority 4–0 vs snapshot 5–0) —
  run snapshot repair. A score issue, not a state divergence.
- **`authority-freshness` false RED** — reports "orchestrator may be down" while
  orchestrator is GREEN (ran 15 min ago, 30-min cadence); it ignores the 30s
  primary TTL in live tier. Debug-only accuracy fix.

---

## Deliverables

| Document | Status |
|----------|--------|
| `/api/debug/state-divergence` (instrument) | ✅ deployed (`e288af2`) |
| STATE_DIVERGENCE_MATRIX.md | ✅ |
| STATE_SOURCE_MAP.md | ✅ |
| STATE_FIX_PLAN.md | ✅ |
| DATA18B3D_FINAL_VERDICT.md | ✅ this document |

---

**DATA-18B.3D: COMPLETE. Verdict: PASS — no user-visible state divergence. One
snapshot coverage gap (YELLOW) and one optional live-source-unification cleanup.**
