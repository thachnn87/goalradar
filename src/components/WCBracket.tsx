import type { Match } from '@/lib/types';
import { deriveMatchDisplay } from '@/lib/match-display';
import MatchCard from '@/components/MatchCard';

// ---------------------------------------------------------------------------
// Layout constants  (all in px, used for both HTML and inline SVG)
// ---------------------------------------------------------------------------
const SLOT_H = 88;   // height of one base-round slot
const CARD_W = 168;  // width of each match card
const CARD_H = 68;   // height of each match card
const CONN_W = 36;   // width of the SVG connector strip between columns

const ROUND_KEYS = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'] as const;
type RoundKey = (typeof ROUND_KEYS)[number];
type AllRoundKey = RoundKey | 'THIRD_PLACE';

const ROUND_LABELS: Record<AllRoundKey, string> = {
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  FINAL: 'Final',
  THIRD_PLACE: 'Third Place',
};

const ROUND_MATCH_COUNT: Record<AllRoundKey, number> = {
  LAST_32: 16,
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  FINAL: 1,
  THIRD_PLACE: 1,
};

const emptyRounds = (): Record<RoundKey, Match[]> => ({
  LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINAL: [],
});

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

// Each round's matches are distributed evenly over the full bracket height, so
// match i of a round sits exactly between its two feeder matches (2i, 2i+1) of
// the previous round — provided each round is ordered by bracket geography
// (see orderRoundsByFeeders), not by date or match id.
function matchCenterY(roundKey: RoundKey, matchIndex: number, totalH: number): number {
  return (matchIndex + 0.5) * (totalH / ROUND_MATCH_COUNT[roundKey]);
}

function cardTop(roundKey: RoundKey, matchIndex: number, totalH: number): number {
  return matchCenterY(roundKey, matchIndex, totalH) - CARD_H / 2;
}

// ---------------------------------------------------------------------------
// Bracket-geometry ordering
//
// The authority (football-data.org) numbers knockout matches in schedule order,
// which is NOT the same as their top-to-bottom position in the bracket tree: a
// semi-final pairs the winners of two quarter-finals that may be non-adjacent by
// id. Ordering rounds by id (or date) therefore draws feeder lines to the wrong
// pair of matches.
//
// We instead reconstruct the real tree from each match's feeder linkage:
//   • a played feeder is matched by winning team id;
//   • an upcoming feeder is matched by its "Winner R16 M5" / "Winner QF2" label.
// A depth-first walk from the final produces the correct base-round leaf order;
// every earlier-round match is then ordered by the first leaf of its subtree, so
// each match's two feeders land in the adjacent (2i, 2i+1) slots the connectors
// assume. Falls back to canonical id order if the linkage is incomplete.
// ---------------------------------------------------------------------------

function winnerTeamId(m: Match): number | null {
  const w = deriveMatchDisplay(m).winner;
  if (w === 'home') return m.homeTeam?.id ?? null;
  if (w === 'away') return m.awayTeam?.id ?? null;
  return null;
}

/** Trailing integer of a slot label ("Winner R16 M5" → 5, "Winner QF2" → 2). */
function feederNumber(label: string | undefined): number | null {
  const mm = (label ?? '').match(/(\d+)\s*$/);
  return mm ? parseInt(mm[1], 10) : null;
}

function orderRoundsByFeeders(
  canon: Record<RoundKey, Match[]>,
  rounds: RoundKey[],
): Record<RoundKey, Match[]> {
  const roundIndex = new Map<string, number>(rounds.map((r, i) => [r, i]));

  // Per-round winning-team → match, so a played feeder resolves by team id.
  const winnerMap = new Map<RoundKey, Map<number, Match>>();
  for (const r of rounds) {
    const w = new Map<number, Match>();
    for (const m of canon[r]) {
      const id = winnerTeamId(m);
      if (id) w.set(id, m);
    }
    winnerMap.set(r, w);
  }

  const feeder = (m: Match, side: 'home' | 'away'): Match | null => {
    const ri = roundIndex.get(m.stage);
    if (ri == null || ri <= 0) return null;
    const prev = rounds[ri - 1];
    const team = side === 'home' ? m.homeTeam : m.awayTeam;
    if (team?.id) {
      const played = winnerMap.get(prev)?.get(team.id);
      if (played) return played;
    }
    // Upcoming match — resolve via the "Winner <round> M<n>" placeholder. n is the
    // authority match number, i.e. the n-th match of prev round by ascending id.
    const n = feederNumber(team?.name);
    if (n != null && canon[prev][n - 1]) return canon[prev][n - 1];
    return null;
  };

  const leavesMemo = new Map<number, Match[]>();
  const leaves = (m: Match): Match[] => {
    const ri = roundIndex.get(m.stage) ?? 0;
    if (ri === 0) return [m];
    const cached = leavesMemo.get(m.id);
    if (cached) return cached;
    const fh = feeder(m, 'home');
    const fa = feeder(m, 'away');
    const res = [...(fh ? leaves(fh) : []), ...(fa ? leaves(fa) : [])];
    leavesMemo.set(m.id, res);
    return res;
  };

  const baseKey = rounds[0];
  const topKey = rounds[rounds.length - 1];

  // Base-round order = leaves in the order the tree visits them from the top.
  const baseOrder = canon[topKey].flatMap((m) => leaves(m));

  // Only trust the reconstruction when it covers every base match exactly once;
  // otherwise the linkage was incomplete — keep the authority's id order.
  const baseAll = canon[baseKey];
  const complete =
    baseOrder.length === baseAll.length &&
    new Set(baseOrder.map((m) => m.id)).size === baseAll.length;
  if (!complete) return { ...canon };

  const baseIndex = new Map<number, number>(baseOrder.map((m, i) => [m.id, i]));
  const firstLeaf = (m: Match): number => {
    const ls = leaves(m);
    return ls.length ? Math.min(...ls.map((l) => baseIndex.get(l.id) ?? 0)) : Number.MAX_SAFE_INTEGER;
  };

  const out = emptyRounds();
  for (const r of rounds) {
    out[r] =
      r === baseKey
        ? baseOrder
        : [...canon[r]].sort((a, b) => firstLeaf(a) - firstLeaf(b) || (a.id ?? 0) - (b.id ?? 0));
  }
  return out;
}

