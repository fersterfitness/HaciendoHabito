/**
 * Feedback nov19 (tanda 4): en la entrada en calor el entrenador pega links y el alumno los ve como video
 * o foto. YouTube y Vimeo se incrustan, las fotos (.jpg, .png…) y videos (.mp4…) se muestran directo, y el
 * resto (Instagram, Drive…) queda como botón para abrirlo.
 */
export type WarmupMedia =
  | { kind: 'embed'; url: string; src: string }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'link'; url: string; label: string }

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()]+|\b(?:youtu\.be|(?:m\.)?youtube\.com|vimeo\.com)\/[^\s<>()]+/gi

function withProtocol(raw: string): string {
  const clean = raw.replace(/[.,;:!?»"']+$/, '')
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^(www\.|m\.)/, '')
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  if (host !== 'youtube.com') return null
  if (u.pathname === '/watch') return u.searchParams.get('v')
  const m = /^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname)
  return m ? m[1]! : null
}

export function mediaFromUrl(raw: string): WarmupMedia | null {
  const url = withProtocol(raw)
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const yt = youtubeId(u)
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: 'embed', url, src: `https://www.youtube-nocookie.com/embed/${yt}` }
  const vimeo = u.hostname.replace(/^www\./, '') === 'vimeo.com' ? /^\/(\d{5,})/.exec(u.pathname)?.[1] : undefined
  if (vimeo) return { kind: 'embed', url, src: `https://player.vimeo.com/video/${vimeo}` }
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(u.pathname)) return { kind: 'image', url }
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { kind: 'video', url }
  const host = u.hostname.replace(/^www\./, '')
  const label = /instagram\.com/.test(host) ? 'Ver en Instagram' : /tiktok\.com/.test(host) ? 'Ver en TikTok' : /drive\.google\.com/.test(host) ? 'Ver en Drive' : 'Ver video o foto'
  return { kind: 'link', url, label }
}

/** Separa el texto de un paso de sus links: «Movilidad de cadera https://youtu.be/x» → texto + video. */
export function splitWarmupLine(line: string): { text: string; media: WarmupMedia[] } {
  const media: WarmupMedia[] = []
  const text = line
    .replace(URL_RE, (m) => {
      const item = mediaFromUrl(m)
      if (!item) return m
      media.push(item)
      return ' '
    })
    .replace(/\s+/g, ' ')
    .replace(/\s*[:\-–(]\s*$/, '')
    .trim()
  return { text, media }
}
