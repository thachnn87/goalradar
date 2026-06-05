import Link from 'next/link';
import type { Match } from '@/lib/types';

// ---------------------------------------------------------------------------
// Layout constants  (all in px, used for both HTML and inline SVG)
// ---------------------------------------------------------------------------
const SLOT_H = 88;   // height of one R16 slot — 8 slots = total bracket height
const CARD_W = 168;  // width of each match card
const CARD_H = 68;   // height of each match card
const CONN_W = 36;   // width of the SVG connector strip between columns

const NUM_R16_SLOTS = 8;
const TOTAL_H = NUM_R16_SLOTS * SLOT_H; // 704 px

// How many R16 slots each round's match occupies
const SLOTS_PER_MATCH: Record<string, number> = {
  LAST_16: 1,
  QUARTER_FINALS: 2,
  SEMI_FINALS: 4,
  FINAL: 8,
};

const ROUND_KEYS = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'] as const;
type RoundKey = (typeof ROUND_KEYS)[number];

const ROUND_LABELS: Record<RoundKey, string> = {
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  FINAL: 'Final',
};

const ROUND_MATCH_COUNT: Record<RoundKey, number> = {
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  FINAL: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Vertical center (px) for the i-th match in the given round. */
function matchCenterY(roundKey: RoundKey, matchIndex: number): number {
  const slotsPerMatch = SLOTS_PER_MATCH[roundKey];
  return (matchIndex * slotsPerMatch + slotsPerMatch / 2) * SLOT_H;
}

/** Top offset so the card is vertically centred in its slots. */
function cardTop(roundKey: RoundKey, matchIndex: number): number {
  return matchCenterY(roundKey, matchIndex) - CARD_H / 2;
}

function formatDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Match card — compact, fixed-size
// ---------------------------------------------------------------------------

function BracketMatchCard({ match, isFinal = false }: { match: Match; isFinal?: boolean }) {
  const { score, status } = match;
  const showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);
  const isLive = status === 'IN_PLAY' || status === 'PAUSED';

  const hn = match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.name || 'TBD';
  const hShort = match.homeTeam?.shortName || hn;
  const aShort = match.awayTeam?.shortName || an;
  const hWins = score.winner === 'HOME_TEAM';
  const aWins = score.winner === 'AWAY_TEAM';
  const isTbd = !match.homeTeam?.name && !match.awayTeam?.name;

  return (
    <Link
      href={`/match/${match.id}`}
      style={{ width: CARD_W, height: CARD_H }}
      className={`
        flex flex-col justify-between rounded-lg border transition-all overflow-hidden
        ${isFinal
          ? 'bg-gradient-to-br from-yellow-950/60 to-gray-900 border-yellow-700/40 hover:border-yellow-600/60'
          : 'bg-gray-900 border-gray-700 hover:border-gray-500'}
        ${isLive ? 'border-red-500/60' : ''}
      `}
    >
      {/* Home team */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 ${hWins ? 'bg-gray-800/60' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {match.homeTeam?.crest && !isTbd && (
            <img src={match.homeTeam.crest} alt="" width={14} height={14} className="object-contain shrink-0" />
          )}
          <span className={`text-xs truncate font-medium ${isTbd ? 'text-gray-600 italic' : hWins ? 'text-white font-bold' : 'text-gray-300'}`}>
            {isTbd ? 'TBD' : hShort}
          </span>
        </div>
        <span className={`text-xs font-bold tabular-nums ml-1 ${hWins ? 'text-white' : 'text-gray-500'}`}>
          {showScore ? (score.fullTime.home ?? 0) : '–'}
        </span>
      </div>

      {/* Divider + date */}
      <div className="flex items-center px-2.5">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-gray-600 text-[10px] px-1.5">
          {isLive ? (
            <span className="text-red-400 font-bold">LIVE</span>
          ) : status === 'FINISHED' ? (
            'FT'
          ) : (
            formatDate(match.utcDate)
          )}
        </span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* Away team */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 ${aWins ? 'bg-gray-800/60' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {match.awayTeam?.crest && !isTbd && (
            <img src={match.awayTeam.crest} alt="" width={14} height={14} className="object-contain shrink-0" />
          )}
          <span className={`text-xs truncate font-medium ${isTbd ? 'text-gray-600 italic' : aWins ? 'text-white font-bold' : 'text-gray-300'}`}>
            {isTbd ? 'TBD' : aShort}
          </span>
        </div>
        <span className={`text-xs font-bold tabular-nums ml-1 ${aWins ? 'text-white' : 'text-gray-500'}`}>
          {showScore ? (score.fullTime.away ?? 0) : '–'}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SVG bracket connector between two adjacent rounds
// ---------------------------------------------------------------------------

function BracketConnector({ fromRound, toRound }: { fromRound: RoundKey; toRound: RoundKey }) {
  const fromCount = ROUND_MATCH_COUNT[fromRound];
  const toCount = ROUND_MATCH_COUNT[toRound];
  const pairs = toCount; // each pair of "from" matches feeds one "to" match

  const paths: string[] = [];

  for (let i = 0; i < pairs; i++) {
    const y1 = matchCenterY(fromRound, i * 2);     // top source match center
    const y2 = matchCenterY(fromRound, i * 2 + 1); // bottom source match center
    const midY = (y1 + y2) / 2;                     // = target match center

    // Top branch: right → mid-x → down to midY
    paths.push(`M 0 ${y1} H ${CONN_W / 2} V ${midY}`);
    // Bottom branch: right → mid-x → up to midY
    paths.push(`M 0 ${y2} H ${CONN_W / 2} V ${midY}`);
    // Horizontal to target column
    paths.push(`M ${CONN_W / 2} ${midY} H ${CONN_W}`);
  }

  // Suppress unused warning (fromCount is used implicitly via math above)
  void fromCount;

  return (
    <svg
      width={CONN_W}
      height={TOTAL_H}
      className="shrink-0"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="#374151" strokeWidth="1.5" fill="none" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// A single round column
// ---------------------------------------------------------------------------

function BracketColumn({
  roundKey,
  matches,
}: {
  roundKey: RoundKey;
  matches: Match[];
}) {
  const isFinal = roundKey === 'FINAL';
  const expectedCount = ROUND_MATCH_COUNT[roundKey];
  const label = ROUND_LABELS[roundKey];

  return (
    <div className="shrink-0" style={{ width: CARD_W }}>
      {/* Column header */}
      <div
        className="text-center mb-2"
        style={{ height: 32 }}
      >
        <span className={`text-xs font-semibold uppercase tracking-wider ${isFinal ? 'text-yellow-400' : 'text-gray-400'}`}>
          {label}
        </span>
        <p className="text-gray-600 text-[10px] mt-0.5">{expectedCount} match{expectedCount > 1 ? 'es' : ''}</p>
      </div>

      {/* Match cards — absolutely positioned within a fixed-height container */}
      <div className="relative" style={{ height: TOTAL_H }}>
        {matches.map((match, i) => (
          <div
            key={match.id}
            className="absolute"
            style={{ top: cardTop(roundKey, i), left: 0, width: CARD_W }}
          >
            <BracketMatchCard match={match} isFinal={isFinal} />
          </div>
        ))}

        {/* Placeholder slots if no data yet */}
        {matches.length === 0 &&
          Array.from({ length: expectedCount }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-lg border border-gray-800 border-dashed bg-gray-900/30 flex items-center justify-center"
              style={{ top: cardTop(roundKey, i), left: 0, width: CARD_W, height: CARD_H }}
            >
              <span className="text-gray-700 text-xs">TBD</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — accepts raw knockout matches, no data fetching
// ---------------------------------------------------------------------------

export default function WCBracket({ matches }: { matches: Match[] }) {
  // Bucket matches by stage
  const byStage = ROUND_KEYS.reduce<Record<RoundKey, Match[]>>(
    (acc, key) => {
      acc[key] = matches
        .filter((m) => m.stage === key)
        .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
      return acc;
    },
    { LAST_16: [], QUARTER_FINALS: [], SEMI_FINALS: [], FINAL: [] }
  );

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Column headers row */}
        <div className="flex" style={{ paddingLeft: 0 }}>
          {ROUND_KEYS.map((key, ri) => (
            <div key={key} className="flex items-start">
              {/* Spacer for connector (not before first column) */}
              {ri > 0 && <div style={{ width: CONN_W + 8 }} />}

              {/* Header */}
              <div className="text-center shrink-0" style={{ width: CARD_W }}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${key === 'FINAL' ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {ROUND_LABELS[key]}
                </span>
                <p className="text-gray-600 text-[10px] mt-0.5">
                  {ROUND_MATCH_COUNT[key]} match{ROUND_MATCH_COUNT[key] > 1 ? 'es' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bracket body */}
        <div className="flex mt-2">
          {ROUND_KEYS.map((key, ri) => {
            const nextKey = ROUND_KEYS[ri + 1] as RoundKey | undefined;
            return (
              <div key={key} className="flex items-start">
                {/* Connector from previous round */}
                {ri > 0 && (
                  <div className="mt-0" style={{ marginRight: 8 }}>
                    <BracketConnector
                      fromRound={ROUND_KEYS[ri - 1]}
                      toRound={key}
                    />
                  </div>
                )}

                {/* Match cards column */}
                <div className="shrink-0 relative" style={{ width: CARD_W, height: TOTAL_H }}>
                  {byStage[key].length > 0
                    ? byStage[key].map((match, i) => (
                        <div
                          key={match.id}
                          className="absolute"
                          style={{ top: cardTop(key, i), left: 0, width: CARD_W }}
                        >
                          <BracketMatchCard match={match} isFinal={key === 'FINAL'} />
                        </div>
                      ))
                    : Array.from({ length: ROUND_MATCH_COUNT[key] }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute rounded-lg border border-gray-800 border-dashed bg-gray-900/30 flex items-center justify-center"
                          style={{ top: cardTop(key, i), left: 0, width: CARD_W, height: CARD_H }}
                        >
                          <span className="text-gray-700 text-xs">TBD</span>
                        </div>
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