// ---------------------------------------------------------------------------
// SVG bracket connector between two adjacent rounds
// ---------------------------------------------------------------------------

function BracketConnector({
  fromRound,
  toRound,
  totalH,
}: {
  fromRound: RoundKey;
  toRound: RoundKey;
  totalH: number;
}) {
  const pairs = ROUND_MATCH_COUNT[toRound];

  const paths: string[] = [];
  for (let i = 0; i < pairs; i++) {
    const y1 = matchCenterY(fromRound, i * 2, totalH);
    const y2 = matchCenterY(fromRound, i * 2 + 1, totalH);
    const midY = (y1 + y2) / 2;
    paths.push(`M 0 ${y1} H ${CONN_W / 2} V ${midY}`);
    paths.push(`M 0 ${y2} H ${CONN_W / 2} V ${midY}`);
    paths.push(`M ${CONN_W / 2} ${midY} H ${CONN_W}`);
  }

  return (
    <svg width={CONN_W} height={totalH} className="shrink-0" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="#374151" strokeWidth="1.5" fill="none" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Public component — accepts raw knockout matches, no data fetching
//
// `startStage` selects the leftmost column so the same tree renders either the
// full R32→Final bracket (hub page) or the R16→Final tree (bracket page, where
// R32 is already shown separately above). The bracket height scales to the
// starting round's match count, keeping the tree compact and correctly paired.
// ---------------------------------------------------------------------------

export default function WCBracket({
  matches,
  startStage = 'LAST_32',
}: {
  matches: Match[];
  startStage?: RoundKey;
}) {
  const startIdx = ROUND_KEYS.indexOf(startStage);
  const rounds = ROUND_KEYS.slice(startIdx) as RoundKey[];
  const totalH = ROUND_MATCH_COUNT[startStage] * SLOT_H;

  // Canonical (authority id) order per round, then reorder by bracket geometry.
  const canon = emptyRounds();
  for (const key of rounds) {
    canon[key] = matches
      .filter((m) => m.stage === key)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }
  const byStage = orderRoundsByFeeders(canon, rounds);

  const thirdPlaceMatches = matches
    .filter((m) => m.stage === 'THIRD_PLACE')
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Column headers row */}
        <div className="flex">
          {rounds.map((key, ri) => (
            <div key={key} className="flex items-start">
              {ri > 0 && <div style={{ width: CONN_W + 8 }} />}
              <div className="text-center shrink-0" style={{ width: CARD_W }}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${key === 'FINAL' ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {ROUND_LABELS[key]}
                </span>
                <p className="text-gray-500 text-xs mt-0.5">
                  {ROUND_MATCH_COUNT[key]} match{ROUND_MATCH_COUNT[key] > 1 ? 'es' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bracket body */}
        <div className="flex mt-2">
          {rounds.map((key, ri) => (
            <div key={key} className="flex items-start">
              {ri > 0 && (
                <div className="mt-0" style={{ marginRight: 8 }}>
                  <BracketConnector fromRound={rounds[ri - 1]} toRound={key} totalH={totalH} />
                </div>
              )}
              <div className="shrink-0 relative" style={{ width: CARD_W, height: totalH }}>
                {byStage[key].length > 0
                  ? byStage[key].map((match, i) => (
                      <div
                        key={match.id}
                        className="absolute"
                        style={{ top: cardTop(key, i, totalH), left: 0, width: CARD_W }}
                      >
                        <MatchCard
                          variant="bracket"
                          match={match}
                          theme={key === 'FINAL' ? 'gold' : 'default'}
                        />
                      </div>
                    ))
                  : Array.from({ length: ROUND_MATCH_COUNT[key] }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute rounded-lg border border-gray-800 border-dashed bg-gray-900/30 flex items-center justify-center"
                        style={{ top: cardTop(key, i, totalH), left: 0, width: CARD_W, height: CARD_H }}
                      >
                        <span className="text-gray-500 text-xs">TBD</span>
                      </div>
                    ))}
              </div>
            </div>
          ))}
        </div>

        {/* Third Place playoff — standalone below the bracket, no connector */}
        <div className="mt-6 border-t border-gray-800 pt-4">
          <div className="mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Third Place</span>
            <p className="text-gray-500 text-xs mt-0.5">1 match</p>
          </div>
          <div style={{ width: CARD_W }}>
            {thirdPlaceMatches.length > 0
              ? thirdPlaceMatches.map((match) => (
                  <MatchCard variant="bracket" key={match.id} match={match} />
                ))
              : (
                  <div
                    className="rounded-lg border border-gray-800 border-dashed bg-gray-900/30 flex items-center justify-center"
                    style={{ width: CARD_W, height: CARD_H }}
                  >
                    <span className="text-gray-500 text-xs">TBD</span>
                  </div>
                )}
          </div>
        </div>
      </div>
    </div>
  );
}
