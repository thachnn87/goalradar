/**
 * risk-priority.ts — DATA-18S Phase 1
 *
 * Risk Scoring Engine.
 *
 * Converts raw predictive risk signals into a composite priority score (0–100)
 * with four independent dimensions:
 *
 *   Probability  — how likely is a failure to occur within 24h?
 *   Impact       — how severe would the failure be for users/data?
 *   Urgency      — how quickly must action be taken (based on TTL proximity)?
 *   Confidence   — how reliable is this risk signal (sample size, history)?
 *
 * CompositePriorityScore = weighted sum, 0–100, rounded.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RiskFactorId, RemediationActionType, ActionPriority } from './auto-remediation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskDimension {
  /** Raw score for this dimension (0–1). */
  score:      number;
  /** Tier classification for this dimension. */
  tier:       ScoreTier;
  /** Human-readable rationale. */
  reason:     string;
}

export interface CompositePriorityScore {
  /** 0–100. Higher = higher priority. */
  total:       number;
  tier:        ScoreTier;
  probability: RiskDimension;
  impact:      RiskDimension;
  urgency:     RiskDimension;
  confidence:  RiskDimension;
  /** The risk factor(s) this score applies to. */
  riskFactors: string[];
  /** Recommended action derived from highest-confidence KB entry. */
  recommendedAction: RemediationActionType | null;
  /** Priority label matching RemediationPlan priority vocabulary. */
  actionPriority:    ActionPriority;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Risk factor signal supplied by the caller (from predictive-risk or inline scan). */
export interface RiskSignal {
  factor:       string;            // e.g. 'snapshots-expiring-4h', 'rate-safe-mode'
  rfId:         RiskFactorId | null;
  severity:     'GREEN' | 'YELLOW' | 'RED';
  matchCount:   number;            // number of matches affected (0 for system-wide)
  ttlSec:       number | null;     // remaining TTL of the underlying KV key (null = absent)
  activeRepairLocks: number;       // how many concurrent repair-locks are active
  historicalSuccessRate: number;   // 0–100, from KB (0 if no history)
  productionSamples: number;       // production repair records for this factor
}

// ---------------------------------------------------------------------------
// Dimension weights
// ---------------------------------------------------------------------------

const W_PROB  = 0.35;
const W_IMP   = 0.30;
const W_URG   = 0.20;
const W_CONF  = 0.15;

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

function tier(score: number): ScoreTier {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.50) return 'HIGH';
  if (score >= 0.25) return 'MEDIUM';
  return 'LOW';
}

