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
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { Header } from '@/components/layout/Header'
import { NutritionLibraryTabs } from '@/components/nutrition/NutritionLibraryTabs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageSectionTitle } from '@/components/ui/PageSectionTitle'
import { supabase } from '@/lib/supabase'
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
  { v: 'grams', label: 'Gramos (referencia variable)' },
  { v: 'units', label: 'Unidad (uds.)' },
  { v: 'volume', label: 'Mililitros (100 ml)' },
]

const CATALOGO_LABEL = 'Catálogo guía (español)'
const CATEGORY_MAX = 80

/** UI monocromática; secondary/tertiary solo en acentos mínimos. */
const foodsPanelClass = 'rounded-2xl border border-surface-border/80 bg-surface-card shadow-card'

const foodsSectionTitleClass =
  'text-label font-semibold uppercase tracking-wider text-ink-muted'

const foodsMetaClass = 'text-[11px] leading-snug text-ink-muted'

const foodsHintClass = 'text-[10px] leading-snug text-ink-muted'

const foodsInputClass =
  'rounded-xl border border-surface-border/80 bg-surface-input outline-none transition-colors focus:border-surface-border focus:ring-2 focus:ring-brand-secondary/12'

const foodsLabelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted'

const foodsChipActiveClass =
  'border-surface-border bg-surface-elevated font-medium text-ink-primary shadow-[inset_2px_0_0_0_rgb(var(--brand-secondary)/0.55)]'

const foodsChipIdleClass =
  'border-surface-border/70 bg-transparent text-ink-muted hover:border-surface-border hover:bg-surface-elevated/50 hover:text-ink-secondary'

const foodsListItemClass =
  'group flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border/70 bg-surface-elevated/10 px-3 py-2 transition-colors hover:border-surface-border hover:bg-surface-elevated/35'

/** Acentos puntuales (opacidad baja). */
/** Detalles mínimos en color (baja opacidad). */
const foodsDetailTertiary = 'text-brand-tertiary/50'

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

