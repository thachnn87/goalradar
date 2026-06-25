#!/usr/bin/env node
/**
 * DATA-18WC.CONSOLIDATE — Architecture enforcement.
 *
 * Fails the build if a World Cup surface re-introduces an alternate data source.
 * The invariant this guards:
 *
 *   ONE SOURCE  — goalradar:wc:authority:v1
 *   ONE PIPELINE — getWCAuthorityMatchesV2() (raw) / getWCAuthorityMatchesCached()
 *                  (Match-shaped view) / buildKnockoutViewModel() (knockout)
 *
 * Run: node scripts/check-wc-architecture.mjs   (wired as `npm run check:wc-arch`)
 *
 * Rules
 *   R1  No file may reference getWCKnockoutMatchesCached — it was deleted in
 *       CONSOLIDATE. Knockout data has exactly one pipeline (buildKnockoutViewModel).
 *   R2  WC route pages (src/app/world-cup-2026*) and WC components must NOT import
 *       the generic window-limited feed readers for WC match collections:
 *       getUpcomingMatchesCached, getRecentMatchesCached, getWCResultsCached.
 *       They must read authority:v1 (V2 / getWCAuthorityMatchesCached / the VM).
 *   R3  The knockout ViewModel must not re-introduce a second data path
 *       (AUTHORITY_CACHE_PILOT gate) — it reads authority:v1 unconditionally.
 *   R4  canonicalToMatch must be defined in exactly one file (canonical-match.ts).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** Recursively collect .ts/.tsx files under a directory. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_FILES = walk(SRC);
const violations = [];

/** A "WC surface" = a route page under world-cup-2026* or a component whose name starts with WC. */
function isWCSurface(file) {
  const rel = relative(SRC, file).split(sep).join('/');
  if (rel.startsWith('app/world-cup-2026')) return true;
  if (rel.startsWith('components/WC')) return true;
  return false;
}

/** Strip comments so we match real imports/usages, not prose in doc comments. */
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '');    // line comments
}

// ── R1: getWCKnockoutMatchesCached must not exist anywhere (deleted) ──────────
for (const file of ALL_FILES) {
  const code = codeOnly(readFileSync(file, 'utf8'));
  if (/\bgetWCKnockoutMatchesCached\b/.test(code)) {
    violations.push(
      `R1  ${relative(ROOT, file)} — references getWCKnockoutMatchesCached (deleted in CONSOLIDATE; use buildKnockoutViewModel)`,
    );
  }
}

// ── R2: WC surfaces must not import generic window-limited feed readers ───────
const FORBIDDEN_IN_WC = ['getUpcomingMatchesCached', 'getRecentMatchesCached', 'getWCResultsCached'];
for (const file of ALL_FILES) {
  if (!isWCSurface(file)) continue;
  const code = codeOnly(readFileSync(file, 'utf8'));
  for (const fn of FORBIDDEN_IN_WC) {
    if (new RegExp(`\\b${fn}\\b`).test(code)) {
      violations.push(
        `R2  ${relative(ROOT, file)} — WC surface uses ${fn} (read authority:v1 via getWCAuthorityMatchesV2 / getWCAuthorityMatchesCached / buildKnockoutViewModel)`,
      );
    }
  }
}

// ── R3: knockout-vm must not re-introduce the pilot gate ──────────────────────
{
  const vm = join(SRC, 'lib', 'knockout-vm.ts');
  const code = codeOnly(readFileSync(vm, 'utf8'));
  if (/AUTHORITY_CACHE_PILOT/.test(code)) {
    violations.push(
      `R3  src/lib/knockout-vm.ts — AUTHORITY_CACHE_PILOT gate re-introduced (knockout reads authority:v1 unconditionally)`,
    );
  }
}

// ── R4: canonicalToMatch defined in exactly one file ──────────────────────────
{
  const defs = ALL_FILES.filter((f) =>
    /\bexport\s+function\s+canonicalToMatch\b/.test(readFileSync(f, 'utf8')),
  );
  const expected = join(SRC, 'lib', 'canonical-match.ts');
  if (defs.length !== 1 || defs[0] !== expected) {
    violations.push(
      `R4  canonicalToMatch must be defined only in src/lib/canonical-match.ts — found in: ${defs
        .map((f) => relative(ROOT, f))
        .join(', ') || '(none)'}`,
    );
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  console.error('\n✗ WC architecture check FAILED:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s). See scripts/check-wc-architecture.mjs for the rules.\n`);
  process.exit(1);
}

console.log('✓ WC architecture check passed — ONE SOURCE, ONE PIPELINE upheld.');
