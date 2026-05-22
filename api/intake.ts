/**
 * Proxy opcional same-origin → Edge Function (ej. si CORS/JWT fallaran en el navegador).
 *
 * El formulario público **ya no usa** esta ruta por defecto: en Vercel el proxy sumaba latencia y **504**
 * (timeout en Hobby) con multipart. El cliente llama directo a Supabase.
 *
 * Vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 * Secreto (servidor): INTAKE_SECRET o legacy VITE_PUBLIC_INTAKE_SECRET.
 */
export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
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
  const secret = process.env.INTAKE_SECRET ?? process.env.VITE_PUBLIC_INTAKE_SECRET

  if (!base || !anon) {
    console.error('[api/intake] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return Response.json({ error: 'Falta configuración del servidor' }, { status: 500 })
  }

  try {
    const target = `${base.replace(/\/$/, '')}/functions/v1/public-intake-form`
    const body = Buffer.from(await request.arrayBuffer())
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

    const text = await upstream.text().catch(() => '')
    try {
      JSON.parse(text)
    } catch {
      console.error('[api/intake] upstream non-JSON', upstream.status, text.slice(0, 500))
      return Response.json(
        {
          error:
            upstream.status === 413
              ? 'Archivo demasiado grande. Probá fotos más chicas.'
              : 'El servidor devolvió una respuesta inesperada. Probá fotos más livianas o sin adjuntos.',
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      )
    }

    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[api/intake]', e)
    return Response.json({ error: 'Error al enviar el formulario. Probá más tarde.' }, { status: 500 })
  }
}
