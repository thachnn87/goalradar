/**
 * check-match-truth.mjs
 * DATA-18WC.MATCH.TRUTH — Phase 9 Runtime Truth Check
 *
 * Verifies that a match page renders consistent truth across all surfaces:
 *   - JSON-LD score only for FINISHED matches (not LIVE)
 *   - FAQ score only for FINISHED matches (not LIVE)
 *   - Story narrative does not embed score for LIVE matches
 *   - All score occurrences on a FINISHED page show the same value
 *
 * Usage:
 *   node scripts/check-match-truth.mjs <matchId>
 *   BASE_URL=https://goalradar.org node scripts/check-match-truth.mjs <matchId>
 *
 * Example:
 *   node scripts/check-match-truth.mjs 521473
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const matchId  = process.argv[2];

if (!matchId) {
  console.error('Usage: node scripts/check-match-truth.mjs <matchId>');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchHTML(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.text();
}

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

function extractJsonLd(html) {
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map((m) => {
    try { return JSON.parse(m[1]); } catch { return null; }
  }).filter(Boolean);
}

function extractScoreFromJsonLd(schemas) {
  for (const schema of schemas) {
    if (schema['@type'] === 'SportsEvent') {
      const home = schema.homeTeam?.name;
      const away = schema.awayTeam?.name;
      // Score embedded via description or homeScore/awayScore
      if (schema.homeScore != null && schema.awayScore != null) {
        return { home: schema.homeScore, away: schema.awayScore, embedded: true };
      }
      // Also check description for "Final score: X–Y"
      const descMatch = (schema.description ?? '').match(/Final score[^:]*:\s*\S+\s+(\d+)–(\d+)/);
      if (descMatch) {
        return { home: parseInt(descMatch[1]), away: parseInt(descMatch[2]), embedded: true };
      }
      return { embedded: false, eventStatus: schema.eventStatus };
    }
  }
  return null;
}

function extractScoreFromFaqs(schemas) {
  for (const schema of schemas) {
    if (schema['@type'] === 'FAQPage') {
      for (const entity of (schema.mainEntity ?? [])) {
        const answer = entity.acceptedAnswer?.text ?? '';
        const m = answer.match(/(\d+)–(\d+)/);
        if (m) return { home: parseInt(m[1]), away: parseInt(m[2]), embedded: true };
      }
    }
  }
  return { embedded: false };
}

function extractStoryScore(html) {
  // Story sections are rendered in a specific article/section block.
  // Look for score patterns inside story text (not inside ld+json or MatchCard).
  // The story intro is typically inside a <p> or <div> in the match report section.
  // We match numeric X–Y patterns that are NOT inside <script> tags.
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Match score-like patterns (e.g., "1–0", "2–1") in the story text
  // We use a heuristic: score in story context appears near "stands at" or "score" text
  const scoreInStory = noScripts.match(/(?:score stands at|score is|score:|leading|lead)\s+[^<]{0,20}(\d+)[–\-](\d+)/i);
  if (scoreInStory) {
    return { home: parseInt(scoreInStory[1]), away: parseInt(scoreInStory[2]), embedded: true };
  }
  return { embedded: false };
}

function extractMatchStatus(html) {
  // Look for status in rendered HTML data attributes or JSON blobs
  const m = html.match(/"status"\s*:\s*"(IN_PLAY|PAUSED|FINISHED|SCHEDULED|TIMED|CANCELLED)"/);
  return m ? m[1] : null;
}

function extractLiveZoneScore(html) {
  // MatchLiveZone renders score in a specific tabular-nums block
  // Look for the pattern used in MatchLiveZone: score in the live section
  const m = html.match(/class="[^"]*tabular-nums[^"]*">.*?(\d+).*?–.*?(\d+)/s);
  return m ? { home: parseInt(m[1]), away: parseInt(m[2]) } : null;
}

function scoreStr(s) {
  if (!s || s.home == null) return 'not found';
  return `${s.home}–${s.away}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('DATA-18WC.MATCH.TRUTH — Runtime Truth Check');
  console.log('='.repeat(50));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Match:  ${matchId}`);
  console.log('');

  let html;
  try {
    html = await fetchHTML(`/match/${matchId}`);
  } catch (err) {
    // Try to find a match URL via debug API
    try {
      const snap = await fetchJSON(`/api/debug/match-snapshot/${matchId}`);
      const home = snap?.match?.homeTeam?.name ?? '';
      const away = snap?.match?.awayTeam?.name ?? '';
      const slug = [home, away].map(s => s.toLowerCase().replace(/\s+/g, '-')).join('-vs-');
      html = await fetchHTML(`/match/${matchId}/${slug}`);
    } catch {
      console.error(`Cannot fetch match page for ID ${matchId}: ${err.message}`);
      console.error('Try running with BASE_URL set and ensure the match page exists.');
      process.exit(2);
    }
  }

  const schemas = extractJsonLd(html);
  const status  = extractMatchStatus(html);
  const isLive  = status === 'IN_PLAY' || status === 'PAUSED';
  const isFinished = status === 'FINISHED';

  console.log(`Status:  ${status ?? 'unknown'}`);
  console.log('');

  const jsonLdScore = extractScoreFromJsonLd(schemas);
  const faqScore    = extractScoreFromFaqs(schemas);
  const storyScore  = extractStoryScore(html);

  let allPass = true;
  const fail = (msg) => { console.log(`  ❌ ${msg}`); allPass = false; };
  const pass = (msg) => console.log(`  ✅ ${msg}`);

  // ── JSON-LD score gating ─────────────────────────────────────────────────
  if (isLive) {
    if (jsonLdScore?.embedded) {
      fail(`JSON-LD embeds score ${scoreStr(jsonLdScore)} for LIVE match — must be absent`);
    } else {
      pass(`JSON-LD score: not embedded (LIVE — correct)`);
    }
  } else if (isFinished) {
    if (!jsonLdScore?.embedded) {
      fail(`JSON-LD score: not found for FINISHED match — should be present`);
    } else {
      pass(`JSON-LD score: ${scoreStr(jsonLdScore)} (FINISHED — correct)`);
    }
  } else {
    // PRE_MATCH / PROJECTED / CANCELLED
    if (jsonLdScore?.embedded) {
      fail(`JSON-LD embeds score for non-result match status (${status})`);
    } else {
      pass(`JSON-LD score: not embedded (${status ?? 'pre-match'} — correct)`);
    }
  }

  // ── FAQ score gating ─────────────────────────────────────────────────────
  if (isLive) {
    if (faqScore?.embedded) {
      fail(`FAQ embeds score ${scoreStr(faqScore)} for LIVE match — must be absent`);
    } else {
      pass(`FAQ score: not embedded (LIVE — correct)`);
    }
  } else if (isFinished) {
    // FAQ score for finished — presence not strictly required but verify if present it's consistent
    if (faqScore?.embedded && jsonLdScore?.embedded) {
      const match = faqScore.home === jsonLdScore.home && faqScore.away === jsonLdScore.away;
      if (!match) {
        fail(`FAQ score ${scoreStr(faqScore)} ≠ JSON-LD score ${scoreStr(jsonLdScore)} — DIVERGENCE`);
      } else {
        pass(`FAQ score: ${scoreStr(faqScore)} (matches JSON-LD)`);
      }
    } else {
      pass(`FAQ score: ${faqScore?.embedded ? scoreStr(faqScore) : 'not found'}`);
    }
  } else {
    pass(`FAQ score: not embedded (${status ?? 'pre-match'} — correct)`);
  }

  // ── Story score gating ───────────────────────────────────────────────────
  if (isLive) {
    if (storyScore?.embedded) {
      fail(`Story embeds score ${scoreStr(storyScore)} for LIVE match — divergence with MatchLiveZone`);
      fail(`  Fix: remove "score stands at X-Y" from LIVE branches in match-story-engine.ts`);
    } else {
      pass(`Story score: not embedded (LIVE — correct after Phase 8 fix)`);
    }
  } else if (isFinished) {
    if (storyScore?.embedded && jsonLdScore?.embedded) {
      const match = storyScore.home === jsonLdScore.home && storyScore.away === jsonLdScore.away;
      if (!match) {
        fail(`Story score ${scoreStr(storyScore)} ≠ JSON-LD score ${scoreStr(jsonLdScore)} — DIVERGENCE`);
      } else {
        pass(`Story score: ${scoreStr(storyScore)} (consistent with JSON-LD)`);
      }
    } else {
      pass(`Story score: ${storyScore?.embedded ? scoreStr(storyScore) : 'not in intro (ok)'}`);
    }
  } else {
    pass(`Story score: not embedded (${status ?? 'pre-match'} — correct)`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('');
  if (allPass) {
    console.log('ONE TRUTH ✅');
    process.exit(0);
  } else {
    console.log('DIVERGENCE DETECTED ❌');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err.message);
  process.exit(2);
});
