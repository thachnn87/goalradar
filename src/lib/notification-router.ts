/**
 * notification-router.ts — DATA-18OPS.2
 *
 * Routes reliability signals (RF-1→8) to Slack alerts.
 *
 * Each RF has a typed trigger function that:
 *   1. Evaluates the signal against severity thresholds
 *   2. Builds an AlertPayload with context
 *   3. Delegates to fireAlert() for dedup + delivery
 *
 * RF-2 (live score frozen) and RF-6 (KV unavailable) are the primary
 * targets for automatic push alerting — they fire from the health-check cron.
 *
 * No KV mutations beyond what alerting.ts writes. Additive only.
 */

import {
  fireAlert,
  makeAlertPayload,
  SUPPRESSION_MS,
  type AlertPayload,
  type AlertResult,
  type AlertSeverity,
  type FireAlertOptions,
} from './alerting';

// ---------------------------------------------------------------------------
// Shared options type
// ---------------------------------------------------------------------------

export interface RouteOptions extends FireAlertOptions {
  nowMs?: number;
}

// ---------------------------------------------------------------------------
// RF-1 — Match Not Found / Stale Identity
// ---------------------------------------------------------------------------

export interface RF1Signal {
  /** Number of matches with 404 or stale identity. */
  affectedMatchCount: number;
  affectedMatchIds:   string[];
  isLiveWorldCup?:    boolean;
}

