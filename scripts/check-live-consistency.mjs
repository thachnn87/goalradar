/**
 * check-live-consistency.mjs
 * DATA-18WC.LIVE.TRUTH — Phase 6 Runtime Consistency Check
 *
 * Verifies that every live surface shows the same live match count.
 * Reads the debug API endpoint to get the KV source of truth,
 * then checks each page HTML for the live count rendered.
 *
 * Usage:
 *   node scripts/check-live-consistency.mjs
 *   BASE_URL=https://goalradar.org node scripts/check-live-consistency.mjs
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

async function fetchText(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.text();
}

function extractLiveCount(html) {
  // Count MatchCard elements with live indicator (aria-label or data attribute)
  // The live pulsing dot is always present when status is IN_PLAY/PAUSED.
  // Most reliable: count "LIVE" badge occurrences in rendered HTML.
  const liveMatches = (html.match(/\bIN_PLAY\b|\bPAUSED\b|"status":"IN_PLAY"|"status":"PAUSED"/g) ?? []).length;
  return liveMatches;
}

function extractLiveCountFromNumber(html, pattern) {
  const match = html.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function getKVLiveMatches() {
  try {
    const data = await fetchJSON('/api/debug/live-health');
    return {
      count: data.liveCount ?? data.matches?.length ?? 0,
      ids: (data.matches ?? []).map(m => m.id),
    };
  } catch (err) {
    return { count: 0, ids: [], error: err.message };
  }
}

async function checkPage(path, label) {
  try {
    const html = await fetchText(path);
    const count = extractLiveCount(html);
    return { path, label, count, ok: true };
  } catch (err) {
    return { path, label, count: null, ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('DATA-18WC.LIVE.TRUTH — Runtime Consistency Check');
  console.log('='.repeat(50));
  console.log(`Target: ${BASE_URL}`);
  console.log('');

  const [ssot, ...pages] = await Promise.all([
    getKVLiveMatches(),
    checkPage('/', 'Home (/)'),
    checkPage('/live', '/live'),
    checkPage('/world-cup-2026', 'Hub (/world-cup-2026)'),
    checkPage('/schedule?competition=WC', 'Schedule (WC)'),
    checkPage('/world-cup-2026-results', 'WC Results'),
  ]);

  console.log(`SSOT (KV live-cache):  ${ssot.count} live match(es)`);
  if (ssot.ids.length > 0) {
    console.log(`  IDs: [${ssot.ids.join(', ')}]`);
  }
  console.log('');

  let allPass = true;
  for (const page of pages) {
    if (!page.ok) {
      console.log(`  ${page.label.padEnd(30)} ERROR: ${page.error}`);
      allPass = false;
      continue;
    }
    const match = page.count === ssot.count;
    if (!match) allPass = false;
    const icon = match ? '✅' : '❌';
    const diverge = match ? '' : `  ← DIVERGES (SSOT=${ssot.count})`;
    console.log(`  ${icon} ${page.label.padEnd(30)} ${page.count} live match(es)${diverge}`);
  }

  console.log('');
  if (allPass) {
    console.log('ALL CONSISTENT ✅');
    process.exit(0);
  } else {
    console.log('DIVERGENCE DETECTED ❌');
    console.log('');
    console.log('Diagnosis:');
    console.log('  If Home shows MORE than SSOT: liveStrays bug (see ROOT_CAUSE.md)');
    console.log('  If any page shows LESS than SSOT: ISR cache stale (expected, use LiveRefresher)');
    console.log('  If /live diverges from SSOT: live-cache.ts bug');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(2);
});
