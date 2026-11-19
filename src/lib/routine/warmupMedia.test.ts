import { describe, expect, it } from 'vitest'
import { mediaFromUrl, splitWarmupLine } from './warmupMedia'

describe('entrada en calor con fotos y videos (feedback nov19, tanda 4)', () => {
  it('incrusta YouTube (watch, youtu.be y shorts) y Vimeo', () => {
    expect(mediaFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toEqual({
      kind: 'embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
    expect(mediaFromUrl('youtu.be/dQw4w9WgXcQ')).toMatchObject({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(mediaFromUrl('https://youtube.com/shorts/abc123XYZ')).toMatchObject({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abc123XYZ' })
    expect(mediaFromUrl('https://vimeo.com/123456789')).toMatchObject({ kind: 'embed', src: 'https://player.vimeo.com/video/123456789' })
  })

  it('muestra fotos y videos directos y deja el resto como link', () => {
    expect(mediaFromUrl('https://x.com/foto.JPG')).toEqual({ kind: 'image', url: 'https://x.com/foto.JPG' })
    expect(mediaFromUrl('https://x.com/clip.mp4?dl=1')).toEqual({ kind: 'video', url: 'https://x.com/clip.mp4?dl=1' })
    expect(mediaFromUrl('https://www.instagram.com/reel/abc/')).toMatchObject({ kind: 'link', label: 'Ver en Instagram' })
  })

  it('separa el texto del paso de sus links', () => {
    expect(splitWarmupLine('1) Movilidad de cadera: https://youtu.be/dQw4w9WgXcQ')).toEqual({
      text: '1) Movilidad de cadera',
      media: [{ kind: 'embed', url: 'https://youtu.be/dQw4w9WgXcQ', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }],
    })
    expect(splitWarmupLine('5 min de bici')).toEqual({ text: '5 min de bici', media: [] })
    expect(splitWarmupLine('Ver www.instagram.com/p/xyz.').media[0]).toMatchObject({ kind: 'link', url: 'https://www.instagram.com/p/xyz' })
  })
})
