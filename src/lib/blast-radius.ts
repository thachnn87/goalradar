/**
 * blast-radius.ts — DATA-18S Phase 2
 *
 * Blast Radius Analysis.
 *
 * Estimates the scope of a risk factor's impact if it materialises:
 *   MatchesAffected     — how many FINISHED matches lose enrichment / scores
 *   PagesAffected       — which user-facing pages degrade
 *   SubsystemsAffected  — which internal subsystems are impacted
 *   MonitoringAffected  — which monitoring endpoints flip non-GREEN
 *
 * Classifies blast radius as: LOW | MEDIUM | HIGH | CRITICAL
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RiskFactorId } from './auto-remediation';
import type { ScoreTier }    from './risk-priority';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlastTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PageImpact {
  path:       string;   // e.g. '/worldcup', '/worldcup/matches'
  degradation: 'COMPLETE' | 'PARTIAL' | 'DEGRADED' | 'NONE';
  reason:     string;
}

export interface SubsystemImpact {
  subsystem:  string;   // 'enrichment-health' | 'authority-drift' | etc.
  verdict:    'RED' | 'YELLOW' | 'DEGRADED';
  reason:     string;
}

export interface MonitoringImpact {
  endpoint:   string;   // '/api/debug/...'
  expected:   'RED' | 'YELLOW';
  reason:     string;
}

export interface BlastRadiusResult {
  tier:               BlastTier;
  /** Estimated number of FINISHED matches that lose data quality. */
  matchesAffected:    number;
  /** Fraction of total finished matches (0–1). */
  matchesFraction:    number;
  pages:              PageImpact[];
  subsystems:         SubsystemImpact[];
  monitoring:         MonitoringImpact[];
  /** Plain-English summary. */
  summary:            string;
  /** Key blast radius score components that drove the tier. */
  drivers:            string[];
}

// ---------------------------------------------------------------------------
// Risk factor blast-radius profiles
// ---------------------------------------------------------------------------

interface RFProfile {
  subsystems:   SubsystemImpact[];
  monitoring:   MonitoringImpact[];
  pages:        PageImpact[];
  /** Base fraction of finished matches affected (0–1). */
  baseFraction: number;
  /** Blast tier when matchCount is 0 (system-wide risk). */
  systemTier:   BlastTier;
}

