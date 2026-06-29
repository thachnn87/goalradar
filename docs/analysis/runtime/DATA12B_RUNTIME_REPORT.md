# DATA-12B Runtime Report
## GoalRadar · Live Minute Propagation — End-to-End Verification

Date: 2026-06-16
Match: France vs Senegal (537391) / Iraq vs Norway (537392)
Commit: 64c14b0 (DATA-12 overlay fix deployed)

---

## Pre-Flight Status

| Check | Status |
|-------|--------|
| DATA-12 commit deployed (64c14b0) | ✅ Live at ~11:10Z |
| `/api/debug/minute-health` → 401 | ✅ Confirmed |
| `mergeSnapshotState` minute fix | ✅ Deployed |
| 537391 pre-match baseline | ✅ `status: TIMED, minute: null` at 11:08Z |
| CRON_SECRET in terminal | ❌ Must be set by user before running script |
| Match window | ⏳ France vs Senegal 19:00Z |

**How to execute:**

```bash
export CRON_SECRET=<your_secret>
bash data12b_sample.sh 537391        # France vs Senegal
# or
bash data12b_sample.sh 537392        # Iraq vs Norway
```

The script samples both `/api/debug/minute-trace/{id}` and `/api/debug/minute-health`
every 30s for 10 minutes (20 samples). Output → `data12b_output_537391.txt`.

---

## Verdict Legend

| Verdict | Meaning |
|---------|---------|
| `NO_LOSS` | Minute present at all layers — pipeline healthy |
| `PROVIDER_LOSS` | football-data.org not yet returning minute (first ~5 min after kickoff) |
| `KV_LOSS` | KV live:matches exists but has no minute (cron write path bug) |
| `SNAPSHOT_LOSS` | KV live has minute, per-match snapshot does not (fixed by DATA-12 for list surfaces; snapshot itself needs rebuild) |
| `API_LOSS` | `/api/live-score` returns null minute despite KV having one (live-score path bug) |
| `CLIENT_LOSS` | Browser shows LIVE when backend has minute (MatchLiveZone poll bug) |

---

## Layer Map

```
football-data.org
      │  minute (raw provider)
      ▼
goalradar:live:matches (KV, 30s TTL)   ← kvLiveMinute
      │
      ├──▶ /api/live-score/{id}         ← liveScoreMinute  (MatchLiveZone polls this)
      │
      ├──▶ goalradar:match:{id} (KV, per-match snapshot)  ← snapshotMinute
      │         │
      │         ├──▶ match page SSR → initialMinute prop → MatchLiveZone
      │         └──▶ overlayMatchStates → list surfaces (schedule, live page, WC hub)
      │                  (DATA-12 fix: now propagates minute field)
      └──▶ browser: MatchLiveZone (polls every 30s, shows minute or LIVE)
```

---

## Sample Data

*Paste `data12b_output_<id>.txt` contents here after running the script.*

```
[PASTE SCRIPT OUTPUT HERE]
```

---

## Summary Table

*Fill from script output — one row per sample.*

| Sample | Time (UTC) | Status | Provider | KV | Live-Score | Snapshot | Decision |
|--------|-----------|--------|----------|----|-----------|----------|----------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |
| 13 | | | | | | | |
| 14 | | | | | | | |
| 15 | | | | | | | |
| 16 | | | | | | | |
| 17 | | | | | | | |
| 18 | | | | | | | |
| 19 | | | | | | | |
| 20 | | | | | | | |

---

## Browser UI Verification

*Open manually at a sample when provider minute ≥ 10 (past startup lag).*

| Surface | URL | Expected | Actual | Pass? |
|---------|-----|----------|--------|-------|
| Match page hero | goalradar.org/match/537391 | `67'` + Second Half | | |
| Live page card | goalradar.org/live | `67'` + Second Half | | |
| WC Hub / Schedule | goalradar.org/world-cup-2026 | `67'` | | |
| Schedule page | goalradar.org/schedule | `67'` | | |

*Replace 67 with actual minute at time of check.*

---

## Success Criteria Checklist

- [ ] Provider minute present within 10 minutes of kickoff
- [ ] KV minute matches provider minute (≤ 30s lag)
- [ ] Live-score API minute matches KV minute
- [ ] Snapshot minute present after first page load
- [ ] Match page hero shows `{minute}'` not `LIVE` (when minute ≥ 1)
- [ ] Live page card shows `{minute}'` not `LIVE`
- [ ] WC hub / schedule card shows `{minute}'` not `LIVE`
- [ ] PAUSED state shows `HT` not `LIVE` on all surfaces
- [ ] Second Half / First Half / Stoppage Time labels visible
- [ ] Zero CLIENT_LOSS decisions in 20 samples

---

## Verdict: PENDING

*Update after running `data12b_sample.sh` and completing browser checks.*
