import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: {} }))

import { cleanVideoUrl, videoSiteLabel } from '@/data/marketplaceCases'
import { withPreferredPayDay } from '@/components/public/IntakePaymentPreferenceFields'

describe('cleanVideoUrl', () => {
  it('acepta links de los sitios de video conocidos y los deja en https', () => {
    expect(cleanVideoUrl('https://www.instagram.com/reel/abc/')).toBe('https://www.instagram.com/reel/abc/')
    expect(cleanVideoUrl('youtu.be/xyz')).toBe('https://youtu.be/xyz')
    expect(cleanVideoUrl('http://m.youtube.com/watch?v=1')).toBe('https://m.youtube.com/watch?v=1')
  })
  it('rechaza otros sitios, textos sueltos y esquemas raros', () => {
    expect(cleanVideoUrl('https://ejemplo.com/video.mp4')).toBeNull()
    expect(cleanVideoUrl('https://youtube.com.ejemplo.com/x')).toBeNull()
    expect(cleanVideoUrl('javascript:alert(1)')).toBeNull()
    expect(cleanVideoUrl('')).toBeNull()
  })
  it('nombra el sitio para el botón', () => {
    expect(videoSiteLabel('https://youtu.be/xyz')).toBe('YouTube')
    expect(videoSiteLabel('https://www.tiktok.com/@a/video/1')).toBe('TikTok')
  })
})

describe('withPreferredPayDay', () => {
  it('pone el día como primera línea del dato de pago y conserva lo escrito', () => {
    expect(withPreferredPayDay('', '10')).toBe('Prefiere pagar el día 10 de cada mes.')
    expect(withPreferredPayDay('alias juan.mp', '10')).toBe('Prefiere pagar el día 10 de cada mes.\nalias juan.mp')
  })
  it('cambiar o quitar el día no duplica la línea', () => {
    const first = withPreferredPayDay('alias juan.mp', '10')
    expect(withPreferredPayDay(first, '5')).toBe('Prefiere pagar el día 5 de cada mes.\nalias juan.mp')
    expect(withPreferredPayDay(first, '')).toBe('alias juan.mp')
  })
})
