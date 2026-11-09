import { IS_V2 } from '@/lib/uiVersion'

/** Pantalla táctil como entrada principal (celular, tablet). */
export const IS_COARSE_POINTER =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

/**
 * v2 · Foco automático en un buscador al abrir un panel: en celular abre el teclado y tapa la lista,
 * así que ahí no. Los campos que se editan después de tocarlos sí mantienen su autoFocus.
 */
export const AUTOFOCUS_SEARCH = !IS_V2 || !IS_COARSE_POINTER
