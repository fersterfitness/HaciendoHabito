import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',
          warm: 'rgb(var(--brand-warm) / <alpha-value>)',
        },
        surface: {
          base: 'rgb(var(--surface-base) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          input: 'rgb(var(--surface-input) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
          inputBorder: 'rgb(var(--surface-input-border) / <alpha-value>)',
          sidebar: 'rgb(var(--surface-sidebar) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          warm: 'rgb(var(--ink-warm) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        status: {
          active: 'rgb(var(--status-active) / <alpha-value>)',
          expiring: 'rgb(var(--status-expiring) / <alpha-value>)',
          expired: 'rgb(var(--status-expired) / <alpha-value>)',
          paused: 'rgb(var(--status-paused) / <alpha-value>)',
          generated: 'rgb(var(--status-generated) / <alpha-value>)',
          sent: 'rgb(var(--status-sent) / <alpha-value>)',
          error: 'rgb(var(--status-error) / <alpha-value>)',
          pending: 'rgb(var(--status-pending) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card-lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        'sidebar': '1px 0 0 0 rgb(var(--surface-border))',
        'panel': 'var(--shadow-panel)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        /** Panel anclado a la derecha: entra desde la derecha + fade */
        'panel-slide-in': 'panelSlideIn 0.85s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        /** Panel flotante tipo Gray (desliz + fade leve). */
        'panel-soft': 'panelSoft 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'backdrop-soft': 'backdropSoft 0.78s ease-out forwards',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        panelSlideIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        panelSoft: {
          '0%': { opacity: '0', transform: 'translate3d(14px, 0, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        backdropSoft: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
