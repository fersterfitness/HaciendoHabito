import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: {} }))

import { caseVideoEmbed, cleanVideoUrl, videoSiteLabel } from '@/data/marketplaceCases'
import { withPreferredPayDay } from '@/lib/intake/payDay'

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

describe('caseVideoEmbed (feedback nov19, tanda 6)', () => {
  it('reproduce en la página los videos de YouTube, Instagram, TikTok, Vimeo y Drive', () => {
    expect(caseVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', vertical: false })
    expect(caseVideoEmbed('https://youtube.com/shorts/abc123XYZ')).toEqual({ src: 'https://www.youtube-nocookie.com/embed/abc123XYZ', vertical: true })
    expect(caseVideoEmbed('https://www.instagram.com/reel/C1a2B3c4D5/?igsh=x')).toEqual({ src: 'https://www.instagram.com/reel/C1a2B3c4D5/embed', vertical: true })
    expect(caseVideoEmbed('https://www.tiktok.com/@tomi/video/7301234567890123456')).toEqual({ src: 'https://www.tiktok.com/embed/v2/7301234567890123456', vertical: true })
    expect(caseVideoEmbed('https://vimeo.com/123456789')).toMatchObject({ src: 'https://player.vimeo.com/video/123456789' })
    expect(caseVideoEmbed('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toMatchObject({ src: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview' })
  })
  it('lo que no se puede incrustar queda para el botón', () => {
    expect(caseVideoEmbed('https://vm.tiktok.com/ZMabc/')).toBeNull()
    expect(caseVideoEmbed('https://www.instagram.com/tomi/')).toBeNull()
    expect(caseVideoEmbed('no es un link')).toBeNull()
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
