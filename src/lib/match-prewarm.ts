/**
 * match-prewarm.ts — PERF-8 Phase 2 (client-side)
 *
 * Lightweight snapshot prewarm queue. Fired on hover / touchstart / viewport
 * entry of match links so the KV snapshot exists by the time the user clicks.
 *
 * Guarantees:
 *   - dedupe       — each match id is requested at most once per page load
 *   - debounce     — hover hints wait 80 ms before firing (cancelled on leave)
 *   - concurrency  — max 3 in-flight prewarm requests
 *   - KV only      — the endpoint has no provider path (see route handler)
 */

'use client';

const MAX_CONCURRENCY = 3;
const HOVER_DEBOUNCE_MS = 80;

const _done     = new Set<string>();   // requested (or queued) ids
const _queue: string[] = [];
let   _inflight = 0;

function pump(): void {
  while (_inflight < MAX_CONCURRENCY && _queue.length > 0) {
    const id = _queue.shift()!;
    _inflight++;
    fetch(`/api/prewarm/match/${id}`, { priority: 'low' } as RequestInit)
      .catch(() => undefined)
      .finally(() => {
        _inflight--;
        pump();
      });
  }
}

/** Queue a prewarm for a match id (deduped, concurrency-limited). */
export function prewarmMatch(id: number | string): void {
  if (typeof window === 'undefined') return;
  const key = String(id);
  if (!/^\d+$/.test(key) || _done.has(key)) return;
  _done.add(key);
  _queue.push(key);
  pump();
}

/** Debounced hover hint — returns a cancel function for mouseleave. */
export function prewarmMatchOnHover(id: number | string): () => void {
  const timer = setTimeout(() => prewarmMatch(id), HOVER_DEBOUNCE_MS);
  return () => clearTimeout(timer);
}

/** Queue several ids when the browser is idle (viewport / list seeding). */
export function prewarmMatchesOnIdle(ids: Array<number | string>, limit = 10): void {
  if (typeof window === 'undefined') return;
  const fire = () => ids.slice(0, limit).forEach(prewarmMatch);
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback(fire, { timeout: 2_000 });
  } else {
    setTimeout(fire, 350);
  }
}
