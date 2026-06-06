/**
 * /admin/seo — Search Console Readiness Dashboard
 *
 * Live checks:
 *   • Fetches each sub-sitemap (/sitemap/N.xml) and counts <loc> entries
 *   • Reads robots.txt from disk and parses rules
 *
 * Static analysis:
 *   • Canonical coverage per page type
 *   • JSON-LD schema types per page type
 *   • Indexed-pages estimate from static slug arrays
 *
 * robots: noindex — admin only.
 */

import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { COMPETITIONS } from '@/lib/types';
import { WC_TEAM_SLUGS } from '@/lib/wc-teams';
import { WC_WATCH_COUNTRY_SLUGS } from '@/lib/wc-watch-countries';
import { WC_TV_COUNTRY_SLUGS } from '@/lib/wc-tv-countries';
import { WC_VENUE_SLUGS } from '@/lib/wc-venues';
import { WC_ALL_TEAM_SLUGS } from '@/lib/wc-all-teams';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SEO Readiness | GoalRadar Admin',
  robots: { index: false, follow: false },
};

// ─── constants ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://goalradar.org';
const WC_GROUPS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

// ─── types ────────────────────────────────────────────────────────────────────

interface SitemapResult {
  id:          number;
  label:       string;
  description: string;
  url:         string;
  status:      'ok' | 'error' | 'timeout';
  httpStatus:  number | null;
  urlCount:    number | null;
  staticEst:   number;
  ms:          number | null;
}

interface RobotsRule {
  type:  'allow' | 'disallow' | 'sitemap' | 'user-agent' | 'other';
  value: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Fetch a sitemap XML and count <loc> tags. Times out after 8 s. */
async function probeSitemap(id: number, label: string, description: string, est: number): Promise<SitemapResult> {
  const url = `${BASE_URL}/sitemap/${id}.xml`;
  const start = Date.now();

  try {
    const res = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - start;

    if (!res.ok) {
      return { id, label, description, url, status: 'error', httpStatus: res.status, urlCount: null, staticEst: est, ms };
    }

    const xml      = await res.text();
    const urlCount = (xml.match(/<loc>/g) ?? []).length;

    return { id, label, description, url, status: 'ok', httpStatus: res.status, urlCount, staticEst: est, ms };
  } catch (err) {
    const ms = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    return { id, label, description, url, status: isTimeout ? 'timeout' : 'error', httpStatus: null, urlCount: null, staticEst: est, ms };
  }
}

/** Parse robots.txt into typed rules. */
function parseRobots(raw: string): RobotsRule[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line): RobotsRule => {
      const lower = line.toLowerCase();
      if (lower.startsWith('user-agent:'))  return { type: 'user-agent',  value: line.split(':').slice(1).join(':').trim() };
      if (lower.startsWith('allow:'))       return { type: 'allow',       value: line.split(':').slice(1).join(':').trim() };
      if (lower.startsWith('disallow:'))    return { type: 'disallow',    value: line.split(':').slice(1).join(':').trim() };
      if (lower.startsWith('sitemap:'))     return { type: 'sitemap',     value: line.split(':').slice(1).join(':').trim() };
      return { type: 'other', value: line };
    });
}

function readRobotsTxt(): string {
  try {
    return readFileSync(join(process.cwd(), 'public', 'robots.txt'), 'utf8');
  } catch {
    return '';
  }
}

// ─── static estimates ────────────────────────────────────────────────────────

function buildStaticEstimates() {
  const leagueComps = COMPETITIONS.filter((c) => c.code !== 'WC');
  return {
    0: 9,   // core static pages
    1: 7,   // WC flat SEO pages
    2: 8 + WC_GROUPS.length + WC_TEAM_SLUGS.length + WC_ALL_TEAM_SLUGS.length + WC_WATCH_COUNTRY_SLUGS.length + WC_TV_COUNTRY_SLUGS.length + WC_VENUE_SLUGS.length,
    3: COMPETITIONS.length + leagueComps.length * 2,
    4: 0,   // fully dynamic — can't estimate without API
    5: 0,   // fully dynamic — built from standings
  } as Record<number, number>;
}

// ─── canonical coverage data ─────────────────────────────────────────────────

