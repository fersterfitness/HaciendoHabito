import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Exercise, StudentRmRecord } from '@/types/database'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { epley1RM } from './studentDetailShared'

// ─── AddRmModal ───────────────────────────────────────────────────────────────

type AddMode = 'test' | 'percent' | 'epley'

export function AddRmModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
}) {
  const [exercises, setExercises] = useState<Pick<Exercise, 'id' | 'name'>[]>([])
  const [exerciseId, setExerciseId] = useState('')
  const [mode, setMode] = useState<AddMode>('test')
  const [rmKg, setRmKg] = useState('') // mode=test
  const [epleyWeight, setEpleyWeight] = useState('') // mode=epley
  const [epleyReps, setEpleyReps] = useState('') // mode=epley / percent
  const [pctOfRm, setPctOfRm] = useState('80') // mode=percent
  const [testedAt, setTestedAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('exercise_library').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setExercises((data as Pick<Exercise, 'id' | 'name'>[]) ?? []))
  }, [])

  const estimatedRm = mode === 'epley' && epleyWeight && epleyReps
    ? epley1RM(Number(epleyWeight), Number(epleyReps))
    : null
  // El peso usado es el X% del RM → RM = peso / X%.
  const percentRm = mode === 'percent' && epleyWeight && Number(pctOfRm) > 0
    ? Math.round((Number(epleyWeight) / (Number(pctOfRm) / 100)) * 10) / 10
    : null

  async function handleSave() {
    if (!exerciseId) { toast.error('Seleccioná un ejercicio'); return }
    const finalRm = mode === 'test' ? Number(rmKg) : mode === 'percent' ? percentRm : estimatedRm
    if (!finalRm || finalRm <= 0) { toast.error('Ingresá los datos del RM'); return }
    const detail =
      mode === 'percent'
        ? `${epleyReps ? `${epleyReps} reps × ` : ''}${epleyWeight} kg al ${pctOfRm}%`
        : mode === 'epley'
          ? `${epleyReps} reps × ${epleyWeight} kg`
          : ''
    setSaving(true)
    await onSave({
      exercise_id: exerciseId,
      rm_kg: finalRm,
      tested_at: testedAt,
      source: mode === 'epley' ? 'epley' : 'test',
      notes: [detail, notes.trim()].filter(Boolean).join(' · ') || null,
    })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} size="md" bare>
    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
      <h3 className="text-sm font-semibold text-ink-primary">Registrar 1RM</h3>
      <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
    </div>

    <div className="px-4 py-4 space-y-4">
      {/* Ejercicio */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Ejercicio *</label>
        <select
          className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none"
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
        >
          <option value="">Seleccioná un ejercicio...</option>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Modo */}
      <div className="flex gap-1 rounded-xl border border-surface-border/90 bg-surface-elevated/90 p-1 ">
        {([
          { value: 'test', label: 'RM real' },
          { value: 'percent', label: 'Reps al %' },
          { value: 'epley', label: 'Epley' },
        ] as { value: AddMode; label: string }[]).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
              mode === value
                ? 'bg-white text-ink-primary shadow-sm ring-1 ring-surface-border/90 '
                : 'text-ink-muted ',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'percent' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Peso (kg) *</label>
              <input
                type="number" min={0} step={0.5} placeholder="ej: 120"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                value={epleyWeight}
                onChange={(e) => setEpleyWeight(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Reps</label>
              <input
                type="number" min={1} max={20} placeholder="ej: 5"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                value={epleyReps}
                onChange={(e) => setEpleyReps(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">% del RM *</label>
              <input
                type="number" min={30} max={100} step={1} placeholder="ej: 80"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                value={pctOfRm}
                onChange={(e) => setPctOfRm(e.target.value)}
              />
            </div>
          </div>
          {percentRm ? (
            <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-elevated px-4 py-3 ">
              <div>
                <p className="text-3xs font-semibold uppercase tracking-wide text-ink-muted ">1RM aproximado</p>
                <p className="text-2xl font-bold tabular-nums text-ink-primary ">{percentRm} kg</p>
              </div>
              <p className="text-xs text-ink-muted text-right">
                {epleyWeight} kg es el {pctOfRm}%<br />
                <span className="font-mono">peso ÷ %</span>
              </p>
            </div>
          ) : null}
          <p className="text-3xs text-ink-muted">Si ya había un RM de este ejercicio, el anterior queda en el historial.</p>
        </div>
      ) : mode === 'test' ? (
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">1RM (kg) *</label>
          <input
            type="number" min={0} step={0.5} placeholder="ej: 120"
            className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center font-bold"
            value={rmKg}
            onChange={(e) => setRmKg(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Peso usado (kg) *</label>
              <input
                type="number" min={0} step={0.5} placeholder="ej: 100"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                value={epleyWeight}
                onChange={(e) => setEpleyWeight(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Reps realizadas *</label>
              <input
                type="number" min={1} max={10} placeholder="ej: 5"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                value={epleyReps}
                onChange={(e) => setEpleyReps(e.target.value)}
              />
            </div>
          </div>
          {estimatedRm && (
            <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-elevated px-4 py-3 ">
              <div>
                <p className="text-3xs font-semibold uppercase tracking-wide text-ink-muted ">1RM estimado (Epley)</p>
                <p className="text-2xl font-bold tabular-nums text-ink-primary ">{estimatedRm} kg</p>
              </div>
              <p className="text-xs text-ink-muted text-right">
                Fórmula:<br />
                <span className="font-mono">peso × (1 + reps/30)</span>
              </p>
            </div>
          )}
          <p className="text-3xs text-ink-muted">La fórmula de Epley es más precisa con 1-6 repeticiones.</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
        <input
          type="date"
          className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none"
          value={testedAt}
          onChange={(e) => setTestedAt(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Notas (opcional)</label>
        <input
          placeholder="ej: con cinturón, post competencia..."
          className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none placeholder:text-ink-muted"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button className="w-full" variant="secondary" loading={saving} onClick={handleSave}>
        Guardar registro
      </Button>
    </div>
    </Modal>
  )
}
