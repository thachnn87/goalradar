D:\projects\goalradar\WC_PRODUCTION_TRUTH_MATRIX.md

The file has been written. Here is a summary of what the matrix contains and the key findings:

---

## Summary of findings

**2 PASS, 11 FAIL, 8 PARTIAL, 4 UNKNOWN** across all entities.

### Critical failures (data correctness)

1. **Standings authority is at zero-state across all visible groups.** Group C and Group J both show P=0, Pts=0 for every team despite multiple completed matches. The results page correctly records those same matches (Mexico 3-0 Czechia, South Africa 1-0 South Korea). The write path from match completion to standings authority is broken.

2. **Mexico team page has an internal self-contradiction.** The same page shows "Recent form: W-W-W" and three win results, while the embedded Group C standings table shows P=0, Pts=0, Pts=0. Qualification label reads "84% chance, 3 matches remaining" — Mexico has won all 3 group stage matches and is QUALIFIED outright.

3. **South Africa team page:** P=0 despite a confirmed 1-0 win on June 25. Also shows "Opening fixture vs Mexico" which contradicts the Group J composition shown elsewhere.

4. **Group composition inconsistency:** Group J lists Uruguay, Croatia, South Africa, Peru — but South Korea appears to have played both Mexico and South Africa per the results and Mexico team pages. South Korea's group is unresolvable from the snapshots.

5. **Groups page title/meta:** Claims "12 groups A–L" but WC 2026 has 16 groups A–P — wrong metadata served to search engines.

### Root cause hypothesis (from HTML evidence only)
Match results are being written to the results KV store (results page is correct) but the standings authority KV key is either not being written after match completion, is written to the wrong key, or is being served from a stale ISR cache frozen at tournament-start zero-state.
