import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Plus, Trash2, Copy, X, Pencil, FileText, Calendar, Clock, Library, RefreshCw, UserPlus, Table2, BarChart3, CalendarRange, ClipboardList, CheckCircle2 } from 'lucide-react'
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
import { recoverStaleRoutinePdfs } from '@/lib/pdf/routinePdfRecovery'
import { formatDate, cn } from '@/lib/utils'
import { ROUTINE_STATUSES } from '@/lib/constants'
import { type ExerciseMeta, parseExerciseMeta, buildExerciseTechnicalNotes } from '@/lib/routine/exerciseMeta'
import { isMultiarticularExercise, segmentSourceExercises, prescriptionPatchFrom } from '@/lib/routine/copyDayPrescriptions'
import { dayInsertPayload, exerciseInsertPayload } from '@/lib/routine/copyRoutineDay'
import { fetchStudentRmLookup, resolveRmKgForExercise, type StudentRmLookup } from '@/lib/routine/studentRmLookup'
import { serializeBlocksToBlueprint } from '@/lib/routine/routineBlueprint'
import { syncLibraryBlueprintPayload } from '@/lib/routine/libraryRoutine'
import { cascadeWeekDatesFromBlock, initialDatesForNewBlock } from '@/lib/routine/weekBlockDates'
import { sendRoutinePdfViaWhatsApp } from '@/lib/routine/sendRoutinePdfWhatsApp'
import { downloadRoutineProgressLogPdf } from '@/lib/routine/downloadRoutineProgressLogPdf'
import { RoutineProgressionGuidePanel } from '@/components/routines/RoutineProgressionGuidePanel'
import { RoutineVolumePanel } from '@/components/routines/RoutineVolumePanel'
import { MacrocycleCalendarPanel } from '@/components/routines/MacrocycleCalendarPanel'
import { cyclePhasesForWeekBlock } from '@/lib/routine/menstrualCyclePlanning'
import { loadLatestWeekStatusForStudent, type LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import { RoutineMonthlyFeedbackSection } from '@/components/checkIn/RoutineMonthlyFeedbackSection'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { TRAINER_CONTACT_WHATSAPP_DISPLAY } from '@/lib/trainerContact'
import type { Json, Routine, RoutineBlock, RoutineDay, RoutineExercise, Exercise, Student, MenstrualCycle, TrainingMethod, PresetBlock } from '@/types/database'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { type ExWithExercise, type DayWithEx, type BlockWithDays, type RoutineFull, applyCircuitNoteToBlocks } from './detail/routineDetailShared'
import { BlockCard } from './detail/BlockCard'
import { ExercisePicker } from './detail/ExercisePicker'

export function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useAppNavigate()
  const { deleteRoutine, updateRoutine } = useRoutines()
  const { user } = useAuthStore()

  const [routine, setRoutine]   = useState<RoutineFull | null>(null)
  const [blocks, setBlocks]     = useState<BlockWithDays[]>([])
  const [loading, setLoading]   = useState(true)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [exportingProgressLog, setExportingProgressLog] = useState(false)
  const [sendingWa, setSendingWa] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays]     = useState<Set<string>>(new Set())
  const [showExercisePicker, setShowExercisePicker] = useState<{
    dayId: string
    replaceRoutineExerciseId?: string
  } | null>(null)
  const [copyMenuBlock, setCopyMenuBlock] = useState<string | null>(null)
  const [presetPickerDayId, setPresetPickerDayId] = useState<string | null>(null)
  const [presetList, setPresetList] = useState<PresetBlock[]>([])
  // Se incrementa al aplicar un método para forzar el re-render de las filas (que muestren los nuevos valores).
  const [applyNonce, setApplyNonce] = useState(0)
  const emptyRmLookup = (): StudentRmLookup => ({
    byExerciseId: new Map(),
    byExerciseName: new Map(),
  })
  const [rmLookup, setRmLookup] = useState<StudentRmLookup>(emptyRmLookup)

  const loadRmLookup = useCallback(async (studentId: string) => {
    setRmLookup(await fetchStudentRmLookup(studentId))
  }, [])
  const [showProgressionGuide, setShowProgressionGuide] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showMacro, setShowMacro] = useState(false)
  const [lastMenstrualCycle, setLastMenstrualCycle] = useState<MenstrualCycle | null>(null)
  const [checkInWeek, setCheckInWeek] = useState<LatestWeekStatus>({
    finished: false,
    weekNumber: null,
    lastWeek: false,
    submittedAt: null,
  })
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false)
  const [blueprintName, setBlueprintName] = useState('')
  const [blueprintDesc, setBlueprintDesc] = useState('')
  const [blueprintCategory, setBlueprintCategory] = useState('')
  const [blueprintSubcategory, setBlueprintSubcategory] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [savingCompletionNote, setSavingCompletionNote] = useState(false)
  const [savingBlueprint, setSavingBlueprint] = useState(false)
  const [libraryBlueprintId, setLibraryBlueprintId] = useState<string | null>(null)
  const libraryBlueprintIdRef = useRef<string | null>(null)
  const libraryPayloadRef = useRef<Json | null>(null)
  const blocksRef = useRef<BlockWithDays[]>([])

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [routineRes, blocksRes] = await Promise.all([
        supabase.from('routines').select('*, student:students(*)').eq('id', id).single(),
        supabase
          .from('routine_blocks')
          .select(
            '*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(*, muscle_group:muscle_groups(id, name, slug))))',
          )
          .eq('routine_id', id)
          .order('sort_order'),
      ])
      if (routineRes.data) setRoutine(routineRes.data as unknown as RoutineFull)
      const routineData = routineRes.data as unknown as RoutineFull | null
      if (routineData?.student_id) {
        await loadRmLookup(routineData.student_id)
        const student = routineData.student as Student | undefined
        const weekStatus = await loadLatestWeekStatusForStudent(routineData.student_id, routineData.created_at)
        setCheckInWeek(weekStatus)
        if (student?.gender === 'F') {
          const { data: cycleRow } = await supabase
            .from('menstrual_cycles')
            .select('*')
            .eq('student_id', routineData.student_id)
            .order('cycle_start_date', { ascending: false })
            .limit(1)
            .maybeSingle()
          setLastMenstrualCycle((cycleRow as MenstrualCycle) ?? null)
        } else {
          setLastMenstrualCycle(null)
        }
      } else {
        setRmLookup(emptyRmLookup())
        setLastMenstrualCycle(null)
        setCheckInWeek({ finished: false, weekNumber: null, lastWeek: false, submittedAt: null })
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
      if (!routineData?.student_id && user && id) {
        const { data: linked } = await supabase
          .from('routine_blueprints')
          .select('id, payload')
          .eq('owner_id', user.id)
          .eq('payload->>library_routine_id', id)
          .maybeSingle()
        setLibraryBlueprintId(linked?.id ?? null)
        libraryBlueprintIdRef.current = linked?.id ?? null
        libraryPayloadRef.current = (linked?.payload as Json | null) ?? null
      } else {
        setLibraryBlueprintId(null)
        libraryBlueprintIdRef.current = null
        libraryPayloadRef.current = null
      }
    } finally {
      setLoading(false)
    }
  }, [id, loadRmLookup, user])

  useEffect(() => { fetchData() }, [fetchData])

  blocksRef.current = blocks
  libraryBlueprintIdRef.current = libraryBlueprintId

  useEffect(() => {
    if (!libraryBlueprintId) return
    const timer = window.setTimeout(() => {
      void syncLibraryBlueprintPayload(libraryBlueprintId, blocksRef.current, libraryPayloadRef.current)
        .then((next) => {
          libraryPayloadRef.current = next
        })
        .catch(() => {
          /* el próximo cambio o el unmount reintenta */
        })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [blocks, libraryBlueprintId])

  useEffect(() => {
    return () => {
      const bpId = libraryBlueprintIdRef.current
      if (!bpId) return
      void syncLibraryBlueprintPayload(bpId, blocksRef.current, libraryPayloadRef.current).catch(() => undefined)
    }
  }, [])

  /** Recarga solo los bloques/días/ejercicios desde la base (sin recargar toda la página).
   *  Sirve para que la Guía semanal refleje cambios tras copiar semanas/días. */
  const refreshBlocks = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('routine_blocks')
      .select(
        '*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(*, muscle_group:muscle_groups(id, name, slug))))',
      )
      .eq('routine_id', id)
      .order('sort_order')
    if (data) {
      const sorted = (data as unknown as BlockWithDays[]).map((b) => ({
        ...b,
        days: [...(b.days ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((d) => ({
          ...d,
          exercises: [...(d.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        })),
      }))
      setBlocks(sorted)
    }
  }, [id])

  useEffect(() => {
    const studentId = routine?.student_id
    if (!studentId) return
    const onFocus = () => void loadRmLookup(studentId)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [routine?.student_id, loadRmLookup])

  // ── Status ────────────────────────────────────────────────────────────────

  async function handleStatusChange(newStatus: string) {
    if (!id) return
    const status = newStatus as Routine['status']
    const completed_at =
      status === 'completada' ? new Date().toISOString() : status === 'activa' ? null : undefined
    const patch: Partial<Routine> = { status, last_status_change: new Date().toISOString() }
    if (completed_at !== undefined) patch.completed_at = completed_at
    await updateRoutine(id, patch)
    setRoutine((prev) =>
      prev ? { ...prev, status, ...(completed_at !== undefined ? { completed_at } : {}) } : prev,
    )
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const libraryId = libraryBlueprintId
    const ok = await deleteRoutine(id)
    if (ok && libraryId) {
      await supabase.from('routine_blueprints').delete().eq('id', libraryId)
    }
    setDeleting(false)
    if (ok) navigate(libraryId ? '/exercises/blueprints' : '/routines')
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  async function handleSendRoutineWhatsApp() {
    if (!id || !user || !routine?.student) return
    setSendingWa(true)
    try {
      await recoverStaleRoutinePdfs(user.id)
      const { data: latestPdf } = await supabase
        .from('routine_pdfs')
        .select('id, file_path, status')
        .eq('routine_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let filePath =
        latestPdf?.status === 'generado' && latestPdf.file_path ? latestPdf.file_path : null

      if (!filePath) {
        const toastId = toast.loading('Generando PDF para enviar…')
        let pdfId = latestPdf?.id
        if (!pdfId) {
          const { data: created, error } = await supabase
            .from('routine_pdfs')
            .insert({ owner_id: user.id, routine_id: id, student_id: routine.student_id, status: 'pendiente' })
            .select('id')
            .single()
          if (error || !created) throw new Error(error?.message ?? 'No se pudo crear el PDF')
          pdfId = created.id
        }
        await generateRoutinePdf(id, pdfId)
        const { data: pdfRecord } = await supabase.from('routine_pdfs').select('file_path').eq('id', pdfId).single()
        filePath = pdfRecord?.file_path ?? null
        toast.dismiss(toastId)
      }

      if (!filePath) {
        toast.error('No se pudo generar el PDF')
        return
      }

      await sendRoutinePdfViaWhatsApp({
        studentPhone: routine.student.phone,
        studentName: routine.student.full_name,
        routineName: routine.name,
        filePath,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar')
    } finally {
      setSendingWa(false)
    }
  }

  async function handleGeneratePdf() {
    if (!id || !user || !routine) return
    setGeneratingPdf(true)
    const toastId = toast.loading('Generando PDF...')
    try {
      await recoverStaleRoutinePdfs(user.id)
      const { data: existing } = await supabase
        .from('routine_pdfs').select('id')
        .eq('routine_id', id)
        .in('status', ['pendiente', 'error', 'generado', 'en_proceso'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

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

  async function handleDownloadProgressLog() {
    if (!routine || blocks.length === 0) return
    setExportingProgressLog(true)
    const toastId = toast.loading('Generando registro de progreso…')
    try {
      await downloadRoutineProgressLogPdf({
        routineName: routine.name,
        studentName: routine.student?.full_name,
        blocks,
      })
      toast.success('Registro de progreso listo para imprimir', { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF', { id: toastId })
    } finally {
      setExportingProgressLog(false)
    }
  }

  // ── Blocks ────────────────────────────────────────────────────────────────

  async function addBlock() {
    if (!id) return
    const dates = initialDatesForNewBlock(blocks, routine?.start_date)
    const { data, error } = await supabase
      .from('routine_blocks')
      .insert({
        routine_id: id,
        name: `Semana ${blocks.length + 1}`,
        sort_order: blocks.length,
        ...(dates ?? {}),
      })
      .select().single()
    if (error) { toast.error(error.message); return }
    const newBlock = { ...data, days: [] } as BlockWithDays
    setBlocks((prev) => [...prev, newBlock])
    setExpandedBlocks((prev) => new Set([...prev, data.id]))
    if (dates) {
      toast.success('Fechas de la semana calculadas según el inicio de la rutina', { duration: 2500 })
    }
  }

  async function updateBlock(blockId: string, patch: Partial<RoutineBlock>) {
    await supabase.from('routine_blocks').update(patch).eq('id', blockId)
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, ...patch } : b))
  }

  /** Inicio de semana → fin +6 días y semanas siguientes en cadena (editable manual después). */
  async function cascadeBlockWeekDates(blockId: string, newStart: string) {
    const patches = cascadeWeekDatesFromBlock(blocks, blockId, newStart)
    if (patches.length === 0) return
    await Promise.all(
      patches.map((p) =>
        supabase
          .from('routine_blocks')
          .update({ start_date: p.start_date, end_date: p.end_date })
          .eq('id', p.id),
      ),
    )
    setBlocks((prev) => {
      const byId = Object.fromEntries(patches.map((p) => [p.id, p]))
      return prev.map((b) => (byId[b.id] ? { ...b, ...byId[b.id] } : b))
    })
    if (patches.length > 1) {
      toast.success(`Fechas actualizadas en ${patches.length} semanas`, { duration: 2500 })
    }
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

  async function copyDayToBlock(sourceBlockId: string, dayId: string, targetBlockId: string) {
    const source = blocks.find((b) => b.id === sourceBlockId)
    const target = blocks.find((b) => b.id === targetBlockId)
    const sourceDay = source?.days.find((d) => d.id === dayId)
    if (!source || !target || !sourceDay) return
    const loadingId = toast.loading(`Copiando «${sourceDay.day_name}» a ${target.name}...`)
    try {
      const { data: newDay, error: dayErr } = await supabase
        .from('routine_days')
        .insert(dayInsertPayload(sourceDay, targetBlockId, target.days.length))
        .select()
        .single()
      if (dayErr || !newDay) throw new Error(dayErr?.message ?? 'No se pudo copiar el día')
      for (const ex of sourceDay.exercises) {
        const { error: exErr } = await supabase.from('routine_exercises').insert(exerciseInsertPayload(ex, newDay.id))
        if (exErr) throw new Error(exErr.message)
      }
      toast.success(`Día copiado a «${target.name}»`, { id: loadingId })
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo copiar el día', { id: loadingId })
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

  async function replaceRoutineExercise(dayId: string, routineExerciseId: string, exercise: Exercise) {
    const { data, error } = await supabase
      .from('routine_exercises')
      // Mantener series/reps/etc.; al cambiar el movimiento del catálogo, el video custom del día anterior no aplica.
      .update({ exercise_id: exercise.id, video_url: null })
      .eq('id', routineExerciseId)
      .select('*, exercise:exercise_library(*, muscle_group:muscle_groups(id, name, slug))')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    const updated = data as unknown as ExWithExercise
    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        days: b.days.map((d) =>
          d.id === dayId
            ? { ...d, exercises: d.exercises.map((e) => (e.id === routineExerciseId ? updated : e)) }
            : d,
        ),
      })),
    )
    setShowExercisePicker(null)
  }

  async function addExercise(dayId: string, exercise: Exercise) {
    const block = blocks.find((b) => b.days.some((d) => d.id === dayId))
    const day = block?.days.find((d) => d.id === dayId)
    const sortOrder = day?.exercises.length ?? 0
    const { data, error } = await supabase
      .from('routine_exercises')
      .insert({ day_id: dayId, exercise_id: exercise.id, sort_order: sortOrder, sets: 3, reps_scheme: null, reps_min: null, reps_max: null, is_superset: false })
      .select('*, exercise:exercise_library(*, muscle_group:muscle_groups(id, name, slug))')
      .single()
    if (error) { toast.error(error.message); return }
    const newEx = data as unknown as ExWithExercise
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d),
    })))
    setShowExercisePicker(null)
  }

  // Cargar preestablecidos cuando se abre el picker de pegado.
  useEffect(() => {
    if (presetPickerDayId == null || !user?.id || presetList.length > 0) return
    void supabase
      .from('preset_blocks')
      .select('*, category:preset_block_categories(*)')
      .eq('owner_id', user.id)
      .order('sort_order')
      .then(({ data }) => setPresetList((data as unknown as PresetBlock[]) ?? []))
  }, [presetPickerDayId, user?.id, presetList.length])

  /** Pega un preestablecido (circuito/bloque) en un día: inserta sus ejercicios con sus parámetros. */
  async function applyPresetToDay(dayId: string, preset: PresetBlock) {
    const day = blocks.find((b) => b.days.some((d) => d.id === dayId))?.days.find((d) => d.id === dayId)
    if (!day) return
    const withId = (preset.payload?.exercises ?? []).filter((e) => e.exercise_id)
    if (withId.length === 0) {
      toast.error('El preestablecido no tiene ejercicios del catálogo')
      return
    }
    let sortOrder = day.exercises.length
    const maxGroup = Math.max(0, ...day.exercises.map((e) => e.superset_group ?? 0))
    const newGroup = preset.kind === 'circuit' ? maxGroup + 1 : null

    const rows = withId.map((e, idx) => {
      const meta: ExerciseMeta = {}
      if (e.percent_rm != null) meta.percent1rm = String(e.percent_rm)
      if (preset.kind === 'circuit' && idx === 0 && preset.block_note) meta.circuitNote = preset.block_note
      const technical_notes = buildExerciseTechnicalNotes('', meta) || null
      const rm = e.percent_rm != null ? resolveRmKgForExercise(rmLookup, e.exercise_id!, e.name) : undefined
      return {
        day_id: dayId,
        exercise_id: e.exercise_id!,
        sort_order: sortOrder++,
        sets: e.sets ?? 3,
        reps_scheme: e.reps_scheme || null,
        reps_min: null,
        reps_max: null,
        rest_seconds: e.rest_seconds ?? null,
        rpe: e.rpe ?? null,
        rir: e.rir ?? null,
        percent_rm: e.percent_rm ?? null,
        weight_kg: rm && e.percent_rm != null ? Math.round(rm * (e.percent_rm / 100) * 10) / 10 : null,
        technical_notes,
        is_superset: preset.kind === 'circuit',
        superset_group: newGroup,
      }
    })

    const { error } = await supabase.from('routine_exercises').insert(rows)
    if (error) {
      toast.error(error.message)
      return
    }
    await refreshBlocks()
    setExpandedDays((prev) => new Set([...prev, dayId]))
    setPresetPickerDayId(null)
    toast.success(`"${preset.name}" pegado en ${day.day_name || 'el día'}`)
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

  /** Arma el patch del ejercicio para una semana del método (reps, %RM→peso, RPE, RIR, descanso, aclaración). */
  function buildWeekPatch(ex: ExWithExercise, wk: NonNullable<TrainingMethod['week_plan']>[number], method: TrainingMethod): Partial<RoutineExercise> {
    const { userNotes, meta } = parseExerciseMeta(ex.technical_notes)
    const patch: Partial<RoutineExercise> = { training_method_id: method.id }
    if (wk.reps_scheme?.trim()) patch.reps_scheme = wk.reps_scheme.trim()
    if (method.default_sets != null) patch.sets = method.default_sets
    if (wk.rir != null) patch.rir = wk.rir
    if (wk.rpe != null) { patch.rpe = wk.rpe; meta.rpeText = String(wk.rpe) }
    if (wk.rest_seconds != null) { patch.rest_seconds = wk.rest_seconds; meta.restText = String(wk.rest_seconds) }
    if (wk.block_note?.trim()) meta.circuitNote = wk.block_note.trim()

    const pct = wk.percent_rm ?? null
    patch.percent_rm = pct
    if (pct != null) {
      meta.percent1rm = String(pct)
      const rmKg = resolveRmKgForExercise(rmLookup, ex.exercise_id, ex.exercise?.name)
      if (rmKg) patch.weight_kg = Math.round(rmKg * (pct / 100) * 10) / 10
    }
    patch.technical_notes = buildExerciseTechnicalNotes(userNotes, meta) || null
    return patch
  }

  /**
   * Aplica el plan por semana de un método al mismo ejercicio.
   * `allDays = false`: solo el día del ejercicio en cada semana.
   * `allDays = true`: el ejercicio en TODOS los días de TODAS las semanas.
   */
  async function applyWeekPlanInternal(sourceEx: RoutineExercise, method: TrainingMethod, allDays: boolean) {
    const plan = method.week_plan
    if (!plan || plan.length === 0) return

    let srcDayName: string | null = null
    if (!allDays) {
      for (const b of blocks) {
        const d = b.days.find((x) => x.id === sourceEx.day_id)
        if (d) { srcDayName = d.day_name; break }
      }
    }

    const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
    const updates: Promise<void>[] = []

    sortedBlocks.forEach((block, weekIdx) => {
      const wk = plan[weekIdx]
      if (!wk) return
      const days = allDays ? block.days : block.days.filter((d) => d.day_name === srcDayName)
      for (const day of days) {
        const ex = day.exercises.find((e) => e.exercise_id === sourceEx.exercise_id)
        if (!ex) continue
        updates.push(updateExercise(day.id, ex.id, buildWeekPatch(ex, wk, method)))
      }
    })

    if (updates.length === 0) {
      toast.error('No se encontró el ejercicio para aplicar el plan')
      return
    }
    await Promise.all(updates)
    setApplyNonce((n) => n + 1) // fuerza re-render de las filas para que se vean los valores aplicados
    toast.success(allDays ? 'Método aplicado a todas las semanas y días' : `Método aplicado a ${updates.length} semana${updates.length > 1 ? 's' : ''}`)
  }

  const applyMethodWeekPlan = (sourceEx: RoutineExercise, method: TrainingMethod) => applyWeekPlanInternal(sourceEx, method, false)
  const applyMethodWeekPlanAllDays = (sourceEx: RoutineExercise, method: TrainingMethod) => applyWeekPlanInternal(sourceEx, method, true)

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
            const patch = prescriptionPatchFrom(srcEx, tgtEx, {
              copyRepsScheme: isMultiarticularExercise(srcEx.exercise),
            })
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

  /** Comentario de cierre que salta como nota para la próxima rutina del alumno (privado, no lo ve el alumno). */
  async function addCompletionNote() {
    const content = completionNote.trim()
    if (!user || !routine || !content) return
    setSavingCompletionNote(true)
    const { error } = await supabase.from('student_routine_notes').insert({
      owner_id: user.id,
      student_id: routine.student_id,
      content,
    })
    setSavingCompletionNote(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setCompletionNote('')
    toast.success('Nota guardada para la próxima rutina')
  }

  async function saveRoutineAsBlueprint() {
    if (!user || !blueprintName.trim()) return
    setSavingBlueprint(true)
    const payload = serializeBlocksToBlueprint(blocks)
    const { error } = await supabase.from('routine_blueprints').insert({
      owner_id: user.id,
      name: blueprintName.trim(),
      description: blueprintDesc.trim() || null,
      category: blueprintCategory.trim() || null,
      subcategory: blueprintSubcategory.trim() || null,
      payload: JSON.parse(JSON.stringify(payload)),
    })
    setSavingBlueprint(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Variante guardada en Rutinas preestablecidas')
    setBlueprintModalOpen(false)
    setBlueprintName('')
    setBlueprintDesc('')
    setBlueprintCategory('')
    setBlueprintSubcategory('')
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

  const totalExercises = blocks.reduce((sum, b) => sum + b.days.reduce((s, d) => s + d.exercises.length, 0), 0)
  // Sin alumno y sin alumno eliminado = preestablecida.
  const isLibrary = !routine.student_id && !routine.former_student_name
  const studentLabel = routine.student?.full_name
    ?? (routine.former_student_name ? `${routine.former_student_name} (eliminado)` : null)

  return (
    <div>
      <Header
        title={isLibrary ? routine.name : (studentLabel ?? 'Rutina')}
        showBack
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowProgressionGuide(true)}
              disabled={blocks.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors disabled:opacity-50"
              title="Guía semanal de progresión (solo entrenador)"
            >
              <Table2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guía semanal</span>
            </button>
            <button
              type="button"
              onClick={() => setShowVolume(true)}
              disabled={blocks.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors disabled:opacity-50"
              title="Volumen semanal por músculo (solo entrenador)"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Volumen</span>
            </button>
            {routine.student_id ? (
              <button
                type="button"
                onClick={() => setShowMacro(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
                title="Calendario anual del macrociclo del alumno (solo entrenador)"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Calendario</span>
              </button>
            ) : null}
            {!isLibrary ? (
            <button
              type="button"
              onClick={() => void handleDownloadProgressLog()}
              disabled={exportingProgressLog || blocks.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors disabled:opacity-50"
              title="PDF imprimible para que el alumno registre pesos y sensaciones"
            >
              {exportingProgressLog ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {exportingProgressLog ? 'Generando…' : 'Registro de progreso'}
              </span>
            </button>
            ) : null}
            {!isLibrary && (routine.status !== 'completada' ? (
              <button
                type="button"
                onClick={() => void handleStatusChange('completada')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                title="Marcar como realizada y mover al historial del alumno"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rutina realizada</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStatusChange('activa')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors bg-surface-elevated text-ink-secondary hover:text-ink-primary"
                title="Reactivar: volver a rutinas activas"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reactivar</span>
              </button>
            ))}
            <button
              onClick={() => navigate(`/routines/${id}/edit`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
              title="Editar datos de la rutina"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar datos</span>
            </button>
            {!isLibrary ? (
            <button
              onClick={duplicateRoutine}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
              title="Duplicar rutina completa"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Duplicar</span>
            </button>
            ) : null}
            {isLibrary ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    if (libraryBlueprintId) {
                      try {
                        libraryPayloadRef.current = await syncLibraryBlueprintPayload(
                          libraryBlueprintId,
                          blocksRef.current,
                          libraryPayloadRef.current,
                        )
                      } catch {
                        /* igual dejamos asignar desde la rutina de biblioteca */
                      }
                      navigate(`/routines?create=1&blueprint=${libraryBlueprintId}`)
                      return
                    }
                    navigate('/routines?create=1')
                  })()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors bg-brand-primary/12 text-brand-primary hover:bg-brand-primary/20"
                title="Asignar esta preestablecida a un alumno"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Asignar a un alumno</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setBlueprintModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated text-xs font-medium transition-colors"
                title="Guardar como variante preestablecida"
              >
                <Library className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guardar variante</span>
              </button>
            )}
            {!isLibrary ? (
            <button
              type="button"
              onClick={() => void handleSendRoutineWhatsApp()}
              disabled={sendingWa || !routine?.student}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50',
                'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
              )}
              title={`Enviar rutina por WhatsApp (${TRAINER_CONTACT_WHATSAPP_DISPLAY})`}
            >
              {sendingWa ? <Spinner className="h-3.5 w-3.5" /> : <WhatsAppIcon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{sendingWa ? 'Enviando…' : 'WhatsApp'}</span>
            </button>
            ) : null}
            {!isLibrary ? (
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50',
                generatingPdf
                  ? 'bg-brand-primary/12 text-brand-primary'
                  : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
              )}
              title="Generar PDF"
            >
              {generatingPdf ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{generatingPdf ? 'Generando...' : 'PDF'}</span>
            </button>
            ) : null}
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

      <div className="page-shell-x page-shell-y space-y-4">

        {/* Info barra compacta (sticky al scrollear) */}
        <div className="sticky top-14 sm:top-16 z-20 -mx-[var(--density-page-x)] px-[var(--density-page-x)] lg:-mx-[var(--density-page-x-lg)] lg:px-[var(--density-page-x-lg)] pt-1 pb-3 bg-surface-base/92 backdrop-blur-md border-b border-surface-border/50">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted mb-0.5">
                {isLibrary ? 'Rutina preestablecida' : routine.name}
              </p>
              <h2 className="text-lg font-bold text-ink-primary truncate">
                {isLibrary ? routine.name : (studentLabel ?? '—')}
              </h2>
            </div>
            <Badge status={routine.status} size="md" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <Calendar className="h-3.5 w-3.5 text-ink-muted mb-0.5" />
              <span className="text-3xs text-ink-muted">Inicio</span>
              <span className="text-xs font-semibold text-ink-primary">{formatDate(routine.start_date)}</span>
            </div>
            <div className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl p-2.5',
              checkInWeek.lastWeek ? 'bg-status-expired/10' : 'bg-surface-elevated',
            )}>
              <Clock className={cn('h-3.5 w-3.5 mb-0.5', checkInWeek.lastWeek ? 'text-status-expired' : 'text-ink-muted')} />
              <span className="text-3xs text-ink-muted">Semana</span>
              <span className={cn('text-xs font-semibold', checkInWeek.lastWeek ? 'text-status-expired' : 'text-ink-primary')}>
                {isLibrary
                  ? '—'
                  : checkInWeek.lastWeek
                    ? 'Última sem.'
                    : checkInWeek.finished
                      ? 'Cerrada'
                      : checkInWeek.weekNumber
                        ? `${checkInWeek.weekNumber} de ${blocks.length || '?'}`
                        : 'Sin check-in'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <Calendar className="h-3.5 w-3.5 text-ink-muted mb-0.5" />
              <span className="text-3xs text-ink-muted">Semanas</span>
              <span className="text-xs font-semibold text-ink-primary">{blocks.length}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-surface-elevated rounded-xl p-2.5">
              <span className="text-3xs text-ink-muted mt-1">Ejercicios</span>
              <span className="text-xs font-semibold text-ink-primary">{totalExercises}</span>
            </div>
          </div>

          {!isLibrary ? (
          <Select
            label="Estado"
            options={ROUTINE_STATUSES}
            value={routine.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />
          ) : (
            <p className="text-2xs text-ink-secondary leading-relaxed">
              Guardada en tu biblioteca. No está asignada a ningún alumno. Cuando quieras dársela a alguien, usá <strong className="text-ink-primary">Asignar a un alumno</strong>.
            </p>
          )}
        </div>
        </div>

        {/* Objetivo */}
        {(routine.objective || routine.notes) && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3 shadow-card">
            {routine.objective && (
              <div className="border-l-[3px] border-l-brand-primary pl-3">
                <p className="text-3xs font-semibold text-brand-primary uppercase tracking-wider mb-1.5">Objetivo del Coach</p>
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{routine.objective}</p>
              </div>
            )}
            {routine.notes && (
              <div className="pt-3 border-t border-surface-border border-l-[3px] border-l-amber-500 pl-3 mt-3">
                <p className="text-3xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">Aclaraciones</p>
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{routine.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Nota de cierre → próxima rutina (solo cuando está completada) */}
        {!isLibrary && routine.status === 'completada' && (
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/50 p-4 dark:border-amber-700/40 dark:bg-amber-950/15">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-ink-primary">Rutina completada — nota para la próxima</p>
            </div>
            <p className="mb-2 text-xs text-ink-secondary">
              Anotá algo a corregir/trabajar en la próxima rutina de {routine.student?.full_name ?? 'el alumno'} (privado, no lo ve el alumno).
            </p>
            <div className="flex gap-2">
              <input
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void addCompletionNote() }
                }}
                placeholder="ej: trabajar movilidad lumbo-pélvica…"
                className="flex-1 rounded-xl border border-amber-300/60 bg-white px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-amber-500 dark:border-amber-700/50 "
              />
              <Button size="sm" variant="secondary" loading={savingCompletionNote} onClick={() => void addCompletionNote()}>
                Guardar nota
              </Button>
            </div>
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
        {lastMenstrualCycle && routine.student?.gender === 'F' ? (
          <p className="text-2xs text-ink-muted">
            Ciclo menstrual: último inicio {formatDate(lastMenstrualCycle.cycle_start_date)} · {lastMenstrualCycle.cycle_length} días. Los avisos por semana usan esas fechas y las del bloque.
          </p>
        ) : null}

        {checkInWeek.lastWeek ? (
          <p className="rounded-xl hh-alert hh-alert-danger px-3 py-2 text-2xs font-medium text-rose-700 dark:text-rose-300">
            Última semana · renovar rutina
            {checkInWeek.weekNumber != null ? ` (va por la semana ${checkInWeek.weekNumber}).` : '.'}
          </p>
        ) : checkInWeek.finished || checkInWeek.weekNumber != null ? (
          <p className="text-2xs text-ink-secondary">
            {checkInWeek.finished
              ? 'El alumno marcó «Terminé mi mes de rutina» en el check-in. Las semanas quedan marcadas como hechas.'
              : `Según el último check-in, va por la semana ${checkInWeek.weekNumber}.`}
          </p>
        ) : null}

        {user && routine.student_id ? (
          <RoutineMonthlyFeedbackSection
            ownerId={user.id}
            studentId={routine.student_id}
            studentName={routine.student?.full_name ?? 'Alumno'}
            studentPhone={routine.student?.phone}
            routine={routine}
            lastWeek={
              checkInWeek.lastWeek && (routine.status === 'activa' || routine.status === 'por_vencer')
            }
          />
        ) : null}

        {blocks.map((block, blockStripeIndex) => (
          <BlockCard
            key={`${block.id}-${applyNonce}`}
            stripeIndex={blockStripeIndex}
            checkInWeekNumber={checkInWeek.weekNumber}
            checkInFinished={checkInWeek.finished}
            block={block}
            allBlocks={blocks}
            cyclePhases={
              lastMenstrualCycle && routine.student?.gender === 'F'
                ? cyclePhasesForWeekBlock(
                    lastMenstrualCycle.cycle_start_date,
                    lastMenstrualCycle.cycle_length,
                    block.start_date,
                    block.end_date,
                  )
                : []
            }
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
            onCascadeWeekStart={(start) => void cascadeBlockWeekDates(block.id, start)}
            onDeleteBlock={() => deleteBlock(block.id)}
            onMoveBlock={(direction) => moveBlock(block.id, direction)}
            onAddDay={() => addDay(block.id)}
            onUpdateDay={(dayId, patch) => updateDay(block.id, dayId, patch)}
            onDeleteDay={(dayId) => deleteDay(block.id, dayId)}
            onDuplicateDay={(dayId) => duplicateDay(block.id, dayId)}
            onCopyDayToWeek={(dayId, targetId) => void copyDayToBlock(block.id, dayId, targetId)}
            onMoveDay={(dayId, direction) => moveDay(block.id, dayId, direction)}
            onAddExercise={(dayId) => setShowExercisePicker({ dayId })}
            onPastePreset={(dayId) => setPresetPickerDayId(dayId)}
            onReplaceExercise={(dayId, routineExerciseId) =>
              setShowExercisePicker({ dayId, replaceRoutineExerciseId: routineExerciseId })}
            onUpdateExercise={updateExercise}
            onApplyMethodWeekPlan={applyMethodWeekPlan}
            onApplyMethodWeekPlanAllDays={applyMethodWeekPlanAllDays}
            onCircuitNoteChange={handleCircuitNoteChange}
            onDeleteExercise={deleteExercise}
            onMoveExercise={moveExercise}
            onOpenCopyMenu={() => setCopyMenuBlock(copyMenuBlock === block.id ? null : block.id)}
            onCloseCopyMenu={() => setCopyMenuBlock(null)}
            onCopyTo={(targetId) => copyBlock(block.id, targetId)}
            onCopyDayPrescription={(sourceDayId, targetDayIds, includeDayMeta) =>
              copyDayPrescriptionToTargets(block.id, sourceDayId, targetDayIds, includeDayMeta)}
            rmLookup={rmLookup}
          />
        ))}

        <Button variant="secondary" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={addBlock}>
          Agregar semana / bloque
        </Button>
      </div>

      {showExercisePicker && (
        <ExercisePicker
          title={
            showExercisePicker.replaceRoutineExerciseId
              ? 'Cambiar ejercicio'
              : 'Seleccionar ejercicio'
          }
          subtitle={
            showExercisePicker.replaceRoutineExerciseId
              ? 'Se mantienen series, repeticiones, pesos y notas de esta fila.'
              : undefined
          }
          onSelect={(ex) => {
            if (showExercisePicker.replaceRoutineExerciseId) {
              void replaceRoutineExercise(
                showExercisePicker.dayId,
                showExercisePicker.replaceRoutineExerciseId,
                ex,
              )
            } else {
              void addExercise(showExercisePicker.dayId, ex)
            }
          }}
          onClose={() => setShowExercisePicker(null)}
        />
      )}

      {blueprintModalOpen && (
        <Modal open onClose={() => setBlueprintModalOpen(false)} size="md" bare className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-primary">Guardar variante preestablecida</h3>
          <button type="button" onClick={() => setBlueprintModalOpen(false)} className="text-ink-muted hover:text-ink-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-ink-secondary mb-3">
          Se guarda la estructura de semanas, días y ejercicios. Después la asignás a un alumno desde su ficha (macrociclo → mesociclo → variante).
        </p>
        <div className="space-y-2">
          <Input
            label="Nombre de la variante *"
            placeholder="Ej: Empuje 4 días"
            value={blueprintName}
            onChange={(e) => setBlueprintName(e.target.value)}
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Macrociclo"
              placeholder="Ej: Hipertrofia 12 semanas"
              value={blueprintCategory}
              onChange={(e) => setBlueprintCategory(e.target.value)}
              className="text-sm"
            />
            <Input
              label="Mesociclo"
              placeholder="Ej: Acumulación"
              value={blueprintSubcategory}
              onChange={(e) => setBlueprintSubcategory(e.target.value)}
              className="text-sm"
            />
          </div>
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
            Guardar variante
          </Button>
        </div>
        </Modal>
      )}

      {routine.student_id ? (
        <MacrocycleCalendarPanel
          open={showMacro}
          onClose={() => setShowMacro(false)}
          studentId={routine.student_id}
          studentName={routine.student?.full_name ?? routine.name}
          onChanged={() => void fetchData()}
        />
      ) : null}

      <RoutineVolumePanel
        open={showVolume}
        onClose={() => setShowVolume(false)}
        routineName={routine.name}
        blocks={blocks}
        onRefresh={refreshBlocks}
      />

      <RoutineProgressionGuidePanel
        open={showProgressionGuide}
        onClose={() => setShowProgressionGuide(false)}
        routineName={routine.name}
        blocks={blocks}
        onRefresh={refreshBlocks}
        onJumpToWeek={(blockId, dayId) => {
          setShowProgressionGuide(false)
          setExpandedBlocks((prev) => new Set([...prev, blockId]))
          if (dayId) setExpandedDays((prev) => new Set([...prev, dayId]))
          // Esperar a que se monte/expanda antes de hacer scroll.
          setTimeout(() => {
            document
              .getElementById(`routine-week-${blockId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 80)
        }}
      />

      {presetPickerDayId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPresetPickerDayId(null)} />
          <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-4 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-primary">Pegar circuito / preestablecido</h3>
              <button type="button" onClick={() => setPresetPickerDayId(null)} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
            </div>
            {presetList.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                No tenés preestablecidos. Crealos en <strong>Base de datos → Circuitos</strong>.
              </p>
            ) : (
              <ul className="space-y-2">
                {presetList.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void applyPresetToDay(presetPickerDayId, p)}
                      className="w-full rounded-xl border border-surface-border bg-surface-elevated/40 px-3 py-2.5 text-left hover:border-brand-secondary/40 hover:bg-brand-secondary/5 transition-colors"
                    >
                      <p className="text-sm font-semibold text-ink-primary">
                        {p.name}
                        <span className="ml-2 rounded bg-surface-elevated px-1.5 py-0.5 text-3xs font-medium text-ink-muted">
                          {p.kind === 'circuit' ? 'Circuito' : 'Individual'} · {p.payload?.exercises?.length ?? 0} ej.
                        </span>
                      </p>
                      {p.block_note && <p className="mt-0.5 text-2xs text-ink-muted">{p.block_note}</p>}
                      {p.category?.name && <p className="mt-0.5 text-3xs uppercase tracking-wide text-brand-secondary">{p.category.name}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={isLibrary ? '¿Eliminar esta preestablecida?' : '¿Eliminar rutina?'}
        description={
          isLibrary
            ? 'Se borra esta variante de tu biblioteca (semanas y ejercicios). Las copias ya asignadas a alumnos no se tocan.'
            : 'Se eliminarán todos los bloques, días y ejercicios asociados. Esta acción no se puede deshacer.'
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
