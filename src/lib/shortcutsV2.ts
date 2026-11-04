import type { AppRole } from '@/types/database'

/** «G» y una letra: ir a cada sección del menú (v2). Una sola tabla para el atajo y para la guía. */
export type GoKey = { key: string; label: string; href: string }

const COMMON_END: GoKey[] = [
  { key: 'f', label: 'Finanzas', href: '/finances' },
  { key: 'n', label: 'Notificaciones', href: '/notifications' },
  { key: 's', label: 'Configuración', href: '/settings' },
]

export function goKeysFor(role: AppRole | null | undefined): GoKey[] {
  if (role === 'nutritionist') {
    return [
      { key: 'i', label: 'Inicio', href: '/dashboard' },
      { key: 't', label: 'Turnos', href: '/nutrition/appointments' },
      { key: 'a', label: 'Pacientes', href: '/nutrition' },
      { key: 'p', label: 'Planes', href: '/nutrition/plans' },
      ...COMMON_END,
    ]
  }
  return [
    { key: 'i', label: 'Inicio', href: '/dashboard' },
    { key: 't', label: 'Turnos', href: '/appointments' },
    { key: 'a', label: 'Alumnos', href: '/students' },
    { key: 'r', label: 'Rutinas', href: '/routines' },
    { key: 'c', label: 'Consultas', href: '/feedback' },
    ...COMMON_END,
  ]
}

/** Pista «G X» por ruta, para mostrarla en el buscador. */
export const GO_HINT_BY_HREF: Record<string, string> = Object.fromEntries(
  [...goKeysFor('trainer'), ...goKeysFor('nutritionist')].map((g) => [g.href, `G ${g.key.toUpperCase()}`]),
)

export const SHORTCUTS_HELP_EVENT = 'hh:open-shortcuts-help'

export function openShortcutsHelp(): void {
  window.dispatchEvent(new CustomEvent(SHORTCUTS_HELP_EVENT))
}

/** No se disparan atajos mientras se escribe en un campo. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}
