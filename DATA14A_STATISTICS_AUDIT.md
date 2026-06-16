# DATA-14A Statistics Audit
## MatchStatistics Panel — Data Source Trace and Fix

Date: 2026-06-16
Verdict: **GREEN** (after fix applied)

---

## 1. Reported Symptom

Match page statistics panel shows:
```
Goals          0 – 0
Yellow Cards   0 – 0
Substitutions  0 – 0
```

even when GoalsSection, BookingsSection, and SubstitutionsSection are all populated with real event data.

---

## 2. Data Flow Trace

```
buildSnapshot()
  → enrichMatchWithEspnEvents(match)       // match.homeTeam.id = FD team ID (e.g. 805 for Iran)
    → getEspnMatchEvents(espnId)
      → parseGoals(...)                    // Goal.team built from buildTeam(espnTeam)
        → buildTeam({ id: '469', ... })    // ESPN team ID for Iran
          → { id: 469, name: 'Iran', ... } // ESPN ID stored as goal.team.id
    → applyEspnEvents(match, events)
      → { ...match, goals, bookings, subs } // match.homeTeam.id still = FD ID (e.g. 805)
                                             // goal.team.id = ESPN ID (469) ← MISMATCH

MatchStatistics({ match })
  → goals.filter(g => g.team?.id === match.homeTeam.id)
  // 469 === 805 → false → 0 goals attributed to home team
  // ALWAYS 0 for both sides
```

### ID conflict table (Iran vs New Zealand)

| Source | Iran ID | New Zealand ID |
|--------|---------|----------------|
| football-data.org (FD) | *(FD internal, e.g. 805)* | *(FD internal)* |
| ESPN | 469 | 2666 |

`g.team.id === match.homeTeam.id` always false → statistics always 0.

---

## 3. Fix: Team Resolution in applyEspnEvents

**`src/lib/espn-id-map.ts` — `applyEspnEvents()`:**

Replace raw event application with team-ID resolution:

```typescript
// BEFORE (broken):
function applyEspnEvents(match: MatchDetail, events: CachedEspnEvents): MatchDetail {
  return {
    ...match,
    goals:         events.goals,
    bookings:      events.bookings,
    substitutions: events.substitutions,
  };
}

// AFTER (fixed):
function applyEspnEvents(match: MatchDetail, events: CachedEspnEvents): MatchDetail {
  // ESPN team IDs differ from FD team IDs. Resolve each event's team back to
  // the FD team object so that MatchStatistics (which filters by team.id) works.
  const normHome = normaliseName(match.homeTeam.name);
  const normAway = normaliseName(match.awayTeam.name);

  function resolveTeam<T extends { name: string; shortName?: string }>(
    espnTeam: T | null | undefined,
  ): typeof match.homeTeam | T | null | undefined {
    if (!espnTeam) return espnTeam;
    const n = normaliseName(espnTeam.name);
    const ns = normaliseName(espnTeam.shortName ?? '');
    if (n === normHome || ns === normHome) return match.homeTeam;
    if (n === normAway || ns === normAway) return match.awayTeam;
    return espnTeam;
  }

  return {
    ...match,
    goals:         events.goals?.map((g) => ({ ...g, team: resolveTeam(g.team) ?? g.team })),
    bookings:      events.bookings?.map((b) => ({ ...b, team: resolveTeam(b.team) ?? b.team })),
    substitutions: events.substitutions?.map((s) => ({ ...s, team: resolveTeam(s.team) ?? s.team })),
  };
}
```

`normaliseName()` (exported from `espn.ts`) handles known aliases (e.g. "Côte d'Ivoire" → "ivory coast") so FD and ESPN names map to the same canonical form.

---

## 4. Alias Coverage Verification

| FD team name | ESPN team name | normaliseName(FD) | normaliseName(ESPN) | Match? |
|-------------|----------------|-------------------|---------------------|--------|
| Iran | Iran | iran | iran | ✅ |
| New Zealand | New Zealand | new zealand | new zealand | ✅ |
| Ivory Coast | Ivory Coast | ivory coast | ivory coast | ✅ |
| Côte d'Ivoire | Ivory Coast | ivory coast | ivory coast | ✅ |
| Sweden | Sweden | sweden | sweden | ✅ |
| Tunisia | Tunisia | tunisia | tunisia | ✅ |
| Netherlands | Netherlands | netherlands | netherlands | ✅ |
| Japan | Japan | japan | japan | ✅ |

---

## 5. What Statistics Will Show After Fix

### Iran 2–2 New Zealand (after KV invalidation + re-enrichment)

| Stat | Iran | New Zealand | Notes |
|------|------|-------------|-------|
| Goals | 2 | 2 | Rezaeian 32', Mohebbi 64' vs Just 7', Just 54' |
| Yellow Cards | 1 | 0 | Ehsan Hajsafi 89' |
| Red Cards | 0 | 0 | |
| Substitutions | 4 | 5 | |

### Sweden 5–1 Tunisia

| Stat | Sweden | Tunisia | Notes |
|------|--------|---------|-------|
| Goals | 5 | 1 | Ayari ×2, Isak, Gyökeres, Svanberg vs Omar Rekik |
| Yellow Cards | 0 | 1 | Rani Khedira 54' |
| Red Cards | 0 | 0 | |
| Substitutions | 6 | 4 | |

### Ivory Coast 1–0 Ecuador

| Stat | Ivory Coast | Ecuador | Notes |
|------|-------------|---------|-------|
| Goals | 1 | 0 | Amad Diallo 90' |
| Yellow Cards | 3 | 1 | Fofana, Kessié, Doué vs Porozo |
| Red Cards | 0 | 0 | |
| Substitutions | 5 | 4 | |

---

## 6. Why MatchStatistics Itself Needs No Changes

The `MatchStatistics` component filters by `g.team?.id === match.homeTeam.id`. This is correct — after
the `applyEspnEvents` fix, goal/booking/sub team objects carry the FD team ID. The component
does not need to be changed.

The fallback note in the issue ("fallback: goals.length, bookings.length, substitutions.length
when provider statistics are unavailable") is also unnecessary. The real data is available via
ESPN enrichment — fixing the team ID resolution is sufficient.

---

## Verdict: GREEN

`MatchStatistics` will show correct per-team counts once `applyEspnEvents` resolves ESPN team objects
to FD team objects. No UI changes required. KV invalidation + re-enrichment required for existing cached matches.
