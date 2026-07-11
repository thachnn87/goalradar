/**
 * GET /api/debug/knockout-graph
 *
 * Knockout bracket integrity report. Reconstructs the explicit knockout DAG
 * from the single source of truth (buildKnockoutViewModel → buildKnockoutGraph)
 * and validates that every participant originates ONLY from its two parent
 * matches — never from array index, id order, date order, or fixture order.
 *
 * Sections:
 *   1. graph            — every node: matchId, slot, parents, teams, winner
 *   2. parentChildMap   — child → [leftParent, rightParent]
 *   3. propagationChain — R32 → R16 → QF → SF → Final winner flow
 *   4. slotMap          — stage → matchIds in slot (top→bottom) order
 *   5. matchIdMap       — matchId → "Home vs Away (stage slot N)"
 *   6..8. validations   — QF⊂RO16 parents, SF⊂QF parents, Final⊂SF parents
 *   9. ancestryCheck    — no participant appears outside its ancestry
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) — open in development.
 *
 * Usage:
 *   curl "http://localhost:3000/api/debug/knockout-graph"
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildKnockoutViewModel,
  buildKnockoutGraph,
  BRACKET_ROUND_ORDER,
  type BracketNode,
} from '@/lib/knockout-vm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

const label = (n: BracketNode | undefined) =>
  n ? `${n.homeTeam} vs ${n.awayTeam}` : 'TBD';

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const vm = await buildKnockoutViewModel();
  const graph = buildKnockoutGraph(vm.fullBracketMatches, BRACKET_ROUND_ORDER);

  const byId = new Map<number, BracketNode>();
  for (const r of graph.rounds) for (const n of graph.nodes[r] ?? []) byId.set(n.matchId, n);

  // 1. Full graph (flat, slot-ordered per round)
  const nodesFlat = graph.rounds.flatMap((r) => graph.nodes[r] ?? []);

  // 2. Parent → child map
  const parentChildMap = nodesFlat.map((n) => ({
    child: `${n.stage} slot ${n.slot}: ${n.homeTeam} vs ${n.awayTeam} (M${n.matchId})`,
    leftParent: n.leftParentMatchId
      ? `M${n.leftParentMatchId}: ${label(byId.get(n.leftParentMatchId))} [${n.leftParentSource}]`
      : null,
    rightParent: n.rightParentMatchId
      ? `M${n.rightParentMatchId}: ${label(byId.get(n.rightParentMatchId))} [${n.rightParentSource}]`
      : null,
  }));

  // 3. Winner propagation chain
  const propagationChain = nodesFlat
    .filter((n) => n.winnerTeam)
    .map((n) => ({
      match: `${n.stage} slot ${n.slot}: ${n.homeTeam} vs ${n.awayTeam}`,
      winner: n.winnerTeam,
      feedsInto:
        nodesFlat.find(
          (c) => c.leftParentMatchId === n.matchId || c.rightParentMatchId === n.matchId,
        )?.matchId ?? null,
    }));

  // 4. Slot map
  const slotMap: Record<string, string[]> = {};
  for (const r of graph.rounds) {
    slotMap[r] = (graph.nodes[r] ?? []).map((n) => `slot ${n.slot}: ${n.homeTeam} vs ${n.awayTeam}`);
  }

  // 5. MatchId map
  const matchIdMap: Record<number, string> = {};
  for (const n of nodesFlat) matchIdMap[n.matchId] = `${n.homeTeam} vs ${n.awayTeam} (${n.stage} slot ${n.slot})`;

  // 6..8. Per-stage "participants originate only from two parents" validation
  const stagePairs: [string, string][] = [
    ['QUARTER_FINALS', 'LAST_16'],
    ['SEMI_FINALS', 'QUARTER_FINALS'],
    ['FINAL', 'SEMI_FINALS'],
  ];
  const parentageValidations = stagePairs.map(([stage, parentStage]) => {
    const checks = (graph.nodes[stage] ?? []).map((n) => {
      const L = n.leftParentMatchId ? byId.get(n.leftParentMatchId) : undefined;
      const R = n.rightParentMatchId ? byId.get(n.rightParentMatchId) : undefined;
      const parentsRightRound = L?.stage === parentStage && R?.stage === parentStage;
      const expected = [L?.winnerTeamId, R?.winnerTeamId].filter((x): x is number => !!x);
      const actual = [n.homeTeamId, n.awayTeamId].filter((x) => x > 0);
      const decided = expected.length === 2 && actual.length === 2;
      const originatesFromParents = decided
        ? actual.every((t) => new Set(expected).has(t))
        : null; // not yet decided — cannot contradict
      return {
        match: `${n.homeTeam} vs ${n.awayTeam}`,
        leftParent: label(L),
        rightParent: label(R),
        parentsFromCorrectRound: parentsRightRound,
        participantsFromParents: originatesFromParents,
      };
    });
    return {
      rule: `Every ${stage} participant originates only from its two ${parentStage} parents`,
      pass: checks.every((c) => c.parentsFromCorrectRound && c.participantsFromParents !== false),
      checks,
    };
  });

  // 9. Ancestry check — no team appears in a node whose subtree doesn't contain it
  //    (structurally guaranteed by slot ordering; reported explicitly here).
  const ancestryViolations = graph.issues.filter((i) => i.code === 'PARTICIPANT_MISMATCH');

  // Production-case spotlight (the screenshot chain)
  const qf = graph.nodes['QUARTER_FINALS'] ?? [];
  const spotlight = qf.map((n) => {
    const L = n.leftParentMatchId ? byId.get(n.leftParentMatchId) : undefined;
    const R = n.rightParentMatchId ? byId.get(n.rightParentMatchId) : undefined;
    return {
      quarterFinal: `${n.homeTeam} vs ${n.awayTeam}`,
      fromRoundOf16: [label(L), label(R)],
      winnersFeedingIn: [L?.winnerTeam ?? 'TBD', R?.winnerTeam ?? 'TBD'],
    };
  });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      hasApiData: vm.hasApiData,
      summary: {
        complete: graph.complete,
        valid: graph.valid,
        issueCount: graph.issues.length,
        rounds: graph.rounds.map((r) => ({ stage: r, matches: (graph.nodes[r] ?? []).length })),
      },
      report: {
        '1_graph': nodesFlat,
        '2_parentChildMap': parentChildMap,
        '3_winnerPropagationChain': propagationChain,
        '4_slotMap': slotMap,
        '5_matchIdMap': matchIdMap,
        '6_8_parentageValidations': parentageValidations,
        '9_ancestryViolations': ancestryViolations,
        productionCaseSpotlight: spotlight,
      },
      issues: graph.issues,
    },
    { status: graph.valid ? 200 : 500 },
  );
}
