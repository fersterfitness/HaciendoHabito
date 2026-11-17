import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPublicPreview, supabasePublic } from './supabasePublic'

describe('vista previa del entrenador en el link', () => {
  afterEach(() => {
    setPublicPreview(false)
    vi.restoreAllMocks()
  })

  it('no manda a la base lo que no es lectura', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    setPublicPreview(true)
    const res = await supabasePublic.rpc('save_shared_daily_checkin', { p_token: 'x' })
    expect(res.data).toEqual({ ok: true })
    expect(res.error).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
