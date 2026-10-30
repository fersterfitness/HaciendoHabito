import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, X, Link2, Unlink, ArrowUp, ArrowDown, Boxes, CopyPlus } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { trainerCtaFormAccentClassName } from '@/lib/primaryGradientCtaClasses'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import { resolveRmKgForExercise, type StudentRmLookup } from '@/lib/routine/studentRmLookup'
import type { RoutineDay, RoutineExercise, TrainingMethod } from '@/types/database'
import toast from 'react-hot-toast'
import { type DayWithEx, WARMUP_PRESETS, groupExercises } from './routineDetailShared'
import { ExerciseRow } from './ExerciseRow'

export function DayCard({
  day,
  expanded,
  onToggle,
  onUpdateDay,
  onDeleteDay,
  onDuplicateDay,
  otherWeeks,
  onCopyDayToWeek,
  onMoveDay,
  onAddExercise,
  onPastePreset,
  onReplaceExercise,
  onUpdateExercise,
  onApplyMethodWeekPlan,
  onApplyMethodWeekPlanAllDays,
  onCircuitNoteChange,
  onDeleteExercise,
  onMoveExercise,
  siblingDays,
  onCopyPrescription,
  rmLookup = { byExerciseId: new Map(), byExerciseName: new Map() },
}: {
  day: DayWithEx; expanded: boolean
  onToggle: () => void
  onUpdateDay: (patch: Partial<RoutineDay>) => void
  onDeleteDay: () => void
  onDuplicateDay: () => void
  otherWeeks: { id: string; name: string }[]
  onCopyDayToWeek: (targetBlockId: string) => void
  onMoveDay: (direction: 'up' | 'down') => void
  onAddExercise: () => void
  onPastePreset: () => void
  onReplaceExercise: (routineExerciseId: string) => void
  onUpdateExercise: (exId: string, patch: Partial<RoutineExercise>) => void | Promise<void>
  onApplyMethodWeekPlan: (sourceEx: RoutineExercise, method: TrainingMethod) => void | Promise<void>
  onApplyMethodWeekPlanAllDays: (sourceEx: RoutineExercise, method: TrainingMethod) => void | Promise<void>
  onCircuitNoteChange: (groupId: number, value: string) => void
  onDeleteExercise: (exId: string) => void
  onMoveExercise: (exId: string, direction: 'up' | 'down') => void
  siblingDays: { id: string; day_name: string }[]
  onCopyPrescription: (targetDayIds: string[], includeDayMeta: boolean) => void | Promise<void>
  rmLookup: StudentRmLookup
}) {
  const [showDelete, setShowDelete]     = useState(false)
  const [dayName, setDayName]           = useState(day.day_name)
  const [focus, setFocus]               = useState(day.muscle_focus ?? '')
  const [warmup, setWarmup]             = useState(day.warmup_notes ?? '')
  const [circuitMode, setCircuitMode]   = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [copyToWeekOpen, setCopyToWeekOpen] = useState(false)
  const [copyPrescriptionOpen, setCopyPrescriptionOpen] = useState(false)
  const [copyTargets, setCopyTargets]     = useState<Set<string>>(new Set())
  const [copyIncludeDayMeta, setCopyIncludeDayMeta] = useState(false)

  const saveDay = useDebounce(onUpdateDay, 600)

  // Freestanding (non-superset) exercises available for circuit selection
  const freeExercises = day.exercises.filter(e => !e.is_superset)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmCircuit() {
    if (selectedIds.size < 2) { toast.error('Seleccioná al menos 2 ejercicios'); return }
    const groupId = Math.floor(Math.random() * 2_000_000_000)
    selectedIds.forEach(id => onUpdateExercise(id, { is_superset: true, superset_group: groupId }))
    setCircuitMode(false)
    setSelectedIds(new Set())
    toast.success('Circuito creado')
  }

  function dissolveCircuit(groupId: number) {
    day.exercises
      .filter(e => e.superset_group === groupId)
      .forEach(e => onUpdateExercise(e.id, { is_superset: false, superset_group: null }))
  }

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-surface-card transition-colors" onClick={onToggle}>
        <span className="flex-1 text-base font-bold text-ink-primary tracking-wide">{dayName}</span>
        {focus && <span className="text-xs text-ink-muted">{focus}</span>}
        <span className="text-xs text-ink-muted">{day.exercises.length} ejerc.</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />}
        <button onClick={(e) => { e.stopPropagation(); onMoveDay('up') }} className="text-ink-muted hover:text-ink-primary transition-colors ml-1" title="Mover día arriba">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDay('down') }} className="text-ink-muted hover:text-ink-primary transition-colors ml-1" title="Mover día abajo">
          <ArrowDown className="h-3 w-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDuplicateDay() }} className="text-ink-muted hover:text-brand-primary transition-colors ml-1" title="Duplicar día en esta semana">
          <Copy className="h-3 w-3" />
        </button>
        <div className="relative ml-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setCopyToWeekOpen((v) => !v)}
            className="text-ink-muted hover:text-brand-primary transition-colors"
            title="Duplicar este día a otra semana"
            disabled={otherWeeks.length === 0}
          >
            <CopyPlus className="h-3 w-3" />
          </button>
          {copyToWeekOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCopyToWeekOpen(false)} />
              <div className="absolute right-0 top-6 z-40 min-w-[160px] overflow-hidden rounded-xl border border-surface-border bg-surface-card py-1 shadow-lg">
                <p className="px-3 py-1.5 text-3xs font-semibold uppercase tracking-wide text-ink-muted">Copiar día a…</p>
                {otherWeeks.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs text-ink-primary hover:bg-surface-elevated"
                    onClick={() => {
                      setCopyToWeekOpen(false)
                      onCopyDayToWeek(w.id)
                    }}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setShowDelete(true) }} className="text-ink-muted hover:text-status-expired transition-colors ml-1">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-surface-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nombre del día" value={dayName} onChange={(e) => { setDayName(e.target.value); saveDay({ day_name: e.target.value }) }} className="text-xs h-8" />
            <Input placeholder="Foco muscular" value={focus} onChange={(e) => { setFocus(e.target.value); saveDay({ muscle_focus: e.target.value || null }) }} className="text-xs h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {WARMUP_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setWarmup(preset.text)
                    saveDay({ warmup_notes: preset.text })
                  }}
                  className="text-3xs px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary hover:border-brand-primary/50 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Textarea placeholder="Entrada en calor..." value={warmup} onChange={(e) => { setWarmup(e.target.value); saveDay({ warmup_notes: e.target.value || null }) }} rows={3} className="text-xs" />
          </div>

          {siblingDays.length > 0 && day.exercises.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 rounded-lg border border-dashed border-brand-primary/25 bg-brand-primary/5">
              <button
                type="button"
                onClick={() => {
                  setCopyTargets(new Set())
                  setCopyIncludeDayMeta(false)
                  setCopyPrescriptionOpen(true)
                }}
                className="text-xs font-medium text-brand-primary hover:text-brand-primary/90 transition-colors"
              >
                Copiar series/cargas → otros días
              </button>
              <button
                type="button"
                onClick={() => {
                  setCopyTargets(new Set(siblingDays.map((d) => d.id)))
                  setCopyIncludeDayMeta(false)
                  setCopyPrescriptionOpen(true)
                }}
                className="text-3xs text-ink-muted hover:text-ink-primary underline underline-offset-2"
              >
                todos los demás
              </button>
            </div>
          )}

          {/* Modo selección de circuito */}
          {circuitMode && (
            <div className="rounded-xl border border-brand-primary/40 bg-brand-primary/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-brand-primary/20">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-brand-primary" />
                  <span className="text-xs font-bold text-brand-primary">Seleccioná los ejercicios del circuito</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCircuitMode(false); setSelectedIds(new Set()) }}
                  className={cn('rounded-md p-1 text-ink-muted hover:text-ink-primary', appFocusRingClassName)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-brand-primary/10">
                {freeExercises.length === 0 && (
                  <p className="px-3 py-3 text-xs text-ink-muted">No hay ejercicios disponibles para combinar.</p>
                )}
                {freeExercises.map(ex => (
                  <button
                    type="button"
                    key={ex.id}
                    onClick={() => toggleSelect(ex.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      appFocusRingClassName,
                      selectedIds.has(ex.id) ? 'bg-brand-primary/15' : 'hover:bg-brand-primary/8'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                      selectedIds.has(ex.id) ? 'bg-brand-primary border-brand-primary' : 'border-surface-border'
                    )}>
                      {selectedIds.has(ex.id) && <span className="text-white text-3xs font-bold">✓</span>}
                    </div>
                    <span className="flex-1 text-sm font-medium text-ink-primary">{ex.exercise?.name ?? 'Ejercicio'}</span>
                    <span className="text-3xs text-ink-muted">{(ex.exercise?.muscle_group as { name: string } | undefined)?.name}</span>
                  </button>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-brand-primary/20 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-muted">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                <button
                  onClick={confirmCircuit}
                  disabled={selectedIds.size < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Link2 className="h-3 w-3" /> Crear circuito
                </button>
              </div>
            </div>
          )}

          {/* Ejercicios renderizados */}
          {!circuitMode && groupExercises(day.exercises).map((group) => {
            if (group.type === 'single') {
              return (
                <ExerciseRow
                  key={group.exercise.id}
                  exercise={group.exercise}
                  onUpdate={(patch) => onUpdateExercise(group.exercise.id, patch)}
                  onApplyMethodWeekPlan={(method) => onApplyMethodWeekPlan(group.exercise, method)}
                  onApplyMethodWeekPlanAllDays={(method) => onApplyMethodWeekPlanAllDays(group.exercise, method)}
                  onDelete={() => onDeleteExercise(group.exercise.id)}
                  onMoveUp={() => onMoveExercise(group.exercise.id, 'up')}
                  onMoveDown={() => onMoveExercise(group.exercise.id, 'down')}
                  onReplace={() => onReplaceExercise(group.exercise.id)}
                  rmKg={resolveRmKgForExercise(
                    rmLookup,
                    group.exercise.exercise_id,
                    group.exercise.exercise?.name,
                  )}
                />
              )
            }
            return (
              <div key={group.groupId} className="border border-brand-primary/30 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-brand-primary/5 border-b border-brand-primary/20">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-brand-primary" />
                    <span className="text-3xs font-bold text-brand-primary uppercase tracking-wider">
                      Circuito · {group.exercises.length} ejercicios
                    </span>
                  </div>
                  <button
                    onClick={() => dissolveCircuit(group.groupId)}
                    className="flex items-center gap-1 text-3xs text-ink-muted hover:text-status-expired transition-colors"
                    title="Disolver circuito"
                  >
                    <Unlink className="h-3 w-3" /> Disolver
                  </button>
                </div>
                <div className="px-3 py-2 border-b border-brand-primary/15 bg-brand-primary/5">
                  <label className="block text-3xs text-brand-primary font-semibold uppercase tracking-wide mb-1">
                    Aclaración del circuito
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: descanso entre vueltas 3' · intermitente 20x20'' x 4"
                    className="w-full bg-surface-card text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
                    value={parseExerciseMeta(group.exercises[0]?.technical_notes).meta.circuitNote ?? ''}
                    onChange={(e) => onCircuitNoteChange(group.groupId, e.target.value)}
                  />
                </div>
                {group.exercises.map((ex, i) => (
                  <div key={ex.id} className={i < group.exercises.length - 1 ? 'border-b border-brand-primary/15' : ''}>
                    <ExerciseRow
                      exercise={ex}
                      onUpdate={(patch) => onUpdateExercise(ex.id, patch)}
                      onApplyMethodWeekPlan={(method) => onApplyMethodWeekPlan(ex, method)}
                      onApplyMethodWeekPlanAllDays={(method) => onApplyMethodWeekPlanAllDays(ex, method)}
                      onDelete={() => onDeleteExercise(ex.id)}
                      onMoveUp={() => onMoveExercise(ex.id, 'up')}
                      onMoveDown={() => onMoveExercise(ex.id, 'down')}
                      onReplace={() => onReplaceExercise(ex.id)}
                      rmKg={resolveRmKgForExercise(rmLookup, ex.exercise_id, ex.exercise?.name)}
                    />
                  </div>
                ))}
              </div>
            )
          })}

          {/* Acciones del día */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onAddExercise}
              className="flex-1 flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-brand-primary py-1.5 border border-dashed border-surface-border rounded-lg hover:border-brand-primary/50 transition-colors"
            >
              <Plus className="h-3 w-3" /> Agregar ejercicio
            </button>
            <button
              onClick={onPastePreset}
              className="flex-1 flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-brand-secondary py-1.5 border border-dashed border-surface-border rounded-lg hover:border-brand-secondary/50 transition-colors"
              title="Pegar un circuito/preestablecido"
            >
              <Boxes className="h-3 w-3" /> Pegar preestablecido
            </button>
            {freeExercises.length >= 2 && !circuitMode && (
              <button
                onClick={(e) => { e.stopPropagation(); setCircuitMode(true) }}
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-primary px-3 py-1.5 border border-dashed border-surface-border rounded-lg hover:border-brand-primary/50 transition-colors"
              >
                <Link2 className="h-3 w-3" /> Crear circuito
              </button>
            )}
          </div>
        </div>
      )}

      {copyPrescriptionOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCopyPrescriptionOpen(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink-primary">Copiar a otros días de esta semana</h3>
              <button type="button" onClick={() => setCopyPrescriptionOpen(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
              Se copian series, peso, descanso, RPE/RIR, aclaraciones de circuito y agrupación. Las{' '}
              <strong className="text-ink-primary">reps por serie</strong> solo en ejercicios del grupo{' '}
              <strong className="text-ink-primary">Multiarticulares</strong> (ej. peso muerto); en el resto las dejás en el
              destino para completar a mano. Las <strong className="text-ink-primary">notas</strong> no se pisan.
            </p>
            <label className="flex items-center gap-2 text-xs text-ink-secondary mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={copyIncludeDayMeta}
                onChange={(e) => setCopyIncludeDayMeta(e.target.checked)}
                className="accent-brand-primary"
              />
              También copiar foco muscular y entrada en calor
            </label>
            <div className="space-y-2 mb-4">
              {siblingDays.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyTargets.has(d.id)}
                    onChange={(e) => {
                      setCopyTargets((prev) => {
                        const n = new Set(prev)
                        if (e.target.checked) n.add(d.id)
                        else n.delete(d.id)
                        return n
                      })
                    }}
                    className={trainerCtaFormAccentClassName}
                  />
                  {d.day_name}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setCopyPrescriptionOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={async () => {
                  if (copyTargets.size === 0) {
                    toast.error('Seleccioná al menos un día')
                    return
                  }
                  await onCopyPrescription(Array.from(copyTargets), copyIncludeDayMeta)
                  setCopyPrescriptionOpen(false)
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={onDeleteDay}
        title={`¿Eliminar "${dayName}"?`}
        description="Se eliminarán todos los ejercicios de este día."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
