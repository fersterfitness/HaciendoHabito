import { useEffect, useMemo, useState } from 'react'
import { Library } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import type { RoutineBlueprint } from '@/types/database'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const SIN_MACRO = 'Sin macrociclo'

export function AssignPresetRoutineModal({
  open,
  studentId: _studentId,
  studentName,
  onClose,
  onPick,
}: {
  open: boolean
  studentId: string
  studentName: string
  onClose: () => void
  onPick: (blueprintId: string) => void
}) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<RoutineBlueprint[]>([])
  const [loading, setLoading] = useState(false)
  const [macro, setMacro] = useState('')
  const [meso, setMeso] = useState('')
  const [variantId, setVariantId] = useState('')

  useEffect(() => {
    if (!open || !user) return
    setLoading(true)
    setMacro('')
    setMeso('')
    setVariantId('')
    void supabase
      .from('routine_blueprints')
      .select('*')
      .eq('owner_id', user.id)
      .order('name')
      .then(({ data, error }) => {
        setLoading(false)
        if (error) {
          toast.error(error.message)
          return
        }
        setItems((data as RoutineBlueprint[]) ?? [])
      })
  }, [open, user])

  const macros = useMemo(() => {
    const names = [...new Set(items.map((b) => b.category?.trim() || SIN_MACRO))]
    return names.sort((a, b) => (a === SIN_MACRO ? 1 : b === SIN_MACRO ? -1 : a.localeCompare(b, 'es')))
  }, [items])

  const mesos = useMemo(() => {
    const inMacro = items.filter((b) => (b.category?.trim() || SIN_MACRO) === macro)
    const names = [...new Set(inMacro.map((b) => b.subcategory?.trim() || ''))]
    return names.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es')))
  }, [items, macro])

  const variants = useMemo(() => {
    return items.filter(
      (b) =>
        (b.category?.trim() || SIN_MACRO) === macro &&
        (b.subcategory?.trim() || '') === meso,
    )
  }, [items, macro, meso])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-surface-border bg-surface-card p-4 shadow-lg">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Rutinas preestablecidas</p>
        <h3 className="mt-1 text-sm font-semibold text-ink-primary">Asignar a {studentName}</h3>
        <p className="mt-1 text-[11px] text-ink-secondary">
          Elegí macrociclo, mesociclo y variante. Después podés editar la rutina del alumno.
        </p>
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-sm text-ink-muted">
            Todavía no hay variantes. Guardá una desde el detalle de una rutina (Base de datos → Rutinas preestablecidas).
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-[11px] font-medium text-ink-secondary">
              Macrociclo
              <select
                value={macro}
                onChange={(e) => {
                  setMacro(e.target.value)
                  setMeso('')
                  setVariantId('')
                }}
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
              >
                <option value="">Elegí…</option>
                {macros.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-ink-secondary">
              Mesociclo
              <select
                value={meso}
                onChange={(e) => {
                  setMeso(e.target.value)
                  setVariantId('')
                }}
                disabled={!macro}
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary disabled:opacity-50"
              >
                <option value="">{macro ? 'Elegí…' : 'Primero el macrociclo'}</option>
                {mesos.map((m) => (
                  <option key={m || '__none'} value={m}>
                    {m || 'Sin mesociclo'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-medium text-ink-secondary">
              Variante
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={!macro}
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary disabled:opacity-50"
              >
                <option value="">Elegí…</option>
                {variants.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className={cn('flex-1', !variantId && 'opacity-50')}
            disabled={!variantId}
            icon={<Library className="h-3.5 w-3.5" />}
            onClick={() => {
              if (!variantId) return
              onPick(variantId)
            }}
          >
            Asignar y editar
          </Button>
        </div>
      </div>
    </div>
  )
}
