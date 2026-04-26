import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#FF8C00',
          hover: '#FFB347',
          warm: '#F3D8C7',
        },
        surface: {
          base: '#121212',
          card: '#1E1E1E',
          elevated: '#252525',
          input: '#1E1E1E',
          border: '#2A2A2A',
          inputBorder: '#3A2A1A',
        },
        ink: {
          primary: '#F5F5F5',
          secondary: '#A3A3A3',
          warm: '#F3D8C7',
          muted: '#6B6B6B',
        },
        status: {
          active: '#FF8C00',
          expiring: '#F59E0B',
          expired: '#EF4444',
          paused: '#6B6B6B',
          generated: '#22C55E',
          sent: '#3B82F6',
          error: '#F87171',
          pending: '#FFB347',
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
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
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
      },
    },
  },
  plugins: [],
}

export default config
