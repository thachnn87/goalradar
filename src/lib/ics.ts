/**
 * ICS (iCalendar) generation utilities.
 *
 * Pure functions — no browser APIs, fully SSR-safe.
 * Spec: RFC 5545 (https://datatracker.ietf.org/doc/html/rfc5545)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a JS Date as a UTC iCalendar datetime string: YYYYMMDDTHHmmssZ
 */
export function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Escape special characters in ICS text fields (SUMMARY, DESCRIPTION, LOCATION).
 * RFC 5545 §3.3.11: \ ; , and newlines must be escaped.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g,  '\\;')
    .replace(/,/g,  '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Fold long lines per RFC 5545 §3.1:
 * Lines MUST NOT be longer than 75 octets. Continuation lines begin with a space.
 */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, MAX));
  let i = MAX;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + MAX - 1));
    i += MAX - 1;
  }
  return chunks.join('\r\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface IcsEventParams {
  /** Unique match ID — used as the event UID */
  matchId:     number | string;
  /** UTC kickoff datetime string (ISO 8601) */
  utcDate:     string;
  /** Duration in minutes (default 120 for football) */
  durationMin?: number;
  /** Event title, e.g. "Brazil vs Argentina – FIFA World Cup 2026" */
  summary:     string;
  /** Multi-line description; newlines become \n in ICS */
  description: string;
  /** Optional venue / location string */
  location?:   string;
  /** Canonical URL for the match page */
  url:         string;
}

/**
 * Generate a complete VCALENDAR string suitable for serving as an .ics file.
 */
export function generateIcs(event: IcsEventParams): string {
  const start = new Date(event.utcDate);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid utcDate: ${event.utcDate}`);
  }

  const durationMs  = (event.durationMin ?? 120) * 60 * 1000;
  const end         = new Date(start.getTime() + durationMs);
  const dtStamp     = formatIcsDate(new Date());   // DTSTAMP = time of file creation

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoalRadar//GoalRadar WC2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GoalRadar',
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VEVENT',
    `UID:match-${event.matchId}@goalradar.org`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    foldLine(`SUMMARY:${escapeIcsText(event.summary)}`),
    foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`),
    foldLine(`URL:${event.url}`),
    ...(event.location ? [foldLine(`LOCATION:${escapeIcsText(event.location)}`)] : []),
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}

/**
 * Build a Google Calendar deep-link URL from match data.
 * Opens in a new tab — no file download required.
 */
export function buildGoogleCalendarUrl(params: {
  summary:     string;
  utcDate:     string;
  durationMin?: number;
  description: string;
  location?:   string;
}): string {
  const start = new Date(params.utcDate);
  if (isNaN(start.getTime())) return '#';

  const durationMs = (params.durationMin ?? 120) * 60 * 1000;
  const end        = new Date(start.getTime() + durationMs);

  const fmt = (d: Date) => formatIcsDate(d).replace('Z', ''); // Google wants no trailing Z in the dates param

  const qs = new URLSearchParams({
    action:  'TEMPLATE',
    text:    params.summary,
    dates:   `${fmt(start)}Z/${fmt(end)}Z`,
    details: params.description,
    ...(params.location ? { location: params.location } : {}),
  });

  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}
