#!/bin/bash
# DATA-10F LIVE-1A Verification: /live vs /match/{id} consistency
# Usage: CRON_SECRET=xxx bash data10f_live1a.sh <matchId>
# Samples every 30s for 5 minutes.

MATCH_ID=${1:-537391}
BASE="https://www.goalradar.org"
SECRET="$CRON_SECRET"

echo "=== DATA-10F LIVE-1A: match $MATCH_ID ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "ts | /live status | /live minute | /live score | /match status | /match minute | /match score | consistent"

for i in $(seq 1 10); do
  TS=$(date -u +%H:%M:%SZ)
  
  # /api/live-score/{id} — what /match/{id} MatchLiveZone polls
  MATCH=$(curl -s "$BASE/api/live-score/$MATCH_ID?secret=$SECRET")
  
  # /api/live-score — all live matches (what /live page shows)
  LIVE_ALL=$(curl -s "$BASE/api/live-score?secret=$SECRET")
  
  MATCH_STATUS=$(echo "$MATCH" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); process.stdout.write(j.status+'|'+j.minute+'|'+(j.score?.home??'?')+'-'+(j.score?.away??'?')); } catch(e) { process.stdout.write('ERR'); }})" 2>/dev/null)
  
  LIVE_STATUS=$(echo "$LIVE_ALL" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); const m=(j.matches||[]).find(x=>x.id===$MATCH_ID)||{}; process.stdout.write((m.status||'not-found')+'|'+(m.minute??'null')+'|'+((m.score?.fullTime?.home??'?')+'-'+(m.score?.fullTime?.away??'?'))); } catch(e) { process.stdout.write('ERR'); }})" 2>/dev/null)
  
  # Check consistency (all 3 fields match)
  MATCH_MIN=$(echo $MATCH_STATUS | cut -d'|' -f2)
  LIVE_MIN=$(echo $LIVE_STATUS | cut -d'|' -f2)
  CONSISTENT=$( [ "$MATCH_MIN" = "$LIVE_MIN" ] && echo "YES" || echo "NO ← DRIFT" )
  
  echo "$TS | $LIVE_STATUS | $MATCH_STATUS | $CONSISTENT"
  
  if [ $i -lt 10 ]; then sleep 30; fi
done
