#!/bin/bash
# DATA-11D Controlled Production Rollout — Execution Script
#
# Usage:
#   export CRON_SECRET=<your_cron_secret>
#   bash data11d_rollout.sh
#
# Output: data11d_output.txt (paste this back for report generation)
#
# REQUIRES: CRON_SECRET env var set before running.
# DO NOT share CRON_SECRET in output — it is only used for HTTP auth.

set -e
BASE="https://www.goalradar.org"
SECRET="$CRON_SECRET"
OUT="data11d_output.txt"

if [ -z "$SECRET" ]; then
  echo "ERROR: CRON_SECRET is not set. Run: export CRON_SECRET=<secret>"
  exit 1
fi

{

echo "=== DATA-11D Rollout Output ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ─── Phase 1: Production Readiness Audit ────────────────────────────────────
echo "=== PHASE 1: Production Readiness Audit ==="
echo ""

echo "--- Endpoint: hybrid-enrichment inspect (should be 200) ---"
R=$(curl -s -w "\n%{http_code}" "$BASE/api/debug/hybrid-enrichment/537358?secret=$SECRET")
CODE=$(echo "$R" | tail -1)
BODY=$(echo "$R" | head -n -1)
echo "HTTP: $CODE"
echo "$BODY" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log(JSON.stringify({ enrichmentEnabled: j.enrichmentEnabled, apiFootballKeySet: j.apiFootballKeySet, kvEnabled: j.kvEnabled, lookupTablePresent: j.lookupTablePresent, snapshotStatus: j.snapshotStatus }, null, 2)); } catch(e) { console.log(d.slice(0,300)); } })" 2>/dev/null
echo ""

echo "--- Endpoint: refresh-lookup reachable (POST, should be 200 or 500 on missing key) ---"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/debug/hybrid-enrichment/refresh-lookup?secret=$SECRET")
CODE=$(echo "$R" | tail -1)
BODY=$(echo "$R" | head -n -1)
echo "HTTP: $CODE"
echo "$BODY" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { console.log(JSON.stringify(JSON.parse(d), null, 2)); } catch(e) { console.log(d.slice(0,300)); } })" 2>/dev/null
echo ""

echo "--- Endpoint: revalidate match (should be 200) ---"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/revalidate/match/537358?secret=$SECRET")
CODE=$(echo "$R" | tail -1)
BODY=$(echo "$R" | head -n -1)
echo "HTTP: $CODE"
echo "$BODY" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { console.log(JSON.stringify(JSON.parse(d), null, 2)); } catch(e) { console.log(d.slice(0,300)); } })" 2>/dev/null
echo ""

# ─── Phase 2: Seed Lookup Table ──────────────────────────────────────────────
echo "=== PHASE 2: Seed Lookup Table ==="
echo ""
echo "--- Calling refresh-lookup ---"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/debug/hybrid-enrichment/refresh-lookup?secret=$SECRET")
CODE=$(echo "$R" | tail -1)
BODY=$(echo "$R" | head -n -1)
echo "HTTP: $CODE"
echo "$BODY" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log(JSON.stringify({ ok: j.ok, count: j.count, collisions: j.collisions, key: j.key, refreshedAt: j.refreshedAt, error: j.error }, null, 2)); } catch(e) { console.log(d.slice(0,300)); } })" 2>/dev/null
echo ""

# ─── Phase 3: Invalidate Snapshots ───────────────────────────────────────────
echo "=== PHASE 3: Invalidate Snapshots ==="
echo ""
for id in 537358 537364 537352; do
  echo "--- Invalidating match $id ---"
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/revalidate/match/$id?secret=$SECRET")
  CODE=$(echo "$R" | tail -1)
  BODY=$(echo "$R" | head -n -1)
  echo "HTTP: $CODE | $(echo $BODY | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); process.stdout.write(JSON.stringify({ok:j.ok,matchId:j.matchId})); } catch(e) { process.stdout.write(d.slice(0,100)); } })" 2>/dev/null)"
done
echo ""

# ─── Wait for snapshot rebuild (next page request triggers buildSnapshot) ────
echo "--- Triggering snapshot rebuild via page fetch (causes buildSnapshot to run) ---"
for id in 537358 537364 537352; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/match/$id")
  echo "  match/$id → HTTP $CODE"
done
echo "Waiting 5s for snapshot writes..."
sleep 5
echo ""

# ─── Phase 4: Verify Enrichment ──────────────────────────────────────────────
echo "=== PHASE 4: Verify Enrichment ==="
echo ""
for id in 537358 537364 537352; do
  echo "--- Enrichment state: match $id ---"
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/debug/hybrid-enrichment/$id?secret=$SECRET")
  CODE=$(echo "$R" | tail -1)
  BODY=$(echo "$R" | head -n -1)
  echo "HTTP: $CODE"
  echo "$BODY" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log(JSON.stringify({ fdMatchId: j.fdMatchId, enrichmentEnabled: j.enrichmentEnabled, lookupTablePresent: j.lookupTablePresent, lookupTableEntries: j.lookupTableEntries, mappingKey: j.mappingKey, afFixtureId: j.afFixtureId, eventsCachePresent: j.eventsCachePresent, snapshotStatus: j.snapshotStatus, snapshotGoalsCount: j.snapshotGoalsCount, snapshotBookingsCount: j.snapshotBookingsCount, snapshotSubsCount: j.snapshotSubsCount, enrichmentApplied: j.enrichmentApplied, source: j.source }, null, 2)); } catch(e) { console.log(d.slice(0,300)); } })" 2>/dev/null
  echo ""
done

# ─── Phase 5: Capture page snapshots ─────────────────────────────────────────
echo "=== PHASE 5: Page Content Verification ==="
echo ""
for id in 537358 537364 537352; do
  echo "--- Page content: /match/$id ---"
  # Fetch the rendered page and look for goal/scorer sections
  PAGE=$(curl -s "$BASE/match/$id")

  # Check for GoalScorers content (actual scorer names)
  GOALS_SECTION=$(echo "$PAGE" | grep -o 'GoalScorers\|goal-scorers\|goalscorers\|data-section="goals"' | head -1 || echo "not-found")

  # Look for known scorer patterns in WC matches
  HAS_SCORERS=$(echo "$PAGE" | grep -cE "([0-9]+)'|[0-9]+'" 2>/dev/null || echo "0")

  # Look for booking/substitution sections
  HAS_BOOKINGS=$(echo "$PAGE" | grep -ic "booking\|yellow.card\|red.card" 2>/dev/null || echo "0")
  HAS_SUBS=$(echo "$PAGE" | grep -ic "substitut" 2>/dev/null || echo "0")

  # Extract match title from page
  TITLE=$(echo "$PAGE" | grep -o '<title>[^<]*</title>' | head -1 || echo "no-title")

  echo "  title: $TITLE"
  echo "  minute_patterns_in_page: $HAS_SCORERS"
  echo "  booking_mentions: $HAS_BOOKINGS"
  echo "  substitution_mentions: $HAS_SUBS"
  echo ""
done

echo "=== ROLLOUT COMPLETE ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

} 2>&1 | tee "$OUT"

echo ""
echo "Output saved to: $OUT"
echo "Paste contents of $OUT (NOT this script or your CRON_SECRET) into the chat."
