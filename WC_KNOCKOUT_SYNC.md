# WC_KNOCKOUT_SYNC.md — Knockout Synchronization Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Synchronization Chain

```
Standings (BROKEN — all zeros)
  ↓ calculateQualificationStatus()
  ↓ Returns all UNDECIDED (groups page badges)
     [NOT connected to bracket slot filling — slots filled from FD API match data]

FD API knockout match data
  ↓ getWCKnockoutMatchesCached()
  ↓ KV: goalradar:/competitions/WC/matches
  ↓ overlayMatchStates() — applies per-match snapshots
  ├─→ Bracket page (ISR 900s)
  ├─→ Round-of-32 page (ISR 900s)
  └─→ Hub bracket section (ISR 30s)
```

---

## Consumer Agreement

| Consumer | Source | ISR | Agreement |
|---|---|---|---|
| Bracket `/world-cup-2026/bracket` | `getWCKnockoutMatchesCached` + `WC_KNOCKOUT_SLOTS` | 900s | **By code** — same data source |
| Round-of-32 `/world-cup-2026/round-of-32` | `getWCKnockoutMatchesCached` + `WC_KNOCKOUT_SLOTS` | 900s | **Guaranteed identical** — same KV key, same static array |
| Hub bracket | `getWCKnockoutMatchesCached` | 30s | **Structurally identical** — BUT hub uses `<WCBracket>` without LocalKnockoutRound fallback. When API has no knockout data, hub shows TBD dashes; bracket page shows dated slot schedule. **Informational divergence.** |
| Team pages | no bracket slot info shown | N/A | N/A |

---

## Qualification → Bracket Slot Mapping

The qualification engine (`calculateQualificationStatus`) computes badges shown on group/team pages. It does **NOT** feed the bracket slot assignment. The bracket slots are populated purely by FD API returning knockout match fixtures with homeTeam/awayTeam set.

This means:
- Groups page can show "UNDECIDED" for a team that has already qualified
- The same team's R32 slot can be filled in the bracket (if FD API has posted the fixture)
- These two surfaces are **architecturally decoupled** — no fan-out from qualification to bracket

---

## Duplicate Qualification Logic

**None found.** `calculateQualificationStatus()` in `src/lib/wc-qualification.ts` is the single point of qualification computation. Both hub and groups pages import and call it directly. No inline/ad-hoc qualification logic exists.

---

## R32 M16 Label Issue

```typescript
['LAST_32', 16, '2026-07-09', '21:00', 'dallas', 'Arlington, TX', '3rd best', '3rd best'],
```

Both `homeLabel` and `awayLabel` are `'3rd best'` — no group information. The other 15 R32 slots provide group context (e.g., `'1st Group A'`, `'3rd (B/C/D)'`). This is the only slot with identical labels on both sides.

**Impact:** Low — bracket display shows "3rd best vs 3rd best" which is technically correct (both slots are best third-place teams) but provides no group information to help users understand which groups feed this match.

---

## ISR Divergence Window

When knockout data first arrives from FD API:
- Hub: reflects within **30 seconds** (30s ISR)
- Bracket / Round-of-32: reflects within **15 minutes** (900s ISR)

Users on the hub will see R32 teams up to 15 minutes before they appear on the bracket page. This is consistent behavior by design (hub is the "live" surface) but may appear broken to users navigating from hub to bracket.
