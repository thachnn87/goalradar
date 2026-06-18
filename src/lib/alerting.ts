/**
 * alerting.ts — DATA-18OPS.2
 *
 * Push-based Slack alerting for all GoalRadar reliability signals (RF-1→8).
 *
 * Features:
 *   - Per-severity suppression windows (dedup via KV TTL)
 *   - Slack Block Kit message formatting
 *   - Dry-run mode (formats message without sending)
 *   - Graceful degradation when KV or Slack is unavailable
 *
 * KV keys written by this module:
 *   goalradar:alert:dedup:{rfId}:{scope}  — SET, TTL = suppression window
 *
 * No other KV mutations. Additive — modifies no existing file.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'INFO' | 'WARNING' | 'YELLOW' | 'RED' | 'CRITICAL';

export type RiskFactorId =
  | 'RF-1' | 'RF-2' | 'RF-3' | 'RF-4'
  | 'RF-5' | 'RF-6' | 'RF-7' | 'RF-8';

export interface AlertPayload {
  rfId:            RiskFactorId;
  severity:        AlertSeverity;
  title:           string;
  description:     string;
  /** matchId, 'system', or any scoping string — used to key dedup. */
  scope:           string;
  /** Human-readable metric value, e.g. "hitRate: 0.45" */
  metric?:         string;
  /** OPS_RUNBOOKS.md anchor, e.g. "#rb-2--live-score-not-updating" */
  runbookAnchor?:  string;
  triggeredAt:     number;  // epoch ms
}

export interface AlertResult {
  sent:           boolean;
  suppressed:     boolean;
  deduplicated:   boolean;
  dryRun:         boolean;
  reason?:        string;
  dedupKey?:      string;
  suppressUntil?: number;  // epoch ms when suppression expires
}

// ---------------------------------------------------------------------------
// Suppression windows (ms per severity)
// ---------------------------------------------------------------------------

export const SUPPRESSION_MS: Record<AlertSeverity, number> = {
  INFO:     60 * 60 * 1000,   //  60 min — informational, low noise
  WARNING:  30 * 60 * 1000,   //  30 min
  YELLOW:   15 * 60 * 1000,   //  15 min
  RED:       5 * 60 * 1000,   //   5 min — urgent, allow re-fire
  CRITICAL:              0,   //   0 ms  — never suppress, always fire
};

// ---------------------------------------------------------------------------
// RF metadata — title + default severity + runbook anchor
// ---------------------------------------------------------------------------

export interface RFMeta {
  name:           string;
  defaultSeverity: AlertSeverity;
  runbookAnchor:  string;
}

export const RF_META: Record<RiskFactorId, RFMeta> = {
  'RF-1': {
    name:            'Match Not Found / Stale Identity',
    defaultSeverity: 'WARNING',
    runbookAnchor:   '#rb-1--match-not-found--stale-identity',
  },
  'RF-2': {
    name:            'Live Score Not Updating',
    defaultSeverity: 'RED',
    runbookAnchor:   '#rb-2--live-score-not-updating',
  },
  'RF-3': {
    name:            'Authority Cache Miss Spike',
    defaultSeverity: 'WARNING',
    runbookAnchor:   '#rb-3--authority-cache-miss-spike',
  },
  'RF-4': {
    name:            'Match State Classification Error',
    defaultSeverity: 'WARNING',
    runbookAnchor:   '#rb-4--match-state-classification-error',
  },
  'RF-5': {
    name:            'ESPN Data Quality Degradation',
    defaultSeverity: 'WARNING',
    runbookAnchor:   '#rb-5--espn-data-quality-degradation',
  },
  'RF-6': {
    name:            'KV Unavailable / Degraded',
    defaultSeverity: 'RED',
    runbookAnchor:   '#rb-6--kv-unavailable--degraded',
  },
  'RF-7': {
    name:            'Elevated Repair Frequency',
    defaultSeverity: 'YELLOW',
    runbookAnchor:   '#rb-7--elevated-repair-frequency',
  },
  'RF-8': {
    name:            'World Cup Prewarm Failure',
    defaultSeverity: 'WARNING',
    runbookAnchor:   '#rb-8--world-cup-prewarm-failure',
  },
};

// ---------------------------------------------------------------------------
// Severity visual mapping
// ---------------------------------------------------------------------------

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  INFO:     'ℹ️',
  WARNING:  '⚠️',
  YELLOW:   '🟡',
  RED:      '🔴',
  CRITICAL: '🚨',
};

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  INFO:     '#36a64f',
  WARNING:  '#ffa500',
  YELLOW:   '#ffcc00',
  RED:      '#dc3545',
  CRITICAL: '#7b0d1e',
};

// ---------------------------------------------------------------------------
// KV deduplication
// ---------------------------------------------------------------------------

function buildDedupKey(rfId: RiskFactorId, scope: string): string {
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `goalradar:alert:dedup:${rfId}:${safeScope}`;
}

async function isAlertSuppressed(
  dedupKey: string,
): Promise<{ suppressed: boolean; suppressUntil?: number }> {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return { suppressed: false };

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(dedupKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return { suppressed: false };
    const body = await res.json() as { result: string | null };
    if (body.result === null) return { suppressed: false };

    const suppressUntil = parseInt(body.result, 10);
    return { suppressed: true, suppressUntil };
  } catch {
    return { suppressed: false };
  }
}

