# Alerting Validation — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.2

---

## Validation Status

| Test | Result |
|------|--------|
| TypeScript compilation | ✅ Clean (tsc --noEmit) |
| All 8 RF trigger functions exist | ✅ |
| Dedup key format verified | ✅ |
| Suppression window constants verified | ✅ |
| Slack Block Kit message structure valid | ✅ |
| `/api/debug/test-alert` endpoint wired | ✅ |
| RF-2 auto-threshold (5 min staleness) | ✅ |
| RF-6 auto-threshold (reachable=false) | ✅ |
| `evaluateHealth()` bulk router | ✅ |
| Dry-run mode (no send, no KV write) | ✅ |

---

## Scenario Validation

### Scenario 1 — RF-2 World Cup Live Score Frozen (10 min)

**Input:**
```typescript
routeRF2({
  matchId:          'WC-2026-FIN-001',
  stalenessSeconds: 610,
  isWorldCup:       true,
  matchLabel:       'Brazil vs Argentina',
})
```

**Expected output:**
- `severity: CRITICAL`
- `suppressed: false` (first fire)
- `sent: true` (with real Slack webhook)
- Slack message colour: `#7b0d1e`
- Suppression window: `0ms` (CRITICAL never suppresses)
- Alert fires again immediately if still stale

**Verified logic path:**
```
stalenessSeconds=610 > 600 AND isWorldCup=true → CRITICAL
SUPPRESSION_MS.CRITICAL = 0 → markAlertSent() is a no-op
Every call fires Slack immediately
```

---

### Scenario 2 — RF-6 KV Unavailable on Match Day

**Input:**
```typescript
routeRF6({
  reachable:    false,
  errorMessage: 'ECONNREFUSED',
  isMatchDay:   true,
})
```

**Expected output:**
- `severity: CRITICAL`
- `suppressed: false` (first fire)
- `sent: true`
- Slack message body: "KV is fully unreachable. ⚠️ MATCH DAY IMPACT."
- Suppression: 0ms (CRITICAL)

**Verified logic path:**
```
reachable=false AND isMatchDay=true → CRITICAL
```

---

### Scenario 3 — RF-3 Cache Miss Spike (Non-Critical)

**Input:**
```typescript
routeRF3({ hitRate: 0.55, totalKeys: 62 })
```

**Expected output:**
- `severity: YELLOW` (hitRate 0.40–0.60)
- `dedupKey: 'goalradar:alert:dedup:RF-3:system'`
- `suppressUntil` = now + 900_000 ms (15 min)

**Second call within 15 min:**
- `suppressed: true`
- `deduplicated: true`
- `reason: 'Suppressed until 2026-06-18T...'`

**Verified logic path:**
```
hitRate=0.55: NOT < 0.40, NOT === 0 → YELLOW
SUPPRESSION_MS.YELLOW = 15 * 60 * 1000 = 900_000ms
KV key set with ex=900
Second call within window: isAlertSuppressed() returns suppressed=true
```

---

### Scenario 4 — RF-2 Non-WC Score Stale (3 min, below threshold)

**Input (from evaluateHealth):**
```typescript
evaluateHealth({
  liveMatches: [{
    matchId: 'match-123',
    stalenessSeconds: 180,   // 3 min — below 5 min threshold
    isWorldCup: false,
  }]
})
```

**Expected output:**
- RF-2 alert NOT fired (`stalenessSeconds < 300`)
- `fired: 0`

**Verified logic path:**
```
evaluateHealth: stalenessSeconds=180 < 300 → skip, no routeRF2() call
```

---

### Scenario 5 — evaluateHealth Bulk Fire (RF-6 + RF-3 simultaneously)

**Input:**
```typescript
evaluateHealth({
  kvReachable:    false,
  isMatchDay:     false,
  cacheHitRate:   0.0,    // will also trigger RF-3
  cacheTotalKeys: 0,
})
```

**Expected output:**
- RF-6 fires: `severity: RED` (unreachable, not match day)
- RF-3 fires: `severity: CRITICAL` (hitRate=0, suggests KV down)
- Both fire independently with their own dedup keys
- RF-3 description: "Authority Cache hit rate is 0% — KV may be unavailable. Check RF-6."
- `fired: 2` total

**Note:** Both alerts are correct. RF-3 at hitRate=0 is a symptom indicator
pointing to RF-6. The on-call engineer sees both alerts and connects the cause.

---

### Scenario 6 — RF-8 Prewarm Failure, Kickoff in 12 Minutes

**Input:**
```typescript
routeRF8({
  failedMatchIds:       ['WC-2026-023', 'WC-2026-024'],
  minutesToNextKickoff: 12,
  totalScheduled:       4,
})
```

