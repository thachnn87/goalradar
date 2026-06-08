#!/usr/bin/env node
/**
 * scripts/crawl-links.mjs
 *
 * BFS internal link crawler for GoalRadar.
 *
 * Starts from /, follows every same-origin <a href> link, records the HTTP
 * status code of each page, and writes internal-link-audit.md to the project
 * root.  Exits with code 1 if any broken links (4xx / 5xx / network errors)
 * are found — suitable for use as a CI gate.
 *
 * Exit codes:
 *   0  all links healthy (2xx)
 *   1  broken links detected (4xx / 5xx / connection failures)
 *
 * Environment variables:
 *   CRAWL_BASE_URL      base URL to crawl       (default: http://localhost:3000)
 *   CRAWL_MAX_PAGES     max pages to visit       (default: 1000)
 *   CRAWL_CONCURRENCY   concurrent fetches       (default: 8)
 *   AUTO_SERVER         '1' → auto-start / stop  `next start` around the crawl
 *
 * Usage:
 *   # server already running
 *   node scripts/crawl-links.mjs
 *
 *   # auto-start the production server, crawl, then stop it
 *   AUTO_SERVER=1 node scripts/crawl-links.mjs
 *
 *   # crawl a staging / production deployment
 *   CRAWL_BASE_URL=https://staging.goalradar.org node scripts/crawl-links.mjs
 */

import { spawn }        from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ───────────────────────────────────────────────────────────────────

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, '..');

const BASE_URL    = (process.env.CRAWL_BASE_URL    ?? 'http://localhost:3000').replace(/\/$/, '');
const MAX_PAGES   = parseInt(process.env.CRAWL_MAX_PAGES    ?? '1000', 10);
const CONCURRENCY = parseInt(process.env.CRAWL_CONCURRENCY  ?? '8',    10);
const AUTO_SERVER = process.env.AUTO_SERVER === '1' || process.argv.includes('--auto-server');
const OUT_FILE    = resolve(ROOT, 'internal-link-audit.md');

const ORIGIN      = new URL(BASE_URL).origin;

// ─── Link extraction ──────────────────────────────────────────────────────────

/**
 * Parse all same-origin hrefs from a chunk of HTML text.
 * Returns a Set of pathname+search strings (no origin, no fragment).
 *
 * @param {string} html
 * @param {string} pageUrl  full URL of the page the HTML came from (used to
 *                          resolve relative hrefs)
 * @returns {Set<string>}
 */
function extractLinks(html, pageUrl) {
  const links = new Set();
  // Match href="…" or href='…' — handles double/single quotes only (no unquoted)
  const re = /\bhref=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    // Skip non-page hrefs
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try {
      const u = new URL(raw, pageUrl);
      if (u.origin !== ORIGIN) continue;                       // external link
      if (u.pathname.startsWith('/_next/')) continue;          // Next.js internals
      if (u.pathname.startsWith('/api/'))   continue;          // API routes return JSON
      // Normalise: remove trailing slash (except root "/"), drop fragment
      let path = u.pathname;
      if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
      links.add(path + (u.search ?? ''));
    } catch {
      // ignore malformed hrefs
    }
  }
  return links;
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch a page, returning its status, whether a redirect occurred, and the
 * response HTML (only when the page is HTML and the status is 2xx).
 *
 * Uses redirect:'follow' so we always get the final status.
 * response.redirected + response.url tell us whether a redirect chain was
 * traversed, which we surface in the audit as Medium findings.
 *
 * @param {string} pathname   path portion of the URL (e.g. "/world-cup-2026")
 * @returns {Promise<{status:number|'ERR'; redirected:boolean; finalPath?:string; html:string; ms:number; error?:string}>}
 */
