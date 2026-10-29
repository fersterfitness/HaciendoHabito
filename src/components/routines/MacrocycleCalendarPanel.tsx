import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GripVertical,
  History,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { controlSmClassName } from '@/lib/formControlClasses'
import {
  assignLanes,
  BLOCK_COLOR_PRESETS,
  BLOCK_TYPES,
  blockColor,
  blockTypeLabel,
  dayOffset,
  durationWeeks,
  fmtShort,
  overlappingIds,
  shiftYmd,
  weekStartDates,
  yearWeeks,
  ymd,
} from '@/lib/macrocycle/macrocycle'
import {
  deletePlanBlock,
  duplicateRoutineAt,
  loadDeletedRoutines,
  loadMacrocycle,
  loadPlanBlocks,
  moveRoutine,
  PLAN_SQL_HINT,
  savePlanBlock,
  updateRoutineCalendarMeta,
  type DeletedRoutine,
  type MacroRoutine,
  type PlanBlock,
} from '@/lib/macrocycle/macrocycleData'
import { computeWeekVolume, overloadedMuscles, VOLUME_MUSCLES, type MuscleId } from '@/lib/volume/trainingVolume'
import { FACTORY_PROFILE, loadVolumeData } from '@/lib/volume/volumeData'

const CW = 30
const DAY_W = CW / 7
const LABEL_W = 34
const LANE_H = 36
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HISTORY_COLOR = '#94a3b8'

type WeekAlert = { weekId: string; weekName: string; start: string; muscles: { id: MuscleId; value: number }[] }

type Item =
  | { kind: 'plan'; id: string; title: string; start: string; end: string; type: string | null; color: string; plan: PlanBlock }
  | { kind: 'routine'; id: string; title: string; start: string; end: string; type: string | null; color: string; routine: MacroRoutine; faded: boolean }
  | { kind: 'deleted'; id: string; title: string; start: string; end: string; type: null; color: string; deleted: DeletedRoutine }

type Draft = {
  id?: string
  title: string
  block_type: string | null
  color: string | null
  start_date: string
  end_date: string
  notes: string
}

type Drag = { id: string; mode: 'move' | 'start' | 'end'; x0: number; dx: number; copy: boolean }

type Props = {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
  /** Se llama tras mover/copiar/editar rutinas para refrescar la pantalla de origen. */
  onChanged?: () => void
}

function hexAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const minYmd = (a: string, b: string) => (a < b ? a : b)
const maxYmd = (a: string, b: string) => (a > b ? a : b)

