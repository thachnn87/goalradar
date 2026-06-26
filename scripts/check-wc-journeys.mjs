#!/usr/bin/env node
/**
 * scripts/check-wc-journeys.mjs
 *
 * DATA-18WC.END-TO-END — User-journey acceptance gate.
 *
 * Unlike check-wc-architecture.mjs (a static source check) this is a RUNTIME
 * check: it walks the 6 mandatory user journeys against a live server, following
 * real links between steps, and FAILS the whole run if ANY step fails the gate:
 *
 *     Data → Route → URL → Page → SSR → Navigation
 *
 * A step FAILS when the URL:
 *   • returns a non-2xx status (404 / 5xx / network error / timeout), OR
 *   • renders an error card ("Match Not Found", "Match Details Unavailable",
 *     "This page couldn't load", "could not be found"), OR
 *   • is a dead-end where the next journey step's link cannot be discovered, OR
 *   • (bracket parity) the SEO bracket and the nested bracket expose a different
 *     set of match identities.
 *
 * Exit 0 = all journeys PASS. Exit 1 = at least one journey FAILED.
 *
 * Env:
 *   CRAWL_BASE_URL   base URL (default http://localhost:3000)
 *                    set to https://www.goalradar.org to gate production
 *   AUTO_SERVER=1    auto-start `next start` around the run (local only)
 *
 * Usage:
 *   CRAWL_BASE_URL=https://www.goalradar.org node scripts/check-wc-journeys.mjs
 *   AUTO_SERVER=1 node scripts/check-wc-journeys.mjs
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const BASE_URL  = (process.env.CRAWL_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const AUTO_SERVER = process.env.AUTO_SERVER === '1' || process.argv.includes('--auto-server');
const ORIGIN    = new URL(BASE_URL).origin;

// Error-card / failure phrases that mean "page rendered but the user sees a dead end".
const ERROR_PHRASES = [
  'Match Not Found',
  'Match Details Unavailable',
  "This page couldn't load",
  "page couldn't load",
  'could not be found',
  'Application error',
  'This match URL is invalid',
];

// ─── HTTP ──────────────────────────────────────────────────────────────────────

async function fetchPage(pathname) {
  const url = pathname.startsWith('http') ? pathname : `${BASE_URL}${pathname}`;
  const t0  = Date.now();
  // Retry transient network errors / timeouts so a flaky connection never produces a
  // false journey failure. Real HTTP responses (incl. 4xx/5xx) are returned immediately.
  const TRIES = 3;
  let lastErr = ''; let lastName = '';
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal:   AbortSignal.timeout(20_000),
        headers:  { 'User-Agent': 'GoalRadar-JourneyCheck/1.0 (+https://goalradar.org)' },
      });
      const ct   = res.headers.get('content-type') ?? '';
      const html = ct.includes('text/html') ? await res.text() : '';
      return { status: res.status, finalPath: new URL(res.url).pathname, html, ms: Date.now() - t0 };
    } catch (err) {
      lastErr = err?.message ?? String(err); lastName = err?.name ?? '';
      if (attempt < TRIES - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return { status: lastName === 'TimeoutError' ? 'TIMEOUT' : 'ERR', finalPath: pathname, html: '', ms: Date.now() - t0, error: lastErr };
}

/** All same-origin internal link paths in document order. */
function links(html, fromPath) {
  const out = [];
  const re = /\bhref=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try {
      const u = new URL(raw, `${BASE_URL}${fromPath}`);
      if (u.origin !== ORIGIN) continue;
      if (u.pathname.startsWith('/_next/') || u.pathname.startsWith('/api/')) continue;
      out.push(u.pathname + (u.search ?? ''));
    } catch { /* ignore */ }
  }
  return out;
}

const firstMatch = (html, fromPath, re) => links(html, fromPath).find((p) => re.test(p)) ?? null;

