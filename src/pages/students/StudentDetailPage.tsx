import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Pencil, Trash2, Dumbbell, FileText, FileDown, Plus, Mail, Phone, Calendar, X, StickyNote, Check, DollarSign, ClipboardList, Copy, MessageCircle, Tag, Maximize2, UserRound, UtensilsCrossed, TrendingUp, CalendarCheck, Trophy, CalendarRange, ChevronRight } from 'lucide-react'
import { mealPlanRepo } from '@/data/mealPlans'
import { supabase } from '@/lib/supabase'
import { useStudents } from '@/hooks/useStudents'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { RoutineWeekSquares } from '@/components/checkIn/RoutineWeekSquares'
import { loadLatestWeekStatusForStudent, type LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import { loadBlockCountsByRoutine } from '@/lib/checkIn/routineWeekProgress'
import { loadRmTestWeeksForStudent, markRmTestReminderRead } from '@/lib/checkIn/rmTestReminder'
import { CicloTab } from './CicloTab'
import { StudentRoutineNotesPanel } from '@/components/students/StudentRoutineNotesPanel'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { StudentNotesCard } from '@/components/students/StudentNotesCard'
import { StudentPlanCard } from '@/components/students/StudentPlanCard'
import { AssignPlanModal } from '@/components/students/AssignPlanModal'
import { AssignPresetRoutineModal } from '@/components/routines/AssignPresetRoutineModal'
import { FersterStudentIntakePanel } from '@/components/students/FersterStudentIntakePanel'
import { PsychologistStudentIntakePanel } from '@/components/students/PsychologistStudentIntakePanel'
import { StudentProgressPhotosSection } from '@/components/students/StudentProgressPhotosSection'
import { StudentHabitsPanel } from '@/components/students/StudentHabitsPanel'
import { StudentEngagementStatsPanel } from '@/components/students/StudentEngagementStatsPanel'
import { StudentProgressPanel } from '@/components/students/StudentProgressPanel'
import { MacrocycleCalendarPanel } from '@/components/routines/MacrocycleCalendarPanel'
import { HabitsViewToolbar } from '@/components/habits/HabitsViewToolbar'
import { canSeeTraining } from '@/config/navigation'
import type { Student, Routine, StudentRmRecord, TrainerStudentMealPlan, Income } from '@/types/database'
import { devLog } from '@/lib/devLog'
import { fetchAccessibleStudentById } from '@/lib/students/studentAccess'
import { migrateLocalTrainerPrefsToDb, updateStudentTrainerPrefs } from '@/lib/students/studentTrainerPrefs'
import { PagosTab } from '@/pages/students/studentDetail/PagosTab'
import { PesoTab } from '@/pages/students/studentDetail/PesoTab'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { MarkPaidModal } from '@/components/finances/MarkPaidModal'
import { markRoutinePaid, unmarkRoutinePaid } from '@/lib/finance/routineIncome'
import { type SeguimientoTab, type SheetTab, DETAIL_LEVEL_LABEL, intakeStatusPhrase, intakeRoutinePhrase, routineStatusPillClass, studentAccountStatusChipClass } from './studentDetail/studentDetailShared'
import { FuerzaTab } from './studentDetail/FuerzaTab'
import { QuickPayModal } from './studentDetail/QuickPayModal'

/** Ficha completa del alumno: página dedicada o panel lateral desde la lista. */
export interface StudentDetailViewProps {
  studentId: string
  variant?: 'page' | 'panel'
  onClosePanel?: () => void
  /** Sincroniza lista / finanzas cuando cambian prefs en el panel lateral. */
  onStudentPatch?: (patch: Partial<Student> & { id: string }) => void
}

// ─── Ficha ─────────────────────────────────────────────────────────────────────
const MAX_TRAINER_TAGS = 20
const MAX_TAG_LENGTH = 24

export function StudentDetailView({
  studentId: id,
  variant = 'page',
  onClosePanel,
  onStudentPatch,
}: StudentDetailViewProps) {
  const navigate = useAppNavigate()
  const { deleteStudent } = useStudents()
  const { user, profile }   = useAuthStore()
  const isPsychologist = profile?.role === 'psychologist'
  const entitySingularCapitalized = profile?.role === 'nutritionist' || isPsychologist ? 'Paciente' : 'Alumno'
  const entitySingular = profile?.role === 'nutritionist' || isPsychologist ? 'paciente' : 'alumno'

  const [student,    setStudent]    = useState<Student | null>(null)
  const [routines,   setRoutines]   = useState<Routine[]>([])
  const [rmRecords,  setRmRecords]  = useState<StudentRmRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [sheetTab,      setSheetTab]      = useState<SheetTab>('ficha')
  const [seguimientoTab, setSeguimientoTab] = useState<SeguimientoTab>('peso')

  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const [savingTags, setSavingTags] = useState(false)

  const [assignPlanOpen, setAssignPlanOpen] = useState(false)
  const [assignPresetOpen, setAssignPresetOpen] = useState(false)
  const [savingRoutinePaid, setSavingRoutinePaid] = useState(false)
    const [editPlanAssignment, setEditPlanAssignment] = useState<import('@/types/database').StudentPlanAssignment | null>(null)
  const [planRefreshKey, setPlanRefreshKey] = useState(0)

  async function persistTags(next: string[], rollback: string[]) {
    if (!id) return
    setSavingTags(true)
    const err = await updateStudentTrainerPrefs(id, { trainer_tags: next })
    setSavingTags(false)
    if (err) {
      setTags(rollback)
      toast.error(err)
    } else {
      setStudent((s) => (s ? { ...s, trainer_tags: next } : s))
      if (id) onStudentPatch?.({ id, trainer_tags: next })
      const removed = rollback.length > next.length
      toast.success(removed ? 'Etiqueta quitada' : 'Guardado', { id: 'trainer-tags', duration: 2000 })
    }
  }

  function addTag(t: string) {
    const clean = t.trim().toLowerCase()
    if (!clean || tags.includes(clean) || savingTags) return
    if (clean.length > MAX_TAG_LENGTH) {
      toast.error(`Máximo ${MAX_TAG_LENGTH} caracteres`)
      return
    }
    if (tags.length >= MAX_TRAINER_TAGS) {
      toast.error(`Máximo ${MAX_TRAINER_TAGS} etiquetas`)
      return
    }
    const prev = tags
    const next = [...tags, clean]
    setTags(next)
    setTagInput('')
    void persistTags(next, prev)
  }

  function removeTag(t: string) {
    if (savingTags) return
    const prev = tags
    const next = tags.filter((x) => x !== t)
    setTags(next)
    void persistTags(next, prev)
  }

  // Notas rápidas
  const [editingNotes,  setEditingNotes]  = useState(false)
  const [notesValue,    setNotesValue]    = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Pago rápido
  const [showPayModal,  setShowPayModal]  = useState(false)

  const [mealPlans, setMealPlans] = useState<TrainerStudentMealPlan[]>([])
  const [mealPlansLoading, setMealPlansLoading] = useState(false)
  const [mealPlanPdfBusy, setMealPlanPdfBusy] = useState<string | null>(null)

  /** Rutina a la que se le está registrando el cobro (modal de medio y monto). */
  const [payingRoutine, setPayingRoutine] = useState<Routine | null>(null)

  async function saveRoutinePaid(routineId: string, isPaid: boolean) {
    const routine = routines.find((r) => r.id === routineId)
    if (!routine) return
    if (isPaid) {
      setPayingRoutine(routine)
      return
    }
    setSavingRoutinePaid(true)
    const err = await unmarkRoutinePaid(routineId)
    setSavingRoutinePaid(false)
    if (err) {
      toast.error(err)
      return
    }
    setRoutines((prev) => prev.map((r) => (r.id === routineId ? { ...r, is_paid: false } : r)))
    toast.success('Abono desmarcado: el cobro vuelve a pendiente')
  }

  async function confirmRoutinePaid(values: { amount: number; method: Income['payment_method']; date: string }) {
    if (!user || !id || !payingRoutine) return
    const err = await markRoutinePaid({
      ownerId: user.id,
      routineId: payingRoutine.id,
      routineName: payingRoutine.name,
      studentId: id,
      amount: values.amount,
      method: values.method,
      date: values.date,
    })
    if (err) {
      toast.error(err)
      return
    }
    setRoutines((prev) =>
      prev.map((r) => (r.id === payingRoutine.id ? { ...r, is_paid: true, price: values.amount || r.price } : r)),
    )
    setPayingRoutine(null)
    toast.success('Cobro registrado en Finanzas')
  }

  async function savePaidOtherProfessional(routineId: string, paid: boolean) {
    setSavingRoutinePaid(true)
    const { error } = await supabase
      .from('routines')
      .update({ paid_other_professional: paid })
      .eq('id', routineId)
    setSavingRoutinePaid(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRoutines((prev) =>
      prev.map((r) => (r.id === routineId ? { ...r, paid_other_professional: paid } : r)),
    )
    toast.success(paid ? 'Marcado: pagaste al otro profesional' : 'Desmarcado el pago al otro profesional')
  }

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data: s, error: studentErr } = await fetchAccessibleStudentById(id)
      const [{ data: r }, { data: rm }] = await Promise.all([
        supabase
          .from('routines')
          .select('*')
          .eq('student_id', id)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_rm_records')
          .select('*, exercise:exercise_library(id, name)')
          .eq('student_id', id)
          .eq('owner_id', user.id)
          .order('tested_at', { ascending: false }),
      ])
      if (cancelled) return
      if (studentErr || !s) {
        setStudent(null)
        setTags([])
      } else {
        const merged = await migrateLocalTrainerPrefsToDb(s)
        setStudent(merged)
        setTags(merged.trainer_tags ?? [])
      }
      setRoutines(r ?? [])
      setRmRecords((rm as unknown as StudentRmRecord[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, user])

  useEffect(() => {
    if (!id || !user?.id) return
    if (profile?.role !== 'trainer' && profile?.role !== 'admin') return
    let cancelled = false
    setMealPlansLoading(true)
    ;(async () => {
      try {
        const { data } = await mealPlanRepo.listForStudentByOwner(id, user.id)
        if (!cancelled) setMealPlans((data ?? []) as TrainerStudentMealPlan[])
      } finally {
        if (!cancelled) setMealPlansLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, user?.id, profile?.role])

  const showNutritionTab = profile?.role === 'trainer' || profile?.role === 'admin'
  const showHabitsTab = canSeeTraining(profile?.role)
  const showRoutineTab = canSeeTraining(profile?.role)
  const [macroOpen, setMacroOpen] = useState(false)

  async function reloadRoutines() {
    if (!id || !user) return
    const { data } = await supabase
      .from('routines')
      .select('*')
      .eq('student_id', id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setRoutines(data)
  }

  useEffect(() => {
    if (!showNutritionTab && sheetTab === 'nutricion') setSheetTab('ficha')
  }, [showNutritionTab, sheetTab])

  useEffect(() => {
    if (!showHabitsTab && (sheetTab === 'habitos' || sheetTab === 'progreso')) setSheetTab('ficha')
  }, [showHabitsTab, sheetTab])

  useEffect(() => {
    if (!showRoutineTab && sheetTab === 'rutina') setSheetTab('ficha')
  }, [showRoutineTab, sheetTab])

  useEffect(() => {
    if (student?.gender !== 'F' && seguimientoTab === 'ciclo') setSeguimientoTab('peso')
  }, [student?.gender, seguimientoTab])

  async function downloadMealPlanPdf(plan: TrainerStudentMealPlan) {
    setMealPlanPdfBusy(plan.id)
    try {
      await downloadTrainerStudentMealPlanPdf(plan, {
        professionalName: profile?.full_name,
        studentName: student?.full_name ?? null,
      })
      toast.success('PDF descargado.')
    } catch (e) {
      devLog.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setMealPlanPdfBusy(null)
    }
  }

  /** Marca / desmarca el plan de alimentación como completado (queda en el historial del alumno). */
  async function toggleMealPlanCompleted(plan: TrainerStudentMealPlan) {
    const completed_at = plan.completed_at ? null : new Date().toISOString()
    const { error } = await mealPlanRepo.setCompleted(plan.id, completed_at)
    if (error) {
      toast.error(error.message)
      return
    }
    setMealPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, completed_at } : p)))
    toast.success(completed_at ? 'Plan marcado como completado' : 'Plan reactivado')
  }

  async function cloneMealPlan(plan: TrainerStudentMealPlan) {
    if (!user?.id || !id) return
    const { data, error } = await mealPlanRepo.create({
      owner_id: user.id,
      student_id: id,
      title: `Copia · ${plan.title}`.slice(0, 200),
      data: plan.data,
      cloned_from_id: plan.id,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan clonado en este alumno.')
    setMealPlans((prev) => [data as TrainerStudentMealPlan, ...prev])
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteStudent(id)
    setDeleting(false)
    if (!ok) return
    if (variant === 'panel' && onClosePanel) onClosePanel()
    else navigate('/students')
  }

  async function addRmRecord(record: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) {
    if (!user || !id) return
    const { data, error } = await supabase
      .from('student_rm_records')
      .insert({ ...record, owner_id: user.id, student_id: id })
      .select('*, exercise:exercise_library(id, name)')
      .single()
    if (error) { toast.error(error.message); return }
    // Solo actualizamos el estado DESPUÉS de confirmar el servidor
    setRmRecords((prev) => [data as unknown as StudentRmRecord, ...prev])
    toast.success('RM registrado')
  }

  async function deleteRmRecord(recordId: string) {
    if (!user) return
    // Optimistic: guardamos estado anterior para rollback
    const prev = rmRecords
    setRmRecords((p) => p.filter((r) => r.id !== recordId))
    const { error } = await supabase
      .from('student_rm_records')
      .delete()
      .eq('id', recordId)
      .eq('owner_id', user.id) // ← solo el dueño puede eliminar
    if (error) {
      setRmRecords(prev) // ← rollback si falla
      toast.error(error.message)
    }
  }

  async function saveNotes() {
    if (!user || !id) return
    setSavingNotes(true)
    const { error } = await supabase
      .from('students')
      .update({ notes: notesValue || null })
      .eq('id', id)
      .eq('owner_id', user.id)
    setSavingNotes(false)
    if (error) { toast.error(error.message); return }
    setStudent((prev) => prev ? { ...prev, notes: notesValue || null } : null)
    setEditingNotes(false)
    toast.success('Notas guardadas')
  }

  // Semana de la rutina activa según el formulario semanal (no por fecha de vencimiento).
  const activeRoutineForWeek = routines.find((r) => r.status === 'activa' || r.status === 'por_vencer')
  const [activeRoutineWeek, setActiveRoutineWeek] = useState<{ status: LatestWeekStatus; totalWeeks: number } | null>(null)
  useEffect(() => {
    if (!id || !activeRoutineForWeek) {
      setActiveRoutineWeek(null)
      return
    }
    let cancelled = false
    void Promise.all([
      loadLatestWeekStatusForStudent(id, activeRoutineForWeek.created_at),
      loadBlockCountsByRoutine([activeRoutineForWeek.id]),
    ]).then(([status, counts]) => {
      if (!cancelled) setActiveRoutineWeek({ status, totalWeeks: counts.get(activeRoutineForWeek.id) ?? 0 })
    })
    return () => {
      cancelled = true
    }
    // Solo recargar cuando cambia la rutina / la base del conteo, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeRoutineForWeek?.id, activeRoutineForWeek?.created_at])

  // Aviso TESTEAR RM: semanas de rutina desde el último test o «leído».
  const lastRmTestedAt = rmRecords.reduce<string | null>((max, r) => (!max || r.tested_at > max ? r.tested_at : max), null)
  const [rmTestWeeks, setRmTestWeeks] = useState<number | null>(null)
  useEffect(() => {
    if (!id || !student) return
    let cancelled = false
    void loadRmTestWeeksForStudent(id, student.rm_test_reset_at, lastRmTestedAt)
      .then((w) => { if (!cancelled) setRmTestWeeks(w) })
      .catch(() => { if (!cancelled) setRmTestWeeks(null) })
    return () => {
      cancelled = true
    }
    // Solo recargar cuando cambia la rutina / la base del conteo, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, student?.rm_test_reset_at, lastRmTestedAt])

  async function markRmTestRead() {
    if (!id) return
    const err = await markRmTestReminderRead(id)
    if (err) { toast.error(err); return }
    const now = new Date().toISOString()
    setStudent((prev) => (prev ? { ...prev, rm_test_reset_at: now } : prev))
    setRmTestWeeks(0)
    toast.success('Listo: la cuenta de 12 semanas vuelve a cero')
  }

  function startEditNotes() {
    setNotesValue(student?.notes ?? '')
    setEditingNotes(true)
    setTimeout(() => notesRef.current?.focus(), 50)
  }

  if (loading) {
    return variant === 'page' ? (
      <div><Header title={entitySingularCapitalized} showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-elevated/60 py-24 dark:bg-[rgb(var(--surface-base))]">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!student) {
    return variant === 'page' ? (
      <div><Header title={entitySingularCapitalized} showBack /><p className="p-6 text-ink-muted">{entitySingularCapitalized} no encontrado.</p></div>
    ) : (
      <div className="p-6 text-center text-sm text-ink-muted">{entitySingularCapitalized} no encontrado.</div>
    )
  }

  const activeRoutine = routines.find((r) => r.status === 'activa' || r.status === 'por_vencer')
  /** Etiquetas de solapas principales (solo entrenadores/admins ven Nutrición con planes tipo Excel). */
  const sheetTabDefs: { key: SheetTab; label: string; short?: string; icon: ReactNode }[] = [
    { key: 'ficha', label: 'Información', short: 'Ficha', icon: <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden /> },
    ...(showRoutineTab
      ? [{ key: 'rutina' as const, label: 'Rutina', icon: <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden /> }]
      : []),
    ...(showNutritionTab
      ? [{ key: 'nutricion' as const, label: 'Nutrición', icon: <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" aria-hidden /> }]
      : []),
    {
      key: 'seguimiento',
      label: 'Seguimiento',
      short: 'Control',
      icon: <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />,
    },
    ...(showHabitsTab
      ? [
          { key: 'progreso' as const, label: 'Progreso', icon: <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden /> },
          { key: 'habitos' as const, label: 'Hábitos', icon: <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /> },
        ]
      : []),
  ]

  const selectedPlanLabel =
    student.selected_web_plan_slug === 'plan-entrenamiento'
      ? 'Plan Entrenamiento'
      : student.selected_web_plan_slug === 'plan-nutricion'
      ? 'Plan Nutrición'
      : student.selected_web_plan_slug === 'plan-full'
      ? 'Plan Full'
      : null

  return (
    <div className={cn(variant === 'panel' && 'flex h-full min-h-0 flex-col bg-surface-elevated/60 dark:bg-[rgb(var(--surface-base))]')}>
      {variant === 'page' ? (
        <Header title={student.full_name} showBack />
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-lg border-b border-surface-border/80 bg-white/90 px-4 py-3.5 ">
          <div className="min-w-0 flex-1">
            <p id="student-sheet-title" className="text-3xs font-semibold uppercase tracking-widest text-ink-muted">
              {entitySingularCapitalized}
            </p>
            <p className="truncate text-sm font-semibold text-ink-primary">{student.full_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Abrir en página completa"
              onClick={() => navigate(`/students/${id}`)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            {onClosePanel && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Cerrar" onClick={onClosePanel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'space-y-6',
          variant === 'page' ? 'px-4 py-5 lg:px-6' : 'min-h-0 flex-1 overflow-y-auto px-4 py-5',
        )}
      >
        {/* Solapas principales — tabs “raised” (full width) + sticky en panel */}
        <div
          className={cn(
            '-mx-4 px-4',
            variant === 'page' && 'lg:-mx-6 lg:px-6',
            'border-b border-surface-border/70',
            variant === 'panel' &&
              'sticky top-0 z-[5] bg-surface-base/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface-base/70',
          )}
          role="tablist"
          aria-label="Secciones de la ficha"
        >
          <div className="pt-3">
            <div className="flex w-full items-end gap-0.5 sm:gap-2">
              {sheetTabDefs.map(({ key, label, short, icon }) => {
                const active = sheetTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={label}
                    title={label}
                    onClick={() => setSheetTab(key)}
                    className={cn(
                      'relative -mb-px flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-t-lg px-0.5 pb-2.5 pt-2',
                      'text-3xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-xs',
                      active ? 'text-ink-primary' : 'text-ink-muted hover:text-ink-primary',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="student-sheet-tab"
                        aria-hidden
                        className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand-gradient"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'shrink-0 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5',
                        active ? 'text-brand-primary' : 'text-ink-muted',
                      )}
                    >
                      {icon}
                    </span>
                    {/* En el celu entran ~9 letras por solapa: las largas usan su versión corta. */}
                    <span className="max-w-full truncate">
                      {short ? (
                        <>
                          <span className="sm:hidden">{short}</span>
                          <span className="hidden sm:inline">{label}</span>
                        </>
                      ) : (
                        label
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Información: datos completos del alumno ── */}
        {sheetTab === 'ficha' && (
          <>
        {/* Perfil: sin tarjeta contenedora, tipografía y líneas */}
        <section className="pb-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="order-2 min-w-0 flex-1 sm:order-1">
              <h2 className="text-balance text-lg font-semibold tracking-tight text-ink-primary ">{student.full_name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-medium uppercase tracking-wider">
                <span className={studentAccountStatusChipClass(student.status)}>{intakeStatusPhrase(student.status)}</span>
                <span className="text-ink-muted/50 " aria-hidden>
                  ·
                </span>
                {student.level ? (
                  <>
                    <span className="text-ink-muted ">{DETAIL_LEVEL_LABEL[student.level] ?? student.level}</span>
                    <span className="text-ink-muted/50 " aria-hidden>
                      ·
                    </span>
                  </>
                ) : null}
                <span className="text-ink-muted ">{selectedPlanLabel ?? 'Sin plan web'}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {student.email && (
                  <a
                    href={`mailto:${student.email}`}
                    className="flex items-center gap-1 text-ink-secondary underline-offset-4 transition-colors hover:text-ink-primary hover:underline "
                  >
                    <Mail className="h-3 w-3 opacity-70" aria-hidden />{student.email}
                  </a>
                )}
                {student.phone && (
                  <>
                    <a
                      href={`tel:${student.phone}`}
                      className="flex items-center gap-1 text-ink-secondary underline-offset-4 transition-colors hover:text-ink-primary hover:underline "
                    >
                      <Phone className="h-3 w-3 opacity-70" aria-hidden />{student.phone}
                    </a>
                    <a
                      href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-ink-secondary underline-offset-4 transition-colors hover:text-ink-primary hover:underline "
                    >
                      <MessageCircle className="h-3 w-3 opacity-70" aria-hidden />
                      WhatsApp
                    </a>
                  </>
                )}
                {student.birth_date && (
                  <span className="flex items-center gap-1 text-ink-secondary ">
                    <Calendar className="h-3 w-3 opacity-70" aria-hidden />{formatDate(student.birth_date)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {savingTags ? (
                  <span className="inline-flex h-8 items-center gap-1.5 px-1 text-2xs text-ink-muted" aria-live="polite">
                    <Spinner size="sm" variant="spin" />
                    Guardando…
                  </span>
                ) : null}
                {tags.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      'inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium',
                      'border-surface-border/80 bg-surface-card text-ink-primary shadow-none',
                      '',
                    )}
                  >
                    <span className="truncate">{t}</span>
                    {editingTags && (
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        disabled={savingTags}
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg',
                          'text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary',
                        )}
                        aria-label={`Quitar etiqueta ${t}`}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </span>
                ))}
                {editingTags ? (
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag(tagInput)
                        }
                        if (e.key === 'Escape') setEditingTags(false)
                      }}
                      placeholder="Nueva etiqueta…"
                      disabled={savingTags}
                      className={cn(
                        'h-8 w-36 rounded-xl border border-surface-border/80 bg-surface-card px-3 text-xs text-ink-primary',
                        'outline-none placeholder:text-ink-muted',
                        'focus:border-brand-secondary/35 focus:ring-2 focus:ring-brand-secondary/15',
                        ' ',
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={savingTags || !tagInput.trim()}
                      onClick={() => addTag(tagInput)}
                    >
                      Agregar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTags(false)
                        setTagInput('')
                      }}
                    >
                      Listo
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Tag className="h-3.5 w-3.5" />}
                    onClick={() => setEditingTags(true)}
                  >
                    {tags.length === 0 ? 'Etiqueta' : 'Agregar'}
                  </Button>
                )}
              </div>
            </div>
            <div className="order-1 flex shrink-0 justify-center sm:order-2 sm:justify-end">
              <StudentAvatar
                studentId={student.id}
                fullName={student.full_name}
                avatarPath={student.avatar_path ?? null}
                size="lg"
                allowRemove
                onPathChange={(path) => setStudent((prev) => (prev ? { ...prev, avatar_path: path } : null))}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-surface-border/60 pt-4 ">
            <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => navigate(`/students/${id}/edit`)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="gradientSecondary"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              onClick={() => setShowPayModal(true)}
            >
              Registrar pago
            </Button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-ink-muted transition-colors hover:text-ink-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </section>

        <FersterStudentIntakePanel student={student} />
        <PsychologistStudentIntakePanel student={student} />

        <StudentProgressPhotosSection
          studentId={student.id}
          canManage={
            !!(user &&
              student.owner_id === user.id &&
              profile &&
              (profile.role === 'trainer' ||
                profile.role === 'admin' ||
                profile.role === 'nutritionist' ||
                profile.role === 'psychologist'))
          }
        />

            {/* Notas / observaciones */}
            {editingNotes ? (
              <div className="space-y-3 border-t border-surface-border/60 pt-4 ">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-brand-secondary" aria-hidden />
                  <span className="text-sm font-semibold text-ink-primary">Observaciones</span>
                </div>
                <textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={5}
                  className="w-full resize-none border border-surface-border/80 bg-surface-elevated/60 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-brand-primary/60 "
                  placeholder="Observaciones, lesiones, objetivos..."
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="text-xs text-ink-muted hover:text-ink-primary px-3 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    Cancelar
                  </button>
                  <Button type="button" size="sm" variant="secondary" loading={savingNotes} icon={<Check className="h-3.5 w-3.5" />} onClick={saveNotes}>
                    {savingNotes ? 'Guardando…' : 'Guardar'}
                  </Button>
                </div>
              </div>
            ) : student.notes ? (
              <div className="relative group">
                <StudentNotesCard notes={student.notes} variant="minimal" />
                <button
                  onClick={startEditNotes}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors opacity-0 group-hover:opacity-100"
                  title="Editar notas"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditNotes}
                className="flex w-full items-center gap-2 border-b border-dashed border-surface-inputBorder/80 py-4 text-sm text-ink-muted transition-colors hover:border-surface-inputBorder hover:text-ink-primary "
              >
                <StickyNote className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
                Agregar observaciones...
              </button>
            )}
          </>
        )}

        {/* ── Rutina ── */}
        {sheetTab === 'rutina' && (() => {
          const completedRoutines = routines.filter((r) => r.status === 'completada')
          const historialRoutines = routines.filter((r) => r.status !== 'completada')
          const rutinaHistorialVacío = historialRoutines.length === 0
          const fi = student.intake_ferster as Record<string, unknown> | null

          // Labels para chips de perfil de entrenamiento
          const goalLabel: Record<string, string> = {
            healthy_life: 'Vida saludable', sport: 'Deporte', cut_lean: 'Bajar / definir', bulk: 'Ganar músculo',
          }
          const expLabel: Record<string, string> = {
            never: 'Sin experiencia', less_than_1y: '< 1 año', '1_to_3y': '1–3 años', more_than_3y: '+3 años',
          }
          const intensityLabel: Record<string, string> = {
            light: 'Intensidad suave', moderate: 'Intensidad moderada', intense: 'Intensidad alta', very_intense: 'Muy intensa',
          }
          const equipLabel: Record<string, string> = {
            none: 'Sin equipo', home: 'Casa', gym_basic: 'Gym básico', gym_advanced: 'Gym completo',
          }

          // Chips de perfil visibles si hay intake_ferster
          const profileChips: { label: string }[] = fi ? [
            fi.main_goal ? { label: goalLabel[fi.main_goal as string] ?? String(fi.main_goal) } : null,
            fi.training_since ? { label: expLabel[fi.training_since as string] ?? String(fi.training_since) } : null,
            fi.days_per_week ? { label: `${fi.days_per_week}× / semana` } : null,
            fi.training_intensity ? { label: intensityLabel[fi.training_intensity as string] ?? String(fi.training_intensity) } : null,
            fi.equipment ? { label: equipLabel[fi.equipment as string] ?? String(fi.equipment) } : null,
          ].filter(Boolean) as { label: string }[] : []

          // Progreso barra rutina activa
          const weekSt = activeRoutineWeek?.status
          const weekTotal = activeRoutineWeek?.totalWeeks ?? 0
          const weekCurrent = weekSt?.finished || weekSt?.lastWeek ? weekTotal : weekSt?.weekNumber ?? 0
          const routineProgressPct = weekTotal > 0 ? Math.min(100, (weekCurrent / weekTotal) * 100) : 0

          // Semanas de duración de una rutina
          function routineWeeks(r: Routine): number | null {
            if (!r.start_date || !r.end_date) return null
            const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86_400_000)
            return Math.max(1, Math.round(days / 7))
          }

          return (
          <div className="space-y-8">

            {/* ── Calendario anual del macrociclo (solo entrenador) ── */}
            <button
              type="button"
              onClick={() => setMacroOpen(true)}
              className="group flex w-full items-center gap-3 rounded-xl border border-surface-border/80 bg-surface-card px-4 py-3 text-left shadow-xs transition-colors hover:border-brand-primary/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <CalendarRange className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-primary">Calendario anual del macrociclo</span>
                <span className="block text-2xs text-ink-muted">Bloques del año como barras: mover, copiar y ver alertas de volumen. Solo vos lo ves.</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* ── Notas para la próxima rutina ── */}
            {id ? <StudentRoutineNotesPanel studentId={id} /> : null}

            {/* ── Plan vigente ── */}
            {id ? (
              <StudentPlanCard
                studentId={id}
                refreshKey={planRefreshKey}
                onRequestAssign={() => { setEditPlanAssignment(null); setAssignPlanOpen(true) }}
                onRequestEdit={(a) => { setEditPlanAssignment(a); setAssignPlanOpen(true) }}
              />
            ) : null}

            {/* ── Rutina activa ── */}
            {activeRoutine ? (
              <section className="rounded-xl border border-surface-border/70 bg-surface-elevated/60 overflow-hidden">
                {/* Barra de progreso top */}
                <div className="h-1 w-full bg-surface-border/70 ">
                  <div
                    className="h-full bg-brand-secondary transition-all duration-700"
                    style={{ width: `${routineProgressPct}%` }}
                  />
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-ink-muted ">Rutina activa</p>
                      <p className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink-primary ">{activeRoutine.name}</p>
                      {activeRoutine.objective?.trim() ? (
                        <p className="mt-1 max-w-lg text-body-sm leading-relaxed text-ink-muted ">{activeRoutine.objective}</p>
                      ) : null}
                    </div>
                    <span className={routineStatusPillClass(activeRoutine.status)}>{intakeRoutinePhrase(activeRoutine.status)}</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-surface-border/60 pt-4 ">
                    <div>
                      <dt className="text-3xs font-semibold uppercase tracking-[0.12em] text-ink-muted ">Inicio</dt>
                      <dd className="mt-1 text-sm tabular-nums text-ink-secondary ">{formatDate(activeRoutine.start_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-3xs font-semibold uppercase tracking-[0.12em] text-ink-muted ">Semana</dt>
                      <dd className="mt-1">
                        <RoutineWeekSquares
                          totalWeeks={weekTotal}
                          currentWeek={weekSt?.weekNumber ?? null}
                          finished={!!weekSt?.finished}
                          lastWeek={!!weekSt?.lastWeek}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-3xs font-semibold uppercase tracking-[0.12em] text-ink-muted ">Semanas restantes</dt>
                      <dd className={cn(
                        'mt-1 text-sm tabular-nums font-semibold',
                        weekSt?.lastWeek ? 'text-status-expired' : 'text-ink-primary ',
                      )}>
                        {weekSt?.lastWeek
                          ? 'Última semana'
                          : weekSt?.finished
                            ? 'Cerrada'
                            : weekTotal > 0
                              ? Math.max(0, weekTotal - weekCurrent)
                              : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-surface-border/60 pt-4 ">
                    <label className="inline-flex items-center gap-2 text-body-sm font-medium text-ink-primary ">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-surface-border accent-brand-secondary"
                        checked={!!activeRoutine.is_paid}
                        disabled={savingRoutinePaid}
                        onChange={(e) => void saveRoutinePaid(activeRoutine.id, e.target.checked)}
                      />
                      ¿Abonó?
                    </label>
{activeRoutine.price ? (
                      <span className="text-xs tabular-nums text-ink-secondary">{formatCurrency(activeRoutine.price)}</span>
                    ) : null}
                    {activeRoutine.is_paid ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-3xs font-semibold text-emerald-700 dark:text-emerald-300">
                        Abonada
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-3xs font-semibold text-amber-700 dark:text-amber-300">
                        Pendiente
                      </span>
                    )}
                    <label className="inline-flex items-center gap-2 text-body-sm font-medium text-ink-primary ">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-surface-border accent-brand-secondary"
                        checked={!!activeRoutine.paid_other_professional}
                        disabled={savingRoutinePaid}
                        onChange={(e) => void savePaidOtherProfessional(activeRoutine.id, e.target.checked)}
                      />
                      ¿Abonó al otro profesional?
                    </label>
                  </div>

                  {/* Chips perfil entrenamiento */}
                  {profileChips.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-surface-border/60 pt-4 ">
                      {profileChips.map((c) => (
                        <span key={c.label} className="rounded-md border border-surface-border/80 bg-white px-2 py-0.5 text-2xs font-medium text-ink-secondary dark:bg-zinc-800/60 ">
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="sm"
                      variant="gradientSecondary"
                      className="sm:flex-1"
                      onClick={() => navigate(`/routines/${activeRoutine.id}`)}
                    >
                      Abrir rutina
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAssignPresetOpen(true)}
                      className="sm:flex-1"
                    >
                      Preestablecida
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileText className="h-3.5 w-3.5" />}
                      onClick={() => navigate('/routine-pdfs')}
                      className="sm:flex-1"
                    >
                      PDF
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              /* ── Empty state sin rutina ── */
              <div className="rounded-xl border border-dashed border-surface-inputBorder/80 overflow-hidden">
                <div className="flex items-stretch">
                  {/* Acento izquierdo */}
                  <div className="w-1 shrink-0 bg-zinc-300/60 " />
                  <div className="flex-1 px-5 py-6">
                    <p className="text-3xs font-semibold uppercase tracking-[0.16em] text-ink-muted ">Sin rutina activa</p>
                    <p className="mt-2 text-[15px] font-semibold text-ink-primary ">
                      {student.full_name.split(' ')[0]} no tiene una rutina asignada
                    </p>
                    <p className="mt-1.5 max-w-sm text-body-sm leading-relaxed text-ink-muted ">
                      {rutinaHistorialVacío
                        ? 'Creá la primera rutina para este alumno.'
                        : 'Tiene rutinas en el historial. Podés abrirlas para renovar o activar un período.'}
                    </p>

                    {/* Chips perfil entrenamiento si hay datos */}
                    {profileChips.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {profileChips.map((c) => (
                          <span key={c.label} className="rounded-md border border-surface-border bg-surface-elevated/80 px-2 py-0.5 text-2xs font-medium text-ink-secondary ">
                            {c.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="gradientSecondary"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => navigate(`/routines?create=1&student=${id}`)}
                      >
                        {rutinaHistorialVacío ? 'Crear rutina' : 'Nueva rutina'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAssignPresetOpen(true)}
                      >
                        Rutinas preestablecidas
                      </Button>
                      {!rutinaHistorialVacío && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/routines?create=1&student=${id}`)}
                        >
                          Ver historial
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Historial ── */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border/55 pb-3 ">
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-ink-muted ">Historial</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-ink-primary ">Rutinas anteriores</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  className={cn(
                    '!h-8 text-xs font-semibold',
                    rutinaHistorialVacío
                      ? 'text-ink-muted hover:bg-surface-elevated hover:text-ink-secondary '
                      : '!text-brand-secondary hover:bg-brand-secondary/10',
                  )}
                  onClick={() => navigate(`/routines?create=1&student=${id}`)}
                >
                  Nueva
                </Button>
              </div>

              {rutinaHistorialVacío ? (
                <p className="py-6 text-center text-body-sm text-ink-muted ">
                  Todavía no hay rutinas activas.
                </p>
              ) : (
                <ul className="divide-y divide-surface-border/70 ">
                  {historialRoutines.map((r) => {
                    const weeks = routineWeeks(r)
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/routines/${r.id}`)}
                          className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface-elevated/80 "
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-semibold text-ink-primary ">{r.name}</p>
                            <p className="mt-0.5 flex items-center gap-2 text-2xs tabular-nums text-ink-muted">
                              <span>{formatDate(r.start_date)} → {formatDate(r.end_date)}</span>
                              {weeks != null && (
                                <span className="rounded bg-surface-elevated px-1.5 py-px font-medium ">
                                  {weeks} sem.
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={routineStatusPillClass(r.status, true)}>{intakeRoutinePhrase(r.status)}</span>
                            <span className="text-ink-muted/50 transition-colors group-hover:text-ink-muted ">›</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* ── Rutinas completadas (historial) ── */}
            {completedRoutines.length > 0 && (
              <section>
                <div className="border-b border-surface-border/55 pb-3 ">
                  <p className="text-3xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">Historial</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-ink-primary ">
                    Rutinas completadas ({completedRoutines.length})
                  </h3>
                </div>
                <ul className="divide-y divide-surface-border/70 ">
                  {completedRoutines.map((r) => {
                    const weeks = routineWeeks(r)
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/routines/${r.id}`)}
                          className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface-elevated/80 "
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-semibold text-ink-primary ">{r.name}</p>
                            <p className="mt-0.5 flex items-center gap-2 text-2xs tabular-nums text-ink-muted">
                              <span>{formatDate(r.start_date)} → {formatDate(r.end_date)}</span>
                              {r.completed_at && (
                                <span className="rounded bg-emerald-100 px-1.5 py-px font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  ✓ {formatDate(r.completed_at.slice(0, 10))}
                                </span>
                              )}
                              {weeks != null && (
                                <span className="rounded bg-surface-elevated px-1.5 py-px font-medium ">{weeks} sem.</span>
                              )}
                            </p>
                          </div>
                          <span className="text-ink-muted/50 transition-colors group-hover:text-ink-muted ">›</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
          )
        })()}

        {/* ── Nutrición ── */}
        {sheetTab === 'nutricion' && showNutritionTab && (
          <section>
            <div className="border-b border-surface-border/50 pb-4 ">
              <div className="flex items-center gap-2 text-ink-primary ">
                <ClipboardList className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                <h3 className="text-sm font-semibold">Planes de alimentación</h3>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Asignados desde Plan de alimentación.{' '}
                <button
                  type="button"
                  className="font-medium text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline "
                  onClick={() => navigate('/meal-plans')}
                >
                  Ver todos
                </button>
              </p>
            </div>
            {mealPlansLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : mealPlans.length === 0 ? (
              <EmptyState
                className="py-10"
                icon={<ClipboardList className="h-7 w-7" aria-hidden />}
                title="Sin planes asignados"
                description="Asigná un plan desde Plan de alimentación para verlo en esta ficha."
                action={{ label: 'Ir a planes de alimentación', onClick: () => navigate('/meal-plans') }}
              />
            ) : (
              (() => {
                const vigentes = mealPlans.filter((p) => !p.completed_at)
                const completados = mealPlans.filter((p) => p.completed_at)
                const renderPlan = (p: TrainerStudentMealPlan) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-primary ">{p.title}</p>
                      <p className="text-2xs text-ink-muted">
                        {p.start_date || p.end_date ? (
                          <span className="mr-2 font-medium text-ink-secondary ">
                            {p.start_date ? formatDate(p.start_date) : '—'} → {p.end_date ? formatDate(p.end_date) : '—'}
                          </span>
                        ) : null}
                        {p.completed_at ? (
                          <span className="mr-2 rounded bg-emerald-100 px-1.5 py-px font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            ✓ Completado {formatDate(p.completed_at.slice(0, 10))}
                          </span>
                        ) : null}
                        Actualizado {formatDate(p.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        variant={p.completed_at ? 'secondary' : 'outline'}
                        size="sm"
                        icon={<Check className="h-3.5 w-3.5" />}
                        onClick={() => void toggleMealPlanCompleted(p)}
                        title={p.completed_at ? 'Volver a vigente' : 'Marcar plan de alimentación completado'}
                      >
                        {p.completed_at ? 'Reactivar' : 'Completado'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={mealPlanPdfBusy === p.id}
                        icon={<FileDown className="h-3.5 w-3.5" />}
                        onClick={() => void downloadMealPlanPdf(p)}
                      >
                        PDF
                      </Button>
                      <Button variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void cloneMealPlan(p)}>
                        Clonar
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/students/${id}/meal-plan/${p.id}`)}>
                        Ver
                      </Button>
                    </div>
                  </li>
                )
                return (
                  <>
                    <ul className="divide-y divide-surface-border/60 ">{vigentes.map(renderPlan)}</ul>
                    {completados.length > 0 && (
                      <div className="mt-6">
                        <p className="border-b border-surface-border/55 pb-2 text-3xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                          Planes completados ({completados.length})
                        </p>
                        <ul className="divide-y divide-surface-border/60 ">{completados.map(renderPlan)}</ul>
                      </div>
                    )}
                  </>
                )
              })()
            )}
          </section>
        )}

        {/* ── Seguimiento (peso, fuerza, pagos, ciclo) ── */}
        {sheetTab === 'seguimiento' && (
          <div className="space-y-4">
            <div className="-mx-px flex border-b border-surface-border/60 " role="tablist" aria-label="Seguimiento">
              {(
                [
                  { value: 'peso' as const, label: 'Peso' },
                  { value: 'fuerza' as const, label: 'Fuerza' },
                  { value: 'pagos' as const, label: 'Pagos' },
                  ...(student.gender === 'F' ? ([{ value: 'ciclo' as const, label: 'Ciclo' }] as const) : []),
                ] as { value: SeguimientoTab; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={seguimientoTab === value}
                  onClick={() => setSeguimientoTab(value)}
                  className={cn(
                    '-mb-px flex-1 border-b-2 px-2 py-2.5 text-center text-2xs font-semibold uppercase tracking-wide transition-colors sm:text-xs',
                    seguimientoTab === value
                      ? 'border-b-zinc-900 text-ink-primary dark:border-b-zinc-200 '
                      : 'border-transparent text-ink-muted hover:text-ink-primary ',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {seguimientoTab === 'pagos' && (
              <PagosTab
                studentId={id!}
                studentName={student.full_name}
                monthlyFee={student.monthly_fee_amount}
                onMonthlyFeeChange={(amount) => {
                  setStudent((s) => (s ? { ...s, monthly_fee_amount: amount } : s))
                  if (id) onStudentPatch?.({ id, monthly_fee_amount: amount })
                }}
                onRegisterPago={() => setShowPayModal(true)}
                paymentDayFrom={student.payment_day_from ?? null}
                paymentDayTo={student.payment_day_to ?? null}
              />
            )}

            {seguimientoTab === 'ciclo' && <CicloTab studentId={id!} />}

            {seguimientoTab === 'peso' && (
              <PesoTab
                studentId={id!}
                targetWeightKg={student.target_weight_kg}
                onTargetWeightKgChange={(kg) => {
                  setStudent((s) => (s ? { ...s, target_weight_kg: kg } : s))
                  if (id) onStudentPatch?.({ id, target_weight_kg: kg })
                }}
              />
            )}

            {seguimientoTab === 'fuerza' && (
              <FuerzaTab
                records={rmRecords}
                onAdd={addRmRecord}
                onDelete={deleteRmRecord}
                rmTestWeeks={rmTestWeeks}
                onRmTestRead={markRmTestRead}
              />
            )}
          </div>
        )}

        {id && showRoutineTab ? (
          <MacrocycleCalendarPanel
            open={macroOpen}
            onClose={() => setMacroOpen(false)}
            studentId={id}
            studentName={student.full_name}
            onChanged={() => void reloadRoutines()}
          />
        ) : null}

        {sheetTab === 'progreso' && showHabitsTab && (
          <StudentProgressPanel studentId={id!} studentName={student.full_name} rmRecords={rmRecords} />
        )}

        {sheetTab === 'habitos' && showHabitsTab && (
          <div className="space-y-4">
            <StudentEngagementStatsPanel
              studentId={id!}
              studentName={student.full_name}
              studentPhone={student.phone}
              routines={routines}
            />
            <div className="min-h-0 rounded-xl bg-surface-elevated/80 p-1 ">
              <StudentHabitsPanel studentId={id!} toolbarLeading={<HabitsViewToolbar studentId={id!} />} />
            </div>
          </div>
        )}
      </div>

      <MarkPaidModal
        open={!!payingRoutine}
        title={student.full_name}
        subtitle={payingRoutine?.name}
        defaultAmount={payingRoutine?.price ?? null}
        onClose={() => setPayingRoutine(null)}
        onConfirm={confirmRoutinePaid}
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={`¿Eliminar ${entitySingular}?`}
        description="Esta acción no se puede deshacer. Se borran sus datos; sus rutinas se conservan."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />

      {showPayModal && student && (
        <QuickPayModal
          studentId={student.id}
          studentName={student.full_name}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {id ? (
        <AssignPlanModal
          open={assignPlanOpen}
          studentId={id}
          editAssignment={editPlanAssignment}
          onClose={() => { setAssignPlanOpen(false); setEditPlanAssignment(null) }}
          onAssigned={() => setPlanRefreshKey((k) => k + 1)}
        />
      ) : null}
      {id && student ? (
        <AssignPresetRoutineModal
          open={assignPresetOpen}
          studentId={id}
          studentName={student.full_name}
          onClose={() => setAssignPresetOpen(false)}
          onPick={(blueprintId) => {
            setAssignPresetOpen(false)
            navigate(`/routines?create=1&student=${id}&blueprint=${blueprintId}`)
          }}
        />
      ) : null}
    </div>
  )
}

/** Ruta `/students/:id` — mismo contenido que el panel lateral. */
export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const role = useAuthStore((s) => s.profile?.role)
  const entitySingularCapitalized = role === 'nutritionist' ? 'Paciente' : 'Alumno'
  if (!id) {
    return (
      <div>
        <Header title={entitySingularCapitalized} showBack />
        <p className="p-6 text-ink-muted">Identificador no válido.</p>
      </div>
    )
  }
  return <StudentDetailView studentId={id} variant="page" />
}
