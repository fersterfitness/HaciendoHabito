import type { LucideIcon } from 'lucide-react'
import {
  Home,
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  BookOpen,
  Wallet,
  Salad,
  LineChart,
  CalendarClock,
  Library,
  Apple,
  ClipboardList,
  UtensilsCrossed,
  Share2,
  ClipboardCheck,
  Activity,
} from 'lucide-react'
import type { AppRole } from '@/types/database'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** When true, active only on exact path match (default: prefix match). */
  exactMatch?: boolean
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
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Rutinas', href: '/routines', icon: Dumbbell },
  { label: 'Devoluciones', href: '/feedback', icon: MessageSquare },
  { label: 'Recursos (WA)', href: '/resources', icon: Share2 },
  { label: 'Check-ins', href: '/check-ins', icon: ClipboardCheck },
  { label: 'Ejercicios', href: '/exercises', icon: BookOpen },
]

export const NAV_MEAL_PLANS: NavItem = {
  label: 'Planes alimentación',
  href: '/meal-plans',
  icon: UtensilsCrossed,
}

export const NAV_FINANCE: NavItem[] = [{ label: 'Finanzas', href: '/finances', icon: Wallet }]

/** Guía de alimentación que el entrenador ofrece al alumno. */
export const NAV_TRAINER_NUTRITION_GUIDE: NavItem[] = [
  { label: 'Armar plan de alimentación', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Guía de alimentos', href: '/nutrition/foods', icon: Apple },
]

/** Pacientes, evolución antropométrica y diagnóstico comparativo. */
export const NAV_NUTRITION_PATIENT_ANTHRO: NavItem[] = [
  { label: 'Pacientes', href: '/nutrition', icon: Users, exactMatch: true },
  { label: 'Evolución', href: '/nutrition/evolution', icon: LineChart },
  { label: 'Diagnóstico comparativo', href: '/nutrition-pdfs', icon: Activity },
]

/** Planes, menús y biblioteca de alimentos. */
export const NAV_NUTRITION_FOOD: NavItem[] = [
  { label: 'Menús estacionales', href: '/nutrition/menus', icon: Salad },
  { label: 'Planes', href: '/nutrition/plans', icon: Library },
  { label: 'Armar plan de alimentación', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Biblioteca de alimentos', href: '/nutrition/foods', icon: Apple },
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

export function navItemKey(item: NavItem): string {
  return `${item.href}::${item.label}`
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
      items: [NAV_MEAL_PLANS, ...NAV_TRAINER_NUTRITION_GUIDE],
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
      foodItems.unshift(NAV_MEAL_PLANS)
    }
    sections.push({ title: 'Alimentación', items: foodItems })
  } else if (showTraining) {
    sections.push({ title: 'Alimentación', items: [NAV_MEAL_PLANS] })
  }

  if (role !== 'student') {
    sections.push({ title: 'Finanzas', items: [...NAV_FINANCE] })
  }

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
    return [NAV_HOME, NAV_APPOINTMENTS, NAV_NUTRITION_PATIENT_ANTHRO[0]!, NAV_NUTRITION_FOOD[0]!]
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
