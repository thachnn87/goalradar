/**
 * DATA-14B: Production revalidation + debug inspection.
 * Tries REVALIDATE_SECRET for match-specific revalidation endpoints.
 * Falls back to documenting required CRON_SECRET commands.
 */

const BASE             = 'https://goalradar.org';
const REVALIDATE_SECRET = '9f1e7ab483d0f9f55d71b2d80c7c84a6f1f62b4f7c2d6a1e93f0a6f8e9b3d4c115jun2026';

// All affected FD match IDs (stale or unenriched)
const AFFECTED = [
  { id: '537364', label: 'Iran 2–2 New Zealand',    issue: 'stale (2 of 4 goals)',    expectedGoals: 4 },
  { id: '537358', label: 'Sweden 5–1 Tunisia',      issue: 'stale (5 of 6 goals)',    expectedGoals: 6 },
  { id: '537357', label: 'Netherlands 2–2 Japan',   issue: 'not enriched (0 goals)',  expectedGoals: 4 },
];

async function postRevalidate(matchId, secret) {
  const res = await fetch(`${BASE}/api/revalidate/match/${matchId}?secret=${secret}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function getDebug(matchId, secret) {
  const res = await fetch(`${BASE}/api/debug/espn-enrichment/${matchId}?secret=${secret}`);
  const body = await res.text();
  return { status: res.status, body };
}

console.log('=== DATA-14B Production Revalidation ===\n');

// Step 1: Try debug endpoints with REVALIDATE_SECRET
console.log('── Step 1: Debug endpoint (REVALIDATE_SECRET) ──');
for (const m of AFFECTED) {
  console.log(`\n  Match ${m.id} (${m.label}):`);
  const debug = await getDebug(m.id, REVALIDATE_SECRET);
  console.log(`    GET /api/debug/espn-enrichment/${m.id} → HTTP ${debug.status}`);
  if (debug.status === 200) {
    try {
      const d = JSON.parse(debug.body);
      console.log(`    enrichmentEnabled: ${d.enrichmentEnabled}`);
      console.log(`    eventCacheHit: ${d.eventCacheHit}`);
      console.log(`    goalsCount: ${d.goalsCount} (expected: ${m.expectedGoals})`);
      console.log(`    cardsCount: ${d.cardsCount}`);
      console.log(`    substitutionsCount: ${d.substitutionsCount}`);
      console.log(`    snapshotGoalsCount: ${d.snapshotGoalsCount}`);
      console.log(`    enrichmentApplied: ${d.enrichmentApplied}`);
      console.log(`    source: ${d.source}`);
    } catch {
      console.log(`    body: ${debug.body.slice(0, 200)}`);
    }
  } else {
    console.log(`    body: ${debug.body.slice(0, 100)}`);
  }
}

// Step 2: Try revalidation with REVALIDATE_SECRET
console.log('\n\n── Step 2: POST revalidate/match/{id} (REVALIDATE_SECRET) ──');
let revalidateSecretWorks = false;
for (const m of AFFECTED) {
  console.log(`\n  POST /api/revalidate/match/${m.id}:`);
  const r = await postRevalidate(m.id, REVALIDATE_SECRET);
  console.log(`    HTTP ${r.status}: ${r.body.slice(0, 200)}`);
  if (r.status === 200) revalidateSecretWorks = true;
}

if (!revalidateSecretWorks) {
  console.log('\n  ⚠  REVALIDATE_SECRET does not work for match-specific revalidation.');
  console.log('     CRON_SECRET is required. Run after retrieving from Vercel dashboard:');
  for (const m of AFFECTED) {
    console.log(`     curl -X POST "https://goalradar.org/api/revalidate/match/${m.id}?secret=$CRON_SECRET"`);
  }
}

// Step 3: Try the general revalidate endpoint with REVALIDATE_SECRET
console.log('\n\n── Step 3: POST /api/revalidate (ISR paths, REVALIDATE_SECRET) ──');
{
  const paths = AFFECTED.map(m => `/match/${m.id}`);
  const res = await fetch(`${BASE}/api/revalidate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REVALIDATE_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  });
  const body = await res.text();
  console.log(`  HTTP ${res.status}: ${body.slice(0, 300)}`);
}
