/**
 * Paleta de marca — única fuente de verdad.
 *
 * Cambiá solo `BRAND_COLORS` (primary, secondary, tertiary); el resto se deriva
 * para CSS (`--brand-*`), Tailwind (`brand-primary`, etc.) y PDF/gráficos.
 */
export const BRAND_COLORS = {
  primary: '#ff4800',
  secondary: '#ff6a00',
  tertiary: '#ff2d95',
} as const

export type BrandColorKey = keyof typeof BRAND_COLORS

/** Hover del naranja (CTA / links con primary). */
export const BRAND_PRIMARY_HOVER = '#e04100'

/** Tinte suave para fondos warm (badges, highlights). */
export const BRAND_PRIMARY_WARM = '#ffe5db'

function normalizeHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, '')
  if (raw.length === 3) {
    return raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()
  }
  return raw.toLowerCase()
}

/** Convierte `#RRGGBB` → canales `R G B` para variables CSS `rgb(var(--x) / α)`. */
export function hexToRgbChannels(hex: string): string {
  const n = normalizeHex(hex)
  const r = Number.parseInt(n.slice(0, 2), 16)
  const g = Number.parseInt(n.slice(2, 4), 16)
  const b = Number.parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) {
    throw new Error(`hexToRgbChannels: color inválido "${hex}"`)
  }
  return `${r} ${g} ${b}`
}

export const brandRgbChannels = {
  primary: hexToRgbChannels(BRAND_COLORS.primary),
  secondary: hexToRgbChannels(BRAND_COLORS.secondary),
  tertiary: hexToRgbChannels(BRAND_COLORS.tertiary),
  hover: hexToRgbChannels(BRAND_PRIMARY_HOVER),
  warm: hexToRgbChannels(BRAND_PRIMARY_WARM),
} as const

/** Variables `:root` inyectadas por el plugin de Tailwind (ver `tailwind.config.ts`). */
export const brandCssVariables: Record<string, string> = {
  '--brand-primary': brandRgbChannels.primary,
  '--brand-hover': brandRgbChannels.hover,
  '--brand-secondary': brandRgbChannels.secondary,
  '--brand-tertiary': brandRgbChannels.tertiary,
  '--brand-warm': brandRgbChannels.warm,
}

export function brandHex(key: BrandColorKey): string {
  return BRAND_COLORS[key]
}

/** `rgb(R G B / 0.5)` para gráficos, toast, estilos inline. */
export function brandRgb(
  key: BrandColorKey | 'hover' | 'warm',
  alpha = 1,
): string {
  const channels = brandRgbChannels[key]
  return alpha === 1 ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`
}
