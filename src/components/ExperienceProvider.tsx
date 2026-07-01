'use client';

/**
 * ExperienceProvider.tsx — ONE EXPERIENCE CONTEXT
 *
 * Wraps the ExperienceViewModel (server-computed) in a React context.
 * All Experience Layer modules read data via useExperience() — never
 * by importing from experience-vm.ts directly in a client component.
 *
 * Also owns the global hover/highlight state for the Interactive Bracket:
 *   - Hover by team name  → highlights all matches in that team's path
 *   - Hover by match ID   → highlights the match + its ancestors + descendants
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { ExperienceViewModel } from '@/lib/experience-vm';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface HoverState {
  teamName: string | null;
  matchId: number | null;
}

export interface ExperienceContextValue {
  vm: ExperienceViewModel;
  hover: HoverState;
  setHover: (update: Partial<HoverState> | null) => void;
  /** Set of match IDs that should be highlighted given current hover state */
  highlightedMatchIds: ReadonlySet<number>;
  /** true if matchId should be highlighted */
  isHighlighted: (matchId: number) => boolean;
  /** true if something is hovered AND this match is NOT in the highlighted set */
  isDimmed: (matchId: number) => boolean;
}

// ---------------------------------------------------------------
// Context
// ---------------------------------------------------------------

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

// ---------------------------------------------------------------
// Provider
// ---------------------------------------------------------------

export function ExperienceProvider({
  vm,
  children,
}: {
  vm: ExperienceViewModel;
  children: ReactNode;
}) {
  const [hover, setHoverState] = useState<HoverState>({
    teamName: null,
    matchId: null,
  });

  const setHover = (update: Partial<HoverState> | null) => {
    if (!update) {
      setHoverState({ teamName: null, matchId: null });
      return;
    }
    setHoverState(prev => ({ ...prev, ...update }));
  };

  const highlightedMatchIds = useMemo((): ReadonlySet<number> => {
    if (hover.teamName) {
      return new Set(vm.bracket.teamPaths[hover.teamName] ?? []);
    }
    if (hover.matchId !== null) {
      return new Set([
        hover.matchId,
        ...(vm.bracket.matchAncestors[hover.matchId] ?? []),
        ...(vm.bracket.matchDescendants[hover.matchId] ?? []),
      ]);
    }
    return new Set<number>();
  }, [hover, vm.bracket]);

  const hasHover = hover.teamName !== null || hover.matchId !== null;
  const isHighlighted = (id: number) => highlightedMatchIds.has(id);
  const isDimmed = (id: number) => hasHover && !highlightedMatchIds.has(id);

  return (
    <ExperienceContext.Provider
      value={{ vm, hover, setHover, highlightedMatchIds, isHighlighted, isDimmed }}
    >
      {children}
    </ExperienceContext.Provider>
  );
}

// ---------------------------------------------------------------
// Hook
// ---------------------------------------------------------------

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error('useExperience() must be called inside <ExperienceProvider>');
  }
  return ctx;
}
