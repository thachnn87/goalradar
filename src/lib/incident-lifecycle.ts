/**
 * incident-lifecycle.ts — DATA-18P Phase 3
 *
 * Extends the base Incident type (incident.ts) with explicit lifecycle states:
 *   OPEN        — degradation detected, no remediation triggered yet
 *   MITIGATING  — auto-remediation plan dispatched (action != NO_ACTION)
 *   RESOLVED    — returned to GREEN; endedAt is set
 *
 * This module is additive — it does NOT modify incident.ts.
 * It wraps deriveIncidents() output and enriches with lifecycle state and
 * optional remediation metadata.
 *
 * No production writes. Read-only derivation from archive records + repair history.
 */

import type { HealthArchiveRecord } from './health-archive';
import { deriveIncidents, type Incident } from './incident';
import type { RemediationActionType } from './auto-remediation';

// ---------------------------------------------------------------------------
// Lifecycle state
// ---------------------------------------------------------------------------

export type IncidentState = 'OPEN' | 'MITIGATING' | 'RESOLVED';

export interface IncidentLifecycle extends Incident {
  state:          IncidentState;
  /** ISO timestamp when auto-remediation was first triggered for this incident. */
  mitigatedAt:    string | null;
  /** ISO timestamp when the incident returned to GREEN (= endedAt from base). */
  resolvedAt:     string | null;
  /** Total wall-clock ms from openedAt to resolvedAt (null if not yet resolved). */
  durationMs:     number | null;
  /** Last remediation action applied, if any. */
  lastAction:     RemediationActionType | null;
  /** How the incident was resolved. */
  resolutionMode: 'auto-remediated' | 'self-healed' | 'manual' | 'ongoing' | 'unknown';
}

// ---------------------------------------------------------------------------
// Repair reference type (subset of RepairRecord from repair-history.ts)
// ---------------------------------------------------------------------------

export interface RepairRef {
  ts:       number;
  matchId:  number | null;
  action:   RemediationActionType;
  result:   'success' | 'failure' | 'skipped';
}

// ---------------------------------------------------------------------------
// deriveLifecycle
// ---------------------------------------------------------------------------

/**
 * Derive incident lifecycle states from health archive records and repair history.
 *
 * @param records       Sorted oldest→newest health archive records.
 * @param repairs       Repair history records within the same window (sorted asc).
 * @param nowMs         Current epoch ms.
 */
export function deriveLifecycle(
  records: HealthArchiveRecord[],
  repairs: RepairRef[],
  nowMs:   number,
): IncidentLifecycle[] {
  const baseIncidents = deriveIncidents(records, nowMs);

  return baseIncidents.map((inc): IncidentLifecycle => {
    const startMs = new Date(inc.startedAt).getTime();
    const endMs   = inc.endedAt ? new Date(inc.endedAt).getTime() : nowMs;

    // Find repairs that fall within this incident's window
    const incidentRepairs = repairs.filter(r => r.ts >= startMs && r.ts <= endMs);
    const successRepairs  = incidentRepairs.filter(r => r.result === 'success');
    const lastRepair      = incidentRepairs[incidentRepairs.length - 1] ?? null;

    // Determine lifecycle state
    let state: IncidentState;
    if (!inc.open) {
      state = 'RESOLVED';
    } else if (incidentRepairs.length > 0) {
      state = 'MITIGATING';
    } else {
      state = 'OPEN';
    }

    // mitigatedAt = timestamp of first repair in the incident window
    const firstRepair   = incidentRepairs[0] ?? null;
    const mitigatedAt   = firstRepair ? new Date(firstRepair.ts).toISOString() : null;
    const resolvedAt    = inc.endedAt;
    const durationMs    = resolvedAt ? endMs - startMs : null;

    // Resolution mode
    let resolutionMode: IncidentLifecycle['resolutionMode'] = 'ongoing';
    if (state === 'RESOLVED') {
      if (successRepairs.length > 0) {
        resolutionMode = 'auto-remediated';
      } else if (inc.resolution === 'auto-recovered') {
        resolutionMode = 'self-healed';
      } else {
        resolutionMode = 'manual';
      }
    } else {
      resolutionMode = state === 'MITIGATING' ? 'auto-remediated' : 'ongoing';
    }

    return {
      ...inc,
      state,
      mitigatedAt,
      resolvedAt,
      durationMs,
      lastAction:     lastRepair ? lastRepair.action : null,
      resolutionMode,
    };
  });
}

// ---------------------------------------------------------------------------
// Aggregate lifecycle stats
// ---------------------------------------------------------------------------

export interface LifecycleStats {
  total:       number;
  open:        number;
  mitigating:  number;
  resolved:    number;
  avgDurationMs:    number | null;
  autoRemediatedPct: number;
}

export function computeLifecycleStats(incidents: IncidentLifecycle[]): LifecycleStats {
  const total      = incidents.length;
  const open       = incidents.filter(i => i.state === 'OPEN').length;
  const mitigating = incidents.filter(i => i.state === 'MITIGATING').length;
  const resolved   = incidents.filter(i => i.state === 'RESOLVED').length;

  const resolvedDurations = incidents
    .filter(i => i.state === 'RESOLVED' && i.durationMs !== null)
    .map(i => i.durationMs as number);

  const avgDurationMs = resolvedDurations.length > 0
    ? Math.round(resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length)
    : null;

  const autoRemediated = incidents.filter(i => i.resolutionMode === 'auto-remediated').length;
  const autoRemediatedPct = total > 0
    ? Math.round((autoRemediated / total) * 100)
    : 0;

  return { total, open, mitigating, resolved, avgDurationMs, autoRemediatedPct };
}
