import { BRAND_COLORS } from '@/theme/brandColors'

/**
 * Paleta compartida PDF / marca Haciéndolo Hábito.
 *
 * `primary`, `secondary` y `tertiary` salen de `src/theme/brandColors.ts` (misma
 * fuente que `--brand-*` en la UI).
 *
 * Convención de tonos derivados:
 * - `*Wash`  → fondo translúcido muy suave (≈3-5% saturación). Apto para grandes superficies (página, grids).
 * - `*Light` → tono claro pero presente (≈8-12%). Para pills, headers de sección o badges grandes.
 * - `*Mid`   → tono medio (≈25-35%). Para acentos visibles, líneas, bordes destacados.
 * - color base → pleno, para texto, iconos o líneas finas decorativas.
 */
export const PDF_BRAND = {
  primary: BRAND_COLORS.primary,
  /** Alias histórico = `primaryWash`. Conservado por compatibilidad con documentos previos. */
  primaryLight: '#FFF8F0',
  primaryWash: '#FFF8F0',
  primaryMid: '#FFE0B2',
  secondary: BRAND_COLORS.secondary,
  secondaryWash: '#F7F3FF',
  secondaryLight: '#E2D4FF',
  tertiary: BRAND_COLORS.tertiary,
  tertiaryWash: '#FFF1FB',
  tertiaryLight: '#FFCFF4',
  dark: '#0F172A',
  heading: '#1E293B',
  body: '#334155',
  muted: '#94A3B8',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
} as const
