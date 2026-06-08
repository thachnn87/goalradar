/**
 * src/lib/errors.ts
 *
 * Shared error types for the API and provider layers.
 *
 * Kept in a separate module to avoid circular imports:
 *   api.ts imports providerManager (providers/manager.ts)
 *   providers/* import these error types
 *   → both can safely import from this file without creating a cycle.
 */

export class NotFoundError extends Error {
  constructor() { super('Not found'); this.name = 'NotFoundError'; }
}

export class ApiUnavailableError extends Error {
  constructor(public readonly reason: 'http' | 'timeout' | 'rate_limit' | 'disabled' | 'unknown' = 'unknown') {
    super('Data temporarily unavailable');
    this.name = 'ApiUnavailableError';
  }
}
