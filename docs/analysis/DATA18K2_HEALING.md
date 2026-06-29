# DATA-18K.2 Phase 3 — Healing

Date: 2026-06-18  Mechanism: **existing DATA-18K self-heal** (no new repair invented).

## RED matches healed (6) — via self-heal page visit

Trigger: a normal page request to `/match/{id}` enters `getOrBuildMatchSnapshot`'s KV-hit branch;
for `FINISHED && score>0 && goals=0` it rebuilds under `goalradar:repair-lock:{id}` (DATA-18K).

| matchId | before (goals) | after (goals) | cards | subs | enrichmentApplied |
|---------|----------------|---------------|-------|------|-------------------|
| 537340 | 0 | **1** | 4 | 8 | true |
| 537358 | 0 | **6** | 1 | 10 | true |
| 537363 | 0 | **2** | 4 | 10 | true |
| 537364 | 0 | **4** | 1 | 9 | true |
| 537370 | 0 | **2** | 1 | 10 | true |
| 537398 | 0 | **4** | 1 | 10 | true |

All 6 healed on first post-visit rebuild (ESPN event caches were present → merged). `enrichment-health`
afterwards: `unenriched=0`, `degradedIds=[]`.

## 537369 (0–0) — via existing revalidate→rebuild path

Not RED (goalless draw), so the `score>0` self-heal trigger correctly skips it. But its snapshot was
the AF-only prewarm artifact (cards/subs/lineups missing, `enrichmentApplied=false`). Healed with the
**existing** endpoint `POST /api/revalidate/match/537369` (invalidates snapshot → next visit
cold-rebuilds via `buildSnapshot`, which enriches because `goals===0` ⇒ `needsEnrichment=true`).

| field | before | after |
|-------|--------|-------|
| goals | 0 | 0 (correct, 0–0) |
| cards | 0 | 2 |
| subs | 0 | 9 |
| lineups | missing | present |
| enrichmentApplied | false | true |

> No new repair mechanism was created. Both paths (`getOrBuildMatchSnapshot` self-heal and the
> pre-existing `revalidate` endpoint) shipped before this task.
