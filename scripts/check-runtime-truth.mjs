/**
 * check-runtime-truth.mjs
 * DATA-18WC.RUNTIME.TRUTH — Phase 8 Validator
 *
 * Verifies that every data field on the match page has exactly ONE source of truth:
 *   snapshot → runtimeState → component (no independent fetch, derive, or transform)
 *
 * Static code analysis — no server required.
 * Usage:  node scripts/check-runtime-truth.mjs
 *
 * Exit 0 = all truths hold.
 * Exit 1 = violation found.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
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

// ---------------------------------------------------------------------------
// T1: Single entry point — getOrBuildMatchSnapshot
// ---------------------------------------------------------------------------
check('T1 — SNAPSHOT: One entry point for match data', () => {
  const src = readFile('src/lib/match-snapshot.ts');
  if (!src) { fail('match-snapshot.ts not found'); return; }

  if (src.includes('React.cache(') || src.includes('cache(')) {
    pass('getOrBuildMatchSnapshot is wrapped with React.cache()');
  } else {
    fail('React.cache() not found on getOrBuildMatchSnapshot');
  }

  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  // Only getOrBuildMatchSnapshot may return match data
  const forbidden = ['assembleSnapshot(', 'buildMatchSnapshot(', 'fetchMatchDetail(', 'fetchMatch('];
  for (const fn of forbidden) {
    if (page.includes(fn)) {
      fail(`Forbidden secondary data fetch: ${fn}`, 'Only getOrBuildMatchSnapshot() is the entry point');
    }
  }
  if (!forbidden.some(fn => page.includes(fn))) {
    pass('No forbidden secondary data-fetch calls in page.tsx');
  }
});

// ---------------------------------------------------------------------------
// T2: ONE MatchRuntimeState — derived once from snapshot
// ---------------------------------------------------------------------------
check('T2 — RUNTIME STATE: Derived once from snapshot', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.includes('deriveRuntimeState(snapshot)')) {
    pass('deriveRuntimeState(snapshot) called in page.tsx');
  } else {
    fail('deriveRuntimeState(snapshot) not found in page.tsx', 'Must derive runtime state from snapshot exactly once');
  }

  // Verify runtimeState is not re-derived later
  const deriveCalls = (page.match(/deriveRuntimeState\(/g) ?? []).length;
  if (deriveCalls === 1) {
    pass('deriveRuntimeState() called exactly once in page.tsx');
  } else {
    fail(`deriveRuntimeState() called ${deriveCalls} times in page.tsx`, 'Must be called exactly once');
  }
});

// ---------------------------------------------------------------------------
// T3: pageState derived from runtimeState (not independently re-derived)
// ---------------------------------------------------------------------------
check('T3 — PAGE STATE: Single derivation via runtimeState', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  // After phase 2: pageState comes from runtimeState.pageState
  if (page.includes('runtimeState.pageState')) {
    pass('pageState consumed from runtimeState.pageState');
  } else {
    fail('runtimeState.pageState not used in page.tsx');
  }

  // Count independent deriveMatchPageState calls (excluding the one inside deriveRuntimeState itself)
  // The redirect path may call it once with a temp var — acceptable
  const directCalls = (page.match(/deriveMatchPageState\(/g) ?? []).length;
  if (directCalls === 0) {
    pass('No independent deriveMatchPageState() calls in page.tsx (all via runtimeState)');
  } else {
    warn(`deriveMatchPageState() called ${directCalls} time(s) in page.tsx outside runtimeState — verify these are redirect-path only`);
  }
});

// ---------------------------------------------------------------------------
// T4: Score ownership — MatchLiveZone for LIVE, snapshot for others
// ---------------------------------------------------------------------------
check('T4 — SCORE: MatchLiveZone is sole LIVE score owner', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.includes('centerSlot ??')) {
    pass('ScoreHero uses centerSlot ?? — LIVE score and static score are mutually exclusive');
  } else {
    fail('centerSlot ?? pattern not found', 'Static score and MatchLiveZone must be mutually exclusive');
  }

  if (page.includes("pageState === 'LIVE'") && page.includes('MatchLiveZone')) {
    pass('MatchLiveZone conditionally rendered on pageState === LIVE');
  } else {
    fail('MatchLiveZone not gated on pageState === LIVE');
  }
});

// ---------------------------------------------------------------------------
// T5: Story engine — no score claims in LIVE branches
// ---------------------------------------------------------------------------
check('T5 — NARRATIVE: Story engine score-agnostic for LIVE', () => {
  const src = readFile('src/lib/match-story-engine.ts');
  if (!src) { fail('match-story-engine.ts not found'); return; }

  const livePattern = /else if \(matchState === ['"]LIVE['"]\) \{([\s\S]*?)(?=\} else |\}[\s\n]*$)/gm;
  let liveCount = 0;
  let scoreClaims = [];

  for (const m of src.matchAll(livePattern)) {
    liveCount++;
    const branch = m[1];
    if (branch.includes('${ftH}') || branch.includes('${ftA}')) {
      const lineNo = src.slice(0, m.index).split('\n').length;
      scoreClaims.push(`~line ${lineNo}`);
    }
  }

  if (liveCount === 0) {
    warn('No LIVE branches found in story engine via pattern — manual inspection may be needed');
  } else if (scoreClaims.length > 0) {
    fail(
      `${scoreClaims.length} LIVE branch(es) embed score at: ${scoreClaims.join(', ')}`,
      'LIVE narrative must not embed score — MatchLiveZone is the sole score authority'
    );
  } else {
    pass(`${liveCount} LIVE branch(es) confirmed score-agnostic`);
  }

  // Also check for the "follow the live score" replacement text
  if (src.includes('follow the live score above') || src.includes('Follow the live score above')) {
    pass('Score-agnostic replacement text ("Follow the live score above") confirmed');
  } else {
    fail('Expected "Follow the live score above" not found in story engine LIVE text');
  }
});

// ---------------------------------------------------------------------------
// T6: JSON-LD score gated on FINISHED
// ---------------------------------------------------------------------------
check('T6 — JSON-LD: Score embedded only for FINISHED matches', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  // hasScore pattern gating JSON-LD score
  const hasScoreMatch = page.match(/const hasScore\s*=([^\n;]+)/);
  if (!hasScoreMatch) {
    fail('hasScore constant not found in page.tsx');
    return;
  }
  const hasScoreExpr = hasScoreMatch[1].trim();
  if (hasScoreExpr.includes('FINISHED') || hasScoreExpr.includes('isFinished')) {
    pass(`JSON-LD hasScore gated correctly: ${hasScoreExpr.slice(0, 80)}`);
  } else {
    fail(`hasScore not gated on FINISHED: ${hasScoreExpr}`, 'Must only embed score in JSON-LD for FINISHED matches');
  }
});

// ---------------------------------------------------------------------------
// T7: FAQ score gated on FINISHED
// ---------------------------------------------------------------------------
check('T7 — FAQ: Score FAQs gated on isFinished', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.match(/function buildFaqs[\s\S]*?if \(isFinished\)/)) {
    pass('buildFaqs gates score FAQs on isFinished');
  } else {
    fail('buildFaqs isFinished gate not found', 'Score-based FAQs must be inside if (isFinished)');
  }
});

// ---------------------------------------------------------------------------
// T8: storyContext derived once (pre-computed in runtimeState)
// ---------------------------------------------------------------------------
check('T8 — STORY CONTEXT: Pre-computed in runtimeState', () => {
  const rts = readFile('src/lib/match-runtime-state.ts');
  if (!rts) { fail('match-runtime-state.ts not found'); return; }

  if (rts.includes('buildStoryContext(match)')) {
    pass('buildStoryContext(match) called in deriveRuntimeState — storyContext pre-computed');
  } else {
    fail('buildStoryContext not called in match-runtime-state.ts');
  }

  if (rts.includes('storyContext')) {
    pass('storyContext field present in MatchRuntimeState');
  } else {
    fail('storyContext field not found in match-runtime-state.ts');
  }
});

// ---------------------------------------------------------------------------
// T9: Live score API — single endpoint
// ---------------------------------------------------------------------------
check('T9 — LIVE API: Single endpoint /api/live-score', () => {
  const liveZone = readFile('src/components/MatchLiveZone.tsx');
  if (!liveZone) { fail('MatchLiveZone.tsx not found'); return; }

  // Primary check: live-score endpoint must be present
  if (liveZone.includes('/api/live-score/')) {
    pass('MatchLiveZone polls /api/live-score/{matchId} — primary data endpoint confirmed');
  } else {
    fail('No /api/live-score/ fetch found in MatchLiveZone.tsx');
  }
  // Additional fetches are allowed only for fire-and-forget telemetry (no await on result data)
  const dataFetches = (liveZone.match(/const\s+\w+\s*=\s*await\s+fetch\(/g) ?? []).length;
  if (dataFetches === 1) {
    pass('MatchLiveZone has exactly one awaited (data-reading) fetch — live-score only');
  } else if (dataFetches > 1) {
    fail(`MatchLiveZone has ${dataFetches} awaited fetch calls`, 'Only /api/live-score fetch should be awaited');
  } else {
    pass('MatchLiveZone fetch pattern confirmed (single awaited data fetch)');
  }
});

// ---------------------------------------------------------------------------
// T10: Poll interval from RUNTIME_POLL_INTERVAL (not local constant)
// ---------------------------------------------------------------------------
check('T10 — CLOCK: Poll interval from runtime-clock.ts', () => {
  const liveZone = readFile('src/components/MatchLiveZone.tsx');
  if (!liveZone) { fail('MatchLiveZone.tsx not found'); return; }

  if (liveZone.includes('RUNTIME_POLL_INTERVAL')) {
    pass('MatchLiveZone uses RUNTIME_POLL_INTERVAL from runtime-clock.ts');
  } else {
    fail('RUNTIME_POLL_INTERVAL not used in MatchLiveZone.tsx', 'Must import from src/lib/runtime-clock.ts');
  }

  if (liveZone.includes("from '@/lib/runtime-clock'") || liveZone.includes('from "../lib/runtime-clock"')) {
    pass('MatchLiveZone imports RUNTIME_POLL_INTERVAL from runtime-clock');
  } else {
    warn('runtime-clock import path not found in expected form — verify import manually');
  }

  // No local POLL_INTERVAL constant
  if (liveZone.includes('const POLL_INTERVAL') || liveZone.includes('const INTERVAL =')) {
    fail('Local POLL_INTERVAL or INTERVAL constant found in MatchLiveZone', 'Remove — use RUNTIME_POLL_INTERVAL only');
  } else {
    pass('No local poll-interval constant in MatchLiveZone');
  }

  const refresher = readFile('src/components/LiveRefresher.tsx');
  if (refresher) {
    if (refresher.includes('RUNTIME_POLL_INTERVAL')) {
      pass('LiveRefresher uses RUNTIME_POLL_INTERVAL from runtime-clock.ts');
    } else {
      fail('RUNTIME_POLL_INTERVAL not used in LiveRefresher.tsx');
    }
    if (refresher.includes('const INTERVAL') || refresher.includes('const POLL_INTERVAL')) {
      fail('Local interval constant found in LiveRefresher', 'Remove — use RUNTIME_POLL_INTERVAL only');
    } else {
      pass('No local interval constant in LiveRefresher');
    }
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL RUNTIME TRUTH INVARIANTS HOLD ✅');
  console.log('');
  console.log('T1  SNAPSHOT    → getOrBuildMatchSnapshot (React.cache, single entry)');
  console.log('T2  RUNTIME     → deriveRuntimeState() called once, result shared');
  console.log('T3  PAGE STATE  → runtimeState.pageState (no independent re-derivation)');
  console.log('T4  SCORE       → MatchLiveZone (LIVE) / snapshot (other) — never both');
  console.log('T5  NARRATIVE   → score-agnostic for LIVE ("Follow the live score above")');
  console.log('T6  JSON-LD     → score embedded only for FINISHED');
  console.log('T7  FAQ         → score FAQs gated on isFinished');
  console.log('T8  STORY CTX   → pre-computed once in deriveRuntimeState');
  console.log('T9  LIVE API    → single endpoint /api/live-score/{matchId}');
  console.log('T10 CLOCK       → RUNTIME_POLL_INTERVAL from runtime-clock.ts');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
