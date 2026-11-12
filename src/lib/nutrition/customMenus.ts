import { supabase } from '@/lib/supabase'
import {
  PATHOLOGY_LABELS,
  type DigestiveTolerance,
  type MenuSeason,
  type PathologyTag,
  type SeasonalMenuTemplate,
} from './seasonalMenuLibrary'
import { seasonalMenuMeals } from './seasonalMenuToPlan'

/** Los menús propios llevan este prefijo en el id para no chocar con los que trae la app. */
export const CUSTOM_MENU_PREFIX = 'custom:'
export const isCustomMenuId = (id: string) => id.startsWith(CUSTOM_MENU_PREFIX)
const rowId = (id: string) => id.slice(CUSTOM_MENU_PREFIX.length)

export const CUSTOM_MENUS_SQL_HINT =
  'Falta crear la tabla de menús propios: corré el SQL 20261114120000_nutrition_custom_menus.sql en Supabase.'

type Row = {
  id: string
  title: string
  season: string
  tolerance: string
  pathologies: string[] | null
  approximate_kcal: number | null
  summary: string | null
  body_md: string | null
}

const SEASONS: MenuSeason[] = ['invierno', 'verano', 'todo-el-anio']
const TOLERANCES: DigestiveTolerance[] = ['baja', 'media', 'alta']

function toTemplate(r: Row): SeasonalMenuTemplate {
  const pathologies = (r.pathologies ?? []).filter((p): p is PathologyTag => p in PATHOLOGY_LABELS)
  return {
    id: `${CUSTOM_MENU_PREFIX}${r.id}`,
    title: r.title,
    season: SEASONS.includes(r.season as MenuSeason) ? (r.season as MenuSeason) : 'todo-el-anio',
    tolerance: TOLERANCES.includes(r.tolerance as DigestiveTolerance) ? (r.tolerance as DigestiveTolerance) : 'alta',
    pathologies: pathologies.length ? pathologies : ['general'],
    approximateKcal: r.approximate_kcal ?? undefined,
    summary: r.summary ?? '',
    bodyMd: r.body_md ?? '',
  }
}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || err.code === 'PGRST205' || /nutrition_custom_menus/.test(err.message ?? '')
}

const COLUMNS = 'id, title, season, tolerance, pathologies, approximate_kcal, summary, body_md'

/** `available: false` cuando todavía no se corrió el SQL: la pantalla sigue andando con los menús de la app. */
export async function listCustomMenus(ownerId: string): Promise<{ menus: SeasonalMenuTemplate[]; available: boolean }> {
  const { data, error } = await supabase
    .from('nutrition_custom_menus')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
  if (error) return { menus: [], available: !isMissingTable(error) }
  return { menus: ((data ?? []) as Row[]).map(toTemplate), available: true }
}

export async function getCustomMenu(ownerId: string, id: string): Promise<SeasonalMenuTemplate | null> {
  const { data } = await supabase.from('nutrition_custom_menus').select(COLUMNS).eq('owner_id', ownerId).eq('id', rowId(id)).maybeSingle()
  return data ? toTemplate(data as Row) : null
}

/** Crea el menú, o lo actualiza si `menu.id` ya es de uno propio. */
export async function saveCustomMenu(
  ownerId: string,
  menu: Omit<SeasonalMenuTemplate, 'id'> & { id?: string },
): Promise<{ menu: SeasonalMenuTemplate | null; error: string | null }> {
  const payload = {
    owner_id: ownerId,
    title: menu.title.trim(),
    season: menu.season,
    tolerance: menu.tolerance,
    pathologies: menu.pathologies,
    approximate_kcal: menu.approximateKcal ?? null,
    summary: menu.summary.trim(),
    body_md: menu.bodyMd,
  }
  const query =
    menu.id && isCustomMenuId(menu.id)
      ? supabase.from('nutrition_custom_menus').update(payload).eq('id', rowId(menu.id)).eq('owner_id', ownerId)
      : supabase.from('nutrition_custom_menus').insert(payload)
  const { data, error } = await query.select(COLUMNS).single()
  if (error || !data) return { menu: null, error: isMissingTable(error) ? CUSTOM_MENUS_SQL_HINT : (error?.message ?? 'No se pudo guardar el menú') }
  return { menu: toTemplate(data as Row), error: null }
}

