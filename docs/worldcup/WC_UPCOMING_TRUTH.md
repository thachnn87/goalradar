D:/projects/goalradar/WC_UPCOMING_TRUTH.md

The file has been written. Here is a summary of what the audit found from the production HTML snapshots:

**Fixtures page (/world-cup-2026/fixtures)** is the only page that reliably surfaces upcoming data. It shows 16 group-stage matches across June 25–27 with real team names — no TBD. No R32 fixtures appear anywhere.

**Three confirmed bugs:**

1. Group standings are zeroed out (Group C and Group J confirmed stale — Mexico has 3 wins yet shows P=0, Croatia/South Africa won matches yet show 0 points). Root cause: ISR cache staleness or KV standings authority not populated.

2. Mexico team page contradiction — shows "3 matches remaining" in qualification text but P=0 in the standings table, while the results section correctly shows 3 wins. Two data sources diverged.

3. R32 upcoming fixtures are absent everywhere. Most likely cause: the selector requires non-null team names, so all 32 R32 bracket slots (which are TBD until groups finish) are suppressed. The editorial note "Knockout stages continue through 19 July 2026" is static copy, not a data-driven row.

**Hub, Bracket, France, Norway pages:** HTML bodies truncated before content rendered — cannot audit upcoming section from these snapshots. Round of 32 page was policy-blocked by the fetch tool.
