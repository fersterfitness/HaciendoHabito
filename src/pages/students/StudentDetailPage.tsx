import { useEffect, useState, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Pencil, Trash2, Dumbbell, FileText, FileDown, Plus,
  Mail, Phone, Calendar, Zap, X, ChevronDown,
  StickyNote, Check, DollarSign, ClipboardList, Copy, MessageCircle, Tag,
  Maximize2, UserRound, UtensilsCrossed, TrendingUp,
  CalendarCheck,
} from 'lucide-react'
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
import { loadRmTestWeeksForStudent, markRmTestReminderRead, RM_TEST_EVERY_WEEKS } from '@/lib/checkIn/rmTestReminder'
import { useTheme } from '@/contexts/ThemeContext'
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
import { HabitsViewToolbar } from '@/components/habits/HabitsViewToolbar'
import { canSeeTraining } from '@/config/navigation'
import type { Student, Routine, Exercise, StudentRmRecord, TrainerStudentMealPlan, Income } from '@/types/database'
import { INCOME_TYPES, PAYMENT_METHODS } from '@/lib/constants'
import { devLog } from '@/lib/devLog'
import { fetchAccessibleStudentById } from '@/lib/students/studentAccess'
import {
  migrateLocalTrainerPrefsToDb,
  updateStudentTrainerPrefs,
} from '@/lib/students/studentTrainerPrefs'
import { PagosTab } from '@/pages/students/studentDetail/PagosTab'
import { PesoTab } from '@/pages/students/studentDetail/PesoTab'
import { buildPersonalFullMirrorIncomeRow, buildPersonalHalfIncomeRow } from '@/lib/financePersonalSplit'
import { notifyPaymentRegistered } from '@/lib/notifications'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { Modal } from '@/components/ui/Modal'
import { motion } from 'motion/react'
import { MarkPaidModal } from '@/components/finances/MarkPaidModal'
import { markRoutinePaid, unmarkRoutinePaid } from '@/lib/finance/routineIncome'

/** Pestañas dentro de Seguimiento (peso, fuerza, pagos, ciclo). */
type SeguimientoTab = 'peso' | 'fuerza' | 'pagos' | 'ciclo'

/** Solapas principales de la ficha / panel lateral. */
type SheetTab = 'ficha' | 'rutina' | 'nutricion' | 'seguimiento' | 'habitos'

const DETAIL_LEVEL_LABEL: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function intakeStatusPhrase(status: string): string {
  const m: Record<string, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    pausado: 'Pausado',
    baja: 'Baja',
  }
  return m[status] ?? status
}

function intakeRoutinePhrase(status: string): string {
  const m: Record<string, string> = {
    activa: 'Activa',
    por_vencer: 'Por vencer',
    vencida: 'Vencida',
    pausada: 'Pausada',
    cancelada: 'Cancelada',
  }
  return m[status] ?? status
}


/** Píldora de estado de rutina (activa = verde; resto semántico). */
function routineStatusPillClass(status: string, compact = false): string {
  const sizing = compact ? 'px-1.5 py-px text-3xs' : 'px-2 py-0.5 text-3xs'
  const base = cn('rounded border font-semibold uppercase tracking-wide', sizing)
  switch (status) {
    case 'activa':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'por_vencer':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'vencida':
      return cn(
        base,
        'border-rose-400/45 bg-rose-500/12 text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-400',
      )
    case 'pausada':
      return cn(
        base,
        'border-status-paused/35 bg-status-paused/15 text-status-paused',
      )
    case 'cancelada':
      return cn(base, 'border-surface-border/60 bg-surface-border/40 text-ink-muted')
    default:
      return cn(base, 'border-surface-border/80 text-ink-secondary')
  }
}

/** Estado de cuenta del alumno en la ficha. */
function studentAccountStatusChipClass(status: string): string {
  const base = 'rounded border px-1.5 py-0.5'
  switch (status) {
    case 'activo':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'pausado':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'inactivo':
      return cn(base, 'border-zinc-400/55 bg-ink-muted/12 text-ink-secondary dark:border-zinc-600')
    case 'baja':
      return cn(base, 'border-rose-400/40 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-400')
    default:
      return cn(base, 'border-surface-border/80 text-ink-muted')
  }
}

