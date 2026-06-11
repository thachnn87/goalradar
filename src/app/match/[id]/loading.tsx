/**
 * /match/[id] loading skeleton — PERF-8 Phase 1b.
 *
 * Renders instantly on navigation (before the RSC payload streams in), so a
 * click on a match card gives immediate visual feedback instead of a frozen
 * page. Mirrors the score-hero layout to minimise layout shift when the real
 * content replaces it.
 */

export default function MatchLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-pulse" aria-busy="true" aria-label="Loading match">
      {/* Breadcrumb */}
      <div className="h-4 w-64 bg-gray-800 rounded" />

      {/* Score hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
        <div className="h-3 w-40 bg-gray-800 rounded mx-auto mb-6" />
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 bg-gray-800 rounded-full" />
            <div className="h-4 w-24 bg-gray-800 rounded" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-20 bg-gray-800 rounded" />
            <div className="h-3 w-16 bg-gray-800 rounded" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 bg-gray-800 rounded-full" />
            <div className="h-4 w-24 bg-gray-800 rounded" />
          </div>
        </div>
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-48" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-48" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl h-64" />
    </div>
  );
}
