import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'sans-serif',
        ],
      },
      boxShadow: {
        'wc-card':   '0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24)',
        'wc-raised': '0 4px 6px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.24)',
        'wc-live':   '0 0 0 1px rgba(239,68,68,0.4), 0 0 12px rgba(239,68,68,0.15)',
        'wc-gold':   '0 0 0 1px rgba(245,158,11,0.4), 0 0 16px rgba(245,158,11,0.12)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        digitFlip: {
          '0%':   { transform: 'rotateX(90deg)', opacity: '0' },
          '100%': { transform: 'rotateX(0deg)',  opacity: '1' },
        },
        cardReveal: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drawConnector: {
          '100%': { strokeDashoffset: '0' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
      },
      animation: {
        'wc-shimmer':   'shimmer 1.5s linear infinite',
        'wc-flip':      'digitFlip 200ms ease-out',
        'wc-reveal':    'cardReveal 300ms ease-out forwards',
        'wc-connector': 'drawConnector 300ms ease-out forwards',
        'wc-slide-up':  'slideUp 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
