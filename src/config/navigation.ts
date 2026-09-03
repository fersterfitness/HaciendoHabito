import type { LucideIcon } from 'lucide-react'
import {
  Home,
  Users,
  FileText,
  MessageSquare,
  BookOpen,
  Wallet,
  Salad,
  CalendarClock,
  Apple,
  ClipboardList,
  UtensilsCrossed,
  Ruler,
  Sparkles,
} from 'lucide-react'
import type { AppRole } from '@/types/database'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** When true, active only on exact path match (default: prefix match). */
  exactMatch?: boolean
  /** Other prefixes that keep this item highlighted (p. ej. Asesorías → /routines). */
  alsoMatch?: string[]
}

export type SidebarBlock =
  | { kind: 'divider' }
  | { kind: 'items'; items: NavItem[] }
  | { kind: 'section'; title: string; items: NavItem[] }

export type NavSection = {
  title: string
  items: NavItem[]
}

export const NAV_HOME: NavItem = { label: 'Inicio', href: '/dashboard', icon: Home }

export const NAV_APPOINTMENTS: NavItem = {
  label: 'Turnos',
  href: '/appointments',
  icon: CalendarClock,
}

const NAV_STUDENT_MEAL_PLANS: NavItem = {
  label: 'Mi plan de alimentación',
  href: '/my/meal-plans',
  icon: ClipboardList,
}

/** Entrenamiento (sin planes de alimentación; esos van en «Alimentación»). */
export const NAV_TRAINING_CORE: NavItem[] = [
  {
    label: 'Asesorías',
    href: '/students',
    icon: Users,
    alsoMatch: ['/routines'],
  },
  { label: 'Consulta semanal', href: '/feedback', icon: MessageSquare },
  { label: 'Base de datos', href: '/exercises', icon: BookOpen },
  { label: 'Saliendo de contexto', href: '/contexto', icon: Sparkles },
]

export const NAV_MEAL_PLANS: NavItem = {
  label: 'Planes de alimentación',
  href: '/meal-plans',
  icon: UtensilsCrossed,
}

export const NAV_FINANCE: NavItem[] = [{ label: 'Finanzas', href: '/finances', icon: Wallet }]

/** Pestañas internas de «Planes de alimentación» (entrenador). */
export const NAV_TRAINER_MEAL_PLAN_TABS = [
  { href: '/meal-plans', label: 'Planes' },
  { href: '/nutrition/planning', label: 'Armar plan' },
  { href: '/nutrition/foods', label: 'Guía de alimentos' },
] as const

/** Planes de alimentación del entrenador (icono distinto a «Armar plan»). */
export const NAV_MEAL_PLANS_TRAINER: NavItem = {
  ...NAV_MEAL_PLANS,
  icon: UtensilsCrossed,
  alsoMatch: ['/nutrition/planning', '/nutrition/foods'],
}

/**
 * Pacientes. La evolución antropométrica y el diagnóstico comparativo ya no
 * viven en el menú: se acceden contextualmente desde la ficha del paciente
 * (botón «Comparar 2 PDFs» / evolución dentro del paciente). Las rutas siguen
 * activas en App.tsx, solo se quitó el acceso suelto del menú.
 */
export const NAV_NUTRITION_PATIENT_ANTHRO: NavItem[] = [
  { label: 'Pacientes', href: '/nutrition', icon: Users, exactMatch: true },
  { label: 'Antropometría', href: '/nutrition/anthropometry', icon: Ruler },
]

/**
 * Planes y biblioteca (iconos Lucide distintos en el rail).
 * «Biblioteca» unifica alimentos + menús estacionales: ambas vistas viven dentro
 * de la misma página con pestañas, así el menú no repite dos accesos separados.
 */
export const NAV_NUTRITION_FOOD: NavItem[] = [
  { label: 'Planes', href: '/nutrition/plans', icon: FileText },
  { label: 'Biblioteca', href: '/nutrition/foods', icon: Apple },
]

/** Lista plana legacy (admin / referencias externas). */
export const NAV_NUTRITION: NavItem[] = [
  { label: 'Nutrición', href: '/nutrition', icon: Salad, exactMatch: true },
  ...NAV_NUTRITION_PATIENT_ANTHRO.slice(1),
  ...NAV_NUTRITION_FOOD,
]

export function canSeeTraining(role: AppRole | undefined): boolean {
  return role === 'admin' || role === 'trainer'
}

export function canSeeNutrition(role: AppRole | undefined): boolean {
  return role === 'admin' || role === 'nutritionist'
}

export function canSeePsychologistWorkspace(role: AppRole | undefined): boolean {
  return role === 'psychologist'
}

export function navItemKey(item: NavItem): string {
  return `${item.href}::${item.label}`
}

