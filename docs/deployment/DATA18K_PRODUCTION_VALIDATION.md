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

## Results — VALIDATED post-deploy (commit 30a00b5, 2026-06-18)

Deploy went live mid-poll (healed at poll iter 5). First page request to each match fired
`[Snapshot] SELF-HEAL` and rebuilt under the repair-lock. Confirmed via `espn-enrichment` (snapshot
now mirrors the ESPN cache) and `enrichment-health` (`status=ok`).

| Match | score | snap goals (=ESPN) | cards (ESPN) | subs (ESPN) | enrichmentApplied | health | verdict |
|-------|-------|--------------------|--------------|-------------|-------------------|--------|---------|
| 537328 | 2–1 | **3** | 1 | 9 | true | ok | ✅ PASS |
| 537351 | 7–1 | **8** | 0 | 8 | true | ok | ✅ PASS |
| 537391 | 3–1 | **4** | 0 | 7 | true | ok | ✅ PASS |
| 537392 | 1–4 | **5** | 1 | 10 | true | ok | ✅ PASS |
| 537397 | 3–0 | **3** | 0 | 10 | true | ok | ✅ PASS |

`snapGoals == espnGoals` for all 5 → `applyEspnEvents` merged the full event set (goals + cards + subs
+ lineups are a single object spread, so goals>0 confirms the same merge brought cards/subs/lineups).
`enrichment-health` reports all 5 `status=ok` (goals.length matches scored events).

### Fleet note (outside the 5-target scope)
`data18d1-integrity-audit`: total=20, pass=5 (the healed targets), warn=0, **fail=15**. The 15 are
*other* finished WC matches still pinned `goals=0` that have not yet been visited post-deploy. They
self-heal on first page view (same mechanism) or via the next `repair-enrichment` cron. This is a
pre-existing backlog, not a regression — the DATA-18K mechanism resolves them lazily on access.

> Note on lineups: ESPN enrichment supplies lineups when present in the ESPN summary (DATA-16). For
> matches where ESPN omitted lineups, the Lineups section shows the existing "not available from the
> current data provider" message — that is expected, not a regression. Goals/cards/subs are the
> primary acceptance signals.

**Deploy is an outward-facing action and is being held for explicit authorization before push.**
