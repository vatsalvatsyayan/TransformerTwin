import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // TransformerTwin dark theme palette
        bg: {
          primary: '#0f1117',
          secondary: '#1a1d27',
          panel: '#1e2133',
          card: '#252840',
        },
        border: {
          subtle: '#2d3148',
          default: '#3d4168',
        },
        status: {
          normal: '#22c55e',    // green-500
          caution: '#eab308',   // yellow-500
          warning: '#f97316',   // orange-500
          critical: '#ef4444',  // red-500
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
