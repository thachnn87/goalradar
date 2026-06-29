# WC_REVALIDATION_FLOW.md — Revalidation Flow Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Match-Finished Revalidation Chain

```
FD API: match status → FINISHED, score set
  │
  │  [latency: depends on when orchestrator next runs]
  ▼
Orchestrator (every ~30 min)
  • wc-all-matches task: refreshEndpoint('/competitions/WC/matches')
  • wc-finished task: refreshEndpoint('/competitions/WC/matches?status=FINISHED')
  • wc-recent task: refreshEndpoint('/competitions/WC/matches?dateFrom=…')
  KV write: goalradar:/competitions/WC/matches  (TTL 21600s)
  │
  │  [latency: 0–30 min from match completion]
  ▼
prewarmWorldCup() — per-match snapshot update
  • Writes goalradar:match:{id}  (TTL 900s)
  • Writes authority envelope: goalradar:wc:authority:v1  (TTL 30–900s)
  │
  │  [latency: 0 additional — runs within same orchestrator invocation]
  ▼
Authority cache fresh
  • getWCAuthorityMatchesV2() returns FINISHED match on next page load
  • Results page, Fixtures page reflect FINISHED status
  │
  │  [latency: ISR TTL per page]
  ▼
ISR revalidation:  revalidateWCPaths() fires when WC task succeeds
  • Hub /world-cup-2026:       30s revalidate → reflects match within 30s after KV write
  • Fixtures /world-cup-2026/fixtures: 900s → up to 15 min
  • Results /world-cup-2026/results:   900s → up to 15 min
  • Bracket /world-cup-2026/bracket:   900s → up to 15 min
  • Groups /world-cup-2026/groups:    3600s → up to 1 hour
  • Team pages /world-cup-2026/teams/[slug]: 3600s → up to 1 hour
  │
  ▼ [BROKEN LINK]
Standings update — NOT triggered
  • standings-wc task: refreshEndpoint('/competitions/WC/standings')
  • FD API standings endpoint returns error/restricted → refreshEndpoint does NOT write KV
  • getStandingsCached('WC') → readKVOnly() → NULL → static skeleton (all zeros)
  • Standing pages: unchanged from pre-tournament zero-state
  • Qualification engine: all UNDECIDED (inputs are zeros)
```

---

## Latency Budget

| Scenario | Worst-Case Latency |
|---|---|
| Match result appears on Results page | ≤30 min (orchestrator interval) + ≤15 min (ISR) = **45 min** |
| Match result appears on Hub | ≤30 min + ≤30 s = **~30 min** |
| Live match disappears after completion | ≤30 s (live:matches TTL) |
| Standing updates after match finishes | **NEVER** — KV standings key empty/broken |
| Bracket updates with new knockout result | ≤30 min + ≤15 min = **45 min** |
| Team page qualification badge updates | ≤30 min + ≤1 hour = **~90 min** |

---

## Missing Revalidation

| Gap | Impact | Fix |
|---|---|---|
| Standings KV key not written | All standing-dependent pages show zeroed data indefinitely | Fix standings write path: either compute from authority cache matches or diagnose FD API standings endpoint |
| Individual match DR keys not revalidated on status change | DR cache can hold stale status (537412 case) for 30 days | Add automatic DR key invalidation when authority cache detects status divergence |

---

## Manual Revalidation Required

| Action | Trigger | Command |
|---|---|---|
| Purge poisoned DR key 537412 | Panama vs Croatia CANCELLED match showing as FT 0-1 | `GET https://www.goalradar.org/api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>` |
| Force standings refresh | After diagnosing/fixing standings endpoint | Trigger orchestrator run: `GET /api/cron/orchestrator?secret=<CRON_SECRET>` |