const CANONICAL_COVERAGE = [
  { page: 'Home (/)',               canonical: true,  noindex: false, jsonLd: 'WebSite, SportsOrganization' },
  { page: 'Match (/match/[id])',    canonical: true,  noindex: false, jsonLd: 'SportsEvent, FAQPage, BreadcrumbList' },
  { page: 'Team (/teams/[slug])',   canonical: true,  noindex: false, jsonLd: 'SportsTeam, BreadcrumbList' },
  { page: 'Competition (/competition/[code])', canonical: true, noindex: false, jsonLd: 'SportsOrganization' },
  { page: 'Schedule (/schedule)',   canonical: true,  noindex: false, jsonLd: '—' },
  { page: 'Standings (/standings)', canonical: true,  noindex: false, jsonLd: '—' },
  { page: 'WC Hub (/world-cup-2026)', canonical: true, noindex: false, jsonLd: 'Event, FAQPage' },
  { page: 'WC Team (/world-cup-2026/teams/[slug])', canonical: true, noindex: false, jsonLd: 'SportsTeam' },
  { page: 'Live (/live)',           canonical: true,  noindex: false, jsonLd: '—' },
  { page: '/admin/*',               canonical: false, noindex: true,  jsonLd: '—' },
];

// ─── GSC checklist data ───────────────────────────────────────────────────────

const GSC_CHECKLIST = [
  { category: 'Sitemap',     item: 'sitemap.xml declared in robots.txt',       done: true  },
  { category: 'Sitemap',     item: 'All sub-sitemaps return HTTP 200',          done: null  /* live */  },
  { category: 'Sitemap',     item: 'No URL exceeds 50,000 entries per file',    done: true  },
  { category: 'Sitemap',     item: 'lastmod populated on all dynamic URLs',     done: true  },
  { category: 'Indexing',    item: 'robots.txt blocks /admin/ and /api/',       done: true  },
  { category: 'Indexing',    item: 'All admin pages carry noindex meta tag',    done: true  },
  { category: 'Indexing',    item: 'Canonical <link> on every indexable page',  done: true  },
  { category: 'Indexing',    item: 'permanentRedirect from /team/[id] to /teams/[slug]', done: true },
  { category: 'Rich Results','item': 'SportsEvent JSON-LD on match pages',      done: true  },
  { category: 'Rich Results','item': 'FAQPage JSON-LD on match pages',          done: true  },
  { category: 'Rich Results','item': 'SportsTeam JSON-LD on team pages',        done: true  },
  { category: 'Rich Results','item': 'BreadcrumbList JSON-LD on match + team',  done: true  },
  { category: 'Rich Results','item': 'Visible FAQ content matching FAQPage schema', done: true },
  { category: 'Performance', 'item': 'Ad containers reserve height (CLS = 0)', done: true  },
  { category: 'Performance', 'item': 'ISR revalidation on all dynamic pages',   done: true  },
  { category: 'Meta',        item: 'og:title and og:description on all pages',  done: true  },
  { category: 'Meta',        item: 'og:image declared site-wide',               done: false },
  { category: 'Meta',        item: 'Twitter card meta on all pages',            done: true  },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
      {children}
    </h2>
  );
}

