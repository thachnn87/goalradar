/**
 * business-impact.ts — DATA-18S Phase 4
 *
 * Business Impact Layer.
 *
 * Maps technical failures to four business dimensions:
 *   SEO impact        — crawlability, structured data, Core Web Vitals
 *   User impact       — data accuracy, page availability, experience
 *   Revenue impact    — ad impressions, traffic, affiliate signals
 *   Operational impact — on-call burden, SLA risk, manual work
 *
 * Returns a BusinessCriticality assessment for each risk factor.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RiskFactorId } from './auto-remediation';
import type { BlastTier }    from './blast-radius';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BusinessTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface BusinessDimension {
  score:  number;   // 0–1
  tier:   BusinessTier;
  reason: string;
}

export interface BusinessCriticality {
  overall:     BusinessTier;
  /** 0–100 composite business impact score. */
  score:       number;
  seo:         BusinessDimension;
  user:        BusinessDimension;
  revenue:     BusinessDimension;
  operational: BusinessDimension;
  /** Plain-English business summary for the executive dashboard. */
  headline:    string;
}

// ---------------------------------------------------------------------------
// Business impact profiles per risk factor
// ---------------------------------------------------------------------------

interface BusinessProfile {
  seo:         { score: number; reason: string };
  user:        { score: number; reason: string };
  revenue:     { score: number; reason: string };
  operational: { score: number; reason: string };
}

const PROFILES: Record<string, BusinessProfile> = {
  'RF-1': {
    seo:         { score: 0.55, reason: 'Stale match data degrades structured data freshness; Googlebot may cache incorrect scores' },
    user:        { score: 0.65, reason: 'Users see outdated match stats; data accuracy drops on match detail pages' },
    revenue:     { score: 0.45, reason: 'Stale content reduces re-engagement; ad impressions lower on stale pages' },
    operational: { score: 0.35, reason: 'Self-heal typically handles within 30min; low on-call burden' },
  },
  'RF-2': {
    seo:         { score: 0.25, reason: 'DR absent is invisible to crawlers; no direct SEO impact until primary fails' },
    user:        { score: 0.30, reason: 'No user-visible impact unless primary also fails; risk is latent' },
    revenue:     { score: 0.30, reason: 'Latent risk — no revenue impact now, but DR absent means no graceful degradation' },
    operational: { score: 0.55, reason: 'Without DR, any primary cache failure triggers full manual recovery' },
  },
  'RF-3': {
    seo:         { score: 0.60, reason: 'Stale ESPN data = inaccurate JSON-LD structured data; rich results may be revoked' },
    user:        { score: 0.60, reason: 'Match detail missing ESPN stats, lineups, and odds — core UX degraded' },
    revenue:     { score: 0.55, reason: 'Lower time-on-page when detail pages lack ESPN enrichment' },
    operational: { score: 0.30, reason: 'Cache expiry is scheduled; low surprise burden' },
  },
  'RF-4': {
    seo:         { score: 0.65, reason: 'Missing ESPN lookup = no enrichment = no structured data = rich-result loss' },
    user:        { score: 0.70, reason: 'Match pages completely lacking ESPN data — significant UX degradation' },
    revenue:     { score: 0.60, reason: 'Unenriched match pages have lower ad CPM and affiliate conversion' },
    operational: { score: 0.40, reason: 'Requires ESPN API lookup re-run; moderate manual effort if automation fails' },
  },
  'RF-5': {
    seo:         { score: 0.85, reason: 'Rate-safe halts ALL refreshes → entire site serves stale data → systematic rich-result risk' },
    user:        { score: 0.90, reason: 'All match pages degrade simultaneously; users see no live updates during World Cup' },
    revenue:     { score: 0.85, reason: 'Traffic surge during World Cup matches; stale data causes bounce rate spike' },
    operational: { score: 0.75, reason: 'Rate-safe is a blast incident; on-call must monitor and manually clear if extended' },
  },
  'RF-6': {
    seo:         { score: 0.90, reason: 'Feed absent = no match data = 404 or empty pages = Googlebot crawl errors' },
    user:        { score: 0.95, reason: 'Match listing and group tables completely unavailable — site unusable for World Cup' },
    revenue:     { score: 0.90, reason: 'Total loss of primary product during peak demand; catastrophic traffic impact' },
    operational: { score: 0.80, reason: 'Requires orchestrator manual trigger; all subsystems cascade RED' },
  },
  'RF-7': {
    seo:         { score: 0.20, reason: 'Self-heal is transient (<30min); no crawl window impact expected' },
    user:        { score: 0.35, reason: 'Brief enrichment gaps during repair; mostly self-correcting' },
    revenue:     { score: 0.20, reason: 'Short duration; minimal revenue impact if self-heal completes' },
    operational: { score: 0.45, reason: 'Elevated repair locks increase observability burden; watch for storm escalation' },
  },
  'RF-8': {
    seo:         { score: 0.70, reason: 'Persistent degradation = sustained poor structured data; Google demotion risk after 3+ days' },
    user:        { score: 0.75, reason: 'Multiple periods of degraded data erodes user trust in GoalRadar accuracy' },
    revenue:     { score: 0.65, reason: 'Sustained traffic quality drop; organic search rankings at risk' },
    operational: { score: 0.80, reason: 'System not self-correcting → operator must intervene; SLA breach imminent' },
  },
};

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

