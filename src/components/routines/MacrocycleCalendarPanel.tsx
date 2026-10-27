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
  Plus,
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
  duplicateRoutineAt,
  loadMacrocycle,
  moveRoutine,
  updateRoutineCalendarMeta,
  type MacroRoutine,
} from '@/lib/macrocycle/macrocycleData'
import { computeWeekVolume, overloadedMuscles, VOLUME_MUSCLES, type MuscleId } from '@/lib/volume/trainingVolume'
import { FACTORY_PROFILE, loadVolumeData } from '@/lib/volume/volumeData'

const CW = 30
const LABEL_W = 34
const LANE_H = 36
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type WeekAlert = { weekId: string; weekName: string; start: string; muscles: { id: MuscleId; value: number }[] }

type Props = {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
  /** Se llama tras mover/copiar/editar para refrescar la ficha. */
  onChanged?: () => void
}

function hexAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Calendario anual del macrociclo del alumno (solo entrenador): bloques como barras sobre las semanas. */
export function MacrocycleCalendarPanel({ open, onClose, studentId, studentName, onChanged }: Props) {
  const { user } = useAuthStore()
  const navigate = useAppNavigate()
  const today = ymd(new Date())
  const [year, setYear] = useState(new Date().getFullYear())
  const [routines, setRoutines] = useState<MacroRoutine[] | null>(null)
  const [alerts, setAlerts] = useState<Map<string, WeekAlert[]>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragMode, setDragMode] = useState<'move' | 'copy'>('move')
  const [drag, setDrag] = useState<{ id: string; x0: number; dx: number; copy: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    try {
      const [list, volume] = await Promise.all([loadMacrocycle(studentId), loadVolumeData()])
      setRoutines(list)
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
  }, [studentId])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  const weeks = useMemo(() => yearWeeks(year), [year])
  const gridStart = weeks[0]!.start
  const gridEnd = weeks[weeks.length - 1]!.days[6]!

  const blocks = useMemo(
    () =>
      (routines ?? [])
        .filter((r) => r.start_date && r.end_date && r.status !== 'cancelada')
        .map((r) => ({
          id: r.id,
          name: r.name,
          start: r.start_date,
          end: r.end_date < r.start_date ? r.start_date : r.end_date,
          type: r.block_type ?? null,
          color: blockColor(r.block_type, r.calendar_color),
          routine: r,
        })),
    [routines],
  )
  const visible = blocks.filter((b) => b.end >= gridStart && b.start <= gridEnd)
  const lanes = useMemo(() => assignLanes(visible), [visible])
  const laneCount = Math.max(1, ...[...lanes.values()].map((l) => l + 1))
  const overlaps = useMemo(() => overlappingIds(blocks), [blocks])

  /** Día → bloque que lo cubre (el primero por fecha de inicio). */
  const coverage = useMemo(() => {
    const map = new Map<string, { color: string; id: string }>()
    for (const b of [...blocks].sort((a, c) => a.start.localeCompare(c.start))) {
      const len = dayOffset(b.start, b.end)
      for (let i = 0; i <= len; i++) {
        const d = shiftYmd(b.start, i)!
        if (!map.has(d)) map.set(d, { color: b.color, id: b.id })
      }
    }
    return map
  }, [blocks])

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

  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start))
  const selected = sorted.find((b) => b.id === selectedId) ?? null
  const selectedIdx = selected ? sorted.indexOf(selected) : -1

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
    if (error) {
      toast.error(error, { id: loading })
    } else {
      toast.success('Bloque copiado. Ajustá la progresión a mano.', { id: loading })
    }
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

  function onBarPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, x0: e.clientX, dx: 0, copy: dragMode === 'copy' || e.altKey || e.ctrlKey })
  }

  function onBarPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    setDrag({ ...drag, dx: e.clientX - drag.x0, copy: drag.copy || e.altKey || e.ctrlKey })
  }

  function onBarPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const weeksMoved = Math.round(drag.dx / CW)
    const block = blocks.find((b) => b.id === drag.id)
    setDrag(null)
    if (!block) return
    if (Math.abs(drag.dx) < 5 || weeksMoved === 0) {
      setSelectedId(block.id)
      return
    }
    if (drag.copy) void doCopy(block.routine, shiftYmd(block.start, weeksMoved * 7)!)
    else void doMove(block.routine, weeksMoved * 7)
  }

  if (!open) return null

  const monthGroups: { month: number; count: number }[] = []
  for (const w of weeks) {
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.month === w.month && w.year === year) last.count += 1
    else monthGroups.push({ month: w.year === year ? w.month : -1, count: 1 })
  }

  const gridWidth = LABEL_W + weeks.length * CW
  const selectedAlerts = selected ? (alerts.get(selected.id) ?? []) : []

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
              Cada rutina es un bloque. Arrastrá una barra para moverla (o copiarla como base del siguiente bloque). Tocála para ver el detalle.
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
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/routines/new?student=${studentId}`)}>
              <Plus className="h-3.5 w-3.5" /> Bloque desde cero
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {BLOCK_TYPES.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Semana con volumen por encima del rango
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs text-ink-muted">
                  Arrastrar para
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
                <div style={{ width: gridWidth }} className="select-none pb-2">
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
                  {/* Nº de semana */}
                  <div className="flex">
                    <div style={{ width: LABEL_W }} className="sticky left-0 z-10 shrink-0 bg-surface-card" />
                    {weeks.map((w) => {
                      const hasAlert = w.days.some((d) => alertDays.has(d))
                      return (
                        <div
                          key={w.start}
                          style={{ width: CW }}
                          className={cn('shrink-0 py-1 text-center text-3xs tabular-nums', hasAlert ? 'font-bold text-rose-500' : 'text-ink-muted')}
                          title={hasAlert ? 'Semana con volumen por encima del rango' : `Semana ${w.isoWeek}`}
                        >
                          {w.isoWeek}
                        </div>
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
                        const isToday = d === today
                        return (
                          <div
                            key={d}
                            style={{ width: CW, background: cov ? hexAlpha(cov.color, selectedId && cov.id === selectedId ? 0.55 : 0.32) : undefined }}
                            className={cn(
                              'relative flex h-6 shrink-0 items-center justify-center border-l border-t border-surface-border/40 text-3xs tabular-nums',
                              inYear ? 'text-ink-secondary' : 'text-ink-muted/30',
                              cov && 'font-semibold text-ink-primary',
                              isToday && 'rounded-md ring-2 ring-inset ring-brand-primary',
                            )}
                            onClick={cov ? () => setSelectedId(cov.id) : undefined}
                          >
                            {Number(d.slice(8))}
                            {alertDays.has(d) && cov ? <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-rose-500" /> : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Carriles con las barras de bloque */}
                  <div className="relative mt-2" style={{ height: laneCount * LANE_H + 4 }}>
                    {visible.length === 0 ? (
                      <p className="absolute left-3 top-2 text-xs text-ink-muted">Sin bloques en {year}. Creá una rutina con fechas para verla acá.</p>
                    ) : null}
                    {visible.map((b) => {
                      const lane = lanes.get(b.id) ?? 0
                      const left = LABEL_W + (dayOffset(gridStart, b.start) / 7) * CW
                      const width = ((dayOffset(b.start, b.end) + 1) / 7) * CW
                      const isDrag = drag?.id === b.id
                      const snapped = isDrag ? Math.round(drag.dx / CW) * CW : 0
                      const blockAlerts = alerts.get(b.id)
                      const label = blockTypeLabel(b.type)
                      const bar = (offset: number, ghost: boolean) => (
                        <div
                          key={ghost ? `${b.id}-ghost` : b.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${b.name}, ${fmtShort(b.start)} a ${fmtShort(b.end)}`}
                          onPointerDown={ghost ? undefined : (e) => onBarPointerDown(e, b.id)}
                          onPointerMove={ghost ? undefined : onBarPointerMove}
                          onPointerUp={ghost ? undefined : onBarPointerUp}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setSelectedId(b.id)
                          }}
                          className={cn(
                            'absolute flex touch-none items-center gap-1 overflow-hidden rounded-lg border px-1.5 text-2xs font-semibold text-zinc-900 shadow-xs transition-shadow',
                            ghost ? 'pointer-events-none opacity-35' : 'cursor-grab active:cursor-grabbing',
                            selectedId === b.id && !ghost && 'ring-2 ring-brand-primary ring-offset-1 ring-offset-surface-card',
                            isDrag && !ghost && 'z-10 shadow-pop',
                          )}
                          style={{
                            left: Math.max(LABEL_W, left) + offset,
                            width: Math.max(18, width - Math.max(0, LABEL_W - left)),
                            top: lane * LANE_H + 4,
                            height: LANE_H - 8,
                            background: b.color,
                            borderColor: hexAlpha('#000000', 0.12),
                          }}
                        >
                          <GripVertical className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                          <span className="truncate">{b.name}</span>
                          {label ? <span className="hidden shrink-0 rounded bg-black/10 px-1 text-3xs font-medium sm:inline">{label}</span> : null}
                          {blockAlerts ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-700" aria-label="Volumen por encima del rango" /> : null}
                          {overlaps.has(b.id) ? <span className="shrink-0 rounded bg-black/15 px-1 text-3xs">se pisa</span> : null}
                        </div>
                      )
                      return (
                        <div key={b.id}>
                          {isDrag && drag.copy && snapped ? bar(0, true) : null}
                          {bar(snapped, false)}
                          {isDrag && snapped ? (
                            <div
                              className="pointer-events-none absolute z-20 rounded-md bg-ink-primary px-1.5 py-0.5 text-3xs font-semibold text-surface-card"
                              style={{ left: Math.max(LABEL_W, left) + snapped, top: lane * LANE_H - 14 }}
                            >
                              {drag.copy ? 'Copiar' : 'Mover'}: {fmtShort(shiftYmd(b.start, (snapped / CW) * 7)!)} → {fmtShort(shiftYmd(b.end, (snapped / CW) * 7)!)}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {selected ? (
                <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded" style={{ background: selected.color }} />
                        <input
                          key={selected.id}
                          defaultValue={selected.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== selected.name) void patchMeta(selected.id, { name: v })
                          }}
                          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-base font-semibold text-ink-primary outline-none hover:bg-surface-elevated focus:bg-surface-elevated"
                          aria-label="Nombre del bloque"
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {fmtShort(selected.start)} → {fmtShort(selected.end)} · {durationWeeks(selected.start, selected.end)} semanas ·{' '}
                        {selected.routine.weeks.length} cargadas · bloque {selectedIdx + 1} de {sorted.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" disabled={selectedIdx <= 0} onClick={() => setSelectedId(sorted[selectedIdx - 1]?.id ?? null)} title="Bloque anterior">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={selectedIdx >= sorted.length - 1} onClick={() => setSelectedId(sorted[selectedIdx + 1]?.id ?? null)} title="Bloque siguiente">
                        <ChevronRight className="h-4 w-4" />
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
                          <Copy className="h-3.5 w-3.5" /> Copiar como bloque siguiente
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/routines/${selected.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir rutina
                        </Button>
                      </div>
                      <p className="text-3xs leading-snug text-ink-muted">
                        Copiar crea las mismas semanas, días y ejercicios a continuación; después ajustás la progresión a mano.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Volumen semanal</p>
                      {selected.routine.weeks.length === 0 ? (
                        <p className="text-xs text-ink-muted">Sin semanas cargadas todavía.</p>
                      ) : selectedAlerts.length === 0 ? (
                        <p className="hh-alert hh-alert-success rounded-xl px-3 py-2 text-xs text-ink-secondary">
                          Todas las semanas dentro del rango sostenible.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {selectedAlerts.map((a) => (
                            <li key={a.weekId} className="hh-alert hh-alert-danger rounded-xl px-3 py-2 text-xs text-ink-secondary">
                              <span className="font-semibold text-ink-primary">
                                {a.weekName} ({fmtShort(a.start)}):
                              </span>{' '}
                              {a.muscles
                                .map((m) => `${VOLUME_MUSCLES.find((x) => x.id === m.id)?.label} ${String(m.value).replace('.', ',')}`)
                                .join(' · ')}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <p className="text-center text-xs text-ink-muted">Tocá una barra para ver el detalle del bloque.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
