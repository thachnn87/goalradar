/**
 * src/lib/providers/index.ts
 *
 * Public API for the multi-provider abstraction layer.
 *
 * Import the manager for data access:
 *   import { providerManager } from '@/lib/providers';
 *
 * Import types for typing:
 *   import type { MatchProvider, ProviderName } from '@/lib/providers';
 */

export { providerManager }                   from './manager';
export { FootballDataProvider }              from './football-data';
export { ApiFootballProvider }               from './api-football';
export type {
  MatchProvider,
  ProviderName,
  FailoverEvent,
  ProviderHealth,
  ProvidersDebugResponse,
}                                            from './types';
