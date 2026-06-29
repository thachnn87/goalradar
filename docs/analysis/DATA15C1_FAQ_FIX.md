# DATA-15C.1 FAQ Fallback Fix

Date: 2026-06-17
Scope: `buildFaqs` in `src/app/match/[id]/page.tsx`. No provider/identity changes.

---

## Problem

The FAQ scorer fallback claimed a match was **goalless** whenever `goals.length === 0`,
regardless of the actual score:

```tsx
} else {
  faqs.push({
    q: `Were there any goals in ${home} vs ${away}?`,
    a: `The match ended goalless (0–0).`,   // ← false when score > 0 but events missing
  });
}
```

When enrichment is missing/stale (e.g. the DATA-15B Australia 2–0 Turkey false
negative, or the current production regression), a **2–0** or **2–2** match
rendered *"The match ended goalless (0–0)."* — a user-facing falsehood, also
emitted into FAQ structured data (schema.org `Answer`), risking incorrect rich
snippets.

---

## Fix

Distinguish "genuinely 0-0" from "scored but scorer data unavailable" using the FD
score (`ftH`, `ftA`), which is always authoritative:

```tsx
} else if (ftH + ftA > 0) {
  // Score is non-zero but no goal events are available (enrichment missing
  // or not yet applied). NEVER claim "goalless" — that would be false. (DATA-15C.1)
  faqs.push({
    q: `Who scored in ${home} vs ${away}?`,
    a: `${home} ${ftH}–${ftA} ${away}. Detailed scorer information is currently unavailable for this match.`,
  });
} else {
  faqs.push({
    q: `Were there any goals in ${home} vs ${away}?`,
    a: `The match ended goalless (0–0).`,
  });
}
```

### Behaviour matrix

| Score | goals.length | FAQ answer |
|-------|--------------|-----------|
| > 0 | > 0 | "Goals: {scorer list}." (unchanged) |
| **> 0** | **0** | **"… Detailed scorer information is currently unavailable …"** (new) |
| 0–0 | 0 | "The match ended goalless (0–0)." (unchanged — now only path to this) |

`ftH`/`ftA` are the existing `match.score.fullTime` values already computed earlier
in `buildFaqs`; no new data is read.

---

## Verification

- `npx tsc --noEmit` → 0 errors.
- Logic: the only path to "goalless" is now `ftH + ftA === 0`. A scored match with
  missing events takes the new middle branch.
- Browser preview not driven: this branch is reached only for a FINISHED match with
  score > 0 and zero enriched goals, which requires live KV/enrichment state not
  reproducible locally (no KV credentials). It will be observable on production once
  the DATA-14A→15C stack deploys — and is the correct copy to show during the brief
  window before a match re-enriches.

---

## Relationship to enrichment

This is a **safety net**, not a substitute for enrichment. Once DATA-14A→15C deploy
and matches are revalidated (see `DATA15C1_PRODUCTION_AUDIT.md` §5), scored matches
show the real scorer list and never reach this branch. The branch protects against
any future window where a scored match lacks events — it can no longer print a
falsehood.
