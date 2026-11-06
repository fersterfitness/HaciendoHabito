import { IS_V2 } from '@/lib/uiVersion'

/** Color principal de una serie: naranja de marca en la v1, durazno pastel de la paleta en la v2. */
export const CHART_ACCENT = IS_V2 ? '#F4AC6E' : '#ff5a0a'
/** Segundo color de serie (phlox en la v2). */
export const CHART_ACCENT_2 = IS_V2 ? '#8082A6' : '#ff6a00'
