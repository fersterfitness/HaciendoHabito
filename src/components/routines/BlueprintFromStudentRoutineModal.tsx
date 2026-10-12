import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { RoutineSourcePicker, type RoutineSourceOption } from '@/components/routines/RoutineSourcePicker'
import { serializeBlocksToBlueprint } from '@/lib/routine/routineBlueprint'
import { withBlueprintMeta } from '@/lib/routine/blueprintFolders'
import type { RoutineBlueprint } from '@/types/database'
import { Modal } from '@/components/ui/Modal'

type BlocksForBlueprint = Parameters<typeof serializeBlocksToBlueprint>[0]

const inputCls =
  'mt-1 w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary outline-none focus:border-brand-secondary'

/**
 * Copia una rutina ya asignada a un alumno como variante preestablecida.
 * La rutina del alumno no se toca: se guarda una copia y se abre el editor de la copia.
 */
export function BlueprintFromStudentRoutineModal({
  open,
  onClose,
  onCreated,
  knownCategories,
  knownSubcategories,
  defaults,
}: {
  open: boolean
  onClose: () => void
  onCreated: (bp: RoutineBlueprint) => void
  knownCategories: string[]
  knownSubcategories: string[]
  defaults?: { category?: string; subcategory?: string; routineGroup?: string }
}) {
  const { user } = useAuthStore()
  const [routines, setRoutines] = useState<RoutineSourceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [routineId, setRoutineId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [routineGroup, setRoutineGroup] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    setRoutineId('')
    setName('')
    setCategory(defaults?.category ?? '')
    setSubcategory(defaults?.subcategory ?? '')
    setRoutineGroup(defaults?.routineGroup ?? '')
    setLoading(true)
    void supabase
      .from('routines')
      .select('*, student:students(full_name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) {
          toast.error(error.message)
          return
        }
        type Row = Omit<RoutineSourceOption, 'student_name'> & { student?: { full_name?: string | null } | null }
        setRoutines(
          ((data as Row[]) ?? [])
            // Solo rutinas de alumnos (actuales o eliminados), no las preestablecidas.
            .filter((r) => r.student_id || r.former_student_name)
            .map((r) => ({
            id: r.id,
            name: r.name,
            student_id: r.student_id,
            student_name: r.student?.full_name ?? null,
            former_student_name: r.former_student_name ?? null,
            start_date: r.start_date,
            created_at: r.created_at,
          })),
        )
      })
    // Los defaults solo se toman al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user])

  function pick(id: string) {
    setRoutineId(id)
    const r = routines.find((x) => x.id === id)
    if (r && !name.trim()) setName(r.name)
  }

  async function save() {
    if (!user || !routineId || !name.trim()) return
    setSaving(true)
    try {
      const [{ data: routine, error: rErr }, { data: blocks, error: bErr }] = await Promise.all([
        supabase.from('routines').select('objective, level').eq('id', routineId).single(),
        supabase
          .from('routine_blocks')
          .select('*, days:routine_days(*, exercises:routine_exercises(*))')
          .eq('routine_id', routineId)
          .order('sort_order'),
      ])
      if (rErr || bErr) throw new Error((rErr ?? bErr)!.message)
      const payload = serializeBlocksToBlueprint((blocks ?? []) as unknown as BlocksForBlueprint)
      const meta = {
        objective: (routine as { objective?: string | null } | null)?.objective ?? undefined,
        ...(routineGroup.trim() ? { routine_group: routineGroup.trim() } : {}),
      }
      const { data: created, error } = await supabase
        .from('routine_blueprints')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          category: category.trim() || null,
          subcategory: subcategory.trim() || null,
          description: null,
          payload: withBlueprintMeta(JSON.parse(JSON.stringify(payload)), meta),
        })
        .select('*')
        .single()
      if (error || !created) throw new Error(error?.message ?? 'No se pudo guardar la variante')
      toast.success('Copiada a preestablecidas. Ya podés modificarla.')
      onCreated(created as RoutineBlueprint)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo copiar la rutina')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal open onClose={onClose} size="lg" bare className="max-h-[92vh] overflow-y-auto p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Rutinas preestablecidas</p>
    <h3 className="mt-1 text-sm font-semibold text-ink-primary">Copiar desde rutina de un alumno</h3>
    <p className="mt-1 text-[11px] text-ink-secondary">
      Elegí la rutina, ubicala en una carpeta y se abre el editor para modificarla. La rutina del alumno no cambia.
    </p>

    <div className="mt-4">
      {loading ? (
        <p className="py-8 text-center text-sm text-ink-muted">Cargando…</p>
      ) : (
        <RoutineSourcePicker routines={routines} value={routineId} onChange={pick} includeLibrary={false} />
      )}
    </div>

    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="text-[11px] font-medium text-ink-secondary sm:col-span-2">
        Nombre de la variante
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: estándar" className={inputCls} />
      </label>
      <label className="text-[11px] font-medium text-ink-secondary">
        Macrociclo (carpeta)
        <input list="bp-from-student-categories" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
      </label>
      <label className="text-[11px] font-medium text-ink-secondary">
        Mesociclo
        <input list="bp-from-student-subcategories" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={inputCls} />
      </label>
      <label className="text-[11px] font-medium text-ink-secondary sm:col-span-2">
        Rutina (carpeta, opcional)
        <input value={routineGroup} onChange={(e) => setRoutineGroup(e.target.value)} className={inputCls} />
      </label>
    </div>
    <datalist id="bp-from-student-categories">
      {knownCategories.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
    <datalist id="bp-from-student-subcategories">
      {knownSubcategories.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>

    <div className="mt-4 flex gap-2">
      <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        type="button"
        className="flex-1"
        disabled={!routineId || !name.trim() || saving}
        loading={saving}
        icon={<Copy className="h-3.5 w-3.5" />}
        onClick={() => void save()}
      >
        Copiar y editar
      </Button>
    </div>
    </Modal>
  )
}
