# DATA-18K.2 Phase 2 — Enrichment Matrix

Date: 2026-06-18

Classification (per task):
- **GREEN** — scoreTotal>0 and goals.length>0
- **GREEN** — scoreTotal==0 and goals.length==0
- **RED** — scoreTotal>0 and goals.length==0

## Pre-heal snapshot (initial audit)

| matchId | score | scoreTotal | goals | class |
|---------|-------|-----------|-------|-------|
| 537327 | 2–0 | 2 | 2 | GREEN |
| 537328 | 2–1 | 3 | 3 | GREEN |
| 537333 | 1–1 | 2 | 2 | GREEN |
| 537334 | 1–1 | 2 | 2 | GREEN |
| 537339 | 1–1 | 2 | 2 | GREEN |
| 537340 | 0–1 | 1 | 0 | **RED** |
| 537345 | 4–1 | 5 | 5 | GREEN |
| 537346 | 2–0 | 2 | 2 | GREEN |
| 537351 | 7–1 | 8 | 8 | GREEN |
| 537352 | 1–0 | 1 | 1 | GREEN |
| 537357 | 2–2 | 4 | 4 | GREEN |
| 537358 | 5–1 | 6 | 0 | **RED** |
| 537363 | 1–1 | 2 | 0 | **RED** |
| 537364 | 2–2 | 4 | 0 | **RED** |
| 537369 | 0–0 | 0 | 0 | GREEN (goalless draw) |
| 537370 | 1–1 | 2 | 0 | **RED** |
| 537391 | 3–1 | 4 | 4 | GREEN |
| 537392 | 1–4 | 5 | 5 | GREEN |
| 537397 | 3–0 | 3 | 3 | GREEN |
| 537398 | 3–1 | 4 | 0 | **RED** |

**Pre-heal: 6 RED** — 537340, 537358, 537363, 537364, 537370, 537398
(matches `enrichment-health.degradedIds` exactly). 14 GREEN.

## Note on 537369 (0–0)
Classified **GREEN** by the RED definition (scoreTotal==0 && goals==0). It was separately flagged by
the stricter `integrity-audit` (lineups missing) and `authority-compare` (enrichmentApplied=false) —
its ESPN cache held cards=2 / subs=9 that the AF-only prewarm snapshot never merged. Resolved in
Phase 3 via the existing revalidate→rebuild path (it is not goals-degraded, so the score>0 self-heal
trigger did not target it).

## Detailed event coverage (post-heal, ESPN-sourced)
| matchId | goals | cards | subs |
|---------|-------|-------|------|
| 537340 | 1 | 4 | 8 |
| 537358 | 6 | 1 | 10 |
| 537363 | 2 | 4 | 10 |
| 537364 | 4 | 1 | 9 |
| 537370 | 2 | 1 | 10 |
| 537398 | 4 | 1 | 10 |
| 537369 | 0 | 2 | 9 |
