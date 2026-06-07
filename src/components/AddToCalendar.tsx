'use client';

/**
 * AddToCalendar
 *
 * Client island that renders an "Add to Calendar" button with a dropdown for:
 *   • Google Calendar (URL redirect — no download)
 *   • Apple Calendar  (.ics download via /api/calendar/[matchId])
 *   • Outlook         (.ics download via /api/calendar/[matchId])
 *
 * Fires a GA4 `calendar_subscribe` event on every click.
 * Renders nothing on the server (mounted guard) — fully SSR-safe.
 *
 * Usage (server component):
 *   <AddToCalendar
 *     matchId={match.id}
 *     utcDate={match.utcDate}
 *     homeTeam={match.homeTeam.name}
 *     awayTeam={match.awayTeam.name}
 *     competition={match.competition?.name ?? 'Football'}
 *     venue={match.venue ?? undefined}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildGoogleCalendarUrl } from '@/lib/ics';
import { trackCalendarSubscribe } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddToCalendarProps {
  matchId:     number | string;
  utcDate:     string;
  homeTeam:    string;
  awayTeam:    string;
  competition: string;
  venue?:      string;
  /** Optional extra CSS classes on the wrapper */
  className?:  string;
}

type CalendarType = 'google' | 'apple' | 'outlook';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIcsUrl(params: {
  matchId:     number | string;
  utcDate:     string;
  homeTeam:    string;
  awayTeam:    string;
  competition: string;
  venue?:      string;
}): string {
  const qs = new URLSearchParams({
    home:  params.homeTeam,
    away:  params.awayTeam,
    comp:  params.competition,
    date:  params.utcDate,
    ...(params.venue ? { venue: params.venue } : {}),
  });
  return `/api/calendar/${params.matchId}?${qs.toString()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddToCalendar({
  matchId,
  utcDate,
  homeTeam,
  awayTeam,
  competition,
  venue,
  className = '',
}: AddToCalendarProps) {
  const [open,    setOpen]    = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hydration guard
  useEffect(() => { setMounted(true); }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleClick = useCallback((type: CalendarType) => {
    setOpen(false);
    trackCalendarSubscribe({
      matchId,
      homeTeam,
      awayTeam,
      competition,
      calendarType: type,
    });
  }, [matchId, homeTeam, awayTeam, competition]);

  if (!mounted) return null;

  // Pre-build URLs
  const summary         = `${homeTeam} vs ${awayTeam} – ${competition}`;
  const icsUrl          = buildIcsUrl({ matchId, utcDate, homeTeam, awayTeam, competition, venue });
  const googleCalUrl    = buildGoogleCalendarUrl({
    summary,
    utcDate,
    durationMin: 120,
    description: `Live scores & match coverage: https://goalradar.org\n\nCompetition: ${competition}`,
    location: venue,
  });

  const options: { type: CalendarType; label: string; icon: string; href: string; download?: string }[] = [
    {
      type:   'google',
      icon:   '📅',
      label:  'Google Calendar',
      href:   googleCalUrl,
    },
    {
      type:     'apple',
      icon:     '🍎',
      label:    'Apple Calendar',
      href:     icsUrl,
      download: `${homeTeam.replace(/\s+/g,'-')}-vs-${awayTeam.replace(/\s+/g,'-')}.ics`,
    },
    {
      type:     'outlook',
      icon:     '📧',
      label:    'Outlook',
      href:     icsUrl,
      download: `${homeTeam.replace(/\s+/g,'-')}-vs-${awayTeam.replace(/\s+/g,'-')}.ics`,
    },
  ];

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 hover:border-gray-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all select-none"
      >
        <span className="text-base leading-none">📆</span>
        <span>Add to Calendar</span>
        <span
          className={`text-gray-400 text-xs transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 min-w-[200px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
        >
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold px-4 pt-3 pb-1.5">
            Add to Calendar
          </p>
          {options.map(({ type, icon, label, href, download }) => (
            <a
              key={type}
              role="menuitem"
              href={href}
              target={type === 'google' ? '_blank' : undefined}
              rel={type === 'google' ? 'noopener noreferrer' : undefined}
              download={download}
              onClick={() => handleClick(type)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
            >
              <span className="text-base leading-none w-5 text-center">{icon}</span>
              <span className="font-medium">{label}</span>
              {type !== 'google' && (
                <span className="ml-auto text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                  .ics
                </span>
              )}
              {type === 'google' && (
                <span className="ml-auto text-[10px] text-gray-500">↗</span>
              )}
            </a>
          ))}
          <div className="border-t border-gray-800 px-4 py-2.5">
            <p className="text-[10px] text-gray-600 leading-snug">
              Event: {homeTeam} vs {awayTeam}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