export async function deleteCustomMenu(ownerId: string, id: string): Promise<string | null> {
  const { error } = await supabase.from('nutrition_custom_menus').delete().eq('id', rowId(id)).eq('owner_id', ownerId)
  return error ? error.message : null
}

// ── Texto del menú ↔ formulario ──────────────────────────────────────────────

export type MenuMealDraft = { label: string; kcal: string; content: string }
export type MenuDraft = {
  id?: string
  title: string
  season: MenuSeason
  tolerance: DigestiveTolerance
  pathologies: PathologyTag[]
  summary: string
  meals: MenuMealDraft[]
  notes: string
}

export const DEFAULT_MEAL_LABELS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']

export function emptyMenuDraft(): MenuDraft {
  return {
    title: '',
    season: 'todo-el-anio',
    tolerance: 'alta',
    pathologies: ['general'],
    summary: '',
    meals: DEFAULT_MEAL_LABELS.map((label) => ({ label, kcal: '', content: '' })),
    notes: '',
  }
}

const NOTES_TITLE = 'Notas clínicas'

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)

/** Menú existente (propio o de la app) como borrador editable. `asCopy` lo deja listo para guardar como nuevo. */
export function draftFromMenu(menu: SeasonalMenuTemplate, asCopy = false): MenuDraft {
  const meals = seasonalMenuMeals(menu).map((m) => ({ label: m.label, kcal: String(m.kcal), content: lines(m.content.replace(/\*\*/g, '')).join('\n') }))
  const notes: string[] = []
  const re = /^###\s+([^\n(]+?)\s*\n([\s\S]*?)(?=\n###\s|$)/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(menu.bodyMd))) {
    const body = lines((match[2] ?? '').replace(/\*\*/g, '')).join('\n')
    if (!body) continue
    notes.push(match[1]!.trim() === NOTES_TITLE ? body : `${match[1]!.trim()}: ${body.replace(/\n/g, ' ')}`)
  }
  return {
    id: asCopy ? undefined : menu.id,
    title: asCopy ? `${menu.title} (copia)` : menu.title,
    season: menu.season,
    tolerance: menu.tolerance,
    pathologies: menu.pathologies,
    summary: menu.summary,
    meals: meals.length ? meals : emptyMenuDraft().meals,
    notes: notes.join('\n'),
  }
}

/** Valida el borrador y arma el menú en el formato de la biblioteca. Devuelve el motivo si no se puede guardar. */
export function menuFromDraft(draft: MenuDraft): { menu: (Omit<SeasonalMenuTemplate, 'id'> & { id?: string }) | null; error: string | null } {
  if (!draft.title.trim()) return { menu: null, error: 'Ponele un nombre al menú.' }
  const meals = draft.meals
    .map((m) => ({ label: m.label.trim(), kcal: Math.round(Number(m.kcal.replace(',', '.'))), items: lines(m.content) }))
    .filter((m) => m.label && m.items.length > 0)
  if (meals.length === 0) return { menu: null, error: 'Cargá al menos una comida con sus alimentos.' }
  const badKcal = meals.find((m) => !Number.isFinite(m.kcal) || m.kcal <= 0)
  if (badKcal) return { menu: null, error: `Faltan las calorías de «${badKcal.label}».` }

  const sections = meals.map((m) => `### ${m.label} (~${m.kcal} kcal)\n${m.items.map((i) => `- ${i}`).join('\n')}`)
  const notes = lines(draft.notes)
  if (notes.length) sections.push(`### ${NOTES_TITLE}\n${notes.map((n) => `- ${n}`).join('\n')}`)
  return {
    menu: {
      id: draft.id,
      title: draft.title.trim(),
      season: draft.season,
      tolerance: draft.tolerance,
      pathologies: draft.pathologies.length ? draft.pathologies : ['general'],
      approximateKcal: meals.reduce((sum, m) => sum + m.kcal, 0),
      summary: draft.summary.trim(),
      bodyMd: `${sections.join('\n\n')}\n`,
    },
    error: null,
  }
}
