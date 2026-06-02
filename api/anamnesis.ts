/**
 * Proxy same-origin → Edge Function `submit-public-anamnesis`
 * (formulario estático /forms/anamnesis-nutricional.html).
 */
export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
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

  if (!base || !anon) {
    console.error('[api/anamnesis] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return Response.json(
      {
        error: 'configuracion_incompleta',
        message:
          'El envío no está configurado en este sitio. Tu nutricionista debe contactar soporte técnico.',
      },
      { status: 500 },
    )
  }

  try {
    const target = `${base.replace(/\/$/, '')}/functions/v1/submit-public-anamnesis`
    const body = await request.text()
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body,
    })

    const text = await upstream.text().catch(() => '')
    try {
      JSON.parse(text)
    } catch {
      console.error('[api/anamnesis] upstream non-JSON', upstream.status, text.slice(0, 300))
      return Response.json(
        {
          error: 'respuesta_invalida',
          message:
            upstream.status === 404
              ? 'El servicio de envío no está disponible. Tu nutricionista debe verificar que el formulario esté publicado en la app.'
              : 'El servidor respondió de forma inesperada. Probá de nuevo en unos minutos o pedile a tu nutricionista otro link.',
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      )
    }

    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[api/anamnesis]', e)
    return Response.json(
      {
        error: 'error_conexion',
        message:
          'No pudimos conectar con el servidor. Verificá tu internet o probá desde el link que te envió tu nutricionista.',
      },
      { status: 500 },
    )
  }
}
