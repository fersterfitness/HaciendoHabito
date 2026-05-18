import { BRAND_LOGO_PATH } from '@/lib/brandLogo'

/** URL absoluta del logo con transparencia para react-pdf. */
export function defaultBrandLogoSrc(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${BRAND_LOGO_PATH}`
}
