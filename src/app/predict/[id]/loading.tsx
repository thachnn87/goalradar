/** /predict/[id] loading skeleton — PERF-8 Phase 1b (instant navigation feedback). */

export default function PredictLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-pulse" aria-busy="true" aria-label="Loading prediction">
      <div className="h-4 w-64 bg-gray-800 rounded" />
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
        <div className="h-3 w-48 bg-gray-800 rounded mx-auto mb-6" />
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 bg-gray-800 rounded-full" />
            <div className="h-4 w-24 bg-gray-800 rounded" />
          </div>
          <div className="h-8 w-16 bg-gray-800 rounded mx-auto" />
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 bg-gray-800 rounded-full" />
            <div className="h-4 w-24 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-40" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-40" />
      </div>
    </div>
  );
}