const RF_PROFILES: Record<string, RFProfile> = {
  'RF-1': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'RED',    reason: 'Snapshot eviction → unenriched rebuild' },
      { subsystem: 'authority-drift',   verdict: 'YELLOW', reason: 'Stale authority snapshot increases drift risk' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health', expected: 'RED',    reason: 'unenriched > 0' },
      { endpoint: '/api/debug/worldcup-health',   expected: 'YELLOW', reason: 'enrichment gate degraded' },
    ],
    pages: [
      { path: '/worldcup/matches', degradation: 'PARTIAL', reason: 'Affected match scores may show stale data' },
      { path: '/worldcup',         degradation: 'PARTIAL', reason: 'Summary stats derived from enriched snapshots' },
    ],
    baseFraction: 0.15,
    systemTier:   'HIGH',
  },
  'RF-2': {
    subsystems: [
      { subsystem: 'authority-drift', verdict: 'YELLOW', reason: 'DR absent — downgrade guard disabled' },
    ],
    monitoring: [
      { endpoint: '/api/debug/authority-freshness', expected: 'YELLOW', reason: 'DR key absent' },
      { endpoint: '/api/debug/worldcup-health',     expected: 'YELLOW', reason: 'freshness gate YELLOW' },
    ],
    pages: [
      { path: '/worldcup', degradation: 'DEGRADED', reason: 'Downgrade fallback unavailable during primary outage' },
    ],
    baseFraction: 0.05,
    systemTier:   'MEDIUM',
  },
  'RF-3': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'YELLOW', reason: 'ESPN events stale — enrichment partial' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health', expected: 'YELLOW', reason: 'ESPN event TTL expired' },
    ],
    pages: [
      { path: '/worldcup/matches', degradation: 'PARTIAL', reason: 'Match detail may show stale ESPN data' },
    ],
    baseFraction: 0.20,
    systemTier:   'MEDIUM',
  },
  'RF-4': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'RED', reason: 'ESPN lookup absent — enrichment completely blocked' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health', expected: 'RED',    reason: 'unenriched > 0 (lookup missing)' },
      { endpoint: '/api/debug/worldcup-health',   expected: 'YELLOW', reason: 'enrichment gate RED' },
    ],
    pages: [
      { path: '/worldcup/matches', degradation: 'PARTIAL',  reason: 'Affected matches missing ESPN enrichment' },
      { path: '/worldcup',         degradation: 'DEGRADED', reason: 'Summary stats may be incomplete' },
    ],
    baseFraction: 0.10,
    systemTier:   'HIGH',
  },
  'RF-5': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'RED',    reason: 'Rate-safe halts ALL background refreshes' },
      { subsystem: 'authority-drift',   verdict: 'YELLOW', reason: 'Authority not refreshed during rate-safe window' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health',    expected: 'RED',    reason: 'Refresh suppressed → unenriched on rebuild' },
      { endpoint: '/api/debug/authority-freshness',  expected: 'YELLOW', reason: 'Authority refresh halted' },
      { endpoint: '/api/debug/worldcup-health',      expected: 'RED',    reason: 'Multiple subsystem gates degraded' },
    ],
    pages: [
      { path: '/worldcup',         degradation: 'COMPLETE', reason: 'Rate-safe blocks all enrichment updates' },
      { path: '/worldcup/matches', degradation: 'COMPLETE', reason: 'All match enrichment halted' },
      { path: '/worldcup/group',   degradation: 'PARTIAL',  reason: 'Group standings may lag' },
    ],
    baseFraction: 1.0,   // ALL matches affected
    systemTier:   'CRITICAL',
  },
  'RF-6': {
    subsystems: [
      { subsystem: 'feed-integrity',    verdict: 'RED', reason: 'Feed absent/stale — match data missing' },
      { subsystem: 'enrichment-health', verdict: 'RED', reason: 'No feed → no matches to enrich' },
    ],
    monitoring: [
      { endpoint: '/api/debug/feed-integrity',    expected: 'RED',    reason: 'feed absent' },
      { endpoint: '/api/debug/enrichment-health', expected: 'RED',    reason: 'downstream from feed' },
      { endpoint: '/api/debug/worldcup-health',   expected: 'RED',    reason: 'multiple RED gates' },
    ],
    pages: [
      { path: '/worldcup',         degradation: 'COMPLETE', reason: 'No feed data — all pages show stale content' },
      { path: '/worldcup/matches', degradation: 'COMPLETE', reason: 'Match listing relies on feed' },
      { path: '/worldcup/group',   degradation: 'COMPLETE', reason: 'Group tables rely on feed scores' },
    ],
    baseFraction: 1.0,
    systemTier:   'CRITICAL',
  },
  'RF-7': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'YELLOW', reason: 'Self-heal in progress — transient degradation' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health', expected: 'YELLOW', reason: 'Repair-locks active' },
    ],
    pages: [
      { path: '/worldcup/matches', degradation: 'PARTIAL', reason: 'Affected matches temporarily unenriched during repair' },
    ],
    baseFraction: 0.10,
    systemTier:   'MEDIUM',
  },
  'RF-8': {
    subsystems: [
      { subsystem: 'enrichment-health', verdict: 'RED',    reason: 'Persistent degradation — system not self-correcting' },
      { subsystem: 'authority-drift',   verdict: 'YELLOW', reason: 'Sustained non-GREEN archive trajectory' },
    ],
    monitoring: [
      { endpoint: '/api/debug/enrichment-health', expected: 'RED',    reason: 'persistent unenriched' },
      { endpoint: '/api/debug/authority-drift',   expected: 'YELLOW', reason: 'elevated drift' },
      { endpoint: '/api/debug/worldcup-health',   expected: 'RED',    reason: 'sustained failure' },
    ],
    pages: [
      { path: '/worldcup',         degradation: 'PARTIAL',  reason: 'Data quality degraded for multiple periods' },
      { path: '/worldcup/matches', degradation: 'PARTIAL',  reason: 'Ongoing enrichment issues' },
      { path: '/worldcup/group',   degradation: 'DEGRADED', reason: 'Group standings may be inaccurate' },
    ],
    baseFraction: 0.40,
    systemTier:   'HIGH',
  },
};

// ---------------------------------------------------------------------------
// classifyBlastTier
// ---------------------------------------------------------------------------

