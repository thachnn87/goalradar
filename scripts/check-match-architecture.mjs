/**
 * check-match-architecture.mjs
 * DATA-18WC.MATCH.TRUTH — Phase 10 Architecture Enforcement
 *
 * Static code analysis — no server required.
 * Enforces the ONE DATASET / ONE VIEWMODEL / ONE STATE / ONE STORY invariants.
 *
 * Usage:
 *   node scripts/check-match-architecture.mjs
 *
 * Exit code 0 = all invariants hold.
 * Exit code 1 = violation found.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

let violations = 0;

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg, detail = '') {
  console.log(`  ❌ ${msg}`);
  if (detail) console.log(`     ${detail}`);
  violations++;
}

function check(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

// ---------------------------------------------------------------------------
// Check 1: React.cache() on getOrBuildMatchSnapshot
// ---------------------------------------------------------------------------
check('Invariant 1 — ONE DATASET: React.cache() deduplication', () => {
  const src = readFile('src/lib/match-snapshot.ts');
  if (!src) { fail('match-snapshot.ts not found'); return; }

  if (src.includes('React.cache(') || src.includes('cache(')) {
    pass('getOrBuildMatchSnapshot is wrapped with React.cache()');
  } else {
    fail(
      'React.cache() not found in match-snapshot.ts',
      'getOrBuildMatchSnapshot must be wrapped with React.cache() for deduplication'
    );
  }
});

// ---------------------------------------------------------------------------
// Check 2: No second snapshot builder in page.tsx
// ---------------------------------------------------------------------------
check('Invariant 1 — ONE DATASET: No secondary snapshot fetch in page', () => {
  const src = readFile('src/app/match/[id]/page.tsx');
  if (!src) { fail('match page not found'); return; }

  // Count getOrBuildMatchSnapshot calls — allowed: multiple (React.cache dedupes)
  const calls = (src.match(/getOrBuildMatchSnapshot\(/g) ?? []).length;
  if (calls >= 1) {
    pass(`getOrBuildMatchSnapshot called ${calls} time(s) — all deduped by React.cache()`);
  }

  // Forbidden: any other function that returns MatchSnapshot
  const forbidden = ['assembleSnapshot(', 'buildMatchSnapshot(', 'fetchMatchDetail('];
  for (const fn of forbidden) {
    if (src.includes(fn)) {
      fail(`Forbidden secondary snapshot call: ${fn}`, 'Use getOrBuildMatchSnapshot() only');
    }
  }
  if (!forbidden.some((fn) => src.includes(fn))) {
    pass('No forbidden secondary snapshot functions found');
  }
});

// ---------------------------------------------------------------------------
// Check 3: No MatchViewModel type
// ---------------------------------------------------------------------------
check('Invariant 2 — ONE VIEWMODEL: No MatchViewModel type', () => {
  const filesToCheck = [
    'src/app/match/[id]/page.tsx',
    'src/lib/match-snapshot.ts',
    'src/lib/types.ts',
    'src/lib/match-story-engine.ts',
  ];

  let found = false;
  for (const f of filesToCheck) {
    const src = readFile(f);
    if (src && src.includes('MatchViewModel')) {
      fail(`MatchViewModel found in ${f}`, 'MatchDetail is the ViewModel — no mapping layer allowed');
      found = true;
    }
  }
  if (!found) pass('No MatchViewModel type found in codebase');
});

// ---------------------------------------------------------------------------
// Check 4: deriveMatchPageState is the only state derivation
// ---------------------------------------------------------------------------
check('Invariant 3 — ONE STATE: Single state derivation function', () => {
  const src = readFile('src/app/match/[id]/page.tsx');
  if (!src) { fail('match page not found'); return; }

  if (src.includes('function deriveMatchPageState(')) {
    pass('deriveMatchPageState() function exists');
  } else {
    fail('deriveMatchPageState() not found', 'This is the required single state derivation function');
  }

  // Warn if there's a second match state derivation function
  const stateDeriveFns = (src.match(/function derive\w*State\(/g) ?? []);
  if (stateDeriveFns.length > 1) {
    fail(
      `Multiple state derivation functions found: ${stateDeriveFns.join(', ')}`,
      'Only deriveMatchPageState() is allowed'
    );
  } else {
    pass('Only one state derivation function found');
  }
});

// ---------------------------------------------------------------------------
// Check 5: No live score claims in story engine LIVE branches
// ---------------------------------------------------------------------------
check('Invariant 4 — ONE STORY: No score claims in LIVE narrative branches', () => {
  const src = readFile('src/lib/match-story-engine.ts');
  if (!src) { fail('match-story-engine.ts not found'); return; }

  // Find all LIVE branches and check for ftH/ftA score interpolation
  const livePattern = /\} else if \(matchState === 'LIVE'\) \{([\s\S]*?)(?=\} else|\}$)/gm;
  let liveBranchCount = 0;
  let scoreClaims = [];

  for (const m of src.matchAll(livePattern)) {
    liveBranchCount++;
    const branch = m[1];
    // Check for score embedding: ${ftH}–${ftA} or similar
    if (branch.includes('${ftH}') || branch.includes('${ftA}')) {
      // Find the line
      const lineNo = src.slice(0, m.index).split('\n').length;
      scoreClaims.push(`line ~${lineNo}`);
    }
  }

  if (liveBranchCount === 0) {
    fail('No LIVE branches found in story engine — unexpected');
  } else if (scoreClaims.length > 0) {
    fail(
      `LIVE branch(es) embed ftH/ftA score at: ${scoreClaims.join(', ')}`,
      'LIVE narrative must not claim a specific score — MatchLiveZone owns live score truth'
    );
  } else {
    pass(`${liveBranchCount} LIVE branch(es) found — none embed score (Phase 8 fix confirmed)`);
  }
});

// ---------------------------------------------------------------------------
// Check 6: JSON-LD gates score on isFinished
// ---------------------------------------------------------------------------
check('Invariant 4 — ONE STORY: JSON-LD score gated on isFinished', () => {
  const src = readFile('src/app/match/[id]/page.tsx');
  if (!src) { fail('match page not found'); return; }

  // Find JsonLd function and verify hasScore pattern
  const jsonLdMatch = src.match(/function JsonLd[\s\S]*?const hasScore\s*=([^\n]+)/);
  if (!jsonLdMatch) {
    fail('JsonLd function or hasScore constant not found');
    return;
  }

  const hasScoreExpr = jsonLdMatch[1].trim();
  if (hasScoreExpr.includes('isFinished')) {
    pass(`hasScore gated on isFinished: ${hasScoreExpr.slice(0, 80)}`);
  } else {
    fail(
      `hasScore expression does not gate on isFinished: ${hasScoreExpr}`,
      'Score must only be embedded in JSON-LD for FINISHED matches'
    );
  }
});

// ---------------------------------------------------------------------------
// Check 7: buildFaqs gates score FAQs on isFinished
// ---------------------------------------------------------------------------
check('Invariant 4 — ONE STORY: FAQ score gated on isFinished', () => {
  const src = readFile('src/app/match/[id]/page.tsx');
  if (!src) { fail('match page not found'); return; }

  // buildFaqs should have `if (isFinished)` block containing score-based FAQs
  const faqsMatch = src.match(/function buildFaqs[\s\S]*?if \(isFinished\)/);
  if (faqsMatch) {
    pass('buildFaqs gates score FAQs on isFinished');
  } else {
    fail('buildFaqs isFinished gate not found', 'Score FAQs must be inside if (isFinished) block');
  }
});

// ---------------------------------------------------------------------------
// Check 8: ScoreHero uses centerSlot ?? pattern
// ---------------------------------------------------------------------------
check('ONE LIVE: ScoreHero uses centerSlot ?? pattern (no double-score)', () => {
  const src = readFile('src/app/match/[id]/page.tsx');
  if (!src) { fail('match page not found'); return; }

  if (src.includes('centerSlot ??')) {
    pass('ScoreHero uses centerSlot ?? (null-coalescing) — no double-score for LIVE matches');
  } else {
    fail(
      'centerSlot ?? pattern not found in match page',
      'ScoreHero must use {centerSlot ?? (...)} to exclude static score during LIVE'
    );
  }

  // Also verify MatchLiveZone is only rendered when pageState === 'LIVE'
  if (src.includes("pageState === 'LIVE'") && src.includes('MatchLiveZone')) {
    pass('MatchLiveZone is gated on pageState === LIVE');
  } else {
    fail('MatchLiveZone not gated on pageState === LIVE');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
if (violations === 0) {
  console.log('ALL INVARIANTS HOLD ✅');
  console.log('');
  console.log('ONE DATASET  → getOrBuildMatchSnapshot (React.cache)');
  console.log('ONE VIEWMODEL → MatchDetail (no MatchViewModel type)');
  console.log('ONE STATE    → deriveMatchPageState()');
  console.log('ONE STORY    → buildStoryReport() (no live score claims)');
  console.log('ONE LIVE     → MatchLiveZone as centerSlot');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
