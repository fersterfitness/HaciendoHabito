import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Wheat,
  PencilLine,
  Save,
  XCircle,
  BookOpen,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { trainerCtaAccentTextClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'
import { formatFunctionsInvokeError } from '@/lib/invokeFunctionError'
import { filterFoodCatalogEs, type FoodCatalogItemEs } from '@/lib/nutrition/foodCatalogEs'
import { useAuthStore } from '@/stores/authStore'
import type {
  NutritionFoodLibrary,
  NutritionFoodMacroQtyPresentation,
  NutritionFoodPortionBasis,
  NutritionFoodExternalSource,
} from '@/types/database'
import toast from 'react-hot-toast'

type FdcHit = { fdcId: number; description: string; dataType: string | null }

const PORTION_OPTS: { v: NutritionFoodPortionBasis; label: string }[] = [
  { v: 'no_especificado', label: 'No indicado' },
  { v: 'crudo', label: 'Peso en crudo' },
  { v: 'cocido', label: 'Peso cocido' },
]

const MACRO_QTY_OPTS: { v: NutritionFoodMacroQtyPresentation; label: string }[] = [
  { v: 'grams', label: 'Gramos (100 g)' },
  { v: 'units', label: 'Unidad (uds.)' },
  { v: 'volume', label: 'Mililitros (100 ml)' },
]

const CATALOGO_LABEL = 'Catálogo guía (español)'
const CATEGORY_MAX = 80

const INPUT_GRAY_FOCUS_CLASS =
  'rounded-md border-zinc-200/80 bg-surface-input focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-700 dark:focus:border-zinc-500'

function normalizeFoodCategory(raw: string): string {
  const t = raw.trim()
  if (!t) return 'General'
  return t.slice(0, CATEGORY_MAX)
}

function sourceBadge(row: NutritionFoodLibrary): string {
  if (row.external_source === 'usda_fdc') return 'Base internacional (USDA)'
  if (row.source_label?.includes('Catálogo')) return 'Lista en español'
  return 'A mano'
}

function macroQtyMiListaSuffix(m: NutritionFoodMacroQtyPresentation | null | undefined): string {
  switch (m) {
    case 'volume':
      return '(por 100 ml)'
    case 'units':
      return '(ref. 100 g · uds. en plan)'
    default:
      return '(por 100 g)'
  }
}

export function NutritionFoodsPage() {
  const user = useAuthStore((s) => s.user)
  const [rows, setRows] = useState<NutritionFoodLibrary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<NutritionFoodLibrary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [catalogQuery, setCatalogQuery] = useState('')
  /** Panel tipo dropdown: solo visible mientras está abierto (click afueras lo cierra). */
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false)
  const catalogPopoverRef = useRef<HTMLDivElement>(null)
  const [fdcQuery, setFdcQuery] = useState('')
  const [fdcSearching, setFdcSearching] = useState(false)
  const [fdcHits, setFdcHits] = useState<FdcHit[]>([])
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [externalSource, setExternalSource] = useState<NutritionFoodExternalSource>('manual')
  const [externalFdcId, setExternalFdcId] = useState<string>('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [portionBasis, setPortionBasis] = useState<NutritionFoodPortionBasis>('no_especificado')
  const [macroQtyPresentation, setMacroQtyPresentation] = useState<NutritionFoodMacroQtyPresentation>('grams')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fiber, setFiber] = useState('')
  const [kcal, setKcal] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('General')
  const [saving, setSaving] = useState(false)

  const catalogFiltered = useMemo(() => filterFoodCatalogEs(catalogQuery), [catalogQuery])
  const isUsda = externalSource === 'usda_fdc'

  const resetForm = useCallback(() => {
    setEditingId(null)
    setDisplayName('')
    setExternalSource('manual')
    setExternalFdcId('')
    setSourceLabel('')
    setPortionBasis('no_especificado')
    setMacroQtyPresentation('grams')
    setProtein('')
    setFat('')
    setCarbs('')
    setFiber('')
    setKcal('')
    setNotes('')
    setCategory('General')
    setFdcHits([])
    setFdcQuery('')
    setCatalogQuery('')
    setCatalogPanelOpen(false)
  }, [])

  function applyCatalogItem(item: FoodCatalogItemEs) {
    setCatalogPanelOpen(false)
    setEditingId(null)
    setDisplayName(item.nombre)
    setExternalSource('manual')
    setExternalFdcId('')
    setSourceLabel(CATALOGO_LABEL)
    setPortionBasis(item.portion_basis)
    setMacroQtyPresentation('grams')
    setProtein(String(item.protein_g_per_100g))
    setFat(String(item.fat_g_per_100g))
    setCarbs(String(item.carbs_g_per_100g))
    setFiber(String(item.fiber_g_per_100g))
    setKcal(String(item.energy_kcal_per_100g))
    setCategory(normalizeFoodCategory(item.grupo))
    const extras = item.serving_examples ? `\n\nReferencia porción: ${item.serving_examples}` : ''
    setNotes(
      `Valores por 100 g; conviene cruzar con USDA FoodData Central (búsqueda en esta pantalla) si cambiás marca o corte.${extras}`,
    )
    toast.success('Listo: revisá y tocá «Guardar» si te sirve.')
  }

  const loadRows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('nutrition_food_library')
      .select('*')
      .eq('owner_id', user.id)
      .order('category', { ascending: true })
      .order('display_name')
    setLoading(false)
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        toast.error('Falta la tabla en la base. Ejecutá el SQL nuevo (nutrition_food_library) en Supabase.')
      } else {
        toast.error(error.message)
      }
      return
    }
    setRows((data ?? []) as NutritionFoodLibrary[])
  }, [user])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  /** Cerrar lista del catálogo al clickear fuera o con Escape */
  useEffect(() => {
    if (!catalogPanelOpen) return
    function pointerOutside(e: MouseEvent | TouchEvent | PointerEvent) {
      const t = e.target
      if (t instanceof Node && !catalogPopoverRef.current?.contains(t)) {
        setCatalogPanelOpen(false)
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setCatalogPanelOpen(false)
    }
    document.addEventListener('mousedown', pointerOutside)
    document.addEventListener('touchstart', pointerOutside, { passive: true })
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', pointerOutside)
      document.removeEventListener('touchstart', pointerOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [catalogPanelOpen])

  const showCatalogDropdown = catalogQuery.trim().length > 0 && catalogPanelOpen

  function populateFromRow(row: NutritionFoodLibrary) {
    setEditingId(row.id)
    setDisplayName(row.display_name)
    setExternalSource(row.external_source)
    setExternalFdcId(row.external_fdc_id != null ? String(row.external_fdc_id) : '')
    setSourceLabel(row.source_label ?? '')
    setPortionBasis(row.portion_basis)
    setMacroQtyPresentation(row.macro_qty_presentation ?? 'grams')
    setProtein(row.protein_g_per_100g != null ? String(row.protein_g_per_100g) : '')
    setFat(row.fat_g_per_100g != null ? String(row.fat_g_per_100g) : '')
    setCarbs(row.carbs_g_per_100g != null ? String(row.carbs_g_per_100g) : '')
    setFiber(row.fiber_g_per_100g != null ? String(row.fiber_g_per_100g) : '')
    setKcal(row.energy_kcal_per_100g != null ? String(row.energy_kcal_per_100g) : '')
    setNotes(row.notes ?? '')
    setCategory(normalizeFoodCategory(row.category ?? 'General'))
  }

  function parseDecimal(s: string): number | null {
    const t = s.trim().replace(',', '.')
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  async function runFdcSearch() {
    if (!user || fdcQuery.trim().length < 2) {
      toast.error('Escribí al menos 2 caracteres.')
      return
    }
    setFdcSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('food-nutrition-lookup', {
        body: { action: 'search', query: fdcQuery.trim() },
      })
      if (error) {
        toast.error(await formatFunctionsInvokeError(error))
        setFdcHits([])
        return
      }
      const payload = data as { foods?: FdcHit[]; error?: string }
      if (payload?.error) {
        toast.error(
          payload.error === 'falta_USDA_FDC_API_KEY'
            ? 'La búsqueda internacional no está configurada en el servidor.'
            : payload.error
        )
        setFdcHits([])
        return
      }
      setFdcHits(Array.isArray(payload?.foods) ? payload.foods : [])
      if (!(payload?.foods?.length ?? 0)) toast('Sin resultados en esa base.')
    } finally {
      setFdcSearching(false)
    }
  }

  async function loadFdcDetail(hit: FdcHit) {
    if (!user) return
    setDetailLoadingId(hit.fdcId)
    try {
      const { data, error } = await supabase.functions.invoke('food-nutrition-lookup', {
        body: { action: 'detail', fdcId: hit.fdcId },
      })
      if (error) {
        toast.error(await formatFunctionsInvokeError(error))
        return
      }
      const payload = data as {
        error?: string
        description?: string
        macros?: {
          protein_g_per_100g: number | null
          fat_g_per_100g: number | null
          carbs_g_per_100g: number | null
          fiber_g_per_100g: number | null
          energy_kcal_per_100g: number | null
        }
        sourceLabel?: string
        basisHint?: string
      }
      if (payload?.error) {
        toast.error(payload.error)
        return
      }
      const m = payload.macros
      setEditingId(null)
      setExternalSource('usda_fdc')
      setExternalFdcId(String(hit.fdcId))
      setDisplayName(payload.description?.slice(0, 200) ?? hit.description)
      setSourceLabel(payload.sourceLabel ?? '')
      setProtein(m?.protein_g_per_100g != null ? String(m.protein_g_per_100g) : '')
      setFat(m?.fat_g_per_100g != null ? String(m.fat_g_per_100g) : '')
      setCarbs(m?.carbs_g_per_100g != null ? String(m.carbs_g_per_100g) : '')
      setFiber(m?.fiber_g_per_100g != null ? String(m.fiber_g_per_100g) : '')
      setKcal(m?.energy_kcal_per_100g != null ? String(m.energy_kcal_per_100g) : '')
      if (payload.basisHint) toast(payload.basisHint, { duration: 5000 })
      setCategory('USDA / internacional')
      setMacroQtyPresentation('grams')
      toast.success('Importado. Los nombres suelen venir en inglés: podés editarlos antes de guardar.')
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !displayName.trim()) {
      toast.error('Poné un nombre al alimento.')
      return
    }

    let fdcParsed: number | null = null
    if (externalSource === 'usda_fdc') {
      fdcParsed = externalFdcId.trim() === '' ? null : parseInt(externalFdcId.trim(), 10)
      if (fdcParsed == null || Number.isNaN(fdcParsed)) {
        toast.error('Falta el identificador del alimento importado.')
        return
      }
    }

    const row = {
      owner_id: user.id,
      display_name: displayName.trim(),
      category: normalizeFoodCategory(category),
      external_source: externalSource,
      external_fdc_id: externalSource === 'usda_fdc' ? fdcParsed : null,
      protein_g_per_100g: parseDecimal(protein),
      fat_g_per_100g: parseDecimal(fat),
      carbs_g_per_100g: parseDecimal(carbs),
      fiber_g_per_100g: parseDecimal(fiber),
      energy_kcal_per_100g: parseDecimal(kcal),
      portion_basis: portionBasis,
      macro_qty_presentation: macroQtyPresentation,
      source_label: sourceLabel.trim() === '' ? null : sourceLabel.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('nutrition_food_library').update(row).eq('id', editingId).eq('owner_id', user.id)
        if (error) {
          if (error.code === '23505') toast.error('Ya tenés ese alimento de la base internacional guardado.')
          else toast.error(error.message)
          return
        }
        toast.success('Actualizado')
      } else {
        const { error } = await supabase.from('nutrition_food_library').insert(row)
        if (error) {
          if (error.code === '23505') toast.error('Ya tenés ese alimento de la base internacional guardado.')
          else toast.error(error.message)
          return
        }
        toast.success('Guardado en tu lista')
      }
      resetForm()
      loadRows()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('nutrition_food_library')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('owner_id', user.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Listo')
    setDeleteTarget(null)
    if (editingId === deleteTarget.id) resetForm()
    loadRows()
  }

  const groupedCatalog = useMemo(() => {
    const m = new Map<string, FoodCatalogItemEs[]>()
    for (const item of catalogFiltered) {
      const g = item.grupo
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(item)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [catalogFiltered])

  const existingCategories = useMemo(() => {
    const uniq = new Set<string>()
    for (const r of rows) uniq.add(normalizeFoodCategory(r.category ?? 'General'))
    return [...uniq].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const groupedSavedFoods = useMemo(() => {
    const m = new Map<string, NutritionFoodLibrary[]>()
    for (const r of rows) {
      const c = normalizeFoodCategory(r.category ?? 'General')
      if (!m.has(c)) m.set(c, [])
      m.get(c)!.push(r)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [rows])

  return (
    <div className="min-h-0">
      <Header title="Guía de alimentos" />

      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-28 lg:px-6 lg:py-8">
        <p className="mb-6 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Elegí alimentos en <strong className="font-semibold text-zinc-800 dark:text-zinc-200">español</strong> con números
          ya cargados (por 100 g), o escribí el tuyo a mano y guardalos con «Guardar en mi lista». Orientación para alumnos, no
          reemplaza a un nutricionista.
        </p>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          <div className="space-y-6 lg:col-span-7 xl:col-span-7">
        <section className="rounded-md border border-zinc-200/75 bg-surface-card p-4 sm:p-5 dark:border-zinc-700/65">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Wheat className="h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Mi lista
          </h2>
          <p className="mb-4 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Acá están los que guardás vos desde esta página (solo tu cuenta), agrupados por categoría. Podés crear el nombre del
          grupo al guardar cada alimento (como rutinas por categoría).
          </p>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner accent="trainerCta" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Todavía no guardaste nada"
              description="Elegí del catálogo en español, completá los datos del panel y tocá «Guardar en mi lista»."
            />
          ) : (
            <div className="space-y-6">
              {groupedSavedFoods.map(([catLabel, items]) => (
                <div key={catLabel}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                    {catLabel}
                  </p>
                  <ul className="space-y-2">
                    {items.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200/70 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-700/60 dark:bg-zinc-900/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink-primary truncate">{r.display_name}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Prot {r.protein_g_per_100g ?? '—'} g · Grasas {r.fat_g_per_100g ?? '—'} g · Carbos{' '}
                            {r.carbs_g_per_100g ?? '—'} g · Fibra {r.fiber_g_per_100g ?? '—'} g · {r.energy_kcal_per_100g ?? '—'}{' '}
                            kcal <span className="text-ink-secondary/90">{macroQtyMiListaSuffix(r.macro_qty_presentation)}</span>
                          </p>
                          <p className="text-[11px] text-ink-muted mt-1">
                            {r.portion_basis === 'cocido'
                              ? 'Referencia cocido'
                              : r.portion_basis === 'crudo'
                                ? 'Referencia crudo'
                                : 'Crudo/cocido no indicado'}
                            {' · '}
                            <span className="text-ink-secondary">{sourceBadge(r)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" variant="ghost" size="icon" onClick={() => populateFromRow(r)} aria-label="Editar">
                            <PencilLine className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-status-expired hover:text-status-expired/80"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className={cn(
            'space-y-3 rounded-md border border-zinc-200/75 bg-surface-card p-4 sm:p-5 dark:border-zinc-700/65',
            showCatalogDropdown && 'relative z-[100]',
          )}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <BookOpen className="h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Lista en español (lo más simple)
          </h2>
          <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Empezá a escribir en el buscador para ver coincidencias. Esta lista prioriza pesos <strong>cocidos</strong> en
            carnes y guarniciones típicas; avena, lácteos, pan y cereales en seco o listos según uso. Para alimentos nuevos,
            usá abajo <strong>Buscar USDA FDC</strong> (base pública con identificador) y revisá la porción antes de guardar.
          </p>
          <div ref={catalogPopoverRef} className="relative space-y-2">
            <Input
              value={catalogQuery}
              onChange={(e) => {
                setCatalogQuery(e.target.value)
                setCatalogPanelOpen(true)
              }}
              onFocus={() => {
                if (catalogQuery.trim().length > 0) setCatalogPanelOpen(true)
              }}
              placeholder="Buscar… ej. pollo, avena, banana"
              aria-label="Buscar en lista español"
              aria-expanded={showCatalogDropdown}
              aria-controls="nutrition-catalog-results"
              aria-autocomplete="list"
              autoComplete="off"
              className={INPUT_GRAY_FOCUS_CLASS}
            />
            {catalogQuery.trim().length === 0 ? (
              <p className="px-0.5 text-[11px] text-zinc-500 dark:text-zinc-500" id="nutrition-catalog-results" role="status">
                La lista aparece cuando escribís al menos un carácter.
              </p>
            ) : !catalogPanelOpen ? (
              <p className="px-0.5 text-[11px] text-zinc-500 dark:text-zinc-500" id="nutrition-catalog-results" role="status">
                Tocá de nuevo el buscador para abrir los resultados, o borrá el texto.
              </p>
            ) : (
              <div
                id="nutrition-catalog-results"
                role="listbox"
                aria-label="Resultados del catálogo"
                className={cn(
                  'absolute left-0 right-0 top-full z-[120] mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200/90',
                  'bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-950',
                )}
              >
                {groupedCatalog.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-500">Sin coincidencias. Probá otra palabra.</p>
                ) : (
                  groupedCatalog.map(([grupo, items]) => (
                    <div key={grupo}>
                      <div className="sticky top-0 z-[1] border-b border-zinc-200/80 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-400">
                        {grupo}
                      </div>
                      <ul className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950" role="group" aria-label={grupo}>
                        {items.map((item) => (
                          <li key={item.id} role="option">
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 bg-transparent px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/80 sm:flex-row sm:items-start sm:justify-between"
                              onClick={() => applyCatalogItem(item)}
                            >
                              <span className="min-w-0 font-medium text-ink-primary">{item.nombre}</span>
                              <div className="flex shrink-0 flex-col items-end gap-0.5 sm:ml-2">
                                <span className="text-[10px] text-ink-muted tabular-nums">
                                  {item.portion_basis === 'cocido'
                                    ? 'base cocido'
                                    : item.portion_basis === 'crudo'
                                      ? 'base crudo / listo'
                                      : '—'}
                                </span>
                                {item.serving_examples ? (
                                  <span className="max-w-[14rem] text-right text-[9px] leading-snug text-ink-muted">
                                    {item.serving_examples}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
          </div>

          <div className="lg:sticky lg:top-20 lg:col-span-5 xl:col-span-5 lg:self-start">
        <section className="space-y-4 rounded-md border border-zinc-200/75 bg-surface-card p-4 sm:p-5 dark:border-zinc-700/65">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              <Plus className="h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
              {editingId ? 'Editar' : 'Agregar o ajustar'}
            </h2>
            {(editingId || displayName) && (
              <button
                type="button"
                onClick={() => resetForm()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden /> Empezar de nuevo
              </button>
            )}
          </div>

          <datalist id="nutrition-food-category-suggestions">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Nombre del alimento *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className={INPUT_GRAY_FOCUS_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="nutrition-food-category-field"
                  className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400"
                >
                  Categoría (agrupa en «Mi lista»)
                </label>
                <input
                  id="nutrition-food-category-field"
                  list="nutrition-food-category-suggestions"
                  value={category}
                  maxLength={CATEGORY_MAX}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej. Lácteos, Verduras…"
                  className={cn(
                    'w-full px-3 py-2.5 text-sm text-ink-primary outline-none placeholder:text-ink-muted',
                    INPUT_GRAY_FOCUS_CLASS,
                  )}
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
                  Podés inventar categorías (ej. Verduras, Hortalizas A) escribiendo texto libre; aparecen en Mi lista y el
                  datalist reutiliza las que ya creaste. Vacío ⇒ «General». Máximo {CATEGORY_MAX} caracteres.
                </p>
              </div>
              <div>
                <p id="portion-basis-label" className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-400">
                  ¿El peso es crudo o cocido?
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="portion-basis-label">
                  {PORTION_OPTS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPortionBasis(o.v)}
                      className={cn(
                        'shrink-0 rounded-md border px-3 py-2 text-sm transition-colors',
                        portionBasis === o.v
                          ? 'border-zinc-800 bg-zinc-100 font-medium text-zinc-950 ring-2 ring-zinc-300 ring-offset-1 ring-offset-surface-card dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-600'
                          : 'border-zinc-200/90 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-600',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Nota (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. marca que usás, preparación…"
                  className={cn(
                    'min-h-[2.75rem] w-full resize-y px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted',
                    INPUT_GRAY_FOCUS_CLASS,
                  )}
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2 rounded-md border border-zinc-200/70 bg-zinc-50/40 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/25">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 min-w-0 flex-1">
                    {macroQtyPresentation === 'volume' ? (
                      <>
                        Valores por <strong>100 mililitros</strong> (como en planillas de bebidas). Los mismos campos numéricos
                        aplican a esa base.
                      </>
                    ) : macroQtyPresentation === 'units' ? (
                      <>
                        Valores nutricionales por <strong>100 gramos</strong>; al armar el plan se usará modo{' '}
                        <strong>unidades</strong> (completás uds. y gramos equivalentes en la tabla).
                      </>
                    ) : (
                      <>
                        Valores por <strong>100 gramos</strong> (como en planillas).
                      </>
                    )}
                  </p>
                  <div className="shrink-0 w-full sm:w-[11.5rem]">
                    <label
                      htmlFor="nutrition-food-macro-qty"
                      className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400"
                    >
                      Referencia al planificar
                    </label>
                    <select
                      id="nutrition-food-macro-qty"
                      value={macroQtyPresentation}
                      onChange={(e) => setMacroQtyPresentation(e.target.value as NutritionFoodMacroQtyPresentation)}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-ink-primary outline-none bg-white dark:bg-zinc-950',
                        INPUT_GRAY_FOCUS_CLASS,
                      )}
                    >
                      {MACRO_QTY_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Proteínas (g)</label>
                <Input
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  inputMode="decimal"
                  className={INPUT_GRAY_FOCUS_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Grasas (g)</label>
                <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" className={INPUT_GRAY_FOCUS_CLASS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Carbohidratos (g)</label>
                <Input
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  inputMode="decimal"
                  className={INPUT_GRAY_FOCUS_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Fibra (g)</label>
                <Input value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" className={INPUT_GRAY_FOCUS_CLASS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-400">Calorías (kcal)</label>
                <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className={INPUT_GRAY_FOCUS_CLASS} />
              </div>
            </div>

            {isUsda && (
              <div className="space-y-2 rounded-md border border-zinc-200/75 bg-zinc-50/60 p-3 text-sm dark:border-zinc-700/65 dark:bg-zinc-900/35">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Detalle importación internacional</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">ID técnico</label>
                    <Input
                      value={externalFdcId}
                      onChange={(e) => setExternalFdcId(e.target.value)}
                      inputMode="numeric"
                      className={INPUT_GRAY_FOCUS_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Referencia</label>
                    <Input
                      value={sourceLabel}
                      onChange={(e) => setSourceLabel(e.target.value)}
                      className={INPUT_GRAY_FOCUS_CLASS}
                    />
                  </div>
                </div>
              </div>
            )}

            {!isUsda && sourceLabel && (
              <p className="text-[11px] text-ink-muted">
                Origen: <span className="text-ink-secondary">{sourceLabel}</span>
              </p>
            )}

            <details className="rounded-md border border-dashed border-zinc-200/85 bg-zinc-50/40 dark:border-zinc-700 dark:bg-zinc-900/25">
              <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-400 [&::-webkit-details-marker]:hidden">
                Otra opción: base internacional (inglés) — opcional
              </summary>
              <div className="space-y-2 border-t border-zinc-200/70 px-3 pb-3 pt-0 dark:border-zinc-700/70">
                <p className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
                  Los resultados suelen estar en inglés; podés traducir el nombre arriba antes de guardar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <Input
                      value={fdcQuery}
                      onChange={(e) => setFdcQuery(e.target.value)}
                      placeholder="Ej. oats, chicken breast…"
                      aria-label="Búsqueda internacional"
                      className={INPUT_GRAY_FOCUS_CLASS}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-200 text-zinc-800 shadow-none hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
                    disabled={fdcSearching || fdcQuery.trim().length < 2}
                    icon={
                      fdcSearching ? (
                        <Loader2 className={cn('w-4 h-4 animate-spin', trainerCtaAccentTextClassName)} />
                      ) : (
                        <Search className="w-4 h-4" />
                      )
                    }
                    onClick={() => runFdcSearch()}
                  >
                    Buscar
                  </Button>
                </div>
                {fdcHits.length > 0 && (
                  <ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200/80 bg-white text-xs dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-950">
                    {fdcHits.map((h) => (
                      <li key={h.fdcId}>
                        <button
                          type="button"
                          className="flex w-full justify-between gap-2 bg-transparent px-2 py-1.5 text-left text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
                          onClick={() => loadFdcDetail(h)}
                          disabled={detailLoadingId === h.fdcId}
                        >
                          <span className="line-clamp-2">{h.description}</span>
                          {detailLoadingId === h.fdcId ? (
                            <Loader2 className={cn('w-3.5 h-3.5 shrink-0 animate-spin', trainerCtaAccentTextClassName)} />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>

            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="w-full shadow-none bg-[#ff4800] hover:bg-[#e04100] hover:shadow-none focus-visible:ring-2 focus-visible:ring-[#ff4800]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))] sm:w-auto"
              icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {editingId ? 'Guardar cambios' : 'Guardar en mi lista'}
            </Button>
          </form>
        </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Quitar alimento"
        description={
          deleteTarget ? `¿Sacar «${deleteTarget.display_name}» de tu lista?` : undefined
        }
        confirmLabel="Quitar"
        loading={deleting}
      />
    </div>
  )
}