function fmtLong(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

// ─── Editor de bloque propio ────────────────────────────────────────────────

function PlanEditor({
  draft,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onCopyNext,
}: {
  draft: Draft
  saving: boolean
  onChange: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  onCopyNext?: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = blockColor(draft.block_type, draft.color)
  const days = dayOffset(minYmd(draft.start_date, draft.end_date), maxYmd(draft.start_date, draft.end_date)) + 1
  return (
    <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-2xs font-bold uppercase tracking-wider text-brand-primary">{draft.id ? 'Bloque del macrociclo' : 'Nuevo bloque'}</p>
          <p className="text-xs text-ink-muted">
            {fmtShort(minYmd(draft.start_date, draft.end_date))} → {fmtShort(maxYmd(draft.start_date, draft.end_date))} · {days} día{days === 1 ? '' : 's'}
            {days >= 7 ? ` (${durationWeeks(draft.start_date, draft.end_date)} sem.)` : ''}
          </p>
        </div>
        <span className="h-3 w-10 rounded" style={{ background: color }} />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr_1.4fr]">
        <div className="space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-ink-secondary">Título</span>
            <input
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              placeholder="Ej. Bloque de intensificación I"
              className={cn(controlSmClassName, 'w-full')}
              autoFocus={!draft.id}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-semibold text-ink-secondary">Desde</span>
              <input type="date" value={draft.start_date} onChange={(e) => e.target.value && onChange({ ...draft, start_date: e.target.value })} className={cn(controlSmClassName, 'w-full')} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-semibold text-ink-secondary">Hasta</span>
              <input type="date" value={draft.end_date} onChange={(e) => e.target.value && onChange({ ...draft, end_date: e.target.value })} className={cn(controlSmClassName, 'w-full')} />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold text-ink-secondary">Tipo de bloque</span>
            <select
              value={draft.block_type ?? ''}
              onChange={(e) => onChange({ ...draft, block_type: e.target.value || null })}
              className={cn(controlSmClassName, 'w-full')}
            >
              <option value="">Sin tipo</option>
              {BLOCK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...draft, color: c })}
                className={cn('h-6 w-6 rounded-md border border-black/10 transition-transform hover:scale-110', color === c && 'ring-2 ring-ink-primary ring-offset-1 ring-offset-surface-card')}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <button type="button" onClick={() => onChange({ ...draft, color: null })} className="h-6 rounded-md border border-surface-border px-1.5 text-3xs text-ink-muted hover:text-ink-primary">
              Del tipo
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold text-ink-secondary">Anotaciones</span>
          <textarea
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            rows={4}
            placeholder="Objetivo del bloque, protocolos, competencias, ideas para la progresión…"
            className={cn(controlSmClassName, 'h-auto w-full resize-y py-2 leading-snug')}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {onDelete ? (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-xs text-ink-secondary">
                ¿Eliminar este bloque?
                <Button type="button" size="sm" variant="danger" onClick={onDelete} disabled={saving}>
                  Sí, eliminar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )
          ) : null}
          {onCopyNext ? (
            <Button type="button" size="sm" variant="secondary" onClick={onCopyNext} disabled={saving}>
              <Copy className="h-3.5 w-3.5" /> Copiar a continuación
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {draft.id ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button type="button" size="sm" loading={saving} onClick={onSave}>
            {draft.id ? 'Guardar cambios' : 'Crear bloque'}
          </Button>
        </div>
      </div>
    </section>
  )
}

// ─── Panel ──────────────────────────────────────────────────────────────────

/**
 * Calendario anual del macrociclo (solo entrenador). Arriba, los bloques que marca el entrenador
 * (días o semanas con tipo, título y notas); abajo, las rutinas del alumno. Nada se borra solo:
 * las rutinas eliminadas quedan como historial.
 */
export function MacrocycleCalendarPanel({ open, onClose, studentId, studentName, onChanged }: Props) {
  const { user } = useAuthStore()
  const navigate = useAppNavigate()
  const today = ymd(new Date())
  const [year, setYear] = useState(new Date().getFullYear())
  const [routines, setRoutines] = useState<MacroRoutine[] | null>(null)
  const [plans, setPlans] = useState<PlanBlock[]>([])
  const [plansReady, setPlansReady] = useState(true)
  const [deleted, setDeleted] = useState<DeletedRoutine[]>([])
  const [alerts, setAlerts] = useState<Map<string, WeekAlert[]>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [range, setRangeState] = useState<{ anchor: string; current: string } | null>(null)
  const rangeRef = useRef<{ anchor: string; current: string } | null>(null)
  const setRange = (r: { anchor: string; current: string } | null) => {
    rangeRef.current = r
    setRangeState(r)
  }
  const [dragMode, setDragMode] = useState<'move' | 'copy'>('move')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [busy, setBusy] = useState(false)
  const selectingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    try {
      const [list, volume, planRes, deletedList] = await Promise.all([
        loadMacrocycle(studentId),
        loadVolumeData(),
        loadPlanBlocks(studentId),
        user ? loadDeletedRoutines(user.id, studentId) : Promise.resolve([]),
      ])
      setRoutines(list)
      setPlans(planRes.blocks)
      setPlansReady(planRes.ready)
      setDeleted(deletedList)
      const profile = volume.profiles.find((p) => p.is_default) ?? volume.profiles[0] ?? FACTORY_PROFILE
      const ctx = { settings: profile.settings, factorOverrides: volume.factorOverrides, methodNames: volume.methodNames }
      const next = new Map<string, WeekAlert[]>()
      for (const r of list) {
        const starts = weekStartDates(r.start_date, r.weeks)
        const items: WeekAlert[] = []
        r.weeks.forEach((w, i) => {
          const vol = computeWeekVolume(w.days, ctx)
          const over = overloadedMuscles(vol, profile.settings)
          if (over.length) {
            items.push({
              weekId: w.id,
              weekName: w.name?.trim() || `Semana ${i + 1}`,
              start: starts.get(w.id) ?? r.start_date,
              muscles: over.map((id) => ({ id, value: vol.weighted[id] })),
            })
          }
        })
        if (items.length) next.set(r.id, items)
      }
      setAlerts(next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el calendario')
      setRoutines([])
    }
  }, [studentId, user])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  const weeks = useMemo(() => yearWeeks(year), [year])
  const gridStart = weeks[0]!.start
  const gridEnd = weeks[weeks.length - 1]!.days[6]!

  const planItems: Item[] = useMemo(
    () =>
      plans.map((p) => ({
        kind: 'plan' as const,
        id: p.id,
        title: p.title,
        start: p.start_date,
        end: p.end_date,
        type: p.block_type,
        color: blockColor(p.block_type, p.color),
        plan: p,
      })),
    [plans],
  )
  const routineItems: Item[] = useMemo(
    () => [
      ...(routines ?? [])
        .filter((r) => r.start_date && r.end_date)
        .map((r) => ({
          kind: 'routine' as const,
          id: r.id,
          title: r.name,
          start: r.start_date,
          end: r.end_date < r.start_date ? r.start_date : r.end_date,
          type: r.block_type ?? null,
          color: blockColor(r.block_type, r.calendar_color),
          routine: r,
          faded: r.status === 'cancelada',
        })),
      ...deleted.map((d) => ({
        kind: 'deleted' as const,
        id: d.id,
        title: d.name,
        start: d.start_date,
        end: d.end_date,
        type: null,
        color: HISTORY_COLOR,
        deleted: d,
      })),
    ],
    [routines, deleted],
  )
  const allItems = useMemo(() => [...planItems, ...routineItems], [planItems, routineItems])
  const inView = (i: Item) => i.end >= gridStart && i.start <= gridEnd
  const visiblePlans = planItems.filter(inView)
  const visibleRoutines = routineItems.filter(inView)
  const planLanes = useMemo(() => assignLanes(visiblePlans), [visiblePlans])
  const routineLanes = useMemo(() => assignLanes(visibleRoutines), [visibleRoutines])
  const planLaneCount = Math.max(1, ...[...planLanes.values()].map((l) => l + 1))
  const routineLaneCount = Math.max(1, ...[...routineLanes.values()].map((l) => l + 1))
  const overlaps = useMemo(() => overlappingIds(routineItems.filter((i) => i.kind === 'routine')), [routineItems])

  /** Día → color: primero los bloques propios (fuerte), si no la rutina (suave). */
  const coverage = useMemo(() => {
    const map = new Map<string, { color: string; id: string; alpha: number }>()
    const paint = (items: Item[], alpha: number) => {
      for (const b of [...items].sort((a, c) => a.start.localeCompare(c.start))) {
        if (b.kind === 'deleted') continue
        const len = dayOffset(b.start, b.end)
        for (let i = 0; i <= len; i++) {
          const d = shiftYmd(b.start, i)!
          if (!map.has(d)) map.set(d, { color: b.color, id: b.id, alpha })
        }
      }
    }
    paint(planItems, 0.5)
    paint(routineItems, 0.22)
    return map
  }, [planItems, routineItems])

  const alertDays = useMemo(() => {
    const set = new Set<string>()
    for (const items of alerts.values()) for (const a of items) for (let i = 0; i < 7; i++) set.add(shiftYmd(a.start, i)!)
    return set
  }, [alerts])

  // Al abrir, centrar en el mes actual.
  useEffect(() => {
    if (!open || !routines || !scrollRef.current) return
    const idx = weeks.findIndex((w) => w.days.includes(today))
    if (idx > 3) scrollRef.current.scrollLeft = (idx - 3) * CW
  }, [open, routines, weeks, today])

  // Selección de días: terminar el arrastre aunque se suelte fuera de la grilla.
  useEffect(() => {
    if (!open) return
    const up = () => {
      if (!selectingRef.current) return
      selectingRef.current = false
      const r = rangeRef.current
      if (!r) return
      const start = minYmd(r.anchor, r.current)
      const end = maxYmd(r.anchor, r.current)
      // Un toque sobre un bloque propio lo abre; si no, se arma un bloque nuevo con los días marcados.
      const plan = start === end ? plans.find((p) => p.start_date <= start && p.end_date >= start) : undefined
      if (plan) {
        openPlan(plan)
        return
      }
      setSelectedId(null)
      setDraft({ title: '', block_type: null, color: null, start_date: start, end_date: end, notes: '' })
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plans])

  function openPlan(p: PlanBlock) {
    setRange(null)
    setSelectedId(p.id)
    setDraft({ id: p.id, title: p.title, block_type: p.block_type, color: p.color, start_date: p.start_date, end_date: p.end_date, notes: p.notes ?? '' })
  }

  function selectItem(item: Item) {
    if (item.kind === 'plan') {
      openPlan(item.plan)
      return
    }
    setDraft(null)
    setRange(null)
    setSelectedId(item.id)
  }

  function startRange(day: string, e: ReactPointerEvent) {
    if (busy) return
    if (e.shiftKey && draft && !draft.id) {
      setDraft({ ...draft, start_date: minYmd(draft.start_date, day), end_date: maxYmd(draft.end_date, day) })
      setRange({ anchor: minYmd(draft.start_date, day), current: maxYmd(draft.end_date, day) })
      return
    }
    selectingRef.current = true
    setRange({ anchor: day, current: day })
  }

  function onGridPointerMove(e: ReactPointerEvent) {
    if (!selectingRef.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day]') as HTMLElement | null
    const day = el?.dataset.day
    const r = rangeRef.current
    if (day && r && r.current !== day) setRange({ ...r, current: day })
  }

  function selectWeek(weekStart: string, shift: boolean) {
    const end = shiftYmd(weekStart, 6)!
    if (shift && draft && !draft.id) {
      const s = minYmd(draft.start_date, weekStart)
      const e2 = maxYmd(draft.end_date, end)
      setDraft({ ...draft, start_date: s, end_date: e2 })
      setRange({ anchor: s, current: e2 })
      return
    }
    setSelectedId(null)
    setRange({ anchor: weekStart, current: end })
    setDraft({ title: '', block_type: null, color: null, start_date: weekStart, end_date: end, notes: '' })
  }

  const rangeStart = range ? minYmd(range.anchor, range.current) : null
  const rangeEnd = range ? maxYmd(range.anchor, range.current) : null
  const draftStart = draft ? minYmd(draft.start_date, draft.end_date) : null
  const draftEnd = draft ? maxYmd(draft.start_date, draft.end_date) : null
  const inSelection = (d: string) =>
    (rangeStart != null && d >= rangeStart && d <= rangeEnd!) || (draft != null && !draft.id && d >= draftStart! && d <= draftEnd!)

  async function saveDraft() {
    if (!draft) return
    if (!draft.title.trim()) {
      toast.error('Poné un título al bloque')
      return
    }
    setBusy(true)
    const { id, error } = await savePlanBlock({ ...draft, student_id: studentId })
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(draft.id ? 'Bloque guardado' : 'Bloque creado')
    setRange(null)
    await reload()
    if (id) setSelectedId(id)
    setDraft((d) => (d ? { ...d, id: id ?? d.id } : d))
  }

  async function removePlan(id: string) {
    setBusy(true)
    const err = await deletePlanBlock(id)
    setBusy(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success('Bloque eliminado')
    setDraft(null)
    setSelectedId(null)
    await reload()
  }

  async function copyPlan(p: PlanBlock, newStart: string) {
    const len = dayOffset(p.start_date, p.end_date)
    setBusy(true)
    const { id, error } = await savePlanBlock({
      student_id: studentId,
      title: p.title,
      block_type: p.block_type,
      color: p.color,
      start_date: newStart,
      end_date: shiftYmd(newStart, len)!,
      notes: p.notes,
    })
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Bloque copiado')
    await reload()
    const fresh = await loadPlanBlocks(studentId)
    const created = fresh.blocks.find((b) => b.id === id)
    if (created) openPlan(created)
  }

  async function movePlan(p: PlanBlock, startDelta: number, endDelta: number) {
    const start = shiftYmd(p.start_date, startDelta)!
    const end = shiftYmd(p.end_date, endDelta)!
    if (end < start) return
    setBusy(true)
    const { error } = await savePlanBlock({ ...p, start_date: start, end_date: end })
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    await reload()
    if (draft?.id === p.id) setDraft({ ...draft, start_date: start, end_date: end })
  }

  async function doMove(routine: MacroRoutine, days: number) {
    if (!days) return
    setBusy(true)
    const err = await moveRoutine(routine, days)
    setBusy(false)
    if (err) {
      toast.error(err)
      return
    }
    await reload()
    onChanged?.()
    const moved = `${fmtShort(shiftYmd(routine.start_date, days)!)} → ${fmtShort(shiftYmd(routine.end_date, days)!)}`
    toast(
      (t) => (
        <span className="flex items-center gap-3 text-sm">
          «{routine.name}» ahora va {moved}
          <button
            type="button"
            className="rounded-lg bg-surface-elevated px-2 py-1 text-xs font-semibold text-brand-primary"
            onClick={async () => {
              toast.dismiss(t.id)
              const fresh = (await loadMacrocycle(studentId)).find((r) => r.id === routine.id)
              if (!fresh) return
              const e2 = await moveRoutine(fresh, -days)
              if (e2) toast.error(e2)
              await reload()
              onChanged?.()
            }}
          >
            Deshacer
          </button>
        </span>
      ),
      { duration: 6000 },
    )
  }

  async function doCopy(routine: MacroRoutine, newStart: string) {
    if (!user) return
    setBusy(true)
    const loading = toast.loading('Copiando bloque…')
    const { id, error } = await duplicateRoutineAt(routine, newStart, user.id)
    setBusy(false)
    if (error) toast.error(error, { id: loading })
    else toast.success('Rutina copiada. Ajustá la progresión a mano.', { id: loading })
    await reload()
    onChanged?.()
    if (id) setSelectedId(id)
  }

  async function patchMeta(routineId: string, patch: { block_type?: string | null; calendar_color?: string | null; name?: string }) {
    const err = await updateRoutineCalendarMeta(routineId, patch)
    if (err) {
      toast.error(err)
      return
    }
    setRoutines((prev) => prev?.map((r) => (r.id === routineId ? { ...r, ...patch } : r)) ?? prev)
    onChanged?.()
  }

  // ─── Arrastre de barras ───────────────────────────────────────────────────

  function onBarPointerDown(e: ReactPointerEvent<HTMLElement>, item: Item, mode: Drag['mode']) {
    if (busy || item.kind === 'deleted') return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id: item.id, mode, x0: e.clientX, dx: 0, copy: mode === 'move' && (dragMode === 'copy' || e.altKey || e.ctrlKey) })
  }

  function onBarPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (!drag) return
    setDrag({ ...drag, dx: e.clientX - drag.x0, copy: drag.copy || (drag.mode === 'move' && (e.altKey || e.ctrlKey)) })
  }

  function onBarPointerUp(e: ReactPointerEvent<HTMLElement>, item: Item) {
    if (!drag) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const d = drag
    setDrag(null)
    if (Math.abs(d.dx) < 5) {
      selectItem(item)
      return
    }
    if (d.mode !== 'move') {
      if (item.kind !== 'plan') return
      const days = Math.round(d.dx / DAY_W)
      if (!days) return
      void movePlan(item.plan, d.mode === 'start' ? days : 0, d.mode === 'end' ? days : 0)
      return
    }
    const weeksMoved = Math.round(d.dx / CW)
    if (!weeksMoved) {
      selectItem(item)
      return
    }
    const newStart = shiftYmd(item.start, weeksMoved * 7)!
    if (item.kind === 'plan') {
      if (d.copy) void copyPlan(item.plan, newStart)
      else void movePlan(item.plan, weeksMoved * 7, weeksMoved * 7)
    } else if (item.kind === 'routine') {
      if (d.copy) void doCopy(item.routine, newStart)
      else void doMove(item.routine, weeksMoved * 7)
    }
  }

  if (!open) return null

  const monthGroups: { month: number; count: number }[] = []
  for (const w of weeks) {
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.month === w.month && w.year === year) last.count += 1
    else monthGroups.push({ month: w.year === year ? w.month : -1, count: 1 })
  }

  const gridWidth = LABEL_W + weeks.length * CW
  const selected = allItems.find((i) => i.id === selectedId) ?? null
  const sortedRoutines = routineItems.filter((i) => i.kind === 'routine').sort((a, b) => a.start.localeCompare(b.start))
  const selectedRoutineIdx = selected?.kind === 'routine' ? sortedRoutines.findIndex((r) => r.id === selected.id) : -1
  const selectedAlerts = selected ? (alerts.get(selected.id) ?? []) : []
  const history = [...allItems].sort((a, b) => b.start.localeCompare(a.start))

  const renderBar = (item: Item, lane: number) => {
    const left = LABEL_W + (dayOffset(gridStart, item.start) / 7) * CW
    const width = ((dayOffset(item.start, item.end) + 1) / 7) * CW
    const isDrag = drag?.id === item.id
    let offset = 0
    let grow = 0
    if (isDrag && drag.mode === 'move') offset = Math.round(drag.dx / CW) * CW
    if (isDrag && drag.mode === 'start') {
      const dd = Math.round(drag.dx / DAY_W) * DAY_W
      offset = dd
      grow = -dd
    }
    if (isDrag && drag.mode === 'end') grow = Math.round(drag.dx / DAY_W) * DAY_W
    const visLeft = Math.max(LABEL_W, left)
    const visWidth = Math.max(10, width - Math.max(0, LABEL_W - left) + grow)
    const blockAlerts = item.kind === 'routine' ? alerts.get(item.id) : undefined
    const label = blockTypeLabel(item.type)
    const hasNotes = item.kind === 'plan' && !!item.plan.notes?.trim()
    const ghost = isDrag && drag.copy && offset !== 0
    const isDeleted = item.kind === 'deleted'
    const faded = isDeleted || (item.kind === 'routine' && item.faded)
    const tip = [
      item.title,
      `${fmtShort(item.start)} → ${fmtShort(item.end)}`,
      label,
      isDeleted ? 'Rutina eliminada (historial)' : null,
      item.kind === 'plan' ? item.plan.notes : null,
    ]
      .filter(Boolean)
      .join('\n')
    return (
      <div key={item.id}>
        {ghost ? (
          <div
            className="pointer-events-none absolute rounded-lg opacity-30"
            style={{ left: visLeft, width: visWidth, top: lane * LANE_H + 4, height: LANE_H - 8, background: item.color }}
          />
        ) : null}
        <div
          role="button"
          tabIndex={0}
          title={tip}
          aria-label={`${item.title}, ${fmtShort(item.start)} a ${fmtShort(item.end)}`}
          onPointerDown={(e) => onBarPointerDown(e, item, 'move')}
          onPointerMove={onBarPointerMove}
          onPointerUp={(e) => (isDeleted ? selectItem(item) : onBarPointerUp(e, item))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') selectItem(item)
          }}
          className={cn(
            'group absolute flex touch-none items-center gap-1 overflow-hidden rounded-lg border px-1.5 text-2xs font-semibold shadow-xs transition-shadow',
            isDeleted ? 'cursor-pointer border-dashed text-ink-muted' : 'cursor-grab text-zinc-900 active:cursor-grabbing',
            faded && 'opacity-55',
            selectedId === item.id && 'ring-2 ring-brand-primary ring-offset-1 ring-offset-surface-card',
            isDrag && 'z-10 shadow-pop',
          )}
          style={{
            left: visLeft + offset,
            width: visWidth,
            top: lane * LANE_H + 4,
            height: LANE_H - 8,
            background: isDeleted ? hexAlpha(item.color, 0.18) : item.color,
            borderColor: isDeleted ? item.color : hexAlpha('#000000', 0.12),
          }}
        >
          {item.kind === 'plan' ? (
            <span
              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: hexAlpha('#000000', 0.25) }}
              onPointerDown={(e) => onBarPointerDown(e, item, 'start')}
              aria-hidden
            />
          ) : null}
          {isDeleted ? <History className="h-3 w-3 shrink-0" aria-hidden /> : <GripVertical className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
          <span className="truncate">{item.title}</span>
          {label ? <span className="hidden shrink-0 rounded bg-black/10 px-1 text-3xs font-medium sm:inline">{label}</span> : null}
          {hasNotes ? <StickyNote className="h-3 w-3 shrink-0 opacity-70" aria-label="Tiene anotaciones" /> : null}
          {blockAlerts ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-700" aria-label="Volumen por encima del rango" /> : null}
          {overlaps.has(item.id) ? <span className="shrink-0 rounded bg-black/15 px-1 text-3xs">se pisa</span> : null}
          {item.kind === 'plan' ? (
            <span
              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: hexAlpha('#000000', 0.25) }}
              onPointerDown={(e) => onBarPointerDown(e, item, 'end')}
              aria-hidden
            />
          ) : null}
        </div>
        {isDrag && (offset || grow) ? (
          <div
            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-ink-primary px-1.5 py-0.5 text-3xs font-semibold text-surface-card"
            style={{ left: visLeft + offset, top: lane * LANE_H - 14 }}
          >
            {drag.mode === 'move'
              ? `${drag.copy ? 'Copiar' : 'Mover'}: ${fmtShort(shiftYmd(item.start, (offset / CW) * 7)!)} → ${fmtShort(shiftYmd(item.end, (offset / CW) * 7)!)}`
              : drag.mode === 'start'
                ? `Desde ${fmtShort(shiftYmd(item.start, Math.round(drag.dx / DAY_W))!)}`
                : `Hasta ${fmtShort(shiftYmd(item.end, Math.round(drag.dx / DAY_W))!)}`}
          </div>
        ) : null}
      </div>
    )
  }

  const laneLabel = (text: string) => (
    <div className="sticky left-0 z-10 flex items-center gap-2 bg-surface-card px-2 pt-2 text-3xs font-bold uppercase tracking-wider text-ink-muted" style={{ width: 'max-content' }}>
      {text}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal aria-labelledby="macro-title">
      <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-base shadow-pop">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-3xs font-semibold uppercase tracking-wider text-brand-primary">Solo entrenador · el alumno no lo ve</p>
            <h2 id="macro-title" className="flex items-center gap-2 truncate text-base font-bold text-ink-primary">
              <CalendarRange className="h-4 w-4 text-brand-primary" />
              Macrociclo {year} — {studentName}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Arrastrá sobre los días (o tocá el número de semana) para marcar un bloque con su tipo, título y notas. Las barras se mueven, se estiran y se copian.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-surface-border bg-surface-elevated/60">
              <button type="button" onClick={() => setYear((y) => y - 1)} className="p-2 text-ink-muted hover:text-ink-primary" aria-label="Año anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-ink-primary">{year}</span>
              <button type="button" onClick={() => setYear((y) => y + 1)} className="p-2 text-ink-muted hover:text-ink-primary" aria-label="Año siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const start = today
                setSelectedId(null)
                setRange(null)
                setDraft({ title: '', block_type: null, color: null, start_date: start, end_date: shiftYmd(start, 27)!, notes: '' })
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Nuevo bloque
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/routines/new?student=${studentId}`)}>
              Nueva rutina
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border p-2 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
              aria-label="Cerrar calendario"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 sm:p-4">
          {!routines ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {!plansReady ? (
                <div className="hh-alert hh-alert-warning flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-ink-secondary">
                  <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span>{PLAN_SQL_HINT}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {BLOCK_TYPES.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Volumen por encima del rango
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs text-ink-muted">
                  Arrastrar barras para
                  <SegmentedControl
                    size="sm"
                    items={[
                      { id: 'move', label: 'Mover' },
                      { id: 'copy', label: 'Copiar' },
                    ]}
                    value={dragMode}
                    onChange={(v) => setDragMode(v as 'move' | 'copy')}
                  />
                </div>
              </div>

              <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-surface-border/90 bg-surface-card shadow-card">
                <div style={{ width: gridWidth }} className="select-none pb-2" onPointerMove={onGridPointerMove}>
                  {/* Meses */}
                  <div className="flex border-b border-surface-border/70">
                    <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 bg-surface-card" />
                    {monthGroups.map((g, i) => (
                      <div
                        key={i}
                        style={{ width: g.count * CW }}
                        className={cn(
                          'shrink-0 truncate border-l border-surface-border/70 px-1.5 py-1.5 text-2xs font-bold',
                          g.month < 0 ? 'text-ink-muted/40' : i % 2 ? 'bg-surface-elevated/50 text-ink-primary' : 'text-ink-primary',
                        )}
                      >
                        {g.month >= 0 ? MONTHS[g.month] : ''}
                      </div>
                    ))}
                  </div>
                  {/* Nº de semana: tocar = marcar la semana entera (Shift = sumar) */}
                  <div className="flex">
                    <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 bg-surface-card" />
                    {weeks.map((w) => {
                      const hasAlert = w.days.some((d) => alertDays.has(d))
                      return (
                        <button
                          key={w.start}
                          type="button"
                          style={{ width: CW }}
                          onClick={(e) => selectWeek(w.start, e.shiftKey)}
                          className={cn(
                            'shrink-0 rounded-md py-1 text-center text-3xs tabular-nums transition-colors hover:bg-brand-primary/15 hover:text-brand-primary',
                            hasAlert ? 'font-bold text-rose-500' : 'text-ink-muted',
                          )}
                          title={`Marcar la semana ${w.isoWeek} (${fmtShort(w.days[0]!)} – ${fmtShort(w.days[6]!)})${hasAlert ? ' · volumen por encima del rango' : ''}`}
                        >
                          {w.isoWeek}
                        </button>
                      )
                    })}
                  </div>
                  {/* Días (L–D) */}
                  {WEEKDAYS.map((wd, row) => (
                    <div key={wd} className="flex">
                      <div style={{ width: LABEL_W }} className="sticky left-0 z-10 flex shrink-0 items-center justify-center bg-surface-card text-3xs font-semibold text-ink-muted">
                        {wd}
                      </div>
                      {weeks.map((w) => {
                        const d = w.days[row]!
                        const cov = coverage.get(d)
                        const inYear = d.startsWith(String(year))
                        const sel = inSelection(d)
                        return (
                          <div
                            key={d}
                            data-day={d}
                            onPointerDown={(e) => startRange(d, e)}
                            style={{
                              width: CW,
                              background: sel ? undefined : cov ? hexAlpha(cov.color, selectedId && cov.id === selectedId ? Math.min(0.75, cov.alpha + 0.25) : cov.alpha) : undefined,
                            }}
                            className={cn(
                              'relative flex h-6 shrink-0 cursor-cell items-center justify-center border-l border-t border-surface-border/40 text-3xs tabular-nums',
                              inYear ? 'text-ink-secondary' : 'text-ink-muted/30',
                              cov && 'font-semibold text-ink-primary',
                              sel && 'bg-brand-primary/35 font-bold text-ink-primary',
                              d === today && 'rounded-md ring-2 ring-inset ring-brand-primary',
                            )}
                          >
                            {Number(d.slice(8))}
                            {alertDays.has(d) && cov ? <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-rose-500" /> : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {laneLabel('Bloques del macrociclo')}
                  <div className="relative" style={{ height: planLaneCount * LANE_H + 2 }}>
                    {visiblePlans.length === 0 ? (
                      <p className="sticky left-0 px-3 pt-2 text-xs text-ink-muted" style={{ width: 'max-content' }}>
                        Arrastrá sobre los días para marcar el primer bloque de {year}.
                      </p>
                    ) : null}
                    {visiblePlans.map((i) => renderBar(i, planLanes.get(i.id) ?? 0))}
                  </div>

                  {laneLabel('Rutinas')}
                  <div className="relative" style={{ height: routineLaneCount * LANE_H + 2 }}>
                    {visibleRoutines.length === 0 ? (
                      <p className="sticky left-0 px-3 pt-2 text-xs text-ink-muted" style={{ width: 'max-content' }}>
                        Sin rutinas con fechas en {year}.
                      </p>
                    ) : null}
                    {visibleRoutines.map((i) => renderBar(i, routineLanes.get(i.id) ?? 0))}
                  </div>
                </div>
              </div>

              {draft ? (
                <PlanEditor
                  key={draft.id ?? 'new'}
                  draft={draft}
                  saving={busy}
                  onChange={(d) => {
                    setDraft(d)
                    if (!d.id) setRange({ anchor: d.start_date, current: d.end_date })
                  }}
                  onSave={() => void saveDraft()}
                  onCancel={() => {
                    setDraft(null)
                    setRange(null)
                    setSelectedId(null)
                  }}
                  onDelete={draft.id ? () => void removePlan(draft.id!) : undefined}
                  onCopyNext={
                    draft.id
                      ? () => {
                          const p = plans.find((x) => x.id === draft.id)
                          if (p) void copyPlan(p, shiftYmd(p.end_date, 1)!)
                        }
                      : undefined
                  }
                />
              ) : selected?.kind === 'routine' ? (
                <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Rutina</p>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded" style={{ background: selected.color }} />
                        <input
                          key={selected.id}
                          defaultValue={selected.title}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== selected.title) void patchMeta(selected.id, { name: v })
                          }}
                          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-base font-semibold text-ink-primary outline-none hover:bg-surface-elevated focus:bg-surface-elevated"
                          aria-label="Nombre de la rutina"
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {fmtShort(selected.start)} → {fmtShort(selected.end)} · {durationWeeks(selected.start, selected.end)} semanas ·{' '}
                        {selected.routine.weeks.length} cargadas · rutina {selectedRoutineIdx + 1} de {sortedRoutines.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" disabled={selectedRoutineIdx <= 0} onClick={() => setSelectedId(sortedRoutines[selectedRoutineIdx - 1]?.id ?? null)} title="Rutina anterior">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={selectedRoutineIdx >= sortedRoutines.length - 1} onClick={() => setSelectedId(sortedRoutines[selectedRoutineIdx + 1]?.id ?? null)} title="Rutina siguiente">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedId(null)} title="Cerrar">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
                    <div className="space-y-2">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Tipo y color</p>
                      <select
                        value={selected.type ?? ''}
                        onChange={(e) => void patchMeta(selected.id, { block_type: e.target.value || null })}
                        className={cn(controlSmClassName, 'w-full')}
                      >
                        <option value="">Sin tipo</option>
                        {BLOCK_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1.5">
                        {BLOCK_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => void patchMeta(selected.id, { calendar_color: c })}
                            className={cn('h-6 w-6 rounded-md border border-black/10 transition-transform hover:scale-110', selected.color === c && 'ring-2 ring-ink-primary ring-offset-1 ring-offset-surface-card')}
                            style={{ background: c }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => void patchMeta(selected.id, { calendar_color: null })}
                          className="h-6 rounded-md border border-surface-border px-1.5 text-3xs text-ink-muted hover:text-ink-primary"
                        >
                          Del tipo
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Mover y copiar</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void doMove(selected.routine, -7)}>
                          <ArrowLeft className="h-3.5 w-3.5" /> 1 semana
                        </Button>
                        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void doMove(selected.routine, 7)}>
                          1 semana <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={busy} onClick={() => void doCopy(selected.routine, shiftYmd(selected.end, 1)!)}>
                          <Copy className="h-3.5 w-3.5" /> Copiar como siguiente
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/routines/${selected.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir rutina
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Volumen semanal</p>
                      {selected.routine.weeks.length === 0 ? (
                        <p className="text-xs text-ink-muted">Sin semanas cargadas todavía.</p>
                      ) : selectedAlerts.length === 0 ? (
                        <p className="hh-alert hh-alert-success rounded-xl px-3 py-2 text-xs text-ink-secondary">Todas las semanas dentro del rango sostenible.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {selectedAlerts.map((a) => (
                            <li key={a.weekId} className="hh-alert hh-alert-danger rounded-xl px-3 py-2 text-xs text-ink-secondary">
                              <span className="font-semibold text-ink-primary">
                                {a.weekName} ({fmtShort(a.start)}):
                              </span>{' '}
                              {a.muscles.map((m) => `${VOLUME_MUSCLES.find((x) => x.id === m.id)?.label} ${String(m.value).replace('.', ',')}`).join(' · ')}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              ) : selected?.kind === 'deleted' ? (
                <section className="rounded-2xl border border-dashed border-surface-border bg-surface-card p-4 text-xs text-ink-secondary">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                    <History className="h-4 w-4 text-ink-muted" /> {selected.title}
                  </p>
                  <p className="mt-1">
                    {fmtLong(selected.start)} → {fmtLong(selected.end)} · rutina eliminada el {fmtLong(selected.deleted.deleted_at.slice(0, 10))}. Queda en el calendario como historial; se puede
                    restaurar desde Rutinas › Eliminadas.
                  </p>
                </section>
              ) : null}

              <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                  <History className="h-4 w-4 text-brand-primary" /> Historial del macrociclo
                </h3>
                <p className="mb-3 text-2xs text-ink-muted">Todo lo que se fue armando, del más reciente al más viejo. Tocá uno para verlo en el calendario.</p>
                {history.length === 0 ? (
                  <p className="text-xs text-ink-muted">Todavía no hay bloques ni rutinas con fechas.</p>
                ) : (
                  <ul className="divide-y divide-surface-border/60">
                    {history.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setYear(Number(i.start.slice(0, 4)))
                            selectItem(i)
                          }}
                          className={cn('flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-elevated/50', selectedId === i.id && 'bg-brand-primary/5')}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.color }} />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-primary">{i.title}</span>
                          <span className="hidden shrink-0 text-3xs text-ink-muted sm:inline">
                            {i.kind === 'plan' ? 'Bloque' : i.kind === 'deleted' ? 'Rutina eliminada' : 'Rutina'}
                            {blockTypeLabel(i.type) ? ` · ${blockTypeLabel(i.type)}` : ''}
                          </span>
                          <span className="shrink-0 text-3xs tabular-nums text-ink-muted">
                            {fmtLong(i.start)} → {fmtLong(i.end)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
