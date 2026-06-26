#!/usr/bin/env node
/**
 * scripts/guardian.mjs
 *
 * DATA-18WC.GUARDIAN — comprehensive production quality gate.
 *
 * Architecture (static) and user-journeys (navigation) are checked by their own
 * scripts. This Guardian adds the remaining quality layers over a curated set of
 * key pages, against a live server:
 *
 *   • SEO            canonical present/absolute, title, meta description,
 *                    OpenGraph, JSON-LD validity, no accidental noindex
 *   • Hydration      no error-shell markers; Next App-Router payload present
 *   • Accessibility  <html lang>, single <h1>, images have alt text
 *   • Broken links   every unique same-origin link resolves (no 4xx/5xx)
 *   • Cache / ISR     Cache-Control / x-vercel-cache reported; no no-store on ISR
 *   • Performance    TTFB+download time and HTML payload size thresholds
 *
 * Severities: CRITICAL fails the run (exit 1); WARN is reported but non-fatal.
 * Writes GUARDIAN_REPORT.md. Run via `npm run guardian` (chains arch + journeys
 * + this), or directly with CRAWL_BASE_URL=https://www.goalradar.org.
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const BASE_URL  = (process.env.CRAWL_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ORIGIN    = new URL(BASE_URL).origin;
const AUTO_SERVER = process.env.AUTO_SERVER === '1' || process.argv.includes('--auto-server');

// Key surfaces the Guardian inspects in depth.
const PAGES = [
  '/',
  '/world-cup-2026',
  '/world-cup-2026/bracket',
  '/world-cup-2026-bracket',
  '/world-cup-2026/round-of-32',
  '/world-cup-2026-standings',
  '/world-cup-2026-groups',
  '/world-cup-2026/fixtures',
  '/world-cup-2026-schedule',
  '/world-cup-2026/results',
  '/world-cup-2026-results',
  '/world-cup-2026/teams/mexico',
  '/match/537425-mexico-vs-3rd-bcd',
];

const ERROR_SHELL = [
  'Application error', 'client-side exception', 'could not be found',
  'Match Not Found', 'Match Details Unavailable', "This page couldn't load",
];

// ── findings ────────────────────────────────────────────────────────────────
const findings = []; // {layer, severity:'CRITICAL'|'WARN', page, msg}
const add = (layer, severity, page, msg) => findings.push({ layer, severity, page, msg });

// ── fetch ─────────────────────────────────────────────────────────────────────
async function fetchPage(path) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const t0 = Date.now();
  // Retry transient network errors / timeouts so a flaky connection never produces a
  // false CRITICAL. Real HTTP responses (incl. 4xx/5xx) are returned immediately.
  const TRIES = 3;
  let lastErr = '';
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow', signal: AbortSignal.timeout(20_000),
        headers: { 'User-Agent': 'GoalRadar-Guardian/1.0 (+https://goalradar.org)' },
      });
      const html = (res.headers.get('content-type') ?? '').includes('text/html') ? await res.text() : '';
      return { status: res.status, ms: Date.now() - t0, html, headers: res.headers, finalPath: new URL(res.url).pathname };
    } catch (err) {
      lastErr = err?.message ?? String(err);
      if (attempt < TRIES - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return { status: 'ERR', ms: Date.now() - t0, html: '', headers: new Headers(), finalPath: path, error: lastErr };
}

const internalLinks = (html, fromPath) => {
  const out = new Set();
  const re = /\bhref=["']([^"']+)["']/g; let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try {
      const u = new URL(raw, `${BASE_URL}${fromPath}`);
      if (u.origin !== ORIGIN || u.pathname.startsWith('/_next/') || u.pathname.startsWith('/api/')) continue;
      let p = u.pathname; if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
      out.add(p + (u.search ?? ''));
    } catch { /* ignore */ }
  }
  return out;
};