/** Unique numeric match ids referenced on a page (for bracket parity). */
function matchIds(html, fromPath) {
  const ids = new Set();
  for (const p of links(html, fromPath)) {
    const m = /^\/match\/(\d+)/.exec(p);
    if (m) ids.add(m[1]);
  }
  return ids;
}

// ─── Journey definitions ─────────────────────────────────────────────────────
// Each step: { label, path } for a fixed URL, or { label, discover(prevHtml, prevPath) }
// returning the next path from the previous step's HTML (real navigation).

const RE_MATCH  = /^\/match\/\d+/;
const RE_ROUND  = /^\/world-cup-2026\/(round-of-32|round-of-16|quarter-finals|semi-finals|third-place|final)/;
// Canonical WC team page — the WC user journey's team destination (has match links).
// NOT the generic /teams/{id} club page, which is a separate multi-competition
// surface that does not surface WC fixtures.
const RE_TEAM   = /^\/world-cup-2026\/teams\/[a-z-]+$/i;

const JOURNEYS = [
  {
    name: 'Journey 1 — Home → Bracket → Round32 → Match → Back',
    steps: [
      { label: 'Home',     path: '/' },
      { label: 'Bracket',  path: '/world-cup-2026/bracket' },
      { label: 'Round32',  path: '/world-cup-2026/round-of-32' },
      { label: 'Match',    discover: (h, p) => firstMatch(h, p, RE_MATCH) },
      { label: 'Back',     path: '/world-cup-2026' },
    ],
  },
  {
    name: 'Journey 2 — Standings → Group → Team → Match',
    steps: [
      { label: 'Standings', path: '/world-cup-2026-standings' },
      { label: 'Group',     path: '/world-cup-2026/group-a' },
      { label: 'Team',      discover: (h, p) => firstMatch(h, p, RE_TEAM) },
      { label: 'Match',     discover: (h, p) => firstMatch(h, p, RE_MATCH) },
    ],
  },
  {
    name: 'Journey 3 — Fixtures → Match',
    steps: [
      { label: 'Fixtures', path: '/world-cup-2026/fixtures' },
      { label: 'Match',    discover: (h, p) => firstMatch(h, p, RE_MATCH) },
    ],
  },
  {
    name: 'Journey 4 — Results → Match',
    steps: [
      { label: 'Results', path: '/world-cup-2026/results' },
      { label: 'Match',   discover: (h, p) => firstMatch(h, p, RE_MATCH) },
    ],
  },
  {
    name: 'Journey 5 — Schedule → Match',
    steps: [
      { label: 'Schedule', path: '/world-cup-2026-schedule' },
      { label: 'Match',    discover: (h, p) => firstMatch(h, p, RE_MATCH) },
    ],
  },
  {
    name: 'Journey 6 — SEO Bracket → Round → Match',
    steps: [
      { label: 'SEO Bracket', path: '/world-cup-2026-bracket' },
      { label: 'Round',       discover: (h, p) => firstMatch(h, p, RE_ROUND) },
      { label: 'Match',       discover: (h, p) => firstMatch(h, p, RE_MATCH) },
    ],
  },
];

// ─── Runner ────────────────────────────────────────────────────────────────────

function gate(res, path) {
  if (res.status === 'TIMEOUT') return `timed out after ${res.ms}ms`;
  if (res.status === 'ERR')     return `network error: ${res.error}`;
  if (typeof res.status === 'number' && res.status >= 400) return `HTTP ${res.status}`;
  for (const phrase of ERROR_PHRASES) {
    if (res.html.includes(phrase)) return `error card: "${phrase}"`;
  }
  return null; // pass
}

