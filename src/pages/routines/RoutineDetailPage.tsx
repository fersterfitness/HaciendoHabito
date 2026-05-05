import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Copy, X, Pencil, FileText, Calendar, Clock, Link2, Unlink, ArrowUp, ArrowDown, Library,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { useRoutines } from '@/hooks/useRoutines'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { generateRoutinePdf } from '@/lib/pdf/generateRoutinePdf'
import { formatDate, daysUntil, cn } from '@/lib/utils'
import { ROUTINE_STATUSES } from '@/lib/constants'
import {
  type ExerciseMeta,
  parseExerciseMeta,
  buildExerciseTechnicalNotes,
} from '@/lib/routine/exerciseMeta'
import { slugifyMuscleCatalogName, nextMuscleGroupSortOrder } from '@/lib/exercise/muscleGroupCatalog'
import { segmentSourceExercises, prescriptionPatchFrom } from '@/lib/routine/copyDayPrescriptions'
import { serializeBlocksToBlueprint } from '@/lib/routine/routineBlueprint'
import type { Routine, RoutineBlock, RoutineDay, RoutineExercise, Exercise, Student, MuscleGroup } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExWithExercise  = RoutineExercise & { exercise?: Exercise }
type DayWithEx       = RoutineDay      & { exercises: ExWithExercise[] }
type BlockWithDays   = RoutineBlock    & { days: DayWithEx[] }
type RoutineFull     = Routine         & { student?: Student }
type ExerciseWithGroup = Exercise & { muscle_group?: { id: string; name: string; sort_order: number } }
const WARMUP_PRESETS = [
  {
    label: 'Día de empuje',
    text: `2/3 vueltas
1) Movilidad torácica x10 por lado
2) Movilidad de hombros con palo x10
3) Manguito rotador con bandas x10 por lado
4) Plancha estática 30-40''`,
  },
  {
    label: 'Día de piernas',
    text: `1) Movilidad cadera 90/90 x10 por lado
2) Movilidad de tobillo x10 por lado
3) Movilidad de cadera parado x10 por lado
4) Activación zona media`,
  },
  {
    label: 'Día de tracción',
    text: `1) Movilidad dorso-lumbar en cuadrupedia x10 por lado
2) Retracciones escapulares x12
3) Movilidad torácica en plancha x10 por lado
4) Activación zona media`,
  },
]

