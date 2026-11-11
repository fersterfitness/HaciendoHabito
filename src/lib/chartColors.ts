import { IS_V2 } from '@/lib/uiVersion'

/** Color principal de una serie: naranja de marca en la v1; en la v2, el lila de la paleta (variable --chart-1). */
export const CHART_ACCENT = IS_V2 ? 'rgb(var(--chart-1))' : '#ff5a0a'
/** Segundo color de serie (gris neutro en la v2, --chart-2). */
export const CHART_ACCENT_2 = IS_V2 ? 'rgb(var(--chart-2))' : '#ff6a00'
