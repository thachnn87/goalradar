# SEO_STORY_GUIDE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## H1 / Headline per Match Type

| Match Type / Stage | Headline pattern |
|---|---|
| STANDARD | `Match Report: {Home} vs {Away} – {Competition} {Matchday}` |
| WC_GROUP | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Group {X}` |
| WC LAST_32 | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Round of 32` |
| WC LAST_16 | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Round of 16` |
| WC QUARTER_FINALS | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Quarter-finals` |
| WC SEMI_FINALS | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Semi-finals` |
| WC THIRD_PLACE | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Third Place Play-off` |
| WC FINAL | `Match Report: {Home} vs {Away} – FIFA World Cup 2026 Final` |

---

## Page `<title>` per Status

| Status | Title pattern |
|---|---|
| Upcoming | `{Home} vs {Away} Preview \| {Comp} \| GoalRadar` |
| Live | `{Home} vs {Away} LIVE Score \| {Comp}` |
| Finished | `{Home} X–Y {Away} – Match Result \| {Comp} \| GoalRadar` |
| Cancelled | `{Home} vs {Away} – Cancelled \| {Comp} \| GoalRadar` |

The WC Final finished title becomes:
> Brazil 2–1 France – FIFA World Cup 2026 Final Result | GoalRadar

---

## H2 Section Headings per Match Type

### STANDARD

```
Introduction
First Half
Second Half
Result Impact
Competition Context
```

### WC_GROUP

```
Introduction
First Half
Second Half
Group Stage Impact
FIFA World Cup 2026
```

### WC_KNOCKOUT (LAST_32 through SEMI_FINALS)

```
Introduction
First Half
Second Half
Road to the Final
FIFA World Cup 2026
```

### WC_KNOCKOUT (THIRD_PLACE)

```
Introduction
First Half
Second Half
The Bronze Medal
FIFA World Cup 2026
```

### WC_KNOCKOUT (FINAL)

```
Introduction
First Half
Second Half
The World Cup Champion
FIFA World Cup 2026
```

---

## JSON-LD Schema

| Schema | Every match | WC-specific |
|---|---|---|
| SportsEvent | ✅ | `eventStatus`, `homeTeam`, `competitor`, `location`, `organizer` |
| Article | ✅ | `headline` uses stage-specific text |
| BreadcrumbList | ✅ | WC: Home / WC / Group|Bracket / Match |
| FAQPage | ✅ | 5–8 Q&A, stage-aware questions |

### BreadcrumbList: WC Group

```
GoalRadar Home
  ↓
FIFA World Cup 2026
  ↓
Group A
  ↓
Morocco vs Belgium
```

### BreadcrumbList: WC Knockout

```
GoalRadar Home
  ↓
FIFA World Cup 2026
  ↓
Round of 32 | Round of 16 | etc.
  ↓
South Africa vs Canada
```

---

## FAQ Generation — Stage-Aware Questions

### WC_KNOCKOUT upcoming

- "When is {Home} vs {Away}?"
- "Where is the {stageLabel} played?"
- "What happens if {Home} vs {Away} is a draw?"
- "What stage is this in the World Cup?"

### WC_KNOCKOUT finished

- "What was the {Home} vs {Away} result?"
- "Who won {Home} vs {Away}?"
- "Who scored in {Home} vs {Away}?"
- "Which team advanced from the {stageLabel}?"

### WC_GROUP

- "When is {Home} vs {Away}?"
- "What group are {Home} and {Away} in?"
- "What are the Group {X} standings?"
- "What happens if {Home} vs {Away} is a draw?" → "both teams share a point"

### STANDARD

- Standard set (when, where, competition, result, scorers, H2H)
