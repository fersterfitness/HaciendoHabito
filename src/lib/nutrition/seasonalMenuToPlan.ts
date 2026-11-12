import type { ReusablePlan } from './planReuse'
import type { SeasonalMenuTemplate } from './seasonalMenuLibrary'
import { columnCount, type MealRowModel } from './weeklyPlanGrid'

export type SeasonalMenuMeal = { label: string; kcal: number; content: string }

/** Comidas del menú con sus calorías: salen de los títulos «### Almuerzo (~550 kcal)» del texto. */
export function seasonalMenuMeals(menu: SeasonalMenuTemplate): SeasonalMenuMeal[] {
  const out: SeasonalMenuMeal[] = []
  const re = /^###\s+(.+?)\s+\(~?\s*(\d+)\s*kcal\)\s*\n([\s\S]*?)(?=\n###\s|$)/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(menu.bodyMd))) out.push({ label: match[1]!, kcal: Number(match[2]), content: match[3] ?? '' })
  return out
}

/** Secciones sin calorías (objetivo, notas clínicas): van a las notas del plan. */
function menuNotes(menu: SeasonalMenuTemplate): string | null {
  const out: string[] = []
  const re = /^###\s+([^\n(]+?)\s*\n([\s\S]*?)(?=\n###\s|$)/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(menu.bodyMd))) {
    const body = plain(match[2] ?? '')
    if (body) out.push(`${match[1]!.trim()}: ${body.replace(/\n/g, ' ')}`)
  }
  return out.length ? out.join('\n') : null
}

/** Saca las marcas de Markdown: el plan del paciente es texto llano, una línea por alimento. */
function plain(md: string): string {
  return md
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join('\n')
}

const DEFAULT_TIME: [RegExp, string][] = [
  [/desayuno/i, '08:00'],
  [/media ma/i, '10:30'],
  [/almuerzo/i, '13:00'],
  [/merienda/i, '17:30'],
  [/cena/i, '21:00'],
]

/**
 * Un menú estacional como plan semanal: una fila por comida y lo mismo todos los días, para
 * que el nutricionista lo adapte día por día en la carpeta del paciente.
 */
export function seasonalMenuToReusablePlan(menu: SeasonalMenuTemplate): ReusablePlan {
  const n = columnCount(true)
  const mealRows: MealRowModel[] = seasonalMenuMeals(menu).map((meal, i) => ({
    id: `${menu.id}-${i}`,
    label: meal.label,
    approxTime: DEFAULT_TIME.find(([re]) => re.test(meal.label))?.[1] ?? '',
    columns: Array<string>(n).fill(plain(meal.content)),
    macros: Array.from({ length: n }, () => ({ kcal: meal.kcal, p: null, c: null, g: null })),
  }))
  return {
    id: `menu:${menu.id}`,
    source: 'template',
    name: menu.title,
    subtitle: menu.summary,
    mergeWeekends: true,
    grid: { mealRows },
    libraryId: null,
    notes: menuNotes(menu),
    updatedAt: new Date().toISOString(),
  }
}
