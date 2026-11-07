import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { controlInputClassName } from '@/lib/formControlClasses'
import { gridHasContent, matchesPlanQuery, planPreviewLines, toReusablePlan, type ReusablePlan } from '@/lib/nutrition/planReuse'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import type { NutritionPlanLibrary } from '@/types/database'

const LAYER = 'z-[70]'

function ago(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es })
  } catch {
    return ''
  }
}

/**
 * v2: elegir un plan para usar como base: una plantilla de la biblioteca o el plan activo de otro
 * paciente. El plan actual no se pierde: queda como versión anterior.
 */
export function PlanPickerDialog({
  open,
  ownerId,
  studentId,
  libraryPlans,
  busy,
  onPick,
  onClose,
}: {
  open: boolean
  ownerId: string
  /** Paciente actual: su propio plan no se ofrece. */
  studentId: string
  libraryPlans: NutritionPlanLibrary[]
  busy: boolean
  onPick: (plan: ReusablePlan) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'template' | 'patient'>('template')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [patientPlans, setPatientPlans] = useState<ReusablePlan[] | null>(null)

  const templates = useMemo(
    () =>
      libraryPlans
        .map((p) =>
          toReusablePlan({
            id: p.id,
            source: 'template',
            name: p.name,
            subtitle: p.objective,
            merge_weekends: p.merge_weekends,
            grid: p.grid,
            libraryId: p.id,
            notes: p.notes,
            updated_at: p.updated_at,
          }),
        )
        .filter((p) => gridHasContent(p.grid)),
    [libraryPlans],
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedId(null)
    setTab(templates.length ? 'template' : 'patient')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open])

  // Planes activos de los otros pacientes (versiones, y si no tienen, el plan guardado del sistema anterior).
  useEffect(() => {
    if (!open || patientPlans) return
    let alive = true
    void (async () => {
      const [versions, schedules] = await Promise.all([
        supabase
          .from('nutrition_patient_plan_versions')
          .select('id, student_id, merge_weekends, grid, updated_at')
          .eq('owner_id', ownerId)
          .eq('is_active', true)
          .limit(500),
        supabase.from('nutrition_week_schedules').select('id, student_id, merge_weekends, grid, updated_at').eq('owner_id', ownerId).limit(500),
      ])
      type Row = { id: string; student_id: string; merge_weekends: boolean; grid: unknown; updated_at: string }
      const byStudent = new Map<string, Row>()
      for (const r of ((versions.data as Row[] | null) ?? [])) {
        const prev = byStudent.get(r.student_id)
        if (!prev || r.updated_at > prev.updated_at) byStudent.set(r.student_id, r)
      }
      for (const r of ((schedules.data as Row[] | null) ?? [])) if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, r)
      byStudent.delete(studentId)
      const ids = [...byStudent.keys()]
      const names = new Map<string, string>()
      if (ids.length) {
        const { data } = await supabase.from('students').select('id, full_name').in('id', ids)
        for (const s of (data as { id: string; full_name: string }[] | null) ?? []) names.set(s.id, s.full_name)
      }
      const list = [...byStudent.values()]
        .filter((r) => names.has(r.student_id))
        .map((r) =>
          toReusablePlan({
            id: r.id,
            source: 'patient',
            name: names.get(r.student_id)!,
            subtitle: `Actualizado ${ago(r.updated_at)}`,
            merge_weekends: r.merge_weekends,
            grid: r.grid,
            updated_at: r.updated_at,
          }),
        )
        .filter((p) => gridHasContent(p.grid))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      if (alive) setPatientPlans(list)
    })()
    return () => {
      alive = false
    }
  }, [open, patientPlans, ownerId, studentId])

  const source = tab === 'template' ? templates : patientPlans ?? []
  const shown = source.filter((p) => matchesPlanQuery(p, query))
  const selected = shown.find((p) => p.id === selectedId) ?? null
  const loadingPatients = tab === 'patient' && patientPlans === null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      size="xl"
      layerClassName={LAYER}
      title="Usar otro plan como base"
      description="Se copia acá y lo adaptás. El plan actual queda guardado como versión anterior."
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy} className="ml-auto">
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={!selected} loading={busy} onClick={() => selected && onPick(selected)}>
            Usar este plan
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-surface-elevated p-0.5" role="tablist">
          {(
            [
              ['template', `Plantillas (${templates.length})`],
              ['patient', patientPlans ? `Otros pacientes (${patientPlans.length})` : 'Otros pacientes'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k)
                setSelectedId(null)
              }}
              className={cn(
                'h-8 rounded-[10px] px-3 text-[13px] font-medium transition-colors',
                tab === k ? 'bg-surface-card text-ink-primary shadow-sm' : 'text-ink-muted hover:text-ink-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'template' ? 'Buscar por nombre, objetivo o comida' : 'Buscar por paciente o comida'}
            className={cn(controlInputClassName, 'pl-9')}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ul className="max-h-[22rem] min-h-[8rem] space-y-1 overflow-y-auto pr-1" aria-label="Planes">
          {loadingPatients ? <li className="px-2 py-3 text-[13px] text-ink-muted">Buscando planes…</li> : null}
          {!loadingPatients && !shown.length ? (
            <li className="px-2 py-3 text-[13px] leading-relaxed text-ink-muted">
              {query
                ? 'Nada coincide con la búsqueda.'
                : tab === 'template'
                  ? 'Todavía no tenés plantillas. Desde el plan de un paciente, en «⋯», podés guardarlo como plantilla.'
                  : 'Ningún otro paciente tiene un plan cargado.'}
            </li>
          ) : null}
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                onDoubleClick={() => !busy && onPick(p)}
                aria-pressed={p.id === selected?.id}
                className={cn(
                  'flex w-full min-w-0 flex-col rounded-lg px-2.5 py-2 text-left transition-colors',
                  p.id === selected?.id ? 'bg-surface-elevated ring-1 ring-inset ring-ink-primary/30' : 'hover:bg-surface-elevated/60',
                )}
              >
                <span className="truncate text-[13.5px] font-medium text-ink-primary">{p.name}</span>
                <span className="truncate text-[12px] text-ink-muted">
                  {p.subtitle ?? `${p.grid.mealRows.length} comidas`}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-h-[8rem] rounded-xl bg-surface-elevated/60 p-3.5">
          {selected ? (
            <PlanPreview plan={selected} />
          ) : (
            <p className="text-[13px] text-ink-muted">Elegí un plan de la lista para verlo.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function PlanPreview({ plan }: { plan: ReusablePlan }) {
  const lines = planPreviewLines(plan.grid, 8)
  return (
    <div>
      <p className="text-[13.5px] font-semibold text-ink-primary">{plan.name}</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">
        {plan.grid.mealRows.length} comidas · {plan.mergeWeekends ? 'lunes a viernes y finde' : '7 días'}
      </p>
      <dl className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-[11.5px] font-semibold text-ink-secondary">{l.label}</dt>
            <dd className="line-clamp-2 text-[12.5px] leading-snug text-ink-primary">{l.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** v2: guardar el plan del paciente en la biblioteca para usarlo con otros. */
export function SaveAsTemplateDialog({
  open,
  ownerId,
  grid,
  mergeWeekends,
  onSaved,
  onClose,
}: {
  open: boolean
  ownerId: string
  grid: WeeklyPlanGridJson
  mergeWeekends: boolean
  onSaved: (row: NutritionPlanLibrary) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setObjective('')
    }
  }, [open])

  async function save() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    const { data, error } = await supabase
      .from('nutrition_plan_library')
      .insert({
        owner_id: ownerId,
        name: n,
        objective: objective.trim() || null,
        notes: null,
        tags: [],
        merge_weekends: mergeWeekends,
        grid: grid as unknown as Record<string, unknown>,
      })
      .select('*')
      .single()
    setBusy(false)
    if (error || !data) {
      toast.error(error?.message ?? 'No se pudo guardar la plantilla')
      return
    }
    toast.success('Guardado en tus plantillas')
    onSaved(data as NutritionPlanLibrary)
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      layerClassName={LAYER}
      title="Guardar como plantilla"
      description="Queda en tu biblioteca para usarlo con otros pacientes. Los cambios que hagas después acá no la modifican."
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy} className="ml-auto">
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={!name.trim()} loading={busy} onClick={() => void save()}>
            Guardar plantilla
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block text-xs text-ink-secondary">
          Nombre
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Descenso 1800 kcal"
            className={cn(controlInputClassName, 'mt-1')}
          />
        </label>
        <label className="block text-xs text-ink-secondary">
          Objetivo (opcional)
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ej: pérdida de grasa, sin lácteos"
            className={cn(controlInputClassName, 'mt-1')}
          />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
