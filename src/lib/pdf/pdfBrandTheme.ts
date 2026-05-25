/**
 * Paleta compartida PDF / marca Haciéndolo Hábito.
 *
 * Los tres colores de marca (`primary`, `secondary`, `tertiary`) replican los
 * tokens `--brand-*` que vive en `app/src/index.css`, así los PDF respiran la
 * misma identidad que la UI.
 *
 * Convención de tonos derivados:
 * - `*Wash`  → fondo translúcido muy suave (≈3-5% saturación). Apto para grandes superficies (página, grids).
 * - `*Light` → tono claro pero presente (≈8-12%). Para pills, headers de sección o badges grandes.
 * - `*Mid`   → tono medio (≈25-35%). Para acentos visibles, líneas, bordes destacados.
 * - color base → pleno, para texto, iconos o líneas finas decorativas.
 */
export const PDF_BRAND = {
  /** Naranja de marca (`--brand-primary` en CSS). */
  primary: '#FF8C00',
  /** Alias histórico = `primaryWash`. Conservado por compatibilidad con documentos previos. */
  primaryLight: '#FFF8F0',
  primaryWash: '#FFF8F0',
  primaryMid: '#FFE0B2',
  /**
   * Violeta/lavanda (`--brand-secondary` = `#A979FF`).
   * Fuente: `app/src/index.css` línea 23.
   */
  secondary: '#A979FF',
  secondaryWash: '#F7F3FF',
  secondaryLight: '#E2D4FF',
  /**
   * Magenta/rosa eléctrico (`--brand-tertiary` = `#FF4FEA`).
   * Fuente: `app/src/index.css` línea 24.
   */
  tertiary: '#FF4FEA',
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
