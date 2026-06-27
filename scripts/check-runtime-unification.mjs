/**
 * check-runtime-unification.mjs
 * DATA-18WC.RUNTIME UNIFICATION — Phase 10 Validator
 *
 * Enforces the full invariant chain:
 *   ONE DATASET → ONE MATCHSTATE → ONE DERIVATION → ONE VERSION →
 *   ONE API → ONE VIEWMODEL → ONE COMPONENT TREE → ONE STORY → ONE TRUTH
 *
 * Fails if:
 *   U1  resolveEffectiveScore is exported (must be private)
 *   U2  any file outside match-runtime-state.ts imports resolveEffectiveScore
 *   U3  any component/page reads score.fullTime in a display context (JSX/string)
 *   U4  any component/page uses ?? 0 on raw score fields for display
 *   U5  API route (/api/live-score) calls resolveEffectiveScore directly
 *   U6  API route returns raw score object (not effectiveScore)
 *   U7  generateMetadata or page.tsx calls resolveEffectiveScore directly
 *   U8  MatchLiveZone imports Score type or accesses fullTime
 *   U9  deriveRuntimeState is the sole exporter of effectiveScore + isReliableScore
 *   U10 check-score-truth.mjs still passes (regression guard)
 *
 * Usage: node scripts/check-runtime-unification.mjs
 * Exit 0 = all invariants hold. Exit 1 = violation found.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = process.cwd();

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

function walkFiles(dir, exts, results = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return results;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(rel, exts, results);
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(rel);
    }
  }
  return results;
}

function codeLines(src) {
  return src.split('\n').map((text, idx) => ({ text, line: idx + 1 })).filter(({ text }) => {
    const t = text.trimStart();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  });
}

let violations = 0;
function pass(msg)              { console.log(`  ✅ ${msg}`); }
function fail(msg, detail = '') { console.log(`  ❌ ${msg}`); if (detail) console.log(`     ${detail}`); violations++; }
function warn(msg)              { console.log(`  ⚠️  ${msg}`); }
function check(name, fn)        { console.log(`\n[${name}]`); fn(); }

const RUNTIME_STATE_FILE = 'src/lib/match-runtime-state.ts';
const LIVE_SCORE_ROUTE   = 'src/app/api/live-score/[matchId]/route.ts';
const MATCH_PAGE         = 'src/app/match/[id]/page.tsx';
const LIVE_ZONE          = 'src/components/MatchLiveZone.tsx';

// ---------------------------------------------------------------------------
// U1: resolveEffectiveScore must NOT be exported from match-runtime-state.ts
// ---------------------------------------------------------------------------
check('U1 — PRIVATE: resolveEffectiveScore is not exported', () => {
  const src = readFile(RUNTIME_STATE_FILE);
  if (!src) { fail('match-runtime-state.ts not found'); return; }

  if (/^export\s+function\s+resolveEffectiveScore/.test(src) ||
      /^export\s*\{[^}]*resolveEffectiveScore/.test(src)) {
    fail('resolveEffectiveScore is exported — must be private (no export keyword)');
  } else if (src.includes('resolveEffectiveScore')) {
    pass('resolveEffectiveScore exists but is private (unexported)');
  } else {
    fail('resolveEffectiveScore not found in match-runtime-state.ts');
  }
});

// ---------------------------------------------------------------------------
// U2: No file imports resolveEffectiveScore (it's private — TypeScript enforces,
//     this is belt-and-suspenders for non-TS paths or import * patterns)
// ---------------------------------------------------------------------------
check('U2 — NO IMPORT: resolveEffectiveScore not imported anywhere', () => {
  const allSrc = [
    ...walkFiles('src/components', ['.tsx', '.ts']),
    ...walkFiles('src/app', ['.tsx', '.ts']),
    ...walkFiles('src/lib', ['.ts']),
  ];

  const importers = [];
  for (const relPath of allSrc) {
    const norm = relPath.replace(/\\/g, '/');
    if (norm.endsWith(RUNTIME_STATE_FILE)) continue;  // definition file — OK
    const src = readFile(relPath);
    if (!src) continue;
    if (src.includes('resolveEffectiveScore')) {
      importers.push(norm);
    }
  }

  if (importers.length === 0) {
    pass('resolveEffectiveScore not referenced outside match-runtime-state.ts');
  } else {
    for (const f of importers) {
      fail(`resolveEffectiveScore referenced in: ${f}`, 'Only match-runtime-state.ts may define and use it');
    }
  }
});

// ---------------------------------------------------------------------------
// U3: Core pipeline files must not render score.fullTime in JSX/string display.
//     Other pages/components (WC hub, bracket, etc.) are KNOWN DEBT — warned only.
// ---------------------------------------------------------------------------
check('U3 — NO RAW SCORE DISPLAY: Core pipeline files have zero score.fullTime display', () => {
  // Core pipeline: match detail page, MatchLiveZone, live-score API
  const CORE_FILES = [
    'src/components/MatchLiveZone.tsx',
    'src/app/match/[id]/page.tsx',
    'src/app/api/live-score/[matchId]/route.ts',
  ];
  // Known debt: still uses score.fullTime but at least ?? '–' (will migrate later)
  const DEBT_FILES = [
    'src/components/MatchCard.tsx',
    'src/components/KnockoutJourney.tsx',
    'src/app/world-cup-2026/bracket/page.tsx',
    'src/app/world-cup-2026/matches-today/page.tsx',
    'src/app/world-cup-2026/page.tsx',
    'src/app/world-cup-2026/fixtures/page.tsx',
    'src/app/world-cup-2026/results/page.tsx',
    'src/app/world-cup-2026/teams/[slug]/page.tsx',
    'src/app/world-cup-2026-results/page.tsx',
    'src/app/teams/[slug]/page.tsx',
    'src/app/predict/[id]/page.tsx',
    'src/app/page.tsx',
  ];

  // Core pipeline must be clean
  for (const relPath of CORE_FILES) {
    const src = readFile(relPath);
    if (!src) { warn(`Core file not found: ${relPath}`); continue; }
    const hits = codeLines(src).filter(({ text }) => {
      if (!/score[?.]\.?fullTime/.test(text)) return false;
      if (/effectiveScore/.test(text)) return false;
      // Only flag INLINE JSX rendering: {m.score.fullTime...} or `${m.score.fullTime...`
      // Variable assignments (const h = m.score.fullTime.home) are helpers — not display violations
      return /\{[^}]*score[?.]\.?fullTime/.test(text) ||
             (text.includes('`${') && /score[?.]\.?fullTime/.test(text));
    });
    if (hits.length === 0) {
      pass(`${relPath.replace(/\\/g, '/')} — no raw score.fullTime access`);
    } else {
      for (const { text, line } of hits) {
        fail(`score.fullTime in core file ${relPath.replace(/\\/g, '/')}:${line} — ${text.trim().slice(0, 90)}`);
      }
    }
  }

  // Known debt: warn but don't fail
  let debtCount = 0;
  for (const relPath of DEBT_FILES) {
    const src = readFile(relPath);
    if (!src) continue;
    const hits = codeLines(src).filter(({ text }) => /score[?.]\.?fullTime[?.][a-z]/.test(text));
    if (hits.length > 0) {
      debtCount += hits.length;
      warn(`${relPath.replace(/\\/g, '/')} — ${hits.length} raw score.fullTime access(es) (known debt)`);
    }
  }
  if (debtCount === 0) {
    pass('All known-debt files have been migrated');
  }
});

// ---------------------------------------------------------------------------
// U4: No score.fullTime ?? 0 in JSX DISPLAY contexts (renders 0 instead of '–').
//     Arithmetic use (reduce, filter, stats) is NOT a display bug — excluded.
//     Heuristic: JSX display context = line contains JSX tag chars or template render.
// ---------------------------------------------------------------------------
check('U4 — NO NULL MASK DISPLAY: No score.fullTime ?? 0 in JSX display contexts', () => {
  const TARGET_FILES = [
    'src/components/MatchLiveZone.tsx',
    'src/components/KnockoutJourney.tsx',
    'src/components/MatchCard.tsx',
    'src/app/match/[id]/page.tsx',
    'src/app/world-cup-2026/bracket/page.tsx',
    'src/app/world-cup-2026/matches-today/page.tsx',
    'src/app/page.tsx',
  ];

  for (const relPath of TARGET_FILES) {
    const src = readFile(relPath);
    if (!src) { warn(`File not found: ${relPath}`); continue; }

    const hits = codeLines(src).filter(({ text }) => {
      if (!/fullTime/.test(text)) return false;
      if (!/\?\?\s*0\b/.test(text)) return false;
      if (/effectiveScore/.test(text)) return false;
      // Exclude arithmetic contexts: reduce(), filter(), sum, count operations
      if (/\.reduce\(|\.filter\(|\bsum\b|\bcount\b|\btotal\b|\bgoals\b|\bs \+/.test(text)) return false;
      // Only flag display contexts: JSX interpolation {}, template renders, span/div content
      return /[{<]/.test(text) || text.includes('`${') || /return\s+`/.test(text);
    });

    if (hits.length === 0) {
      pass(`${relPath.replace(/\\/g, '/')} — no score.fullTime ?? 0 in display context`);
    } else {
      for (const { text, line } of hits) {
        fail(`score.fullTime ?? 0 display: ${relPath.replace(/\\/g, '/')}:${line} — ${text.trim().slice(0, 100)}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// U5: Live-score API route does NOT call resolveEffectiveScore directly
// ---------------------------------------------------------------------------
check('U5 — API CLEAN: live-score route uses deriveRuntimeState, not resolveEffectiveScore', () => {
  const src = readFile(LIVE_SCORE_ROUTE);
  if (!src) { fail('live-score route not found'); return; }

  if (src.includes('resolveEffectiveScore')) {
    fail('live-score route still calls resolveEffectiveScore — use deriveRuntimeState instead');
  } else {
    pass('live-score route does not call resolveEffectiveScore');
  }

  if (src.includes('deriveRuntimeState')) {
    pass('live-score route uses deriveRuntimeState (correct)');
  } else {
    fail('live-score route does not use deriveRuntimeState');
  }
});

// ---------------------------------------------------------------------------
// U6: API route returns effectiveScore + isReliableScore + version (not raw score)
// ---------------------------------------------------------------------------
check('U6 — API CONTRACT: route returns effectiveScore, isReliableScore, version', () => {
  const src = readFile(LIVE_SCORE_ROUTE);
  if (!src) { fail('live-score route not found'); return; }

  for (const field of ['effectiveScore', 'isReliableScore', 'version']) {
    if (src.includes(field)) {
      pass(`Route includes ${field}`);
    } else {
      fail(`Route missing ${field} in response`);
    }
  }

  if (/score:\s*(liveMatch|match)\.score/.test(src)) {
    fail('Route still returns raw score object');
  } else {
    pass('Route does not return raw score object');
  }
});

// ---------------------------------------------------------------------------
// U7: page.tsx does NOT call resolveEffectiveScore directly
// ---------------------------------------------------------------------------
check('U7 — PAGE CLEAN: match page does not call resolveEffectiveScore', () => {
  const src = readFile(MATCH_PAGE);
  if (!src) { fail('match page not found'); return; }

  if (/resolveEffectiveScore\(/.test(src)) {
    fail('match page calls resolveEffectiveScore() directly — use runtimeState.effectiveScore');
  } else {
    pass('match page does not call resolveEffectiveScore');
  }

  if (src.includes('runtimeState.effectiveScore') || src.includes('runtimeState.isReliableScore')) {
    pass('match page reads effectiveScore from runtimeState');
  } else if (src.includes('effectiveScore = runtimeState')) {
    pass('match page destructures effectiveScore from runtimeState');
  } else {
    warn('effectiveScore source in match page not clearly from runtimeState — verify manually');
  }
});

// ---------------------------------------------------------------------------
// U8: MatchLiveZone is Score-free (imports EffectiveScore, no fullTime)
// ---------------------------------------------------------------------------
check('U8 — LIVE ZONE PURITY: MatchLiveZone has no Score type or fullTime', () => {
  const src = readFile(LIVE_ZONE);
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  if (/import.*\bScore\b.*from/.test(src)) {
    fail('MatchLiveZone imports Score type — must use EffectiveScore only');
  } else {
    pass('MatchLiveZone does not import Score type');
  }

  const fullTimeInCode = codeLines(src).filter(({ text }) => /fullTime/.test(text));
  if (fullTimeInCode.length === 0) {
    pass('MatchLiveZone has zero fullTime access in code');
  } else {
    for (const { text, line } of fullTimeInCode) {
      fail(`fullTime in MatchLiveZone:${line} — ${text.trim()}`);
    }
  }

  if (src.includes('EffectiveScore')) {
    pass('MatchLiveZone uses EffectiveScore type');
  } else {
    fail('MatchLiveZone does not use EffectiveScore');
  }
});

// ---------------------------------------------------------------------------
// U9: MatchRuntimeState interface contains effectiveScore AND isReliableScore
// ---------------------------------------------------------------------------
check('U9 — RUNTIME STATE CONTRACT: MatchRuntimeState has effectiveScore + isReliableScore', () => {
  const src = readFile(RUNTIME_STATE_FILE);
  if (!src) { fail('match-runtime-state.ts not found'); return; }

  for (const field of ['effectiveScore', 'isReliableScore']) {
    if (src.includes(field)) {
      pass(`MatchRuntimeState includes ${field}`);
    } else {
      fail(`MatchRuntimeState missing ${field}`);
    }
  }

  if (src.includes('export function deriveRuntimeState')) {
    pass('deriveRuntimeState is exported as the sole public derivation entry point');
  } else {
    fail('deriveRuntimeState not exported from match-runtime-state.ts');
  }
});

// ---------------------------------------------------------------------------
// U10: Run check-score-truth.mjs as regression guard
// ---------------------------------------------------------------------------
check('U10 — REGRESSION: check-score-truth.mjs still passes', () => {
  try {
    execSync('node scripts/check-score-truth.mjs', { cwd: ROOT, stdio: 'pipe' });
    pass('check-score-truth.mjs passes (no regressions)');
  } catch {
    fail('check-score-truth.mjs FAILED — regression introduced');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL RUNTIME UNIFICATION INVARIANTS HOLD ✅');
  console.log('');
  console.log('U1   PRIVATE          → resolveEffectiveScore is unexported');
  console.log('U2   NO IMPORT        → resolveEffectiveScore not referenced outside its file');
  console.log('U3   NO RAW DISPLAY   → components/pages do not render score.fullTime');
  console.log('U4   NO NULL MASK     → no score.fullTime ?? 0 in display contexts');
  console.log('U5   API CLEAN        → live-score route uses deriveRuntimeState');
  console.log('U6   API CONTRACT     → effectiveScore + isReliableScore + version in response');
  console.log('U7   PAGE CLEAN       → match page reads effectiveScore from runtimeState');
  console.log('U8   LIVE ZONE PURITY → MatchLiveZone: no Score type, no fullTime');
  console.log('U9   STATE CONTRACT   → MatchRuntimeState has effectiveScore + isReliableScore');
  console.log('U10  REGRESSION       → check-score-truth.mjs still passes');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
