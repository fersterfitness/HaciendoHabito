import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Check, Copy, ArrowUp, ArrowDown, Droplets } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Textarea } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import type { StudentRmLookup } from '@/lib/routine/studentRmLookup'
import type { CyclePhaseInfo } from '@/lib/routine/menstrualCyclePlanning'
import type { RoutineBlock, RoutineDay, RoutineExercise, TrainingMethod } from '@/types/database'
import { type BlockWithDays, CYCLE_PHASE_CLASSES } from './routineDetailShared'
import { DayCard } from './DayCard'

export function BlockCard({
  block, allBlocks, expanded, expandedDays, showCopyMenu, stripeIndex = 0, cyclePhases = [],
  checkInWeekNumber = null, checkInFinished = false,
  onToggle, onToggleDay, onUpdateBlock, onCascadeWeekStart, onDeleteBlock, onMoveBlock, onAddDay,
  onUpdateDay, onDeleteDay, onDuplicateDay, onCopyDayToWeek, onMoveDay, onAddExercise, onPastePreset, onReplaceExercise, onUpdateExercise, onApplyMethodWeekPlan, onApplyMethodWeekPlanAllDays, onCircuitNoteChange, onDeleteExercise, onMoveExercise,
  onOpenCopyMenu, onCloseCopyMenu, onCopyTo, onCopyDayPrescription, rmLookup,
}: {
  block: BlockWithDays; allBlocks: BlockWithDays[]; expanded: boolean
  /** Color de fondo alternado por semana (0 = gris, 1 = naranja suave). */
  stripeIndex?: number
  /** Semana marcada en el último check-in semanal del alumno. */
  checkInWeekNumber?: number | null
  checkInFinished?: boolean
  /** Fases del ciclo menstrual que abarca esta semana (solo entrenador). */
  cyclePhases?: CyclePhaseInfo[]
  expandedDays: Set<string>; showCopyMenu: boolean
  onToggle: () => void; onToggleDay: (id: string) => void
  onUpdateBlock: (patch: Partial<RoutineBlock>) => void
  onCascadeWeekStart: (startDate: string) => void
  onDeleteBlock: () => void; onMoveBlock: (direction: 'up' | 'down') => void; onAddDay: () => void
  onUpdateDay: (dayId: string, patch: Partial<RoutineDay>) => void
  onDeleteDay: (dayId: string) => void; onDuplicateDay: (dayId: string) => void
  onCopyDayToWeek: (dayId: string, targetBlockId: string) => void
  onMoveDay: (dayId: string, direction: 'up' | 'down') => void
  onAddExercise: (dayId: string) => void
  onPastePreset: (dayId: string) => void
  onReplaceExercise: (dayId: string, routineExerciseId: string) => void
  onUpdateExercise: (dayId: string, exId: string, patch: Partial<RoutineExercise>) => void | Promise<void>
  onApplyMethodWeekPlan: (sourceEx: RoutineExercise, method: TrainingMethod) => void | Promise<void>
  onApplyMethodWeekPlanAllDays: (sourceEx: RoutineExercise, method: TrainingMethod) => void | Promise<void>
  onCircuitNoteChange: (dayId: string, groupId: number, value: string) => void
  onDeleteExercise: (dayId: string, exId: string) => void; onMoveExercise: (dayId: string, exId: string, direction: 'up' | 'down') => void
  onOpenCopyMenu: () => void; onCloseCopyMenu: () => void; onCopyTo: (targetId: string) => void
  onCopyDayPrescription: (sourceDayId: string, targetDayIds: string[], includeDayMeta: boolean) => void | Promise<void>
  rmLookup: StudentRmLookup
}) {
  const [showDelete, setShowDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(block.name)
  const [blockNotes, setBlockNotes] = useState(block.notes ?? '')
  const saveBlockNotes = useDebounce(onUpdateBlock, 600)
  const otherBlocks = allBlocks.filter((b) => b.id !== block.id)
  const weekN = (stripeIndex ?? 0) + 1
  const weekDone = checkInFinished || (checkInWeekNumber != null && weekN <= checkInWeekNumber)
  const weekCurrent = !checkInFinished && checkInWeekNumber === weekN

  useEffect(() => {
    setBlockNotes(block.notes ?? '')
  }, [block.id, block.notes])

  return (
    <div
      id={`routine-week-${block.id}`}
      className={cn(
        'scroll-mt-20 rounded-2xl border overflow-hidden shadow-sm',
        stripeIndex % 2 === 0
          ? 'border-slate-200/95 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
          : 'border-emerald-200/85 bg-emerald-50/60 dark:border-emerald-900/45 dark:bg-emerald-950/30',
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-surface-elevated transition-colors"
        onClick={onToggle}
      >
        <span
          title={weekCurrent ? 'Semana actual según el check-in' : weekDone ? 'Semana ya marcada en el check-in' : `Semana ${weekN}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-3xs font-bold tabular-nums text-white',
            weekDone ? 'bg-emerald-600' : 'bg-brand-primary',
            weekCurrent && 'ring-2 ring-brand-primary/70 ring-offset-1 ring-offset-surface-card',
          )}
        >
          S{weekN}
          {weekDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : null}
        </span>
        <GripVertical className="h-4 w-4 text-ink-muted shrink-0" />

        {editingName ? (
          <input
            autoFocus
            className="flex-1 bg-surface-elevated text-ink-primary text-sm font-semibold rounded-lg px-2 py-1 border border-surface-border focus:border-brand-primary outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onUpdateBlock({ name }); setEditingName(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateBlock({ name }); setEditingName(false) } }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span
              className="text-sm font-semibold text-ink-primary hover:text-brand-primary transition-colors"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true) }}
            >
              {block.name}
            </span>
            {weekCurrent ? (
              <span className="ml-2 rounded-full bg-brand-primary/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-brand-primary">
                Semana actual
              </span>
            ) : null}
            {(block.start_date || block.end_date) && (
              <p className="text-3xs text-ink-muted mt-0.5">
                {block.start_date ? new Date(block.start_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}
                {' → '}
                {block.end_date ? new Date(block.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}
              </p>
            )}
            {cyclePhases.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {cyclePhases.map((p) => (
                  <span
                    key={p.phase}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wide',
                      CYCLE_PHASE_CLASSES[p.color].chip,
                    )}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <span className="text-xs text-ink-muted">{block.days.length} días</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-ink-muted" /> : <ChevronRight className="h-4 w-4 text-ink-muted" />}

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button title="Copiar días a otra semana" type="button" onClick={onOpenCopyMenu} className={cn('rounded-md p-1 text-ink-muted transition-colors hover:text-brand-primary', appFocusRingClassName)}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          {showCopyMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={onCloseCopyMenu} />
              <div className="absolute right-0 top-6 z-40 bg-surface-card border border-surface-border rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-3xs font-semibold text-ink-muted uppercase tracking-wide">Copiar días a…</p>
                {otherBlocks.length === 0
                  ? <p className="px-3 py-2 text-xs text-ink-muted">No hay otras semanas</p>
                  : otherBlocks.map((b) => (
                      <button key={b.id} type="button" onClick={() => onCopyTo(b.id)} className={cn('w-full rounded-sm px-3 py-2 text-left text-xs text-ink-primary transition-colors hover:bg-surface-elevated', appFocusRingClassName)}>
                        {b.name}
                      </button>
                    ))
                }
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveBlock('up') }}
          title="Mover semana arriba"
          className={cn('rounded-md p-1 text-ink-muted transition-colors hover:text-ink-primary', appFocusRingClassName)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveBlock('down') }}
          title="Mover semana abajo"
          className={cn('rounded-md p-1 text-ink-muted transition-colors hover:text-ink-primary', appFocusRingClassName)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>

        <button type="button" onClick={(e) => { e.stopPropagation(); setShowDelete(true) }} className={cn('rounded-md p-1 text-ink-muted transition-colors hover:text-status-expired', appFocusRingClassName)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {cyclePhases.length > 0 ? (
            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
              {cyclePhases.map((p) => (
                <div
                  key={p.phase}
                  className={cn(
                    'flex gap-2 rounded-xl px-3 py-2.5 text-xs',
                    CYCLE_PHASE_CLASSES[p.color].panel,
                  )}
                >
                  <Droplets className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <p className="leading-snug">
                    <span className="font-semibold uppercase tracking-wide">{p.label}</span>
                    {' · '}
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {/* Fechas del bloque */}
          <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <div>
              <label className="block text-3xs text-ink-muted mb-1 uppercase tracking-wide">Fecha inicio</label>
              <input
                type="date"
                className={cn(
                  'w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary',
                  appFocusRingClassName,
                  'focus-visible:border-brand-primary',
                )}
                value={block.start_date ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v) onCascadeWeekStart(v)
                  else onUpdateBlock({ start_date: null })
                }}
              />
            </div>
            <div>
              <label className="block text-3xs text-ink-muted mb-1 uppercase tracking-wide">Fecha fin</label>
              <input
                type="date"
                className={cn(
                  'w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary',
                  appFocusRingClassName,
                  'focus-visible:border-brand-primary',
                )}
                value={block.end_date ?? ''}
                onChange={(e) => onUpdateBlock({ end_date: e.target.value || null })}
              />
              <p className="mt-0.5 text-3xs text-ink-muted">Editable manualmente</p>
            </div>
          </div>

          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <label className="block text-3xs text-ink-muted mb-1 uppercase tracking-wide">Aclaración general del bloque</label>
            <Textarea
              placeholder="Ej: Intermitente HIIT corto 20x20'' x 4 vueltas. Descanso entre vueltas: 3'."
              rows={5}
              value={blockNotes}
              onChange={(e) => {
                const v = e.target.value
                setBlockNotes(v)
                saveBlockNotes({ notes: v || null })
              }}
              className="min-h-[6.5rem] resize-y text-xs leading-relaxed whitespace-pre-wrap"
            />
          </div>

          {block.days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              expanded={expandedDays.has(day.id)}
              onToggle={() => onToggleDay(day.id)}
              onUpdateDay={(patch) => onUpdateDay(day.id, patch)}
              onDeleteDay={() => onDeleteDay(day.id)}
              onDuplicateDay={() => onDuplicateDay(day.id)}
              otherWeeks={otherBlocks.map((b) => ({ id: b.id, name: b.name }))}
              onCopyDayToWeek={(targetId) => onCopyDayToWeek(day.id, targetId)}
              onMoveDay={(direction) => onMoveDay(day.id, direction)}
              onAddExercise={() => onAddExercise(day.id)}
              onPastePreset={() => onPastePreset(day.id)}
              onReplaceExercise={(routineExerciseId) => onReplaceExercise(day.id, routineExerciseId)}
              onUpdateExercise={(exId, patch) => onUpdateExercise(day.id, exId, patch)}
              onApplyMethodWeekPlan={onApplyMethodWeekPlan}
              onApplyMethodWeekPlanAllDays={onApplyMethodWeekPlanAllDays}
              onCircuitNoteChange={(groupId, value) => onCircuitNoteChange(day.id, groupId, value)}
              onDeleteExercise={(exId) => onDeleteExercise(day.id, exId)}
              onMoveExercise={(exId, direction) => onMoveExercise(day.id, exId, direction)}
              siblingDays={block.days.filter((d) => d.id !== day.id).map((d) => ({ id: d.id, day_name: d.day_name }))}
              onCopyPrescription={(targetIds, includeDayMeta) =>
                onCopyDayPrescription(day.id, targetIds, includeDayMeta)}
              rmLookup={rmLookup}
            />
          ))}
          <button
            onClick={onAddDay}
            className="w-full flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-brand-primary py-2 border border-dashed border-surface-border rounded-xl hover:border-brand-primary/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar día
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={onDeleteBlock}
        title={`¿Eliminar "${block.name}"?`}
        description="Se eliminarán todos los días y ejercicios de esta semana."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
