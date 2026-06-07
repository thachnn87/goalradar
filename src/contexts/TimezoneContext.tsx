'use client';

/**
 * TimezoneContext — provides the user's selected timezone across the app.
 *
 * SSR safety:
 *   - Server renders with `timezone = 'UTC'` so hydration output matches.
 *   - After client mount, reads localStorage (or auto-detects) and updates state.
 *   - `mounted` flag lets consuming components skip the local-time render until
 *     the client is ready, preventing hydration mismatches.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getUserTimezone,
  readStoredTimezone,
  writeStoredTimezone,
  resolveTimezone,
} from '@/lib/timezone';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface TimezoneContextValue {
  /** Raw stored setting: 'auto' | 'UTC' | 'Asia/Bangkok' | … */
  timezone: string;
  /** Concrete IANA timezone string — 'auto' is resolved here, never 'auto'. */
  resolvedTimezone: string;
  /** Update the preference (persists to localStorage). */
  setTimezone: (tz: string) => void;
  /** True only after client hydration — use to gate local-time rendering. */
  mounted: boolean;
}

const DEFAULT: TimezoneContextValue = {
  timezone: 'UTC',
  resolvedTimezone: 'UTC',
  setTimezone: () => {},
  mounted: false,
};

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const TimezoneContext = createContext<TimezoneContextValue>(DEFAULT);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  // Start with 'UTC' — matches SSR output, eliminates hydration mismatch.
  const [timezone, setTimezoneState] = useState<string>('UTC');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only runs on the client, after first paint.
    const stored = readStoredTimezone();
    // If the user has never chosen, default to 'auto' (browser detection).
    setTimezoneState(stored ?? 'auto');
    setMounted(true);
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    writeStoredTimezone(tz);
  }, []);

  // Resolve 'auto' → detected tz on client; on server (mounted=false) keep 'UTC'.
  const resolvedTimezone = mounted ? resolveTimezone(timezone) : 'UTC';

  return (
    <TimezoneContext.Provider value={{ timezone, resolvedTimezone, setTimezone, mounted }}>
      {children}
    </TimezoneContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTimezone(): TimezoneContextValue {
  return useContext(TimezoneContext);
}
