/**
 * Config pública para el formulario HTML (misma origen que la app).
 */
export const config = { runtime: 'edge' }

export default function handler(): Response {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

  if (!supabaseUrl || !anonKey) {
    return Response.json({ error: 'configuracion_incompleta' }, { status: 500 })
  }

  return Response.json({
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    anonKey,
  })
}