function Stat({
  label, value, sub, tone = 'neutral',
}: {
  label: string; value: string; sub: string; tone?: 'green' | 'yellow' | 'red' | 'neutral';
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

function StatusPill({ status }: { status: 'ok' | 'error' | 'timeout' | 'pending' }) {
  const styles = {
    ok:      'bg-green-900/50 text-green-400 border border-green-800/50',
    error:   'bg-red-900/50 text-red-400 border border-red-800/50',
    timeout: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800/50',
    pending: 'bg-gray-800 text-gray-500 border border-gray-700',
  }[status];
  const label = { ok: '200 OK', error: 'ERROR', timeout: 'TIMEOUT', pending: '…' }[status];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles}`}>
      {label}
    </span>
  );
}

function Check({ done }: { done: boolean | null }) {
  if (done === null) return <span className="text-yellow-400 text-sm">○</span>;
  return done
    ? <span className="text-green-400 text-sm">✓</span>
    : <span className="text-red-400 text-sm">✗</span>;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function AdminSeoPage() {
  const estimates = buildStaticEstimates();

  // Probe all 6 sub-sitemaps in parallel
  const SITEMAP_META = [
    { id: 0, label: 'Core Static',        description: 'Home, /live, /schedule, /standings, legal pages' },
    { id: 1, label: 'WC Flat SEO',        description: 'world-cup-2026-schedule, -results, -standings …' },
    { id: 2, label: 'WC Hub',             description: 'Groups, teams, venues, watch-live, tv-schedule countries' },
    { id: 3, label: 'Competitions',       description: '/competition/[code], schedule & standings query params' },
    { id: 4, label: 'Match Pages',        description: 'Recent + upcoming match pages (dynamic)' },
    { id: 5, label: 'Team Pages',         description: '/teams/[slug] from standings across all leagues' },
  ];

  const sitemapResults = await Promise.all(
    SITEMAP_META.map(({ id, label, description }) =>
      probeSitemap(id, label, description, estimates[id] ?? 0),
    ),
  );

  const allOk         = sitemapResults.every((r) => r.status === 'ok');
  const totalLiveUrls = sitemapResults.reduce((sum, r) => sum + (r.urlCount ?? 0), 0);
  const totalEstUrls  = sitemapResults.reduce((sum, r) => sum + r.staticEst, 0);

  // robots.txt
  const robotsRaw   = readRobotsTxt();
  const robotsRules = parseRobots(robotsRaw);
  const hasSitemap  = robotsRules.some((r) => r.type === 'sitemap');
  const hasAdminBlock = robotsRules.some((r) => r.type === 'disallow' && r.value.startsWith('/admin'));
  const hasApiBlock   = robotsRules.some((r) => r.type === 'disallow' && r.value.startsWith('/api'));

  // checklist counts
  const doneCount    = GSC_CHECKLIST.filter((c) => c.done === true).length;
  const pendingCount = GSC_CHECKLIST.filter((c) => c.done === null).length;
  const failCount    = GSC_CHECKLIST.filter((c) => c.done === false).length;

  const groups = Array.from(new Set(GSC_CHECKLIST.map((c) => c.category)));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-12">

        {/* ── header ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-green-400">Admin</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Search Console Readiness</h1>
          <p className="mt-2 text-sm text-gray-500">
            Live sitemap probes · robots.txt analysis · canonical coverage · GSC checklist
          </p>
        </div>

        {/* ── summary stats ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Sitemaps Healthy"
            value={`${sitemapResults.filter((r) => r.status === 'ok').length} / ${sitemapResults.length}`}
            sub="Sub-sitemaps returning HTTP 200"
            tone={allOk ? 'green' : 'red'}
          />
          <Stat
            label="Live URL Count"
            value={totalLiveUrls > 0 ? totalLiveUrls.toLocaleString() : '—'}
            sub={`~${totalEstUrls.toLocaleString()} estimated (static pages only)`}
            tone="neutral"
          />
          <Stat
            label="Canonical Types"
            value={`${CANONICAL_COVERAGE.filter((c) => c.canonical).length} / ${CANONICAL_COVERAGE.length}`}
            sub="Page types with canonical <link>"
            tone="green"
          />
          <Stat
            label="GSC Checklist"
            value={`${doneCount} / ${GSC_CHECKLIST.length}`}
            sub={`${failCount} failing · ${pendingCount} depend on live data`}
            tone={failCount === 0 ? 'green' : failCount <= 2 ? 'yellow' : 'red'}
          />
        </div>

        {/* ── sitemap probe results ── */}
        <section>
          <SectionHeader>Sitemap Index — Live Probe ({BASE_URL})</SectionHeader>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">URLs Found</th>
                  <th className="px-4 py-3 text-right">Est. (static)</th>
                  <th className="px-4 py-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {sitemapResults.map((r) => (
                  <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400">{r.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{r.label}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{r.description}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {r.urlCount !== null ? r.urlCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {r.staticEst > 0 ? r.staticEst.toLocaleString() : 'dynamic'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {r.ms !== null ? `${r.ms} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-700 bg-gray-900/60">
                  <td colSpan={4} className="px-4 py-3 text-xs text-gray-500">
                    Sitemap index: <a href={`${BASE_URL}/sitemap.xml`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{BASE_URL}/sitemap.xml</a>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white">
                    {totalLiveUrls > 0 ? totalLiveUrls.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">
                    {totalEstUrls.toLocaleString()}+
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Sitemaps 4 and 5 are dynamic — URL count reflects live API results at render time.
            Static estimate is 0 because match and team URLs are not known at build time.
          </p>
        </section>

        {/* ── robots.txt ── */}
        <section>
          <SectionHeader>robots.txt — public/robots.txt</SectionHeader>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* raw content */}
            <div>
              <p className="mb-2 text-xs text-gray-500">Current content</p>
              <pre className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 text-xs font-mono leading-relaxed text-gray-300 whitespace-pre-wrap">
                {robotsRaw || '(empty or unreadable)'}
              </pre>
            </div>

            {/* parsed rules checklist */}
            <div className="space-y-3">
              <p className="mb-2 text-xs text-gray-500">Rule validation</p>

              {[
                { label: 'Sitemap URL declared',           ok: hasSitemap },
                { label: '/admin/ blocked from crawlers',  ok: hasAdminBlock },
                { label: '/api/ blocked from crawlers',    ok: hasApiBlock },
                { label: 'Wildcard user-agent present',    ok: robotsRules.some((r) => r.type === 'user-agent' && r.value === '*') },
                { label: 'No blanket Disallow: / rule',    ok: !robotsRules.some((r) => r.type === 'disallow' && r.value === '/') },
              ].map(({ label, ok }) => (
                <div key={label} className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${ok ? 'border-green-900/50 bg-green-950/20' : 'border-red-900/50 bg-red-950/20'}`}>
                  <span className={ok ? 'text-gray-300' : 'text-red-300'}>{label}</span>
                  <Check done={ok} />
                </div>
              ))}

              <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Parsed Disallow Rules</p>
                {robotsRules
                  .filter((r) => r.type === 'disallow')
                  .map((r) => (
                    <p key={r.value} className="font-mono text-xs text-gray-400">
                      <span className="text-red-400">Disallow:</span> {r.value}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── canonical coverage ── */}
        <section>
          <SectionHeader>Canonical &amp; Schema Coverage — By Page Type</SectionHeader>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 text-left">Page Type</th>
                  <th className="px-4 py-3 text-center">Canonical</th>
                  <th className="px-4 py-3 text-center">Noindex</th>
                  <th className="px-4 py-3 text-left">JSON-LD Schema Types</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_COVERAGE.map((row) => (
                  <tr key={row.page} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white text-xs">{row.page}</td>
                    <td className="px-4 py-3 text-center">
                      <Check done={row.canonical} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.noindex
                        ? <span className="text-yellow-400 text-xs font-mono">noindex</span>
                        : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{row.jsonLd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── GSC checklist ── */}
        <section>
          <SectionHeader>Search Console Checklist — {doneCount}/{GSC_CHECKLIST.length} Complete</SectionHeader>

          <div className="space-y-6">
            {groups.map((group) => {
              const items = GSC_CHECKLIST.filter((c) => c.category === group);
              return (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{group}</p>
                  <div className="space-y-1.5">
                    {items.map(({ item, done }) => (
                      <div
                        key={item}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                          done === true  ? 'border-green-900/40 bg-green-950/10' :
                          done === false ? 'border-red-900/40 bg-red-950/10' :
                                          'border-yellow-900/40 bg-yellow-950/10'
                        }`}
                      >
                        <Check done={done} />
                        <span className={
                          done === true  ? 'text-gray-300' :
                          done === false ? 'text-red-300' :
                                          'text-yellow-300'
                        }>
                          {item}
                        </span>
                        {done === null && (
                          <span className="ml-auto text-[10px] text-yellow-600 uppercase tracking-wider">live data required</span>
                        )}
                        {done === false && (
                          <span className="ml-auto text-[10px] text-red-600 uppercase tracking-wider">action needed</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── GSC links ── */}
        <section>
          <SectionHeader>Google Search Console — Quick Links</SectionHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Submit Sitemap',
                href:  'https://search.google.com/search-console/sitemaps',
                desc:  'Add https://goalradar.org/sitemap.xml',
              },
              {
                label: 'URL Inspection',
                href:  'https://search.google.com/search-console/inspect',
                desc:  'Test individual page indexing status',
              },
              {
                label: 'Coverage Report',
                href:  'https://search.google.com/search-console/index',
                desc:  'View indexed vs excluded URLs',
              },
              {
                label: 'Rich Results Test',
                href:  'https://search.google.com/test/rich-results',
                desc:  'Validate SportsEvent + FAQPage JSON-LD',
              },
              {
                label: 'robots.txt Tester',
                href:  'https://search.google.com/search-console/robots-txt',
                desc:  'Verify crawl rules are applied correctly',
              },
              {
                label: 'Schema Markup Validator',
                href:  'https://validator.schema.org/',
                desc:  'Validate JSON-LD on any page URL',
              },
            ].map(({ label, href, desc }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 hover:border-blue-800/60 hover:bg-blue-950/10 transition-colors"
              >
                <span className="font-semibold text-blue-400 text-sm">{label} ↗</span>
                <span className="text-xs text-gray-500">{desc}</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── footer ── */}
        <p className="text-center text-xs text-gray-700 pb-4">
          GoalRadar Admin · /admin/seo · noindex · revalidates on every request
        </p>

      </div>
    </div>
  );
}
