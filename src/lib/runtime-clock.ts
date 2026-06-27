/**
 * runtime-clock.ts
 * DATA-18WC.RUNTIME.TRUTH — Phase 4: ONE CLOCK
 *
 * Single source of truth for all user-controlled poll intervals.
 * Import from here — never define local interval constants.
 *
 * Note: ISR interval (revalidate=60) and KV TTLs are framework/infra concerns
 * that cannot be controlled from application code. Those are documented in
 * CLOCK_GRAPH.md but not configurable here.
 */

/** Polling interval (seconds) for all client-side live score pollers */
export const RUNTIME_POLL_INTERVAL = 30;

/**
 * KV live-cache TTL (seconds) — documented here for visibility.
 * Actual enforcement is in src/lib/live-cache.ts (KV_LIVE_TTL).
 * Both must stay aligned with RUNTIME_POLL_INTERVAL.
 */
export const RUNTIME_KV_LIVE_TTL = 30;

/**
 * Match page ISR interval (seconds) — documented here for visibility.
 * Actual enforcement is: export const revalidate = 60 in match page.
 * This is longer than RUNTIME_POLL_INTERVAL by design: polling provides
 * faster score updates; ISR provides fresh events + story.
 */
export const RUNTIME_ISR_INTERVAL = 60;
