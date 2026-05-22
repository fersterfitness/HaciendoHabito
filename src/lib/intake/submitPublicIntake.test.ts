import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  friendlyPublicIntakeParseError,
  parsePublicIntakeResponseBody,
  submitPublicIntake,
} from '@/lib/intake/submitPublicIntake'

describe('submitPublicIntake helpers', () => {
  it('parsePublicIntakeResponseBody parsea JSON', () => {
    const res = new Response('{}', { status: 200 })
    expect(parsePublicIntakeResponseBody(res, '{"ok":true}')).toEqual({ ok: true })
  })

  it('parsePublicIntakeResponseBody detecta JSON inválido', () => {
    const res = new Response('x', { status: 502 })
    const body = parsePublicIntakeResponseBody(res, 'not json')
    expect(body).toEqual({ parseError: true, status: 502 })
  })

  it('friendlyPublicIntakeParseError mensajes por status', () => {
    expect(friendlyPublicIntakeParseError(413)).toContain('demasiado')
    expect(friendlyPublicIntakeParseError(504)).toContain('tardó')
  })
})

describe('submitPublicIntake', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('VITE_PUBLIC_INTAKE_SECRET', '')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('falla sin variables de entorno', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const result = await submitPublicIntake({ form_type: 'ferster' })
    expect(result).toEqual({ ok: false, error: 'Falta configuración del sitio' })
  })

  it('envía JSON y devuelve ok', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const result = await submitPublicIntake({ form_type: 'nutrition', phone: '+54 11 12345678' })
    expect(result).toEqual({ ok: true, warnings: undefined })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/public-intake-form',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('propaga error del servidor', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
    )
    const result = await submitPublicIntake({ form_type: 'ferster' })
    expect(result).toMatchObject({ ok: false, error: 'No autorizado', status: 401 })
  })
})
