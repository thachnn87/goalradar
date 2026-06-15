/**
 * ISR on-demand revalidation helpers — DATA-9
 *
 * Authority location for all WC path revalidation.
 * Import and call from Route Handlers or Server Actions only —
 * revalidatePath() is a no-op outside of a server request context.
 */

import { revalidatePath } from 'next/cache';
import { kv } from '@vercel/kv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevalidationRecord {
  timestamp:   string;
  source:      'orchestrator' | 'api' | 'manual';
  paths:       string[];
  revalidated: number;
  success:     boolean;
  error?:      string;
  triggeredBy?: string;
}

// ---------------------------------------------------------------------------
// Path lists
// ---------------------------------------------------------------------------

/** All WC pages that depend on live API data (standings, fixtures, results). */
export const WC_DATA_PATHS: string[] = [
  // Hub & navigation
  '/world-cup-2026',
  '/world-cup-2026/groups',
  '/world-cup-2026/teams',
  '/world-cup-2026/matches',
  '/world-cup-2026/fixtures',
  // Programmatic SEO pages
  '/world-cup-2026-standings',
  '/world-cup-2026-groups',
  '/world-cup-2026-schedule',
  '/world-cup-2026-results',
  // Dynamic pages — bracket notation revalidates all instances
  '/world-cup-2026/[group]',       // group-a through group-l
  '/world-cup-2026/teams/[slug]',  // all 48 team pages
];

/** Pages that only need revalidation when group standings change. */
export const WC_STANDINGS_PATHS: string[] = [
  '/world-cup-2026/[group]',
  '/world-cup-2026/groups',
  '/world-cup-2026-standings',
  '/world-cup-2026-groups',
];

/** Pages that only need revalidation when fixtures/schedule change. */
export const WC_FIXTURES_PATHS: string[] = [
  '/world-cup-2026-schedule',
  '/world-cup-2026-results',
  '/world-cup-2026/matches',
  '/world-cup-2026/fixtures',
  '/world-cup-2026/teams/[slug]',
];

// ---------------------------------------------------------------------------
// KV
// ---------------------------------------------------------------------------

const REVALIDATION_RECORD_KEY = 'goalradar:revalidation:last-run';

export async function saveRevalidationRecord(record: RevalidationRecord): Promise<void> {
  try {
    await kv.set(REVALIDATION_RECORD_KEY, JSON.stringify(record), { ex: 86_400 });
  } catch {
    // Non-fatal — KV write failure must not break revalidation
  }
}

export async function loadRevalidationRecord(): Promise<RevalidationRecord | null> {
  try {
    const raw = await kv.get<string>(REVALIDATION_RECORD_KEY);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as RevalidationRecord);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Revalidation helpers
// ---------------------------------------------------------------------------

/**
 * Revalidate all WC data-driven pages.
 * Call after any successful standings or fixtures KV refresh.
 */
export async function revalidateWCPaths(
  source: RevalidationRecord['source'] = 'orchestrator',
  triggeredBy?: string,
): Promise<RevalidationRecord> {
  const record: RevalidationRecord = {
    timestamp:   new Date().toISOString(),
    source,
    paths:       WC_DATA_PATHS,
    revalidated: 0,
    success:     false,
    triggeredBy,
  };

  try {
    for (const p of WC_DATA_PATHS) {
      revalidatePath(p, 'page');
    }
    record.revalidated = WC_DATA_PATHS.length;
    record.success = true;
    console.log(`[ISR] revalidateWCPaths | source=${source} | paths=${WC_DATA_PATHS.length}`);
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    console.error('[ISR] revalidateWCPaths failed:', record.error);
  }

  await saveRevalidationRecord(record);
  return record;
}

/**
 * Revalidate a single team page.
 * Use after a team-specific data change (e.g. squad update).
 */
export async function revalidateTeamPage(
  slug: string,
  source: RevalidationRecord['source'] = 'api',
): Promise<RevalidationRecord> {
  const path = `/world-cup-2026/teams/${slug}`;
  const record: RevalidationRecord = {
    timestamp:   new Date().toISOString(),
    source,
    paths:       [path],
    revalidated: 0,
    success:     false,
  };

  try {
    revalidatePath(path, 'page');
    record.revalidated = 1;
    record.success = true;
    console.log(`[ISR] revalidateTeamPage | slug=${slug}`);
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
  }

  await saveRevalidationRecord(record);
  return record;
}

/**
 * Revalidate a single group page.
 * Use after a group-specific standings update.
 */
export async function revalidateGroupPage(
  group: string,
  source: RevalidationRecord['source'] = 'api',
): Promise<RevalidationRecord> {
  const path = `/world-cup-2026/group-${group.toLowerCase()}`;
  const record: RevalidationRecord = {
    timestamp:   new Date().toISOString(),
    source,
    paths:       [path],
    revalidated: 0,
    success:     false,
  };

  try {
    revalidatePath(path, 'page');
    record.revalidated = 1;
    record.success = true;
    console.log(`[ISR] revalidateGroupPage | group=${group}`);
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
  }

  await saveRevalidationRecord(record);
  return record;
}

/**
 * Revalidate an explicit list of paths.
 * Used by /api/revalidate for manual or scripted triggers.
 */
export async function revalidatePaths(
  paths: string[],
  source: RevalidationRecord['source'] = 'api',
  triggeredBy?: string,
): Promise<RevalidationRecord> {
  const record: RevalidationRecord = {
    timestamp:   new Date().toISOString(),
    source,
    paths,
    revalidated: 0,
    success:     false,
    triggeredBy,
  };

  try {
    for (const p of paths) {
      revalidatePath(p, 'page');
    }
    record.revalidated = paths.length;
    record.success = true;
    console.log(`[ISR] revalidatePaths | source=${source} | paths=${paths.length}`);
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
  }

  await saveRevalidationRecord(record);
  return record;
}