function parseRestToSeconds(value: string): number | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v)
  const minMatch = v.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|')$/)
  if (minMatch) return Math.round(Number(minMatch[1].replace(',', '.')) * 60)
  const secMatch = v.match(/^(\d+(?:[.,]\d+)?)\s*(s|seg|sec|''|")$/)
  if (secMatch) return Math.round(Number(secMatch[1].replace(',', '.')))
  const mmssMatch = v.match(/^(\d{1,2}):(\d{1,2})$/)
  if (mmssMatch) return Number(mmssMatch[1]) * 60 + Number(mmssMatch[2])
  return null
}

function parseRpeToNumber(value: string): number | null {
  const v = value.trim().replace(',', '.')
  if (!v) return null
  const match = v.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  if (Number.isNaN(n) || n < 1 || n > 10) return null
  return n
}

/** Actualiza `circuitNote` en todos los miembros del circuito en un solo `setBlocks` (sin carreras). */
function applyCircuitNoteToBlocks(
  prev: BlockWithDays[],
  dayId: string,
  groupId: number,
  value: string,
): BlockWithDays[] {
  const patchMap = new Map<string, string | null>()
  for (const block of prev) {
    const day = block.days.find((d) => d.id === dayId)
    if (!day) continue
    for (const e of day.exercises) {
      if (e.superset_group !== groupId) continue
      const { userNotes, meta } = parseExerciseMeta(e.technical_notes)
      const nextMeta: ExerciseMeta = { ...meta, circuitNote: value || undefined }
      patchMap.set(e.id, buildExerciseTechnicalNotes(userNotes, nextMeta) || null)
    }
  }
  if (patchMap.size === 0) return prev
  return prev.map((block) => ({
    ...block,
    days: block.days.map((d) =>
      d.id !== dayId
        ? d
        : {
            ...d,
            exercises: d.exercises.map((ex) => {
              const tn = patchMap.get(ex.id)
              return tn !== undefined ? { ...ex, technical_notes: tn } : ex
            }),
          },
    ),
  }))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteRoutine, updateRoutine } = useRoutines()
  const { user } = useAuthStore()

  const [routine, setRoutine]   = useState<RoutineFull | null>(null)
  const [blocks, setBlocks]     = useState<BlockWithDays[]>([])
  const [loading, setLoading]   = useState(true)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays]     = useState<Set<string>>(new Set())
  const [showExercisePicker, setShowExercisePicker] = useState<{ dayId: string } | null>(null)
  const [copyMenuBlock, setCopyMenuBlock] = useState<string | null>(null)
  const [rmByExerciseId, setRmByExerciseId] = useState<Map<string, number>>(new Map())
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false)
  const [blueprintName, setBlueprintName] = useState('')
  const [blueprintDesc, setBlueprintDesc] = useState('')
  const [savingBlueprint, setSavingBlueprint] = useState(false)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [routineRes, blocksRes] = await Promise.all([
        supabase.from('routines').select('*, student:students(*)').eq('id', id).single(),
        supabase
          .from('routine_blocks')
          .select('*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(*)))')
          .eq('routine_id', id)
          .order('sort_order'),
      ])
      if (routineRes.data) setRoutine(routineRes.data as unknown as RoutineFull)
      const routineData = routineRes.data as unknown as RoutineFull | null
      if (routineData?.student_id) {
        const { data: rmRecords } = await supabase
          .from('student_rm_records')
          .select('exercise_id, rm_kg, tested_at')
          .eq('student_id', routineData.student_id)
          .order('tested_at', { ascending: false })
        const map = new Map<string, number>()
        for (const row of (rmRecords ?? []) as Array<{ exercise_id: string; rm_kg: number }>) {
          if (!map.has(row.exercise_id)) map.set(row.exercise_id, row.rm_kg)
        }
        setRmByExerciseId(map)
      } else {
        setRmByExerciseId(new Map())
      }
      if (blocksRes.data) {
        const sorted = (blocksRes.data as unknown as BlockWithDays[]).map((b) => ({
          ...b,
          days: [...(b.days ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((d) => ({
            ...d,
            exercises: [...(d.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
          })),
        }))
        setBlocks(sorted)
        setExpandedBlocks(new Set(sorted.map((b) => b.id)))
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Status ────────────────────────────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    if (!id) return
    await updateRoutine(id, { status: newStatus as Routine['status'], last_status_change: new Date().toISOString() })
    setRoutine((prev) => prev ? { ...prev, status: newStatus as Routine['status'] } : prev)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteRoutine(id)
    setDeleting(false)
    if (ok) navigate('/routines')
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  async function handleGeneratePdf() {
    if (!id || !user || !routine) return
    setGeneratingPdf(true)
    const toastId = toast.loading('Generando PDF...')
    try {
      const { data: existing } = await supabase
        .from('routine_pdfs').select('id')
        .eq('routine_id', id).in('status', ['pendiente', 'error', 'generado'])
        .order('created_at', { ascending: false }).limit(1).single()

      let pdfId = existing?.id
      if (!pdfId) {
        const { data: created, error } = await supabase
          .from('routine_pdfs')
          .insert({ owner_id: user.id, routine_id: id, student_id: routine.student_id, status: 'pendiente' })
          .select('id').single()
        if (error || !created) throw new Error(error?.message ?? 'No se pudo crear la solicitud')
        pdfId = created.id
      }

      await generateRoutinePdf(id, pdfId)

      const { data: pdfRecord } = await supabase
        .from('routine_pdfs').select('file_path').eq('id', pdfId).single()

      if (pdfRecord?.file_path) {
        const { data: signed } = await supabase.storage
          .from('routine-pdfs').createSignedUrl(pdfRecord.file_path, 120)
        if (signed?.signedUrl) window.open(signed.signedUrl, '_blank')
      }

      toast.success('PDF generado', { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generando PDF', { id: toastId })
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── Blocks ────────────────────────────────────────────────────────────────

  async function addBlock() {
    if (!id) return
    const { data, error } = await supabase
      .from('routine_blocks')
      .insert({ routine_id: id, name: `Semana ${blocks.length + 1}`, sort_order: blocks.length })
      .select().single()
    if (error) { toast.error(error.message); return }
    const newBlock = { ...data, days: [] } as BlockWithDays
    setBlocks((prev) => [...prev, newBlock])
    setExpandedBlocks((prev) => new Set([...prev, data.id]))
  }

  async function updateBlock(blockId: string, patch: Partial<RoutineBlock>) {
    await supabase.from('routine_blocks').update(patch).eq('id', blockId)
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, ...patch } : b))
  }

  async function deleteBlock(blockId: string) {
    const { error } = await supabase.from('routine_blocks').delete().eq('id', blockId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    toast.success('Semana eliminada')
  }

  async function moveBlock(blockId: string, direction: 'up' | 'down') {
    const currentIndex = blocks.findIndex((b) => b.id === blockId)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= blocks.length) return

    const reordered = [...blocks]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    await Promise.all(reordered.map((block, idx) => supabase.from('routine_blocks').update({ sort_order: idx }).eq('id', block.id)))
    setBlocks(reordered.map((b, idx) => ({ ...b, sort_order: idx })))
  }

  async function copyBlock(sourceId: string, targetId: string) {
    const source = blocks.find((b) => b.id === sourceId)
    const target = blocks.find((b) => b.id === targetId)
    if (!source || !target) return
    setCopyMenuBlock(null)
    const loadingId = toast.loading('Copiando semana...')
    try {
      for (const day of source.days) {
        const { data: newDay, error: dayErr } = await supabase
          .from('routine_days')
          .insert({ block_id: targetId, day_name: day.day_name, muscle_focus: day.muscle_focus, warmup_notes: day.warmup_notes, sort_order: target.days.length + day.sort_order })
          .select().single()
        if (dayErr || !newDay) continue
        for (const ex of day.exercises) {
          await supabase.from('routine_exercises').insert({
            day_id: newDay.id, exercise_id: ex.exercise_id, sort_order: ex.sort_order,
            sets: ex.sets, reps_min: ex.reps_min, reps_max: ex.reps_max, reps_scheme: ex.reps_scheme,
            weight_kg: ex.weight_kg, rir: ex.rir, rpe: ex.rpe, rest_seconds: ex.rest_seconds,
            tempo: ex.tempo, technical_notes: ex.technical_notes, is_superset: ex.is_superset, superset_group: ex.superset_group,
          })
        }
      }
      toast.dismiss(loadingId)
      toast.success(`Semana copiada a "${target.name}"`)
      fetchData()
    } catch {
      toast.dismiss(loadingId)
      toast.error('Error al copiar semana')
    }
  }

  async function duplicateRoutine() {
    if (!id || !routine || !user) return
    const loadingId = toast.loading('Duplicando rutina...')
    try {
      const { data: newRoutine, error: routineErr } = await supabase
        .from('routines')
        .insert({
          owner_id: user.id,
          student_id: routine.student_id,
          student_plan_id: routine.student_plan_id ?? null,
          name: `${routine.name} (copia)`,
          objective: routine.objective,
          level: routine.level,
          start_date: routine.start_date,
          end_date: routine.end_date,
          duration_days: routine.duration_days,
          price: routine.price,
          status: 'activa',
          notes: routine.notes,
        })
        .select('id')
        .single()
      if (routineErr || !newRoutine) throw new Error(routineErr?.message ?? 'No se pudo duplicar la rutina')

      for (const block of blocks) {
        const { data: newBlock, error: blockErr } = await supabase
          .from('routine_blocks')
          .insert({
            routine_id: newRoutine.id,
            name: block.name,
            sort_order: block.sort_order,
            notes: block.notes,
            start_date: block.start_date,
            end_date: block.end_date,
          })
          .select('id')
          .single()
        if (blockErr || !newBlock) throw new Error(blockErr?.message ?? 'No se pudo copiar un bloque')

        for (const day of block.days) {
          const { data: newDay, error: dayErr } = await supabase
            .from('routine_days')
            .insert({
              block_id: newBlock.id,
              day_name: day.day_name,
              day_of_week: day.day_of_week,
              muscle_focus: day.muscle_focus,
              warmup_notes: day.warmup_notes,
              sort_order: day.sort_order,
            })
            .select('id')
            .single()
          if (dayErr || !newDay) throw new Error(dayErr?.message ?? 'No se pudo copiar un día')

          for (const ex of day.exercises) {
            const { error: exErr } = await supabase.from('routine_exercises').insert({
              day_id: newDay.id,
              exercise_id: ex.exercise_id,
              sort_order: ex.sort_order,
              sets: ex.sets,
              reps_min: ex.reps_min,
              reps_max: ex.reps_max,
              reps_scheme: ex.reps_scheme,
              weight_kg: ex.weight_kg,
              rir: ex.rir,
              rpe: ex.rpe,
              rest_seconds: ex.rest_seconds,
              tempo: ex.tempo,
              technical_notes: ex.technical_notes,
              is_superset: ex.is_superset,
              superset_group: ex.superset_group,
            })
            if (exErr) throw new Error(exErr.message)
          }
        }
      }
      toast.success('Rutina duplicada', { id: loadingId })
      navigate(`/routines/${newRoutine.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo duplicar la rutina', { id: loadingId })
    }
  }

  // ── Days ──────────────────────────────────────────────────────────────────

  async function addDay(blockId: string) {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return
    const { data, error } = await supabase
      .from('routine_days')
      .insert({ block_id: blockId, day_name: `Día ${block.days.length + 1}`, sort_order: block.days.length })
      .select().single()
    if (error) { toast.error(error.message); return }
    const newDay = { ...data, exercises: [] } as DayWithEx
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, days: [...b.days, newDay] } : b))
    setExpandedDays((prev) => new Set([...prev, data.id]))
  }

  async function updateDay(blockId: string, dayId: string, patch: Partial<RoutineDay>) {
    await supabase.from('routine_days').update(patch).eq('id', dayId)
    setBlocks((prev) => prev.map((b) =>
      b.id === blockId ? { ...b, days: b.days.map((d) => d.id === dayId ? { ...d, ...patch } : d) } : b
    ))
  }

  async function deleteDay(blockId: string, dayId: string) {
    const { error } = await supabase.from('routine_days').delete().eq('id', dayId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.map((b) =>
      b.id === blockId ? { ...b, days: b.days.filter((d) => d.id !== dayId) } : b
    ))
    toast.success('Día eliminado')
  }

  async function moveDay(blockId: string, dayId: string, direction: 'up' | 'down') {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return
    const currentIndex = block.days.findIndex((d) => d.id === dayId)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= block.days.length) return

    const reorderedDays = [...block.days]
    const [moved] = reorderedDays.splice(currentIndex, 1)
    reorderedDays.splice(targetIndex, 0, moved)

    await Promise.all(reorderedDays.map((day, idx) => supabase.from('routine_days').update({ sort_order: idx }).eq('id', day.id)))

    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, days: reorderedDays.map((d, idx) => ({ ...d, sort_order: idx })) } : b))
    )
  }

  async function duplicateDay(blockId: string, dayId: string) {
    const block = blocks.find((b) => b.id === blockId)
    const sourceDay = block?.days.find((d) => d.id === dayId)
    if (!block || !sourceDay) return
    const loadingId = toast.loading('Duplicando día...')
    try {
      const { data: createdDay, error: dayErr } = await supabase
        .from('routine_days')
        .insert({
          block_id: blockId,
          day_name: `${sourceDay.day_name} (copia)`,
          day_of_week: sourceDay.day_of_week,
          muscle_focus: sourceDay.muscle_focus,
          warmup_notes: sourceDay.warmup_notes,
          sort_order: block.days.length,
        })
        .select()
        .single()
      if (dayErr || !createdDay) throw new Error(dayErr?.message ?? 'No se pudo duplicar el día')

      for (const ex of sourceDay.exercises) {
        await supabase.from('routine_exercises').insert({
          day_id: createdDay.id,
          exercise_id: ex.exercise_id,
          sort_order: ex.sort_order,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          reps_scheme: ex.reps_scheme,
          weight_kg: ex.weight_kg,
          rir: ex.rir,
          rpe: ex.rpe,
          rest_seconds: ex.rest_seconds,
          tempo: ex.tempo,
          technical_notes: ex.technical_notes,
          is_superset: ex.is_superset,
          superset_group: ex.superset_group,
        })
      }
      toast.success('Día duplicado', { id: loadingId })
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo duplicar el día', { id: loadingId })
    }
  }

  // ── Exercises ─────────────────────────────────────────────────────────────

  async function addExercise(dayId: string, exercise: Exercise) {
    const block = blocks.find((b) => b.days.some((d) => d.id === dayId))
    const day = block?.days.find((d) => d.id === dayId)
    const sortOrder = day?.exercises.length ?? 0
    const { data, error } = await supabase
      .from('routine_exercises')
      .insert({ day_id: dayId, exercise_id: exercise.id, sort_order: sortOrder, sets: 3, reps_scheme: null, reps_min: null, reps_max: null, is_superset: false })
      .select('*, exercise:exercise_library(*)')
      .single()
    if (error) { toast.error(error.message); return }
    const newEx = data as unknown as ExWithExercise
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d),
    })))
    setShowExercisePicker(null)
  }

  async function updateExercise(dayId: string, exId: string, patch: Partial<RoutineExercise>) {
    await supabase.from('routine_exercises').update(patch).eq('id', exId)
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? {
        ...d,
        exercises: d.exercises.map((e) => e.id === exId ? { ...e, ...patch } : e),
      } : d),
    })))
  }

  const blocksRef = useRef(blocks)
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const persistCircuitGroup = useCallback(async (dayId: string, groupId: number) => {
    const snap = blocksRef.current
    let day: DayWithEx | undefined
    for (const b of snap) {
      const d = b.days.find((x) => x.id === dayId)
      if (d) { day = d; break }
    }
    if (!day) return
    const members = day.exercises.filter((e) => e.superset_group === groupId)
    if (members.length === 0) return
    await Promise.all(
      members.map((e) =>
        supabase.from('routine_exercises').update({ technical_notes: e.technical_notes }).eq('id', e.id),
      ),
    )
  }, [])

  const debouncedPersistCircuit = useDebounce((dayId: string, groupId: number) => {
    void persistCircuitGroup(dayId, groupId)
  }, 400)

  const handleCircuitNoteChange = useCallback(
    (dayId: string, groupId: number, value: string) => {
      setBlocks((prev) => applyCircuitNoteToBlocks(prev, dayId, groupId, value))
      debouncedPersistCircuit(dayId, groupId)
    },
    [debouncedPersistCircuit],
  )

  async function deleteExercise(dayId: string, exId: string) {
    const { error } = await supabase.from('routine_exercises').delete().eq('id', exId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d),
    })))
  }

  async function moveExercise(dayId: string, exId: string, direction: 'up' | 'down') {
    const block = blocks.find((b) => b.days.some((d) => d.id === dayId))
    const day = block?.days.find((d) => d.id === dayId)
    if (!day) return
    const currentIndex = day.exercises.findIndex((e) => e.id === exId)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= day.exercises.length) return

    const reordered = [...day.exercises]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const updates = reordered.map((exercise, idx) =>
      supabase.from('routine_exercises').update({ sort_order: idx }).eq('id', exercise.id)
    )
    await Promise.all(updates)

    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        days: b.days.map((d) => (d.id === dayId ? { ...d, exercises: reordered.map((e, idx) => ({ ...e, sort_order: idx })) } : d)),
      }))
    )
  }

  async function copyDayPrescriptionToTargets(
    blockId: string,
    sourceDayId: string,
    targetDayIds: string[],
    includeDayMeta: boolean,
  ) {
    const block = blocks.find((b) => b.id === blockId)
    const sourceDay = block?.days.find((d) => d.id === sourceDayId)
    if (!block || !sourceDay || targetDayIds.length === 0) return

    const sourceSorted = [...sourceDay.exercises].sort((a, b) => a.sort_order - b.sort_order)
    if (sourceSorted.length === 0) {
      toast.error('Este día no tiene ejercicios para copiar')
      return
    }

    const segments = segmentSourceExercises(sourceSorted)

    const loadingId = toast.loading('Copiando prescripción...')
    try {
      if (includeDayMeta) {
        for (const tid of targetDayIds) {
          await updateDay(blockId, tid, {
            muscle_focus: sourceDay.muscle_focus,
            warmup_notes: sourceDay.warmup_notes,
          })
        }
      }

      for (const tid of targetDayIds) {
        const targetDay = block.days.find((d) => d.id === tid)
        if (!targetDay) continue
        const targetSorted = [...targetDay.exercises].sort((a, b) => a.sort_order - b.sort_order)

        if (targetSorted.length < sourceSorted.length) {
          toast.error(
            `"${targetDay.day_name}" tiene menos ejercicios (${targetSorted.length}) que "${sourceDay.day_name}" (${sourceSorted.length}). Agregá ejercicios en el destino o quitá filas en el origen.`,
            { id: loadingId },
          )
          return
        }

        let tp = 0
        for (const seg of segments) {
          const n = seg.indices.length
          if (tp + n > targetSorted.length) {
            toast.error(
              `No alcanzan los ejercicios en "${targetDay.day_name}" para copiar un circuito completo.`,
              { id: loadingId },
            )
            return
          }
          const newGroupId = seg.kind === 'circuit' ? Math.floor(Math.random() * 2_000_000_000) : null
          for (let k = 0; k < n; k++) {
            const srcEx = sourceSorted[seg.indices[k]]
            const tgtEx = targetSorted[tp + k]
            const patch = prescriptionPatchFrom(srcEx)
            if (seg.kind === 'circuit' && newGroupId != null) {
              patch.is_superset = true
              patch.superset_group = newGroupId
            } else {
              patch.is_superset = false
              patch.superset_group = null
            }
            await updateExercise(tid, tgtEx.id, patch)
          }
          tp += n
        }
      }

      toast.success(
        targetDayIds.length === 1
          ? 'Prescripción copiada al día elegido'
          : `Prescripción copiada a ${targetDayIds.length} días`,
        { id: loadingId },
      )
    } catch (err) {
      toast.dismiss(loadingId)
      toast.error(err instanceof Error ? err.message : 'Error al copiar')
    }
  }

  async function saveRoutineAsBlueprint() {
    if (!user || !blueprintName.trim()) return
    setSavingBlueprint(true)
    const payload = serializeBlocksToBlueprint(blocks)
    const { error } = await supabase.from('routine_blueprints').insert({
      owner_id: user.id,
      name: blueprintName.trim(),
      description: blueprintDesc.trim() || null,
      payload: JSON.parse(JSON.stringify(payload)),
    })
    setSavingBlueprint(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plantilla guardada en el diccionario')
    setBlueprintModalOpen(false)
    setBlueprintName('')
    setBlueprintDesc('')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div>
      <Header title="Rutina" showBack />
      <div className="flex justify-center py-16"><Spinner size="lg" /></div>
    </div>
  )

  if (!routine) return (
    <div>
      <Header title="Rutina" showBack />
      <p className="p-6 text-ink-muted">Rutina no encontrada.</p>
    </div>
  )

  const days = daysUntil(routine.end_date)
  const totalExercises = blocks.reduce((sum, b) => sum + b.days.reduce((s, d) => s + d.exercises.length, 0), 0)

  return (
    <div>
      <Header
        title={routine.student?.full_name ?? 'Rutina'}
        showBack
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/routines/${id}/edit`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
              title="Editar datos de la rutina"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar datos</span>
            </button>
            <button
              onClick={duplicateRoutine}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
              title="Duplicar rutina completa"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Duplicar</span>
            </button>
            <button
              type="button"
              onClick={() => setBlueprintModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
              title="Guardar como plantilla reutilizable"
            >
              <Library className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Plantilla</span>
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary text-xs font-medium transition-colors disabled:opacity-50"
              title="Generar PDF"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{generatingPdf ? 'Generando...' : 'PDF'}</span>
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="p-1.5 rounded-xl text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors"
              title="Eliminar rutina"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      <div className="px-4 lg:px-6 py-4 space-y-4">

        {/* Info barra compacta */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted mb-0.5">{routine.name}</p>
              <h2 className="text-lg font-bold text-ink-primary truncate">
                {routine.student?.full_name ?? '—'}
              </h2>
            </div>
            <Badge status={routine.status} size="md" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <Calendar className="h-3.5 w-3.5 text-ink-muted mb-0.5" />
              <span className="text-[10px] text-ink-muted">Inicio</span>
              <span className="text-xs font-semibold text-ink-primary">{formatDate(routine.start_date)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <Calendar className="h-3.5 w-3.5 text-ink-muted mb-0.5" />
              <span className="text-[10px] text-ink-muted">Vence</span>
              <span className="text-xs font-semibold text-ink-primary">{formatDate(routine.end_date)}</span>
            </div>
            <div className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl p-2.5',
              days <= 0 ? 'bg-status-expired/10' :
              days <= 7 ? 'bg-status-expiring/10' : 'bg-surface-elevated'
            )}>
              <Clock className={cn(
                'h-3.5 w-3.5 mb-0.5',
                days <= 0 ? 'text-status-expired' :
                days <= 7 ? 'text-status-expiring' : 'text-ink-muted'
              )} />
              <span className="text-[10px] text-ink-muted">Restantes</span>
              <span className={cn(
                'text-xs font-semibold',
                days <= 0 ? 'text-status-expired' :
                days <= 7 ? 'text-status-expiring' : 'text-ink-primary'
              )}>
                {days <= 0 ? 'Vencida' : `${days}d`}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <span className="text-[10px] text-ink-muted mt-1">Ejercicios</span>
              <span className="text-xs font-semibold text-ink-primary">{totalExercises}</span>
            </div>
          </div>

          <Select
            label="Estado"
            options={ROUTINE_STATUSES}
            value={routine.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />
        </div>

        {/* Objetivo */}
        {(routine.objective || routine.notes) && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
            {routine.objective && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Objetivo del Coach</p>
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{routine.objective}</p>
              </div>
            )}
            {routine.notes && (
              <div className="pt-3 border-t border-surface-border">
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Aclaraciones</p>
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{routine.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Divisor semanas */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Semanas / Bloques ({blocks.length})
          </span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        {/* Editor de bloques */}
        {blocks.map((block, blockStripeIndex) => (
          <BlockCard
            key={block.id}
            stripeIndex={blockStripeIndex}
            block={block}
            allBlocks={blocks}
            expanded={expandedBlocks.has(block.id)}
            expandedDays={expandedDays}
            showCopyMenu={copyMenuBlock === block.id}
            onToggle={() => setExpandedBlocks((prev) => {
              const next = new Set(prev)
              if (next.has(block.id)) next.delete(block.id)
              else next.add(block.id)
              return next
            })}
            onToggleDay={(dayId) => setExpandedDays((prev) => {
              const next = new Set(prev)
              if (next.has(dayId)) next.delete(dayId)
              else next.add(dayId)
              return next
            })}
            onUpdateBlock={(patch) => updateBlock(block.id, patch)}
            onDeleteBlock={() => deleteBlock(block.id)}
            onMoveBlock={(direction) => moveBlock(block.id, direction)}
            onAddDay={() => addDay(block.id)}
            onUpdateDay={(dayId, patch) => updateDay(block.id, dayId, patch)}
            onDeleteDay={(dayId) => deleteDay(block.id, dayId)}
            onDuplicateDay={(dayId) => duplicateDay(block.id, dayId)}
            onMoveDay={(dayId, direction) => moveDay(block.id, dayId, direction)}
            onAddExercise={(dayId) => setShowExercisePicker({ dayId })}
            onUpdateExercise={updateExercise}
            onCircuitNoteChange={handleCircuitNoteChange}
            onDeleteExercise={deleteExercise}
            onMoveExercise={moveExercise}
            onOpenCopyMenu={() => setCopyMenuBlock(copyMenuBlock === block.id ? null : block.id)}
            onCloseCopyMenu={() => setCopyMenuBlock(null)}
            onCopyTo={(targetId) => copyBlock(block.id, targetId)}
            onCopyDayPrescription={(sourceDayId, targetDayIds, includeDayMeta) =>
              copyDayPrescriptionToTargets(block.id, sourceDayId, targetDayIds, includeDayMeta)}
            rmByExerciseId={rmByExerciseId}
          />
        ))}

        <Button variant="secondary" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={addBlock}>
          Agregar semana / bloque
        </Button>
      </div>

      {showExercisePicker && (
        <ExercisePicker
          onSelect={(ex) => addExercise(showExercisePicker.dayId, ex)}
          onClose={() => setShowExercisePicker(null)}
        />
      )}

      {blueprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBlueprintModalOpen(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-primary">Guardar en diccionario de plantillas</h3>
              <button type="button" onClick={() => setBlueprintModalOpen(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-ink-secondary mb-3">
              Se guarda la estructura de semanas, días y ejercicios (con series, notas, circuitos). Luego podés aplicarla al crear una rutina nueva.
            </p>
            <div className="space-y-2">
              <Input
                label="Nombre de la plantilla *"
                placeholder="Ej: 3 días principiantes — empuje"
                value={blueprintName}
                onChange={(e) => setBlueprintName(e.target.value)}
                className="text-sm"
              />
              <Textarea
                label="Nota (opcional)"
                placeholder="Cuándo usarla, recordatorios…"
                value={blueprintDesc}
                onChange={(e) => setBlueprintDesc(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setBlueprintModalOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1"
                loading={savingBlueprint}
                disabled={!blueprintName.trim() || totalExercises === 0}
                onClick={saveRoutineAsBlueprint}
              >
                Guardar plantilla
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description="Se eliminarán todos los bloques, días y ejercicios asociados. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

// ─── BlockCard ────────────────────────────────────────────────────────────────

function BlockCard({
  block, allBlocks, expanded, expandedDays, showCopyMenu, stripeIndex = 0,
  onToggle, onToggleDay, onUpdateBlock, onDeleteBlock, onMoveBlock, onAddDay,
  onUpdateDay, onDeleteDay, onDuplicateDay, onMoveDay, onAddExercise, onUpdateExercise, onCircuitNoteChange, onDeleteExercise, onMoveExercise,
  onOpenCopyMenu, onCloseCopyMenu, onCopyTo, onCopyDayPrescription, rmByExerciseId,
}: {
  block: BlockWithDays; allBlocks: BlockWithDays[]; expanded: boolean
  /** Color de fondo alternado por semana (0 = gris, 1 = naranja suave). */
  stripeIndex?: number
  expandedDays: Set<string>; showCopyMenu: boolean
  onToggle: () => void; onToggleDay: (id: string) => void
  onUpdateBlock: (patch: Partial<RoutineBlock>) => void; onDeleteBlock: () => void; onMoveBlock: (direction: 'up' | 'down') => void; onAddDay: () => void
  onUpdateDay: (dayId: string, patch: Partial<RoutineDay>) => void
  onDeleteDay: (dayId: string) => void; onDuplicateDay: (dayId: string) => void; onMoveDay: (dayId: string, direction: 'up' | 'down') => void;   onAddExercise: (dayId: string) => void
  onUpdateExercise: (dayId: string, exId: string, patch: Partial<RoutineExercise>) => void | Promise<void>
  onCircuitNoteChange: (dayId: string, groupId: number, value: string) => void
  onDeleteExercise: (dayId: string, exId: string) => void; onMoveExercise: (dayId: string, exId: string, direction: 'up' | 'down') => void
  onOpenCopyMenu: () => void; onCloseCopyMenu: () => void; onCopyTo: (targetId: string) => void
  onCopyDayPrescription: (sourceDayId: string, targetDayIds: string[], includeDayMeta: boolean) => void | Promise<void>
  rmByExerciseId: Map<string, number>
}) {
  const [showDelete, setShowDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(block.name)
  const otherBlocks = allBlocks.filter((b) => b.id !== block.id)

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden shadow-sm',
        stripeIndex % 2 === 0
          ? 'border-slate-200/95 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
          : 'border-emerald-200/85 bg-emerald-50/60 dark:border-emerald-900/45 dark:bg-emerald-950/30',
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-surface-elevated transition-colors"
        onClick={onToggle}
      >
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
            {(block.start_date || block.end_date) && (
              <p className="text-[10px] text-ink-muted mt-0.5">
                {block.start_date ? new Date(block.start_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}
                {' → '}
                {block.end_date ? new Date(block.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?'}
              </p>
            )}
          </div>
        )}

        <span className="text-xs text-ink-muted">{block.days.length} días</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-ink-muted" /> : <ChevronRight className="h-4 w-4 text-ink-muted" />}

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button title="Copiar días a otra semana" onClick={onOpenCopyMenu} className="text-ink-muted hover:text-brand-primary transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
          {showCopyMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={onCloseCopyMenu} />
              <div className="absolute right-0 top-6 z-40 bg-surface-card border border-surface-border rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-ink-muted uppercase tracking-wide">Copiar días a…</p>
                {otherBlocks.length === 0
                  ? <p className="px-3 py-2 text-xs text-ink-muted">No hay otras semanas</p>
                  : otherBlocks.map((b) => (
                      <button key={b.id} onClick={() => onCopyTo(b.id)} className="w-full text-left px-3 py-2 text-xs text-ink-primary hover:bg-surface-elevated transition-colors">
                        {b.name}
                      </button>
                    ))
                }
              </div>
            </>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onMoveBlock('up') }}
          title="Mover semana arriba"
          className="text-ink-muted hover:text-ink-primary transition-colors"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveBlock('down') }}
          title="Mover semana abajo"
          className="text-ink-muted hover:text-ink-primary transition-colors"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>

        <button onClick={(e) => { e.stopPropagation(); setShowDelete(true) }} className="text-ink-muted hover:text-status-expired transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Fechas del bloque */}
          <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <div>
              <label className="block text-[10px] text-ink-muted mb-1 uppercase tracking-wide">Fecha inicio</label>
              <input
                type="date"
                className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none"
                value={block.start_date ?? ''}
                onChange={(e) => onUpdateBlock({ start_date: e.target.value || null })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-ink-muted mb-1 uppercase tracking-wide">Fecha fin</label>
              <input
                type="date"
                className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none"
                value={block.end_date ?? ''}
                onChange={(e) => onUpdateBlock({ end_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <label className="block text-[10px] text-ink-muted mb-1 uppercase tracking-wide">Aclaración general del bloque</label>
            <Textarea
              placeholder="Ej: Intermitente HIIT corto 20x20'' x 4 vueltas. Descanso entre vueltas: 3'."
              rows={2}
              value={block.notes ?? ''}
              onChange={(e) => onUpdateBlock({ notes: e.target.value || null })}
              className="text-xs"
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
              onMoveDay={(direction) => onMoveDay(day.id, direction)}
              onAddExercise={() => onAddExercise(day.id)}
              onUpdateExercise={(exId, patch) => onUpdateExercise(day.id, exId, patch)}
              onCircuitNoteChange={(groupId, value) => onCircuitNoteChange(day.id, groupId, value)}
              onDeleteExercise={(exId) => onDeleteExercise(day.id, exId)}
              onMoveExercise={(exId, direction) => onMoveExercise(day.id, exId, direction)}
              siblingDays={block.days.filter((d) => d.id !== day.id).map((d) => ({ id: d.id, day_name: d.day_name }))}
              onCopyPrescription={(targetIds, includeDayMeta) =>
                onCopyDayPrescription(day.id, targetIds, includeDayMeta)}
              rmByExerciseId={rmByExerciseId}
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

// ─── DayCard ──────────────────────────────────────────────────────────────────

// ─── DayCard helpers ──────────────────────────────────────────────────────────

type RenderGroup =
  | { type: 'single'; exercise: ExWithExercise }
  | { type: 'superset'; groupId: number; exercises: ExWithExercise[] }

function groupExercises(exercises: ExWithExercise[]): RenderGroup[] {
  const result: RenderGroup[] = []
  const seen = new Set<string>()
  for (const ex of exercises) {
    if (seen.has(ex.id)) continue
    if (ex.is_superset && ex.superset_group !== null) {
      const members = exercises.filter(e => e.superset_group === ex.superset_group)
      members.forEach(m => seen.add(m.id))
      result.push({ type: 'superset', groupId: ex.superset_group, exercises: members })
    } else {
      seen.add(ex.id)
      result.push({ type: 'single', exercise: ex })
    }
  }
  return result
}

function DayCard({ day, expanded, onToggle, onUpdateDay, onDeleteDay, onDuplicateDay, onMoveDay, onAddExercise, onUpdateExercise, onCircuitNoteChange, onDeleteExercise, onMoveExercise, siblingDays, onCopyPrescription, rmByExerciseId = new Map<string, number>() }: {
  day: DayWithEx; expanded: boolean
  onToggle: () => void
  onUpdateDay: (patch: Partial<RoutineDay>) => void
  onDeleteDay: () => void
  onDuplicateDay: () => void
  onMoveDay: (direction: 'up' | 'down') => void
  onAddExercise: () => void
  onUpdateExercise: (exId: string, patch: Partial<RoutineExercise>) => void | Promise<void>
  onCircuitNoteChange: (groupId: number, value: string) => void
  onDeleteExercise: (exId: string) => void
  onMoveExercise: (exId: string, direction: 'up' | 'down') => void
  siblingDays: { id: string; day_name: string }[]
  onCopyPrescription: (targetDayIds: string[], includeDayMeta: boolean) => void | Promise<void>
  rmByExerciseId: Map<string, number>
}) {
  const [showDelete, setShowDelete]     = useState(false)
  const [dayName, setDayName]           = useState(day.day_name)
  const [focus, setFocus]               = useState(day.muscle_focus ?? '')
  const [warmup, setWarmup]             = useState(day.warmup_notes ?? '')
  const [circuitMode, setCircuitMode]   = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [copyPrescriptionOpen, setCopyPrescriptionOpen] = useState(false)
  const [copyTargets, setCopyTargets]     = useState<Set<string>>(new Set())
  const [copyIncludeDayMeta, setCopyIncludeDayMeta] = useState(true)

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
        <button onClick={(e) => { e.stopPropagation(); onDuplicateDay() }} className="text-ink-muted hover:text-brand-primary transition-colors ml-1" title="Duplicar día">
          <Copy className="h-3 w-3" />
        </button>
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
                  className="text-[10px] px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary hover:border-brand-primary/50 transition-colors"
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
                  setCopyPrescriptionOpen(true)
                }}
                className="text-xs font-medium text-brand-primary hover:text-brand-primary/90 transition-colors"
              >
                Copiar series/cargas/notas → otros días
              </button>
              <button
                type="button"
                onClick={() => {
                  setCopyTargets(new Set(siblingDays.map((d) => d.id)))
                  setCopyPrescriptionOpen(true)
                }}
                className="text-[10px] text-ink-muted hover:text-ink-primary underline underline-offset-2"
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
                <button onClick={() => { setCircuitMode(false); setSelectedIds(new Set()) }} className="text-ink-muted hover:text-ink-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-brand-primary/10">
                {freeExercises.length === 0 && (
                  <p className="px-3 py-3 text-xs text-ink-muted">No hay ejercicios disponibles para combinar.</p>
                )}
                {freeExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => toggleSelect(ex.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      selectedIds.has(ex.id) ? 'bg-brand-primary/15' : 'hover:bg-brand-primary/8'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                      selectedIds.has(ex.id) ? 'bg-brand-primary border-brand-primary' : 'border-surface-border'
                    )}>
                      {selectedIds.has(ex.id) && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className="flex-1 text-sm font-medium text-ink-primary">{ex.exercise?.name ?? 'Ejercicio'}</span>
                    <span className="text-[10px] text-ink-muted">{(ex.exercise?.muscle_group as { name: string } | undefined)?.name}</span>
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
                  onDelete={() => onDeleteExercise(group.exercise.id)}
                  onMoveUp={() => onMoveExercise(group.exercise.id, 'up')}
                  onMoveDown={() => onMoveExercise(group.exercise.id, 'down')}
                  rmKg={rmByExerciseId.get(group.exercise.exercise_id)}
                />
              )
            }
            return (
              <div key={group.groupId} className="border border-brand-primary/30 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-brand-primary/5 border-b border-brand-primary/20">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-brand-primary" />
                    <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                      Circuito · {group.exercises.length} ejercicios
                    </span>
                  </div>
                  <button
                    onClick={() => dissolveCircuit(group.groupId)}
                    className="flex items-center gap-1 text-[10px] text-ink-muted hover:text-status-expired transition-colors"
                    title="Disolver circuito"
                  >
                    <Unlink className="h-3 w-3" /> Disolver
                  </button>
                </div>
                <div className="px-3 py-2 border-b border-brand-primary/15 bg-brand-primary/5">
                  <label className="block text-[10px] text-brand-primary font-semibold uppercase tracking-wide mb-1">
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
                      onDelete={() => onDeleteExercise(ex.id)}
                      onMoveUp={() => onMoveExercise(ex.id, 'up')}
                      onMoveDown={() => onMoveExercise(ex.id, 'down')}
                      rmKg={rmByExerciseId.get(ex.exercise_id)}
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
          <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink-primary">Copiar a otros días de esta semana</h3>
              <button type="button" onClick={() => setCopyPrescriptionOpen(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
              Se copian series, reps, peso, descanso, RPE/RIR, notas y agrupación de circuitos. Los <strong className="text-ink-primary">ejercicios</strong> del día destino no cambian.
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
                    className="accent-brand-primary"
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

// ─── ExerciseRow ──────────────────────────────────────────────────────────────

function ExerciseRow({ exercise, onUpdate, onDelete, onMoveUp, onMoveDown, rmKg, canCombine, onCombineWithNext, isSeparable, onSeparate }: {
  exercise: ExWithExercise
  onUpdate: (patch: Partial<RoutineExercise>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  rmKg?: number
  canCombine?: boolean
  onCombineWithNext?: () => void
  isSeparable?: boolean
  onSeparate?: () => void
}) {
  // Local state — updates UI instantly
  const [sets, setSets]           = useState<number | null>(exercise.sets ?? null)
  const [reps, setReps]           = useState(exercise.reps_scheme ?? '')
  const initialMeta = parseExerciseMeta(exercise.technical_notes)
  const [restText, setRestText]   = useState(initialMeta.meta.restText ?? (exercise.rest_seconds !== null ? String(exercise.rest_seconds) : ''))
  const [weight, setWeight]       = useState<number | null>(exercise.weight_kg ?? null)
  const [rir, setRir]             = useState<number | null>(exercise.rir ?? null)
  const [rpeText, setRpeText]     = useState(initialMeta.meta.rpeText ?? (exercise.rpe !== null ? String(exercise.rpe) : ''))
  const [percent1rm, setPercent1rm] = useState(initialMeta.meta.percent1rm ?? '')
  const [notes, setNotes]         = useState(initialMeta.userNotes)

  // Debounced save — fires 600ms after last keystroke
  const save = useDebounce(onUpdate, 600)
  const hasPercent = percent1rm.trim().length > 0
  const suggestedWeight = rmKg && hasPercent ? Math.round((rmKg * Number(percent1rm) / 100) * 10) / 10 : null

  /** Meta persistida en `technical_notes` (incl. circuitNote del circuito); no usar solo `initialMeta` del primer render. */
  function saveMeta(nextMeta: ExerciseMeta, overrides?: Partial<RoutineExercise>) {
    const base = parseExerciseMeta(exercise.technical_notes).meta
    const merged = { ...base, ...nextMeta }
    const technicalNotes = buildExerciseTechnicalNotes(notes, merged)
    save({ technical_notes: technicalNotes || null, ...overrides })
  }

  return (
    <div className="bg-surface-card rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-ink-muted shrink-0" />
        <span className="flex-1 text-xs font-semibold text-ink-primary truncate">
          {exercise.exercise?.name ?? 'Ejercicio'}
        </span>
        {exercise.exercise?.muscle_group && (
          <span className="text-[10px] text-ink-muted shrink-0">
            {(exercise.exercise.muscle_group as unknown as { name: string }).name}
          </span>
        )}
        {isSeparable && (
          <button
            onClick={onSeparate}
            title="Separar del circuito"
            className="text-orange-400/60 hover:text-orange-400 transition-colors"
          >
            <Unlink className="h-3 w-3" />
          </button>
        )}
        {canCombine && (
          <button
            onClick={onCombineWithNext}
            title="Combinar con siguiente"
            className="text-ink-muted hover:text-brand-primary transition-colors"
          >
            <Link2 className="h-3 w-3" />
          </button>
        )}
        <button onClick={onMoveUp} title="Subir" className="text-ink-muted hover:text-ink-primary transition-colors">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} title="Bajar" className="text-ink-muted hover:text-ink-primary transition-colors">
          <ArrowDown className="h-3 w-3" />
        </button>
        <button onClick={onDelete} className="text-ink-muted hover:text-status-expired transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">Series</label>
          <input
            type="number" min={0}
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={sets ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setSets(v); save({ sets: v })
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">Reps por serie</label>
          <input
            type="text"
            placeholder="ej: 8 / 6 / 5"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={reps}
            onChange={(e) => { setReps(e.target.value); save({ reps_scheme: e.target.value || null }) }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">Descanso</label>
          <input
            type="text"
            placeholder="20'' / 2'"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={restText}
            onChange={(e) => {
              const v = e.target.value
              setRestText(v)
              const parsed = parseRestToSeconds(v)
              saveMeta({ restText: v || undefined, rpeText: rpeText || undefined, percent1rm: percent1rm || undefined }, { rest_seconds: parsed })
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">Peso kg</label>
          <input
            type="number" min={0}
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={weight ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setWeight(v); save({ weight_kg: v })
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">RIR</label>
          <input
            type="number" min={0}
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={rir ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setRir(v); save({ rir: v })
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">RPE / RIR</label>
          <input
            type="text"
            placeholder="RIR 8/9"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={rpeText}
            onChange={(e) => {
              const v = e.target.value
              setRpeText(v)
              const parsed = parseRpeToNumber(v)
              saveMeta({ restText: restText || undefined, rpeText: v || undefined, percent1rm: percent1rm || undefined }, { rpe: parsed })
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-[10px] text-ink-muted mb-0.5">% del 1RM</label>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="80"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={percent1rm}
            onChange={(e) => {
              const v = e.target.value
              setPercent1rm(v)
              const pctNum = Number(v)
              const suggested =
                rmKg &&
                v.trim().length > 0 &&
                !Number.isNaN(pctNum)
                  ? Math.round(rmKg * (pctNum / 100) * 10) / 10
                  : null
              saveMeta(
                {
                  restText: restText || undefined,
                  rpeText: rpeText || undefined,
                  percent1rm: v || undefined,
                },
                suggested !== null && weight === null ? { weight_kg: suggested } : {},
              )
              if (suggested !== null && weight === null) setWeight(suggested)
            }}
          />
        </div>
        <button
          type="button"
          disabled={!suggestedWeight}
          onClick={() => {
            if (!suggestedWeight) return
            setWeight(suggestedWeight)
            save({ weight_kg: suggestedWeight })
          }}
          className="h-8 px-2.5 rounded-lg border border-surface-border text-[11px] text-ink-secondary hover:text-ink-primary disabled:opacity-40"
        >
          {suggestedWeight ? `Aplicar ${suggestedWeight}kg` : rmKg ? 'Ingresá %' : 'Sin 1RM'}
        </button>
      </div>
      {rmKg && (
        <p className="text-[10px] text-ink-muted -mt-1">1RM cargado: {rmKg} kg</p>
      )}

      <input
        className="w-full bg-surface-elevated text-ink-secondary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
        placeholder="Notas técnicas..."
        value={notes}
        onChange={(e) => {
          const v = e.target.value
          setNotes(v)
          const baseMeta = parseExerciseMeta(exercise.technical_notes).meta
          const technicalNotes = buildExerciseTechnicalNotes(v, {
            ...baseMeta,
            restText: restText || undefined,
            rpeText: rpeText || undefined,
            percent1rm: percent1rm || undefined,
          })
          save({ technical_notes: technicalNotes || null })
        }}
      />
    </div>
  )
}


// ─── ExercisePicker ───────────────────────────────────────────────────────────

type MuscleGroupOption = { id: string; name: string }

function ExercisePicker({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const { user } = useAuthStore()
  const [exercises, setExercises]   = useState<ExerciseWithGroup[]>([])
  const [muscleCatalog, setMuscleCatalog] = useState<MuscleGroup[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [showNewForm, setShowNewForm] = useState<null | 'exercise' | 'category'>(null)
  const [newName, setNewName]             = useState('')
  const [newGroupId, setNewGroupId]       = useState('')
  const [newDifficulty, setNewDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('basico')
  const [creating, setCreating]           = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('exercise_library').select('*, muscle_group:muscle_groups(id, name, sort_order)').eq('is_active', true).order('name'),
      supabase.from('muscle_groups').select('*').order('sort_order'),
    ]).then(([exRes, mgRes]) => {
      if (cancelled) return
      if (exRes.error) toast.error(exRes.error.message)
      else setExercises((exRes.data as ExerciseWithGroup[]) ?? [])
      if (mgRes.error) toast.error(mgRes.error.message)
      else setMuscleCatalog((mgRes.data as MuscleGroup[]) ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  /** Todas las categorías del catálogo (incluidas vacías), para listado y desplegable “nuevo ejercicio”. */
  const groups = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; sort_order: number; exercises: ExerciseWithGroup[] }>()
    for (const mg of muscleCatalog) {
      byId.set(mg.id, { id: mg.id, name: mg.name, sort_order: mg.sort_order, exercises: [] })
    }
    const orphan: ExerciseWithGroup[] = []
    for (const ex of exercises) {
      const mgId = ex.muscle_group_id
      const bucket = mgId ? byId.get(mgId) : undefined
      if (bucket) bucket.exercises.push(ex)
      else orphan.push(ex)
    }
    const list = Array.from(byId.values())
    if (orphan.length > 0) {
      list.push({ id: 'other', name: 'Sin categoría', sort_order: 9999, exercises: orphan })
    }
    return list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [exercises, muscleCatalog])

  const muscleGroupOptions: MuscleGroupOption[] = useMemo(
    () => muscleCatalog.map((g) => ({ id: g.id, name: g.name })),
    [muscleCatalog],
  )

  const filtered = search.trim()
    ? exercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.muscle_group as { name: string } | undefined)?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : null

  async function createExercise() {
    if (!newName.trim() || !newGroupId) return
    setCreating(true)
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()
    const { data, error } = await supabase
      .from('exercise_library')
      .insert({ name: newName.trim(), slug, muscle_group_id: newGroupId, difficulty: newDifficulty, is_active: true, is_system: false, owner_id: user?.id ?? null })
      .select('*, muscle_group:muscle_groups(id, name, sort_order)').single()
    setCreating(false)
    if (error) { toast.error('Error al crear ejercicio'); return }
    toast.success('Ejercicio creado')
    onSelect(data as Exercise)
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return
    const upperName = newCategoryName.trim().toUpperCase()
    const exists = muscleCatalog.some((g) => g.name.toUpperCase() === upperName)
    if (exists) { toast.error(`La categoría "${upperName}" ya existe`); return }
    setCreatingCategory(true)
    const slugBase = slugifyMuscleCatalogName(newCategoryName)
    const slug = `${slugBase}-${Date.now()}`
    const nextSort = nextMuscleGroupSortOrder(muscleCatalog)
    const { data: row, error } = await supabase
      .from('muscle_groups')
      .insert({ name: upperName, slug, sort_order: nextSort })
      .select()
      .single()
    setCreatingCategory(false)
    if (error) {
      toast.error(error.message || 'Error al crear categoría')
      return
    }
    const created = row as MuscleGroup
    setMuscleCatalog((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    if (created.id) setOpenGroups((prev) => new Set(prev).add(created.id))
    toast.success('Categoría creada')
    setNewCategoryName('')
    setShowNewForm(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Seleccionar ejercicio</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-3">
          <input
            autoFocus
            placeholder="Buscar por nombre o grupo muscular..."
            className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-2">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered !== null ? (
            filtered.length === 0
              ? <p className="text-center text-ink-muted text-sm py-8">Sin resultados para "{search}"</p>
              : <div className="space-y-1">{filtered.map((ex) => <ExerciseItem key={ex.id} ex={ex} onSelect={onSelect} />)}</div>
          ) : (
            <div className="space-y-1.5">
              {groups.map((group) => (
                <div key={group.id} className="border border-surface-border rounded-xl overflow-hidden">
                  <button
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(group.id)) next.delete(group.id)
                        else next.add(group.id)
                        return next
                      })
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-elevated hover:bg-surface-card transition-colors"
                  >
                    <span className="text-xs font-semibold text-ink-primary">{group.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-muted">{group.exercises.length}</span>
                      {openGroups.has(group.id) ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />}
                    </div>
                  </button>
                  {openGroups.has(group.id) && (
                    <div className="divide-y divide-surface-border">
                      {group.exercises.map((ex) => <ExerciseItem key={ex.id} ex={ex} onSelect={onSelect} inGroup />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-surface-border px-4 py-3">
          {showNewForm === null ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewForm('exercise')}
                className="flex-1 flex items-center justify-center gap-2 text-xs text-brand-primary hover:text-brand-primary/80 py-2 border border-dashed border-brand-primary/30 rounded-xl hover:border-brand-primary/60 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Crear ejercicio nuevo
              </button>
              <button
                onClick={() => setShowNewForm('category')}
                className="flex-1 flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-ink-primary py-2 border border-dashed border-surface-border rounded-xl hover:border-surface-border/80 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Nueva categoría
              </button>
            </div>
          ) : showNewForm === 'exercise' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink-primary">Nuevo ejercicio</span>
                <button onClick={() => setShowNewForm(null)} className="text-ink-muted hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input
                autoFocus
                placeholder="Nombre del ejercicio *"
                className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                >
                  <option value="">Grupo muscular *</option>
                  {muscleGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select
                  className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as 'basico' | 'intermedio' | 'avanzado')}
                >
                  <option value="basico">Básico</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado</option>
                </select>
              </div>
              <Button className="w-full" size="sm" loading={creating} disabled={!newName.trim() || !newGroupId} onClick={createExercise}>
                Crear y agregar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink-primary">Nueva categoría</span>
                <button onClick={() => setShowNewForm(null)} className="text-ink-muted hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input
                autoFocus
                placeholder="Nombre de la categoría *"
                className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button className="w-full" size="sm" loading={creatingCategory} disabled={!newCategoryName.trim()} onClick={createCategory}>
                Crear categoría
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExerciseItem({ ex, onSelect, inGroup }: { ex: ExerciseWithGroup; onSelect: (ex: Exercise) => void; inGroup?: boolean }) {
  return (
    <button
      onClick={() => onSelect(ex)}
      className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors', inGroup ? 'hover:bg-surface-elevated' : 'hover:bg-surface-elevated rounded-xl')}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-primary truncate">{ex.name}</p>
        {!inGroup && <p className="text-xs text-ink-muted">{(ex.muscle_group as { name: string } | undefined)?.name}</p>}
      </div>
      <span className={cn(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
        ex.difficulty === 'basico'     ? 'bg-status-generated/10 text-status-generated' :
        ex.difficulty === 'intermedio' ? 'bg-status-expiring/10 text-status-expiring'   :
                                         'bg-status-expired/10 text-status-expired'
      )}>
        {ex.difficulty}
      </span>
    </button>
  )
}
