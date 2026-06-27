/**
 * check-score-truth.mjs
 * ONE DERIVATION invariant validator
 *
 * Enforces that resolveEffectiveScore() is the single derivation point for score data,
 * called only in the Runtime layer (match-runtime-state.ts) and the API layer
 * (/api/live-score route). No UI component may touch score.fullTime, use ?? 0 on
 * raw score, or infer score from goals[].
 *
 * Scope: core match pipeline files only.
 *   - src/components/MatchLiveZone.tsx
 *   - src/app/match/[id]/page.tsx
 *   - src/app/api/live-score/**
 *   - src/lib/match-runtime-state.ts
 *
 * Other pages (WC bracket, MatchCard, etc.) that still use raw score are tracked
 * as known debt — they are out of scope for this sprint.
 *
 * Usage: node scripts/check-score-truth.mjs
 * Exit 0 = all invariants hold. Exit 1 = violation found.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
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

/** Return non-comment, non-blank lines from source with their 1-based line numbers. */
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

// ---------------------------------------------------------------------------
// S1: resolveEffectiveScore() called only in allowed files
// ---------------------------------------------------------------------------
check('S1 — ONE DERIVATION: resolveEffectiveScore() only in Runtime/API layer', () => {
  const ALLOWED = [
    'src/lib/match-runtime-state.ts',
    'src/app/api/live-score/[matchId]/route.ts',
  ];

  const allSrc = [
    ...walkFiles('src/components', ['.tsx', '.ts']),
    ...walkFiles('src/app', ['.tsx', '.ts']),
    ...walkFiles('src/lib', ['.ts']),
  ];

  const violators = [];
  for (const relPath of allSrc) {
    const norm = relPath.replace(/\\/g, '/');
    if (ALLOWED.some(a => norm.endsWith(a))) continue;
    const src = readFile(relPath);
    if (!src) continue;
    // Only flag actual call sites (with parenthesis), not imports
    if (/resolveEffectiveScore\(/.test(src)) {
      violators.push(norm);
    }
  }

  if (violators.length === 0) {
    pass('resolveEffectiveScore() found only in Runtime/API layer');
  } else {
    for (const f of violators) {
      fail(`resolveEffectiveScore() called outside allowed layer: ${f}`);
    }
  }

  for (const allowed of ALLOWED) {
    const src = readFile(allowed);
    if (!src) { fail(`Allowed file not found: ${allowed}`); continue; }
    if (src.includes('resolveEffectiveScore')) {
      pass(`${allowed} — resolveEffectiveScore present (allowed)`);
    } else {
      warn(`${allowed} — resolveEffectiveScore absent (expected)`);
    }
  }
});

// ---------------------------------------------------------------------------
// S2: MatchLiveZone must not access score.fullTime (code lines only)
// ---------------------------------------------------------------------------
check('S2 — LIVE ZONE: MatchLiveZone has no score.fullTime access', () => {
  const src = readFile('src/components/MatchLiveZone.tsx');
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  const hits = codeLines(src).filter(({ text }) =>
    /score[?.]+fullTime/.test(text) || /\.fullTime[?.]/.test(text)
  );

  if (hits.length === 0) {
    pass('MatchLiveZone has zero score.fullTime access in code');
  } else {
    for (const { text, line } of hits) {
      fail(`score.fullTime in MatchLiveZone:${line} — ${text.trim()}`);
    }
  }
});

// ---------------------------------------------------------------------------
// S3: No raw score ?? 0 masking in core pipeline files
//     Pattern: score.fullTime or score?.fullTime chain → ?? 0
//     Excludes: effectiveScore?.home ?? 0 (already resolved)
//     Excludes: debug/internal API routes (out of scope)
// ---------------------------------------------------------------------------
check('S3 — NO NULL MASK: No raw score ?? 0 in core pipeline', () => {
  const CORE_FILES = [
    'src/components/MatchLiveZone.tsx',
    'src/app/match/[id]/page.tsx',
    'src/app/api/live-score/[matchId]/route.ts',
  ];

  // Pattern: line that has fullTime AND ?? 0 (and does NOT start with effectiveScore)
  const RAW_SCORE_PATTERN = /(?:score|fullTime)[^)]*\?\?\s*0\b/;

  for (const relPath of CORE_FILES) {
    const src = readFile(relPath);
    if (!src) { warn(`Core file not found: ${relPath}`); continue; }

    const hits = codeLines(src).filter(({ text }) => {
      if (!RAW_SCORE_PATTERN.test(text)) return false;
      // Exclude effectiveScore?.home ?? 0 — effectiveScore is already resolved
      if (/effectiveScore[^)]*\?\?\s*0/.test(text)) return false;
      return true;
    });

    if (hits.length === 0) {
      pass(`${relPath.replace(/\\/g, '/')} — no raw score ?? 0`);
    } else {
      for (const { text, line } of hits) {
        fail(`raw score ?? 0 in ${relPath.replace(/\\/g, '/')}:${line} — ${text.trim()}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// S4: API route returns effectiveScore (not raw score object)
// ---------------------------------------------------------------------------
check('S4 — API CONTRACT: /api/live-score returns effectiveScore, isReliableScore, version', () => {
  const route = readFile('src/app/api/live-score/[matchId]/route.ts');
  if (!route) { fail('live-score route not found'); return; }

  if (route.includes('effectiveScore')) {
    pass('Route returns effectiveScore');
  } else {
    fail('Route does not include effectiveScore in response');
  }

  if (/score:\s*(liveMatch|match)\.score/.test(route)) {
    fail('Route still returns raw score object — must return effectiveScore only');
  } else {
    pass('Route does not return raw score object');
  }

  if (route.includes('isReliableScore')) {
    pass('Route returns isReliableScore');
  } else {
    fail('Route missing isReliableScore');
  }

  if (route.includes('version')) {
    pass('Route returns version');
  } else {
    fail('Route missing version');
  }
});

// ---------------------------------------------------------------------------
// S5: MatchLiveZone consumes effectiveScore, has no Score type import, no fullTime
// ---------------------------------------------------------------------------
check('S5 — LIVE ZONE PURITY: MatchLiveZone uses effectiveScore only', () => {
  const src = readFile('src/components/MatchLiveZone.tsx');
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  if (src.includes('effectiveScore')) {
    pass('MatchLiveZone uses effectiveScore');
  } else {
    fail('MatchLiveZone does not use effectiveScore');
  }

  if (/import.*\bScore\b.*from/.test(src)) {
    fail('MatchLiveZone still imports Score type — must use EffectiveScore only');
  } else {
    pass('MatchLiveZone does not import raw Score type');
  }

  // Check code lines only (skip comments)
  const fullTimeInCode = codeLines(src).filter(({ text }) => /fullTime/.test(text));
  if (fullTimeInCode.length === 0) {
    pass('MatchLiveZone has zero fullTime access in code');
  } else {
    for (const { text, line } of fullTimeInCode) {
      fail(`fullTime access in MatchLiveZone:${line} — ${text.trim()}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Known Debt (informational — not counted as violations)
// ---------------------------------------------------------------------------
check('KNOWN DEBT — Other components/pages (out of scope this sprint)', () => {
  const DEBT_FILES = [
    'src/components/KnockoutJourney.tsx',
    'src/components/MatchCard.tsx',
    'src/app/world-cup-2026/bracket/page.tsx',
    'src/app/world-cup-2026/matches-today/page.tsx',
    'src/app/page.tsx',
    'src/app/teams/[slug]/page.tsx',
  ];

  for (const relPath of DEBT_FILES) {
    const src = readFile(relPath);
    if (!src) continue;
    const hits = codeLines(src).filter(({ text }) => /score[?.]+fullTime/.test(text) || /fullTime[?.]*home/.test(text));
    if (hits.length > 0) {
      warn(`${relPath.replace(/\\/g, '/')} — ${hits.length} raw score access(es) (migrate in future sprint)`);
    }
  }
  pass('Debt catalogued above — not blocking this sprint');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL SCORE TRUTH INVARIANTS HOLD ✅');
  console.log('');
  console.log('S1  ONE DERIVATION  → resolveEffectiveScore() only in Runtime/API layer');
  console.log('S2  LIVE ZONE       → MatchLiveZone has no score.fullTime access');
  console.log('S3  NO NULL MASK    → no raw score ?? 0 in core pipeline files');
  console.log('S4  API CONTRACT    → /api/live-score returns effectiveScore + isReliableScore + version');
  console.log('S5  LIVE ZONE PURITY → MatchLiveZone uses effectiveScore, no Score type');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
