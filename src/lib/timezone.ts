/**
 * Timezone utilities for GoalRadar.
 *
 * All functions are SSR-safe: they work on both server (Node.js) and client.
 * Client-only browser APIs (localStorage, Intl auto-detect) are wrapped in
 * `typeof window !== 'undefined'` guards so they never throw during SSR.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TIMEZONE_STORAGE_KEY = 'goalradar-timezone';

export interface TimezoneOption {
  value: string; // IANA tz string or 'auto'
  label: string; // Human-readable label shown in selector
}

/** Ordered list of timezone choices presented to the user. */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'auto',                label: 'Auto Detect'              },
  { value: 'UTC',                 label: 'UTC (GMT+0)'              },
  { value: 'Asia/Jakarta',        label: 'Asia/Jakarta (GMT+7)'     },
  { value: 'Asia/Bangkok',        label: 'Asia/Bangkok (GMT+7)'     },
  { value: 'Asia/Ho_Chi_Minh',    label: 'Asia/Ho Chi Minh (GMT+7)' },
  { value: 'Europe/London',       label: 'Europe/London'            },
  { value: 'America/New_York',    label: 'America/New York (ET)'    },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PT)' },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Returns the browser's detected IANA timezone string (e.g. "Asia/Bangkok").
 * Returns 'UTC' on the server or when detection is unavailable.
 */
export function getUserTimezone(): string {
  if (typeof window === 'undefined') return 'UTC';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Resolves a user-selected timezone setting into a concrete IANA timezone string.
 * The special value 'auto' triggers browser detection (or 'UTC' on the server).
 */
export function resolveTimezone(tz: string): string {
  if (!tz || tz === 'auto') return getUserTimezone();
  return tz;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export interface FormatMatchTimeOptions {
  /** Include the date alongside the time (e.g. "19:00 · 11 Jun"). Default false. */
  includeDate?: boolean;
  /** Use 12-hour clock (e.g. "07:00 PM"). Default false (24h). */
  hour12?: boolean;
}

/**
 * Formats a UTC ISO date string as a time string in the given timezone.
 *
 * @param utcDate  ISO 8601 date string (e.g. "2026-06-11T19:00:00Z")
 * @param timezone IANA timezone string or 'auto'
 * @param opts     Formatting options
 * @returns        Time string, e.g. "19:00" or "02:00 AM"
 */
export function formatMatchTime(
  utcDate: string,
  timezone: string,
  opts: FormatMatchTimeOptions = {},
): string {
  const resolved = resolveTimezone(timezone);
  const date = new Date(utcDate);

  if (isNaN(date.getTime())) return '–';

  const safeTimezone = resolved || 'UTC';

  try {
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: safeTimezone,
      hour12: opts.hour12 ?? false,
    });

    if (opts.includeDate) {
      const dateStr = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: safeTimezone,
      });
      return `${timeStr} · ${dateStr}`;
    }

    return timeStr;
  } catch {
    // Fallback to UTC when the timezone string is invalid
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }
}

// ---------------------------------------------------------------------------
// Offset / label helpers
// ---------------------------------------------------------------------------

/**
 * Returns the GMT offset string for a timezone at a fixed reference date.
 * E.g. "GMT+7", "GMT-5", "GMT+0"
 *
 * Uses `Intl.DateTimeFormat` with `timeZoneName: 'shortOffset'` which is
 * supported in Node 18+ (used by Next.js 15/16).
 */
export function getGMTOffset(timezone: string): string {
  const resolved = resolveTimezone(timezone);
  if (!resolved || resolved === 'UTC') return 'GMT+0';

  try {
    // Use a fixed summer date to get a stable offset (avoids DST ambiguity)
    const date = new Date('2026-06-15T12:00:00Z');
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: resolved,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    if (offsetPart) {
      // Normalise: some engines emit "UTC+7", others "GMT+7"
      return offsetPart.value.replace(/^UTC/, 'GMT');
    }
    return 'GMT';
  } catch {
    return 'GMT';
  }
}

/**
 * Returns a display label for a timezone setting.
 * E.g. "Asia/Bangkok (GMT+7)" or "UTC (GMT+0)"
 */
export function getTimezoneLabel(timezone: string): string {
  const resolved = resolveTimezone(timezone);

  // Return the label from the static options list when available
  const option = TIMEZONE_OPTIONS.find(
    (o) => o.value !== 'auto' && o.value === (timezone === 'auto' ? resolved : timezone),
  );
  if (option) return option.label;

  // Otherwise, build one from the resolved tz + offset
  const offset = getGMTOffset(resolved);
  return `${resolved} (${offset})`;
}

// ---------------------------------------------------------------------------
// localStorage persistence (client-only, no-ops on server)
// ---------------------------------------------------------------------------

/** Reads the stored timezone preference. Returns null on server or if unset. */
export function readStoredTimezone(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TIMEZONE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persists a timezone preference. No-op on the server. */
export function writeStoredTimezone(tz: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
  } catch {
    // Ignore quota / security errors
  }
}
