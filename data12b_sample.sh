#!/usr/bin/env bash
# DATA-12B Runtime Live Verification
# Run during France vs Senegal (537391) or Iraq vs Norway (537392)
#
# Usage:
#   export CRON_SECRET=<your_secret>
#   bash data12b_sample.sh 537391   # or 537392
#
# Output: data12b_output_<id>.txt  (paste into DATA12B_RUNTIME_REPORT.md)

set -euo pipefail

MATCH_ID="${1:-537391}"
BASE="https://www.goalradar.org"
SECRET="${CRON_SECRET:?CRON_SECRET must be set}"
OUTFILE="data12b_output_${MATCH_ID}.txt"
SAMPLES=20        # 20 × 30s = 10 minutes
INTERVAL=30

echo "=== DATA-12B Live Minute Verification ===" | tee "$OUTFILE"
echo "Match ID : $MATCH_ID"                       | tee -a "$OUTFILE"
echo "Started  : $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$OUTFILE"
echo "Samples  : $SAMPLES × ${INTERVAL}s"         | tee -a "$OUTFILE"
echo ""                                            | tee -a "$OUTFILE"

sample_num=0

while [ $sample_num -lt $SAMPLES ]; do
  sample_num=$((sample_num + 1))
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "--- Sample $sample_num/$SAMPLES at $TS ---" | tee -a "$OUTFILE"

  # ── Layer 1+2+3: minute-trace (provider / kv / live-score / snapshot) ──
  echo "[minute-trace]" | tee -a "$OUTFILE"
  TRACE=$(curl -sf "${BASE}/api/debug/minute-trace/${MATCH_ID}?secret=${SECRET}" 2>/dev/null || echo '{"error":"curl_failed"}')
  echo "$TRACE" | tee -a "$OUTFILE"

  # Extract key fields for the summary table
  P_MIN=$(echo "$TRACE" | grep -o '"providerMinute":[^,}]*' | grep -o '[0-9null]*$' | head -1)
  KV_MIN=$(echo "$TRACE" | grep -o '"kvMinute":[^,}]*' | grep -o '[0-9null]*$' | head -1)
  LS_MIN=$(echo "$TRACE" | grep -o '"liveScoreMinute":[^,}]*' | grep -o '[0-9null]*$' | head -1)
  SN_MIN=$(echo "$TRACE" | grep -o '"snapshotMinute":[^,}]*' | grep -o '[0-9null]*$' | head -1)
  STATUS=$(echo "$TRACE" | grep -o '"matchStatus":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' | head -1)
  DECISION=$(echo "$TRACE" | grep -o '"decision":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' | head -1)

  echo "  status=$STATUS  provider=$P_MIN  kv=$KV_MIN  live-score=$LS_MIN  snapshot=$SN_MIN  => $DECISION" | tee -a "$OUTFILE"

  # ── minute-health (all live matches) ──
  echo "[minute-health]" | tee -a "$OUTFILE"
  HEALTH=$(curl -sf "${BASE}/api/debug/minute-health?secret=${SECRET}" 2>/dev/null || echo '{"error":"curl_failed"}')
  echo "$HEALTH" | tee -a "$OUTFILE"

  # Extract this match's row
  DIAG=$(echo "$HEALTH" | grep -o '"diagnosis":"[^"]*"' | head -1 | grep -o '"[^"]*"$' | tr -d '"')
  echo "  minute-health.diagnosis=$DIAG" | tee -a "$OUTFILE"

  # ── live-score API (layer 3 in isolation) ──
  echo "[live-score]" | tee -a "$OUTFILE"
  LS=$(curl -sf "${BASE}/api/live-score/${MATCH_ID}" 2>/dev/null || echo '{"error":"curl_failed"}')
  LS_API_MIN=$(echo "$LS" | grep -o '"minute":[^,}]*' | grep -o '[0-9null]*$' | head -1)
  LS_STATUS=$(echo "$LS" | grep -o '"status":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' | head -1)
  echo "  status=$LS_STATUS  minute=$LS_API_MIN" | tee -a "$OUTFILE"
  echo "" | tee -a "$OUTFILE"

  # Don't sleep on the last sample
  if [ $sample_num -lt $SAMPLES ]; then
    sleep $INTERVAL
  fi
done

echo "=== Sampling complete ===" | tee -a "$OUTFILE"
echo "Finished : $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$OUTFILE"
echo "" | tee -a "$OUTFILE"

# ── Final snapshot of match page SSR (initialMinute) ──
echo "=== Match page SSR snapshot ===" | tee -a "$OUTFILE"
PAGE=$(curl -sf "${BASE}/match/${MATCH_ID}" 2>/dev/null || echo '')
INIT_MIN=$(echo "$PAGE" | grep -o '"initialMinute":[0-9]*' | head -1 | grep -o '[0-9]*$')
echo "initialMinute from SSR: ${INIT_MIN:-not_found}" | tee -a "$OUTFILE"
echo "" | tee -a "$OUTFILE"

# ── Summary table ──
echo "=== SUMMARY: check data12b_output_${MATCH_ID}.txt for full detail ===" | tee -a "$OUTFILE"
echo "Run: grep -E 'status=|Sample [0-9]' data12b_output_${MATCH_ID}.txt for quick scan" | tee -a "$OUTFILE"

echo ""
echo "Done. Output written to: $OUTFILE"
echo "Paste contents into DATA12B_RUNTIME_REPORT.md"
