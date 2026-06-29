# WC_UPCOMING_PIPELINE.md — Upcoming Engine Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Upcoming Match Pipeline

```
FD API /competitions/WC/matches?status=SCHEDULED,TIMED
  ↓ refreshEndpoint() via orchestrator wc-upcoming task
  ↓ KV: goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED  TTL 1800s (30m)
  ↓ getWCAuthorityMatchesV2() — authority cache filters upcoming
  ↓ classifyMatchState() → 'upcoming' bucket
  ↓ Hub: upcoming section
  ↓ Fixtures page: getWCAuthorityMatchesV2() → filter SCHEDULED/TIMED
  ↓ ISR: Hub 30s, Fixtures 900s
  ↓ Production HTML
```

---

## Group Stage Upcoming (June 25 — last day)

From production evidence, tonight's fixtures are visible on the Fixtures page:
- 20:00 UTC: Ecuador vs Germany ✓
- 20:00 UTC: Curaçao vs Ivory Coast ✓
- 23:00 UTC: Tunisia vs Netherlands ✓
- 23:00 UTC: Japan vs Sweden ✓

These are served from the authority cache path — **OK**.

---

## Knockout Upcoming (R32, July 2–9)

When group stage ends tonight (June 25), R32 fixtures become the only upcoming matches. These are currently TBD (teams unknown until all groups complete).

**Does the upcoming pipeline include R32 fixtures even with TBD teams?**

From `getWCKnockoutMatchesCached()`:
- If FD API has posted R32 fixtures with TBD teams: they appear via authority path
- If FD API has not posted fixtures yet: `WC_KNOCKOUT_SLOTS` static array is used as fallback (in bracket/round-of-32 pages)

**Hub upcoming section:** When there are no SCHEDULED/TIMED group matches, the hub's upcoming widget will show an empty state unless R32 matches are in the FD API with TIMED status. The `WC_KNOCKOUT_SLOTS` fallback is only used in bracket/round-of-32 pages, not on the hub upcoming section.

**Risk:** After June 25 final matches, if FD API hasn't populated R32 fixture dates yet, the hub upcoming section will show empty. Bracket page will still show the static slot schedule (dated July 2–9). This creates a visible divergence: hub shows "no upcoming" while bracket shows fixtures.

---

## ISR TTL Summary

| Page | Upcoming Source | ISR | Max Stale |
|---|---|---|---|
| Hub `/world-cup-2026` | authority cache filter | 30s | 30s |
| Fixtures `/world-cup-2026/fixtures` | authority cache | 900s | 15m |
| Bracket `/world-cup-2026/bracket` | `getWCKnockoutMatchesCached` + static slots | 900s | 15m |
| Round-of-32 | same as bracket | 900s | 15m |

---

## Verdict

- Group stage upcoming: **OK** — authority path healthy
- Post-group-stage knockout upcoming (hub): **AT RISK** — hub will show empty if FD API hasn't posted R32 fixtures yet; bracket page shows static slot schedule as fallback
- Recommendation: Add `WC_KNOCKOUT_SLOTS` as upcoming fallback in hub when authority matches < 1 upcoming
