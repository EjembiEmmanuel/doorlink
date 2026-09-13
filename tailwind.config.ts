import type { Config } from 'tailwindcss'

/**
 * DoorLink design tokens.
 *
 * Palette is drawn from the materials the platform is about: galvanised
 * steel, powder-coat charcoal, and the printed white of a spec sheet.
 * One accent (signal blue) carries every interactive affordance; amber is
 * reserved exclusively for provenance and "not connected" states so those
 * warnings can never be mistaken for decoration.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF9',
        rail: '#F1F0ED',
        line: '#DEDCD6',
        zinc: {
          DEFAULT: '#8C9096',
          deep: '#5A6068',
        },
        graphite: {
          DEFAULT: '#1B1D1F',
          soft: '#2C3033',
        },
        signal: {
          DEFAULT: '#1B4FA8',
          hover: '#163F87',
          tint: '#EDF2FB',
        },
        caution: {
          DEFAULT: '#94600C',
          tint: '#FBF3E3',
        },
        good: '#1F6B44',
        bad: '#A12B24',
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
        // Industrial, not consumer-app. Nothing is pill-shaped.
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(27, 29, 31, 0.06), 0 8px 24px -16px rgba(27, 29, 31, 0.28)',
        lift: '0 2px 4px rgba(27, 29, 31, 0.08), 0 16px 32px -20px rgba(27, 29, 31, 0.35)',
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
