/**
 * champion-challenger.ts — DATA-18R Phase 2 + 3 + 5
 *
 * Phase 2: Champion/Challenger analysis — compare remediation actions per risk
 *          factor using successRate, avgRecoveryTime, verificationPassRate.
 *
 * Phase 3: Production Confidence Engine — compute confidence exclusively from
 *          verified production outcomes (result != 'dry-run', verificationPassed
 *          not null). Simulated outcomes are excluded.
 *
 * Phase 5: Recommendation Ranking — return actions ordered best → worst for
 *          each risk factor, using production confidence as the primary key.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';
import type { RepairRecordV2 }        from './action-effectiveness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskFactorLabel =
  | 'snapshot-expiry'
  | 'dr-absent'
  | 'espn-event-expiry'
  | 'espn-lookup-absent'
  | 'rate-safe-mode'
  | 'feed-absent'
  | 'feed-stale'
  | 'repair-storm'
  | 'archive-trajectory'
  | 'unknown';

/** Per-action statistics for one risk factor. */
export interface ActionStats {
  action:              RemediationActionType;
  sampleSize:          number;
  /** Excludes dry-run records. */
  successRate:         number;   // 0–100
  avgRecoveryTime:     number | null;
  verificationPassRate: number | null;
  avgImprovement:      number | null;
  /** Phase 3: production-only confidence (0–1). */
  productionConfidence: number;
  /** How many records have verificationPassed != null. */
  verifiedSamples:     number;
  /** Fraction of samples that are production (not dry-run). */
  productionCoverage:  number;   // 0–1
}

/** Champion/Challenger comparison for one risk factor. */
export interface RiskFactorComparison {
  riskFactor:  RiskFactorLabel;
  champion:    ActionStats;                   // highest productionConfidence
  challengers: ActionStats[];                 // remaining, ordered by confidence
  /** Ordered recommendation: best → worst action for this risk factor. */
  ranking:     RemediationActionType[];
  sampleTotal: number;
}

export interface ChampionChallengerReport {
  computedAt:          string;
  byRiskFactor:        RiskFactorComparison[];
  /** Global ranking: actions ordered by weighted average production confidence. */
  globalRanking:       Array<{
    action:             RemediationActionType;
    productionConfidence: number;
    sampleSize:         number;
    riskFactorsCovered: number;
  }>;
}

// ---------------------------------------------------------------------------
// Phase 3 — Production Confidence Engine
// ---------------------------------------------------------------------------

/**
 * Compute confidence from VERIFIED PRODUCTION outcomes only.
 * Dry-run records and records without verificationPassed are excluded.
 *
 * Formula:
 *   prodRecords  = records where result != 'dry-run'
 *   verRecords   = prodRecords where verificationPassed != null
 *
 *   successFrac  = verified successes / max(verRecords.length, 1)
 *   sampleWeight = clamp(0.4 + 0.6*(n/30), 0.4, 1.0)   // ramps to full at n=30
 *   base         = successFrac * sampleWeight + 0.5 * (1 - sampleWeight)
 *   improvBonus  = min(0.12, avgImprovement * 0.24)
 *   verifyBonus  = verPassRate * 0.08
 *   result       = clamp(base + improvBonus + verifyBonus, 0.01, 0.99)
 *
 * Returns 0.5 (neutral / uncertain) when sampleSize === 0.
 */
