D:/projects/goalradar/WC_MATCH_TRACE.md

The file is written. Here is a summary of what the trace found:

**Match traced: South Africa 1–0 Korea Republic (25 June 2026)**

**3 PASS, 3 FAIL, 5 CANNOT VERIFY**

Key findings:

1. **Results page / Fixtures page / Hub feed: PASS.** The score "South Africa 1–0 Korea Republic" appears consistently on all three result-display surfaces as FT on June 25.

2. **South Africa team page: FAIL.** Shows 0 matches played, 0 points, and a stale "3rd-Place Race" qualification label. The win has not propagated to the team page standing block. ISR has not revalidated.

3. **Group J standings page: FAIL.** Shows all four teams (Uruguay, Croatia, South Africa, Peru) at 0 points, 0 played — despite a completed match on the same day. Standing pages are ISR-stale.

4. **Qualification status: FAIL.** South Africa's "3rd-Place Race" at 50% is a pre-match label. A 3-point win should move them to "In Contention" at minimum.

5. **Critical group assignment conflict.** Source code (`wc-all-teams.ts`) places South Korea in **Group B**, not Group J. The Group J page lists Uruguay, Croatia, South Africa, Peru — no Korea Republic. The match "South Africa 1–0 Korea Republic" is either a provider data error (cross-group match) or the source code group assignment for South Korea is wrong. The Mexico team page reinforces this anomaly: it shows Mexico beating South Korea and South Africa, but both teams are in different groups from Mexico (Group C). No match detail page URL or fdMatchId was visible on any surface to trace the specific provider record.
