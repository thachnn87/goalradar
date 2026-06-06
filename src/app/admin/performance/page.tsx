/**
 * /admin/performance
 *
 * Live operational dashboard for GoalRadar.
 * Reads directly from Vercel KV to show real endpoint health — not
 * per-process module counters (which are always 0 from this isolated
 * serverless process and are therefore misleading).
 *
 * No authentication — MVP only.
 * robots: noindex set in metadata.
 */

import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kv } from '@vercel/kv';
import { COMPETITIONS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Performance Dashboard | GoalRadar Admin',
  robots: { index: false, follow: false },
};

// ─── types ───────────────────────────────────────────────────────────────────

interface KVEntry {
  fetchedAt:  number; // epoch ms
  freshUntil: number; // epoch ms
}

interface CronJob {
  path:     string;
  schedule: string;
}

type EndpointStatus = 'FRESH' | 'STALE' | 'MISSING' | 'ERROR';

interface EndpointResult {
  label:     string;
  ep:        string;
  freshSec:  number;
  status:    EndpointStatus;
  ageMs:     number | null;   // ms since fetchedAt
  ttlLeftMs: number | null;   // ms until freshUntil (negative = stale)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtAge(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

function fmtTtl(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function readCronStatus(): { active: boolean; jobs: CronJob[] } {
  try {
    const raw = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8');
    const cfg = JSON.parse(raw) as { crons?: CronJob[] };
    const jobs = cfg.crons ?? [];
    return { active: jobs.length > 0, jobs };
  } catch {
    return { active: false, jobs: [] };
  }
}

// ─── known KV endpoints to monitor ──────────────────────────────────────────

function buildWatchList(today: string, from30: string) {
  return [
    { label: 'WC · Upcoming',       ep: '/competitions/WC/matches?status=SCHEDULED,TIMED',           freshSec: 900   },
    { label: 'WC · Finished',       ep: '/competitions/WC/matches?status=FINISHED',                  freshSec: 900   },
    { label: 'WC · Recent (30d)',   ep: `/competitions/WC/matches?dateFrom=${from30}&dateTo=${today}`, freshSec: 900  },
    { label: 'WC · All Matches',    ep: '/competitions/WC/matches',                                  freshSec: 21600 },
    { label: 'WC · Standings',      ep: '/competitions/WC/standings',                                freshSec: 3600  },
    { label: 'PL · Standings',      ep: '/competitions/PL/standings',                                freshSec: 3600  },
    { label: 'PL · Upcoming',       ep: '/competitions/PL/matches?status=SCHEDULED,TIMED',           freshSec: 900   },
    { label: 'CL · Standings',      ep: '/competitions/CL/standings',                                freshSec: 3600  },
    { label: 'BL1 · Standings',     ep: '/competitions/BL1/standings',                               freshSec: 3600  },
    { label: 'SA · Standings',      ep: '/competitions/SA/standings',                                freshSec: 3600  },
    { label: 'FL1 · Standings',     ep: '/competitions/FL1/standings',                               freshSec: 3600  },
    { label: 'PD · Standings',      ep: '/competitions/PD/standings',                                freshSec: 3600  },
  ] as const;
}

// ─── API rate budget table (math-based, not counters) ────────────────────────

const RATE_ROWS = [
  { category: 'WC fixtures (3 endpoints)',    ttlLabel: '15 min', keys: 3,  callsHr: 12,  note: ''           },
  { category: 'WC standings',                ttlLabel: '1 hr',   keys: 1,  callsHr: 1,   note: ''           },
  { category: 'WC all matches (bracket)',     ttlLabel: '6 hr',   keys: 1,  callsHr: 1,   note: ''           },
  { category: 'Non-WC standings (6)',         ttlLabel: '1 hr',   keys: 6,  callsHr: 6,   note: ''           },
  { category: 'Non-WC fixtures (12)',         ttlLabel: '15 min', keys: 12, callsHr: 48,  note: ''           },
  { category: 'Live (getWCLiveMatches)',       ttlLabel: '30 s',   keys: 1,  callsHr: 240, note: 'ISR-capped' },
  { category: 'Live (getLiveMatches)',         ttlLabel: '30 s',   keys: 1,  callsHr: 120, note: 'ISR-capped' },
  { category: "Today's matches",              ttlLabel: '60 s',   keys: 1,  callsHr: 60,  note: 'ISR-capped' },
] as const;

const RATE_KV_TOTAL    = 12 + 1 + 1 + 6 + 48;        // 68
const RATE_LIVE_TOTAL  = 240 + 120 + 60;              // 420
const RATE_GRAND_TOTAL = RATE_KV_TOTAL + RATE_LIVE_TOTAL; // 488

// ─── sub-components ──────────────────────────────────────────────────────────

function Stat({
  label, value, sub, tone = 'neutral',
}: {
  label: string;
  value: string;
  sub:   string;
  tone?: 'green' | 'yellow' | 'red' | 'neutral';
}) {
  const border = {
    green:   'border-green-900/60 bg-green-950/20',
    yellow:  'border-yellow-900/60 bg-yellow-950/20',
    red:     'border-red-900/60 bg-red-950/20',
    neutral: 'border-gray-800 bg-gray-900',
  }[tone];
  const valueColor = {
    green:   'text-green-400',
    yellow:  'text-yellow-400',
    red:     'text-red-400',
    neutral: 'text-white',
  }[tone];

  return (
    <div className={`rounded-xl border p-5 ${border}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-3 text-3xl font-black ${valueColor}`}>{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{sub}</p>
    </div>
  );
}

function Banner({
  tone, children,
}: {
  tone: 'red' | 'yellow' | 'blue';
  children: React.ReactNode;
}) {
  const cls = {
    red:    'border-red-900/50 bg-red-950/30 text-red-300',
    yellow: 'border-yellow-900/50 bg-yellow-950/30 text-yellow-300',
    blue:   'border-blue-900/50 bg-blue-950/30 text-blue-300',
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: EndpointStatus }) {
  const styles: Record<EndpointStatus, string> = {
    FRESH:   'bg-green-900/50 text-green-400 border border-green-800/50',
    STALE:   'bg-yellow-900/50 text-yellow-400 border border-yellow-800/50',
    MISSING: 'bg-red-900/50 text-red-400 border border-red-800/50',
    ERROR:   'bg-gray-800 text-gray-500 border border-gray-700',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
      {children}
    </h2>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function AdminPerformancePage() {
  const now   = Date.now();
  const today = new Date(now).toISOString().split('T')[0];
  const from30 = new Date(now - 30 * 86_400_000).toISOString().split('T')[0];

  // ── 1. KV connectivity ────────────────────────────────────────────────────
  let kvConnected = false;
  let kvDbSize: number | null = null;
  try {
    kvDbSize    = await kv.dbsize();
    kvConnected = true;
  } catch { /* kvConnected stays false */ }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  // ── 2. Endpoint health ────────────────────────────────────────────────────
  const watchList = buildWatchList(today, from30);

  const rawResults = await Promise.allSettled(
    watchList.map((w) => kv.get<KVEntry>(`goalradar:${w.ep}`)),
  );

  const endpointHealth: EndpointResult[] = watchList.map((w, i) => {
    const r = rawResults[i];
    if (r.status === 'rejected') {
      return { ...w, status: 'ERROR' as const, ageMs: null, ttlLeftMs: null };
    }
    const entry = r.value;
    if (!entry) {
      return { ...w, status: 'MISSING' as const, ageMs: null, ttlLeftMs: null };
    }
    const ttlLeftMs = entry.freshUntil - now;
    return {
      ...w,
      status:    ttlLeftMs > 0 ? 'FRESH' : 'STALE',
      ageMs:     now - entry.fetchedAt,
      ttlLeftMs: ttlLeftMs > 0 ? ttlLeftMs : null,
    };
  });

  const freshCount   = endpointHealth.filter((e) => e.status === 'FRESH').length;
  const staleCount   = endpointHealth.filter((e) => e.status === 'STALE').length;
  const missingCount = endpointHealth.filter((e) => e.status === 'MISSING').length;

  // ── 3. Cron status ────────────────────────────────────────────────────────
  const cron = readCronStatus();

  // ── 4. API key ────────────────────────────────────────────────────────────
  const apiKeySet = Boolean(process.env.FOOTBALL_API_KEY);

  // ── 5. Computed tones ─────────────────────────────────────────────────────
  const kvTone: 'green' | 'red' | 'yellow' =
    !kvEnabled       ? 'red'
    : !kvConnected   ? 'red'
    : missingCount > 3 ? 'yellow'
    : 'green';

  const endpointTone: 'green' | 'yellow' | 'red' =
    missingCount > watchList.length / 2 ? 'red'
    : missingCount > 0 || staleCount > 0 ? 'yellow'
    : 'green';

  const cronTone: 'green' | 'red' = cron.active ? 'green' : 'red';
  const apiTone:  'green' | 'red' = apiKeySet ? 'green' : 'red';

  const checkedAt = new Date(now).toUTCString();

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20 pt-6 px-4">

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 border-b border-gray-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500">
            GoalRadar Admin
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">Performance Dashboard</h1>
          <p className="mt-1 text-xs text-gray-600">Checked at {checkedAt} — refresh page to re-read KV.</p>
        </div>
        <a
          href="/admin/performance"
          className="w-fit rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
        >
          ↺ Refresh
        </a>
      </div>

      {/* ── critical banners ────────────────────────────────────────────── */}
      <div className="space-y-3">
        {!apiKeySet && (
          <Banner tone="red">
            <span className="mt-0.5 shrink-0">🔑</span>
            <span>
              <strong>FOOTBALL_API_KEY is not set.</strong> All competition data (fixtures, standings, live scores) is unavailable. Set it in Vercel → Settings → Environment Variables.
            </span>
          </Banner>
        )}
        {!kvEnabled && (
          <Banner tone="red">
            <span className="mt-0.5 shrink-0">❌</span>
            <span>
              <strong>KV is not configured.</strong> KV_REST_API_URL and KV_REST_API_TOKEN are missing. Every page request goes directly to the football-data.org API with no caching.
            </span>
          </Banner>
        )}
        {kvEnabled && !kvConnected && (
          <Banner tone="red">
            <span className="mt-0.5 shrink-0">🔌</span>
            <span>
              <strong>KV is configured but unreachable.</strong> kv.dbsize() failed. Check Upstash/Vercel KV dashboard for connectivity issues.
            </span>
          </Banner>
        )}
        {!cron.active && (
          <Banner tone="yellow">
            <span className="mt-0.5 shrink-0">⏰</span>
            <span>
              <strong>Cron jobs are inactive.</strong> <code className="rounded bg-yellow-900/40 px-1 text-yellow-200">vercel.json</code> has no <code className="rounded bg-yellow-900/40 px-1 text-yellow-200">crons</code> key. KV cache is populated on-demand only — the first user after each TTL expiry pays the API round-trip cost. Copy cron config from <code className="rounded bg-yellow-900/40 px-1 text-yellow-200">vercel-bak.json</code> to fix.
            </span>
          </Banner>
        )}
        {missingCount > 0 && kvConnected && (
          <Banner tone="yellow">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>
              <strong>{missingCount} endpoint{missingCount !== 1 ? 's' : ''} not yet in KV.</strong> These will call the API on the next page request. Pages will self-populate KV on first visit.
            </span>
          </Banner>
        )}
      </div>

      {/* ── top stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="KV connection"
          value={!kvEnabled ? 'Not configured' : kvConnected ? 'Connected' : 'Unreachable'}
          sub={kvDbSize !== null ? `${kvDbSize} total keys in Redis` : 'KV not reachable from this process'}
          tone={kvTone}
        />
        <Stat
          label="Endpoint health"
          value={`${freshCount} / ${watchList.length}`}
          sub={`${freshCount} fresh · ${staleCount} stale · ${missingCount} missing across monitored endpoints`}
          tone={endpointTone}
        />
        <Stat
          label="Cron jobs"
          value={cron.active ? `${cron.jobs.length} active` : 'Inactive'}
          sub={
            cron.active
              ? cron.jobs.map((j) => `${j.path} (${j.schedule})`).join(' · ')
              : 'No crons in vercel.json — KV is never pre-warmed'
          }
          tone={cronTone}
        />
        <Stat
          label="API key"
          value={apiKeySet ? 'Configured' : 'Missing'}
          sub={apiKeySet ? 'FOOTBALL_API_KEY is set in environment' : 'Set FOOTBALL_API_KEY in Vercel dashboard'}
          tone={apiTone}
        />
      </div>

      {/* ── KV endpoint health ──────────────────────────────────────────── */}
      <section>
        <SectionHeader>KV Endpoint Health</SectionHeader>
        <p className="mb-3 text-xs text-gray-600">
          Live data read directly from Vercel KV. Each row is one <code className="rounded bg-gray-800 px-1">goalradar:&lt;endpoint&gt;</code> key.
          FRESH = within configured TTL. STALE = past TTL but still in KV stale window. MISSING = key not in KV at all.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-gray-800 bg-gray-950 text-left text-[10px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Endpoint</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Last fetched</th>
                <th className="px-4 py-3 font-semibold text-right">Fresh for</th>
                <th className="px-4 py-3 font-semibold text-right">Config TTL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {endpointHealth.map((row) => (
                <tr key={row.ep} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-200">{row.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-600 break-all">{row.ep}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmtAge(row.ageMs)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmtTtl(row.ttlLeftMs)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.freshSec >= 3600
                      ? `${row.freshSec / 3600}h`
                      : `${row.freshSec / 60}m`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── cron detail + API rate budget ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* cron detail */}
        <section>
          <SectionHeader>Cron Jobs</SectionHeader>
          {cron.active ? (
            <div className="overflow-hidden rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800 bg-gray-950 text-left text-[10px] uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Route</th>
                    <th className="px-4 py-3 text-right font-semibold">Schedule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {cron.jobs.map((job) => (
                    <tr key={job.path}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">{job.path}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{job.schedule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-yellow-900/40 bg-yellow-950/10 p-5">
              <p className="text-sm font-semibold text-yellow-400">No cron jobs registered</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                The refresh routes exist (<code className="text-gray-400">/api/refresh/wc-fixtures</code>, <code className="text-gray-400">/api/refresh/standings</code>) but are never called automatically.
                Copy <code className="text-gray-400">crons</code> from <code className="text-gray-400">vercel-bak.json</code> into <code className="text-gray-400">vercel.json</code> and redeploy to activate.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  { path: '/api/refresh/wc-fixtures', schedule: '*/10 * * * *', note: 'Every 10 min' },
                  { path: '/api/refresh/standings',   schedule: '*/30 * * * *', note: 'Every 30 min' },
                ].map((j) => (
                  <div key={j.path} className="flex items-center justify-between rounded-lg bg-gray-900 px-3 py-2 text-xs">
                    <span className="font-mono text-gray-400">{j.path}</span>
                    <span className="text-gray-600">{j.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* API rate budget */}
        <section>
          <SectionHeader>API Rate Budget (estimated, KV warm)</SectionHeader>
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 bg-gray-950 text-left text-[10px] uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">TTL</th>
                  <th className="px-4 py-3 text-right font-semibold">Calls/hr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {RATE_ROWS.map((row) => (
                  <tr key={row.category}>
                    <td className="px-4 py-3 text-gray-300">
                      {row.category}
                      {row.note && (
                        <span className="ml-2 text-[10px] text-gray-600">{row.note}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{row.ttlLabel}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-300">{row.callsHr}</td>
                  </tr>
                ))}
                <tr className="bg-gray-900/50">
                  <td className="px-4 py-3 font-semibold text-white">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{RATE_GRAND_TOTAL}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
              <p className="text-gray-500">Free tier limit</p>
              <p className="mt-0.5 font-bold text-red-400">600/hr (10/min)</p>
              <p className="text-[10px] text-gray-600">Exceeded during WC match days</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
              <p className="text-gray-500">Starter tier limit</p>
              <p className="mt-0.5 font-bold text-green-400">6 000/hr (100/min)</p>
              <p className="text-[10px] text-gray-600">Sufficient at current TTL config</p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Google Analytics 4 ──────────────────────────────────────────── */}
      <section>
        <SectionHeader>Google Analytics 4</SectionHeader>

        {/* GA4 status card */}
        {(() => {
          const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';
          const configured = gaId !== '';
          return (
            <div className={`rounded-xl border p-5 mb-6 ${configured ? 'border-green-900/60 bg-green-950/20' : 'border-yellow-900/60 bg-yellow-950/20'}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xl ${configured ? 'text-green-400' : 'text-yellow-400'}`}>
                  {configured ? '✓' : '⚠'}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${configured ? 'text-green-300' : 'text-yellow-300'}`}>
                    {configured ? `GA4 active — ${gaId}` : 'GA4 not configured'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {configured
                      ? 'NEXT_PUBLIC_GA_MEASUREMENT_ID is set. Script loads via next/script strategy="afterInteractive".'
                      : 'Set NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel environment variables to enable tracking.'}
                  </p>
                </div>
              </div>
              {configured && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`https://analytics.google.com/analytics/web/#/p${gaId.replace('G-', '')}/reports/realtime`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-blue-400 hover:bg-gray-700 transition-colors"
                  >
                    Real-time →
                  </a>
                  <a
                    href="https://analytics.google.com/analytics/web/#/report/content-pages"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-blue-400 hover:bg-gray-700 transition-colors"
                  >
                    Top Pages →
                  </a>
                  <a
                    href="https://analytics.google.com/analytics/web/#/report/content-event-events"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-blue-400 hover:bg-gray-700 transition-colors"
                  >
                    Events →
                  </a>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tracked events schema */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Tracked Events</h3>
            <div className="overflow-hidden rounded-xl border border-gray-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/60">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-400">Event</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-400">Fired on</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-400">Key params</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-900">
                  {[
                    { event: 'page_view',        page: 'All pages (automatic)',  params: 'page_location, page_title' },
                    { event: 'match_view',        page: '/match/[id]',           params: 'match_id, home_team, away_team, competition' },
                    { event: 'team_view',         page: '/team/[id]',            params: 'team_id, team_name' },
                    { event: 'competition_view',  page: '/competition/[code], /schedule, /standings', params: 'competition_code, competition_name, view_context' },
                  ].map(({ event, page, params }) => (
                    <tr key={event} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 font-mono text-emerald-400">{event}</td>
                      <td className="px-4 py-2.5 text-gray-400">{page}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{params}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Expected Top Pages</h3>
            <div className="space-y-1.5">
              {[
                { path: '/world-cup-2026',             label: 'World Cup 2026 Hub' },
                { path: '/world-cup-2026-schedule',    label: 'WC Schedule (static)' },
                { path: '/schedule?competition=WC',    label: 'WC Live Schedule' },
                { path: '/standings?competition=WC',   label: 'WC Group Standings' },
                { path: '/schedule',                   label: 'General Schedule' },
                { path: '/standings',                  label: 'League Standings' },
              ].map(({ path, label }) => (
                <div key={path} className="flex items-center justify-between rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-xs">
                  <div>
                    <span className="font-mono text-gray-400">{path}</span>
                    <span className="ml-2 text-gray-600">{label}</span>
                  </div>
                  <a
                    href={`https://analytics.google.com/analytics/web/#/report/content-pages/a${(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').replace('G-', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-400"
                  >
                    GA →
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Top competitions by GA event */}
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Competitions — competition_view Events</h3>
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Competition</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">GA4 filter</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400">GA Console</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900">
                {COMPETITIONS.map((c) => (
                  <tr key={c.code} className="hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-gray-300">
                      <span className="mr-2">{c.flag}</span>{c.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.code}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      competition_code = &quot;{c.code}&quot;
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href="https://analytics.google.com/analytics/web/#/report/content-event-events"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── process cache note ──────────────────────────────────────────── */}
      <section>
        <SectionHeader>Process-level Cache Note</SectionHeader>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-sm font-semibold text-yellow-400">
            L1/L2 hit counters are always 0 here and are not shown intentionally.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            The <code className="text-gray-400">withCache</code> (L1) and <code className="text-gray-400">withKVCache</code> (L2) hit/miss counters are module-level variables that reset on every serverless cold start.
            This dashboard is its own isolated process — it has not served any pages, so every counter is 0.
            The <code className="text-gray-400">/api/cache-stats</code> endpoint has the same limitation.
            To get meaningful cache metrics, you would need a shared persistent counter (e.g., a KV-backed atomic increment) incremented on each cache event.
            The KV Endpoint Health table above is the correct way to assess real cache state.
          </p>
        </div>
      </section>

    </div>
  );
}
