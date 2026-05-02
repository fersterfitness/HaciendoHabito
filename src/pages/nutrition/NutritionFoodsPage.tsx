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
import { cn } from '@/lib/utils'
import { formatFunctionsInvokeError } from '@/lib/invokeFunctionError'
import { filterFoodCatalogEs, type FoodCatalogItemEs } from '@/lib/nutrition/foodCatalogEs'
import { useAuthStore } from '@/stores/authStore'
import type { NutritionFoodLibrary, NutritionFoodPortionBasis, NutritionFoodExternalSource } from '@/types/database'
import toast from 'react-hot-toast'

type FdcHit = { fdcId: number; description: string; dataType: string | null }

const PORTION_OPTS: { v: NutritionFoodPortionBasis; label: string }[] = [
  { v: 'no_especificado', label: 'No indicado' },
  { v: 'crudo', label: 'Peso en crudo' },
  { v: 'cocido', label: 'Peso cocido' },
]

const CATALOGO_LABEL = 'Catálogo guía (español)'

function sourceBadge(row: NutritionFoodLibrary): string {
  if (row.external_source === 'usda_fdc') return 'Base internacional (USDA)'
  if (row.source_label?.includes('Catálogo')) return 'Lista en español'
  return 'A mano'
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
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fiber, setFiber] = useState('')
  const [kcal, setKcal] = useState('')
  const [notes, setNotes] = useState('')
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
    setProtein('')
    setFat('')
    setCarbs('')
    setFiber('')
    setKcal('')
    setNotes('')
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
    setProtein(String(item.protein_g_per_100g))
    setFat(String(item.fat_g_per_100g))
    setCarbs(String(item.carbs_g_per_100g))
    setFiber(String(item.fiber_g_per_100g))
    setKcal(String(item.energy_kcal_per_100g))
    setNotes(
      'Valores orientativos por 100 g. Ajustá si usás otra preparación o marca.'
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
    setProtein(row.protein_g_per_100g != null ? String(row.protein_g_per_100g) : '')
    setFat(row.fat_g_per_100g != null ? String(row.fat_g_per_100g) : '')
    setCarbs(row.carbs_g_per_100g != null ? String(row.carbs_g_per_100g) : '')
    setFiber(row.fiber_g_per_100g != null ? String(row.fiber_g_per_100g) : '')
    setKcal(row.energy_kcal_per_100g != null ? String(row.energy_kcal_per_100g) : '')
    setNotes(row.notes ?? '')
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
      external_source: externalSource,
      external_fdc_id: externalSource === 'usda_fdc' ? fdcParsed : null,
      protein_g_per_100g: parseDecimal(protein),
      fat_g_per_100g: parseDecimal(fat),
      carbs_g_per_100g: parseDecimal(carbs),
      fiber_g_per_100g: parseDecimal(fiber),
      energy_kcal_per_100g: parseDecimal(kcal),
      portion_basis: portionBasis,
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

  return (
    <div>
      <Header title="Guía de alimentos" />

      <div className="px-4 lg:px-6 py-6 space-y-8 max-w-4xl pb-28">
        <p className="text-sm text-ink-secondary -mt-3 mb-1 leading-relaxed">
          Elegí alimentos en <strong>español</strong> con números ya cargados (por 100 g), o escribí el tuyo a mano y guardalos abajo en «Guardar en mi lista».
          Es orientación para alumnos, no reemplaza a un nutricionista.
        </p>

        <section className="rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink-primary mb-1 flex items-center gap-2">
            <Wheat className="w-5 h-5 text-brand-primary shrink-0" aria-hidden />
            Mi lista
          </h2>
          <p className="text-xs text-ink-secondary mb-4">
            Acá están los que guardás vos desde esta página (solo tu cuenta). Podés editar o borrar con los íconos.
          </p>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Todavía no guardaste nada"
              description="Elegí del catálogo en español, completá el formulario más abajo y tocá «Guardar en mi lista»."
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-surface-border bg-surface-elevated px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-primary truncate">{r.display_name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Prot {r.protein_g_per_100g ?? '—'} g · Grasas {r.fat_g_per_100g ?? '—'} g · Carbos{' '}
                      {r.carbs_g_per_100g ?? '—'} g · Fibra {r.fiber_g_per_100g ?? '—'} g · {r.energy_kcal_per_100g ?? '—'}{' '}
                      kcal <span className="text-ink-secondary/90">(por 100 g)</span>
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
                      className="text-status-expired hover:text-red-600"
                      onClick={() => setDeleteTarget(r)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className={cn(
            'rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm space-y-3',
            showCatalogDropdown && 'relative z-[100]',
          )}
        >
          <h2 className="text-base font-semibold text-ink-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-primary shrink-0" aria-hidden />
            Lista en español (lo más simple)
          </h2>
          <p className="text-xs text-ink-muted">
            Empezá a escribir en el buscador para ver coincidencias. Tocá un ítem y se rellenan los valores; podés editar todo
            antes de guardar.
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
            />
            {catalogQuery.trim().length === 0 ? (
              <p className="text-[11px] text-ink-muted px-0.5" id="nutrition-catalog-results" role="status">
                La lista aparece cuando escribís al menos un carácter.
              </p>
            ) : !catalogPanelOpen ? (
              <p className="text-[11px] text-ink-muted px-0.5" id="nutrition-catalog-results" role="status">
                Tocá de nuevo el buscador para abrir los resultados, o borrá el texto.
              </p>
            ) : (
              <div
                id="nutrition-catalog-results"
                role="listbox"
                aria-label="Resultados del catálogo"
                className={cn(
                  'absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-surface-border',
                  'bg-surface-card text-sm shadow-2xl',
                  'ring-1 ring-black/10 dark:ring-white/15',
                )}
              >
                {groupedCatalog.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-ink-muted">Sin coincidencias. Probá otra palabra.</p>
                ) : (
                  groupedCatalog.map(([grupo, items]) => (
                    <div key={grupo}>
                      <div className="sticky top-0 z-[1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-surface-card border-b border-surface-border">
                        {grupo}
                      </div>
                      <ul className="divide-y divide-surface-border/80 bg-surface-card" role="group" aria-label={grupo}>
                        {items.map((item) => (
                          <li key={item.id} role="option">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-brand-primary/10 transition-colors flex justify-between gap-2 bg-surface-card"
                              onClick={() => applyCatalogItem(item)}
                            >
                              <span className="font-medium text-ink-primary">{item.nombre}</span>
                              <span className="text-[10px] text-ink-muted shrink-0 tabular-nums">
                                {item.portion_basis === 'cocido'
                                  ? 'cocido'
                                  : item.portion_basis === 'crudo'
                                    ? 'crudo'
                                    : '—'}
                              </span>
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

        <section className="rounded-2xl border border-surface-border bg-surface-card p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-ink-primary flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-primary" aria-hidden />
              {editingId ? 'Editar' : 'Agregar o ajustar'}
            </h2>
            {(editingId || displayName) && (
              <button
                type="button"
                onClick={() => resetForm()}
                className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden /> Empezar de nuevo
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Nombre del alimento *</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div>
                <p id="portion-basis-label" className="text-xs text-ink-secondary font-medium mb-2 block">
                  ¿El peso es crudo o cocido?
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="portion-basis-label">
                  {PORTION_OPTS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPortionBasis(o.v)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm transition-colors shrink-0',
                        portionBasis === o.v
                          ? 'border-brand-primary bg-brand-primary/10 text-ink-primary font-medium ring-2 ring-brand-primary/20'
                          : 'border-surface-inputBorder bg-surface-input text-ink-secondary hover:border-brand-primary/40',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Nota (opcional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. marca que usás, preparación…"
                  className="w-full rounded-xl bg-surface-input border border-surface-inputBorder px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-y min-h-[2.75rem]"
                />
              </div>
              <div className="sm:col-span-2 text-[11px] text-ink-muted">
                Valores por <strong>100 gramos</strong> (como en planillas).
              </div>
              <div>
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Proteínas (g)</label>
                <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Grasas (g)</label>
                <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Carbohidratos (g)</label>
                <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Fibra (g)</label>
                <Input value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-ink-secondary font-medium mb-1 block">Calorías (kcal)</label>
                <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" />
              </div>
            </div>

            {isUsda && (
              <div className="rounded-xl border border-surface-border bg-surface-elevated/50 p-3 space-y-2 text-sm">
                <p className="text-xs font-semibold text-ink-secondary">Detalle importación internacional</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-ink-secondary font-medium block">ID técnico</label>
                    <Input value={externalFdcId} onChange={(e) => setExternalFdcId(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-secondary font-medium block">Referencia</label>
                    <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {!isUsda && sourceLabel && (
              <p className="text-[11px] text-ink-muted">
                Origen: <span className="text-ink-secondary">{sourceLabel}</span>
              </p>
            )}

            <details className="rounded-xl border border-dashed border-surface-border bg-surface-elevated/30">
              <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-ink-secondary list-none [&::-webkit-details-marker]:hidden">
                Otra opción: base internacional (inglés) — opcional
              </summary>
              <div className="px-3 pb-3 pt-0 space-y-2 border-t border-surface-border/80">
                <p className="text-[11px] text-ink-muted pt-2">
                  Los resultados suelen estar en inglés; podés traducir el nombre arriba antes de guardar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <Input
                      value={fdcQuery}
                      onChange={(e) => setFdcQuery(e.target.value)}
                      placeholder="Ej. oats, chicken breast…"
                      aria-label="Búsqueda internacional"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={fdcSearching || fdcQuery.trim().length < 2}
                    icon={fdcSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    onClick={() => runFdcSearch()}
                  >
                    Buscar
                  </Button>
                </div>
                {fdcHits.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-lg border border-surface-border bg-surface-card divide-y divide-surface-border text-xs">
                    {fdcHits.map((h) => (
                      <li key={h.fdcId}>
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 hover:bg-brand-primary/10 flex justify-between gap-2 text-ink-primary bg-surface-card"
                          onClick={() => loadFdcDetail(h)}
                          disabled={detailLoadingId === h.fdcId}
                        >
                          <span className="line-clamp-2">{h.description}</span>
                          {detailLoadingId === h.fdcId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
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
              icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {editingId ? 'Guardar cambios' : 'Guardar en mi lista'}
            </Button>
          </form>
        </section>
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
