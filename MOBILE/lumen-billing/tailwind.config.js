/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand — mirrors the Infora web admin (primary blue #2563EB)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Semantic surfaces — light + dark handled via `dark:` variants
        ink: {
          DEFAULT: '#0f172a', // slate-900
          soft: '#334155', // slate-700
          muted: '#64748b', // slate-500
          faint: '#94a3b8', // slate-400
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc', // slate-50
          sunken: '#f1f5f9', // slate-100
        },
        line: '#e2e8f0', // slate-200
        // Dark palette
        night: {
          DEFAULT: '#020617', // slate-950
          card: '#0f172a', // slate-900
          raised: '#1e293b', // slate-800
          line: '#1e293b',
        },
        // Accents used across the dashboard charts
        violet: '#6366f1',
        magenta: '#a855f7',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#0ea5e9',
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
