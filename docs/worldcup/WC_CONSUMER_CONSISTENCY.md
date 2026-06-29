`D:\projects\goalradar\WC_CONSUMER_CONSISTENCY.md`

The file is written. Here is what the audit found:

**4 of 5 data points FAIL.**

**DP1 — Mexico points (Group C):** Every standings surface (Hub, Groups, Group C, Mexico team page) renders Mexico at 0 pts / 0 played. The Results and Fixtures pages correctly show Czechia 0-3 Mexico and two other wins as FT. **FAIL.**

**DP2 — France points (Group A):** All group tables show France at 0 pts / 0 played. France's team page badge says "3 matches remaining" when only 1 is left (Norway on Jun 26). Results correctly lists both France wins. **FAIL.**

**DP3 — Norway qualification status:** Norway's team page badge says "Qualified" (premature — France vs Norway on Jun 26 is unplayed). The Groups page lists Group I with 5 teams, impossible in a 16-group-of-3 format. Norway appears misassigned or double-listed. **FAIL.**

**DP4 — South Africa vs South Korea score + standing:** Score (1-0) is consistent on Hub/Results/Fixtures. But all group tables show SA at 0 pts / 0 played. South Korea's badge says "3 matches remaining" when 2 are done. Critical: South Africa's team page says their opening fixture was vs Mexico, but the Group J page lists Group J as Uruguay/Croatia/South Africa/Peru — group composition inconsistency. **FAIL.**

**DP5 — Bracket slot state:** All 32 slots correctly show TBD on both Bracket and R32 pages. No premature fills. **PASS.**

**Root cause:** Group standings tables universally return all-zeros across every surface while the Results/Fixtures pages (different data path) correctly show completed matches as FT. The standings computation pipeline is either reading a pre-tournament ISR/KV snapshot or the points aggregation write is not reaching the cache consumed by standings pages.