/** Línea de estado en historial de pagos. */
// ─── Epley formula ────────────────────────────────────────────────────────────
function epley1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// ─── RM percentages table ─────────────────────────────────────────────────────
const RM_PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

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
        const { data } = await supabase
          .from('trainer_student_meal_plans')
          .select('*')
          .eq('student_id', id)
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false })
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

  useEffect(() => {
    if (!showNutritionTab && sheetTab === 'nutricion') setSheetTab('ficha')
  }, [showNutritionTab, sheetTab])

  useEffect(() => {
    if (!showHabitsTab && sheetTab === 'habitos') setSheetTab('ficha')
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
    const { error } = await supabase
      .from('trainer_student_meal_plans')
      .update({ completed_at })
      .eq('id', plan.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setMealPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, completed_at } : p)))
    toast.success(completed_at ? 'Plan marcado como completado' : 'Plan reactivado')
  }

  async function cloneMealPlan(plan: TrainerStudentMealPlan) {
    if (!user?.id || !id) return
    const { data, error } = await supabase
      .from('trainer_student_meal_plans')
      .insert({
        owner_id: user.id,
        student_id: id,
        title: `Copia · ${plan.title}`.slice(0, 200),
        data: plan.data,
        cloned_from_id: plan.id,
      })
      .select('*')
      .single()
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
  const sheetTabDefs: { key: SheetTab; label: string; icon: ReactNode }[] = [
    { key: 'ficha', label: 'Información', icon: <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden /> },
    ...(showRoutineTab
      ? [{ key: 'rutina' as const, label: 'Rutina', icon: <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden /> }]
      : []),
    ...(showNutritionTab
      ? [{ key: 'nutricion' as const, label: 'Nutrición', icon: <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" aria-hidden /> }]
      : []),
    {
      key: 'seguimiento',
      label: 'Seguimiento',
      icon: <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />,
    },
    ...(showHabitsTab
      ? [{ key: 'habitos' as const, label: 'Hábitos', icon: <CalendarCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /> }]
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
            <div className="flex w-full items-end gap-2">
              {sheetTabDefs.map(({ key, label, icon }) => {
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
                      'relative -mb-px flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-t-lg px-1 pb-2.5 pt-2',
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
                    <span className="max-w-full truncate">{label}</span>
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


// ─── FuerzaTab ────────────────────────────────────────────────────────────────

/** Paleta categórica validada (claro / oscuro); el color sigue al ejercicio, no al orden. */
const RM_SERIES_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500'],
}
const RM_MAX_COMPARE = RM_SERIES_COLORS.light.length

/** Mismo ejercicio aunque esté cargado dos veces en la biblioteca («Sentadilla con barra»). */
function rmExerciseKey(r: StudentRmRecord): string {
  const name = r.exercise?.name?.trim()
  if (!name) return `id:${r.exercise_id}`
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

type RmGroup = {
  key: string
  name: string
  /** Del más nuevo al más viejo. */
  history: StudentRmRecord[]
}

function FuerzaTab({
  records,
  onAdd,
  onDelete,
  rmTestWeeks,
  onRmTestRead,
}: {
  records: StudentRmRecord[]
  onAdd: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Semanas desde el último test (null = cargando). */
  rmTestWeeks: number | null
  onRmTestRead: () => Promise<void>
}) {
  const { theme } = useTheme()
  const palette = theme === 'dark' ? RM_SERIES_COLORS.dark : RM_SERIES_COLORS.light

  const groups = useMemo((): RmGroup[] => {
    const map = new Map<string, RmGroup>()
    const sorted = [...records].sort(
      (a, b) => b.tested_at.localeCompare(a.tested_at) || b.created_at.localeCompare(a.created_at),
    )
    for (const r of sorted) {
      const key = rmExerciseKey(r)
      if (!map.has(key)) map.set(key, { key, name: r.exercise?.name ?? '—', history: [] })
      map.get(key)!.history.push(r)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [records])

  const [showAddForm,  setShowAddForm]  = useState(false)
  const [calcKey,      setCalcKey]      = useState('')
  const [calcPercent,  setCalcPercent]  = useState(80)
  const [openKey,      setOpenKey]      = useState<string | null>(null)
  const [markingRead,  setMarkingRead]  = useState(false)
  /** Ejercicios en el gráfico comparativo, cada uno con su color fijo. */
  const [compare, setCompare] = useState<{ key: string; slot: number }[] | null>(null)

  // Por defecto: los ejercicios con más tests (hasta 4).
  const compareSel = useMemo(() => {
    if (compare) return compare.filter((c) => groups.some((g) => g.key === c.key))
    return [...groups]
      .sort((a, b) => b.history.length - a.history.length || a.name.localeCompare(b.name, 'es'))
      .slice(0, RM_MAX_COMPARE)
      .map((g, i) => ({ key: g.key, slot: i }))
  }, [compare, groups])

  function toggleCompare(key: string) {
    const cur = compareSel
    if (cur.some((c) => c.key === key)) {
      setCompare(cur.filter((c) => c.key !== key))
      return
    }
    if (cur.length >= RM_MAX_COMPARE) {
      toast(`Hasta ${RM_MAX_COMPARE} ejercicios a la vez en el gráfico`)
      return
    }
    const used = new Set(cur.map((c) => c.slot))
    const slot = [...Array(RM_MAX_COMPARE).keys()].find((i) => !used.has(i)) ?? 0
    setCompare([...cur, { key, slot }])
  }

  const compareData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const sel of compareSel) {
      const g = groups.find((x) => x.key === sel.key)
      if (!g) continue
      for (const h of g.history) {
        const d = h.tested_at.slice(0, 10)
        if (!byDate.has(d)) byDate.set(d, { date: d })
        const row = byDate.get(d)!
        // Dos tests el mismo día: queda el mayor.
        row[sel.key] = Math.max(Number(row[sel.key] ?? 0), h.rm_kg)
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [compareSel, groups])

  const calcGroup = groups.find((g) => g.key === calcKey)
  const calcRm = calcGroup?.history[0]?.rm_kg ?? null
  const calcWeight = calcRm != null ? Math.round(calcRm * (calcPercent / 100) * 10) / 10 : null

  const rmDue = rmTestWeeks != null && rmTestWeeks >= RM_TEST_EVERY_WEEKS

  return (
    <div className="space-y-5">

      {/* ── Aviso TESTEAR RM ── */}
      {rmTestWeeks != null ? (
        rmDue ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl hh-alert hh-alert-warning px-4 py-3">
            <Dumbbell className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-primary">Testear RM en la próxima rutina</p>
              <p className="text-2xs text-ink-secondary">
                {rmTestWeeks} semanas de rutina desde el último test. Al marcarlo como leído la cuenta vuelve a cero.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={markingRead}
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={async () => {
                setMarkingRead(true)
                await onRmTestRead()
                setMarkingRead(false)
              }}
            >
              Leído
            </Button>
          </div>
        ) : (
          <p className="text-2xs text-ink-muted">
            Próximo test de RM: {rmTestWeeks} de {RM_TEST_EVERY_WEEKS} semanas de rutina.
          </p>
        )
      ) : null}

      {/* ── Registros por ejercicio ── */}
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-surface-border/50 pb-3 ">
          <h3 className="text-sm font-semibold text-ink-primary ">RM por ejercicio</h3>
          <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddForm(true)}>
            Cargar RM
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title="Sin registros"
            description="Cargá el RM de cada ejercicio. Cada test nuevo se suma al historial para ver el progreso."
          />
        ) : (
          <div className="divide-y divide-surface-border/40 ">
            {groups.map((g) => {
              const latest = g.history[0]
              const prev = g.history[1]
              const delta = prev ? Math.round((latest.rm_kg - prev.rm_kg) * 10) / 10 : null
              const isOpen = openKey === g.key
              const sel = compareSel.find((c) => c.key === g.key)
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCompare(g.key)}
                      className={cn(
                        'h-3 w-3 shrink-0 rounded-full border transition-colors',
                        sel ? 'border-transparent' : 'border-zinc-400 ',
                      )}
                      style={sel ? { background: palette[sel.slot] } : undefined}
                      title={sel ? 'Quitar del gráfico' : 'Ver en el gráfico'}
                      aria-pressed={!!sel}
                    />
                    <button type="button" onClick={() => setOpenKey(isOpen ? null : g.key)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-ink-primary">{g.name}</p>
                      <p className="text-3xs text-ink-muted">
                        {formatDate(latest.tested_at)} · {g.history.length} {g.history.length === 1 ? 'test' : 'tests'}
                      </p>
                    </button>
                    {delta != null && prev ? (
                      <span
                        className={cn(
                          'shrink-0 text-2xs font-semibold tabular-nums',
                          delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-status-expired' : 'text-ink-muted',
                        )}
                        title={`Antes: ${prev.rm_kg} kg (${formatDate(prev.tested_at)})`}
                      >
                        {delta > 0 ? `▲ +${delta} kg` : delta < 0 ? `▼ ${delta} kg` : '='}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-base font-bold tabular-nums text-ink-primary ">{latest.rm_kg} kg</span>
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : g.key)}
                      className="text-ink-muted transition-colors hover:text-ink-primary"
                      aria-label="Ver historial"
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </div>

                  {isOpen ? (
                    <ul className="mb-2 divide-y divide-surface-border/40 rounded-lg border border-surface-border bg-surface-elevated/30">
                      {g.history.map((h, i) => {
                        const older = g.history[i + 1]
                        const d = older ? Math.round((h.rm_kg - older.rm_kg) * 10) / 10 : null
                        return (
                          <li key={h.id} className="flex items-center gap-2 px-3 py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-ink-secondary">
                                {formatDate(h.tested_at)} · {h.source === 'epley' ? 'Estimado (Epley)' : 'Testeado'}
                              </p>
                              {h.notes ? <p className="truncate text-3xs text-ink-muted">{h.notes}</p> : null}
                            </div>
                            {d != null && d !== 0 ? (
                              <span className={cn('text-3xs tabular-nums', d > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-status-expired')}>
                                {d > 0 ? `+${d}` : d}
                              </span>
                            ) : null}
                            <span className="text-xs font-semibold tabular-nums text-ink-primary">{h.rm_kg} kg</span>
                            <button
                              type="button"
                              onClick={() => void onDelete(h.id)}
                              className="text-ink-muted transition-colors hover:text-status-expired"
                              aria-label="Borrar registro"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Progreso comparado ── */}
      {groups.length > 0 ? (
        <section className="border-t border-surface-border/55 pt-4 ">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-muted" aria-hidden />
            <h3 className="text-sm font-semibold text-ink-primary ">Progreso de RM</h3>
          </div>
          <p className="mb-3 text-2xs text-ink-muted">
            Tocá el punto de color de cada ejercicio para sumarlo o quitarlo del gráfico (hasta {RM_MAX_COMPARE}).
          </p>
          {compareSel.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">Elegí al menos un ejercicio.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                {compareSel.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: palette[c.slot] }} />
                    {groups.find((g) => g.key === c.key)?.name}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={compareData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--surface-border))" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => formatDate(d)}
                    tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    domain={[(min: number) => Math.max(0, Math.floor((min - 10) / 10) * 10), (max: number) => Math.ceil((max + 10) / 10) * 10]}
                    allowDecimals={false}
                    tickCount={5}
                    tickFormatter={(v: number) => `${Math.round(v)} kg`}
                    tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgb(var(--ink-muted))', strokeOpacity: 0.4 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-surface-border bg-surface-elevated px-2.5 py-1.5 text-2xs shadow-md">
                          <p className="mb-1 text-ink-muted">{formatDate(String(label))}</p>
                          {payload.map((p) => (
                            <p key={String(p.dataKey)} className="flex items-center gap-1.5 text-ink-primary">
                              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                              {groups.find((g) => g.key === p.dataKey)?.name}: <strong>{String(p.value)} kg</strong>
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {compareSel.map((c) => (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      stroke={palette[c.slot]}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 4, fill: palette[c.slot], stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </section>
      ) : null}

      {/* ── Calculadora de % ── */}
      {groups.length > 0 ? (
        <section className="border-t border-surface-border/55 pt-4 ">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-ink-muted" aria-hidden />
            <h3 className="text-sm font-semibold text-ink-primary ">Calculadora de porcentaje</h3>
          </div>
          <div className="space-y-3">
            <select
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary outline-none focus:border-brand-primary/60"
              value={calcKey}
              onChange={(e) => setCalcKey(e.target.value)}
            >
              <option value="">Seleccioná un ejercicio...</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name} — 1RM: {g.history[0].rm_kg} kg
                </option>
              ))}
            </select>

            {calcRm != null && (
              <>
                <div>
                  <label className="mb-1 block text-3xs uppercase tracking-wide text-ink-muted">
                    Porcentaje: {calcPercent}%
                  </label>
                  <input
                    type="range" min={50} max={100} step={5}
                    value={calcPercent}
                    onChange={(e) => setCalcPercent(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between border border-surface-border/80 bg-surface-elevated/60 px-4 py-3 ">
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-wide text-ink-muted ">Peso estimado</p>
                    <p className="text-2xl font-bold tabular-nums text-ink-primary ">{calcWeight} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xs text-ink-muted">1RM base</p>
                    <p className="text-sm font-semibold text-ink-primary">{calcRm} kg</p>
                    <p className="mt-1 text-3xs text-ink-muted">al {calcPercent}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RM_PERCENTS.map((pct) => {
                    const w = Math.round(calcRm * (pct / 100) * 10) / 10
                    const isSelected = pct === calcPercent
                    return (
                      <button
                        key={pct}
                        onClick={() => setCalcPercent(pct)}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors',
                          isSelected
                            ? 'border border-zinc-400 bg-white font-semibold text-ink-primary ring-2 ring-surface-inputBorder/80 dark:text-white '
                            : 'bg-surface-elevated text-ink-secondary hover:bg-surface-border/90 ',
                        )}
                      >
                        <span>{pct}%</span>
                        <span className="font-medium">{w} kg</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Add form modal ── */}
      {showAddForm && (
        <AddRmModal
          onClose={() => setShowAddForm(false)}
          onSave={async (record) => { await onAdd(record); setShowAddForm(false) }}
        />
      )}
    </div>
  )
}

// ─── AddRmModal ───────────────────────────────────────────────────────────────

type AddMode = 'test' | 'percent' | 'epley'

function AddRmModal({
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

// ─── QuickPayModal ────────────────────────────────────────────────────────────

function QuickPayModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string
  studentName: string
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('efectivo_ars')
  const [type, setType] = useState(INCOME_TYPES[0] ?? 'Otro')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Ingresá un monto válido'); return }
    setSaving(true)
    const mainRow = {
      owner_id: user.id,
      student_id: studentId,
      amount: amt,
      payment_method: method as Income['payment_method'],
      income_type: type,
      income_date: date,
      description: `Pago de ${studentName}`,
      category: 'Entrenamiento',
      status: 'cobrado' as const,
      notes: notes.trim() ? notes.trim() : null,
      scope: 'business' as const,
    }
    const { data: inserted, error } = await supabase.from('income').insert(mainRow).select('id').single()
    if (error) {
      setSaving(false)
      toast.error(error.message)
      return
    }
    void notifyPaymentRegistered({
      userId: user.id,
      amount: amt,
      studentName,
      studentId,
      incomeId: inserted?.id ?? null,
      paymentMethod: method,
    })
    const split = buildPersonalHalfIncomeRow(mainRow)
    if (split) {
      const { error: splitErr } = await supabase.from('income').insert(split)
      setSaving(false)
      if (splitErr) {
        toast.error(`Pago guardado pero no la mitad en vida personal: ${splitErr.message}`)
        onClose()
        return
      }
      toast.success('Pago + mitad proyecto en vida personal ✓')
      onClose()
      return
    }
    const mirror = buildPersonalFullMirrorIncomeRow(mainRow)
    if (mirror) {
      const { error: mirrorErr } = await supabase.from('income').insert(mirror)
      setSaving(false)
      if (mirrorErr) {
        toast.error(`Pago guardado pero no la copia en vida personal: ${mirrorErr.message}`)
        onClose()
        return
      }
      toast.success('Pago HH + copia íntegra en vida personal ✓')
      onClose()
      return
    }
    setSaving(false)
    toast.success('Pago registrado ✓')
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="sm" bare>
    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Registrar pago</h3>
        <p className="text-xs text-ink-muted">{studentName}</p>
      </div>
      <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
    </div>

    <div className="px-4 py-4 space-y-3">
      {/* Monto */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Monto *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-semibold">$</span>
          <input
            type="number" min={0} step={100} placeholder="0"
            className="w-full bg-surface-elevated text-ink-primary text-lg font-bold rounded-xl pl-7 pr-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Tipo de ingreso / plan</label>
          <select
            className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
            value={type} onChange={(e) => setType(e.target.value)}
          >
            {INCOME_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Método */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Método</label>
          <select
            className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
            value={method} onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
        <input
          type="date"
          className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
          value={date} onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Notas libres (ej. cuotas)</label>
        <input
          placeholder="ej: quedan 2 cuotas, mes mayo…"
          className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none placeholder:text-ink-muted"
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        className="w-full"
        variant="gradientSecondary"
        loading={saving}
        onClick={handleSave}
      >
        Confirmar pago
      </Button>
    </div>
    </Modal>
  )
}
