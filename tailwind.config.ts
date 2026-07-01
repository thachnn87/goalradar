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
        'exp-rank-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '60%':  { transform: 'translateY(-2px)' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'exp-rank-down': {
          '0%':   { transform: 'translateY(-12px)', opacity: '0' },
          '60%':  { transform: 'translateY(2px)' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'exp-story-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'exp-momentum-in': {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'exp-highlight-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(245,158,11,0.45)' },
          '50%':      { boxShadow: '0 0 0 3px rgba(245,158,11,0.75), 0 0 20px rgba(245,158,11,0.2)' },
        },
        'exp-path-draw': {
          '0%':   { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: '0%' },
        },
      },
      animation: {
        'wc-shimmer':   'shimmer 1.5s linear infinite',
        'wc-flip':      'digitFlip 200ms ease-out',
        'wc-reveal':    'cardReveal 300ms ease-out forwards',
        'wc-connector': 'drawConnector 300ms ease-out forwards',
        'wc-slide-up':  'slideUp 200ms ease-out',
        'exp-rank-up':         'exp-rank-up 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        'exp-rank-down':       'exp-rank-down 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        'exp-story-in':        'exp-story-in 300ms ease-out forwards',
        'exp-momentum-in':     'exp-momentum-in 250ms ease-out forwards',
        'exp-highlight-pulse': 'exp-highlight-pulse 1.5s ease-in-out infinite',
        'exp-path-draw':       'exp-path-draw 400ms ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
