# Performance Impact Assessment — WC 2026 UI Sprint

> Goal: Lighthouse Performance ≥85, CLS = 0, LCP ≤2.5s, TTFB unchanged.
> Presentation-only changes cannot affect TTFB — only CSS/JS bundle and hydration can regress.

---

## Current Baseline (from code audit)

| Page | ISR revalidate | Rendering |
|------|---------------|-----------|
| Hub | 30s | RSC, no Suspense |
| Schedule | 300s | RSC + Suspense (SkeletonGrid) |
| Fixtures | 900s | RSC |
| Results | 300s | RSC |
| Standings | 3600s | RSC + Suspense |
| Groups | 3600s | RSC, no Suspense |
| Bracket | 900s | RSC, no Suspense |
| Round pages (R32, R16, QF, SF, 3P, Final) | 900s | RSC via WCRoundPage |
| Match page | KV: 5min (PROJECTED), 6h (upcoming), 7d (finished) | RSC + Suspense (BelowTheFold) |

TTFB: all pages are server-rendered with ISR. No change from UI sprint.

---

## Risk Areas

### Bundle Size

**Low risk** — this sprint adds:
- Tailwind class additions (no JS): `+0 KB JS`
- New keyframe animations in `globals.css`: `~0.5 KB CSS`
- New `tailwind.config.ts` tokens: compiled into existing CSS bundle — `+1–2 KB CSS`
- `next/image` replacement for `<img>`: already in the project, no new import

**Watch**: adding new `"use client"` components. Each client island adds to JS bundle.

Client components allowed in this sprint (already exist or planned):
- `WCCountdown` — already client
- `WCPageNav` — already client (usePathname)
- `CompetitionSelector` — already client
- `LocalTime` — already client
- New: WCBracket mobile accordion interaction — target: `~2 KB`

**Rule**: maximum 2 new `"use client"` files in this sprint.

### CLS (Cumulative Layout Shift)

**Medium risk** — current issues:
1. `CompetitionSelector Suspense fallback={null}` — tabs appear after hydration, causes shift
2. Ad slots without reserved height — CLS on slow connections
3. Skeleton has no date-header placeholder — headers pop in after data

**Fixes**:
```tsx
// 1. Replace fallback={null}
<Suspense fallback={<CompetitionSelectorSkeleton />}>

// 2. Ad slot height reservation
<AdSlot slotId="..." className="min-h-[90px]" />  // banner
<AdSlot slotId="..." className="min-h-[250px]" /> // rectangle

// 3. Skeleton includes date headers
function ScheduleSkeleton() {
  return (
    <div className="space-y-8">
      {[0,1].map(i => (
        <div key={i}>
          <div className="h-4 w-24 bg-gray-800 rounded animate-pulse mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0,1,2].map(j => <MatchCardSkeleton key={j} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### LCP (Largest Contentful Paint)

**Low-medium risk** — current LCP candidates:
- Hub: hero section text (H1) — text-based LCP, fast
- Match page: team crest images — could delay LCP if not preloaded

**Fixes**:
- Replace `<img>` with `<Image>` from `next/image` — automatic WebP, LQIP, `loading="lazy"` for below-fold
- Hero crest images (match page, hub featured): `priority={true}` prop on `next/image`
- Team crests in MatchCard: `loading="lazy"` (below fold is acceptable)

```tsx
// Match page hero crests — add priority
<Image src={match.homeTeam.crest} width={72} height={72} priority alt="" />

// MatchCard crests — lazy is correct
<Image src={crest} width={20} height={20} loading="lazy" alt="" />
```

### TTFB

**Zero risk** — presentation-only changes cannot affect TTFB. All data fetching is unchanged.

### Hydration

**Low risk** — we are adding 0 new provider components and 0 new data hooks.

New client islands planned:
1. WCBracket mobile accordion: `~2 KB` — uses `useState` for open/close state only
2. WCGroupTable tab (Hub): `~1 KB` — uses `useState` for selected group tab

Both are interaction-only client islands with no data fetching.

**Rule**: `"use client"` boundary must be placed as deep in the tree as possible. The page itself (RSC) never becomes a client component.

---

## Animation Performance

All animations use compositor-thread-only properties:

| Allowed | Forbidden |
|---------|----------|
| `transform` | `width`, `height` |
| `opacity` | `top`, `left`, `right`, `bottom` |
| `filter` (GPU) | `margin`, `padding` |
| SVG `stroke-dashoffset` | `font-size` |

Specific patterns:
- Hover card lift: `transform: translateY(-2px)` — compositor
- Bracket connectors: SVG stroke animation — compositor
- Skeleton shimmer: `background-position` animation — compositor (GPU)
- Digit flip: `transform: rotateX` — compositor

**Will-change**: use sparingly.
- Only bracket connectors: `will-change: stroke-dashoffset`
- Only live pulse dot: `will-change: transform, opacity` (already in animate-ping)

### Animation Budget

Max simultaneous animations per viewport:
- 1 live pulse per card (maximum 3–4 cards visible at once = 3–4 animations — OK)
- 1 skeleton shimmer region
- 1 bracket draw on initial load (staggered, not simultaneous)

**Never**: `animate-spin`, `animate-bounce` — these feel toy-like on a premium sports product.

---

## Image Optimization

Current: all crests use `<img>` tag with no optimization.
Target: `<Image>` from `next/image`.

```tsx
// Before
<img src={crest} alt="" width={20} height={20} className="object-contain" />

// After
import Image from 'next/image';
<Image src={crest} alt="" width={20} height={20} className="object-contain" />
```

Benefits:
- Automatic WebP/AVIF serving (25–35% smaller)
- Automatic lazy loading for below-fold
- CLS prevention via explicit dimensions
- LQIP (low-quality image placeholder)

**Caveats**:
- External crest URLs (from football-data API) require domain whitelist in `next.config.ts`
- Verify `images.remotePatterns` includes crest CDN domains

---

## Per-Page Impact Assessment

| Page | Risk | Key concern | Mitigation |
|------|------|-------------|-----------|
| Hub | Medium | Hero section CLS (new gradient div) | Reserve height for hero section |
| Schedule | Low-Medium | CompetitionSelector CLS | Replace `fallback={null}` with skeleton |
| Groups | Low | Suspense addition | New skeleton must match table layout |
| Bracket | Medium | New mobile accordion adds JS | Keep accordion state-only, no data |
| Match | Low | Already has Suspense boundaries | Verify `priority` on hero crests |
| Round pages | Low | No structural changes | Only styling changes |

---

## Lighthouse Score Targets

| Metric | Current (estimated) | Target | Acceptable minimum |
|--------|--------------------|---------|--------------------|
| Performance | ~80–85 | 88+ | 85 |
| Accessibility | ~65–70 | 90+ | 88 |
| Best Practices | ~85 | 92+ | 90 |
| SEO | ~90 | 95+ | 92 |

Accessibility score will jump significantly from the aria/focus fixes alone.

---

## Testing Protocol

After each phase:

```bash
# 1. TypeScript (zero errors)
npx tsc --noEmit

# 2. Build succeeds
npm run build

# 3. Bundle size check (before/after)
npx next-bundle-analyzer  # or: check .next/analyze/

# 4. Lighthouse (Hub page)
npx lighthouse https://localhost:3000/world-cup-2026 --output json

# 5. CLS verification
# Open Chrome DevTools → Performance → Record 3s → check Layout Shift rows
```

CLS target: **< 0.05** on all pages.
LCP target: **< 2.5s** on Hub and Match pages (3G simulated).
