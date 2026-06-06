import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // ── World Cup 2026 canonical redirects ───────────────────────────────
      // Flat-URL pages are the primary SEO targets. Legacy short-form URLs
      // 301 to the canonical flat URL so PageRank consolidates there.

      // /world-cup-2026/watch-live → canonical is /world-cup-2026-live-stream
      // (kept as SEPARATE pages — watch-live has today's matches widget;
      //  live-stream is the "free-first" editorial guide — NO redirect)

      // /world-cup/2026 typo variants
      {
        source: '/worldcup-2026',
        destination: '/world-cup-2026',
        permanent: true,
      },
      {
        source: '/world-cup/2026',
        destination: '/world-cup-2026',
        permanent: true,
      },
      {
        source: '/worldcup2026',
        destination: '/world-cup-2026',
        permanent: true,
      },
      {
        source: '/wc2026',
        destination: '/world-cup-2026',
        permanent: true,
      },
      {
        source: '/wc-2026',
        destination: '/world-cup-2026',
        permanent: true,
      },

      // ── WC Schedule alias redirects ─────────────────────────────────────
      // Old schedule was at /world-cup-2026/fixtures — keep that page live
      // (different content: API match cards vs timezone-first editorial).
      // Only redirect true duplicates, not related-but-distinct pages.

      // ── WC Results alias ─────────────────────────────────────────────────
      // /world-cup-2026/scores → editorial results page
      {
        source: '/world-cup-2026/scores',
        destination: '/world-cup-2026-results',
        permanent: true,
      },

      // ── Standings alias ─────────────────────────────────────────────────
      // /world-cup-2026/standings (doesn't exist as a page) → our SEO page
      {
        source: '/world-cup-2026/standings',
        destination: '/world-cup-2026-standings',
        permanent: true,
      },
      {
        source: '/world-cup-2026/table',
        destination: '/world-cup-2026-standings',
        permanent: true,
      },

      // ── Live stream aliases ──────────────────────────────────────────────
      {
        source: '/world-cup-2026/stream',
        destination: '/world-cup-2026-live-stream',
        permanent: true,
      },
      {
        source: '/world-cup-2026/watch',
        destination: '/world-cup-2026-live-stream',
        permanent: true,
      },

      // ── TV guide aliases ─────────────────────────────────────────────────
      {
        source: '/world-cup-2026/tv',
        destination: '/world-cup-2026-tv-guide',
        permanent: true,
      },
      {
        source: '/world-cup-2026/channel',
        destination: '/world-cup-2026-tv-guide',
        permanent: true,
      },

      // ── Groups aliases ───────────────────────────────────────────────────
      {
        source: '/world-cup-2026/group-stage',
        destination: '/world-cup-2026-groups',
        permanent: true,
      },

      // ── Bracket aliases ──────────────────────────────────────────────────
      {
        source: '/world-cup-2026/knockout',
        destination: '/world-cup-2026-bracket',
        permanent: true,
      },
      {
        source: '/world-cup-2026/knockout-stage',
        destination: '/world-cup-2026-bracket',
        permanent: true,
      },

      // ── Schedule aliases ─────────────────────────────────────────────────
      {
        source: '/wc2026-schedule',
        destination: '/world-cup-2026-schedule',
        permanent: true,
      },
      {
        source: '/wc-2026-schedule',
        destination: '/world-cup-2026-schedule',
        permanent: true,
      },
      {
        source: '/worldcup2026-schedule',
        destination: '/world-cup-2026-schedule',
        permanent: true,
      },

      // ── Results aliases ──────────────────────────────────────────────────
      {
        source: '/world-cup-2026/results',
        destination: '/world-cup-2026-results',
        permanent: true,
      },
      {
        source: '/wc2026-results',
        destination: '/world-cup-2026-results',
        permanent: true,
      },

      // ── Live stream aliases (additional) ─────────────────────────────────
      {
        source: '/world-cup-2026/live',
        destination: '/world-cup-2026-live-stream',
        permanent: true,
      },
      {
        source: '/world-cup-2026/live-stream',
        destination: '/world-cup-2026-live-stream',
        permanent: true,
      },
      {
        source: '/wc2026-live',
        destination: '/world-cup-2026-live-stream',
        permanent: true,
      },

      // ── Venues aliases ────────────────────────────────────────────────────
      {
        source: '/world-cup-2026/stadiums',
        destination: '/world-cup-2026/venues',
        permanent: true,
      },
      {
        source: '/wc2026-stadiums',
        destination: '/world-cup-2026/venues',
        permanent: true,
      },
      {
        source: '/wc2026-venues',
        destination: '/world-cup-2026/venues',
        permanent: true,
      },

      // ── Teams aliases ─────────────────────────────────────────────────────
      {
        source: '/world-cup-2026/teams',
        destination: '/world-cup-2026-groups',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      // /sitemap.xml → sitemap index handler
      //
      // Why a rewrite and not src/app/sitemap.xml/route.ts:
      //   sitemap.ts exports generateSitemaps(), which causes Next.js to
      //   internally occupy the /sitemap.xml/route filesystem path for the
      //   metadata system. A custom route.ts at that path produces a
      //   Turbopack "conflicting route and metadata" build error.
      //   The rewrite keeps /sitemap.xml as the public URL while the handler
      //   lives safely at /api/sitemap-index.
      {
        source:      '/sitemap.xml',
        destination: '/api/sitemap-index',
      },
    ];
  },
};

export default nextConfig;
