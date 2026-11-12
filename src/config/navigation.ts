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
  UserPlus,
  Dumbbell,
  HandCoins,
  CalendarPlus,
  Send,
  Receipt,
  Store,
} from 'lucide-react'
import type { AppRole } from '@/types/database'

export type NavItem = {
  label: string
  /** Versión corta para la barra inferior del celu, donde entran ~10 caracteres. */
  shortLabel?: string
  href: string
  icon: LucideIcon
  /** When true, active only on exact path match (default: prefix match). */
  exactMatch?: boolean
  /** Other prefixes that keep this item highlighted (p. ej. Asesorías → /routines). */
  alsoMatch?: string[]
  /** v2: para qué sirve la sección, en pocas palabras (debajo del nombre en el menú y en la barra superior). */
  hint?: string
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
  shortLabel: 'Mi plan',
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
  { label: 'Consulta semanal', shortLabel: 'Consultas', href: '/feedback', icon: MessageSquare },
  { label: 'Base de datos', href: '/exercises', icon: BookOpen },
  { label: 'Saliendo de contexto', shortLabel: 'Contexto', href: '/contexto', icon: Sparkles },
]

export const NAV_MEAL_PLANS: NavItem = {
  label: 'Planes de alimentación',
  shortLabel: 'Alimentación',
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

/**
 * Menú de la v2: pocas entradas a la vista (lo del día a día) y el resto dentro de «Más».
 * Sin títulos de grupo: cada rol ve una sola lista corta.
 */
export type NavV2 = { main: NavItem[]; more: NavItem[] }

/** En la v2 las rutinas se ven desde la ficha del alumno (pestaña Rutina): no hay sección aparte. */
const V2_STUDENTS: NavItem = { label: 'Alumnos', href: '/students', icon: Users, hint: 'Fichas, rutinas y pagos', alsoMatch: ['/routines'] }
const V2_FEEDBACK: NavItem = {
  label: 'Consultas semanales',
  shortLabel: 'Consultas',
  href: '/feedback',
  icon: MessageSquare,
  hint: 'Lo que te cuentan tus alumnos',
}
const V2_EXERCISES: NavItem = {
  label: 'Ejercicios y circuitos',
  shortLabel: 'Ejercicios',
  href: '/exercises',
  icon: BookOpen,
  hint: 'Catálogo y métodos',
}
const V2_CONTEXT: NavItem = { label: 'Saliendo de contexto', shortLabel: 'Contexto', href: '/contexto', icon: Sparkles, hint: 'Pregunta de los miércoles' }

const V2_MARKETPLACE: NavItem = { label: 'Marketplace', shortLabel: 'Marketplace', href: '/mi-pagina', icon: Store, hint: 'Tu página, planes y solicitudes' }

export function getNavV2(role: AppRole | undefined): NavV2 {
  if (role === 'student' || canSeePsychologistWorkspace(role)) {
    // «Marketplace» solo en la v2: el menú de la v1 queda como estaba.
    return { main: flattenSections(getNavSections(role)), more: role === 'student' ? [] : [V2_MARKETPLACE] }
  }
  const [finance] = NAV_FINANCE
  if (role === 'nutritionist') {
    // Nombres que dicen qué hay adentro y una línea de para qué sirve: alguien que entra por primera vez
    // no tiene por qué saber que «Planes» son plantillas o que «Biblioteca» son los alimentos.
    return {
      main: [
        { ...NAV_HOME, hint: 'Lo que tenés para hoy' },
        { ...NAV_APPOINTMENTS, hint: 'Agenda y recordatorios' },
        { ...NAV_NUTRITION_PATIENT_ANTHRO[0]!, hint: 'Fichas, consultas y planes' },
        {
          ...NAV_NUTRITION_FOOD[0]!,
          label: 'Plantillas de planes',
          shortLabel: 'Plantillas',
          hint: 'Planes base para reusar',
          alsoMatch: ['/nutrition/planning'],
        },
        { label: 'Menús', href: '/nutrition/menus', icon: Salad, hint: 'Ideas listas para usar con un paciente' },
        { ...finance!, hint: 'Cobros y gastos' },
      ],
      more: [
        { ...NAV_NUTRITION_PATIENT_ANTHRO[1]!, hint: 'Controles e informes PDF' },
        { ...NAV_NUTRITION_FOOD[1]!, label: 'Alimentos', shortLabel: 'Alimentos', hint: 'Tu base de alimentos' },
        V2_MARKETPLACE,
      ],
    }
  }
  if (role === 'admin') {
    return {
      main: [NAV_HOME, NAV_APPOINTMENTS, V2_STUDENTS, V2_FEEDBACK, finance!],
      more: [
        { label: 'Nutrición', href: '/nutrition', icon: Salad, exactMatch: true },
        NAV_NUTRITION_PATIENT_ANTHRO[1]!,
        ...NAV_NUTRITION_FOOD,
        NAV_MEAL_PLANS_TRAINER,
        V2_EXERCISES,
        V2_CONTEXT,
        V2_MARKETPLACE,
      ],
    }
  }
  // Entrenador (y cualquier rol sin definir).
  return {
    main: [
      { ...NAV_HOME, hint: 'Lo que tenés para hoy' },
      { ...NAV_APPOINTMENTS, hint: 'Agenda y recordatorios' },
      V2_STUDENTS,
      V2_FEEDBACK,
      { ...finance!, hint: 'Cobros y gastos' },
    ],
    more: [V2_EXERCISES, { ...NAV_MEAL_PLANS_TRAINER, hint: 'Planes para tus alumnos' }, V2_CONTEXT, V2_MARKETPLACE],
  }
}

/** Barra inferior del celu en la v2: los mismos nombres que el menú; el resto va en «Más». */
export function getMobileNavV2(role: AppRole | undefined): { primary: NavItem[]; drawer: NavSection[] } {
  const { main, more } = getNavV2(role)
  const primary =
    role === 'trainer' || role === 'admin'
      ? [NAV_HOME, V2_STUDENTS, V2_FEEDBACK]
      : role === 'nutritionist'
        ? main.slice(0, 4)
        : getMobileNavPrimaryItems(role)
  const keys = new Set(primary.map(navItemKey))
  const rest = [...main, ...more].filter((i) => !keys.has(navItemKey(i)))
  return { primary, drawer: rest.length ? [{ title: 'Más', items: rest }] : [] }
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
  // Entrenador: Turnos y Finanzas quedan a un toque en «Más»; lo nuevo se crea desde el «+» central.
  return [NAV_HOME, NAV_TRAINING_CORE[0]!, NAV_TRAINING_CORE[1]!]
}

export type QuickAction = {
  label: string
  /** Una línea corta debajo del nombre. */
  hint: string
  href: string
  icon: LucideIcon
}

/** Accesos del «+» de la barra inferior (celu). Vacío = el rol no tiene botón «+». */
export function getMobileQuickActions(role: AppRole | undefined): QuickAction[] {
  if (role !== 'trainer' && role !== 'admin') return []
  return [
    { label: 'Nuevo alumno', hint: 'Alta con sus datos', href: '/students?create=1', icon: UserPlus },
    { label: 'Nueva rutina', hint: 'Armar y asignar', href: '/routines?create=1', icon: Dumbbell },
    { label: 'Registrar cobro', hint: 'Pago de un alumno', href: '/finances/income/new', icon: HandCoins },
    { label: 'Registrar gasto', hint: 'Fijo o variable', href: '/finances/expenses/new', icon: Receipt },
    { label: 'Enviar check-in', hint: 'Consulta semanal', href: '/feedback?tab=checkins', icon: Send },
    { label: 'Turnos', hint: 'Agenda del día', href: '/appointments', icon: CalendarPlus },
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
