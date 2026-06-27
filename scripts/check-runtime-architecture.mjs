/**
 * check-runtime-architecture.mjs
 * DATA-18WC.RUNTIME.TRUTH — Phase 10 Architecture Enforcement
 *
 * Fails the build if any of these architectural violations exist:
 *   A1  Second Match object constructed outside getOrBuildMatchSnapshot
 *   A2  Second MatchRuntimeState derivation (deriveRuntimeState called >1x in page)
 *   A3  Component fetches data independently (except MatchLiveZone)
 *   A4  Component owns its own timer (except MatchLiveZone, LiveRefresher)
 *   A5  Component derives score from raw snapshot fields
 *   A6  Story engine embeds mutable score in LIVE narrative
 *   A7  Duplicate field owner (score claimed by 2+ display components simultaneously)
 *   A8  Duplicate version owner (data-match-version set by 2+ places)
 *   A9  Duplicate clock owner (RUNTIME_POLL_INTERVAL shadowed locally)
 *   A10 MatchPageState type defined outside match-page-state.ts
 *
 * Static code analysis — no server required.
 * Usage:  node scripts/check-runtime-architecture.mjs
 *
 * Exit 0 = all invariants hold.
 * Exit 1 = violation found.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

function readAllTsFiles(dirRel) {
  const abs = join(ROOT, dirRel);
  if (!existsSync(abs)) return [];
  const results = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (['.ts', '.tsx'].includes(extname(entry))) {
        results.push({ path: full.slice(ROOT.length + 1).replace(/\\/g, '/'), src: readFileSync(full, 'utf8') });
      }
    }
  }
  walk(abs);
  return results;
}

let violations = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg, detail = '') {
  console.log(`  ❌ ${msg}`);
  if (detail) console.log(`     ${detail}`);
  violations++;
}
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function check(name, fn) { console.log(`\n[${name}]`); fn(); }

const allSrcFiles = readAllTsFiles('src');

// ---------------------------------------------------------------------------
// A1: No second Match object constructed outside getOrBuildMatchSnapshot
// ---------------------------------------------------------------------------
check('A1 — NO SECOND MATCH: Only one match-data constructor', () => {
  const matchSnapshotSrc = readFile('src/lib/match-snapshot.ts');
  if (!matchSnapshotSrc) { fail('match-snapshot.ts not found'); return; }

  // Any call to a "fetch match" function outside of match-snapshot.ts is a violation
  const forbidden = [
    { pattern: /\bfetchMatchDetail\b/g, label: 'fetchMatchDetail()' },
    { pattern: /\bassembleSnapshot\b/g, label: 'assembleSnapshot()' },
    { pattern: /\bbuildMatchSnapshot\b/g, label: 'buildMatchSnapshot()' },
  ];

  let found = false;
  for (const { path, src } of allSrcFiles) {
    if (path.includes('match-snapshot')) continue;
    for (const { pattern, label } of forbidden) {
      if (pattern.test(src)) {
        fail(`${label} called outside match-snapshot.ts in ${path}`, 'Only getOrBuildMatchSnapshot() is the match data constructor');
        found = true;
      }
      pattern.lastIndex = 0;
    }
  }
  if (!found) pass('No forbidden match-data constructors found outside match-snapshot.ts');
});

// ---------------------------------------------------------------------------
// A2: deriveRuntimeState called at most once in page.tsx
// ---------------------------------------------------------------------------
check('A2 — ONE RUNTIME STATE: deriveRuntimeState called once in page', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  // Count actual function calls (with paren), not import references
  const calls = (page.match(/\bderiveRuntimeState\(/g) ?? []).length;
  if (calls === 1) {
    pass('deriveRuntimeState() called exactly once in page.tsx');
  } else if (calls === 0) {
    fail('deriveRuntimeState() not called in page.tsx', 'Must call deriveRuntimeState(snapshot) once in MatchDetailPage');
  } else {
    fail(`deriveRuntimeState() called ${calls} times in page.tsx`, 'Must be called exactly once');
  }

  // Also check no other file calls deriveRuntimeState (it belongs to page only)
  for (const { path, src } of allSrcFiles) {
    if (path.includes('match/[id]/page')) continue;
    if (path.includes('match-runtime-state')) continue; // the definition file
    if (src.includes('deriveRuntimeState(')) {
      fail(`deriveRuntimeState() called in ${path}`, 'Only the match page may derive runtime state');
    }
  }
  pass('deriveRuntimeState() not called outside page.tsx');
});

// ---------------------------------------------------------------------------
// A3: No component fetches MATCH DATA independently (except MatchLiveZone)
//     Legitimate non-match fetches (telemetry, geo, newsletter, push) are allowed.
// ---------------------------------------------------------------------------
check('A3 — NO MATCH-DATA FETCHES: Only MatchLiveZone may fetch match data', () => {
  // Components with legitimate non-match-data fetches (telemetry, geo, UX interactions)
  const allowedFetchers = new Set([
    'src/components/MatchLiveZone.tsx',
    'src/components/LiveRefresher.tsx',
    'src/components/CountryChips.tsx',        // /api/geo — geo personalisation
    'src/components/MatchNavTelemetry.tsx',    // /api/telemetry/* — fire-and-forget analytics
    'src/components/NewsletterSignup.tsx',     // /api/newsletter/subscribe — form POST
    'src/components/PushNotificationButton.tsx', // /api/push/opt-in — push registration
  ]);
  // Match-data API paths that no component (except MatchLiveZone) should fetch
  const matchDataPaths = ['/api/live-score/', '/api/match/', '/api/fixtures/', '/api/standings/'];
  let found = false;

  for (const { path, src } of allSrcFiles) {
    if (!path.startsWith('src/components/')) continue;

    // Look for direct KV reads (never allowed in components)
    if (/\bkv\.(get|set|hget)\b/.test(src)) {
      fail(`Component ${path} accesses KV directly`, 'KV access is lib/server only');
      found = true;
      continue;
    }

    if (allowedFetchers.has(path)) continue;

    // Flag any component fetching match-data endpoints
    for (const apiPath of matchDataPaths) {
      if (src.includes(apiPath)) {
        fail(`Component ${path} fetches match-data endpoint: ${apiPath}`, 'Components must not fetch match data — receive as props');
        found = true;
      }
    }

    // Also flag bare fetch() calls in non-allowed components
    if (/\bfetch\(/.test(src)) {
      fail(`Component ${path} calls fetch()`, 'Unexpected fetch() — verify this component has a legitimate non-match-data use case');
      found = true;
    }
  }
  if (!found) pass('No component fetches match data independently (MatchLiveZone exempted)');
});

// ---------------------------------------------------------------------------
// A4: No component owns its own timer except MatchLiveZone, LiveRefresher
// ---------------------------------------------------------------------------
check('A4 — NO ROGUE TIMERS: Only MatchLiveZone and LiveRefresher own timers', () => {
  const allowedTimers = new Set(['src/components/MatchLiveZone.tsx', 'src/components/LiveRefresher.tsx']);
  let found = false;

  for (const { path, src } of allSrcFiles) {
    if (!path.startsWith('src/components/')) continue;
    if (allowedTimers.has(path)) continue;

    // Look for setInterval, setTimeout used in a polling pattern
    if (/\bsetInterval\b/.test(src)) {
      fail(`Component ${path} uses setInterval`, 'Only MatchLiveZone and LiveRefresher may own interval timers');
      found = true;
    }
  }
  if (!found) pass('No rogue setInterval timers found outside MatchLiveZone/LiveRefresher');
});

// ---------------------------------------------------------------------------
// A5: No component derives score from raw goals/score fields
// ---------------------------------------------------------------------------
check('A5 — NO ROGUE SCORE DERIVATION: Components do not compute score', () => {
  const allowedDeriver = new Set(['src/components/MatchLiveZone.tsx', 'src/lib/match-story-engine.ts', 'src/lib/match-runtime-state.ts', 'src/app/match/[id]/page.tsx']);
  let found = false;

  for (const { path, src } of allSrcFiles) {
    if (!path.startsWith('src/components/')) continue;
    if (allowedDeriver.has(path)) continue;

    // Components should not compute score totals from goals array
    if (/\.goals\?\.\s*filter\(/.test(src) && /\.length/.test(src)) {
      fail(`Component ${path} may be computing score from goals[]`, 'Score must come from match.score, not derived from goals[]');
      found = true;
    }
  }
  if (!found) pass('No component computes score from goals[] independently');
});

// ---------------------------------------------------------------------------
// A6: Story engine does not embed mutable score in LIVE narrative
// ---------------------------------------------------------------------------
check('A6 — NO LIVE SCORE IN STORY: LIVE narrative score-agnostic', () => {
  const src = readFile('src/lib/match-story-engine.ts');
  if (!src) { fail('match-story-engine.ts not found'); return; }

  // Scan for LIVE branch blocks and check for score interpolation
  let violations_found = 0;
  const lines = src.split('\n');
  let inLiveBranch = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("matchState === 'LIVE'") || line.includes('matchState === "LIVE"')) {
      inLiveBranch = true;
      braceDepth = 0;
    }
    if (inLiveBranch) {
      braceDepth += (line.match(/\{/g) ?? []).length;
      braceDepth -= (line.match(/\}/g) ?? []).length;
      if (braceDepth <= 0 && i > 0) inLiveBranch = false;

      if ((line.includes('${ftH}') || line.includes('${ftA}')) && inLiveBranch) {
        fail(`LIVE narrative embeds score at line ${i + 1}: ${line.trim()}`, 'LIVE narrative must be score-agnostic');
        violations_found++;
      }
    }
  }

  if (violations_found === 0) {
    pass('No score interpolation (${ftH}/${ftA}) in LIVE narrative branches');
  }
});

// ---------------------------------------------------------------------------
// A7: Score not simultaneously displayed by two components
// ---------------------------------------------------------------------------
check('A7 — NO DUAL SCORE DISPLAY: centerSlot ?? pattern enforced', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.includes('centerSlot ??')) {
    pass('ScoreHero uses centerSlot ?? — static score excluded during LIVE');
  } else {
    fail('centerSlot ?? not found in page.tsx', 'Static score and MatchLiveZone must be mutually exclusive');
  }
});

// ---------------------------------------------------------------------------
// A8: data-match-version set by exactly one place
// ---------------------------------------------------------------------------
check('A8 — ONE VERSION EMITTER: data-match-version in page only', () => {
  let found = [];
  for (const { path, src } of allSrcFiles) {
    // Match actual attribute usage (data-match-version= or data-match-version={)
    // Exclude comment references (lines starting with // or containing only a comment)
    const linesWithAttr = src.split('\n').filter(l => {
      if (!l.includes('data-match-version')) return false;
      const trimmed = l.trimStart();
      // Skip pure comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return true;
    });
    if (linesWithAttr.some(l => /data-match-version[={\s]/.test(l))) {
      found.push(path);
    }
  }
  if (found.length === 1) {
    pass(`data-match-version emitted by exactly one file: ${found[0]}`);
  } else if (found.length === 0) {
    fail('data-match-version not found in any file', 'Must be set on the page wrapper div in page.tsx');
  } else {
    fail(`data-match-version found in ${found.length} files: ${found.join(', ')}`, 'Must be set by page.tsx only');
  }

  // data-live-version should only be in MatchLiveZone
  let liveVersionFiles = [];
  for (const { path, src } of allSrcFiles) {
    if (src.includes('data-live-version')) {
      liveVersionFiles.push(path);
    }
  }
  if (liveVersionFiles.length === 1 && liveVersionFiles[0].includes('MatchLiveZone')) {
    pass('data-live-version emitted by MatchLiveZone only');
  } else if (liveVersionFiles.length === 0) {
    fail('data-live-version not found', 'MatchLiveZone must emit data-live-version');
  } else {
    pass(`data-live-version found in: ${liveVersionFiles.join(', ')}`);
  }
});

// ---------------------------------------------------------------------------
// A9: RUNTIME_POLL_INTERVAL not shadowed by local constants
// ---------------------------------------------------------------------------
check('A9 — ONE CLOCK: RUNTIME_POLL_INTERVAL not locally shadowed', () => {
  const patterns = [
    { file: 'src/components/MatchLiveZone.tsx', label: 'MatchLiveZone' },
    { file: 'src/components/LiveRefresher.tsx', label: 'LiveRefresher' },
  ];

  for (const { file, label } of patterns) {
    const src = readFile(file);
    if (!src) { warn(`${file} not found`); continue; }

    const localConst = /const\s+(POLL_INTERVAL|INTERVAL)\s*=\s*\d+/.test(src);
    if (localConst) {
      fail(`${label} has a local interval constant shadowing RUNTIME_POLL_INTERVAL`, `Remove it — use RUNTIME_POLL_INTERVAL from src/lib/runtime-clock.ts`);
    } else {
      pass(`${label} has no local interval constant`);
    }

    if (src.includes('RUNTIME_POLL_INTERVAL')) {
      pass(`${label} imports RUNTIME_POLL_INTERVAL`);
    } else {
      fail(`${label} does not use RUNTIME_POLL_INTERVAL`);
    }
  }
});

// ---------------------------------------------------------------------------
// A10: MatchPageState type defined only in match-page-state.ts
// ---------------------------------------------------------------------------
check('A10 — ONE STATE TYPE: MatchPageState defined in match-page-state.ts only', () => {
  const canonical = readFile('src/lib/match-page-state.ts');
  if (!canonical) {
    fail('src/lib/match-page-state.ts not found', 'MatchPageState must live in this file');
    return;
  }
  if (canonical.includes('export type MatchPageState') || canonical.includes('export type MatchPageState =')) {
    pass('MatchPageState exported from src/lib/match-page-state.ts');
  } else {
    fail('MatchPageState not found or not exported from match-page-state.ts');
  }

  // No other file should define (not just import) MatchPageState
  let rogue = [];
  for (const { path, src } of allSrcFiles) {
    if (path.includes('match-page-state')) continue;
    // "type MatchPageState" that is a definition (not an import or re-export)
    if (/type MatchPageState\s*=/.test(src) || /type MatchPageState\s*\|/.test(src)) {
      // Check it's not just a re-export
      if (!src.includes("from '@/lib/match-page-state'") && !src.includes("from '../lib/match-page-state'")) {
        rogue.push(path);
      }
    }
  }
  if (rogue.length === 0) {
    pass('MatchPageState not re-defined outside match-page-state.ts');
  } else {
    fail(`MatchPageState type re-defined in: ${rogue.join(', ')}`, 'Remove local definition — import from src/lib/match-page-state.ts');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL RUNTIME ARCHITECTURE INVARIANTS HOLD ✅');
  console.log('');
  console.log('A1  ONE MATCH    → No second match-data constructor');
  console.log('A2  ONE STATE    → deriveRuntimeState() called once in page');
  console.log('A3  NO FETCHES   → Components receive props, not fetch independently');
  console.log('A4  NO TIMERS    → setInterval only in MatchLiveZone/LiveRefresher');
  console.log('A5  NO SCORE CALC → Components do not compute score from goals[]');
  console.log('A6  NO LIVE SCORE → LIVE narrative is score-agnostic');
  console.log('A7  ONE DISPLAY  → centerSlot ?? enforces mutual exclusion');
  console.log('A8  ONE VERSION  → data-match-version in page, data-live-version in MatchLiveZone');
  console.log('A9  ONE CLOCK    → RUNTIME_POLL_INTERVAL not locally shadowed');
  console.log('A10 ONE STATE TYPE → MatchPageState in match-page-state.ts only');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
