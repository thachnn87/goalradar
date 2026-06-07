'use client';

/**
 * TimezoneBanner — strip shown above fixture lists.
 *
 * Displays the currently active timezone and exposes the TimezoneSelector
 * dropdown so users can change it inline.
 *
 * "Showing times in: Asia/Bangkok (GMT+7)  [selector▾]"
 *
 * SSR-safe: before client mount the label falls back to "UTC (GMT+0)" so
 * the server-rendered HTML and the initial client paint are identical.
 */

import { useTimezone } from '@/contexts/TimezoneContext';
import { getTimezoneLabel } from '@/lib/timezone';
import TimezoneSelector from '@/components/TimezoneSelector';

interface Props {
  className?: string;
}

export default function TimezoneBanner({ className = '' }: Props) {
  const { resolvedTimezone, mounted } = useTimezone();

  // Before client mount, show a stable placeholder that matches SSR output.
  const label = mounted ? getTimezoneLabel(resolvedTimezone) : 'UTC (GMT+0)';

  return (
    <div
      className={[
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2',
        'bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-blue-400 text-sm shrink-0">🕐</span>
        <span className="text-gray-400 text-xs shrink-0">Showing times in:</span>
        <span
          className="text-white font-semibold text-xs truncate"
          suppressHydrationWarning
        >
          {label}
        </span>
      </div>

      <TimezoneSelector className="shrink-0" />
    </div>
  );
}
