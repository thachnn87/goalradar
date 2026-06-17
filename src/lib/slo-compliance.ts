/**
 * slo-compliance.ts — DATA-18H Phase 3
 *
 * Computes SLO compliance percentages from health archive records over a
 * time window. Each archived snapshot is one observation; compliance is the
 * fraction of observations meeting the target.
 *
 * SLOs (see DATA18G_SLO.md):
 *   Score Accuracy      — target 99.99%  — record compliant if drift.red === 0
 *   Authority Freshness — target < 15min — record compliant if !stale && source=primary
 *   Enrichment Coverage — target > 95%   — record compliant if rate >= 0.95
 *
 * Pure computation — no I/O.
 */

import type { HealthArchiveRecord } from './health-archive';

export interface SLOMetric {
  target:           number;   // target compliance percent
  observations:     number;   // records considered
  compliant:        number;   // records meeting the target
  compliancePct:    number;   // compliant / observations * 100 (100 if no data)
  met:              boolean;  // compliancePct >= target
}

export interface SLOResult {
  observations:    number;
  scoreAccuracy:   SLOMetric;
  freshness:       SLOMetric;
  enrichment:      SLOMetric;
  allMet:          boolean;
}

function pct(compliant: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((compliant / total) * 1_000_000) / 10_000; // 4 dp
}

export function computeSLO(records: HealthArchiveRecord[]): SLOResult {
  const total = records.length;

  // Score Accuracy — no RED drift, and drift subsystem reachable
  const scoreCompliant = records.filter(
    r => r.drift.verdict !== 'ERROR' && r.drift.red === 0,
  ).length;

  // Authority Freshness — cache fresh and served from primary
  const freshCompliant = records.filter(
    r => r.freshness.verdict !== 'ERROR' && !r.freshness.stale && r.freshness.source === 'primary',
  ).length;

  // Enrichment Coverage — rate >= 95%
  const enrichObservations = records.filter(r => r.enrichment.rate !== null).length;
  const enrichCompliant = records.filter(
    r => r.enrichment.rate !== null && r.enrichment.rate >= 0.95,
  ).length;

  const scoreAccuracy: SLOMetric = {
    target:        99.99,
    observations:  total,
    compliant:     scoreCompliant,
    compliancePct: pct(scoreCompliant, total),
    met:           pct(scoreCompliant, total) >= 99.99,
  };

  const freshness: SLOMetric = {
    target:        99,
    observations:  total,
    compliant:     freshCompliant,
    compliancePct: pct(freshCompliant, total),
    met:           pct(freshCompliant, total) >= 99,
  };

  const enrichment: SLOMetric = {
    target:        95,
    observations:  enrichObservations,
    compliant:     enrichCompliant,
    compliancePct: pct(enrichCompliant, enrichObservations),
    met:           pct(enrichCompliant, enrichObservations) >= 95,
  };

  return {
    observations: total,
    scoreAccuracy,
    freshness,
    enrichment,
    allMet: scoreAccuracy.met && freshness.met && enrichment.met,
  };
}
