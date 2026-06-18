# Alerting Runbook — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.2

---

## Overview

DATA-18OPS.2 converts GoalRadar reliability monitoring from pull-based
(debug endpoint polling) to push-based (Slack alerts on threshold breach).

**Coverage:** RF-1 → RF-8  
**Channel:** Slack webhook only (no PagerDuty)  
**Primary targets:** RF-2 (live score frozen) and RF-6 (KV unavailable)

---

## Setup

### Step 1 — Create Slack Incoming Webhook

1. Go to https://api.slack.com/apps → Your App → Incoming Webhooks
2. Activate Incoming Webhooks → Add New Webhook to Workspace
3. Select channel: `#ops-alerts` (create if it doesn't exist)
4. Copy the webhook URL: `https://hooks.slack.com/services/T.../B.../...`

### Step 2 — Configure Environment Variable

In Vercel → Project → Settings → Environment Variables:

```
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/T.../B.../...
```

Set for: Production + Preview (not Development unless you want test noise).

No redeployment required — env vars are read at runtime, not build time.

### Step 3 — Verify Configuration

```bash
curl -X GET "$GOALRADAR_URL/api/debug/test-alert?rf=RF-2&severity=RED&dryRun=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response should include `"slackConfigured": true` and `"slackMessage": {...}`.

If `"slackConfigured": false`: `SLACK_WEBHOOK_URL` is not set in the environment.

### Step 4 — Send First Real Test Alert

```bash
curl -X GET "$GOALRADAR_URL/api/debug/test-alert?rf=RF-2&severity=RED&dryRun=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Verify the message appears in `#ops-alerts` with:
- 🔴 RED severity header
- RF-2 title and description
- Runbook link button
- Dedup key in context footer

---

## Alert Architecture

### Files

| File | Purpose |
|------|---------|
| `src/lib/alerting.ts` | Core: Slack posting, dedup, message formatting |
| `src/lib/notification-router.ts` | Per-RF trigger functions + bulk health evaluator |
| `src/app/api/debug/test-alert/route.ts` | Manual test endpoint |

### Alert Flow

```
Signal detected (metric threshold breached)
    │
    ▼
routeRF{N}(signal) — notification-router.ts
    │
    ▼
fireAlert(payload) — alerting.ts
    │
    ├─ Check KV dedup key: goalradar:alert:dedup:{rfId}:{scope}
    │   ├─ Key exists (TTL active) → SUPPRESSED, return early
    │   └─ Key absent → continue
    │
    ├─ Build Slack Block Kit message
    │
    ├─ POST to SLACK_WEBHOOK_URL
    │   ├─ Success → mark dedup key in KV with TTL = suppression window
    │   └─ Failure → return { sent: false, reason: "..." }
    │
    └─ Return AlertResult
```

### Suppression Windows

| Severity | Window | Rationale |
|----------|--------|-----------|
| INFO | 60 min | Low noise, no urgency |
| WARNING | 30 min | Monitor trend, don't spam |
| YELLOW | 15 min | Sustained degradation |
| RED | 5 min | Urgent, allow re-fire if ongoing |
| CRITICAL | None | Always fires — no suppression |

### Dedup Key Format

```
goalradar:alert:dedup:{rfId}:{scope}

Examples:
  goalradar:alert:dedup:RF-2:WC-2026-012     # match-scoped
  goalradar:alert:dedup:RF-6:system          # system-wide
  goalradar:alert:dedup:RF-3:system          # system-wide
```

TTL value stored = epoch ms when suppression expires (for display in response).

---

## Integrating Alerts into Health Check Cron

The primary use pattern is calling `evaluateHealth()` from a scheduled
cron job every 5 minutes. Example cron route skeleton:

```typescript
// src/app/api/cron/health-check/route.ts
import { evaluateHealth } from '@/lib/notification-router';

export async function GET(req: NextRequest) {
  // ... auth check ...

  // Collect live signals from existing debug endpoints
  const [cacheData, /* other signals */] = await Promise.all([
    fetch('/api/debug/authority-cache').then(r => r.json()),
    // ...
  ]);

  const summary = await evaluateHealth({
    cacheHitRate:    cacheData.hitRate,
    cacheTotalKeys:  cacheData.totalKeys,
    kvReachable:     cacheData.kvReachable,
    liveMatches:     cacheData.liveMatches,
    // ...
  });

  return NextResponse.json(summary);
}
```

Cron schedule in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/health-check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## Testing Each Alert

### Test endpoint parameters

```
GET /api/debug/test-alert
  ?rf=RF-1..RF-8     (required: which risk factor)
  &severity=RED      (optional: INFO/WARNING/YELLOW/RED/CRITICAL)
  &scope=my-match    (optional: defaults to "test-match-001")
  &dryRun=true       (optional: false to actually send; default true)
```

### Quick tests for all RFs

```bash
BASE="$GOALRADAR_URL/api/debug/test-alert"
AUTH="-H 'Authorization: Bearer $CRON_SECRET'"

# Dry-run all RFs
for rf in RF-1 RF-2 RF-3 RF-4 RF-5 RF-6 RF-7 RF-8; do
  curl -s "$BASE?rf=$rf&dryRun=true" $AUTH | jq '{rf: .rf, built: (.slackMessage != null)}'
done

# Real send for RF-2 and RF-6 (primary targets)
curl -s "$BASE?rf=RF-2&severity=RED&dryRun=false" $AUTH | jq '{sent: .result.sent, suppressed: .result.suppressed}'
curl -s "$BASE?rf=RF-6&severity=RED&dryRun=false" $AUTH | jq '{sent: .result.sent, suppressed: .result.suppressed}'
```

### Clear dedup key manually (for repeated testing)

```bash
# Via Upstash console: DEL goalradar:alert:dedup:RF-2:test-match-001
# Or via KV REST:
curl "$KV_REST_API_URL/del/goalradar:alert:dedup:RF-2:test-match-001" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN"
```

---

## Slack Message Format

Each alert is an **attachment** (coloured sidebar) with Block Kit blocks:

```
┌────────────────────────────────────────────────┐
│ 🔴  GoalRadar Alert — RED                      │ ← header block
│                                                 │
│  Live Score Not Updating                        │ ← section: title
│  Live match score has not updated for 8m...    │   + description
│                                                 │
│  Incident         Severity                      │ ← section: fields
│  RF-2 — Live...   🔴 RED                        │
│                                                 │
│  Scope            Triggered                     │
│  WC-2026-012      2026-06-18 21:07:33 UTC       │
│                                                 │
│  Metric                                         │
│  stalenessSeconds: 480                          │
│                                                 │
│  [📖 Open Runbook]   ← danger-style button      │
│                                                 │
│  GoalRadar Reliability | DATA-18OPS.2 | ...    │ ← context footer
└────────────────────────────────────────────────┘
```

Attachment colour by severity:
| Severity | Colour |
|----------|--------|
| INFO | `#36a64f` (green) |
| WARNING | `#ffa500` (orange) |
| YELLOW | `#ffcc00` (yellow) |
| RED | `#dc3545` (red) |
| CRITICAL | `#7b0d1e` (dark red) |

---

## Operating the Alert System

### How to silence a noisy alert temporarily

Set the dedup key manually with a longer TTL:

```bash
# Suppress RF-3 system alerts for 2 hours (7200 seconds)
curl "$KV_REST_API_URL/set/goalradar:alert:dedup:RF-3:system/manual-suppression?ex=7200" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN"
```

### How to check what is currently suppressed

```bash
# List all active dedup keys
curl "$KV_REST_API_URL/keys/goalradar:alert:dedup:*" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN"
```

### How to re-enable an alert before its suppression expires

```bash
# Delete dedup key → next matching signal will fire immediately
curl "$KV_REST_API_URL/del/goalradar:alert:dedup:RF-2:WC-2026-012" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN"
```

### Alert volume estimates (per match day)

| RF | Expected fires/day | Suppressed/day | Net alerts |
|----|-------------------|---------------|------------|
| RF-2 | 0–3 (only if ESPN issues) | Varies | 0–3 |
| RF-3 | 0–1 | 1 suppression cycle | 0–1 |
| RF-6 | 0 (rare) | 0 | 0 |
| RF-8 | 0–1 (if prewarm fails) | 0–1 | 0–1 |
| All others | 0–2 combined | Varies | 0–2 |

Normal match day: **0–5 Slack alerts total**.

---

## Troubleshooting

### "slackConfigured: false" in test-alert response
→ `SLACK_WEBHOOK_URL` not set in Vercel environment.

### Alert sends but Slack shows no message
→ Webhook URL may be revoked. Test directly:
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"text": "GoalRadar webhook test"}'
```
Expected: `ok`. If `no_service`: regenerate webhook in Slack app settings.

### Alert shows `suppressed: true` when it shouldn't
→ Dedup key is still active. Delete it manually (see above).

### Alert shows `sent: false` with no error
→ Check `result.reason` field in the API response.

### `kvConfigured: false` in test-alert response
→ KV is not available — dedup will not work. Alerts will fire on every call
(no suppression possible without KV). Still functionally correct but noisy.
Configure KV to restore dedup.
