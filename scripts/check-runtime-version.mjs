/**
 * check-runtime-version.mjs
 * DATA-18WC.RUNTIME.TRUTH — Phase 9 Validator
 *
 * Verifies that every component rendering from the same MatchRuntimeState
 * uses the same MatchVersion:
 *   - Page container embeds data-match-version from runtimeState.version
 *   - MatchLiveZone receives initialVersion and tracks liveVersion
 *   - data-live-version is emitted after polls
 *
 * Static code analysis — no server required.
 * Usage:  node scripts/check-runtime-version.mjs
 *
 * Exit 0 = all version invariants hold.
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
// V1: MatchRuntimeState exports version field
// ---------------------------------------------------------------------------
check('V1 — RUNTIME STATE: version field in MatchRuntimeState', () => {
  const src = readFile('src/lib/match-runtime-state.ts');
  if (!src) { fail('match-runtime-state.ts not found'); return; }

  if (src.includes('version:') && src.includes('Math.floor(')) {
    pass('MatchRuntimeState has version field (Unix seconds)');
  } else {
    fail('version field or Math.floor derivation not found in match-runtime-state.ts');
  }

  // Verify derivation is from generatedAt in epoch-ms
  if (src.includes('Math.floor(generatedAt / 1000)')) {
    pass('version = Math.floor(generatedAt / 1000) — correct epoch-ms to Unix-sec conversion');
  } else {
    fail('Expected version = Math.floor(generatedAt / 1000) not found');
  }
});

// ---------------------------------------------------------------------------
// V2: versionFromTimestamp utility exported
// ---------------------------------------------------------------------------
check('V2 — VERSION UTILITY: versionFromTimestamp handles string|number', () => {
  const src = readFile('src/lib/match-runtime-state.ts');
  if (!src) { fail('match-runtime-state.ts not found'); return; }

  if (src.includes('export function versionFromTimestamp')) {
    pass('versionFromTimestamp exported from match-runtime-state.ts');
  } else {
    fail('versionFromTimestamp not exported', 'Required for converting lastUpdated API response to version');
  }

  // Verify it handles both string and number
  if (src.includes("typeof isoStringOrMs === 'number'") || src.includes('typeof isoStringOrMs === "number"')) {
    pass('versionFromTimestamp handles both string and number input');
  } else {
    fail('versionFromTimestamp does not handle number input', 'Must accept string | number | null | undefined');
  }
});

// ---------------------------------------------------------------------------
// V3: Page embeds data-match-version from runtimeState.version
// ---------------------------------------------------------------------------
check('V3 — PAGE: data-match-version set from runtimeState.version', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.includes('data-match-version={matchVersion}') || page.includes('data-match-version={runtimeState.version}')) {
    pass('data-match-version attribute embedded in page container');
  } else {
    fail('data-match-version not found in page.tsx', 'Must embed data-match-version on the page wrapper div');
  }

  // matchVersion should derive from runtimeState
  if (page.includes('runtimeState.version') || page.includes('matchVersion = runtimeState.version')) {
    pass('matchVersion sourced from runtimeState.version');
  } else {
    warn('runtimeState.version assignment not found in expected form — verify matchVersion source manually');
  }

  // data-match-id for cross-referencing
  if (page.includes('data-match-id={match.id}') || page.includes('data-match-id=')) {
    pass('data-match-id attribute present for debugging/cross-reference');
  } else {
    warn('data-match-id not found — useful for cross-referencing version with match identity');
  }
});

// ---------------------------------------------------------------------------
// V4: MatchLiveZone accepts and tracks initialVersion
// ---------------------------------------------------------------------------
check('V4 — LIVE ZONE: initialVersion prop tracked as liveVersion state', () => {
  const src = readFile('src/components/MatchLiveZone.tsx');
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  if (src.includes('initialVersion')) {
    pass('MatchLiveZone accepts initialVersion prop');
  } else {
    fail('initialVersion prop not found in MatchLiveZone.tsx');
  }

  if (src.includes('liveVersion')) {
    pass('MatchLiveZone tracks liveVersion state');
  } else {
    fail('liveVersion state not found in MatchLiveZone.tsx');
  }

  // useState initialized from initialVersion
  if (src.includes('useState<number>(initialVersion') || src.includes('useState(initialVersion')) {
    pass('liveVersion useState initialized from initialVersion prop');
  } else {
    fail('liveVersion not initialized from initialVersion in useState', 'Must initialize: useState<number>(initialVersion ?? 0)');
  }
});

// ---------------------------------------------------------------------------
// V5: MatchLiveZone updates liveVersion from lastUpdated
// ---------------------------------------------------------------------------
check('V5 — LIVE ZONE: liveVersion updated from poll response lastUpdated', () => {
  const src = readFile('src/components/MatchLiveZone.tsx');
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  if (src.includes('lastUpdated')) {
    pass('MatchLiveZone reads lastUpdated from poll response');
  } else {
    fail('lastUpdated not referenced in MatchLiveZone.tsx');
  }

  if (src.includes('setLiveVersion')) {
    pass('setLiveVersion called after poll — liveVersion updated');
  } else {
    fail('setLiveVersion not called in MatchLiveZone.tsx');
  }

  // Version math from lastUpdated
  if (src.includes('Math.floor(') && (src.includes('getTime()') || src.includes('/ 1000'))) {
    pass('liveVersion derived as Math.floor(ms / 1000) from lastUpdated');
  } else {
    fail('Expected Math.floor(new Date(lastUpdated).getTime() / 1000) not found');
  }
});

// ---------------------------------------------------------------------------
// V6: MatchLiveZone emits data-live-version attribute
// ---------------------------------------------------------------------------
check('V6 — LIVE ZONE: data-live-version emitted on root element', () => {
  const src = readFile('src/components/MatchLiveZone.tsx');
  if (!src) { fail('MatchLiveZone.tsx not found'); return; }

  if (src.includes('data-live-version')) {
    pass('data-live-version attribute emitted by MatchLiveZone');
  } else {
    fail('data-live-version attribute not found in MatchLiveZone.tsx');
  }

  // Verify it's set to liveVersion (not a hardcoded value)
  if (src.includes('data-live-version={liveVersion') || src.includes('data-live-version={liveVersion ||')) {
    pass('data-live-version set from liveVersion state');
  } else {
    fail('data-live-version not bound to liveVersion state');
  }
});

// ---------------------------------------------------------------------------
// V7: Page passes matchVersion to MatchLiveZone as initialVersion
// ---------------------------------------------------------------------------
check('V7 — PAGE→LIVE ZONE: matchVersion passed as initialVersion', () => {
  const page = readFile('src/app/match/[id]/page.tsx');
  if (!page) { fail('page.tsx not found'); return; }

  if (page.includes('initialVersion={matchVersion}') || page.includes('initialVersion={runtimeState.version}')) {
    pass('MatchLiveZone receives initialVersion={matchVersion} from page');
  } else {
    fail('initialVersion prop not passed to MatchLiveZone in page.tsx', 'Must pass: initialVersion={matchVersion}');
  }
});

// ---------------------------------------------------------------------------
// V8: Version format consistency (Unix seconds, not epoch-ms)
// ---------------------------------------------------------------------------
check('V8 — VERSION FORMAT: Unix seconds (not epoch-ms) for HTML attributes', () => {
  const rts = readFile('src/lib/match-runtime-state.ts');
  if (!rts) { fail('match-runtime-state.ts not found'); return; }

  // version should be Unix seconds (~10 digits), not epoch-ms (~13 digits)
  // Check the derivation formula is /1000
  if (rts.includes('/ 1000)')) {
    pass('Version converted to Unix seconds (÷1000 from epoch-ms)');
  } else {
    fail('Version conversion ÷1000 not found — may be embedding epoch-ms instead of Unix seconds');
  }

  // The LiveZone should also use /1000 when converting lastUpdated
  const liveZone = readFile('src/components/MatchLiveZone.tsx');
  if (liveZone && liveZone.includes('/ 1000')) {
    pass('MatchLiveZone liveVersion also uses Unix seconds');
  } else if (liveZone) {
    fail('MatchLiveZone liveVersion may not be Unix seconds — check Math.floor(ms/1000) conversion');
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
if (violations === 0) {
  console.log('ALL VERSION INVARIANTS HOLD ✅');
  console.log('');
  console.log('V1  MatchRuntimeState.version = Math.floor(generatedAt / 1000)');
  console.log('V2  versionFromTimestamp(string|number) exported');
  console.log('V3  data-match-version={matchVersion} on page container');
  console.log('V4  MatchLiveZone initialVersion → useState liveVersion');
  console.log('V5  liveVersion updated on poll via lastUpdated → Math.floor(ms/1000)');
  console.log('V6  data-live-version={liveVersion} emitted on MatchLiveZone root');
  console.log('V7  matchVersion → initialVersion prop passed from page to MatchLiveZone');
  console.log('V8  All version values are Unix seconds (not epoch-ms)');
  process.exit(0);
} else {
  console.log(`${violations} VIOLATION(S) FOUND ❌`);
  process.exit(1);
}
