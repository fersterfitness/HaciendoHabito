import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

function configScript(env: Record<string, string>): string {
  const payload = {
    supabaseUrl: (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
  }
  return `window.HH_ANAMNESIS_PUBLIC=${JSON.stringify(payload)};`
}

/** Expone URL/anon de Supabase al HTML estático de anamnesis (dev + build). */
export function anamnesisPublicConfig(env: Record<string, string>): Plugin {
  const script = configScript(env)

  return {
    name: 'anamnesis-public-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/forms/anamnesis-public-config.js') return next()
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.end(script)
      })
    },
    closeBundle() {
      const outFile = path.resolve(__dirname, 'dist/forms/anamnesis-public-config.js')
      fs.mkdirSync(path.dirname(outFile), { recursive: true })
      fs.writeFileSync(outFile, script, 'utf8')
    },
  }
}
