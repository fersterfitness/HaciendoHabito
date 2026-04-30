/**
 * Proxy same-origin → Supabase Edge Function para evitar CORS en el navegador.
 * El cliente en producción llama a `/api/intake` (mismo origen que Vercel).
 *
 * Variables en Vercel (mismas que el build): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 * opcional VITE_PUBLIC_INTAKE_SECRET.
 */
export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '*',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const base = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const secret = process.env.VITE_PUBLIC_INTAKE_SECRET

  if (!base || !anon) {
    console.error('[api/intake] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return Response.json({ error: 'Falta configuración del servidor' }, { status: 500 })
  }

  const target = `${base.replace(/\/$/, '')}/functions/v1/public-intake-form`
  const body = await request.arrayBuffer()
  const contentType = request.headers.get('content-type') || 'application/json'

  const upstream = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      ...(secret ? { 'x-intake-secret': secret } : {}),
    },
    body,
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
