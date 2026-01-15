/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{js,ts,jsx,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // SeKondBrain brand colors (from sekondbrain.ai)
        sk: {
          blue: '#0033FF',        // Primary Kanvas blue
          'blue-light': '#1a8af6',
          'blue-dark': '#0022CC',
          magenta: '#e24af2',
          purple: '#8b78f5',
          orange: '#f28b68',
          gold: '#e6b800',
        },
        // Kanvas color palette
        kanvas: {
          blue: '#0033FF',
          'blue-light': '#1a8af6',
          'blue-dark': '#0022CC',
        },
        // Light theme (SeKondBrain style - clean white)
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#fafafa',
          tertiary: '#f5f5f5',
        },
        // Dark theme variant
        'surface-dark': {
          DEFAULT: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a25',
        },
        accent: {
          magenta: '#e24af2',
          purple: '#8b78f5',
          blue: '#1a8af6',
          orange: '#f28b68',
          gold: '#e6b800',
        },
        border: {
          DEFAULT: '#e5e7eb',
          dark: '#2a2a3a',
        },
        text: {
          primary: '#000000',
          secondary: '#969696',
          'primary-dark': '#ffffff',
          'secondary-dark': '#a0a0a0',
        },
        // Status colors
        status: {
          idle: '#969696',
          working: '#1a8af6',
          waiting: '#e6b800',
          error: '#ef4444',
          stopped: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['TT Interphases Pro', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'kanvas': '0 4px 24px rgba(0, 51, 255, 0.08)',
        'kanvas-lg': '0 8px 40px rgba(0, 51, 255, 0.12)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
