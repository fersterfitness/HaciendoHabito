/** Animación de paneles modales: slide en desktop, fade en móvil (evita pantalla negra). */
export function modalPanelMotionVariants(reduceMotion: boolean | null) {
  const wide =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

  if (reduceMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
      leave: { opacity: 0, transition: { duration: 0.15 } },
    } as const
  }

  if (wide) {
    return {
      hidden: { x: '100%' },
      visible: { x: 0, transition: { duration: 1.45, ease: [0.16, 1, 0.3, 1] } },
      leave: { x: '100%', transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] } },
    } as const
  }

  return {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    leave: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } },
  } as const
}