function classifyBlastTier(
  matchesAffected:    number,
  totalFinished:      number,
  subsystemCount:     number,
  hasCompleteOutage:  boolean,
): BlastTier {
  if (hasCompleteOutage)                               return 'CRITICAL';
  const frac = totalFinished > 0 ? matchesAffected / totalFinished : 0;
  if (frac >= 0.50 || subsystemCount >= 3)             return 'CRITICAL';
  if (frac >= 0.20 || subsystemCount >= 2)             return 'HIGH';
  if (frac >= 0.05 || subsystemCount >= 1)             return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// estimateBlastRadius
// ---------------------------------------------------------------------------

/**
 * Estimate the blast radius of a risk factor materialising.
 *
 * @param rfId          The risk factor ID.
 * @param matchCount    Number of specific matches at risk (from predictive-risk).
 * @param totalFinished Total FINISHED matches in the system (from feed).
 * @param severity      Current severity of the risk factor.
 */
export function estimateBlastRadius(
  rfId:           RiskFactorId | null,
  matchCount:     number,
  totalFinished:  number,
  severity:       'GREEN' | 'YELLOW' | 'RED',
): BlastRadiusResult {
  const profile = rfId ? RF_PROFILES[rfId] : null;

  if (!profile) {
    return {
      tier:             'LOW',
      matchesAffected:  matchCount,
      matchesFraction:  totalFinished > 0 ? matchCount / totalFinished : 0,
      pages:            [],
      subsystems:       [],
      monitoring:       [],
      summary:          'Unknown risk factor — blast radius undetermined.',
      drivers:          ['unknown-rf'],
    };
  }

  // Estimate affected matches
  const baseFrac = profile.baseFraction;
  const basedOnProfile  = Math.round(totalFinished * baseFrac);
  const matchesAffected = matchCount > 0 ? matchCount : basedOnProfile;
  const matchesFraction = totalFinished > 0 ? matchesAffected / totalFinished : baseFrac;

  // Scale severity onto pages
  const pages: PageImpact[] = severity === 'GREEN'
    ? profile.pages.map(p => ({ ...p, degradation: 'NONE' as const }))
    : profile.pages;

  const hasComplete = pages.some(p => p.degradation === 'COMPLETE');
  const tier = classifyBlastTier(
    matchesAffected,
    totalFinished,
    profile.subsystems.length,
    hasComplete,
  );

  const drivers: string[] = [];
  if (hasComplete)               drivers.push('complete-page-outage');
  if (matchesFraction >= 0.50)   drivers.push(`${Math.round(matchesFraction*100)}%-matches-affected`);
  if (profile.subsystems.length >= 2) drivers.push(`${profile.subsystems.length}-subsystems-impacted`);
  if (profile.monitoring.some(m => m.expected === 'RED')) drivers.push('monitoring-RED-expected');

  const summary = `${tier}: ~${matchesAffected} match(es) (${Math.round(matchesFraction*100)}%), ` +
    `${profile.subsystems.length} subsystem(s), ${profile.pages.length} page(s) affected.`;

  return {
    tier,
    matchesAffected,
    matchesFraction: Math.round(matchesFraction * 1000) / 1000,
    pages,
    subsystems: profile.subsystems,
    monitoring: profile.monitoring,
    summary,
    drivers,
  };
}

// ---------------------------------------------------------------------------
// combineBlastRadii — for compound risk scenarios
// ---------------------------------------------------------------------------

/**
 * Merge blast radius results from multiple concurrent risk factors.
 * De-duplicates subsystems and pages; takes highest tier.
 */
export function combineBlastRadii(results: BlastRadiusResult[]): BlastRadiusResult {
  if (results.length === 0) {
    return {
      tier: 'LOW', matchesAffected: 0, matchesFraction: 0,
      pages: [], subsystems: [], monitoring: [],
      summary: 'No active risks.', drivers: [],
    };
  }

  const tierRank: Record<BlastTier, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  const highestTier = results.reduce<BlastTier>(
    (best, r) => tierRank[r.tier] > tierRank[best] ? r.tier : best,
    'LOW',
  );

  const matchesAffected = Math.max(...results.map(r => r.matchesAffected));
  const matchesFraction = Math.max(...results.map(r => r.matchesFraction));

  // Dedupe pages by path (take worst degradation)
  const degRank: Record<string, number> = { NONE: 0, DEGRADED: 1, PARTIAL: 2, COMPLETE: 3 };
  const pageMap = new Map<string, PageImpact>();
  for (const r of results) {
    for (const p of r.pages) {
      const existing = pageMap.get(p.path);
      if (!existing || degRank[p.degradation] > degRank[existing.degradation]) {
        pageMap.set(p.path, p);
      }
    }
  }

  const subsystemMap = new Map<string, SubsystemImpact>();
  for (const r of results) {
    for (const s of r.subsystems) {
      if (!subsystemMap.has(s.subsystem)) subsystemMap.set(s.subsystem, s);
    }
  }

  const monitoringMap = new Map<string, MonitoringImpact>();
  for (const r of results) {
    for (const m of r.monitoring) {
      const existing = monitoringMap.get(m.endpoint);
      if (!existing || m.expected === 'RED') monitoringMap.set(m.endpoint, m);
    }
  }

  const allDrivers = [...new Set(results.flatMap(r => r.drivers))];

  return {
    tier:            highestTier,
    matchesAffected,
    matchesFraction: Math.round(matchesFraction * 1000) / 1000,
    pages:           [...pageMap.values()],
    subsystems:      [...subsystemMap.values()],
    monitoring:      [...monitoringMap.values()],
    summary:         `Combined ${results.length} risk(s): ${highestTier}, ` +
                     `${matchesAffected} match(es), ${subsystemMap.size} subsystem(s).`,
    drivers:         allDrivers,
  };
}

// ---------------------------------------------------------------------------
// blastTierFromScoreTier
// ---------------------------------------------------------------------------

export function blastTierFromScoreTier(t: ScoreTier): BlastTier {
  return t as BlastTier;
}
