/** Fuente UI global — cambiar aquí y en `index.html` (Google Fonts). */
export const APP_FONT_FAMILY_NAME = 'Nunito Sans'

export const appFontFamilyStack = [
  APP_FONT_FAMILY_NAME,
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'sans-serif',
] as const

export const appFontFamilyCss = appFontFamilyStack
  .map((f) => (f.includes(' ') ? `"${f}"` : f))
  .join(', ')
