'use client';

/**
 * LocalTime — displays a UTC date/time in the user's selected timezone.
 *
 * Renders nothing during SSR and on initial hydration (when `mounted = false`).
 * This guarantees zero hydration mismatches: the server always renders only the
 * UTC time; this component adds the local time as a purely client-side island.
 */

import { useTimezone } from '@/contexts/TimezoneContext';
import { formatMatchTime, getGMTOffset } from '@/lib/timezone';

interface Props {
  utcDate: string;
  /**
   * 'badge'      — compact inline chip: "02:00 ICT"
   * 'with-label' — two-line block with "Your Time" heading (for match pages)
   */
  variant?: 'badge' | 'with-label';
  className?: string;
}

/** Shortens an IANA tz name to a readable abbreviation, e.g. "Asia/Bangkok" → "ICT". */
function tzAbbr(resolved: string): string {
  if (resolved === 'UTC') return 'UTC';
  try {
    const date = new Date('2026-06-15T12:00:00Z');
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: resolved,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? resolved.split('/').pop() ?? '';
  } catch {
    return resolved.split('/').pop() ?? '';
  }
}

export default function LocalTime({ utcDate, variant = 'badge', className = '' }: Props) {
  const { resolvedTimezone, mounted } = useTimezone();

  // Don't render anything until after hydration to avoid mismatch.
  if (!mounted) return null;

  const localTime = formatMatchTime(utcDate, resolvedTimezone);
  const abbr = tzAbbr(resolvedTimezone);
  const offset = getGMTOffset(resolvedTimezone);

  if (variant === 'with-label') {
    return (
      <div className={`${className}`}>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Your Time</p>
        <p className="text-blue-400 font-bold font-mono text-base leading-none">
          {localTime}
          <span className="text-gray-500 font-normal text-xs ml-1.5">{abbr}</span>
        </p>
        <p className="text-gray-600 text-[10px] mt-0.5">{offset !== 'GMT+0' ? offset : 'UTC'}</p>
      </div>
    );
  }

  // 'badge' — compact inline chip
  return (
    <span className={`text-[10px] text-blue-400 font-mono ${className}`}>
      {localTime} {abbr}
    </span>
  );
}
