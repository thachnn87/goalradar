/**
 * LIVE-21 Phase 1: Distributed Tracing via AsyncLocalStorage
 *
 * Design:
 *   - traceId: generated at entry point, uniquely identifies one request
 *   - correlationId: identifies one match across its entire lifecycle
 *   - Feature-flagged: TRACING_ENABLED controls whether trace data is logged
 *   - AsyncLocalStorage keeps context isolated per async execution context
 *
 * Zero function signature changes: all intermediate functions read context
 * implicitly via traceContext.getStore() instead of receiving traceId parameter.
 *
 * Environment:
 *   TRACING_ENABLED=true|false (default: false)
 *   TRACING_SAMPLE_RATE=0.0-1.0 (default: 1.0 when enabled)
 */

import { AsyncLocalStorage } from 'async_hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceContext {
  traceId: string;
  correlationId: string;
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage setup
// ---------------------------------------------------------------------------

export const traceContext = new AsyncLocalStorage<TraceContext>();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TRACING_ENABLED = process.env.TRACING_ENABLED === 'true';
const TRACING_SAMPLE_RATE = parseFloat(process.env.TRACING_SAMPLE_RATE || '1.0');

export function isTracingEnabled(): boolean {
  if (!TRACING_ENABLED) return false;
  if (TRACING_SAMPLE_RATE >= 1.0) return true;
  return Math.random() < TRACING_SAMPLE_RATE;
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

function generateRandomSuffix(): string {
  // 6-char alphanumeric suffix for readability in logs
  return Math.random().toString(36).substring(2, 8);
}

export function generateTraceId(): string {
  // Format: req-{epochMs}-{random6} or cron-{epochMs}-{random6}
  const source = typeof window === 'undefined' ? 'req' : 'browser';
  const timestamp = Date.now().toString(36);
  const suffix = generateRandomSuffix();
  return `${source}-${timestamp}-${suffix}`;
}

export function generateCorrelationId(matchId: number, utcDate: string): string {
  // Format: match-{matchId}-{kickoffEpochSec}
  // kickoffEpochSec ensures season/year collisions don't cross
  const kickoffEpoch = Math.floor(new Date(utcDate).getTime() / 1000);
  return `match-${matchId}-${kickoffEpoch}`;
}

// ---------------------------------------------------------------------------
// Context management
// ---------------------------------------------------------------------------

export function runWithTrace<T>(
  traceId: string,
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return traceContext.run({ traceId, correlationId }, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return traceContext.getStore();
}

// ---------------------------------------------------------------------------
// Logging utilities
// ---------------------------------------------------------------------------

/**
 * Format a log message with trace/correlation ID suffix if tracing is enabled.
 * Usage:
 *   console.log(formatLog('[LIVE CACHE] set | live-matches | ttl=30s | count=1'))
 */
export function formatLog(message: string): string {
  const ctx = getTraceContext();
  if (!ctx) return message;

  // Append trace and correlation IDs to the message
  return `${message} | trace=${ctx.traceId} | corr=${ctx.correlationId}`;
}

/**
 * Alternative: log directly with context already included.
 * Usage:
 *   logWithTrace('[LIVE CACHE]', 'set | live-matches | ttl=30s | count=1')
 */
export function logWithTrace(layer: string, message: string): void {
  const ctx = getTraceContext();
  if (!ctx) {
    console.log(`${layer} ${message}`);
    return;
  }
  console.log(`${layer} ${message} | trace=${ctx.traceId} | corr=${ctx.correlationId}`);
}
