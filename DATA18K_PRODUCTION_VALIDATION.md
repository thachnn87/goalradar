# DATA-18K Phase 3 — Production Validation

Date: 2026-06-18  Status: **PENDING DEPLOY** (code implemented; not yet live)

The fix is code-complete and statically verified (tsc clean, route compiles). The self-heal path only
executes against **production KV** with the new code live — it cannot be exercised locally (no KV) or
against the current production build (old code). This document is the validation protocol + baseline;
the "after" column is filled once the change is deployed.

---

## Pre-deploy baseline (captured 2026-06-17, live production)

| Match | score | snapshot goals | snapshot cards | snapshot subs | ESPN cache (goals/cards/subs) |
|-------|-------|----------------|----------------|---------------|-------------------------------|
| 537328 | 2–1 | 0 | 0 | 0 | 3 / 1 / 9 |
| 537351 | 7–1 | 0 | — | — | 8 / 0 / 8 |
| 537391 | 3–1 | 0 | — | — | 4 / 0 / 7 |
| 537392 | 1–4 | 0 | — | — | 5 / 1 / 10 |
| 537397 | 3–0 | 0 | — | — | 3 / 0 / 10 |

All 5 currently render score-only (events missing). ESPN events are cached and retrievable.

---

## Validation procedure (run after deploy)

For each target match:

1. **Trigger the heal** — request the page (forces `getOrBuildMatchSnapshot` KV-hit branch):
   ```
   curl -s "https://www.goalradar.org/match/537328" -o /dev/null
   ```
   Expect server log: `[Snapshot] SELF-HEAL match:537328 — pinned unenriched … rebuilding under repair-lock`.

2. **Confirm the snapshot is now enriched:**
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" \
        "https://www.goalradar.org/api/debug/espn-enrichment/537328"
   ```
   Expect `snapshotGoalsCount > 0`, `enrichmentApplied: true`.

3. **Confirm integrity audit passes:**
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" \
        "https://www.goalradar.org/api/debug/enrichment-health"   # this match no longer 'unenriched'
   ```

4. **Confirm rendered page** shows the event sections (the deferred chunk now renders non-empty):
   goals list, bookings, substitutions, lineups.

## Pass criteria (per match)

| Field | Pass condition |
|-------|----------------|
| goals visible | `snapshotGoalsCount === scoreTotal` and Goals section renders |
| cards visible | bookings count matches ESPN cache; Bookings section renders (when cards>0) |
| subs visible | substitutions count matches ESPN cache; Substitutions section renders |
| lineups visible | `match.lineups` non-null; Lineups section renders starters/bench |

## Results (to fill post-deploy)

| Match | goals | cards | subs | lineups | verdict |
|-------|-------|-------|------|---------|---------|
| 537328 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 537351 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 537391 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 537392 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| 537397 | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

> Note on lineups: ESPN enrichment supplies lineups when present in the ESPN summary (DATA-16). For
> matches where ESPN omitted lineups, the Lineups section shows the existing "not available from the
> current data provider" message — that is expected, not a regression. Goals/cards/subs are the
> primary acceptance signals.

**Deploy is an outward-facing action and is being held for explicit authorization before push.**
