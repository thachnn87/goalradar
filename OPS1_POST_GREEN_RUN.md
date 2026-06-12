# OPS-1 Recheck — Post Green Run
## GoalRadar · production audit after workflow run #4 (success)

Generated: 2026-06-12 ~04:00 UTC (Korea–Czechia in play during checks)
Audit only — no code changes.

Run #4: `workflow_dispatch`, **success**, 03:41 UTC — the first successful
orchestrator execution in production, ever.

---

## BEFORE → AFTER → DELTA

| Metric | BEFORE (PERF-9 / OPS-1) | AFTER (this audit) | Δ |
|--------|------------------------|--------------------|---|
| Snapshot coverage (104-id probe) | 12/104 = **11.5 %** (PERF-9) · 22/104 = 21 % (OPS-1) | **103/104 = 99.0 %** | **+78 pp** |
| The 1 non-hit | — | 537328, **currently IN_PLAY** — live matches bypass the snapshot cache **by design** (live-cache owns them) → effective coverage **100 % of cacheable matches** | — |
| Hot tier (today: 537327 FT + 537328 live + 8 upcoming today) | mostly cold | **100 % of cacheable hot matches `hit`** | gate met |
| build-provider exposure | every uncovered first visit (~79–88 % of matches) → ~7 s builds | only live-transition rebuilds remain (intentional) | ~eliminated |
| `built` responses (detail-in-KV) | 0 (detail keys unseeded) | n/a — everything already `hit` | seeded |
| DR usage | unverifiable; nothing suggested usage | unchanged (no DR indicators) | — |
| Results page lists yesterday's match | ❌ absent | ✅ "Mexico vs South Africa" present | fixed by list refresh |
| Hub recent results | ❌ 537327 absent | ✅ present; live match shows LIVE | fixed |
| Schedule | FT-overlaid stale entry (DATA-2 stopgap) | finished match correctly **dropped** from the refreshed upcoming feed | now structurally clean |
| Live page | correct | correct (Korea Republic listed) | — |
| Workflow | 3/3 failures | run #4 **success** | first green |

(KV hit / build-kv / build-provider / DR percentages from `snapshotPerf`
remain inaccessible externally — ADMIN_SECRET-protected. The 104-probe is
the externally-measurable proxy: every probe served from KV.)

## Did PERF-9 and PERF-10 achieve their targets?

| Target | Verdict |
|--------|---------|
| PERF-9: restore prewarm scheduling, KV hit ≥ 95 % | ✅ **YES** — first green run took coverage 11.5 % → 99 % in one cycle, exactly as the audit predicted |
| PERF-10: overall hit rate > 95 % | ✅ 99 % (100 % of cacheable) |
| PERF-10: hot-match hit rate > 99 % | ✅ all cacheable hot matches hit |
| PERF-10: reduced KV workload | ✅ by design (only-if-missing finished tier confirmed working: all 64+ future/finished matches seeded once and holding) |
| DATA-1/2 consistency | ✅ all surfaces agree; the DATA-2 overlay has now become a between-cycle safety net rather than the primary mechanism |

## Decision: **PASS**

Remaining operational watch-items (not blockers):
1. Run #4 was a **manual** dispatch — the scheduled `*/15` runs (OPS-2) must
   now show green on their own; check the Actions tab in a few hours.
2. The OPS-2 UptimeRobot backup monitor is still recommended for a hard
   30-min guarantee against GitHub throttling.

## Highest-ROI next sprint recommendation

**LIVE-1 — Real-time match experience.** The caching, consistency and
scheduling stack is now solved; the biggest remaining user-facing gap is
that **live pages are static**: a fan on `/match/[id]` or `/live` during a
match sees a snapshot frozen at ISR time (30–60 s old) and must manually
refresh for goals. Mid-tournament this is the highest-traffic,
highest-engagement surface on the site.

Scope sketch (all reads from the existing KV-backed live cache — zero new
provider traffic): a small client poller on live match pages and `/live`
that refetches score/status every ~30 s from a tiny KV-only endpoint,
updates the score hero in place, and stops at FULL TIME. Pairs naturally
with the existing `LiveRefresher` component and PERF-8 telemetry to measure
engagement lift.
