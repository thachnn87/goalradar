/**
 * check-display-contract.mjs
 * DATA-18WC.DISPLAY.CONTRACT — Validator
 *
 * Enforces the TWO CONTRACTS invariant:
 *   MatchRuntimeState  → deriveRuntimeState()  → match detail page
 *   MatchDisplay       → deriveMatchDisplay()  → all list pages / components
 *
 * Fails if:
 *   D1  MatchDisplay interface not exported from match-display.ts
 *   D2  deriveMatchDisplay() not exported from match-display.ts
 *   D3  MatchCard.tsx does not import deriveMatchDisplay
 *   D4  MatchCard.tsx accesses score.fullTime in code (not from MatchDisplay)
 *   D5  MatchCard.tsx accesses score.winner directly in code
 *   D6  KnockoutJourney.tsx does not import deriveMatchDisplay
 *   D7  KnockoutJourney.tsx accesses score.fullTime directly in code
 *
 * Warns (known debt — not failures):
 *   DW1  WC pages still access score.fullTime directly in JSX display
 *   DW2  Non-WC pages (homepage, team pages) still access score.fullTime directly
 *
 * Usage: node scripts/check-display-contract.mjs
 * Exit 0 = all invariants hold. Exit 1 = violation found.
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = process.cwd();

function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
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

const DISPLAY_LIB     = 'src/lib/match-display.ts';
const MATCH_CARD      = 'src/components/MatchCard.tsx';
const KNOCKOUT        = 'src/components/KnockoutJourney.tsx';

// Known debt files — warn but never fail
const DEBT_FILES = [
  'src/app/world-cup-2026/bracket/page.tsx',
  'src/app/world-cup-2026/results/page.tsx',
  'src/app/world-cup-2026/matches-today/page.tsx',
  'src/app/world-cup-2026/teams/[slug]/page.tsx',
  'src/app/world-cup-2026-results/page.tsx',
  'src/app/teams/[slug]/page.tsx',
  'src/app/page.tsx',
];

// ---------------------------------------------------------------------------
// D1: MatchDisplay interface exported from match-display.ts
// ---------------------------------------------------------------------------
check('D1 — EXPORT: MatchDisplay interface exported', () => {
  const src = readFile(DISPLAY_LIB);
  if (!src) { fail('match-display.ts not found'); return; }
  if (/export\s+interface\s+MatchDisplay/.test(src)) {
    pass('MatchDisplay interface exported from match-display.ts');
  } else {
    fail('MatchDisplay interface not exported from match-display.ts');
  }
});

// ---------------------------------------------------------------------------
// D2: deriveMatchDisplay() exported from match-display.ts
// ---------------------------------------------------------------------------
check('D2 — EXPORT: deriveMatchDisplay() exported', () => {
  const src = readFile(DISPLAY_LIB);
  if (!src) { fail('match-display.ts not found'); return; }
  if (/export\s+function\s+deriveMatchDisplay/.test(src)) {
    pass('deriveMatchDisplay() exported from match-display.ts');
  } else {
    fail('deriveMatchDisplay() not exported from match-display.ts');
  }
});

// ---------------------------------------------------------------------------
// D3: MatchCard.tsx imports deriveMatchDisplay
// ---------------------------------------------------------------------------
check('D3 — IMPORT: MatchCard.tsx imports deriveMatchDisplay', () => {
  const src = readFile(MATCH_CARD);
  if (!src) { fail('MatchCard.tsx not found'); return; }
  if (src.includes('deriveMatchDisplay')) {
    pass('MatchCard.tsx imports and uses deriveMatchDisplay');
  } else {
    fail('MatchCard.tsx does not use deriveMatchDisplay — it must derive display fields from the contract');
  }
});

// ---------------------------------------------------------------------------
// D4: MatchCard.tsx does not access score.fullTime in code lines
// ---------------------------------------------------------------------------
check('D4 — NO RAW SCORE: MatchCard.tsx has no score.fullTime access', () => {
  const src = readFile(MATCH_CARD);
  if (!src) { fail('MatchCard.tsx not found'); return; }
  const hits = codeLines(src).filter(({ text }) =>
    /score[?.]\.?fullTime/.test(text)
  );
  if (hits.length === 0) {
    pass('MatchCard.tsx has zero score.fullTime accesses');
  } else {
    for (const { text, line } of hits) {
      fail(`MatchCard.tsx:${line} accesses score.fullTime — use display.homeScore / display.awayScore`, text.trim().slice(0, 100));
    }
  }
});

// ---------------------------------------------------------------------------
// D5: MatchCard.tsx does not access score.winner directly in code
// ---------------------------------------------------------------------------
check('D5 — NO RAW WINNER: MatchCard.tsx has no score.winner access', () => {
  const src = readFile(MATCH_CARD);
  if (!src) { fail('MatchCard.tsx not found'); return; }
  const hits = codeLines(src).filter(({ text }) =>
    /score\.winner/.test(text)
  );
  if (hits.length === 0) {
    pass('MatchCard.tsx has zero score.winner accesses');
  } else {
    for (const { text, line } of hits) {
      fail(`MatchCard.tsx:${line} accesses score.winner — use display.winner`, text.trim().slice(0, 100));
    }
  }
});

// ---------------------------------------------------------------------------
// D6: KnockoutJourney.tsx imports deriveMatchDisplay
// ---------------------------------------------------------------------------
check('D6 — IMPORT: KnockoutJourney.tsx imports deriveMatchDisplay', () => {
  const src = readFile(KNOCKOUT);
  if (!src) { fail('KnockoutJourney.tsx not found'); return; }
  if (src.includes('deriveMatchDisplay')) {
    pass('KnockoutJourney.tsx imports and uses deriveMatchDisplay');
  } else {
    fail('KnockoutJourney.tsx does not use deriveMatchDisplay — it must derive display fields from the contract');
  }
});

// ---------------------------------------------------------------------------
// D7: KnockoutJourney.tsx does not access score.fullTime directly in code
// ---------------------------------------------------------------------------
check('D7 — NO RAW SCORE: KnockoutJourney.tsx has no score.fullTime access', () => {
  const src = readFile(KNOCKOUT);
  if (!src) { fail('KnockoutJourney.tsx not found'); return; }
  const hits = codeLines(src).filter(({ text }) =>
    /score[?.]\.?fullTime/.test(text)
  );
  if (hits.length === 0) {
    pass('KnockoutJourney.tsx has zero score.fullTime accesses');
  } else {
    for (const { text, line } of hits) {
      fail(`KnockoutJourney.tsx:${line} accesses score.fullTime — use deriveMatchDisplay(match)`, text.trim().slice(0, 100));
    }
  }
});

// ---------------------------------------------------------------------------
// DW: Known debt files — warn only
// ---------------------------------------------------------------------------
check('DW — DEBT AUDIT: Known-debt list pages (warnings only)', () => {
  let totalDebt = 0;
  for (const relPath of DEBT_FILES) {
    const src = readFile(relPath);
    if (!src) continue;
    const hits = codeLines(src).filter(({ text }) =>
      /score[?.]\.?fullTime[?.][a-z]/.test(text) ||
      /score\.winner/.test(text)
    );
    if (hits.length > 0) {
      totalDebt += hits.length;
      warn(`${relPath} — ${hits.length} raw score field access(es) (migrate to deriveMatchDisplay)`);
    }
  }
  if (totalDebt === 0) {
    pass('All known-debt files migrated to deriveMatchDisplay');
  } else {
    warn(`Total known debt: ${totalDebt} raw score accesses across ${DEBT_FILES.length} list pages`);
  }
});

// ---------------------------------------------------------------------------
// Regression: check-runtime-unification must still pass
// ---------------------------------------------------------------------------
check('DR — REGRESSION: check-runtime-unification.mjs still passes', () => {
  try {
    execSync('node scripts/check-runtime-unification.mjs', { cwd: ROOT, stdio: 'pipe' });
    pass('check-runtime-unification.mjs passes (no regressions)');
  } catch {
    fail('check-runtime-unification.mjs FAILED — regression introduced');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL DISPLAY CONTRACT INVARIANTS HOLD ✅');
  console.log('');
  console.log('D1   EXPORT       → MatchDisplay interface exported from match-display.ts');
  console.log('D2   EXPORT       → deriveMatchDisplay() exported from match-display.ts');
  console.log('D3   IMPORT       → MatchCard.tsx uses deriveMatchDisplay');
  console.log('D4   NO RAW SCORE → MatchCard.tsx: no score.fullTime access');
  console.log('D5   NO RAW WIN   → MatchCard.tsx: no score.winner access');
  console.log('D6   IMPORT       → KnockoutJourney.tsx uses deriveMatchDisplay');
  console.log('D7   NO RAW SCORE → KnockoutJourney.tsx: no score.fullTime access');
  console.log('DW   DEBT AUDIT   → known-debt pages warned (not failed)');
  console.log('DR   REGRESSION   → check-runtime-unification.mjs still passes');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
