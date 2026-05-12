import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50:  '#f6f4ef',
          100: '#e8e4f0',
          200: '#d1cfe8',
          900: '#1a1a2e',
          950: '#0d0d0b',
        },
        // Premium landing page tokens
        'brand-navy':   '#0B0B2B',
        'brand-paper':  '#E8E4F0',
        'brand-darker': '#070718',
        'gold-light':   '#E8C96A',
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#E8C96A',
        },
        purple: {
          DEFAULT: '#6C3BAA',
          light:   '#8B6BC5',
        },
        // App brand tokens (dashboard / auth)
        brand: {
          DEFAULT: '#6C3BAA',
          dark:    '#5a2f8e',
          deep:    '#0B0B2B',
          soft:    '#e8e4f0',
          accent:  '#C9A84C',
          live:    '#C9A84C',
          navy:    '#0B0B2B',
          paper:   '#E8E4F0',
          darker:  '#070718',
        },
        accent: {
          DEFAULT: '#C9A84C',
          light:   '#E8C96A',
          soft:    '#f5efd4',
          dark:    '#a8872e',
        },
      },
      backgroundSize: {
        'grid-size': '40px 40px',
      },
      backgroundImage: {
        'grid-lines':
          'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        scanline: {
          '0%':   { top: '0%' },
          '100%': { top: '100%' },
        },
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'slide-down': {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float:        'float 4s ease-in-out infinite',
        scanline:     'scanline 3s linear infinite',
        ticker:       'ticker 28s linear infinite',
        'slide-down': 'slide-down 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
