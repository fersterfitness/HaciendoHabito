import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

export default defineConfig({
  plugins: [react(), svgr({ include: '**/*.svg?react' })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
})
