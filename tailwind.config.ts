import type { Config } from 'tailwindcss'

/**
 * Doorlink design tokens.
 *
 * The interface uses one restrained industrial palette. Orange is reserved
 * for the current action or a single status highlight in a visual group.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#0B0B0C',
        rail: '#141416',
        line: '#2A2A2E',
        zinc: {
          DEFAULT: '#A1A1A6',
          deep: '#A1A1A6',
        },
        graphite: {
          DEFAULT: '#FFFFFF',
          soft: '#A1A1A6',
        },
        signal: {
          DEFAULT: '#FF6A00',
          hover: '#FF8124',
          tint: 'rgba(255,106,0,0.12)',
        },
        caution: {
          DEFAULT: '#FF6A00',
          tint: 'rgba(255,106,0,0.12)',
        },
        good: '#A1A1A6',
        bad: '#FF6A00',
      },
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        // Reserved for identifiers: model codes, part numbers, references.
        code: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        display: ['2.75rem', { lineHeight: '1.08', letterSpacing: '-0.022em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.026em' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
        lg: '10px',
      },
      boxShadow: {
        panel: '0 12px 28px rgba(0, 0, 0, 0.24)',
        lift: '0 16px 32px rgba(0, 0, 0, 0.3)',
      },
      maxWidth: {
        prose: '68ch',
        shell: '78rem',
      },
    },
  },
  plugins: [],
}

export default config