**Expected output:**
- `severity: CRITICAL` (minutesToNextKickoff < 15)
- `suppressed: false`
- Description: "⚡ URGENT: 2 WC fixture(s) unprewarm'd with 12m to kickoff..."
- `sent: true`
- Suppression: 0ms (CRITICAL)

---

### Scenario 7 — Dry-Run Mode

**Input:**
```typescript
fireAlert(payload, { dryRun: true })
```

**Expected output:**
- `sent: false`
- `dryRun: true`
- `reason: 'dry-run — message built but not sent'`
- No Slack POST made
- No KV key written
- `slackMessage` object included in `/api/debug/test-alert` response

**Verified:** `postToSlack()` is only called when `dryRun === false`.
`markAlertSent()` is only called when `dryRun === false`.

---

### Scenario 8 — Missing SLACK_WEBHOOK_URL

**Input:**
- `SLACK_WEBHOOK_URL` env var not set
- `fireAlert()` called with `dryRun: false`

**Expected output:**
- `sent: false`
- `reason: 'SLACK_WEBHOOK_URL not configured'`
- No crash, no unhandled exception

**Verified:** `postToSlack()` checks for `webhookUrl` before fetch.

---

### Scenario 9 — Missing KV (dedup unavailable)

**Input:**
- `KV_REST_API_URL` or `KV_REST_API_TOKEN` not set
- `fireAlert()` called

**Expected output:**
- `isAlertSuppressed()` returns `{ suppressed: false }` immediately
- Alert fires on every call (no suppression possible)
- `markAlertSent()` is a no-op (no KV to write)
- System remains functional — alerts just fire without dedup

**Verified:** Both `isAlertSuppressed()` and `markAlertSent()` guard on
env var presence before making fetch calls.

---

## `/api/debug/test-alert` Endpoint Validation

### Valid request
```
GET /api/debug/test-alert?rf=RF-2&severity=RED&dryRun=true
Authorization: Bearer $CRON_SECRET
```

**Expected response shape:**
```json
{
  "schemaVersion": "DATA-18OPS.2",
  "test": true,
  "dryRun": true,
  "rf": "RF-2",
  "rfName": "Live Score Not Updating",
  "severity": "RED",
  "scope": "test-match-001",
  "metric": "stalenessSeconds: 480",
  "suppressionWindowMs": 300000,
  "suppressionWindowLabel": "5m",
  "result": {
    "sent": false,
    "suppressed": false,
    "deduplicated": false,
    "dryRun": true,
    "reason": "dry-run — message built but not sent",
    "dedupKey": "goalradar:alert:dedup:RF-2:test-match-001"
  },
  "slackMessage": { "attachments": [...] },
  "note": "dry-run: Slack message built but NOT sent...",
  "env": {
    "slackConfigured": true,
    "kvConfigured": true
  }
}
```

### Invalid RF
```
GET /api/debug/test-alert?rf=RF-99
```
**Expected:** HTTP 400, `{ "error": "Invalid rf: RF-99. Must be one of RF-1, ..." }`

### Unauthorized
```
GET /api/debug/test-alert
```
(No Authorization header in production)
**Expected:** HTTP 401, `{ "error": "Unauthorized" }`

---

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| RF-2 automatically generates a Slack alert | ✅ `routeRF2()` fires when `stalenessSeconds ≥ 300` |
| RF-6 automatically generates a Slack alert | ✅ `routeRF6()` fires when `reachable=false` or `latencyMs > 500` |
| All RF-1→8 have trigger functions | ✅ 8/8 in `notification-router.ts` |
| Deduplication prevents alert storms | ✅ KV TTL-based dedup in `alerting.ts` |
| Suppression windows per severity | ✅ `SUPPRESSION_MS` constants in `alerting.ts` |
| Dry-run mode | ✅ `dryRun` option in `fireAlert()` and test endpoint |
| Test endpoint for all RFs | ✅ `/api/debug/test-alert` |
| Graceful degradation (no Slack / no KV) | ✅ Both checked, non-fatal fallback |

---

## Open Items

| Item | Priority | Notes |
|------|----------|-------|
| Wire `evaluateHealth()` to a cron job | HIGH | See ALERTING_RUNBOOK.md for skeleton |
| Verify Slack webhook in production | HIGH | Run Scenario 1 test with dryRun=false |
| Clear dedup keys after testing | MEDIUM | Avoid 5-min RED suppression after test |
| Add RF-4 to health-check cron | LOW | Needs match state data source |
| Add RF-1 to health-check cron | LOW | Needs 404 rate data source |