function macroQtyMiListaSuffix(row: NutritionFoodLibrary): string {
  const m = row.macro_qty_presentation ?? 'grams'
  const g =
    row.macro_ref_basis_g != null && Number.isFinite(row.macro_ref_basis_g) && row.macro_ref_basis_g > 0
      ? row.macro_ref_basis_g
      : 100
  if (m === 'volume') return '(por 100 ml)'
  if (m === 'units') return `(por ${g} g · uds. en plan)`
  return `(por ${g} g)`
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
  /** Tupla explícita: evita autofix `const [, set…]` que dispara ReferenceError en el JSX. */
  const macroQtyPresentationTuple = useState<NutritionFoodMacroQtyPresentation>('grams')
  const macroQtyPresentation = macroQtyPresentationTuple[0]
  const setMacroQtyPresentation = macroQtyPresentationTuple[1]
  const [macroRefBasisG, setMacroRefBasisG] = useState('100')
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
    setMacroRefBasisG('100')
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
  }, [setMacroQtyPresentation])

  function applyCatalogItem(item: FoodCatalogItemEs) {
    setCatalogPanelOpen(false)
    setEditingId(null)
    setDisplayName(item.nombre)
    setExternalSource('manual')
    setExternalFdcId('')
    setSourceLabel(CATALOGO_LABEL)
    setPortionBasis(item.portion_basis)
    setMacroQtyPresentation('grams')
    setMacroRefBasisG('100')
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
    setMacroRefBasisG(
      row.macro_ref_basis_g != null && Number.isFinite(row.macro_ref_basis_g) && row.macro_ref_basis_g > 0
        ? String(row.macro_ref_basis_g)
        : '100',
    )
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

    const basisRaw = parseDecimal(macroRefBasisG) ?? 100
    const macro_ref_basis_g = Math.min(10000, Math.max(1, basisRaw))

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
      macro_ref_basis_g,
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
      <Header title="Biblioteca" />

      <DirectoryPageShell className="max-w-[1600px] space-y-4 pb-24">
        <NutritionLibraryTabs />
        <PageSectionTitle
          title="Biblioteca y carga"
          description="Catálogo en español, USDA FDC o manual. Todo queda en Mi lista por categoría."
        />

        <div className="grid gap-4 xl:grid-cols-12 xl:items-start xl:gap-5">
          <div className="space-y-4 xl:col-span-8 2xl:col-span-9">
        <section className={cn('p-3.5 sm:p-4', foodsPanelClass)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className={cn('inline-flex items-center gap-2', foodsSectionTitleClass)}>
              <Wheat className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
              Mi lista
            </h2>
            {!loading && rows.length > 0 ? (
              <span className="rounded-md border border-surface-border/80 bg-surface-elevated/40 px-2 py-0.5 text-[10px] font-medium tabular-nums text-ink-muted">
                <span className={foodsDetailTertiary}>{rows.length}</span>
              </span>
            ) : null}
          </div>
          <p className={cn('mb-3', foodsHintClass)}>Tu biblioteca personal, agrupada por categoría.</p>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" className="text-ink-muted" variant="spin" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Todavía no guardaste nada"
              description="Elegí del catálogo en español, completá los datos del panel y tocá «Guardar en mi lista»."
            />
          ) : (
            <div className="space-y-4">
              {groupedSavedFoods.map(([catLabel, items]) => (
                <div key={catLabel}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    {catLabel}
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((r) => (
                      <li key={r.id} className={foodsListItemClass}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-primary">{r.display_name}</p>
                          <p className={cn('mt-0.5 tabular-nums', foodsMetaClass)}>
                            P {r.protein_g_per_100g ?? '—'} · G {r.fat_g_per_100g ?? '—'} · HC {r.carbs_g_per_100g ?? '—'} ·
                            Fib {r.fiber_g_per_100g ?? '—'} · {r.energy_kcal_per_100g ?? '—'} kcal
                            <span className={foodsDetailTertiary}> {macroQtyMiListaSuffix(r)}</span>
                          </p>
                          <p className={cn('mt-0.5', foodsHintClass)}>
                            {r.portion_basis === 'cocido'
                              ? 'Cocido'
                              : r.portion_basis === 'crudo'
                                ? 'Crudo'
                                : 'Sin indicar'}
                            <span className="text-ink-muted/50"> · </span>
                            {sourceBadge(r)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
                            onClick={() => populateFromRow(r)}
                            aria-label="Editar"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-ink-muted hover:bg-status-expired/10 hover:text-status-expired"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
            'space-y-2.5 p-3.5 sm:p-4',
            foodsPanelClass,
            showCatalogDropdown && 'relative z-[100]',
          )}
        >
          <h2 className={cn('inline-flex items-center gap-2', foodsSectionTitleClass)}>
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
            Catálogo en español
          </h2>
          <p className={foodsHintClass}>
            Buscá por nombre. Carnes/guarniciones en <span className={foodsDetailTertiary}>cocido</span>; cereales/lácteos según
            uso. Nuevos: <span className={foodsDetailTertiary}>USDA FDC</span> en el panel derecho.
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
              className={foodsInputClass}
            />
            {catalogQuery.trim().length === 0 ? (
              <p className={foodsHintClass} id="nutrition-catalog-results" role="status">
                La lista aparece cuando escribís al menos un carácter.
              </p>
            ) : !catalogPanelOpen ? (
              <p className={foodsHintClass} id="nutrition-catalog-results" role="status">
                Tocá de nuevo el buscador para abrir los resultados, o borrá el texto.
              </p>
            ) : (
              <div
                id="nutrition-catalog-results"
                role="listbox"
                aria-label="Resultados del catálogo"
                className={cn(
                  'absolute left-0 right-0 top-full z-[120] mt-1 max-h-56 overflow-y-auto rounded-xl border border-surface-border/90',
                  'bg-surface-card text-sm shadow-card-md',
                )}
              >
                {groupedCatalog.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink-muted">Sin coincidencias. Probá otra palabra.</p>
                ) : (
                  groupedCatalog.map(([grupo, items]) => (
                    <div key={grupo}>
                      <div className="sticky top-0 z-[1] border-b border-surface-border/80 bg-surface-elevated/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {grupo}
                      </div>
                      <ul className="divide-y divide-surface-border/60" role="group" aria-label={grupo}>
                        {items.map((item) => (
                          <li key={item.id} role="option">
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 bg-transparent px-3 py-2 text-left transition-colors hover:bg-surface-elevated/50 sm:flex-row sm:items-start sm:justify-between"
                              onClick={() => applyCatalogItem(item)}
                            >
                              <span className="min-w-0 text-sm font-medium text-ink-primary">{item.nombre}</span>
                              <div className="flex shrink-0 flex-col items-end gap-0.5 sm:ml-2">
                                <span className={cn('text-[10px] tabular-nums', foodsDetailTertiary)}>
                                  {item.portion_basis === 'cocido'
                                    ? 'cocido'
                                    : item.portion_basis === 'crudo'
                                      ? 'crudo'
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

          <div className="xl:sticky xl:top-16 xl:col-span-4 2xl:col-span-3 xl:self-start">
        <section className={cn('overflow-hidden', foodsPanelClass)}>
          <div className="border-b border-surface-border/80 bg-surface-elevated/25 px-3.5 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className={cn('inline-flex items-center gap-2', foodsSectionTitleClass)}>
                <Plus className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                {editingId ? 'Editar alimento' : 'Agregar o ajustar'}
              </h2>
              {(editingId || displayName) && (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted hover:text-ink-secondary"
                >
                  <XCircle className="h-3 w-3" aria-hidden /> Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 p-3.5 sm:p-4">

          <datalist id="nutrition-food-category-suggestions">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={foodsLabelClass}>Nombre del alimento *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className={foodsInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="nutrition-food-category-field" className={foodsLabelClass}>
                  Categoría
                </label>
                <input
                  id="nutrition-food-category-field"
                  list="nutrition-food-category-suggestions"
                  value={category}
                  maxLength={CATEGORY_MAX}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej. Lácteos, Verduras…"
                  className={cn(
                    'w-full px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted',
                    foodsInputClass,
                  )}
                />
                <p className={cn('mt-1', foodsHintClass)}>
                  Texto libre · vacío = General · máx. {CATEGORY_MAX} caracteres
                </p>
              </div>
              <div className="sm:col-span-2">
                <p id="portion-basis-label" className={foodsLabelClass}>
                  Peso crudo o cocido
                </p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="portion-basis-label">
                  {PORTION_OPTS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPortionBasis(o.v)}
                      className={cn(
                        'shrink-0 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                        portionBasis === o.v ? foodsChipActiveClass : foodsChipIdleClass,
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={foodsLabelClass}>Nota (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Marca, preparación…"
                  className={cn(
                    'min-h-[2.5rem] w-full resize-y px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted',
                    foodsInputClass,
                  )}
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-surface-border/80 bg-surface-elevated/15 p-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <p className={cn('min-w-0 flex-1', foodsHintClass)}>
                    {macroQtyPresentation === 'volume' ? (
                      <>Base <span className={foodsDetailTertiary}>100 ml</span> en los campos numéricos.</>
                    ) : macroQtyPresentation === 'units' ? (
                      <>Referencia <span className={foodsDetailTertiary}>100 g</span>; en el plan usás unidades.</>
                    ) : (
                      <>
                        Base{' '}
                        <span className={cn('tabular-nums', foodsDetailTertiary)}>
                          {macroRefBasisG.trim() ? macroRefBasisG.trim().replace(',', '.') : '100'} g
                        </span>{' '}
                        (P/G/HC/kcal para esa cantidad).
                      </>
                    )}
                  </p>
                  <div className="w-full shrink-0 sm:w-[10.5rem]">
                    <label htmlFor="nutrition-food-macro-qty" className={foodsLabelClass}>
                      Al planificar
                    </label>
                    <select
                      id="nutrition-food-macro-qty"
                      value={macroQtyPresentation}
                      onChange={(e) => setMacroQtyPresentation(e.target.value as NutritionFoodMacroQtyPresentation)}
                      className={cn('w-full px-2.5 py-1.5 text-sm text-ink-primary', foodsInputClass)}
                    >
                      {MACRO_QTY_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {macroQtyPresentation === 'grams' ? (
                  <div className="flex flex-col gap-2 border-t border-surface-border/70 pt-2 sm:flex-row sm:items-end sm:gap-3">
                    <div className="w-full max-w-[9rem]">
                      <label htmlFor="nutrition-macro-ref-basis-g" className={foodsLabelClass}>
                        Gramos ref.
                      </label>
                      <Input
                        id="nutrition-macro-ref-basis-g"
                        value={macroRefBasisG}
                        onChange={(e) => setMacroRefBasisG(e.target.value)}
                        inputMode="decimal"
                        placeholder="100"
                        className={foodsInputClass}
                      />
                    </div>
                    <p className={cn('flex-1 pb-0.5', foodsHintClass)}>
                      Define la base al cargar gramos en el plan.
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <div>
                  <label className={foodsLabelClass}>Prot. (g)</label>
                  <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" className={foodsInputClass} />
                </div>
                <div>
                  <label className={foodsLabelClass}>Grasas (g)</label>
                  <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" className={foodsInputClass} />
                </div>
                <div>
                  <label className={foodsLabelClass}>HC (g)</label>
                  <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" className={foodsInputClass} />
                </div>
                <div>
                  <label className={foodsLabelClass}>Fibra (g)</label>
                  <Input value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" className={foodsInputClass} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={foodsLabelClass}>kcal</label>
                  <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className={foodsInputClass} />
                </div>
              </div>
            </div>

            {isUsda && (
              <div className="space-y-2 rounded-xl border border-surface-border/80 bg-surface-elevated/15 p-2.5 text-sm">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', foodsDetailTertiary)}>
                  Importación internacional
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={foodsLabelClass}>ID técnico</label>
                    <Input value={externalFdcId} onChange={(e) => setExternalFdcId(e.target.value)} inputMode="numeric" className={foodsInputClass} />
                  </div>
                  <div>
                    <label className={foodsLabelClass}>Referencia</label>
                    <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} className={foodsInputClass} />
                  </div>
                </div>
              </div>
            )}

            {!isUsda && sourceLabel && (
              <p className={foodsHintClass}>
                Origen: <span className={foodsDetailTertiary}>{sourceLabel}</span>
              </p>
            )}

            <details className="rounded-xl border border-dashed border-surface-border/80 bg-surface-elevated/10">
              <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs font-medium text-ink-secondary [&::-webkit-details-marker]:hidden">
                USDA FDC (inglés) — opcional
              </summary>
              <div className="space-y-2 border-t border-surface-border/70 px-3 pb-3 pt-0">
                <p className={cn('pt-2', foodsHintClass)}>Resultados en inglés; traducí el nombre antes de guardar.</p>
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={fdcQuery}
                      onChange={(e) => setFdcQuery(e.target.value)}
                      placeholder="Ej. oats, chicken breast…"
                      aria-label="Búsqueda internacional"
                      className={foodsInputClass}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-surface-border/80 text-ink-secondary hover:bg-surface-elevated/50"
                    disabled={fdcSearching || fdcQuery.trim().length < 2}
                    icon={fdcSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    onClick={() => runFdcSearch()}
                  >
                    Buscar
                  </Button>
                </div>
                {fdcHits.length > 0 && (
                  <ul className="max-h-36 divide-y divide-surface-border/60 overflow-y-auto rounded-lg border border-surface-border/80 text-xs">
                    {fdcHits.map((h) => (
                      <li key={h.fdcId}>
                        <button
                          type="button"
                          className="flex w-full justify-between gap-2 bg-transparent px-2 py-1.5 text-left text-ink-primary transition-colors hover:bg-surface-elevated/50"
                          onClick={() => loadFdcDetail(h)}
                          disabled={detailLoadingId === h.fdcId}
                        >
                          <span className="line-clamp-2">{h.description}</span>
                          {detailLoadingId === h.fdcId ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" />
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
              variant="secondary"
              disabled={saving}
              className="w-full ring-1 ring-brand-secondary/15"
              icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            >
              {editingId ? 'Guardar cambios' : 'Guardar en mi lista'}
            </Button>
          </form>
          </div>
        </section>
          </div>
        </div>
      </DirectoryPageShell>

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
