import type { Match } from '@/lib/types';
import MatchCard from '@/components/MatchCard';

// ---------------------------------------------------------------------------
// Layout constants  (all in px, used for both HTML and inline SVG)
// ---------------------------------------------------------------------------
const SLOT_H = 88;   // height of one R16 slot — 8 slots = total bracket height
const CARD_W = 168;  // width of each match card
const CARD_H = 68;   // height of each match card
const CONN_W = 36;   // width of the SVG connector strip between columns

const NUM_L32_SLOTS = 16;
const TOTAL_H = NUM_L32_SLOTS * SLOT_H; // 1408 px

const SLOTS_PER_MATCH: Record<string, number> = {
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 8,
  FINAL: 16,
};

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchCenterY(roundKey: RoundKey, matchIndex: number): number {
  const slotsPerMatch = SLOTS_PER_MATCH[roundKey];
  return (matchIndex * slotsPerMatch + slotsPerMatch / 2) * SLOT_H;
}

function cardTop(roundKey: RoundKey, matchIndex: number): number {
  return matchCenterY(roundKey, matchIndex) - CARD_H / 2;
}

// ---------------------------------------------------------------------------
// SVG bracket connector between two adjacent rounds
// ---------------------------------------------------------------------------

function BracketConnector({ fromRound, toRound }: { fromRound: RoundKey; toRound: RoundKey }) {
  const fromCount = ROUND_MATCH_COUNT[fromRound];
  const toCount = ROUND_MATCH_COUNT[toRound];
  const pairs = toCount;

  const paths: string[] = [];
  for (let i = 0; i < pairs; i++) {
    const y1 = matchCenterY(fromRound, i * 2);
    const y2 = matchCenterY(fromRound, i * 2 + 1);
    const midY = (y1 + y2) / 2;
    paths.push(`M 0 ${y1} H ${CONN_W / 2} V ${midY}`);
    paths.push(`M 0 ${y2} H ${CONN_W / 2} V ${midY}`);
    paths.push(`M ${CONN_W / 2} ${midY} H ${CONN_W}`);
  }

  void fromCount;

  return (
    <svg width={CONN_W} height={TOTAL_H} className="shrink-0" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="#374151" strokeWidth="1.5" fill="none" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Public component — accepts raw knockout matches, no data fetching
// ---------------------------------------------------------------------------

export default function WCBracket({ matches }: { matches: Match[] }) {
  const byStage = ROUND_KEYS.reduce<Record<RoundKey, Match[]>>(
    (acc, key) => {
      acc[key] = matches
        .filter((m) => m.stage === key)
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
      return acc;
    },
    { LAST_32: [], LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINAL: [] }
  );

  const thirdPlaceMatches = matches
    .filter((m) => m.stage === 'THIRD_PLACE')
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Column headers row */}
        <div className="flex">
          {ROUND_KEYS.map((key, ri) => (
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
          {ROUND_KEYS.map((key, ri) => (
            <div key={key} className="flex items-start">
              {ri > 0 && (
                <div className="mt-0" style={{ marginRight: 8 }}>
                  <BracketConnector fromRound={ROUND_KEYS[ri - 1]} toRound={key} />
                </div>
              )}
              <div className="shrink-0 relative" style={{ width: CARD_W, height: TOTAL_H }}>
                {byStage[key].length > 0
                  ? byStage[key].map((match, i) => (
                      <div
                        key={match.id}
                        className="absolute"
                        style={{ top: cardTop(key, i), left: 0, width: CARD_W }}
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
                        style={{ top: cardTop(key, i), left: 0, width: CARD_W, height: CARD_H }}
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
