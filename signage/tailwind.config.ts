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
          50: '#f6f4ef',
          100: '#ebe7dd',
          200: '#d2cdc0',
          900: '#1a1a17',
          950: '#0d0d0b',
        },
        // Brainstake green — kept as a tailwind token so classes like
        // `bg-brand`, `text-brand-deep`, etc. work inline.
        brand: {
          DEFAULT: '#0f7b4a',
          dark:    '#0a5a36',
          deep:    '#0a2e1f',
          soft:    '#d9ecde',
          live:    '#22c55e',
        },
        // Kept for backwards compatibility with earlier `text-accent`
        // classes; points at the same green.
        accent: {
          DEFAULT: '#0f7b4a',
          soft: '#d9ecde',
        },
      },
    },
  },
  plugins: [],
};
export default config;
