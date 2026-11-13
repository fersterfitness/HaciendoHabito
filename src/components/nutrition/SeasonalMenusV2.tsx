import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Copy, LayoutGrid, List, Plus, Search, UserPlus, Wheat } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import type { Student } from '@/types/database'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { controlMdClassName } from '@/lib/formControlClasses'
import { mealPhotoId, unsplashUrl } from '@/lib/nutrition/foodPhotos'
import {
  PATHOLOGY_LABELS,
  SEASON_LABELS,
  TOLERANCE_LABELS,
  type DigestiveTolerance,
  type MenuMacroSplit,
  type MenuSeason,
  type PathologyTag,
  type SeasonalMenuTemplate,
} from '@/lib/nutrition/seasonalMenuLibrary'
import { isCustomMenuId } from '@/lib/nutrition/customMenus'
import { bestMenuFor, loadUpcomingPatientsWithPathology, mostUsedMenus, readMenuUsage } from '@/lib/nutrition/menuSuggestions'
import { useAuthStore } from '@/stores/authStore'
import { seasonalMenuMeals, type SeasonalMenuMeal } from '@/lib/nutrition/seasonalMenuToPlan'
import { cn } from '@/lib/utils'

type SeasonFilter = MenuSeason | 'todas'
type PathologyFilter = PathologyTag | 'todas'
type ToleranceFilter = DigestiveTolerance | 'todas'

type SortId = 'sugerido' | 'kcal-asc' | 'kcal-desc' | 'nombre' | 'usados'
const SORT_LABELS: Record<SortId, string> = {
  sugerido: 'Orden sugerido',
  'kcal-asc': 'Menos calorías primero',
  'kcal-desc': 'Más calorías primero',
  nombre: 'Por nombre',
  usados: 'Los que más usás',
}

type Meal = SeasonalMenuMeal
const mealsOf = seasonalMenuMeals

export function menuPhotoUrl(m: SeasonalMenuTemplate, meals: Meal[], w: number, h: number): string {
  const main = meals.find((x) => /almuerzo|cena/i.test(x.label)) ?? meals[0]
  return unsplashUrl(mealPhotoId(main?.label ?? 'Almuerzo', (main?.content ?? m.summary).replace(/\*\*/g, ''), m.id), w, h)
}

const SEASON_TONE: Record<MenuSeason, string> = {
  invierno: 'bg-pastel-lavender text-pastel-lavender-ink',
  verano: 'bg-pastel-butter text-pastel-butter-ink',
  'todo-el-anio': 'bg-pastel-mint text-pastel-mint-ink',
}
const TOLERANCE_TONE: Record<DigestiveTolerance, string> = {
  baja: 'bg-pastel-rose text-pastel-rose-ink',
  media: 'bg-pastel-butter text-pastel-butter-ink',
  alta: 'bg-pastel-mint text-pastel-mint-ink',
}
const MEAL_TONES = [
  'bg-pastel-butter text-pastel-butter-ink',
  'bg-pastel-mint text-pastel-mint-ink',
  'bg-pastel-peach text-pastel-peach-ink',
  'bg-pastel-lavender text-pastel-lavender-ink',
  'bg-pastel-sky text-pastel-sky-ink',
]

function Tags({ m }: { m: SeasonalMenuTemplate }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isCustomMenuId(m.id) ? <span className="rounded-md bg-ink-primary px-2 py-0.5 text-xs font-medium text-surface-base">Tuyo</span> : null}
      <span className={cn('hh-pastel rounded-md px-2 py-0.5 text-xs font-medium', SEASON_TONE[m.season])}>{SEASON_LABELS[m.season]}</span>
      <span className={cn('hh-pastel rounded-md px-2 py-0.5 text-xs font-medium', TOLERANCE_TONE[m.tolerance])}>Tolerancia {m.tolerance}</span>
      {m.pathologies.map((p) => (
        <span key={p} className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs text-ink-secondary">
          {PATHOLOGY_LABELS[p]}
        </span>
      ))}
    </div>
  )
}