export async function routeRF1(
  signal: RF1Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { affectedMatchCount, affectedMatchIds, isLiveWorldCup } = signal;

  let severity: AlertSeverity;
  if (isLiveWorldCup) {
    severity = 'CRITICAL';
  } else if (affectedMatchCount >= 3) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const scope = affectedMatchIds.length === 1
    ? affectedMatchIds[0]
    : `${affectedMatchCount}-matches`;

  const description = isLiveWorldCup
    ? `World Cup fixture 404 during live play. Immediate recovery required.`
    : `${affectedMatchCount} match page(s) returning 404 or showing wrong fixture data. ` +
      `Affected: ${affectedMatchIds.slice(0, 3).join(', ')}${affectedMatchIds.length > 3 ? '…' : ''}.`;

  const payload = makeAlertPayload(
    'RF-1', severity, description, scope,
    `affectedCount: ${affectedMatchCount}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-2 — Live Score Not Updating  [PRIMARY — auto-fired by health cron]
// ---------------------------------------------------------------------------

export interface RF2Signal {
  matchId:         string;
  /** How long the score has been frozen, in seconds. */
  stalenessSeconds: number;
  isWorldCup?:     boolean;
  matchLabel?:     string;  // e.g. "Brazil vs Argentina"
}

export async function routeRF2(
  signal: RF2Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { matchId, stalenessSeconds, isWorldCup, matchLabel } = signal;

  let severity: AlertSeverity;
  if (isWorldCup && stalenessSeconds > 600) {
    severity = 'CRITICAL';
  } else if (stalenessSeconds > 600) {
    severity = 'RED';
  } else if (isWorldCup || stalenessSeconds > 300) {
    severity = 'RED';
  } else {
    severity = 'YELLOW';
  }

  const label  = matchLabel ?? matchId;
  const minStr = `${Math.round(stalenessSeconds / 60)}m ${stalenessSeconds % 60}s`;

  const description = isWorldCup
    ? `*World Cup match score frozen for ${minStr}.* Match: ${label}. ` +
      `Immediate ESPN cache refresh or escalation required.`
    : `Live match score has not updated for ${minStr}. Match: ${label}. ` +
      `Check ESPN feed health.`;

  const payload = makeAlertPayload(
    'RF-2', severity, description, matchId,
    `stalenessSeconds: ${stalenessSeconds}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-3 — Authority Cache Miss Spike
// ---------------------------------------------------------------------------

export interface RF3Signal {
  hitRate:    number;   // 0.0–1.0
  totalKeys:  number;
}

export async function routeRF3(
  signal: RF3Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { hitRate, totalKeys } = signal;

  let severity: AlertSeverity;
  if (hitRate === 0 || totalKeys === 0) {
    severity = 'CRITICAL';  // likely KV down — escalates to RF-6
  } else if (hitRate < 0.40) {
    severity = 'RED';
  } else if (hitRate < 0.60) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const pct = Math.round(hitRate * 100);

  const description = hitRate === 0
    ? `Authority Cache hit rate is 0% — KV may be unavailable. Check RF-6.`
    : `Cache hit rate has dropped to ${pct}% (${totalKeys} keys). ` +
      `All match pages are experiencing cold-fetch latency.`;

  const payload = makeAlertPayload(
    'RF-3', severity, description, 'system',
    `hitRate: ${pct}%, totalKeys: ${totalKeys}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-4 — Match State Classification Error
// ---------------------------------------------------------------------------

export interface RF4Signal {
  matchId:       string;
  expectedState: string;
  actualState:   string;
  isLive:        boolean;
  isWorldCup?:   boolean;
  isKnockout?:   boolean;
}

export async function routeRF4(
  signal: RF4Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { matchId, expectedState, actualState, isLive, isWorldCup, isKnockout } = signal;

  let severity: AlertSeverity;
  if (isKnockout) {
    severity = 'CRITICAL';
  } else if (isWorldCup && isLive) {
    severity = 'RED';
  } else if (isLive) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const description = `Match ${matchId} showing state \`${actualState}\` ` +
    `but should be \`${expectedState}\`. ` +
    (isKnockout ? 'KNOCKOUT ROUND — immediate fix required.' :
     isWorldCup ? 'World Cup fixture affected.' :
     'State-dependent UI is rendering incorrectly.');

  const payload = makeAlertPayload(
    'RF-4', severity, description, matchId,
    `expected: ${expectedState}, actual: ${actualState}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-5 — ESPN Data Quality Degradation
// ---------------------------------------------------------------------------

export interface RF5Signal {
  /** Fraction 0–1 of matches with complete enrichment. */
  coverageRate:  number;
  affectedCount: number;
  isWorldCupWindow?: boolean;
}

export async function routeRF5(
  signal: RF5Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { coverageRate, affectedCount, isWorldCupWindow } = signal;

  let severity: AlertSeverity;
  if (isWorldCupWindow && coverageRate < 0.30) {
    severity = 'CRITICAL';
  } else if (coverageRate < 0.30) {
    severity = 'RED';
  } else if (coverageRate < 0.50) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const pct = Math.round(coverageRate * 100);

  const description = isWorldCupWindow && coverageRate < 0.30
    ? `ESPN enrichment at ${pct}% during World Cup window. ` +
      `${affectedCount} match(es) missing stats, odds, and lineups.`
    : `ESPN enrichment coverage has dropped to ${pct}%. ` +
      `${affectedCount} match(es) affected. Stats and odds may be absent.`;

  const payload = makeAlertPayload(
    'RF-5', severity, description, 'system',
    `coverageRate: ${pct}%, affected: ${affectedCount}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-6 — KV Unavailable / Degraded  [PRIMARY — auto-fired by health cron]
// ---------------------------------------------------------------------------

export interface RF6Signal {
  /** If false: KV is fully unreachable. If true: KV is slow/intermittent. */
  reachable:     boolean;
  latencyMs?:    number;
  errorMessage?: string;
  isMatchDay?:   boolean;
}

export async function routeRF6(
  signal: RF6Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { reachable, latencyMs, errorMessage, isMatchDay } = signal;

  let severity: AlertSeverity;
  if (!reachable && isMatchDay) {
    severity = 'CRITICAL';
  } else if (!reachable) {
    severity = 'RED';
  } else if (latencyMs !== undefined && latencyMs > 1000) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const description = !reachable
    ? `KV is fully unreachable. ${isMatchDay ? '⚠️ MATCH DAY IMPACT. ' : ''}` +
      `All match pages falling back to cold-fetch. ` +
      (errorMessage ? `Error: ${errorMessage}` : 'Check Upstash status page.')
    : `KV responding slowly (${latencyMs}ms). ` +
      `Cache reads degraded. Authority cache miss rate rising.`;

  const payload = makeAlertPayload(
    'RF-6', severity, description, 'system',
    reachable ? `latencyMs: ${latencyMs}` : 'reachable: false',
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-7 — Elevated Repair Frequency
// ---------------------------------------------------------------------------

export interface RF7Signal {
  matchId:          string;
  repairCount:      number;
  windowMinutes:    number;
  lastAction:       string;
  consecutiveFails: number;
}

export async function routeRF7(
  signal: RF7Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { matchId, repairCount, windowMinutes, lastAction, consecutiveFails } = signal;

  let severity: AlertSeverity;
  if (consecutiveFails >= 5) {
    severity = 'RED';
  } else if (repairCount > 5) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const description = `Repair loop detected on match \`${matchId}\`. ` +
    `${repairCount} repair attempts in ${windowMinutes}m window via \`${lastAction}\`. ` +
    `${consecutiveFails} consecutive verification failures. ` +
    `Root cause unresolved — manual diagnosis required.`;

  const payload = makeAlertPayload(
    'RF-7', severity, description, matchId,
    `repairs: ${repairCount}/${windowMinutes}m, failStreak: ${consecutiveFails}`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// RF-8 — World Cup Prewarm Failure
// ---------------------------------------------------------------------------

export interface RF8Signal {
  failedMatchIds:       string[];
  minutesToNextKickoff: number;
  totalScheduled:       number;
}

export async function routeRF8(
  signal: RF8Signal,
  opts:   RouteOptions = {},
): Promise<AlertResult> {
  const { failedMatchIds, minutesToNextKickoff, totalScheduled } = signal;
  const failCount = failedMatchIds.length;

  let severity: AlertSeverity;
  if (minutesToNextKickoff < 15) {
    severity = 'CRITICAL';
  } else if (minutesToNextKickoff < 30) {
    severity = 'RED';
  } else if (failCount / totalScheduled >= 0.30) {
    severity = 'YELLOW';
  } else {
    severity = 'WARNING';
  }

  const description = minutesToNextKickoff < 15
    ? `⚡ URGENT: ${failCount} WC fixture(s) unprewarm'd with ${minutesToNextKickoff}m to kickoff. ` +
      `Manual prewarm required NOW: ${failedMatchIds.join(', ')}`
    : `WC prewarm failed for ${failCount} of ${totalScheduled} scheduled fixtures. ` +
      `Next kickoff in ${minutesToNextKickoff}m. ` +
      `Affected: ${failedMatchIds.slice(0, 4).join(', ')}${failedMatchIds.length > 4 ? '…' : ''}`;

  const scope = failedMatchIds.length === 1
    ? failedMatchIds[0]
    : `${failCount}-fixtures`;

  const payload = makeAlertPayload(
    'RF-8', severity, description, scope,
    `failed: ${failCount}/${totalScheduled}, nextKO: ${minutesToNextKickoff}m`,
    opts.nowMs,
  );

  return fireAlert(payload, opts);
}

// ---------------------------------------------------------------------------
// Bulk health check — evaluate all signals in one pass
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  cacheHitRate?:       number;
  cacheTotalKeys?:     number;
  kvReachable?:        boolean;
  kvLatencyMs?:        number;
  kvError?:            string;
  isMatchDay?:         boolean;
  liveMatches?:        Array<{ matchId: string; stalenessSeconds: number; isWorldCup?: boolean; label?: string }>;
  espnCoverageRate?:   number;
  espnAffectedCount?:  number;
  isWorldCupWindow?:   boolean;
  repairLoops?:        Array<{ matchId: string; repairCount: number; windowMinutes: number; lastAction: string; consecutiveFails: number }>;
}

export interface HealthCheckAlertSummary {
  fired:     number;
  suppressed: number;
  errors:    number;
  results:   Array<{ rf: string; result: AlertResult }>;
}

/**
 * Evaluate a HealthSnapshot and fire alerts for any threshold breaches.
 * Safe to call on a schedule — dedup prevents alert storms.
 */
export async function evaluateHealth(
  snapshot: HealthSnapshot,
  opts:     RouteOptions = {},
): Promise<HealthCheckAlertSummary> {
  const tasks: Array<Promise<{ rf: string; result: AlertResult }>> = [];

  // RF-6 — KV (check first; RF-3 may be a symptom of RF-6)
  if (snapshot.kvReachable === false) {
    tasks.push(
      routeRF6({
        reachable:    false,
        errorMessage: snapshot.kvError,
        isMatchDay:   snapshot.isMatchDay,
      }, opts).then(r => ({ rf: 'RF-6', result: r })),
    );
  } else if (snapshot.kvLatencyMs !== undefined && snapshot.kvLatencyMs > 500) {
    tasks.push(
      routeRF6({
        reachable:  true,
        latencyMs:  snapshot.kvLatencyMs,
        isMatchDay: snapshot.isMatchDay,
      }, opts).then(r => ({ rf: 'RF-6', result: r })),
    );
  }

  // RF-3 — Cache miss (only when KV is up — otherwise it's RF-6)
  if (
    snapshot.kvReachable !== false &&
    snapshot.cacheHitRate !== undefined &&
    snapshot.cacheHitRate < 0.60
  ) {
    tasks.push(
      routeRF3({
        hitRate:   snapshot.cacheHitRate,
        totalKeys: snapshot.cacheTotalKeys ?? 0,
      }, opts).then(r => ({ rf: 'RF-3', result: r })),
    );
  }

  // RF-2 — Live score staleness (one alert per frozen match)
  for (const live of snapshot.liveMatches ?? []) {
    if (live.stalenessSeconds >= 300) {   // 5 min threshold
      tasks.push(
        routeRF2({
          matchId:          live.matchId,
          stalenessSeconds: live.stalenessSeconds,
          isWorldCup:       live.isWorldCup,
          matchLabel:       live.label,
        }, opts).then(r => ({ rf: 'RF-2', result: r })),
      );
    }
  }

  // RF-5 — ESPN enrichment
  if (
    snapshot.espnCoverageRate !== undefined &&
    snapshot.espnCoverageRate < 0.70
  ) {
    tasks.push(
      routeRF5({
        coverageRate:      snapshot.espnCoverageRate,
        affectedCount:     snapshot.espnAffectedCount ?? 0,
        isWorldCupWindow:  snapshot.isWorldCupWindow,
      }, opts).then(r => ({ rf: 'RF-5', result: r })),
    );
  }

  // RF-7 — Repair loops
  for (const loop of snapshot.repairLoops ?? []) {
    if (loop.repairCount >= 3) {
      tasks.push(
        routeRF7(loop, opts).then(r => ({ rf: 'RF-7', result: r })),
      );
    }
  }

  const settled = await Promise.allSettled(tasks);

  let fired = 0, suppressed = 0, errors = 0;
  const results: Array<{ rf: string; result: AlertResult }> = [];

  for (const item of settled) {
    if (item.status === 'rejected') {
      errors++;
    } else {
      const { rf, result } = item.value;
      results.push({ rf, result });
      if (result.sent)        fired++;
      else if (result.suppressed) suppressed++;
      else if (!result.dryRun)    errors++;
    }
  }

  return { fired, suppressed, errors, results };
}

// ---------------------------------------------------------------------------
// Re-export for consumers that only import notification-router
// ---------------------------------------------------------------------------

export { SUPPRESSION_MS, RF_META } from './alerting';
export type { AlertPayload, AlertResult, AlertSeverity, RiskFactorId } from './alerting';