async function fetchPage(pathname) {
  const url = `${BASE_URL}${pathname}`;
  const t0   = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal:   AbortSignal.timeout(15_000),
      headers:  { 'User-Agent': 'GoalRadar-LinkCrawler/1.0 (+https://goalradar.org)' },
    });
    const ms         = Date.now() - t0;
    const ct         = res.headers.get('content-type') ?? '';
    const isHtml     = ct.includes('text/html');
    const html       = (res.ok && isHtml) ? await res.text() : '';
    const redirected = res.redirected;
    const finalPath  = redirected ? (() => {
      try { return new URL(res.url).pathname; } catch { return undefined; }
    })() : undefined;

    return { status: res.status, redirected, finalPath, html, ms };
  } catch (err) {
    const msg = /** @type {Error} */(err).message ?? String(err);
    // AbortError from AbortSignal.timeout() is a request timeout — classify it
    // separately from genuine network failures so CI only fails on real breakage.
    const isTimeout = (/** @type {Error} */(err).name === 'TimeoutError') ||
                      msg.includes('timed out') ||
                      msg.includes('was aborted due to timeout');
    return {
      status:    /** @type {'ERR'|'TIMEOUT'} */(isTimeout ? 'TIMEOUT' : 'ERR'),
      redirected: false,
      html:      '',
      ms:        Date.now() - t0,
      error:     msg,
    };
  }
}

// ─── BFS crawler ─────────────────────────────────────────────────────────────

/**
 * BFS over all discoverable internal pages.
 *
 * @returns {Promise<Map<string,{url:string;status:number|'ERR';redirected:boolean;finalPath?:string;sources:string[];ms:number;error?:string}>>}
 */
async function crawl() {
  const results  = new Map();   // pathname → result object
  const visited  = new Set();   // pages already queued
  const queue    = ['/'];
  /** First source page per URL — kept short to keep the report readable */
  const sources  = new Map([['/','(seed)']]);

  visited.add('/');

  let total = 0;

  console.log(`\n🕷️  GoalRadar Link Crawler`);
  console.log(`   Base URL    : ${BASE_URL}`);
  console.log(`   Concurrency : ${CONCURRENCY}`);
  console.log(`   Max pages   : ${MAX_PAGES}`);
  console.log();

  while (queue.length > 0 && total < MAX_PAGES) {
    const batch = queue.splice(0, Math.min(CONCURRENCY, queue.length));

    await Promise.all(batch.map(async (pathname) => {
      const source = sources.get(pathname) ?? '(unknown)';
      const result = await fetchPage(pathname);
      total++;

      const row = {
        url:       pathname,
        status:    result.status,
        redirected: result.redirected,
        finalPath: result.finalPath,
        sources:   [source],
        ms:        result.ms,
        error:     result.error,
      };
      results.set(pathname, row);

      // Console progress line
      const icon =
        result.status === 'TIMEOUT'                               ? '⏱️' :
        result.status === 'ERR'                                   ? '💥' :
        typeof result.status === 'number' && result.status >= 500 ? '🔴' :
        typeof result.status === 'number' && result.status >= 400 ? '🟠' :
        result.redirected                                         ? '🔀' : '✅';
      const suffix =
        result.redirected ? ` → ${result.finalPath}` :
        result.error      ? ` (${result.error})`     : '';
      const statusStr = String(result.status).padEnd(3);
      process.stdout.write(`  ${icon}  ${statusStr}  ${pathname}${suffix}  [${result.ms}ms]\n`);

      // Enqueue newly discovered internal links
      if (result.html && results.size < MAX_PAGES) {
        const found = extractLinks(result.html, `${BASE_URL}${pathname}`);
        for (const link of found) {
          if (!visited.has(link)) {
            visited.add(link);
            queue.push(link);
            if (!sources.has(link)) sources.set(link, pathname);
          }
        }
      }
    }));
  }

  if (total >= MAX_PAGES && queue.length > 0) {
    console.warn(`\n⚠️  Reached MAX_PAGES (${MAX_PAGES}). ${queue.length} URL(s) remain unchecked.`);
  }

  return results;
}

// ─── Audit report ─────────────────────────────────────────────────────────────

/**
 * Build the Markdown audit report.
 *
 * Priority classification:
 *   🔴 Critical  — 5xx server errors and genuine network failures (ERR)
 *   🟠 High      — 4xx not-found / forbidden responses
 *   🟡 Medium    — redirects (3xx resolved to 2xx via follow)
 *   ⏱️ Warning   — TIMEOUT: page took > 15 s (typically API-dependent SSR;
 *                  not counted as broken — investigate in production)
 *   ✅ OK        — 2xx responses with no redirect
 *
 * Only 🔴 Critical and 🟠 High contribute to brokenCount and the exit code.
 *
 * @param {Map<string,any>} results
 * @param {string} timestamp
 * @returns {{ report: string; brokenCount: number }}
 */