/** Calorías del día y cómo se reparten: cuatro casilleros de color. */
function MacroTiles({ m }: { m: SeasonalMenuTemplate }) {
  const split = m.macroSplit!
  const tiles = [
    ...(m.approximateKcal ? [{ label: 'Calorías', value: m.approximateKcal.toLocaleString('es-AR'), unit: 'kcal', tone: 'bg-pastel-mint text-pastel-mint-ink' }] : []),
    { label: 'Hidratos', value: String(split.carbsPct), unit: '%', tone: 'bg-pastel-butter text-pastel-butter-ink' },
    { label: 'Proteínas', value: String(split.proteinPct), unit: '%', tone: 'bg-pastel-peach text-pastel-peach-ink' },
    { label: 'Grasas', value: String(split.fatPct), unit: '%', tone: 'bg-pastel-lavender text-pastel-lavender-ink' },
  ]
  return (
    <div>
      <dl className={cn('grid grid-cols-2 gap-2', tiles.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
        {tiles.map((t) => (
          <div key={t.label} className={cn('hh-pastel rounded-xl px-3 py-2.5', t.tone)}>
            <dt className="truncate text-xs opacity-80">{t.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {t.value}
              <span className="ml-1 text-xs font-normal opacity-80">{t.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="pt-1.5 text-xs text-ink-muted">Calorías por día y qué parte aporta cada macronutriente (estimado según los alimentos del menú).</p>
    </div>
  )
}

/** El reparto de macros en una línea, para las filas y tarjetas de la lista. */
function MacroLine({ split }: { split: MenuMacroSplit }) {
  const parts: [string, number][] = [
    ['Hidratos', split.carbsPct],
    ['Proteínas', split.proteinPct],
    ['Grasas', split.fatPct],
  ]
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted" title="Parte de las calorías del día que aporta cada macronutriente (estimado)">
      {parts.map(([label, pct]) => (
        <span key={label}>
          {label} <span className="font-semibold tabular-nums text-ink-secondary">{pct} %</span>
        </span>
      ))}
    </p>
  )
}

/** Las comidas del menú con sus calorías, en pastillas chicas. */
function MealChips({ meals }: { meals: Meal[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {meals.slice(0, 5).map((meal) => (
        <li key={meal.label} className="rounded-md bg-surface-card px-2 py-1 text-xs text-ink-secondary">
          {meal.label} <span className="font-semibold tabular-nums text-ink-primary">{meal.kcal}</span> kcal
        </li>
      ))}
    </ul>
  )
}

function Photo({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden bg-surface-elevated', className)}>
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
    </div>
  )
}

/** Verano de octubre a marzo (hemisferio sur). */
export function currentMenuSeason(): MenuSeason {
  const month = new Date().getMonth()
  return month >= 9 || month <= 2 ? 'verano' : 'invierno'
}

export function SeasonalMenusV2({
  all,
  filtered,
  season,
  onSeason,
  pathology,
  onPathology,
  tolerance,
  onTolerance,
  search,
  onSearch,
  hasActiveFilters,
  onReset,
  onOpen,
  onCopy,
  onUse,
  onNew,
  onUseFor,
}: {
  /** Todos los menús (propios y de la app), sin filtrar: para los contadores. */
  all: SeasonalMenuTemplate[]
  filtered: SeasonalMenuTemplate[]
  season: SeasonFilter
  onSeason: (s: SeasonFilter) => void
  pathology: PathologyFilter
  onPathology: (p: PathologyFilter) => void
  tolerance: ToleranceFilter
  onTolerance: (t: ToleranceFilter) => void
  search: string
  onSearch: (q: string) => void
  hasActiveFilters: boolean
  onReset: () => void
  onOpen: (id: string) => void
  onCopy: (m: SeasonalMenuTemplate) => void
  /** Elegir un paciente y usar el menú como base de su plan. */
  onUse: (m: SeasonalMenuTemplate) => void
  onNew: () => void
  /** Usar el menú directamente con un paciente (sin pasar por el selector). */
  onUseFor: (m: SeasonalMenuTemplate, studentId: string) => void
}) {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [sort, setSort] = useState<SortId>('sugerido')
  const user = useAuthStore((st) => st.user)
  const usage = useMemo(() => readMenuUsage(), [])
  const mostUsed = useMemo(() => mostUsedMenus(all, usage), [all, usage])
  const upcomingQ = useQuery({
    queryKey: ['v2', 'menus-upcoming-pathology', user?.id],
    enabled: Boolean(user),
    queryFn: () => loadUpcomingPatientsWithPathology(user!.id),
    staleTime: 60_000,
  })
  // Para cada paciente con turno próximo, el menú que mejor le encaja (hasta tres).
  const recommended = useMemo(() => {
    const season = currentMenuSeason()
    return (upcomingQ.data ?? [])
      .map((p) => {
        const best = bestMenuFor(all, p.tags, season)
        return best ? { patient: p, ...best } : null
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .slice(0, 3)
  }, [upcomingQ.data, all])
  const hasAside = recommended.length > 0 || mostUsed.length > 0
  const withMeals = useMemo(() => filtered.map((m) => ({ m, meals: mealsOf(m) })), [filtered])

  // El destacado solo aparece sin filtros: con filtros, la lista ya es la respuesta.
  const featured = useMemo(() => {
    if (hasActiveFilters || withMeals.length === 0) return null
    const now = currentMenuSeason()
    return withMeals.find((x) => x.m.season === now) ?? withMeals[0]!
  }, [hasActiveFilters, withMeals])
  const rest = useMemo(() => {
    const list = featured ? withMeals.filter((x) => x.m.id !== featured.m.id) : [...withMeals]
    // Sin calorías cargadas: al final, en cualquiera de los dos sentidos.
    const kcal = (m: SeasonalMenuTemplate, missing: number) => m.approximateKcal ?? missing
    if (sort === 'kcal-asc') list.sort((a, b) => kcal(a.m, Infinity) - kcal(b.m, Infinity))
    else if (sort === 'kcal-desc') list.sort((a, b) => kcal(b.m, -Infinity) - kcal(a.m, -Infinity))
    else if (sort === 'nombre') list.sort((a, b) => a.m.title.localeCompare(b.m.title, 'es'))
    else if (sort === 'usados') list.sort((a, b) => (usage[b.m.id]?.n ?? 0) - (usage[a.m.id]?.n ?? 0))
    return list
  }, [featured, withMeals, sort, usage])

  const seasonCount = (s: SeasonFilter) => (s === 'todas' ? all.length : all.filter((m) => m.season === s).length)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            placeholder="Buscar por nombre o patología"
            aria-label="Buscar menú"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          aria-label="Patología"
          value={pathology}
          onChange={(e) => onPathology(e.target.value as PathologyFilter)}
          className={cn(controlMdClassName, 'w-full cursor-pointer sm:w-52')}
        >
          <option value="todas">Todas las patologías</option>
          {(Object.keys(PATHOLOGY_LABELS) as PathologyTag[]).map((p) => (
            <option key={p} value={p}>
              {PATHOLOGY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Tolerancia digestiva"
          value={tolerance}
          onChange={(e) => onTolerance(e.target.value as ToleranceFilter)}
          className={cn(controlMdClassName, 'w-full cursor-pointer sm:w-52')}
        >
          <option value="todas">Cualquier tolerancia</option>
          {(Object.keys(TOLERANCE_LABELS) as DigestiveTolerance[]).map((t) => (
            <option key={t} value={t}>
              {TOLERANCE_LABELS[t]}
            </option>
          ))}
        </select>
        {hasActiveFilters ? (
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            Limpiar
          </Button>
        ) : null}
        <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={onNew}>
          Nuevo menú
        </Button>
      </div>

      <div className={cn('flex flex-col gap-6', hasAside && 'xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8')}>
      <div className="flex min-w-0 flex-col gap-6 max-xl:contents">
      {featured ? (
        <section aria-labelledby="menu-destacado" className="max-xl:order-1">
          <h2 id="menu-destacado" className="pb-2.5 text-sm font-semibold text-ink-primary">
            Sugerido para esta época
          </h2>
          <div className="grid gap-5 rounded-2xl bg-surface-elevated/60 p-4 sm:p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Photo src={menuPhotoUrl(featured.m, featured.meals, 800, 600)} className="aspect-[4/3] rounded-xl md:aspect-auto md:min-h-[260px]" />
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <h3 className="text-xl font-semibold leading-snug tracking-tight text-ink-primary sm:text-2xl">{featured.m.title}</h3>
                <p className="mt-1 text-sm text-ink-secondary">{featured.m.summary}</p>
              </div>
              <Tags m={featured.m} />
              {featured.m.macroSplit ? (
                <MacroTiles m={featured.m} />
              ) : featured.meals.length > 0 ? (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {featured.meals.slice(0, 4).map((meal, i) => (
                    <div key={meal.label} className={cn('hh-pastel rounded-xl px-3 py-2.5', MEAL_TONES[i % MEAL_TONES.length])}>
                      <dt className="truncate text-xs opacity-80">{meal.label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {meal.kcal}
                        <span className="ml-1 text-xs font-normal opacity-80">kcal</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {featured.m.macroSplit && featured.meals.length > 0 ? <MealChips meals={featured.meals} /> : null}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" icon={<UserPlus className="h-4 w-4" />} onClick={() => onUse(featured.m)}>
                  Usar con un paciente
                </Button>
                <Button type="button" variant="secondary" onClick={() => onOpen(featured.m.id)}>
                  Ver el menú completo
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Copiar el texto del menú" title="Copiar el texto" onClick={() => onCopy(featured.m)}>
                  <Copy className="h-4 w-4" />
                </Button>
                {featured.m.approximateKcal && !featured.m.macroSplit ? (
                  <span className="ml-auto text-sm tabular-nums text-ink-muted">≈ {featured.m.approximateKcal.toLocaleString('es-AR')} kcal por día</span>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="menu-todos" className="max-xl:order-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
          <h2 id="menu-todos" className="text-sm font-semibold text-ink-primary">
            {hasActiveFilters ? `${filtered.length} de ${all.length} menús` : 'Todos los menús'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              size="sm"
              ariaLabel="Temporada"
              value={season}
              onChange={(id) => onSeason(id as SeasonFilter)}
              items={(
                [
                  ['todas', 'Todos'],
                  ['invierno', 'Invierno'],
                  ['verano', 'Verano'],
                  ['todo-el-anio', 'Todo el año'],
                ] as const
              ).map(([id, label]) => ({ id, label, count: seasonCount(id) }))}
            />
            <select
              aria-label="Ordenar menús"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className={cn(controlMdClassName, 'h-8 w-auto cursor-pointer py-0 pr-8 text-xs')}
            >
              {(Object.keys(SORT_LABELS) as SortId[])
                .filter((id) => id !== 'usados' || mostUsed.length > 0)
                .map((id) => (
                  <option key={id} value={id}>
                    {SORT_LABELS[id]}
                  </option>
                ))}
            </select>
            <div className="hidden gap-1 sm:inline-flex" role="group" aria-label="Vista">
              <Button type="button" size="iconSm" variant={view === 'list' ? 'secondary' : 'ghost'} aria-label="Ver en lista" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <List className="h-4 w-4" />
              </Button>
              <Button type="button" size="iconSm" variant={view === 'grid' ? 'secondary' : 'ghost'} aria-label="Ver en tarjetas" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Wheat className="h-8 w-8" />} title="Sin menús con esos filtros" description="Probá quitar algún filtro o usar otra combinación." />
        ) : rest.length === 0 ? null : view === 'grid' ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map(({ m, meals }) => (
              <li key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-surface-border/60 bg-surface-card">
                <Photo src={menuPhotoUrl(m, meals, 640, 360)} className="aspect-[16/9]" />
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <h3 className="text-base font-semibold leading-snug text-ink-primary">{m.title}</h3>
                  <Tags m={m} />
                  <p className="text-sm text-ink-secondary">{m.summary}</p>
                  {m.macroSplit ? <MacroLine split={m.macroSplit} /> : null}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button type="button" size="sm" onClick={() => onUse(m)}>
                      Usar
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => onOpen(m.id)}>
                      Ver menú
                    </Button>
                    {m.approximateKcal ? <span className="ml-auto text-xs tabular-nums text-ink-muted">≈ {m.approximateKcal.toLocaleString('es-AR')} kcal</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-3">
            {rest.map(({ m, meals }) => (
              <li key={m.id} className="flex flex-col gap-4 rounded-2xl bg-surface-elevated/60 p-3 sm:flex-row sm:items-center">
                <Photo src={menuPhotoUrl(m, meals, 480, 360)} className="aspect-[16/9] w-full shrink-0 rounded-xl sm:aspect-[4/3] sm:w-40" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Tags m={m} />
                  <div>
                    <h3 className="text-base font-semibold leading-snug text-ink-primary">{m.title}</h3>
                    <p className="mt-0.5 text-sm text-ink-secondary">{m.summary}</p>
                  </div>
                  {meals.length > 0 ? <MealChips meals={meals} /> : null}
                  {m.macroSplit ? <MacroLine split={m.macroSplit} /> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch sm:pr-1">
                  {m.approximateKcal ? (
                    <span className="mr-auto text-sm tabular-nums text-ink-muted sm:mr-0 sm:text-right">≈ {m.approximateKcal.toLocaleString('es-AR')} kcal</span>
                  ) : null}
                  <Button type="button" size="sm" onClick={() => onUse(m)}>
                    Usar con un paciente
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onOpen(m.id)}>
                    Ver menú
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      {hasAside ? (
        <aside className="flex min-w-0 flex-col gap-6 max-xl:order-2">
          {recommended.length > 0 ? (
            <section aria-labelledby="menu-recomendados">
              <h2 id="menu-recomendados" className="pb-2.5 text-sm font-semibold text-ink-primary">
                Para tus próximos pacientes
              </h2>
              <ul className="flex flex-col gap-3 sm:max-xl:grid sm:max-xl:grid-cols-2">
                {recommended.map(({ patient, menu, matched }) => (
                  <li key={patient.studentId} className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface-card p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-ink-primary">{patient.fullName}</p>
                      <p className="shrink-0 text-xs capitalize tabular-nums text-ink-muted">
                        {format(new Date(patient.startsAt), 'EEE d · HH:mm', { locale: es })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matched.map((p) => (
                        <span key={p} className="hh-pastel rounded-md bg-pastel-lavender px-2 py-0.5 text-xs font-medium text-pastel-lavender-ink">
                          {PATHOLOGY_LABELS[p]}
                        </span>
                      ))}
                    </div>
                    <AsideMenuRow menu={menu} detail={menu.approximateKcal ? `≈ ${menu.approximateKcal.toLocaleString('es-AR')} kcal por día` : SEASON_LABELS[menu.season]} onOpen={onOpen} />
                    <Button type="button" size="sm" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => onUseFor(menu, patient.studentId)}>
                      Usar con {patient.fullName.split(/\s+/)[0]}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-xs text-ink-muted">Según las patologías que cada paciente cargó en su ficha. Revisalo antes de asignarlo.</p>
            </section>
          ) : null}

          {mostUsed.length > 0 ? (
            <section aria-labelledby="menu-mas-usados">
              <h2 id="menu-mas-usados" className="pb-2.5 text-sm font-semibold text-ink-primary">
                Los que más usás
              </h2>
              <ul className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface-card p-2">
                {mostUsed.map(({ menu, n }) => (
                  <li key={menu.id} className="flex items-center gap-2 p-1.5">
                    <div className="min-w-0 flex-1">
                      <AsideMenuRow menu={menu} detail={n === 1 ? 'Lo usaste 1 vez' : `Lo usaste ${n} veces`} onOpen={onOpen} />
                    </div>
                    <Button type="button" size="iconSm" variant="secondary" aria-label={`Usar «${menu.title}» con un paciente`} title="Usar con un paciente" onClick={() => onUse(menu)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}
      </div>
    </div>
  )
}

/** Un menú en la columna lateral: foto chica, título y un dato. Abre el menú completo. */
function AsideMenuRow({ menu, detail, onOpen }: { menu: SeasonalMenuTemplate; detail: string; onOpen: (id: string) => void }) {
  const meals = useMemo(() => mealsOf(menu), [menu])
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onOpen(menu.id)}
      icon={<Photo src={menuPhotoUrl(menu, meals, 160, 160)} className="h-12 w-12 rounded-lg" />}
      className="group h-auto w-full min-w-0 justify-start gap-3 whitespace-normal rounded-xl p-0 text-left font-normal hover:bg-transparent [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
    >
      <span className="block min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary group-hover:underline">{menu.title}</span>
        <span className="block truncate text-xs tabular-nums text-ink-muted">{detail}</span>
      </span>
    </Button>
  )
}

/** Elegir a qué paciente se le arma el plan a partir del menú. */
export function MenuPatientPicker({
  menu,
  onClose,
  onPick,
}: {
  menu: SeasonalMenuTemplate | null
  onClose: () => void
  onPick: (studentId: string) => void
}) {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [query, setQuery] = useState('')
  const open = menu != null

  useEffect(() => {
    if (!open || students) return
    let cancelled = false
    void fetchAccessibleStudents().then(({ data }) => {
      if (!cancelled) setStudents([...data].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')))
    })
    return () => {
      cancelled = true
    }
  }, [open, students])

  const q = query.trim().toLowerCase()
  const shown = (students ?? []).filter((s) => !q || s.full_name.toLowerCase().includes(q))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Para qué paciente?"
      description={menu ? `Se abre su plan con «${menu.title}» como base. Antes de reemplazar nada te pedimos confirmación.` : undefined}
    >
      <div className="flex flex-col gap-3">
        <Input
          autoFocus
          placeholder="Buscar paciente"
          aria-label="Buscar paciente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        {students == null ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">{students.length === 0 ? 'Todavía no tenés pacientes cargados.' : 'Ningún paciente con ese nombre.'}</p>
        ) : (
          <ul className="-mx-1 max-h-[46vh] overflow-y-auto">
            {shown.map((s) => (
              <li key={s.id}>
                <Button type="button" variant="ghost" className="h-auto w-full justify-start px-3 py-2.5 text-left font-medium" onClick={() => onPick(s.id)}>
                  {s.full_name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
