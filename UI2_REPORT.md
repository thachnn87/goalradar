# UI-2 Report — Mobile Hero Density Optimization
## GoalRadar · Sprint UI-2

Generated: 2026-06-10

---

## Components Changed

| File | Change |
|------|--------|
| `src/components/WCCountdownBanner.tsx` | Mobile (<768px): compact inline strip — `🏆 WC26 starts in 1d 4h · Explore →` (single line, `py-1.5`). Tablet/desktop keep the original chip layout (`py-2 lg:py-2.5`). Live-state label also compacts to `WC26 LIVE NOW` on mobile. |
| `src/app/page.tsx` — `StandardHero` | Mobile: descriptive paragraph hidden, CTAs become a 2×2 grid (Live / Schedule / Standings / 🏆 WC26), padding `p-4`; tablet `p-6`; desktop `p-8` (unchanged). |
| `src/app/page.tsx` — `WCHero` (active from June 11) | Same treatment: both descriptive paragraphs hidden on mobile, CTAs 2×2 grid (WC26 / Schedule / Standings / Bracket-or-Live), padding `px-4 py-4` → `md:px-6 md:py-8` → `lg:px-10 lg:py-10` (desktop = original values). |
| `src/app/page.tsx` — page container | Block spacing `space-y-10` → `space-y-5 md:space-y-8 lg:space-y-10`. |

All behavior is **CSS-only** (Tailwind `md:`/`lg:` media queries). Every variant
is server-rendered in the HTML — **no hydration measurements, no resize
listeners, no CLS**. Branding (colors, gradients, fonts, active states) untouched.

---

## Before vs After — Mobile (<768px, measured in running app)

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Countdown banner height | 73 px (2 wrapped rows) | **29 px** (1 line) | **−60 %** (target ≥40 % ✅) |
| Hero height | 318 px | **166 px** | −48 % |
| First football content offset from page top | 568 px | **332 px** | **−42 %** (target ≥30 % ✅) |
| Horizontal overflow | none | none | ✅ |

### Viewport usage

- **iPhone 14/15 (390×844):** content previously started at 568 px (67 % of the
  viewport consumed by header+banner+hero). It now starts at **332 px (39 %)** —
  the first content section is comfortably inside the first viewport with
  ~500 px of it visible before any scroll. ✅
- **iPhone SE (375×667):** content at 332 px — visible in the first viewport
  (was 568 px, i.e. 85 % of the screen). ✅
- **Android 360:** identical layout, no overflow. ✅

---

## Validation Matrix

| Width | Banner | Hero | Result |
|-------|--------|------|--------|
| 360 px | 29 px inline | 166 px, 2×2 CTA grid, no paragraph | ✅ no overflow |
| 375 px | 29 px inline | 166 px, 2×2 grid confirmed via DOM (`grid-cols-2`, 4 children) | ✅ |
| 390 px | 29 px inline | 166 px, content top 332 px | ✅ |
| 768 px | chip layout, `py-2` (minor reduction) | `p-6`, paragraph visible, flex CTAs full labels | ✅ |
| 1280 px | chip layout `py-2.5` (≈49 px, original) | computed padding **32 px = `p-8` original**, paragraph visible, flex CTAs, full "World Cup 2026" label visible / "WC26" span `display:none` | ✅ unchanged |

Screenshots were captured inline via the preview tool during this session at
390 px (mobile after-state) and 768 px (tablet) — plus DOM-measured values above.
Re-capture any width with `npm run dev` + browser device toolbar.

---

## Performance Constraints

| Constraint | How it's met |
|-----------|--------------|
| No hydration measurements | All variants are static spans/divs toggled by CSS media queries |
| No CLS | Both mobile and desktop markup ship in the server HTML; nothing measures or repositions after load |
| No JS resize listeners | Zero JS added — `WCCountdownBanner`, `StandardHero`, `WCHero` remain server components |
| CSS-only responsive | Tailwind `md:` (768 px) and `lg:` (1024 px) default breakpoints only |

---

## Build Verification

```
npx tsc --noEmit → 0 errors
npm run build    → success
```

---

## Success Criteria

| Criterion | Result |
|-----------|--------|
| Mobile above-the-fold height reduced ≥30 % | ✅ −42 % (568 → 332 px to first content) |
| Match content visible significantly earlier | ✅ first content section now inside the first viewport on iPhone 14/15 and SE |
| Desktop layout unchanged | ✅ identical padding (32 px), paragraph, CTA layout and labels at ≥1024 px |
| No horizontal overflow | ✅ verified at every tested width |

Note: both hero variants were optimized — `StandardHero` (shown today) and
`WCHero` (takes over when the tournament goes live on June 11), so the mobile
density win persists through the tournament.
