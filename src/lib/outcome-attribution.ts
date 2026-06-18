/**
 * outcome-attribution.ts — DATA-18R Phase 1
 *
 * Outcome Attribution Engine.
 *
 * For every resolved incident, determine HOW it was resolved using production
 * telemetry from the repair-history archive and health-archive records.
 *
 * Resolution modes:
 *   resolvedByRepair    — a repair record with result=success fell inside the incident window
 *   resolvedBySelfHeal  — no repair record, but the incident closed without operator action
 *                         (DATA-18K self-heal mechanism — repair-lock present at recovery time)
 *   resolvedByOperator  — no automated repair; incident closed after an anomalous delay
 *                         (operator likely intervened out-of-band)
 *   resolvedByTimeout   — incident closed after a very long window (>6h) with no recorded action
 *
 * Pure computation — no I/O. Additive — does not modify any existing file.
 */

import type { HealthArchiveRecord }  from './health-archive';
import type { RepairRecordV2 }       from './action-effectiveness';
import type { RemediationActionType } from './auto-remediation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutcomeMode =
  | 'resolvedByRepair'
  | 'resolvedBySelfHeal'
  | 'resolvedByOperator'
  | 'resolvedByTimeout'
  | 'unresolved';

export interface AttributedIncident {
  /** Opaque id derived from incident start time. */
  id:                string;
  startedAt:         string;
  resolvedAt:        string | null;
  durationMs:        number | null;
  /** Peak severity observed during the incident. */
  peakSeverity:      'YELLOW' | 'RED';
  /** Which subsystem(s) degraded. */
  affectedSubsystems: string[];
  /** Attribution result. */
  outcome:           OutcomeMode;
  /** The repair action credited with resolution, if resolvedByRepair. */
  creditedAction:    RemediationActionType | null;
  /** Risk score at incident start (from first non-GREEN archive record). */
  riskAtStart:       number | null;
  /** Risk score at resolution (from repair record riskAfter). */
  riskAtResolution:  number | null;
  /** Time between first repair attempt and incident close (ms). null if no repair. */
  repairToCloseMs:   number | null;
  /** Whether the credited repair had verificationPassed=true. */
  verificationPassed: boolean | null;
  confidence:        number;  // confidence in this attribution (0–1)
}