function matchNavHref(pathname: string, href: string, exactMatch?: boolean): boolean {
  if (exactMatch) return pathname === href
  const homeHref = href === '/dashboard'
  const atHome = pathname === '/' || pathname === '/dashboard'
  if (homeHref && atHome) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Activo si coincide el href o alguno de `alsoMatch`. */
export function isNavPathActive(pathname: string, item: NavItem): boolean {
  if (matchNavHref(pathname, item.href, item.exactMatch)) return true
  return (item.alsoMatch ?? []).some((href) => matchNavHref(pathname, href, false))
}

function flattenSections(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items)
}

/**
 * Secciones del menú por rol: Gestión (inicio/turnos/finanzas), Paciente/antropometría, Alimentación, Entrenamiento.
 */
export function getNavSections(role: AppRole | undefined): NavSection[] {
  if (role === 'student') {
    return [
      { title: 'Gestión', items: [NAV_HOME, NAV_APPOINTMENTS] },
      { title: 'Alimentación', items: [NAV_STUDENT_MEAL_PLANS] },
    ]
  }

  if (canSeePsychologistWorkspace(role)) {
    return [
      { title: 'Gestión', items: [NAV_HOME, NAV_APPOINTMENTS] },
      { title: 'Pacientes', items: [{ label: 'Alumnos', href: '/students', icon: Users }] },
    ]
  }

  const sections: NavSection[] = [
    { title: 'Gestión', items: [NAV_HOME, NAV_APPOINTMENTS] },
  ]

  const showTraining = canSeeTraining(role)
  const showNutrition = canSeeNutrition(role)

  if (showTraining) {
    sections.push({ title: 'Entrenamiento', items: [...NAV_TRAINING_CORE] })
  }

  if (role === 'trainer') {
    sections.push({
      title: 'Alimentación',
      items: [NAV_MEAL_PLANS_TRAINER],
    })
  } else if (showNutrition) {
    const patientItems =
      role === 'admin'
        ? [
            { label: 'Nutrición', href: '/nutrition', icon: Salad, exactMatch: true } as NavItem,
            ...NAV_NUTRITION_PATIENT_ANTHRO.slice(1),
          ]
        : [...NAV_NUTRITION_PATIENT_ANTHRO]

    sections.push({ title: 'Paciente y antropometría', items: patientItems })

    const foodItems: NavItem[] = [...NAV_NUTRITION_FOOD]
    if (showTraining) {
      foodItems.unshift(NAV_MEAL_PLANS_TRAINER)
    }
    sections.push({ title: 'Alimentación', items: foodItems })
  } else if (showTraining) {
    sections.push({ title: 'Alimentación', items: [NAV_MEAL_PLANS] })
  }

  // Los estudiantes ya retornaron arriba; el resto de roles ve Finanzas.
  sections.push({ title: 'Finanzas', items: [...NAV_FINANCE] })

  return sections
}

/** Bloques del sidebar desktop (icon rail + separadores por sección). */
export function getSidebarBlocks(role: AppRole | undefined): SidebarBlock[] {
  const sections = getNavSections(role)
  const blocks: SidebarBlock[] = []

  sections.forEach((section, index) => {
    if (index === 0) {
      blocks.push({ kind: 'items', items: section.items })
      return
    }
    blocks.push({ kind: 'section', title: section.title, items: section.items })
  })

  return blocks
}

const MAX_MOBILE_PRIMARY = 4

/** Ítems fijos en la barra inferior móvil. */
export function getMobileNavPrimaryItems(role: AppRole | undefined): NavItem[] {
  if (role === 'student') {
    return [NAV_HOME, NAV_STUDENT_MEAL_PLANS, NAV_APPOINTMENTS].slice(0, MAX_MOBILE_PRIMARY)
  }
  if (role === 'nutritionist') {
    return [
      NAV_HOME,
      NAV_APPOINTMENTS,
      NAV_NUTRITION_PATIENT_ANTHRO[0]!,
      NAV_NUTRITION_FOOD[1]!,
    ]
  }
  if (role === 'psychologist') {
    return [NAV_HOME, NAV_APPOINTMENTS, { label: 'Alumnos', href: '/students', icon: Users }]
  }
  if (role === 'admin') {
    return [NAV_HOME, NAV_APPOINTMENTS, NAV_TRAINING_CORE[0]!, NAV_NUTRITION_PATIENT_ANTHRO[0]!]
  }
  return [
    NAV_HOME,
    NAV_APPOINTMENTS,
    NAV_TRAINING_CORE[0]!,
    NAV_TRAINING_CORE[1]!,
  ]
}

/** Lista plana; orden = secciones de `getNavSections`. */
export function getMobileNavItems(role: AppRole | undefined): NavItem[] {
  return flattenSections(getNavSections(role))
}

/** Secciones del drawer «Más» (excluye ítems ya visibles en la barra inferior). */
export function getMobileNavDrawerSections(role: AppRole | undefined): NavSection[] {
  const primaryKeys = new Set(getMobileNavPrimaryItems(role).map(navItemKey))
  return getNavSections(role)
    .map((section) => ({
      title: section.title,
      items: section.items.filter((item) => !primaryKeys.has(navItemKey(item))),
    }))
    .filter((section) => section.items.length > 0)
}
