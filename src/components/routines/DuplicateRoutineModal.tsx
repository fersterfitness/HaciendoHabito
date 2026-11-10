import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { controlMdClassName } from '@/lib/formControlClasses'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { duplicateRoutine, type DuplicableRoutine } from '@/lib/routine/duplicateRoutine'

/** Copia una rutina con todos sus ejercicios al alumno que se elija (por defecto, el de la ficha). */
export function DuplicateRoutineModal({
  source,
  ownerId,
  currentStudentId,
  onClose,
  onDone,
}: {
  source: DuplicableRoutine
  ownerId: string
  currentStudentId: string
  onClose: () => void
  onDone: (newRoutineId: string, studentId: string) => void
}) {
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([])
  const [studentId, setStudentId] = useState(currentStudentId)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('students')
      .select('id, full_name')
      .eq('owner_id', ownerId)
      .order('full_name')
      .then(({ data }) => {
        if (!cancelled) setStudents((data as { id: string; full_name: string }[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  async function run() {
    if (!studentId) return
    setBusy(true)
    try {
      const newId = await duplicateRoutine(source, ownerId, studentId)
      toast.success('Rutina duplicada')
      onDone(newId, studentId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al duplicar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Duplicar rutina"
      description={`«${source.name}» se copia con todos sus ejercicios. Después podés ajustarla.`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void run()} loading={busy} disabled={!studentId}>
            Duplicar
          </Button>
        </div>
      }
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-secondary">Para</span>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={cn(controlMdClassName, 'w-full cursor-pointer')}>
          {students.length === 0 ? <option value={currentStudentId}>Este alumno</option> : null}
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.id === currentStudentId ? ' (este alumno)' : ''}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  )
}
