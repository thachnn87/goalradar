/**
 * incident.ts — DATA-18H Phase 2 / Phase 5
 *
 * Derives incidents from the health archive. An incident is a contiguous run
 * of archive records at the same degraded severity (RED or YELLOW). The run
 * starts at the first degraded record and ends at the first subsequent GREEN
 * record (or remains open if still degraded).
 *
 * Derivation only — no remediation, no writes.
 */

import type { HealthArchiveRecord, Verdict } from './health-archive';

export interface Incident {
  id:              string;          // `inc-<startTs>-<severity>`
  severity:        'RED' | 'YELLOW';
  startedAt:       string;          // ISO
  endedAt:         string | null;   // ISO, null if still open
  durationMin:     number;          // minutes (open incident measured to `now`)
  open:            boolean;
  recordCount:     number;          // archive records spanned
  affectedMatches: number;          // peak drift.red + feed.redCount across the run
  rootCause:       string;          // best-effort classification
  resolution:      string;          // 'auto-recovered' | 'ongoing' | descriptive
}

function severityOf(rec: HealthArchiveRecord): Verdict {
  return rec.overall;
}

/** Best-effort root-cause label from the worst record in an incident run. */
function classifyRootCause(run: HealthArchiveRecord[]): string {
  const causes: string[] = [];
  const anyDriftRed   = run.some(r => r.drift.red > 0);
  const anyFeedRed    = run.some(r => r.feed.redCount > 0);
  const anyStale      = run.some(r => r.freshness.stale || r.freshness.source !== 'primary');
  const anyEnrichLow  = run.some(r => r.enrichment.rate !== null && r.enrichment.rate < 0.95);
  const anyError      = run.some(r =>
    r.drift.verdict === 'ERROR' || r.feed.verdict === 'ERROR' ||
    r.freshness.verdict === 'ERROR' || r.enrichment.verdict === 'ERROR');

  if (anyDriftRed)  causes.push('score/state drift (authority vs snapshot)');
  if (anyFeedRed)   causes.push('feed integrity failure (duplicate/invalid transition)');
  if (anyStale)     causes.push('authority cache stale or DR-served');
  if (anyEnrichLow) causes.push('enrichment coverage below 95%');
  if (anyError)     causes.push('subsystem endpoint unreachable');

  return causes.length ? causes.join('; ') : 'unclassified degradation';
}

/**
 * Derive incidents from a time-ordered list of records.
 *
 * @param records  archive records, oldest → newest
 * @param nowMs    current epoch ms (to measure still-open incidents)
 */
export function deriveIncidents(records: HealthArchiveRecord[], nowMs: number): Incident[] {
  const incidents: Incident[] = [];
  let run: HealthArchiveRecord[] = [];
  let runSeverity: 'RED' | 'YELLOW' | null = null;

  const flush = (nextStartTs: number | null) => {
    if (!runSeverity || run.length === 0) return;
    const first = run[0];
    const last  = run[run.length - 1];
    const open  = nextStartTs === null;

    // End time: if a GREEN/other-severity record follows, the incident ended at
    // that record's timestamp; otherwise it is still open.
    const endMs       = open ? nowMs : nextStartTs!;
    const durationMin  = Math.max(0, Math.round((endMs - first.ts) / 60000));
    const affected     = Math.max(...run.map(r => r.drift.red + r.feed.redCount));

    incidents.push({
      id:              `inc-${first.ts}-${runSeverity}`,
      severity:        runSeverity,
      startedAt:       first.capturedAt,
      endedAt:         open ? null : new Date(nextStartTs!).toISOString(),
      durationMin,
      open,
      recordCount:     run.length,
      affectedMatches: affected,
      rootCause:       classifyRootCause(run),
      resolution:      open ? 'ongoing' : 'auto-recovered',
    });

    void last;
    run = [];
    runSeverity = null;
  };

  for (const rec of records) {
    const sev = severityOf(rec);
    if (sev === 'RED' || sev === 'YELLOW') {
      if (runSeverity === null) {
        runSeverity = sev;
        run = [rec];
      } else if (runSeverity === sev) {
        run.push(rec);
      } else {
        // severity changed (e.g. YELLOW → RED) — close prior run, open a new one
        flush(rec.ts);
        runSeverity = sev;
        run = [rec];
      }
    } else {
      // GREEN — close any open run at this record's timestamp
      flush(rec.ts);
    }
  }
  // Trailing open run
  flush(null);

  return incidents;
}
