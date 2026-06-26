'use client';

import Link from 'next/link';

/**
 * Error boundary for the match detail route.
 *
 * Catches any unhandled server-component exception (e.g. null homeTeam/awayTeam
 * from the FD API for upcoming TBD knockout fixtures) and renders a friendly
 * card instead of the browser's native "This page couldn't load" screen.
 */
export default function MatchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
        <div className="text-4xl">⚽</div>
        <h1 className="text-white font-bold text-lg">Match Details Unavailable</h1>
        <p className="text-gray-400 text-sm">
          Match data could not be loaded — the teams may not yet be confirmed, or data is temporarily unavailable.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <button
            onClick={reset}
            className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors font-medium"
          >
            Try again
          </button>
          <Link href="/world-cup-2026/bracket" className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium">
            Knockout bracket
          </Link>
          <Link href="/world-cup-2026" className="text-sm text-gray-400 hover:text-white transition-colors">
            World Cup hub
          </Link>
        </div>
      </div>
    </div>
  );
}
