import { BRAND_LOGO_COMPACT_PATH, BRAND_LOGO_PATH } from '@/lib/brandLogo'

/** URL absoluta del logo con transparencia (para fondos oscuros). */
export function defaultBrandLogoSrc(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${BRAND_LOGO_PATH}`
}

/** URL absoluta del logo con fondo naranja integrado (para fondos claros). */
export function colorBrandLogoSrc(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${BRAND_LOGO_COMPACT_PATH}`
}

export type SocialIconUrls = {
  whatsapp: string
  instagram: string
  gmail: string
}

/** URLs absolutas de los iconos oficiales de WhatsApp, Instagram y Gmail (PNG en `public/`). */
export function socialIconUrls(): SocialIconUrls | undefined {
  if (typeof window === 'undefined') return undefined
  const origin = window.location.origin
  return {
    whatsapp: `${origin}/WhatsApp_icon.png`,
    instagram: `${origin}/ig_icon.png`,
    gmail: `${origin}/gmail_icon.png`,
  }
}