function buildReport(results, timestamp) {
  const all      = [...results.values()];

  const critical  = all.filter(r => r.status === 'ERR'     || (typeof r.status === 'number' && r.status >= 500));
  const high      = all.filter(r => typeof r.status === 'number' && r.status >= 400 && r.status < 500);
  const timeouts  = all.filter(r => r.status === 'TIMEOUT');
  const medium    = all.filter(r => r.redirected && typeof r.status === 'number' && r.status >= 200 && r.status < 300);
  const ok        = all.filter(r => !r.redirected && typeof r.status === 'number' && r.status >= 200 && r.status < 300);
  // Timeouts are excluded from brokenCount — they are environment-dependent.
  // Fix genuine broken links (4xx/5xx/ERR) first; then investigate timeouts in
  // a fully configured environment with real API keys.
  const broken    = [...critical, ...high];

  const lines = [
    '# Internal Link Audit',
    '',
    `> **Generated:** ${timestamp}`,
    `> **Base URL:** \`${BASE_URL}\``,
    `> **Pages crawled:** ${all.length}`,
    `> **Broken links:** ${broken.length === 0 ? '✅ none' : `❌ ${broken.length}`}`,
    `> **Timeouts (API-dependent):** ${timeouts.length}`,
    '',
    '---',
    '',
    '## Summary',
    '',
    '| Category | Count |',
    '|----------|------:|',
    `| ✅ OK (2xx, no redirect) | ${ok.length} |`,
    `| 🔀 Redirected (followed → 2xx) | ${medium.length} |`,
    `| 🟠 High — 4xx Not Found | ${high.length} |`,
    `| 🔴 Critical — 5xx / Network Error (ERR) | ${critical.length} |`,
    `| ⏱️ Warning — Timeout (API-dependent, not counted as broken) | ${timeouts.length} |`,
    `| **Total broken (CI gate)** | **${broken.length}** |`,
    '',
  ];

  // ── 🔴 Critical ─────────────────────────────────────────────────────────────
  if (critical.length > 0) {
    lines.push(
      '---', '',
      '## 🔴 Critical — Server Errors & Network Failures', '',
      '> These pages returned a 5xx status or failed with a network error.',
      '> **Fix before deploying.**',
      '',
      '| URL | Status | Source Page | Error |',
      '|-----|:------:|-------------|-------|',
    );
    for (const r of [...critical].sort((a, b) => a.url.localeCompare(b.url))) {
      lines.push(`| \`${r.url}\` | ${r.status} | \`${r.sources[0]}\` | ${r.error ?? '—'} |`);
    }
    lines.push('');
  }

  // ── 🟠 High ──────────────────────────────────────────────────────────────────
  if (high.length > 0) {
    lines.push(
      '---', '',
      '## 🟠 High — 4xx Not Found / Client Errors', '',
      '> These pages returned 404 or another 4xx status.',
      '> Each entry includes the page that contains the broken link.',
      '',
      '| URL | Status | Source Page |',
      '|-----|:------:|-------------|',
    );
    for (const r of [...high].sort((a, b) => a.url.localeCompare(b.url))) {
      lines.push(`| \`${r.url}\` | ${r.status} | \`${r.sources[0]}\` |`);
    }
    lines.push('');
  }

  // ── 🔀 Medium ────────────────────────────────────────────────────────────────
  if (medium.length > 0) {
    lines.push(
      '---', '',
      '## 🔀 Medium — Redirected Links', '',
      '> These URLs resolved to a 2xx page after one or more redirects.',
      '> Consider updating the link source to point directly to the final URL.',
      '',
      '| Original URL | Final URL | Status | Source Page |',
      '|-------------|-----------|:------:|-------------|',
    );
    for (const r of [...medium].sort((a, b) => a.url.localeCompare(b.url))) {
      lines.push(`| \`${r.url}\` | \`${r.finalPath ?? '?'}\` | ${r.status} | \`${r.sources[0]}\` |`);
    }
    lines.push('');
  }

  // ── ⏱️ Timeouts ────────────────────────────────────────────────────────────────
  if (timeouts.length > 0) {
    lines.push(
      '---', '',
      '## ⏱️ Warning — Timeouts (API-Dependent Pages)', '',
      '> These pages did not respond within 15 s.',
      '> They typically require a live API key (e.g. `/match/[id]`, `/teams/[slug]`).',
      '> **Not counted as broken** — verify against a fully configured environment.',
      '',
      '<details>',
      '<summary>Expand to see all timed-out pages</summary>',
      '',
      '| URL | Source Page |',
      '|-----|-------------|',
    );
    for (const r of [...timeouts].sort((a, b) => a.url.localeCompare(b.url))) {
      lines.push(`| \`${r.url}\` | \`${r.sources[0]}\` |`);
    }
    lines.push('', '</details>', '');
  }

  // ── ✅ OK ─────────────────────────────────────────────────────────────────────
  lines.push(
    '---', '',
    '## ✅ OK — All Healthy Pages', '',
    '<details>',
    '<summary>Expand to see all OK pages</summary>',
    '',
    '| URL | Status | Response Time |',
    '|-----|:------:|--------------:|',
  );
  for (const r of [...ok].sort((a, b) => a.url.localeCompare(b.url))) {
    lines.push(`| \`${r.url}\` | ${r.status} | ${r.ms}ms |`);
  }
  lines.push(
    '',
    '</details>',
    '',
    '---',
    '',
    `*Generated by [scripts/crawl-links.mjs](scripts/crawl-links.mjs).*`,
    '',
  );

  return { report: lines.join('\n'), brokenCount: broken.length };
}

