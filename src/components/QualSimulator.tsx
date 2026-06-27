'use client';

/**
 * QualSimulator — DATA-18WC.EXPERIENCE.V2
 *
 * Interactive client component. Fan picks hypothetical match outcomes for the
 * remaining group fixtures, and standings + qualification status update live.
 *
 * Architecture:
 *   - Receives initial StandingTable[] (from server component) as prop
 *   - Receives remaining matches (CanonicalMatch[]) as prop
 *   - On each toggle, applies applyScenarioResult() from wc-qualification.ts
 *     and re-runs calculateQualificationStatus() — pure, no fetch
 *   - Renders WCGroupTable with the scenario standings
 *
 * Rule check: ONE SOURCE (caller fetches; this reads props), NO new engine,
 * NO new route, NO new pipeline. Uses existing WCGroupTable.
 *
 * Data flow:
 *   Server component fetches standings + matches → passes as props here
 *   Client mutates copies with applyScenarioResult() → calculateQualificationStatus()
 *   WCGroupTable receives updated table + qual map
 */

import { useState, useCallback } from 'react';
import type { StandingTable } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
import {
  applyScenarioResult,
  calculateQualificationStatus,
  type QualificationStatus,
} from '@/lib/wc-qualification';
import WCGroupTable from '@/components/WCGroupTable';

// ---------------------------------------------------------------------------
// Outcome type for each match
// ---------------------------------------------------------------------------

type Outcome = 'HOME' | 'DRAW' | 'AWAY' | null;

// Score mapping for each outcome (approximation for qual engine)
const OUTCOME_SCORE: Record<Exclude<Outcome, null>, [number, number]> = {
  HOME: [1, 0],
  DRAW: [0, 0],
  AWAY: [0, 1],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyOutcomes(
  baseTable: StandingTable,
  matches: CanonicalMatch[],
  outcomes: Map<number, Outcome>,
): StandingTable {
  let table = baseTable;
  for (const m of matches) {
    const outcome = outcomes.get(m.id);
    if (!outcome) continue;
    if (!m.homeTeam?.id || !m.awayTeam?.id) continue;
    const [hg, ag] = OUTCOME_SCORE[outcome];
    table = applyScenarioResult(table, m.homeTeam.id, m.awayTeam.id, hg, ag);
  }
  return table;
}

// ---------------------------------------------------------------------------
// Match outcome toggle
// ---------------------------------------------------------------------------

function MatchOutcomeToggle({
  match,
  outcome,
  onChange,
}: {
  match:    CanonicalMatch;
  outcome:  Outcome;
  onChange: (id: number, out: Outcome) => void;
}) {
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';

  const btn = (label: string, val: Outcome) => (
    <button
      onClick={() => onChange(match.id, outcome === val ? null : val)}
      className={`
        px-2 py-1 rounded text-xs font-semibold border transition-colors
        ${outcome === val
          ? val === 'HOME' ? 'bg-green-500/20 border-green-500/50 text-green-400'
          : val === 'DRAW' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
          : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
          : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}
      `}
      aria-pressed={outcome === val}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-800/60 last:border-0">
      <span className="text-xs text-white font-medium flex-1 truncate text-right">{hn}</span>
      <div className="flex items-center gap-1 shrink-0">
        {btn(hn.slice(0, 3), 'HOME')}
        {btn('D', 'DRAW')}
        {btn(an.slice(0, 3), 'AWAY')}
      </div>
      <span className="text-xs text-white font-medium flex-1 truncate">{an}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function QualSimulator({
  baseTable,
  remainingMatches,
}: {
  /** The current StandingTable for this group (type === 'TOTAL') */
  baseTable:        StandingTable;
  /** Upcoming (SCHEDULED/TIMED) matches for this group — from authority:v1 */
  remainingMatches: CanonicalMatch[];
}) {
  const [outcomes, setOutcomes] = useState<Map<number, Outcome>>(new Map());
  const [open, setOpen]         = useState(false);

  const toggle = useCallback((id: number, out: Outcome) => {
    setOutcomes((prev) => {
      const next = new Map(prev);
      if (out === null) next.delete(id);
      else next.set(id, out);
      return next;
    });
  }, []);

  const reset = () => setOutcomes(new Map());

  // Apply scenario and derive qual map
  const scenarioTable = applyOutcomes(baseTable, remainingMatches, outcomes);
  const allTables     = [scenarioTable];
  const qualMap       = calculateQualificationStatus(allTables);

  const groupQual = new Map<number, QualificationStatus>();
  for (const [id, q] of qualMap) {
    groupQual.set(id, q.qualificationStatus);
  }

  const hasScenario = outcomes.size > 0;

  if (remainingMatches.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">Qualification Simulator</span>
          {hasScenario && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              SCENARIO
            </span>
          )}
        </div>
        <span className="text-gray-500 text-sm" aria-hidden="true">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800">
          {/* Scenario controls */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs text-gray-500 mb-3">
              Pick outcomes for remaining matches — standings and qualification update instantly.
            </p>
            {remainingMatches.map((m) => (
              <MatchOutcomeToggle
                key={m.id}
                match={m}
                outcome={outcomes.get(m.id) ?? null}
                onChange={toggle}
              />
            ))}
          </div>

          {/* Scenario standings */}
          <div className="border-t border-gray-800">
            <WCGroupTable
              group={baseTable.group ?? baseTable.stage}
              table={scenarioTable.table}
              qualifications={groupQual}
            />
          </div>

          {/* Legend + reset */}
          <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-800/60">
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />
                Advances
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />
                3rd-place race
              </span>
            </div>
            {hasScenario && (
              <button
                onClick={reset}
                className="text-[10px] text-gray-500 hover:text-white transition-colors font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