function dimTier(score: number): BusinessTier {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.50) return 'HIGH';
  if (score >= 0.25) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// computeBusinessImpact
// ---------------------------------------------------------------------------

const W_SEO  = 0.30;
const W_USER = 0.35;
const W_REV  = 0.20;
const W_OPS  = 0.15;

/**
 * Compute business criticality for a risk factor.
 *
 * @param rfId         The risk factor ID (null = unknown).
 * @param blastTier    Blast radius tier (escalates scores if CRITICAL/HIGH).
 * @param matchCount   Affected match count (scales user/revenue dims).
 */
export function computeBusinessImpact(
  rfId:       RiskFactorId | null,
  blastTier:  BlastTier,
  matchCount: number,
): BusinessCriticality {
  const profile = rfId ? PROFILES[rfId] : null;

  if (!profile) {
    return {
      overall:     'LOW',
      score:       10,
      seo:         { score: 0.10, tier: 'LOW', reason: 'Unknown risk factor' },
      user:        { score: 0.10, tier: 'LOW', reason: 'Unknown risk factor' },
      revenue:     { score: 0.10, tier: 'LOW', reason: 'Unknown risk factor' },
      operational: { score: 0.10, tier: 'LOW', reason: 'Unknown risk factor' },
      headline:    'Unknown risk factor — business impact undetermined.',
    };
  }

  // Blast escalation modifier: CRITICAL adds 15%, HIGH adds 8%
  const blastMod = blastTier === 'CRITICAL' ? 0.15 : blastTier === 'HIGH' ? 0.08 : 0;

  // Match count modifier: up to +0.10 for high match count (≥15 matches)
  const matchMod = Math.min(0.10, matchCount * 0.005);

  const seoScore  = Math.min(1, profile.seo.score  + blastMod);
  const userScore = Math.min(1, profile.user.score  + blastMod + matchMod);
  const revScore  = Math.min(1, profile.revenue.score + blastMod + matchMod * 0.5);
  const opsScore  = Math.min(1, profile.operational.score + (blastTier === 'CRITICAL' ? 0.10 : 0));

  const composite = seoScore * W_SEO + userScore * W_USER + revScore * W_REV + opsScore * W_OPS;
  const score     = Math.round(composite * 100);

  const overall: BusinessTier =
    score >= 75 ? 'CRITICAL' :
    score >= 50 ? 'HIGH'     :
    score >= 25 ? 'MEDIUM'   : 'LOW';

  // Headline — top concern by dimension score
  const dims = [
    { name: 'SEO', score: seoScore, reason: profile.seo.reason },
    { name: 'User experience', score: userScore, reason: profile.user.reason },
    { name: 'Revenue', score: revScore, reason: profile.revenue.reason },
    { name: 'Operations', score: opsScore, reason: profile.operational.reason },
  ].sort((a, b) => b.score - a.score);

  const headline = `${overall} business impact. Primary concern: ${dims[0].name} — ${dims[0].reason.split(';')[0]}.`;

  return {
    overall,
    score,
    seo:         { score: Math.round(seoScore  * 1000) / 1000, tier: dimTier(seoScore),  reason: profile.seo.reason },
    user:        { score: Math.round(userScore  * 1000) / 1000, tier: dimTier(userScore), reason: profile.user.reason },
    revenue:     { score: Math.round(revScore   * 1000) / 1000, tier: dimTier(revScore),  reason: profile.revenue.reason },
    operational: { score: Math.round(opsScore   * 1000) / 1000, tier: dimTier(opsScore),  reason: profile.operational.reason },
    headline,
  };
}
