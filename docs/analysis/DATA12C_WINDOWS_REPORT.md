# DATA-12C Windows Compatibility Report
## GoalRadar · PowerShell Live Sampler

Date: 2026-06-16T14:21Z

---

## Deliverable

`scripts/data12b_sample.ps1` — native PowerShell replacement for `data12b_sample.sh`.

No Git Bash, WSL, or POSIX dependency.

---

## How to Run

```powershell
$env:CRON_SECRET = "<secret>"
.\scripts\data12b_sample.ps1 537391
```

For Iraq vs Norway:

```powershell
$env:CRON_SECRET = "<secret>"
.\scripts\data12b_sample.ps1 537392
```

Output file: `data12b_output_537391.txt` (current directory).

Quick scan after run:

```powershell
Select-String "SUMMARY_ROW" data12b_output_537391.txt
```

---

## Compatibility

| Environment | Status |
|-------------|--------|
| Windows PowerShell 5.1 | ✅ Verified (build 19041) |
| PowerShell 7+ | ✅ Compatible (uses only core cmdlets) |
| Git Bash dependency | ✅ None |
| WSL dependency | ✅ None |
| External tools (curl, python, jq) | ✅ None — uses `Invoke-WebRequest` only |

---

## What the Script Does

20 samples × 30s = 10 minutes total. For each sample:

1. **`/api/debug/minute-trace/{id}`** (authenticated) — all 4 pipeline layers:
   - `providerMinute` from `minuteTrace.provider`
   - `kvMinute` from `minuteTrace.kv`
   - `liveScoreMinute` from `minuteTrace.liveScore`
   - `snapshotMinute` from `minuteTrace.snapshot`
   - `decision` (NO_LOSS / PROVIDER_LOSS / KV_LOSS / SNAPSHOT_LOSS / etc.)

2. **`/api/debug/minute-health`** (authenticated) — overall live match diagnosis.

3. **`/api/live-score/{id}`** (public) — what `MatchLiveZone` polls in the browser.

At the end: scrapes the match page SSR for `initialMinute` in the HTML.

Every sample writes a `SUMMARY_ROW` line for easy post-run scanning.

---

## Smoke Test Results

Run at 2026-06-16T14:21Z (match TIMED, 4.5h before kickoff):

```
Sample 1/1 at 2026-06-16T14:21:35Z
  trace:      status=TIMED  provider=null  kv=null  live-score=null  snapshot=null  => MATCH_NOT_LIVE
  health:     diagnosis=NO_LIVE_MATCHES
  live-score: status=TIMED  minute=null
  SUMMARY_ROW: 1  2026-06-16T14:21:35Z  TIMED  null  null  null  null  MATCH_NOT_LIVE
```

All three endpoints responded correctly. Pre-match state confirmed.

---

## Field Extraction

The script uses regex against raw JSON (no `ConvertFrom-Json`) to avoid object
model differences between PS 5.1 and PS 7. Extraction validated:

| Field | Source | Verified |
|-------|--------|---------|
| `decision` | top-level `trace` | ✅ `MATCH_NOT_LIVE` |
| `status` | `snapshotMatch.status` | ✅ `TIMED` |
| `provider/kv/liveScore/snapshot` | `minuteTrace` sub-object | ✅ all `null` pre-match |
| `diagnosis` | `minute-health` top-level | ✅ `NO_LIVE_MATCHES` |
| `minute` | `live-score` top-level | ✅ `null` |

---

## Run at Kickoff

France vs Senegal kicks off at **19:00Z** today (2026-06-16).

```powershell
# Set once in your terminal — persists for the session
$env:CRON_SECRET = "<your_secret>"

# Run at or just after 19:00Z
.\scripts\data12b_sample.ps1 537391
```

Expected during match (minute ~30):

```
SUMMARY_ROW: 8  2026-06-16T19:25:35Z  IN_PLAY  30  30  30  30  NO_LOSS
```

Paste `data12b_output_537391.txt` into `DATA12B_RUNTIME_REPORT.md` when done.

---

## Verdict: GREEN

Script runs without Git Bash or WSL. All endpoints probed successfully on
Windows PowerShell 5.1. Ready for live match verification at 19:00Z.
