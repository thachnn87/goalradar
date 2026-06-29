# DATA-18D.2 Phase 3 — First Build Guarantee
## FIRST_BUILD_UNENRICHED Telemetry

File modified: `src/lib/prewarm/worldcup.ts`

---

## Guarantee

After Phase 2, the first prewarm snapshot for a FINISHED scored match will be enriched **unless** AF enrichment is unavailable (API down or `ENABLE_AF_ENRICHMENT` not set).

When a FINISHED scored snapshot is written unenriched, the prewarm now emits an explicit WARN log:

```
[Prewarm] FIRST_BUILD_UNENRICHED match:537351 | score=7-1 goals=0 | AF enrichment unavailable
[Prewarm] SKIP-DR match:537351 | score=7-1 goals=0 — refusing to write unenriched DR
```

This makes silent failures observable in Vercel logs.

---

## Log Trigger Conditions

The `FIRST_BUILD_UNENRICHED` log fires when ALL of:
1. `tier === 'finished'` — the match is FINISHED in the bulk feed
2. `scoreTotal > 0` — the match has a non-zero final score
3. `goals.length === 0` — the snapshot being written has no goal events (AF unavailable)

It does NOT fire for:
- 0-0 finished matches (score 0-0 is correct to have no goal events)
- Non-finished tiers (goals are not expected)
- Skipped matches (existing snapshot present, skip-if-exists fired)

---

## Operational Response

When `FIRST_BUILD_UNENRICHED` appears in logs:

1. Check `ENABLE_AF_ENRICHMENT=true` is set in Vercel env vars
2. Check AF API health (api-football.com status page)
3. Run `/api/debug/integrity-repair` to force-repair affected matches
4. Confirm with `/api/debug/data18d1-integrity-audit`

The window where a match remains unenriched after `FIRST_BUILD_UNENRICHED` is bounded by:
- **Best case**: `integrity-repair` run manually → seconds
- **Worst case**: daily repair-enrichment cron at 04:00 UTC → up to 24h

---

## Phase 3 Verdict

Implementation complete. FINISHED scored matches that cannot be enriched at prewarm time now emit explicit WARN logs — no more silent unenriched snapshots.
