import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import { anamnesisPublicConfig } from './vite.anamnesisPublicConfig'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [react(), svgr({ include: '**/*.svg?react' }), anamnesisPublicConfig(env)],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React propio en su chunk: si no, Rollup lo mete en el de animaciones y todo depende de él.
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'react-vendor'
          // Utilidades chicas que usan la app y las librerías: si quedan dentro de recharts, la entrada lo arrastra entero.
          if (/node_modules\/(clsx|tailwind-merge)\//.test(id)) return 'utils-vendor'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/@react-pdf')) return 'react-pdf'
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs'
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'motion'
          }
          if (id.includes('node_modules/@supabase')) return 'supabase'
        },
      },
    },
  },
  resolve: {
    /** Evita dos copias de React cuando entra @react-pdf/renderer (hooks inválidos / ThemeProvider). */
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}})
