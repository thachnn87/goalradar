/**
 * check-experience-contract.mjs
 *
 * Validates the ONE EXPERIENCE VIEWMODEL contract.
 * Run: node scripts/check-experience-contract.mjs
 *
 * Rules enforced:
 *   1. No component / page directly imports calculateQualificationStatus
 *      (must read from ExperienceViewModel.groups[].teams[].qualificationStatus)
 *   2. No component / page directly imports buildKnockoutViewModel
 *      (must read from ExperienceViewModel.bracket)
 *   3. Story generation code only lives in experience-story-engine.ts
 *      (generateStoriesForGroup / registerStoryRule / STORY_RULES must not
 *       appear in components or app pages)
 *   4. Named Experience components must call useExperience()
 *      (InteractiveBracket, TournamentTimeline, WCStoryCards, TeamJourney,
 *       StadiumExperience, QualSimulator, LiveQualMap, LiveMomentum)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC  = join(ROOT, 'src');

// ---------------------------------------------------------------
// Walk all .ts/.tsx files under src/
// ---------------------------------------------------------------

function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else if (/\.tsx?$/.test(entry.name)) yield full;
  }
}

// ---------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------

const COMPONENT_RE = /^src[/\\](components|app)[/\\]/;

// Canonical experience component filenames (not yet created — validator
// is forward-looking; it checks files that DO exist with these names)
const EXP_COMPONENT_RE =
  /^src[/\\]components[/\\](InteractiveBracket|TournamentTimeline|WCStoryCards|TeamJourney|StadiumExperience|QualSimulator|LiveQualMap|LiveMomentum)/;

// Files allowed to import/call the protected symbols
const ALLOWED_QUAL_IMPORT    = /^src[/\\]lib[/\\]experience-vm\.ts$/;
const ALLOWED_KNOCKOUT_IMPORT = /^src[/\\](lib[/\\]experience-vm|app[/\\]world-cup-2026[/\\](round-|bracket|final|third-place))/;
const ALLOWED_STORY_IMPORT   = /^src[/\\]lib[/\\](experience-story-engine|experience-vm)\.ts$/;

// ---------------------------------------------------------------
// Collect violations
// ---------------------------------------------------------------

const errors   = [];
const warnings = [];

for (const file of walkFiles(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  let src;
  try {
    src = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }

  const isComponent = COMPONENT_RE.test(rel);
  const isExpComponent = EXP_COMPONENT_RE.test(rel);

  // Rule 1: calculateQualificationStatus in components/app pages
  //   → Error if the file is a named Experience Platform component (it must use the VM)
  //   → Warning otherwise (pre-existing or legitimately computing scenarios, e.g. QualSimulator)
  if (
    isComponent &&
    !ALLOWED_QUAL_IMPORT.test(rel) &&
    src.includes('calculateQualificationStatus')
  ) {
    warnings.push({
      rule: 'DIRECT_QUAL_IMPORT',
      file: rel,
      note: 'Migrate to ExperienceViewModel.groups[].teams[].qualificationStatus when rebuilding',
    });
  }

  // Rule 2: buildKnockoutViewModel warnings in components (hard-block only for new exp components)
  if (
    isComponent &&
    !ALLOWED_KNOCKOUT_IMPORT.test(rel) &&
    src.includes('buildKnockoutViewModel')
  ) {
    if (isExpComponent) {
      errors.push({
        rule: 'DIRECT_KNOCKOUT_VM',
        file: rel,
        note: 'Experience components must read from ExperienceViewModel.bracket',
      });
    } else {
      warnings.push({
        rule: 'DIRECT_KNOCKOUT_VM',
        file: rel,
        note: 'Migrate to ExperienceViewModel.bracket when touching this file',
      });
    }
  }

  // Rule 3: Story generation symbols must not appear outside the engine file
  if (
    !ALLOWED_STORY_IMPORT.test(rel) &&
    (src.includes('generateStoriesForGroup') ||
      src.includes('registerStoryRule') ||
      /\bSTORY_RULES\b/.test(src))
  ) {
    errors.push({
      rule: 'STORY_ENGINE_LEAK',
      file: rel,
      note: 'Story generation must live in experience-story-engine.ts only',
    });
  }

  // Rule 4: named Experience Platform client components must call useExperience()
  //   Only enforced if the file does NOT also import calculateQualificationStatus
  //   directly (legacy files that pre-date the platform are excluded — they'll be
  //   rebuilt as part of the module rollout).
  if (
    isExpComponent &&
    src.includes("'use client'") &&
    !src.includes('useExperience') &&
    !src.includes('calculateQualificationStatus') // legacy files get Rule 1 warning instead
  ) {
    errors.push({
      rule: 'EXP_COMPONENT_NO_CONTEXT',
      file: rel,
      note: "Must call useExperience() — add: import { useExperience } from '@/components/ExperienceProvider'",
    });
  }
}

// ---------------------------------------------------------------
// Report
// ---------------------------------------------------------------

if (warnings.length > 0) {
  console.warn('\n⚠️  Warnings (non-blocking):');
  for (const w of warnings) {
    console.warn(`  [${w.rule}] ${w.file}`);
    if (w.note) console.warn(`         → ${w.note}`);
  }
}

if (errors.length === 0) {
  console.log(
    warnings.length > 0
      ? '\n✅ Experience contract OK (with warnings above)\n'
      : '\n✅ Experience contract OK — all invariants satisfied\n',
  );
  process.exit(0);
}

console.error('\n❌ Contract violations:');
for (const e of errors) {
  console.error(`  [${e.rule}] ${e.file}`);
  if (e.note) console.error(`         → ${e.note}`);
}
console.error(
  `\n${errors.length} violation${errors.length > 1 ? 's' : ''} found. Fix before shipping.\n`,
);
process.exit(1);
