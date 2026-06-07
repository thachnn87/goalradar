/**
 * Unit tests for src/lib/timezone.ts
 *
 * These tests run in Node.js (jest + ts-jest, testEnvironment: 'node').
 * All functions must be SSR-safe — no browser APIs are available here.
 */

import {
  getUserTimezone,
  resolveTimezone,
  formatMatchTime,
  getGMTOffset,
  getTimezoneLabel,
  readStoredTimezone,
  writeStoredTimezone,
  TIMEZONE_OPTIONS,
  TIMEZONE_STORAGE_KEY,
} from '../timezone';

// ---------------------------------------------------------------------------
// getUserTimezone
// ---------------------------------------------------------------------------

describe('getUserTimezone', () => {
  it('returns "UTC" in a Node.js environment (no browser Intl auto-detect)', () => {
    // In the test environment `typeof window === 'undefined'` so it falls back.
    expect(getUserTimezone()).toBe('UTC');
  });
});

// ---------------------------------------------------------------------------
// resolveTimezone
// ---------------------------------------------------------------------------

describe('resolveTimezone', () => {
  it('returns "UTC" for the "auto" value when running server-side', () => {
    expect(resolveTimezone('auto')).toBe('UTC');
  });

  it('returns "UTC" for empty string', () => {
    expect(resolveTimezone('')).toBe('UTC');
  });

  it('passes through a concrete IANA timezone unchanged', () => {
    expect(resolveTimezone('Asia/Bangkok')).toBe('Asia/Bangkok');
    expect(resolveTimezone('America/New_York')).toBe('America/New_York');
    expect(resolveTimezone('UTC')).toBe('UTC');
  });

  it('passes through Europe/London unchanged', () => {
    expect(resolveTimezone('Europe/London')).toBe('Europe/London');
  });
});

// ---------------------------------------------------------------------------
// formatMatchTime
// ---------------------------------------------------------------------------

describe('formatMatchTime', () => {
  // Fixed test date: 11 June 2026 19:00 UTC
  const utcDate = '2026-06-11T19:00:00Z';

  it('formats correctly in UTC', () => {
    expect(formatMatchTime(utcDate, 'UTC')).toBe('19:00');
  });

  it('formats correctly in Asia/Bangkok (UTC+7 → 02:00 next day)', () => {
    expect(formatMatchTime(utcDate, 'Asia/Bangkok')).toBe('02:00');
  });

  it('formats correctly in Asia/Ho_Chi_Minh (same as Bangkok, UTC+7)', () => {
    expect(formatMatchTime(utcDate, 'Asia/Ho_Chi_Minh')).toBe('02:00');
  });

  it('formats correctly in America/New_York (UTC-4 summer → 15:00)', () => {
    expect(formatMatchTime(utcDate, 'America/New_York')).toBe('15:00');
  });

  it('formats correctly in America/Los_Angeles (UTC-7 summer → 12:00)', () => {
    expect(formatMatchTime(utcDate, 'America/Los_Angeles')).toBe('12:00');
  });

  it('formats correctly in Europe/London (UTC+1 BST → 20:00)', () => {
    expect(formatMatchTime(utcDate, 'Europe/London')).toBe('20:00');
  });

  it('resolves "auto" to UTC in a server environment', () => {
    // server-side: getUserTimezone() → 'UTC', so auto ≡ UTC
    expect(formatMatchTime(utcDate, 'auto')).toBe('19:00');
  });

  it('returns "–" for an invalid date string', () => {
    expect(formatMatchTime('not-a-date', 'UTC')).toBe('–');
  });

  it('falls back to UTC for an invalid timezone string', () => {
    // Should not throw; returns the time in UTC
    const result = formatMatchTime(utcDate, 'Invalid/Timezone');
    expect(result).toBe('19:00');
  });

  it('includes the date when includeDate is true', () => {
    const result = formatMatchTime(utcDate, 'UTC', { includeDate: true });
    expect(result).toContain('19:00');
    expect(result).toContain('11 Jun');
  });
});

// ---------------------------------------------------------------------------
// getGMTOffset
// ---------------------------------------------------------------------------

