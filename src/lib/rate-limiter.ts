/**
 * src/lib/rate-limiter.ts
 *
 * Token-bucket rate limiter for football-data.org.
 *
 * football-data.org free plan: 10 requests / minute.
 * We enforce 1 request every 7 seconds (≈8.5 req/min) — leaving headroom
 * for burst variance and retry overhead, and never touching the 10 req/min
 * hard cap that triggered the manual account suspension.
 *
 * Design
 * ──────
 * All callers `await footballDataLimiter.acquire()` before their HTTP fetch.
 * A single async drain loop serialises every request through a FIFO queue,
 * spacing releases by INTERVAL_MS. The fetch itself runs *after* acquire()
 * returns — the limiter controls dispatch time, not completion time, so
 * slow responses don't starve the queue.
 *
 * Usage
 * ─────
 *   import { footballDataLimiter } from '@/lib/rate-limiter';
 *   await footballDataLimiter.acquire();          // blocks until slot available
 *   const res = await fetch(url, { ... });
 *
 * Logs
 * ────
 *   [RATE_LIMITER] throttling Nms | queue=N    — draining a queued slot
 *   [RATE_LIMITER] dispatching | queue=N remaining | rpm=N
 *   [QUEUE] football-data | depth=N | waiting for slot  — new waiter logged once
 */

const INTERVAL_MS = 7_000; // 1 request per 7 s  ≈ 8.5 req/min (cap = 10/min)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------

class RateLimiter {
  private readonly intervalMs: number;
  /** Epoch ms of the last dispatched request. 0 = never dispatched. */
  private lastDispatchAt = 0;
  /** Pending acquire() resolvers, in arrival order. */
  private readonly queue: Array<() => void> = [];
  /** Whether the drain loop is currently running. */
  private draining = false;
  /** Rolling window of dispatch timestamps for RPM telemetry. */
  private readonly recentMs: number[] = [];

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Acquire a send slot.  Resolves when it is safe to dispatch the next
   * request without violating the rate limit.
   *
   * Callers MUST await this before every HTTP attempt (including retries).
   */
  acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      const depth = this.queue.length;
      if (depth > 0) {
        // Only log when the caller will actually have to wait, not on first
        // enqueue when the queue is otherwise empty.
        console.log(
          `[QUEUE] football-data | depth=${depth + 1} | waiting for slot`,
        );
      }
      this.queue.push(resolve);
      if (!this.draining) void this.drain();
    });
  }

  /**
   * Snapshot for /api/debug/rate-limiter.
   * Safe to call at any time — pure read, no side effects.
   */
  getSnapshot(): {
    queuedRequests:    number;
    lastRequestAt:     string | null;
    requestsLastMinute: number;
    intervalMs:        number;
  } {
    const now    = Date.now();
    const cutoff = now - 60_000;
    const rpm    = this.recentMs.filter((t) => t > cutoff).length;
    return {
      queuedRequests:     this.queue.length,
      lastRequestAt:      this.lastDispatchAt > 0
                            ? new Date(this.lastDispatchAt).toISOString()
                            : null,
      requestsLastMinute: rpm,
      intervalMs:         this.intervalMs,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async drain(): Promise<void> {
    this.draining = true;

    while (this.queue.length > 0) {
      const now     = Date.now();
      const elapsed = now - this.lastDispatchAt;
      const waitMs  = Math.max(0, this.intervalMs - elapsed);

      if (waitMs > 0) {
        console.log(
          `[RATE_LIMITER] throttling ${waitMs}ms | queue=${this.queue.length}`,
        );
        await sleep(waitMs);
      }

      const resolve = this.queue.shift();
      if (!resolve) continue; // defensive; shouldn't happen

      this.lastDispatchAt = Date.now();

      // Update rolling window (prune entries older than 60 s)
      const cutoff = this.lastDispatchAt - 60_000;
      let   lo     = 0;
      while (lo < this.recentMs.length && this.recentMs[lo] < cutoff) lo++;
      if (lo > 0) this.recentMs.splice(0, lo);
      this.recentMs.push(this.lastDispatchAt);

      const rpm = this.recentMs.length;
      console.log(
        `[RATE_LIMITER] dispatching | queue=${this.queue.length} remaining | rpm=${rpm}`,
      );

      resolve(); // unblock the caller — they now execute their fetch()
    }

    this.draining = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton — one limiter per process, shared across all providerManager calls
// ---------------------------------------------------------------------------

export const footballDataLimiter = new RateLimiter(INTERVAL_MS);