async function markAlertSent(
  key:           string,
  suppressionMs: number,
  nowMs:         number,
): Promise<void> {
  if (suppressionMs === 0) return;   // CRITICAL — no dedup

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  const expiryMs  = nowMs + suppressionMs;
  const expiryTtl = Math.ceil(suppressionMs / 1000);

  try {
    await fetch(
      `${url}/set/${encodeURIComponent(key)}/${expiryMs}?ex=${expiryTtl}`,
      {
        method:  'GET',   // Upstash REST uses GET for SET with inline value
        headers: { Authorization: `Bearer ${token}` },
        cache:   'no-store',
      },
    );
  } catch {
    // Fire-and-forget — failing to mark dedup is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Slack Block Kit message builder
// ---------------------------------------------------------------------------

export function buildSlackMessage(payload: AlertPayload): object {
  const meta     = RF_META[payload.rfId];
  const emoji    = SEVERITY_EMOJI[payload.severity];
  const color    = SEVERITY_COLOR[payload.severity];
  const ts       = new Date(payload.triggeredAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const runbook  = payload.runbookAnchor ?? meta.runbookAnchor;

  const fields: Array<{ type: string; text: string }> = [
    { type: 'mrkdwn', text: `*Incident*\n${payload.rfId} — ${meta.name}` },
    { type: 'mrkdwn', text: `*Severity*\n${emoji} ${payload.severity}` },
    { type: 'mrkdwn', text: `*Scope*\n\`${payload.scope}\`` },
    { type: 'mrkdwn', text: `*Triggered*\n${ts}` },
  ];

  if (payload.metric) {
    fields.push({ type: 'mrkdwn', text: `*Metric*\n\`${payload.metric}\`` });
  }

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type:  'plain_text',
              text:  `${emoji} GoalRadar Alert — ${payload.severity}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${payload.title}*\n${payload.description}`,
            },
          },
          {
            type:   'section',
            fields,
          },
          {
            type:     'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '📖 Open Runbook', emoji: true },
                url:  `https://github.com/thachnn87/goalradar/blob/main/OPS_RUNBOOKS.md${runbook}`,
                style: payload.severity === 'RED' || payload.severity === 'CRITICAL'
                  ? 'danger' : undefined,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `GoalRadar Reliability | DATA-18OPS.2 | Alert dedup key: \`goalradar:alert:dedup:${payload.rfId}:${payload.scope}\``,
              },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function postToSlack(message: object): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, error: 'SLACK_WEBHOOK_URL not configured' };

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(message),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Slack ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Public API — fireAlert
// ---------------------------------------------------------------------------

export interface FireAlertOptions {
  /** When true: build message and check dedup but do NOT post to Slack or mark KV. */
  dryRun?: boolean;
  nowMs?:  number;
}

/**
 * Fire an alert to Slack.
 *
 * Flow:
 *   1. Check suppression window (KV dedup key)
 *   2. If suppressed: return { suppressed: true, deduplicated: true }
 *   3. Build Slack Block Kit message
 *   4. Post to Slack (unless dryRun)
 *   5. Mark dedup key in KV with TTL = suppression window (unless dryRun or CRITICAL)
 */
export async function fireAlert(
  payload: AlertPayload,
  opts:    FireAlertOptions = {},
): Promise<AlertResult> {
  const nowMs      = opts.nowMs ?? Date.now();
  const dryRun     = opts.dryRun ?? false;
  const suppMs     = SUPPRESSION_MS[payload.severity];
  const key        = buildDedupKey(payload.rfId, payload.scope);

  // ── Dedup check ────────────────────────────────────────────────────────────
  const { suppressed, suppressUntil } = await isAlertSuppressed(key);
  if (suppressed) {
    return {
      sent:         false,
      suppressed:   true,
      deduplicated: true,
      dryRun,
      reason:       `Suppressed until ${new Date(suppressUntil!).toISOString()}`,
      dedupKey:     key,
      suppressUntil,
    };
  }

  // ── Build message ──────────────────────────────────────────────────────────
  const message = buildSlackMessage(payload);

  if (dryRun) {
    return {
      sent:         false,
      suppressed:   false,
      deduplicated: false,
      dryRun:       true,
      reason:       'dry-run — message built but not sent',
      dedupKey:     key,
    };
  }

  // ── Post to Slack ──────────────────────────────────────────────────────────
  const slackResult = await postToSlack(message);
  if (!slackResult.ok) {
    return {
      sent:         false,
      suppressed:   false,
      deduplicated: false,
      dryRun:       false,
      reason:       slackResult.error,
      dedupKey:     key,
    };
  }

  // ── Mark dedup (fire-and-forget) ───────────────────────────────────────────
  await markAlertSent(key, suppMs, nowMs);

  return {
    sent:          true,
    suppressed:    false,
    deduplicated:  false,
    dryRun:        false,
    dedupKey:      key,
    suppressUntil: suppMs > 0 ? nowMs + suppMs : undefined,
  };
}

// ---------------------------------------------------------------------------
// Convenience: fire from raw RF signal
// ---------------------------------------------------------------------------

export function makeAlertPayload(
  rfId:        RiskFactorId,
  severity:    AlertSeverity,
  description: string,
  scope:       string,
  metric?:     string,
  nowMs?:      number,
): AlertPayload {
  const meta = RF_META[rfId];
  return {
    rfId,
    severity,
    title:        meta.name,
    description,
    scope,
    metric,
    runbookAnchor: meta.runbookAnchor,
    triggeredAt:  nowMs ?? Date.now(),
  };
}