describe('getGMTOffset', () => {
  it('returns "GMT+0" for UTC', () => {
    expect(getGMTOffset('UTC')).toBe('GMT+0');
  });

  it('returns "GMT+0" for empty string', () => {
    expect(getGMTOffset('')).toBe('GMT+0');
  });

  it('returns "GMT+7" for Asia/Bangkok', () => {
    expect(getGMTOffset('Asia/Bangkok')).toBe('GMT+7');
  });

  it('returns "GMT+7" for Asia/Jakarta', () => {
    expect(getGMTOffset('Asia/Jakarta')).toBe('GMT+7');
  });

  it('returns "GMT+7" for Asia/Ho_Chi_Minh', () => {
    expect(getGMTOffset('Asia/Ho_Chi_Minh')).toBe('GMT+7');
  });

  it('returns a negative offset for America/New_York in summer (EDT = GMT-4)', () => {
    const offset = getGMTOffset('America/New_York');
    expect(offset).toBe('GMT-4');
  });

  it('returns a negative offset for America/Los_Angeles in summer (PDT = GMT-7)', () => {
    const offset = getGMTOffset('America/Los_Angeles');
    expect(offset).toBe('GMT-7');
  });

  it('does not throw for an unknown timezone string', () => {
    expect(() => getGMTOffset('Invalid/Zone')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getTimezoneLabel
// ---------------------------------------------------------------------------

describe('getTimezoneLabel', () => {
  it('returns the static label for UTC', () => {
    expect(getTimezoneLabel('UTC')).toBe('UTC (GMT+0)');
  });

  it('returns the static label for Asia/Bangkok', () => {
    expect(getTimezoneLabel('Asia/Bangkok')).toBe('Asia/Bangkok (GMT+7)');
  });

  it('returns the static label for Asia/Jakarta', () => {
    expect(getTimezoneLabel('Asia/Jakarta')).toBe('Asia/Jakarta (GMT+7)');
  });

  it('returns the static label for Europe/London', () => {
    expect(getTimezoneLabel('Europe/London')).toBe('Europe/London');
  });

  it('returns a computed label for "auto" (server → UTC)', () => {
    // auto resolves to UTC in a Node environment
    const label = getTimezoneLabel('auto');
    expect(label).toBe('UTC (GMT+0)');
  });

  it('returns a fallback label for an unknown timezone', () => {
    const label = getTimezoneLabel('Pacific/Auckland');
    // Should not be empty and should contain the timezone name
    expect(label).toContain('Pacific/Auckland');
  });
});

// ---------------------------------------------------------------------------
// localStorage helpers (no-ops in Node.js environment)
// ---------------------------------------------------------------------------

describe('readStoredTimezone', () => {
  it('returns null in a server (Node.js) environment', () => {
    expect(readStoredTimezone()).toBeNull();
  });
});

describe('writeStoredTimezone', () => {
  it('does not throw in a server (Node.js) environment', () => {
    expect(() => writeStoredTimezone('Asia/Bangkok')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TIMEZONE_OPTIONS
// ---------------------------------------------------------------------------

describe('TIMEZONE_OPTIONS', () => {
  it('contains at least 8 options', () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThanOrEqual(8);
  });

  it('has "auto" as the first option', () => {
    expect(TIMEZONE_OPTIONS[0].value).toBe('auto');
    expect(TIMEZONE_OPTIONS[0].label).toBe('Auto Detect');
  });

  it('has "UTC" as the second option', () => {
    expect(TIMEZONE_OPTIONS[1].value).toBe('UTC');
  });

  it('contains all required timezone options', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value);
    expect(values).toContain('Asia/Jakarta');
    expect(values).toContain('Asia/Bangkok');
    expect(values).toContain('Asia/Ho_Chi_Minh');
    expect(values).toContain('Europe/London');
    expect(values).toContain('America/New_York');
    expect(values).toContain('America/Los_Angeles');
  });

  it('has no duplicate values', () => {
    const values = TIMEZONE_OPTIONS.map((o) => o.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// TIMEZONE_STORAGE_KEY
// ---------------------------------------------------------------------------

describe('TIMEZONE_STORAGE_KEY', () => {
  it('is a non-empty string', () => {
    expect(typeof TIMEZONE_STORAGE_KEY).toBe('string');
    expect(TIMEZONE_STORAGE_KEY.length).toBeGreaterThan(0);
  });
});
