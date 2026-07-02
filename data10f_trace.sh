#!/bin/bash
# DATA-10F Live Trace Script
# Usage: CRON_SECRET=xxx bash data10f_trace.sh <matchId>
# Run during an IN_PLAY WC match.

MATCH_ID=${1:-537391}
BASE="https://www.goalradar.org"
SECRET="$CRON_SECRET"
INTERVAL=30  # seconds between samples
SAMPLES=10   # 10 samples = 5 minutes

echo "=== DATA-10F Live Trace: match $MATCH_ID ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

for i in $(seq 1 $SAMPLES); do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  
  # Minute trace (all 4 layers)
  TRACE=$(curl -s "$BASE/api/debug/minute-trace/$MATCH_ID?secret=$SECRET")
  
  # Live score (what MatchLiveZone polls)
  LIVE=$(curl -s "$BASE/api/live-score/$MATCH_ID?secret=$SECRET")
  
  # Extract key fields
  DECISION=$(echo "$TRACE" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log(j.decision); } catch(e) { console.log('PARSE_ERROR'); }})" 2>/dev/null)
  MINUTES=$(echo "$TRACE" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); const t=j.minuteTrace; console.log('provider:'+t.provider+' kv:'+t.kv+' liveScore:'+t.liveScore+' snapshot:'+t.snapshot); } catch(e) { console.log('PARSE_ERROR'); }})" 2>/dev/null)
  LIVE_MIN=$(echo "$LIVE" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log('status:'+j.status+' minute:'+j.minute+' score:'+j.score?.home+'-'+j.score?.away); } catch(e) { console.log('PARSE_ERROR'); }})" 2>/dev/null)
  
  echo "[$i] $TS"
  echo "  minuteTrace: $MINUTES"
  echo "  liveScore:   $LIVE_MIN"
  echo "  decision:    $DECISION"
  echo "  raw_trace:"
  echo "$TRACE" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log('    '+JSON.stringify({matchId:j.matchId,decision:j.decision,minuteTrace:j.minuteTrace,kvAgeSeconds:j.kvAgeSeconds,liveScoreStep:j.liveScoreStep},null,2).replace(/\n/g,'\n    ')); } catch(e) { console.log('  PARSE_ERROR: '+d.slice(0,100)); }})" 2>/dev/null
  echo ""
  
  if [ $i -lt $SAMPLES ]; then
    sleep $INTERVAL
  fi
done

echo "=== Trace complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
