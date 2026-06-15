// In-process per-match telemetry for live score polling (LIVE-1 Phase 4).
// Metrics are accumulated in a Map keyed by matchId and exposed via
// /api/debug/live-telemetry. The store is in-process (not KV), so it
// resets on cold start — this is by design (diagnostic, not durable).

interface Entry {
  total: number;
  success: number;
  scoreChanges: number;
  latencies: number[];
  lastPollAt: number;
}

export interface LiveUpdateEntry {
  matchId: string;
  totalPolls: number;
  successPolls: number;
  scoreChanges: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  lastPollAt: string;
}

const _store = new Map<string, Entry>();
const MAX_LATENCY_HISTORY = 100;

export function recordLiveUpdate(matchId: string, latencyMs: number, scoreChanged: boolean): void {
  const e = _store.get(matchId) ?? { total: 0, success: 0, scoreChanges: 0, latencies: [], lastPollAt: 0 };
  e.total++;
  e.success++;
  if (scoreChanged) e.scoreChanges++;
  e.latencies.push(latencyMs);
  if (e.latencies.length > MAX_LATENCY_HISTORY) e.latencies.shift();
  e.lastPollAt = Date.now();
  _store.set(matchId, e);
}

export function getLiveTelemetry(): LiveUpdateEntry[] {
  return [..._store.entries()].map(([matchId, e]) => {
    const avg = e.latencies.length
      ? Math.round(e.latencies.reduce((a, b) => a + b, 0) / e.latencies.length)
      : 0;
    return {
      matchId,
      totalPolls: e.total,
      successPolls: e.success,
      scoreChanges: e.scoreChanges,
      lastLatencyMs: e.latencies.at(-1) ?? 0,
      avgLatencyMs: avg,
      maxLatencyMs: e.latencies.length ? Math.max(...e.latencies) : 0,
      lastPollAt: e.lastPollAt ? new Date(e.lastPollAt).toISOString() : '',
    };
  });
}
