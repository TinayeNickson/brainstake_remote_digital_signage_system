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
        // RAREVISION colors — purple and orange from logo
        brand: {
          DEFAULT: '#2d2a6e', // Purple (RARE)
          dark:    '#1e1c4d',
          deep:    '#0f0e26',
          soft:    '#e8e6f0',
          accent:  '#f5a623', // Orange (VISION)
          live:    '#22c55e',
        },
        // Accent now uses orange from logo
        accent: {
          DEFAULT: '#f5a623',
          soft: '#fef3e0',
          dark: '#d4860f',
        },
      },
    },
  },
  plugins: [],
};
export default config;