// ── per-page layers ─────────────────────────────────────────────────────────
function checkPage(page, res) {
  if (res.status === 'ERR') { add('http', 'CRITICAL', page, `network error: ${res.error}`); return; }
  if (typeof res.status === 'number' && res.status >= 400) { add('http', 'CRITICAL', page, `HTTP ${res.status}`); return; }
  const html = res.html;
  if (!html) { add('http', 'WARN', page, 'no HTML body'); return; }

  // Hydration / error-shell
  for (const marker of ERROR_SHELL) if (html.includes(marker)) add('hydration', 'CRITICAL', page, `error-shell marker: "${marker}"`);
  if (!/self\.__next_f|id="__next"|__NEXT_DATA__/.test(html)) add('hydration', 'WARN', page, 'no Next App-Router payload detected (possible non-hydrating shell)');

  // SEO — canonical
  const canon = /<link[^>]+rel=["']canonical["'][^>]*>/i.exec(html)?.[0];
  if (!canon) add('seo', 'CRITICAL', page, 'missing <link rel="canonical">');
  else {
    const href = /href=["']([^"']+)["']/i.exec(canon)?.[1] ?? '';
    if (!/^https?:\/\//i.test(href)) add('seo', 'WARN', page, `canonical not absolute: ${href}`);
  }
  // title + description
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  if (!title) add('seo', 'CRITICAL', page, 'missing <title>');
  else if (title.length > 70) add('seo', 'WARN', page, `title > 70 chars (${title.length})`);
  const desc = /<meta[^>]+name=["']description["'][^>]*>/i.exec(html)?.[0];
  const descLen = desc ? (/content=["']([^"']*)["']/i.exec(desc)?.[1]?.length ?? 0) : 0;
  if (!desc) add('seo', 'WARN', page, 'missing meta description');
  else if (descLen < 50 || descLen > 200) add('seo', 'WARN', page, `meta description length ${descLen} (want 50–200)`);
  // OpenGraph
  if (!/property=["']og:title["']/i.test(html)) add('seo', 'WARN', page, 'missing og:title');
  if (!/property=["']og:url["']/i.test(html))   add('seo', 'WARN', page, 'missing og:url');
  // noindex guard — none of these pages should be noindex
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) add('seo', 'CRITICAL', page, 'page is noindex');
  // JSON-LD validity
  const lds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (lds.length === 0) add('seo', 'WARN', page, 'no JSON-LD structured data');
  lds.forEach((block, i) => { try { JSON.parse(block); } catch { add('seo', 'CRITICAL', page, `JSON-LD block #${i + 1} is invalid JSON`); } });

  // Accessibility (markup-level)
  if (!/<html[^>]+lang=/i.test(html)) add('a11y', 'WARN', page, 'missing <html lang>');
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1s === 0) add('a11y', 'WARN', page, 'no <h1>');
  else if (h1s > 1) add('a11y', 'WARN', page, `${h1s} <h1> elements (expect 1)`);
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const noAlt = imgs.filter((t) => !/\balt=/i.test(t)).length;
  if (noAlt > 0) add('a11y', 'WARN', page, `${noAlt}/${imgs.length} <img> missing alt`);

  // Cache / ISR
  const cc = res.headers.get('cache-control') ?? '';
  const vc = res.headers.get('x-vercel-cache') ?? res.headers.get('x-nextjs-cache') ?? '';
  if (/no-store/.test(cc)) add('cache', 'WARN', page, `Cache-Control: no-store (ISR expected) ${vc ? `| ${vc}` : ''}`);

  // Performance
  if (res.ms > 8000) add('perf', 'CRITICAL', page, `slow response ${res.ms}ms`);
  else if (res.ms > 2500) add('perf', 'WARN', page, `slow-ish response ${res.ms}ms`);
  const bytes = Buffer.byteLength(html);
  if (bytes > 2_000_000) add('perf', 'WARN', page, `large HTML ${(bytes / 1e6).toFixed(2)}MB`);
}

// ── server bootstrap ──────────────────────────────────────────────────────────
let _server = null;
const isUp = async (u) => {
  for (let i = 0; i < 3; i++) {
    try { await fetch(u, { signal: AbortSignal.timeout(5000) }); return true; } catch { await new Promise((r) => setTimeout(r, 1500)); }
  }
  return false;
};
async function ensureServer() {
  if (await isUp(`${BASE_URL}/`)) return true;
  if (!AUTO_SERVER) { console.error(`\n❌ No server at ${BASE_URL}. Set CRAWL_BASE_URL or AUTO_SERVER=1.\n`); return false; }
  _server = spawn('npm', ['run', 'start'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env } });
  _server.stdout.on('data', () => {}); _server.stderr.on('data', () => {});
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) { if (await isUp(`${BASE_URL}/`)) return true; await new Promise((r) => setTimeout(r, 1500)); }
  return false;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🛡️  GoalRadar Guardian — quality gate`);
  console.log(`   Base URL: ${BASE_URL}`);
  if (!(await ensureServer())) process.exit(1);

  const allLinks = new Set();
  for (const page of PAGES) {
    const res = await fetchPage(page);
    checkPage(page, res);
    for (const l of internalLinks(res.html, page)) allLinks.add(l);
    const crit = findings.filter((f) => f.page === page && f.severity === 'CRITICAL').length;
    const warn = findings.filter((f) => f.page === page && f.severity === 'WARN').length;
    console.log(`  ${crit ? '❌' : warn ? '⚠️ ' : '✅'} ${page}  [${res.status} ${res.ms}ms]  ${crit}C/${warn}W`);
  }

  // Broken-link layer — every unique internal link must resolve.
  console.log(`\n🔗 Checking ${allLinks.size} unique internal links…`);
  const links = [...allLinks];
  const CONC = 10;
  for (let i = 0; i < links.length; i += CONC) {
    await Promise.all(links.slice(i, i + CONC).map(async (l) => {
      const r = await fetchPage(l);
      if (r.status === 'ERR') add('links', 'CRITICAL', l, `network error: ${r.error}`);
      else if (typeof r.status === 'number' && r.status >= 400) add('links', 'CRITICAL', l, `HTTP ${r.status}`);
    }));
  }

  // ── report ──────────────────────────────────────────────────────────────────
  const crit = findings.filter((f) => f.severity === 'CRITICAL');
  const warn = findings.filter((f) => f.severity === 'WARN');
  const byLayer = (sev) => ['http', 'hydration', 'seo', 'a11y', 'links', 'cache', 'perf']
    .map((L) => `${L}:${findings.filter((f) => f.layer === L && f.severity === sev).length}`).join('  ');

  const lines = [
    '# Guardian Report', '',
    `> Base URL: \`${BASE_URL}\``,
    `> Pages inspected: ${PAGES.length} · Links checked: ${allLinks.size}`,
    `> CRITICAL: ${crit.length} · WARN: ${warn.length}`,
    `> CRITICAL by layer — ${byLayer('CRITICAL')}`,
    `> WARN by layer — ${byLayer('WARN')}`, '',
  ];
  if (crit.length) { lines.push('## ❌ CRITICAL', '', '| Layer | Page | Issue |', '|---|---|---|'); crit.forEach((f) => lines.push(`| ${f.layer} | \`${f.page}\` | ${f.msg} |`)); lines.push(''); }
  if (warn.length) { lines.push('## ⚠️ WARN', '', '| Layer | Page | Issue |', '|---|---|---|'); warn.forEach((f) => lines.push(`| ${f.layer} | \`${f.page}\` | ${f.msg} |`)); lines.push(''); }
  if (!crit.length && !warn.length) lines.push('✅ All layers clean.');
  writeFileSync(resolve(ROOT, 'GUARDIAN_REPORT.md'), lines.join('\n'), 'utf8');

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  CRITICAL: ${crit.length}  |  WARN: ${warn.length}  |  report → GUARDIAN_REPORT.md`);
  if (_server) _server.kill('SIGTERM');
  if (crit.length) { console.error(`\n❌ GUARDIAN FAIL — ${crit.length} critical issue(s).\n`); process.exit(1); }
  console.log(`\n✅ GUARDIAN PASS${warn.length ? ` (with ${warn.length} warning(s))` : ''}.\n`);
  process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (_server) _server.kill('SIGTERM'); process.exit(1); });
main().catch((err) => { console.error('\nFatal:', err); if (_server) _server.kill('SIGTERM'); process.exit(1); });
