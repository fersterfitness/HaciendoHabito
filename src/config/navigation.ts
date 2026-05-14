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

/** Entrenador / admin: núcleo operativo. «Hábitos» está en la ficha del alumno + /habits desde ahí (no sidebar). */
export const NAV_TRAINING_CORE: NavItem[] = [
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Rutinas', href: '/routines', icon: Dumbbell },
  { label: 'Planes alimentación', href: '/meal-plans', icon: UtensilsCrossed },
  { label: 'Devoluciones', href: '/feedback', icon: MessageSquare },
  { label: 'Ejercicios', href: '/exercises', icon: BookOpen },
]

export const NAV_FINANCE: NavItem[] = [{ label: 'Finanzas', href: '/finances', icon: Wallet }]

/** Guía de alimentación que el entrenador ofrece al alumno. */
export const NAV_TRAINER_NUTRITION_GUIDE: NavItem[] = [
  { label: 'Armar plan de alimentación', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Guía de alimentos', href: '/nutrition/foods', icon: Apple },
]

export const NAV_NUTRITION: NavItem[] = [
  { label: 'Nutrición', href: '/nutrition', icon: Salad, exactMatch: true },
  { label: 'Evolución', href: '/nutrition/evolution', icon: LineChart },
  { label: 'Planes', href: '/nutrition/plans', icon: Library },
  { label: 'Armar plan de alimentación', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Biblioteca de alimentos', href: '/nutrition/foods', icon: Apple },
  { label: 'PDFs Nutrición', href: '/nutrition-pdfs', icon: FileText },
]

/** Utilidades de nutrición visibles al nutricionista (sin duplicar Pacientes). */
const NAV_NUTRITION_UTILITIES: NavItem[] = [
  { label: 'Menús estacionales', href: '/nutrition/menus', icon: Salad },
  { label: 'Evolución', href: '/nutrition/evolution', icon: LineChart },
  { label: 'Planes', href: '/nutrition/plans', icon: Library },
  { label: 'Armar plan de alimentación', href: '/nutrition/planning', icon: ClipboardList },
  { label: 'Biblioteca de alimentos', href: '/nutrition/foods', icon: Apple },
  { label: 'PDFs Nutrición', href: '/nutrition-pdfs', icon: FileText },
]

const NAV_NUTRITIONIST_PATIENTS: NavItem = {
  label: 'Pacientes',
  href: '/nutrition',
  icon: Users,
  exactMatch: true,
}

export function canSeeTraining(role: AppRole | undefined): boolean {
  return role === 'admin' || role === 'trainer'
}

export function canSeeNutrition(role: AppRole | undefined): boolean {
  return role === 'admin' || role === 'nutritionist'
}

/**
 * Bloques del sidebar desktop: misma semántica que el layout anterior,
 * con Pacientes visibles también en desktop para nutricionistas (aliné con mobile).
 */
export function getSidebarBlocks(role: AppRole | undefined): SidebarBlock[] {
  const blocks: SidebarBlock[] = []
  blocks.push({ kind: 'items', items: [NAV_HOME, NAV_APPOINTMENTS] })

  if (role === 'student') {
    blocks.push({
      kind: 'section',
      title: 'Tu entrenador',
      items: [NAV_STUDENT_MEAL_PLANS],
    })
    return blocks
  }

  const showTraining = canSeeTraining(role)
  const showNutrition = canSeeNutrition(role)

  if (showTraining || showNutrition) {
    blocks.push({ kind: 'divider' })
  }

  if (showTraining) {
    blocks.push({ kind: 'items', items: NAV_TRAINING_CORE })
    blocks.push({ kind: 'section', title: 'Finanzas', items: NAV_FINANCE })
  }

  if (role === 'trainer') {
    blocks.push({
      kind: 'section',
      title: 'Nutrición (guía alumno)',
      items: NAV_TRAINER_NUTRITION_GUIDE,
    })
  }

  if (role === 'nutritionist') {
    blocks.push({ kind: 'items', items: [NAV_NUTRITIONIST_PATIENTS] })
    blocks.push({ kind: 'section', title: 'Nutrición', items: NAV_NUTRITION_UTILITIES })
    blocks.push({ kind: 'section', title: 'Finanzas', items: NAV_FINANCE })
    return blocks
  }

  // Admin: ve todo (incluido el bloque histórico de Nutrición con su /nutrition propio)
  if (showNutrition) {
    blocks.push({ kind: 'section', title: 'Nutrición', items: NAV_NUTRITION })
  }

  return blocks
}

/** Dock inferior móvil por rol (orden y alcance existentes). */
export function getMobileNavItems(role: AppRole | undefined): NavItem[] {
  if (role === 'student') {
    return [NAV_HOME, NAV_STUDENT_MEAL_PLANS, NAV_APPOINTMENTS]
  }
  if (role === 'admin') {
    return [
      NAV_HOME,
      NAV_APPOINTMENTS,
      NAV_TRAINING_CORE[0],
      NAV_TRAINING_CORE[1],
      { label: 'Planes', href: '/meal-plans', icon: UtensilsCrossed },
      NAV_NUTRITION[0],
      NAV_NUTRITION[3],
      ...NAV_FINANCE,
    ]
  }
  if (role === 'nutritionist') {
    return [
      NAV_HOME,
      NAV_APPOINTMENTS,
      NAV_NUTRITIONIST_PATIENTS,
      NAV_NUTRITION_UTILITIES[0], // Menús estacionales
      NAV_NUTRITION_UTILITIES[3], // Armar plan de alimentación
      ...NAV_FINANCE,
    ]
  }
  // trainer (default) + admin-like sin duplicar rutas no usadas en mobile anterior
  return [
    NAV_HOME,
    NAV_APPOINTMENTS,
    NAV_TRAINING_CORE[0],
    NAV_TRAINING_CORE[1],
    { label: 'Planes', href: '/meal-plans', icon: UtensilsCrossed },
    NAV_TRAINER_NUTRITION_GUIDE[0],
    NAV_TRAINER_NUTRITION_GUIDE[1],
    ...NAV_FINANCE,
    NAV_TRAINING_CORE[3], // Devoluciones
  ]
}