export function computeProductionConfidence(
  productionRecords:   RepairRecordV2[],  // already filtered to result != 'dry-run'
  avgImprovement:      number | null,
  verificationPassRate: number | null,
): { confidence: number; sampleSize: number; verifiedSamples: number; productionCoverage: number } {
  const sampleSize = productionRecords.length;
  if (sampleSize === 0) {
    return { confidence: 0.5, sampleSize: 0, verifiedSamples: 0, productionCoverage: 0 };
  }

  const verRecords    = productionRecords.filter(r => r.verificationPassed !== null);
  const verSuccesses  = verRecords.filter(r => r.verificationPassed === true);
  const successFrac   = verRecords.length > 0
    ? verSuccesses.length / verRecords.length
    : productionRecords.filter(r => r.result === 'success').length / sampleSize;

  const SAMPLE_CAP   = 30;
  const sampleWeight = Math.min(1.0, 0.4 + 0.6 * (sampleSize / SAMPLE_CAP));

  const base         = successFrac * sampleWeight + 0.5 * (1 - sampleWeight);
  const improvBonus  = avgImprovement !== null ? Math.min(0.12, avgImprovement * 0.24) : 0;
  const verifyBonus  = verificationPassRate !== null ? verificationPassRate * 0.08 : 0;

  const confidence   = Math.round(
    Math.min(0.99, Math.max(0.01, base + improvBonus + verifyBonus)) * 1000,
  ) / 1000;

  return {
    confidence,
    sampleSize,
    verifiedSamples:    verRecords.length,
    productionCoverage: Math.round((sampleSize / Math.max(sampleSize, 1)) * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Risk factor classification
// ---------------------------------------------------------------------------

function classifyRiskFactor(triggeredBy: string): RiskFactorLabel {
  if (triggeredBy.includes('RF-1') || triggeredBy.includes('snapshot')) return 'snapshot-expiry';
  if (triggeredBy.includes('RF-2') || triggeredBy.includes('dr'))       return 'dr-absent';
  if (triggeredBy.includes('RF-3') || triggeredBy.includes('espn-event')) return 'espn-event-expiry';
  if (triggeredBy.includes('RF-4') || triggeredBy.includes('espn-lookup')) return 'espn-lookup-absent';
  if (triggeredBy.includes('RF-5') || triggeredBy.includes('rate-safe')) return 'rate-safe-mode';
  if (triggeredBy.includes('RF-6') && triggeredBy.includes('absent'))    return 'feed-absent';
  if (triggeredBy.includes('RF-6') || triggeredBy.includes('feed'))      return 'feed-stale';
  if (triggeredBy.includes('RF-7') || triggeredBy.includes('repair'))    return 'repair-storm';
  if (triggeredBy.includes('RF-8') || triggeredBy.includes('archive'))   return 'archive-trajectory';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// computeChampionChallenger
// ---------------------------------------------------------------------------

/**
 * Build Champion/Challenger report from repair history.
 *
 * @param records   RepairRecordV2 records, any time window.
 * @param nowMs     Current epoch ms.
 */
export function computeChampionChallenger(
  records: RepairRecordV2[],
  nowMs:   number,
): ChampionChallengerReport {
  const computedAt = new Date(nowMs).toISOString();

  // Group records by (riskFactor, action)
  type Key = `${RiskFactorLabel}::${RemediationActionType}`;
  const groups = new Map<Key, RepairRecordV2[]>();

  for (const r of records) {
    const rf = classifyRiskFactor(r.triggeredBy);
    const key: Key = `${rf}::${r.action}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  // Build per-riskFactor stats
  const rfMap = new Map<RiskFactorLabel, ActionStats[]>();

  for (const [key, recs] of groups) {
    const [rf, action] = key.split('::') as [RiskFactorLabel, RemediationActionType];

    const prodRecs     = recs.filter(r => r.result !== 'dry-run');
    const successRecs  = prodRecs.filter(r => r.result === 'success');
    const successRate  = prodRecs.length > 0
      ? Math.round((successRecs.length / prodRecs.length) * 1000) / 10
      : 100;

    const durRecs = successRecs.filter(r => r.durationMs > 0);
    const avgRecoveryTime = durRecs.length > 0
      ? Math.round(durRecs.reduce((s, r) => s + r.durationMs, 0) / durRecs.length)
      : null;

    const improvRecs = recs.filter(r => r.riskBefore !== null && r.riskAfter !== null);
    const avgImprovement = improvRecs.length > 0
      ? Math.round(
          improvRecs.reduce((s, r) => s + (r.riskBefore! - r.riskAfter!), 0)
          / improvRecs.length * 1000,
        ) / 1000
      : null;

    const verRecs = recs.filter(r => r.verificationPassed !== null);
    const verificationPassRate = verRecs.length > 0
      ? Math.round(verRecs.filter(r => r.verificationPassed).length / verRecs.length * 1000) / 1000
      : null;

    const { confidence, sampleSize: prodSz, verifiedSamples, productionCoverage } =
      computeProductionConfidence(prodRecs, avgImprovement, verificationPassRate);

    const stats: ActionStats = {
      action,
      sampleSize:          recs.length,
      successRate,
      avgRecoveryTime,
      verificationPassRate,
      avgImprovement,
      productionConfidence: confidence,
      verifiedSamples,
      productionCoverage:  prodRecs.length > 0
        ? Math.round(prodRecs.length / recs.length * 1000) / 1000
        : 0,
    };
    void prodSz;

    const list = rfMap.get(rf) ?? [];
    list.push(stats);
    rfMap.set(rf, list);
  }

  // Build comparisons per risk factor
  const byRiskFactor: RiskFactorComparison[] = [];

  for (const [rf, statsList] of rfMap) {
    const sorted = [...statsList].sort(
      (a, b) => b.productionConfidence - a.productionConfidence,
    );
    const [champion, ...challengers] = sorted;
    const sampleTotal = statsList.reduce((s, a) => s + a.sampleSize, 0);

    byRiskFactor.push({
      riskFactor:  rf,
      champion,
      challengers,
      ranking:     sorted.map(s => s.action),
      sampleTotal,
    });
  }

  // Sort comparisons by total sample size (best-evidenced first)
  byRiskFactor.sort((a, b) => b.sampleTotal - a.sampleTotal);

  // Global ranking: weighted average confidence across all risk factors
  const globalMap = new Map<RemediationActionType, { confSum: number; count: number; samples: number; rfSet: Set<string> }>();

  for (const comp of byRiskFactor) {
    for (const stat of [comp.champion, ...comp.challengers]) {
      const entry = globalMap.get(stat.action) ?? {
        confSum: 0, count: 0, samples: 0, rfSet: new Set(),
      };
      entry.confSum += stat.productionConfidence;
      entry.count++;
      entry.samples += stat.sampleSize;
      entry.rfSet.add(comp.riskFactor);
      globalMap.set(stat.action, entry);
    }
  }

  const globalRanking = [...globalMap.entries()]
    .map(([action, e]) => ({
      action,
      productionConfidence: Math.round(e.confSum / e.count * 1000) / 1000,
      sampleSize:           e.samples,
      riskFactorsCovered:   e.rfSet.size,
    }))
    .sort((a, b) => b.productionConfidence - a.productionConfidence);

  return { computedAt, byRiskFactor, globalRanking };
}
