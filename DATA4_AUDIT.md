# DATA-4 Audit — Today Section Consistency
## GoalRadar · Sprint DATA-4

Generated: 2026-06-12

---

## Measured production state (before fix)

Homepage simultaneously showed:
- "📅 Today's World Cup Matches" → **"No World Cup matches today"**
- "🗓 Upcoming World Cup Fixtures" → Canada–Bosnia (19:00 **today**),
  Qatar–Switzerland (19:00 **today**), Brazil–Morocco (22:00 **today**),
  plus genuinely-future fixtures — contradictory UX.

## Audit answers

| Question | Finding |
|----------|---------|
| 1. Why is Today empty? | The WC Today section read `getTodayMatchesCached()` — the **cross-competition** `/matches?dateFrom={today}&dateTo={today}` KV feed — then filtered `competition.code === 'WC'`. That feed returned no WC entries despite 6 WC fixtures today. The orchestrator *does* refresh the same key (`today-matches` task, verified in the route), so this is a provider/feed payload issue (the cross-comp `/matches` day feed is not a reliable mirror of the WC competition feed), not a key mismatch. |
| 2. Is `getTodayMatchesCached()` stale? | Possibly additionally stale (per-day key + per-lambda L1 of up to 60 s for `TTL.MATCH`), but the primary issue is content: even fresh, the cross-comp feed disagreed with the WC competition feed that drives every other surface. |
| 3. Should Today derive from the WC upcoming feed? | **Yes** — the hub already derives "today" this way (`allUpcoming.filter(utcDate startsWith today)`) and was consistent. Same authority everywhere = DATA-2 principle applied to day-bucketing. |
| 4. Do Today and Upcoming overlap incorrectly? | They could not overlap before (different feeds), but Upcoming **wrongly contained today's fixtures** because it had no day boundary — `slice(0, 6)` of everything scheduled. |
| Timezone handling | All boundaries are UTC: `today = new Date().toISOString().split('T')[0]` vs `match.utcDate.startsWith(today)` — consistent with the hub and the spec ("kickoff date is today UTC → Today"). Client-side `LocalTime` badges still render visitor-local times; section membership is UTC by design. |

## Root cause

Two independent feeds answered the same question ("what is today?") and
disagreed: the WC sections sourced from the WC competition feed except
Today, which sourced from the unreliable cross-competition feed. Upcoming
additionally lacked a day boundary.

## Fix design

- WC **Today** = WC upcoming feed (DATA-2 overlaid) → `SCHEDULED/TIMED`
  with `utcDate` starting today (UTC).
- WC **Upcoming** = same feed → `utcDate` day **> today** (tomorrow onward),
  top 6. Disjoint by construction — no duplicates possible.
- `getTodayMatchesCached()` remains in use **only** for the
  "Other Leagues" section (its original purpose).
- Live/finished strays keep their DATA-3 routing (Live / Results).
