# LIVE_RUNTIME_CHECK.md
## DATA-18WC.LIVE.TRUTH — Phase 6: Runtime Consistency Check

---

## Check Script

See: `scripts/check-live-consistency.mjs`

Run locally:
```bash
node scripts/check-live-consistency.mjs
```

Run against production:
```bash
BASE_URL=https://goalradar.org node scripts/check-live-consistency.mjs
```

---

## What the Script Checks

For every live match, the script verifies all six surfaces agree on the same IDs:

1. **KV source** — `goalradar:live:matches` (the SSOT)
2. **/live page** — `GET /live` HTML, counts live MatchCard elements
3. **Home page** — `GET /` HTML, counts WCCountdownBanner live count
4. **Hub page** — `GET /world-cup-2026` HTML, counts live section matches
5. **Schedule** — `GET /schedule?competition=WC` HTML, counts live matches
6. **WC Results** — `GET /world-cup-2026-results` HTML, counts live matches

**Pass criteria**: all six counts are identical.

---

## Expected Output (No Divergence)

```
DATA-18WC.LIVE.TRUTH — Runtime Consistency Check
================================================
SSOT (KV):        3 live matches [123, 456, 789]
/live:            3 live matches [123, 456, 789]  ✅
Home (/):         3 live matches [123, 456, 789]  ✅
Hub (/world-cup): 3 live matches [123, 456, 789]  ✅
Schedule:         3 live matches [123, 456, 789]  ✅
WC Results:       3 live matches [123, 456, 789]  ✅

ALL CONSISTENT ✅
```

## Fail Output (Before Fix)

```
SSOT (KV):        0 live matches []
/live:            0 live matches []  ✅
Home (/):         2 live matches [456, 789]  ❌  — liveStrays from authority
Hub (/world-cup): 0 live matches []  ✅
...

DIVERGENCE DETECTED ❌
Home shows 2 live; SSOT shows 0.
```

---

## Debug Endpoints Available

The codebase has existing debug endpoints for live consistency:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/debug/live-consistency` | Compare live-cache vs authority |
| `GET /api/debug/live-health` | Live cache health + age |
| `GET /api/debug/live-source-map` | Per-match source attribution |
| `GET /api/debug/live-telemetry` | Live event stream |
| `GET /api/debug/state-divergence` | Detect state conflicts |
| `GET /api/debug/authority-freshness` | Authority cache age |