export interface AttributionReport {
  computedAt:        string;
  totalIncidents:    number;
  resolved:          number;
  unresolved:        number;
  byOutcome:         Record<OutcomeMode, number>;
  avgDurationMs:     number | null;
  avgRepairToCloseMs: number | null;
  incidents:         AttributedIncident[];
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const SELF_HEAL_MAX_MS   = 30 * 60_000;   // < 30 min without a repair = likely self-heal
const OPERATOR_MIN_MS    = 2  * 3_600_000; // > 2 h without a repair = likely operator
const TIMEOUT_MIN_MS     = 6  * 3_600_000; // > 6 h without any action = timeout

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectSubsystems(records: HealthArchiveRecord[]): string[] {
  const out = new Set<string>();
  for (const r of records) {
    if (r.drift.verdict      === 'RED' || r.drift.verdict      === 'ERROR') out.add('authority-drift');
    if (r.freshness.verdict  === 'RED')                                       out.add('authority-freshness');
    if (r.feed.verdict       === 'RED' || r.feed.verdict       === 'ERROR') out.add('feed-integrity');
    if (r.enrichment.verdict === 'RED' || r.enrichment.verdict === 'ERROR') out.add('enrichment-health');
  }
  return [...out];
}

function peakSeverity(records: HealthArchiveRecord[]): 'YELLOW' | 'RED' {
  return records.some(r => r.overall === 'RED') ? 'RED' : 'YELLOW';
}

// ---------------------------------------------------------------------------
// deriveAttribution
// ---------------------------------------------------------------------------

/**
 * Derive outcome attribution for all incidents in the supplied archive window.
 *
 * @param records   Health archive records, oldest → newest.
 * @param repairs   Repair records (RepairRecordV2) in the same window.
 * @param nowMs     Current epoch ms.
 */
export function deriveAttribution(
  records: HealthArchiveRecord[],
  repairs: RepairRecordV2[],
  nowMs:   number,
): AttributionReport {
  const computedAt = new Date(nowMs).toISOString();

  // ── Identify incident windows from archive ──────────────────────────────
  // An incident starts when overall flips non-GREEN and ends when it returns GREEN.
  interface Window {
    startMs:  number;
    endMs:    number | null;
    recs:     HealthArchiveRecord[];
  }

  const windows: Window[] = [];
  let current: Window | null = null;

  for (const rec of records) {
    if (rec.overall !== 'GREEN') {
      if (!current) current = { startMs: rec.ts, endMs: null, recs: [rec] };
      else          current.recs.push(rec);
    } else {
      if (current) {
        current.endMs = rec.ts;
        windows.push(current);
        current = null;
      }
    }
  }
  // Still-open incident
  if (current) {
    current.endMs = null;
    windows.push(current);
  }

  // ── Attribute each window ───────────────────────────────────────────────
  const attributed: AttributedIncident[] = windows.map((w, idx): AttributedIncident => {
    const startMs = w.startMs;
    const endMs   = w.endMs ?? nowMs;
    const id      = `inc-${startMs}`;
    const open    = w.endMs === null;
    const durationMs = open ? null : endMs - startMs;

    // Repairs inside this window
    const windowRepairs = repairs.filter(r => r.ts >= startMs && r.ts <= endMs);
    const successRepairs = windowRepairs.filter(r => r.result === 'success');
    const firstSuccess   = successRepairs[0] ?? null;

    // Subsystems and severity
    const subsystems = detectSubsystems(w.recs);
    const severity   = peakSeverity(w.recs);

    // Risk at start from first record with riskBefore
    const firstRepair = windowRepairs[0] ?? null;
    const riskAtStart       = firstRepair?.riskBefore ?? null;
    const riskAtResolution  = firstSuccess?.riskAfter  ?? null;
    const verificationPassed = firstSuccess?.verificationPassed ?? null;

    // repairToCloseMs — from first repair attempt to incident close
    const repairToCloseMs = (firstRepair && w.endMs !== null)
      ? w.endMs - firstRepair.ts
      : null;

    // Attribution logic
    let outcome: OutcomeMode;
    let creditedAction: RemediationActionType | null = null;
    let confidence = 0.5;

    if (open) {
      outcome = 'unresolved';
      confidence = 0.9;  // high confidence it's open
    } else if (successRepairs.length > 0) {
      outcome = 'resolvedByRepair';
      creditedAction = firstSuccess!.action;
      // Confidence boosted by verification
      confidence = verificationPassed === true ? 0.95
        : verificationPassed === false         ? 0.65
        : 0.80;  // no verification data → moderate
    } else if (durationMs !== null && durationMs <= SELF_HEAL_MAX_MS && windowRepairs.length === 0) {
      outcome = 'resolvedBySelfHeal';
      confidence = 0.85;
    } else if (durationMs !== null && durationMs >= TIMEOUT_MIN_MS && windowRepairs.length === 0) {
      outcome = 'resolvedByTimeout';
      confidence = 0.70;
    } else if (durationMs !== null && durationMs >= OPERATOR_MIN_MS) {
      outcome = 'resolvedByOperator';
      confidence = 0.75;
    } else {
      // Short window, no repairs — call it self-heal
      outcome = 'resolvedBySelfHeal';
      confidence = 0.60;
    }

    void idx;  // suppress unused warning
    return {
      id,
      startedAt:          new Date(startMs).toISOString(),
      resolvedAt:         w.endMs ? new Date(w.endMs).toISOString() : null,
      durationMs,
      peakSeverity:       severity,
      affectedSubsystems: subsystems,
      outcome,
      creditedAction,
      riskAtStart,
      riskAtResolution,
      repairToCloseMs,
      verificationPassed,
      confidence,
    };
  });

  // ── Aggregate stats ─────────────────────────────────────────────────────
  const byOutcome: Record<OutcomeMode, number> = {
    resolvedByRepair:    0,
    resolvedBySelfHeal:  0,
    resolvedByOperator:  0,
    resolvedByTimeout:   0,
    unresolved:          0,
  };
  for (const inc of attributed) byOutcome[inc.outcome]++;

  const resolved   = attributed.filter(i => i.outcome !== 'unresolved').length;
  const unresolved = attributed.filter(i => i.outcome === 'unresolved').length;

  const durList = attributed.filter(i => i.durationMs !== null).map(i => i.durationMs!);
  const avgDurationMs = durList.length > 0
    ? Math.round(durList.reduce((a, b) => a + b, 0) / durList.length)
    : null;

  const rtcList = attributed.filter(i => i.repairToCloseMs !== null).map(i => i.repairToCloseMs!);
  const avgRepairToCloseMs = rtcList.length > 0
    ? Math.round(rtcList.reduce((a, b) => a + b, 0) / rtcList.length)
    : null;

  return {
    computedAt,
    totalIncidents: attributed.length,
    resolved,
    unresolved,
    byOutcome,
    avgDurationMs,
    avgRepairToCloseMs,
    incidents: attributed,
  };
}
