# DATA-18B.3B Phase 3 — Bracket Consistency Audit

**Date:** 2026-06-19
**Audited At:** 2026-06-19T04:05:08 UTC
**Source:** `/api/debug/full-audit`
**Verdict: GREEN — 0 score drift, 0 state drift, 0 RED**

---

## Summary

| Metric | Value |
|--------|-------|
| Total knockout matches audited | **32** |
| Authority GREEN | 0 |
| Authority YELLOW | 32 (all TBD — expected) |
| Authority RED | **0** |
| Snapshot GREEN | **32** |
| Snapshot YELLOW | 0 |
| Snapshot RED | **0** |
| Consistency GREEN | 0 |
| Consistency YELLOW | **32** (TBD) |
| Consistency RED | **0** |
| Score drift | **0** |
| State drift | **0** |

**0 RED across all 32 bracket matches. All 32 YELLOW = expected TBD knockout slots.**

---

## Full 104-Match Context

Full-audit run at 04:05 UTC confirms:

| Dimension | Value vs 03:30 UTC |
|-----------|-------------------|
| Total matches | 104 (unchanged) |
| Finished | 28 (was 27 — Mexico vs South Korea now finished) |
| Live | 0 (was 1 — Mexico match ended) |
| Scheduled | 76 (unchanged) |
| Authority RED | 0 (unchanged) |
| Snapshots present | 104/104 (was 103/104 — 537330 snapshot now built) |
| Duplicate IDs | 0 (unchanged) |

**Improvement vs 03:30:** Snapshot coverage is now 104/104 (was 103/104). Match 537330 (Mexico vs South Korea) snapshot was built after the match ended and a visitor hit the match page.

---

## Bracket Match Detail — All 32 Knockout Slots

All 32 knockout matches show:
- `state: scheduled` (correct — teams not yet determined)
- `home: '?'` / `away: '?'` (homeTeam.id = 0 / awayTeam.id = 0 — correct TBD)
- `score: '–'` (no score for unplayed matches)
- `authorityGate: YELLOW` (expected TBD — not RED)
- `snapshotGate: GREEN` (snapshot stubs present)
- `consistencyGate: YELLOW` (follows authority)

| Stage | Count | Auth Gate | Snap Gate | Consistency |
|-------|-------|-----------|-----------|-------------|
| LAST_32 | 16 | YELLOW | GREEN | YELLOW |
| LAST_16 | 8 | YELLOW | GREEN | YELLOW |
| QUARTER_FINALS | 4 | YELLOW | GREEN | YELLOW |
| SEMI_FINALS | 2 | YELLOW | GREEN | YELLOW |
| THIRD_PLACE | 1 | YELLOW | GREEN | YELLOW |
| FINAL | 1 | YELLOW | GREEN | YELLOW |

---

## Score Consistency

All 28 finished matches: `authority.score.fullTime === snapshot.match.score.fullTime`.

Includes the newly finished Mexico vs South Korea (537330): final score confirmed consistent across authority and snapshot.

**Score drift: 0 matches.**

---

## State Consistency

All 28 finished matches: `authority.state === 'finished'` AND `snapshot.match.status === 'FINISHED'`.
All 76 scheduled matches: `authority.state === 'scheduled'` (no snapshot state contradiction).
**0 live matches at audit time** (Mexico match ended).

**State drift: 0 matches.**

---

## Bracket Page Rendering

From `src/app/world-cup-2026/bracket/page.tsx`:

When bracket renders TBD slots:
- `homeTeam?.name ?? 'TBD'` → displays "TBD" (no null error)
- `awayTeam?.name ?? 'TBD'` → displays "TBD"
- `match.homeTeam?.crest && (...)` → crest block skipped (no broken image)
- `showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status)` → `SCHEDULED` → false, shows kickoff date instead

All 32 knockout slots render correctly with TBD labels and scheduled kickoff dates.

**No render errors. No broken crests. No phantom scores.**
