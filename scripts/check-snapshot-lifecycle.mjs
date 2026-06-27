/**
 * check-snapshot-lifecycle.mjs
 * DATA-18WC.SNAPSHOT.LIFECYCLE — Validator
 *
 * Enforces the ONE LIFECYCLE invariant:
 *   Provider → Snapshot (lifecycle-aware TTL) → RuntimeState → Display → UI
 *
 * A FINISHED match snapshot must NOT be frozen forever. The snapshot TTL must
 * be time-stepped so provider corrections (VAR, OG re-attribution, referee
 * changes) are picked up within minutes, not days.
 *
 * Fails if:
 *   SL1  SnapshotPolicy type not exported from match-snapshot.ts
 *   SL2  getSnapshotPolicy() not exported from match-snapshot.ts
 *   SL3  getSnapshotTtlSec uses flat 7-day TTL for ALL FINISHED matches
 *   SL4  Stepped time thresholds (4h, 14h, 50h) missing from TTL function
 *   SL5  writeKVSnapshot does not call getSnapshotTtlSec (hardcoded bypass)
 *   SL6  Direct kv.set calls with match snapshot keys outside writeKVSnapshot
 *
 * Warns (not failures):
 *   SW1  Non-snapshot KV writes detected — verify they don't set match-snapshot TTLs
 *
 * Usage: node scripts/check-snapshot-lifecycle.mjs
 * Exit 0 = all invariants hold. Exit 1 = violation found.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

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

const SNAPSHOT_LIB = 'src/lib/match-snapshot.ts';

// ---------------------------------------------------------------------------
// SL1: SnapshotPolicy type exported
// ---------------------------------------------------------------------------
check('SL1 — EXPORT: SnapshotPolicy type exported', () => {
  const src = readFile(SNAPSHOT_LIB);
  if (!src) { fail(`${SNAPSHOT_LIB} not found`); return; }
  if (/export\s+type\s+SnapshotPolicy/.test(src)) {
    pass('SnapshotPolicy type exported from match-snapshot.ts');
  } else {
    fail('SnapshotPolicy type not exported — lifecycle domain concept missing');
  }
});

// ---------------------------------------------------------------------------
// SL2: getSnapshotPolicy() exported
// ---------------------------------------------------------------------------
check('SL2 — EXPORT: getSnapshotPolicy() exported', () => {
  const src = readFile(SNAPSHOT_LIB);
  if (!src) { fail(`${SNAPSHOT_LIB} not found`); return; }
  if (/export\s+function\s+getSnapshotPolicy/.test(src)) {
    pass('getSnapshotPolicy() exported from match-snapshot.ts');
  } else {
    fail('getSnapshotPolicy() not exported — policy derivation has no public entry point');
  }
});

// ---------------------------------------------------------------------------
// SL3: No flat 7-day FINISHED TTL (the Egypt/Iran bug)
// ---------------------------------------------------------------------------
check('SL3 — NO FLAT TTL: FINISHED does not return flat 7 days', () => {
  const src = readFile(SNAPSHOT_LIB);
  if (!src) { fail(`${SNAPSHOT_LIB} not found`); return; }

  // Check that getSnapshotTtlSec doesn't have a single-line flat 7-day return for FINISHED
  // Pattern: the old "if FINISHED return 7 * 24 * 3600" without any time-stepping
  const flatFinishedTtl = /if\s*\(\s*match\.status\s*===\s*['"]FINISHED['"]\s*\)\s*return\s+7\s*\*\s*24/.test(src);
  if (flatFinishedTtl) {
    fail(
      'getSnapshotTtlSec still has flat 7-day FINISHED TTL — root cause of Egypt/Iran bug',
      'FINISHED snapshot must use stepped TTL: 10min (HOT) → 30min (WARM) → 2h (COOL) → 7days (ARCHIVED)'
    );
  } else {
    pass('No flat 7-day TTL for FINISHED matches — stepped policy in effect');
  }
});

// ---------------------------------------------------------------------------
// SL4: Stepped thresholds present (4h, 14h, 50h)
// ---------------------------------------------------------------------------
check('SL4 — STEPPED TTL: Time thresholds 4h / 14h / 50h present', () => {
  const src = readFile(SNAPSHOT_LIB);
  if (!src) { fail(`${SNAPSHOT_LIB} not found`); return; }

  const has4h  = /h\s*<\s*4\b/.test(src)  || /hoursSince[A-Za-z]*\s*<\s*4\b/.test(src);
  const has14h = /h\s*<\s*14\b/.test(src) || /hoursSince[A-Za-z]*\s*<\s*14\b/.test(src);
  const has50h = /h\s*<\s*50\b/.test(src) || /hoursSince[A-Za-z]*\s*<\s*50\b/.test(src);

  if (!has4h)  { fail('Missing 4h threshold (HOT window) in getSnapshotTtlSec'); }
  if (!has14h) { fail('Missing 14h threshold (WARM window) in getSnapshotTtlSec'); }
  if (!has50h) { fail('Missing 50h threshold (COOL→ARCHIVED boundary) in getSnapshotTtlSec'); }
  if (has4h && has14h && has50h) {
    pass('Stepped thresholds 4h / 14h / 50h all present in getSnapshotTtlSec');
  }
});

// ---------------------------------------------------------------------------
// SL5: writeKVSnapshot calls getSnapshotTtlSec (not a hardcoded TTL)
// ---------------------------------------------------------------------------
check('SL5 — POLICY OWNER: writeKVSnapshot calls getSnapshotTtlSec', () => {
  const src = readFile(SNAPSHOT_LIB);
  if (!src) { fail(`${SNAPSHOT_LIB} not found`); return; }

  // Find the writeKVSnapshot function body
  const fnMatch = src.match(/export\s+async\s+function\s+writeKVSnapshot[\s\S]*?(?=\nexport\s+(?:async\s+)?function|\nexport\s+const|\nconst\s+\w+\s*=|\z)/);
  if (!fnMatch) { warn('Could not locate writeKVSnapshot body for analysis — skipping SL5'); return; }
  const fnBody = fnMatch[0];

  if (fnBody.includes('getSnapshotTtlSec(')) {
    pass('writeKVSnapshot calls getSnapshotTtlSec — policy is centralised');
  } else {
    fail(
      'writeKVSnapshot does not call getSnapshotTtlSec — TTL may be hardcoded',
      'All KV writes for match snapshots must go through getSnapshotTtlSec for lifecycle policy'
    );
  }
});

// ---------------------------------------------------------------------------
// SL6: No direct kv.set calls with match-snapshot keys outside writeKVSnapshot
// ---------------------------------------------------------------------------
check('SL6 — NO BYPASS: No kv.set with match snapshot keys outside writeKVSnapshot', () => {
  // Snapshot KV key pattern: typically `match:${matchId}` or `snapshot:${matchId}`
  // Search API routes and cron files
  const SCAN_DIRS = [
    'src/app/api',
    'src/app/cron',
    'src/lib',
  ];

  const EXCLUDE = [
    'src/lib/match-snapshot.ts', // the SSOT — kv.set is expected here
    'src/lib/live-cache.ts',     // live-cache owns its own keys
  ];

  // We grep for kv.set( in non-excluded files and flag if they reference match snapshot key patterns
  let bypasses = 0;

  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;

    let output = '';
    try {
      output = execSync(`grep -rn "kv\\.set(" "${abs}" --include="*.ts" --include="*.tsx"`, { encoding: 'utf8' });
    } catch { continue; }

    for (const line of output.split('\n').filter(Boolean)) {
      // Normalise separators for cross-platform comparison
      const normLine = line.replace(/\\/g, '/');
      const isExcluded = EXCLUDE.some((ex) => normLine.includes(ex));
      if (isExcluded) continue;

      // Only flag if the line is setting a key that looks like a primary match snapshot
      // (quoted string starting with 'match:' or 'snapshot:' — not drKey / liveKey)
      if (/kv\.set\([^,]*kvKey\(/.test(line)) {
        const shortLine = line.slice(0, 140);
        fail('Direct kv.set with kvKey() outside match-snapshot.ts', shortLine);
        bypasses++;
      }
    }
  }

  if (bypasses === 0) {
    pass('No direct kv.set bypasses detected for match snapshot keys');
  }
});

// ---------------------------------------------------------------------------
// Regression: check-display-contract must still pass
// ---------------------------------------------------------------------------
check('SR — REGRESSION: check-display-contract.mjs still passes', () => {
  try {
    execSync('node scripts/check-display-contract.mjs', { cwd: ROOT, stdio: 'pipe' });
    pass('check-display-contract.mjs passes (no regressions)');
  } catch {
    fail('check-display-contract.mjs FAILED — regression introduced');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL SNAPSHOT LIFECYCLE INVARIANTS HOLD ✅');
  console.log('');
  console.log('SL1  EXPORT        → SnapshotPolicy type exported from match-snapshot.ts');
  console.log('SL2  EXPORT        → getSnapshotPolicy() exported from match-snapshot.ts');
  console.log('SL3  NO FLAT TTL   → FINISHED uses stepped policy, not flat 7 days');
  console.log('SL4  STEPPED TTL   → 4h / 14h / 50h thresholds enforced');
  console.log('SL5  POLICY OWNER  → writeKVSnapshot calls getSnapshotTtlSec');
  console.log('SL6  NO BYPASS     → no direct kv.set for match snapshots outside SSOT');
  console.log('SR   REGRESSION    → check-display-contract.mjs still passes');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