async function runJourney(j) {
  console.log(`\n▶ ${j.name}`);
  let prevHtml = '';
  let prevPath = '';
  for (const step of j.steps) {
    let path = step.path;
    if (!path && step.discover) {
      path = step.discover(prevHtml, prevPath);
      if (!path) {
        console.error(`  ✗ ${step.label}: dead end — no link to follow from ${prevPath}`);
        return { ok: false, failedAt: step.label, reason: `no ${step.label} link on ${prevPath}` };
      }
    }
    const res = await fetchPage(path);
    const fail = gate(res, path);
    const shown = res.finalPath && res.finalPath !== path ? `${path} → ${res.finalPath}` : path;
    if (fail) {
      console.error(`  ✗ ${step.label}: ${shown} — ${fail}`);
      return { ok: false, failedAt: step.label, reason: `${shown}: ${fail}` };
    }
    console.log(`  ✓ ${step.label}: ${shown} [${res.ms}ms]`);
    prevHtml = res.html;
    prevPath = res.finalPath || path;
  }
  return { ok: true };
}

async function bracketParity() {
  console.log(`\n▶ Bracket parity — SEO vs nested must expose the same match identities`);
  const seo    = await fetchPage('/world-cup-2026-bracket');
  const nested = await fetchPage('/world-cup-2026/bracket');
  if (gate(seo, '/world-cup-2026-bracket') || gate(nested, '/world-cup-2026/bracket')) {
    console.error('  ✗ one of the bracket pages failed to load — cannot compare');
    return { ok: false, failedAt: 'parity', reason: 'bracket page load failed' };
  }
  const seoIds    = matchIds(seo.html, '/world-cup-2026-bracket');
  const nestedIds = matchIds(nested.html, '/world-cup-2026/bracket');
  const onlySeo    = [...seoIds].filter((id) => !nestedIds.has(id));
  const onlyNested = [...nestedIds].filter((id) => !seoIds.has(id));
  console.log(`  SEO match ids: ${seoIds.size} | nested match ids: ${nestedIds.size}`);
  if (onlySeo.length || onlyNested.length) {
    console.error(`  ✗ parity mismatch — only-SEO: [${onlySeo.join(',')}] only-nested: [${onlyNested.join(',')}]`);
    return { ok: false, failedAt: 'parity', reason: `SEO/nested match-id sets differ (${onlySeo.length} only-SEO, ${onlyNested.length} only-nested)` };
  }
  console.log('  ✓ identical match-id sets');
  return { ok: true };
}

// ─── Server bootstrap (AUTO_SERVER) ──────────────────────────────────────────

let _server = null;
const isUp = async (url) => { try { await fetch(url, { signal: AbortSignal.timeout(2500) }); return true; } catch { return false; } };

async function ensureServer() {
  if (await isUp(`${BASE_URL}/`)) return true;
  if (!AUTO_SERVER) {
    console.error(`\n❌ No server at ${BASE_URL}. Start one (npm run start) or set CRAWL_BASE_URL / AUTO_SERVER=1.\n`);
    return false;
  }
  console.log('\n🚀 Starting `next start`…');
  _server = spawn('npm', ['run', 'start'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env } });
  _server.stdout.on('data', () => {}); _server.stderr.on('data', () => {});
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await isUp(`${BASE_URL}/`)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  console.log(`\n🧭 WC End-to-End Journey Check`);
  console.log(`   Base URL: ${BASE_URL}`);
  if (!(await ensureServer())) process.exit(1);

  const results = [];
  for (const j of JOURNEYS) results.push({ name: j.name, ...(await runJourney(j)) });
  const parity = await bracketParity();
  results.push({ name: 'Bracket parity', ...parity });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(64)}`);
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` — FAILED at ${r.failedAt}: ${r.reason}`}`);

  if (_server) _server.kill('SIGTERM');

  if (failed.length) {
    console.error(`\n❌ SPRINT FAIL — ${failed.length}/${results.length} journey check(s) failed.\n`);
    process.exit(1);
  }
  console.log(`\n✅ ALL ${results.length} JOURNEYS PASS — end-to-end navigation healthy.\n`);
  process.exit(0);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (_server) _server.kill('SIGTERM'); process.exit(1); });
main().catch((err) => { console.error('\nFatal:', err); if (_server) _server.kill('SIGTERM'); process.exit(1); });