function compositeTier(total: number): ScoreTier {
  if (total >= 75) return 'CRITICAL';
  if (total >= 50) return 'HIGH';
  if (total >= 25) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// RF-ID → base probability (from DATA-18N risk model)
// ---------------------------------------------------------------------------

const RF_BASE_PROB: Record<string, number> = {
  'RF-1': 0.20, 'RF-2': 0.15, 'RF-3': 0.15, 'RF-4': 0.15,
  'RF-5': 0.92, 'RF-6': 0.40, 'RF-7': 0.30, 'RF-8': 0.70,
};

// RF-ID → user-facing impact (how bad is it when this fails?)
const RF_IMPACT: Record<string, number> = {
  'RF-1': 0.65,  // enrichment loss for finished matches
  'RF-2': 0.55,  // DR guard disabled
  'RF-3': 0.60,  // ESPN data stale — scores inaccurate
  'RF-4': 0.60,  // ESPN enrichment blocked
  'RF-5': 0.85,  // rate-safe blocks ALL refreshes
  'RF-6': 0.80,  // feed absent = matches missing
  'RF-7': 0.45,  // self-heal in progress — transient
  'RF-8': 0.75,  // persistent degradation — operator needed
};

// RF-ID → recommended action
const RF_ACTION: Record<string, RemediationActionType> = {
  'RF-1': 'PREWARM_SNAPSHOT',
  'RF-2': 'REBUILD_DR',
  'RF-3': 'REFRESH_ESPN_CACHE',
  'RF-4': 'RESOLVE_ESPN_LOOKUP',
  'RF-5': 'SUPPRESS_REFRESH',
  'RF-6': 'TRIGGER_ORCHESTRATOR',
  'RF-7': 'MONITOR_SELF_HEAL',
  'RF-8': 'ESCALATE_INCIDENT',
};

// ---------------------------------------------------------------------------
// scoreRiskSignal
// ---------------------------------------------------------------------------

/**
 * Compute a CompositePriorityScore for a single risk signal.
 *
 * @param signal   The risk signal to score.
 * @param nowMs    Current epoch ms (unused directly, kept for API symmetry).
 */
export function scoreRiskSignal(signal: RiskSignal, nowMs: number): CompositePriorityScore {
  void nowMs;
  const rfKey = signal.rfId ?? '';

  // ── Probability dimension ─────────────────────────────────────────────
  let probScore = RF_BASE_PROB[rfKey] ?? 0.10;
  if (signal.severity === 'RED')    probScore = Math.min(1, probScore * 1.5);
  if (signal.severity === 'GREEN')  probScore = 0.02;
  const probReason = `Base P(failure|RF)=${RF_BASE_PROB[rfKey] ?? 0.10}; severity=${signal.severity}`;

  // ── Impact dimension ──────────────────────────────────────────────────
  let impactScore = RF_IMPACT[rfKey] ?? 0.40;
  // Scale up for match count — each additional affected match adds 0.02 up to cap
  const matchBonus = Math.min(0.20, signal.matchCount * 0.02);
  impactScore = Math.min(1, impactScore + matchBonus);
  const impactReason = `RF impact=${RF_IMPACT[rfKey] ?? 0.40}; matchCount=${signal.matchCount}`;

  // ── Urgency dimension ─────────────────────────────────────────────────
  let urgencyScore: number;
  let urgencyReason: string;
  if (signal.ttlSec === null || signal.ttlSec < 0) {
    // Key absent — immediate concern
    urgencyScore  = 0.90;
    urgencyReason = 'KV key absent — no TTL; immediate action required';
  } else if (signal.ttlSec <= 4 * 3600) {
    urgencyScore  = 0.90;
    urgencyReason = `TTL=${Math.round(signal.ttlSec/3600*10)/10}h — expiry within 4h`;
  } else if (signal.ttlSec <= 24 * 3600) {
    const fraction = 1 - signal.ttlSec / (24 * 3600);
    urgencyScore  = 0.40 + fraction * 0.50;
    urgencyReason = `TTL=${Math.round(signal.ttlSec/3600*10)/10}h — expiry within 24h`;
  } else if (signal.activeRepairLocks > 0) {
    urgencyScore  = 0.50;
    urgencyReason = `${signal.activeRepairLocks} active repair-lock(s) — self-heal running`;
  } else {
    urgencyScore  = 0.15;
    urgencyReason = `TTL=${Math.round(signal.ttlSec/3600*10)/10}h — not urgent`;
  }

  // ── Confidence dimension ──────────────────────────────────────────────
  // How reliable is our assessment? Based on historical data quality.
  let confScore: number;
  let confReason: string;
  if (signal.productionSamples === 0) {
    confScore  = 0.30;  // no production data → low confidence in this score
    confReason = 'No production repair history for this risk factor';
  } else if (signal.productionSamples < 5) {
    confScore  = 0.50;
    confReason = `${signal.productionSamples} production sample(s) — limited history`;
  } else {
    const histFraction = signal.historicalSuccessRate / 100;
    confScore  = 0.60 + histFraction * 0.35;
    confReason = `${signal.productionSamples} production samples; historical success ${signal.historicalSuccessRate}%`;
  }

  // ── Composite score ───────────────────────────────────────────────────
  const total = Math.round(
    (probScore * W_PROB + impactScore * W_IMP + urgencyScore * W_URG + confScore * W_CONF) * 100,
  );

  const recommendedAction = rfKey ? (RF_ACTION[rfKey] ?? null) : null;

  // Map total to ActionPriority vocabulary
  let actionPriority: ActionPriority;
  if (total >= 75) actionPriority = 'CRITICAL';
  else if (total >= 55) actionPriority = 'HIGH';
  else if (total >= 35) actionPriority = 'MEDIUM';
  else if (total >= 10) actionPriority = 'LOW';
  else actionPriority = 'NONE';

  return {
    total,
    tier: compositeTier(total),
    probability: { score: Math.round(probScore * 1000) / 1000, tier: tier(probScore), reason: probReason },
    impact:      { score: Math.round(impactScore * 1000) / 1000, tier: tier(impactScore), reason: impactReason },
    urgency:     { score: Math.round(urgencyScore * 1000) / 1000, tier: tier(urgencyScore), reason: urgencyReason },
    confidence:  { score: Math.round(confScore * 1000) / 1000, tier: tier(confScore), reason: confReason },
    riskFactors: [signal.factor],
    recommendedAction,
    actionPriority,
  };
}

// ---------------------------------------------------------------------------
// scoreMultipleSignals — compound risk scoring
// ---------------------------------------------------------------------------

/**
 * Score a set of concurrent risk signals and return them sorted highest → lowest.
 * Also returns a compound score for the combined risk (max across all signals
 * with a 10% compounding bonus per additional HIGH/CRITICAL signal).
 */
export function scoreMultipleSignals(
  signals: RiskSignal[],
  nowMs:   number,
): { scores: CompositePriorityScore[]; compoundTotal: number; compoundTier: ScoreTier } {
  const scores = signals
    .map(s => scoreRiskSignal(s, nowMs))
    .sort((a, b) => b.total - a.total);

  if (scores.length === 0) {
    return { scores: [], compoundTotal: 0, compoundTier: 'LOW' };
  }

  const highCount = scores.filter(s => s.tier === 'HIGH' || s.tier === 'CRITICAL').length;
  const baseMax   = scores[0].total;
  const bonus     = Math.min(20, (highCount - 1) * 10);  // up to +20 for 3+ HIGH signals
  const compoundTotal = Math.min(100, baseMax + bonus);

  return { scores, compoundTotal, compoundTier: compositeTier(compoundTotal) };
}

// ---------------------------------------------------------------------------
// evidenceQuality — Phase 5
// ---------------------------------------------------------------------------

export type EvidenceQuality = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvidenceProfile {
  sampleSize:           number;
  productionCoverage:   number;   // 0–1
  verificationCoverage: number;   // 0–1
  evidenceQuality:      EvidenceQuality;
  qualityReason:        string;
}

/**
 * Classify evidence quality from repair history coverage metrics.
 *
 * HIGH:   ≥20 production samples AND verificationCoverage ≥ 0.7
 * MEDIUM: ≥5 production samples OR verificationCoverage ≥ 0.3
 * LOW:    otherwise
 */
export function classifyEvidenceQuality(
  sampleSize:           number,
  productionCoverage:   number,
  verificationCoverage: number,
): EvidenceProfile {
  const prodSamples = Math.round(sampleSize * productionCoverage);
  const verSamples  = Math.round(sampleSize * verificationCoverage);

  let quality: EvidenceQuality;
  let reason: string;

  if (prodSamples >= 20 && verificationCoverage >= 0.70) {
    quality = 'HIGH';
    reason  = `${prodSamples} production samples, ${Math.round(verificationCoverage*100)}% verified`;
  } else if (prodSamples >= 5 || verificationCoverage >= 0.30) {
    quality = 'MEDIUM';
    reason  = `${prodSamples} production sample(s), ${Math.round(verificationCoverage*100)}% verified — growing evidence base`;
  } else {
    quality = 'LOW';
    reason  = `${prodSamples} production sample(s), ${Math.round(verificationCoverage*100)}% verified — insufficient history`;
  }

  return {
    sampleSize,
    productionCoverage:   Math.round(productionCoverage * 1000) / 1000,
    verificationCoverage: Math.round(verificationCoverage * 1000) / 1000,
    evidenceQuality: quality,
    qualityReason:   reason,
  };
}
