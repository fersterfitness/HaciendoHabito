import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import type { Student } from '@/types/database'
import type { MenuSeason, PathologyTag, SeasonalMenuTemplate } from '@/lib/nutrition/seasonalMenuLibrary'
import { isCustomMenuId } from '@/lib/nutrition/customMenus'

/**
 * «Menús» (v2): qué menú le encaja a cada paciente con turno próximo (por las patologías que cargó
 * en su ficha) y cuáles son los que más usa el profesional en este navegador.
 */

/* ───────────── Patologías a partir del texto libre de la ficha ───────────── */

const PATHOLOGY_PATTERNS: [PathologyTag, RegExp][] = [
  ['hashimoto', /hashimoto/],
  ['celiaquia', /celia[cq]/],
  ['colon-irritable', /colon irritable|intestino irritable|\bsii\b/],
  ['sibo', /\bsibo\b/],
  ['gastritis', /gastritis/],
  ['reflujo', /reflujo|\berge\b/],
  ['diabetes', /diabet|resistencia a la insulina|insulinorresistencia|insulino ?resistencia/],
  ['hipertension', /hipertens|presion alta|\bhta\b/],
]

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** «no tengo diabetes», «sin reflujo», «niega hipertensión»: no cuentan. */
const NEGATED = /\b(no|sin|niega|ni|descarta\w*)\b[^.,;\n]{0,18}$/

/** Patologías reconocidas en un texto escrito a mano (la ficha no tiene casilleros). */
export function pathologyTagsFromText(text: string | null | undefined): PathologyTag[] {
  const t = plain(text ?? '')
  if (!t.trim()) return []
  const found: PathologyTag[] = []
  for (const [tag, re] of PATHOLOGY_PATTERNS) {
    const global = new RegExp(re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = global.exec(t))) {
      if (!NEGATED.test(t.slice(0, m.index))) {
        found.push(tag)
        break
      }
    }
  }
  return found
}

export function studentPathologyTags(student: Pick<Student, 'intake_nutrition' | 'intake_ferster'>): PathologyTag[] {
  const text = [student.intake_nutrition?.pathologies, student.intake_ferster?.pathology, student.intake_ferster?.pathology_detail]
    .filter(Boolean)
    .join('. ')
  return pathologyTagsFromText(text)
}

/* ───────────── El menú que mejor encaja ───────────── */

/** El menú con más patologías en común; a igualdad, el de la época y después uno propio. */
export function bestMenuFor(
  menus: SeasonalMenuTemplate[],
  tags: PathologyTag[],
  season: MenuSeason,
): { menu: SeasonalMenuTemplate; matched: PathologyTag[] } | null {
  let best: { menu: SeasonalMenuTemplate; matched: PathologyTag[]; score: number } | null = null
  for (const menu of menus) {
    const matched = tags.filter((t) => menu.pathologies.includes(t))
    if (matched.length === 0) continue
    const score = matched.length * 10 + (menu.season === season ? 3 : menu.season === 'todo-el-anio' ? 2 : 0) + (isCustomMenuId(menu.id) ? 1 : 0)
    if (!best || score > best.score) best = { menu, matched, score }
  }
  return best ? { menu: best.menu, matched: best.matched } : null
}

export type UpcomingPatient = { studentId: string; fullName: string; startsAt: string; tags: PathologyTag[] }

/** Pacientes con turno en los próximos 14 días que tienen alguna patología reconocible en la ficha. */
export async function loadUpcomingPatientsWithPathology(ownerId: string): Promise<UpcomingPatient[]> {
  const now = new Date()
  const until = new Date(now.getTime() + 14 * 86_400_000)
  const [appts, students] = await Promise.all([
    supabase
      .from('appointments')
      .select('student_id, starts_at')
      .eq('owner_id', ownerId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', now.toISOString())
      .lt('starts_at', until.toISOString())
      .order('starts_at')
      .limit(200),
    fetchAccessibleStudents(),
  ])
  const byId = new Map(students.data.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const out: UpcomingPatient[] = []
  for (const a of (appts.data ?? []) as { student_id: string | null; starts_at: string }[]) {
    if (!a.student_id || seen.has(a.student_id)) continue
    seen.add(a.student_id)
    const s = byId.get(a.student_id)
    if (!s) continue
    const tags = studentPathologyTags(s)
    if (tags.length) out.push({ studentId: s.id, fullName: s.full_name, startsAt: a.starts_at, tags })
  }
  return out
}

/* ───────────── Los que más usa (en este navegador) ───────────── */

const USAGE_KEY = 'hh-menu-usage'
type Usage = Record<string, { n: number; last: number }>

export function readMenuUsage(): Usage {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as unknown
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Usage) : {}
  } catch {
    return {}
  }
}

/** Se llama al elegir el paciente para un menú. */
export function recordMenuUse(menuId: string) {
  try {
    const usage = readMenuUsage()
    usage[menuId] = { n: (usage[menuId]?.n ?? 0) + 1, last: Date.now() }
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage))
  } catch {
    /* sin storage: no se cuenta */
  }
}

/** Los más usados primero (y, a igualdad, el usado más recientemente). */
export function mostUsedMenus(menus: SeasonalMenuTemplate[], usage: Usage, limit = 3): { menu: SeasonalMenuTemplate; n: number }[] {
  return menus
    .map((menu) => ({ menu, n: usage[menu.id]?.n ?? 0, last: usage[menu.id]?.last ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.last - a.last)
    .slice(0, limit)
    .map(({ menu, n }) => ({ menu, n }))
}
