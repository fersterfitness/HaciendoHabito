import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowRight, Check, FolderOpen, Library, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import type { RoutineBlueprint } from '@/types/database'
import toast from 'react-hot-toast'

/** Lista de plantillas guardadas desde el detalle de rutina (pestaña dentro de Rutinas). */
export function RoutineBlueprintsPanel() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<RoutineBlueprint[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCat, setEditCat] = useState('')
  const [editSub, setEditSub] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('routine_blueprints')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((data as RoutineBlueprint[]) ?? [])
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  /** Agrupado: categoría → subcategoría → plantillas. */
  const grouped = useMemo(() => {
    const SIN_CAT = 'Sin categoría'
    const cats = new Map<string, Map<string, RoutineBlueprint[]>>()
    const sorted = [...items].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
    )
    for (const bp of sorted) {
      const cat = bp.category?.trim() || SIN_CAT
      const sub = bp.subcategory?.trim() || ''
      if (!cats.has(cat)) cats.set(cat, new Map())
      const subs = cats.get(cat)!
      if (!subs.has(sub)) subs.set(sub, [])
      subs.get(sub)!.push(bp)
    }
    // "Sin categoría" siempre al final.
    return [...cats.entries()].sort((a, b) =>
      a[0] === SIN_CAT ? 1 : b[0] === SIN_CAT ? -1 : a[0].localeCompare(b[0]),
    )
  }, [items])

  /** Categorías y subcategorías existentes (para reutilizar al asignar). */
  const knownCategories = useMemo(
    () => [...new Set(items.map((b) => b.category?.trim()).filter((c): c is string => !!c))].sort(),
    [items],
  )
  const knownSubcategories = useMemo(
    () => [...new Set(items.map((b) => b.subcategory?.trim()).filter((c): c is string => !!c))].sort(),
    [items],
  )

  function startEdit(bp: RoutineBlueprint) {
    setEditId(bp.id)
    setEditCat(bp.category ?? '')
    setEditSub(bp.subcategory ?? '')
  }

  async function saveCategory(bp: RoutineBlueprint) {
    setSavingCat(true)
    const category = editCat.trim() || null
    const subcategory = editSub.trim() || null
    const { error } = await supabase
      .from('routine_blueprints')
      .update({ category, subcategory })
      .eq('id', bp.id)
    setSavingCat(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setItems((prev) => prev.map((x) => (x.id === bp.id ? { ...x, category, subcategory } : x)))
    setEditId(null)
    toast.success('Carpeta actualizada')
  }

  /** Renombra una carpeta entera (categoría o subcategoría) en todas sus plantillas. */
  async function renameGroup(
    field: 'category' | 'subcategory',
    current: string,
    matchCategory?: string,
  ) {
    const next = window.prompt(
      field === 'category' ? 'Nuevo nombre de la categoría' : 'Nuevo nombre de la subcategoría',
      current,
    )
    if (next == null) return
    const value = next.trim() || null
    let q = supabase.from('routine_blueprints').update({ [field]: value }).eq('owner_id', user!.id)
    q = field === 'category' ? q.eq('category', current) : q.eq('subcategory', current)
    if (field === 'subcategory' && matchCategory) q = q.eq('category', matchCategory)
    const { error } = await q
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Carpeta renombrada')
    void load()
  }

  function renderBlueprint(bp: RoutineBlueprint) {
    const editing = editId === bp.id
    return (
      <li
        key={bp.id}
        className="rounded-xl border border-surface-border bg-surface-card px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <Library className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary">{bp.name}</p>
            {bp.description && (
              <p className="text-xs text-ink-secondary mt-1 whitespace-pre-wrap">{bp.description}</p>
            )}
            <p className="text-[10px] text-ink-muted mt-2">
              Actualizada {new Date(bp.updated_at).toLocaleString('es-AR')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => (editing ? setEditId(null) : startEdit(bp))}
              className="p-2 rounded-lg text-ink-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
              title="Mover a categoría / subcategoría"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <Link
              to={`/routines?create=1&blueprint=${bp.id}`}
              className="p-2 rounded-lg text-ink-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
              title="Crear rutina con esta plantilla"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setDeleteId(bp.id)}
              className="p-2 rounded-lg text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors"
              title="Eliminar plantilla"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 border-t border-surface-border pt-3">
            <label className="text-[11px] font-medium text-ink-secondary">
              Categoría
              <input
                list="bp-categories"
                value={editCat}
                onChange={(e) => setEditCat(e.target.value)}
                placeholder="Ej: Fase de intensificación"
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-brand-secondary"
              />
            </label>
            <label className="text-[11px] font-medium text-ink-secondary">
              Subcategoría
              <input
                list="bp-subcategories"
                value={editSub}
                onChange={(e) => setEditSub(e.target.value)}
                placeholder="Ej: Principiantes"
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-brand-secondary"
              />
            </label>
            <div className="flex items-end gap-1">
              <button
                type="button"
                onClick={() => void saveCategory(bp)}
                disabled={savingCat}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-secondary/15 px-2.5 py-1.5 text-xs font-semibold text-brand-secondary hover:bg-brand-secondary/25 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" /> Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('routine_blueprints').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plantilla eliminada')
    setDeleteId(null)
    void load()
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-ink-secondary leading-relaxed max-w-[52rem]">
          Guardá plantillas desde el detalle de una rutina (botón <strong className="text-ink-primary">Plantilla</strong>) y
          organizalas en <strong className="text-ink-primary">categorías y subcategorías</strong> (como carpetas): tocá el
          lápiz de cada plantilla para moverla, o el lápiz de una carpeta para renombrarla. Al{' '}
          <Link to="/routines?create=1" className="text-brand-primary font-medium hover:underline">
            crear una rutina nueva
          </Link>
          , elegí una entrada del <strong className="text-ink-primary">diccionario</strong> para copiar bloques, días y ejercicios.
        </p>
        <Button
          size="sm"
          variant="gradientSecondary"
          className="shrink-0"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/routines?create=1')}
        >
          Nueva rutina con plantilla
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Library className="h-8 w-8" />}
          title="Sin plantillas guardadas"
          description='Creá una rutina, cargá ejercicios y tocá "Plantilla" en la barra superior para guardarla acá.'
          action={{
            label: 'Ir a mis rutinas',
            onClick: () => navigate('/routines'),
            icon: <Plus className="h-4 w-4" />,
          }}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, subs]) => {
            const isReal = cat !== 'Sin categoría'
            return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2 border-b border-surface-border pb-1.5">
                <FolderOpen className="h-4 w-4 text-brand-secondary shrink-0" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-primary">{cat}</h3>
                <span className="text-[11px] text-ink-muted">
                  {[...subs.values()].reduce((n, arr) => n + arr.length, 0)}
                </span>
                {isReal && (
                  <button
                    type="button"
                    onClick={() => void renameGroup('category', cat)}
                    className="ml-1 rounded p-1 text-ink-muted hover:text-brand-secondary"
                    title="Renombrar categoría"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="space-y-4 pl-1">
                {[...subs.entries()]
                  .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
                  .map(([sub, bps]) => (
                    <div key={sub || '__none__'}>
                      {sub ? (
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                            {sub}
                          </p>
                          <button
                            type="button"
                            onClick={() => void renameGroup('subcategory', sub, isReal ? cat : undefined)}
                            className="rounded p-0.5 text-ink-muted hover:text-brand-secondary"
                            title="Renombrar subcategoría"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : null}
                      <ul className="space-y-2">{bps.map(renderBlueprint)}</ul>
                    </div>
                  ))}
              </div>
            </section>
            )
          })}
        </div>
      )}

      <datalist id="bp-categories">
        {knownCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="bp-subcategories">
        {knownSubcategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="¿Eliminar plantilla?"
        description="No afecta rutinas ya creadas. Solo se borra esta entrada del diccionario."
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </>
  )
}