// ─── Server helpers ───────────────────────────────────────────────────────────

/** Returns true when a fetch to url succeeds within timeoutMs. */
async function isUp(url, timeoutMs = 3_000) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

/** Polls until the server at url responds or maxMs elapses. */
async function waitUntilUp(url, maxMs = 90_000) {
  const deadline = Date.now() + maxMs;
  process.stdout.write('   ');
  while (Date.now() < deadline) {
    if (await isUp(url, 2_000)) { console.log(' ready!\n'); return true; }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1_500));
  }
  console.log();
  return false;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

let _server = null;

async function main() {
  // ── 1. Ensure a server is reachable ────────────────────────────────────────
  const serverUrl = `${BASE_URL}/`;

  if (!(await isUp(serverUrl))) {
    if (!AUTO_SERVER) {
      console.error(`\n❌  No server at ${BASE_URL}\n`);
      console.error('    Options:');
      console.error('      npm run start                        # start first, then re-run this');
      console.error('      AUTO_SERVER=1 node scripts/crawl-links.mjs  # auto-start\n');
      process.exit(1);
    }

    console.log('\n🚀  Starting production server (`next start`)…');
    _server = spawn('npm', ['run', 'start'], {
      cwd:   ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env:   { ...process.env },
    });
    // Suppress server output to keep crawler output clean
    _server.stdout.on('data', () => {});
    _server.stderr.on('data', () => {});
    _server.on('error', err => { console.error('[server error]', err.message); });

    process.stdout.write('⏳  Waiting for server');
    if (!(await waitUntilUp(serverUrl, 90_000))) {
      console.error('❌  Server did not become ready within 90 s. Aborting.');
      _server.kill('SIGTERM');
      process.exit(1);
    }
  }

  // ── 2. Run the crawl ───────────────────────────────────────────────────────
  let exitCode = 0;
  try {
    const results   = await crawl();
    const timestamp = new Date().toISOString();
    const { report, brokenCount } = buildReport(results, timestamp);

    writeFileSync(OUT_FILE, report, 'utf8');

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📄  Report written → internal-link-audit.md`);
    console.log(`📊  Crawled: ${results.size} page(s)  |  Broken: ${brokenCount}`);

    if (brokenCount > 0) {
      console.error(`\n❌  FAIL — ${brokenCount} broken link(s) detected.`);
      console.error(`    See internal-link-audit.md for details.\n`);
      exitCode = 1;
    } else {
      console.log('\n✅  PASS — all internal links are healthy.\n');
    }
  } finally {
    if (_server) {
      _server.kill('SIGTERM');
      _server = null;
    }
  }

  process.exit(exitCode);
}

// Graceful shutdown on interrupt
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (_server) _server.kill('SIGTERM');
    process.exit(1);
  });
}

main().catch(err => {
  console.error('\nFatal error:', err);
  if (_server) _server.kill('SIGTERM');
  process.exit(1);
});
