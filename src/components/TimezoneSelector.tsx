'use client';

/**
 * TimezoneSelector — dropdown that lets the user pick a timezone.
 * Reads/writes through TimezoneContext (persists to localStorage).
 */

import { useTimezone } from '@/contexts/TimezoneContext';
import { TIMEZONE_OPTIONS } from '@/lib/timezone';

interface Props {
  className?: string;
}

export default function TimezoneSelector({ className = '' }: Props) {
  const { timezone, setTimezone } = useTimezone();

  return (
    <select
      value={timezone}
      onChange={(e) => setTimezone(e.target.value)}
      aria-label="Select timezone"
      className={[
        'bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg',
        'px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
        'cursor-pointer hover:border-gray-600 transition-colors',
        className,
      ].join(' ')}
    >
      {TIMEZONE_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
