/**
 * GET /api/debug/test-alert
 *
 * DATA-18OPS.2 — Alert test endpoint.
 *
 * Fires a test alert for any RF (RF-1→8) at any severity.
 * Supports dry-run mode (default: true) so production Slack channels
 * are not polluted by test invocations.
 *
 * Query parameters:
 *   rf          RF-1 … RF-8   (default: RF-2)
 *   severity    INFO | WARNING | YELLOW | RED | CRITICAL   (default: RED)
 *   scope       any string   (default: "test-match-001")
 *   metric      any string   (default: built from rf)
 *   dryRun      true | false  (default: true)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Example — dry run (no Slack message sent):
 *   GET /api/debug/test-alert?rf=RF-2&severity=RED
 *
 * Example — real send:
 *   GET /api/debug/test-alert?rf=RF-6&severity=RED&dryRun=false
 */

import { NextRequest, NextResponse }   from 'next/server';
import {
  fireAlert,
  makeAlertPayload,
  buildSlackMessage,
  RF_META,
  SUPPRESSION_MS,
  type RiskFactorId,
  type AlertSeverity,
} from '@/lib/alerting';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

const VALID_RFS: RiskFactorId[]   = ['RF-1','RF-2','RF-3','RF-4','RF-5','RF-6','RF-7','RF-8'];
const VALID_SEV: AlertSeverity[]  = ['INFO','WARNING','YELLOW','RED','CRITICAL'];

// Default test descriptions per RF
const TEST_DESCRIPTIONS: Record<RiskFactorId, string> = {
  'RF-1': 'TEST: Match page returning 404 — simulated identity resolution failure.',
  'RF-2': 'TEST: Live match score has not updated for 8 minutes — simulated ESPN staleness.',
  'RF-3': 'TEST: Authority Cache hit rate dropped to 42% — simulated TTL expiry storm.',
  'RF-4': 'TEST: Match showing SCHEDULED state past kickoff — simulated state mismatch.',
  'RF-5': 'TEST: ESPN enrichment coverage at 48% — simulated API degradation.',
  'RF-6': 'TEST: KV REST API unreachable — simulated Upstash region outage.',
  'RF-7': 'TEST: 6 repair attempts for same match in 30m — simulated repair loop.',
  'RF-8': 'TEST: WC prewarm failed for 3 fixtures — simulated cron failure.',
};

const DEFAULT_METRICS: Record<RiskFactorId, string> = {
  'RF-1': 'affectedCount: 1',
  'RF-2': 'stalenessSeconds: 480',
  'RF-3': 'hitRate: 42%, totalKeys: 23',
  'RF-4': 'expected: IN_PLAY, actual: SCHEDULED',
  'RF-5': 'coverageRate: 48%, affected: 7',
  'RF-6': 'reachable: false',
  'RF-7': 'repairs: 6/30m, failStreak: 4',
  'RF-8': 'failed: 3/8, nextKO: 22m',
};

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params   = new URL(req.url).searchParams;
  const rfRaw    = params.get('rf')       ?? 'RF-2';
  const sevRaw   = params.get('severity') ?? 'RED';
  const scope    = params.get('scope')    ?? 'test-match-001';
  const metricIn = params.get('metric');
  const dryRun   = params.get('dryRun') !== 'false';   // default true

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!VALID_RFS.includes(rfRaw as RiskFactorId)) {
    return NextResponse.json(
      { error: `Invalid rf: ${rfRaw}. Must be one of ${VALID_RFS.join(', ')}` },
      { status: 400 },
    );
  }
  if (!VALID_SEV.includes(sevRaw as AlertSeverity)) {
    return NextResponse.json(
      { error: `Invalid severity: ${sevRaw}. Must be one of ${VALID_SEV.join(', ')}` },
      { status: 400 },
    );
  }

  const rfId     = rfRaw  as RiskFactorId;
  const severity = sevRaw as AlertSeverity;
  const meta     = RF_META[rfId];
  const metric   = metricIn ?? DEFAULT_METRICS[rfId];

  const payload = makeAlertPayload(
    rfId,
    severity,
    TEST_DESCRIPTIONS[rfId],
    scope,
    metric,
  );

  // Always build the Slack message so it appears in the response regardless of dryRun
  const slackMessage = buildSlackMessage(payload);

  const result = await fireAlert(payload, { dryRun });

  return NextResponse.json(
    {
      schemaVersion:    'DATA-18OPS.2',
      test:             true,
      dryRun,
      rf:               rfId,
      rfName:           meta.name,
      severity,
      scope,
      metric,
      suppressionWindowMs:    SUPPRESSION_MS[severity],
      suppressionWindowLabel: formatMs(SUPPRESSION_MS[severity]),
      result,
      slackMessage,
      note: dryRun
        ? 'dry-run: Slack message built but NOT sent. Pass dryRun=false to send for real.'
        : result.sent
          ? 'Alert sent to Slack.'
          : result.suppressed
            ? `Alert suppressed (dedup). Fires again after ${new Date(result.suppressUntil!).toISOString()}.`
            : `Alert not sent: ${result.reason}`,
      env: {
        slackConfigured: !!process.env.SLACK_WEBHOOK_URL,
        kvConfigured:    !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}

function formatMs(ms: number): string {
  if (ms === 0) return 'none (CRITICAL)';
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${min / 60}h` : `${min}m`;
}
