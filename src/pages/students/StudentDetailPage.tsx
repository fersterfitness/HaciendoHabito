import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Pencil, Trash2, Dumbbell, FileText, FileDown, Plus,
  Mail, Phone, Calendar, Zap, X, ChevronDown,
  StickyNote, Check, DollarSign, ClipboardList, Copy, MessageCircle, Tag,
  Maximize2, UserRound, UtensilsCrossed, TrendingUp, Scale,
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
import { cn, formatDate, daysUntil, formatCurrency } from '@/lib/utils'
import { CicloTab } from './CicloTab'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { StudentNotesCard } from '@/components/students/StudentNotesCard'
import { StudentPlanCard } from '@/components/students/StudentPlanCard'
import { AssignPlanModal } from '@/components/students/AssignPlanModal'
import { FersterStudentIntakePanel } from '@/components/students/FersterStudentIntakePanel'
import { PsychologistStudentIntakePanel } from '@/components/students/PsychologistStudentIntakePanel'
import { StudentProgressPhotosSection } from '@/components/students/StudentProgressPhotosSection'
import { StudentHabitsPanel } from '@/components/students/StudentHabitsPanel'
import { HabitsViewToolbar } from '@/components/habits/HabitsViewToolbar'
import { canSeeTraining } from '@/config/navigation'
import type { Student, Routine, Exercise, StudentRmRecord, StudentWeightLog, TrainerStudentMealPlan, Income } from '@/types/database'
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

function incomeStatusPhrase(status: string): string {
  const m: Record<string, string> = {
    cobrado: 'Cobrado',
    pendiente: 'Pendiente',
    anulado: 'Anulado',
  }
  return m[status] ?? status
}

/** Píldora de estado de rutina (activa = verde; resto semántico). */
function routineStatusPillClass(status: string, compact = false): string {
  const sizing = compact ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'
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
      return cn(base, 'border-zinc-200/80 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400')
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
      return cn(base, 'border-zinc-400/55 bg-zinc-500/12 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700/25 dark:text-zinc-400')
    case 'baja':
      return cn(base, 'border-rose-400/40 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-400')
    default:
      return cn(base, 'border-zinc-200/80 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400')
  }
}

/** Línea de estado en historial de pagos. */
function incomeLedgerStatusClass(status: string): string {
  switch (status) {
    case 'cobrado':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'pendiente':
      return 'text-status-expiring'
    case 'anulado':
      return 'text-zinc-500 line-through dark:text-zinc-500'
    default:
      return 'text-zinc-500'
  }
}

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
  const entitySingularCapitalized = profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno'
  const entitySingular = profile?.role === 'nutritionist' ? 'paciente' : 'alumno'

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
      .eq('owner_id', user.id)   // ← solo el dueño puede eliminar
    if (error) {
      setRmRecords(prev)          // ← rollback si falla
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

  function startEditNotes() {
    setNotesValue(student?.notes ?? '')
    setEditingNotes(true)
    setTimeout(() => notesRef.current?.focus(), 50)
  }

  if (loading) {
    return variant === 'page' ? (
      <div><Header title={entitySingularCapitalized} showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-zinc-50 py-24 dark:bg-[rgb(var(--surface-base))]">
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
    <div className={cn(variant === 'panel' && 'flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-[rgb(var(--surface-base))]')}>
      {variant === 'page' ? (
        <Header title={student.full_name} showBack />
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-lg border-b border-zinc-200/80 bg-white/90 px-4 py-3.5 dark:border-zinc-800/90 dark:bg-zinc-900/85">
          <div className="min-w-0 flex-1">
            <p id="student-sheet-title" className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
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
                      'relative -mb-px flex min-w-0 flex-1 items-center justify-center gap-2',
                      'rounded-t-2xl border px-2 py-3 sm:px-4 text-[12px] font-semibold transition-colors',
                      active
                        ? 'border-surface-border/80 bg-surface-card text-ink-primary shadow-card'
                        : 'border-transparent bg-transparent text-ink-muted hover:text-ink-primary hover:bg-surface-elevated/25',
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5',
                        active ? 'text-ink-secondary' : 'text-ink-muted',
                      )}
                    >
                      {icon}
                    </span>
                    <span className="hidden min-w-0 truncate sm:inline">{label}</span>
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
        <section className="border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="order-2 min-w-0 flex-1 sm:order-1">
              <h2 className="text-balance text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{student.full_name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-wider">
                <span className={studentAccountStatusChipClass(student.status)}>{intakeStatusPhrase(student.status)}</span>
                <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                  ·
                </span>
                {student.level ? (
                  <>
                    <span className="text-zinc-400 dark:text-zinc-500">{DETAIL_LEVEL_LABEL[student.level] ?? student.level}</span>
                    <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                      ·
                    </span>
                  </>
                ) : null}
                <span className="text-zinc-400 dark:text-zinc-500">{selectedPlanLabel ?? 'Sin plan web'}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {student.email && (
                  <a
                    href={`mailto:${student.email}`}
                    className="flex items-center gap-1 text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <Mail className="h-3 w-3 opacity-70" aria-hidden />{student.email}
                  </a>
                )}
                {student.phone && (
                  <>
                    <a
                      href={`tel:${student.phone}`}
                      className="flex items-center gap-1 text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      <Phone className="h-3 w-3 opacity-70" aria-hidden />{student.phone}
                    </a>
                    <a
                      href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      <MessageCircle className="h-3 w-3 opacity-70" aria-hidden />
                      WhatsApp
                    </a>
                  </>
                )}
                {student.birth_date && (
                  <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                    <Calendar className="h-3 w-3 opacity-70" aria-hidden />{formatDate(student.birth_date)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {savingTags ? (
                  <span className="inline-flex h-8 items-center gap-1.5 px-1 text-[11px] text-ink-muted" aria-live="polite">
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
                      'dark:bg-zinc-800/40',
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
                        'dark:border-zinc-600 dark:bg-zinc-900/60',
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
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60">
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
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
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
              (profile.role === 'trainer' || profile.role === 'admin' || profile.role === 'nutritionist'))
          }
        />

            {/* Notas / observaciones */}
            {editingNotes ? (
              <div className="space-y-3 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-brand-secondary" aria-hidden />
                  <span className="text-sm font-semibold text-ink-primary">Observaciones</span>
                </div>
                <textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={5}
                  className="w-full resize-none border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40"
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
                className="flex w-full items-center gap-2 border-b border-dashed border-zinc-300/80 py-4 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                <StickyNote className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
                Agregar observaciones...
              </button>
            )}
          </>
        )}

        {/* ── Rutina ── */}
        {sheetTab === 'rutina' && (() => {
          const rutinaHistorialVacío = routines.length === 0
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
          const routineProgressPct = activeRoutine?.start_date && activeRoutine?.end_date
            ? Math.min(100, Math.max(0, (
                (Date.now() - new Date(activeRoutine.start_date).getTime()) /
                (new Date(activeRoutine.end_date).getTime() - new Date(activeRoutine.start_date).getTime())
              ) * 100))
            : 0

          // Semanas de duración de una rutina
          function routineWeeks(r: Routine): number | null {
            if (!r.start_date || !r.end_date) return null
            const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86_400_000)
            return Math.max(1, Math.round(days / 7))
          }

          return (
          <div className="space-y-8">

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
              <section className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-700/60 dark:bg-zinc-900/40 overflow-hidden">
                {/* Barra de progreso top */}
                <div className="h-1 w-full bg-zinc-200/70 dark:bg-zinc-800">
                  <div
                    className="h-full bg-brand-secondary transition-all duration-700"
                    style={{ width: `${routineProgressPct}%` }}
                  />
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Rutina activa</p>
                      <p className="mt-1.5 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{activeRoutine.name}</p>
                      {activeRoutine.objective?.trim() ? (
                        <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{activeRoutine.objective}</p>
                      ) : null}
                    </div>
                    <span className={routineStatusPillClass(activeRoutine.status)}>{intakeRoutinePhrase(activeRoutine.status)}</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-200/60 pt-4 dark:border-zinc-700/50">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">Inicio</dt>
                      <dd className="mt-1 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">{formatDate(activeRoutine.start_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">Vencimiento</dt>
                      <dd className="mt-1 text-sm tabular-nums font-medium text-zinc-700 dark:text-zinc-300">{formatDate(activeRoutine.end_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">Días restantes</dt>
                      <dd className={cn(
                        'mt-1 text-sm tabular-nums font-semibold',
                        daysUntil(activeRoutine.end_date) <= 7 ? 'text-status-expired' : 'text-zinc-900 dark:text-zinc-50',
                      )}>
                        {Math.max(0, daysUntil(activeRoutine.end_date))}
                      </dd>
                    </div>
                  </dl>

                  {/* Chips perfil entrenamiento */}
                  {profileChips.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-200/60 pt-4 dark:border-zinc-700/50">
                      {profileChips.map((c) => (
                        <span key={c.label} className="rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
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
              <div className="rounded-xl border border-dashed border-zinc-300/80 dark:border-zinc-700/60 overflow-hidden">
                <div className="flex items-stretch">
                  {/* Acento izquierdo */}
                  <div className="w-1 shrink-0 bg-zinc-300/60 dark:bg-zinc-700/60" />
                  <div className="flex-1 px-5 py-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">Sin rutina activa</p>
                    <p className="mt-2 text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
                      {student.full_name.split(' ')[0]} no tiene una rutina asignada
                    </p>
                    <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                      {rutinaHistorialVacío
                        ? 'Creá la primera rutina para este alumno.'
                        : 'Tiene rutinas en el historial. Podés abrirlas para renovar o activar un período.'}
                    </p>

                    {/* Chips perfil entrenamiento si hay datos */}
                    {profileChips.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {profileChips.map((c) => (
                          <span key={c.label} className="rounded-md border border-zinc-200 bg-zinc-100/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/55 pb-3 dark:border-zinc-800/55">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Historial</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Rutinas anteriores</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  className={cn(
                    '!h-8 text-[12px] font-semibold',
                    rutinaHistorialVacío
                      ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300'
                      : '!text-brand-secondary hover:bg-brand-secondary/10',
                  )}
                  onClick={() => navigate(`/routines?create=1&student=${id}`)}
                >
                  Nueva
                </Button>
              </div>

              {rutinaHistorialVacío ? (
                <p className="py-6 text-center text-[13px] text-zinc-400 dark:text-zinc-500">
                  Todavía no hay rutinas registradas.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {routines.map((r) => {
                    const weeks = routineWeeks(r)
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/routines/${r.id}`)}
                          className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">{r.name}</p>
                            <p className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-zinc-500">
                              <span>{formatDate(r.start_date)} → {formatDate(r.end_date)}</span>
                              {weeks != null && (
                                <span className="rounded bg-zinc-100 px-1.5 py-px font-medium dark:bg-zinc-800">
                                  {weeks} sem.
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={routineStatusPillClass(r.status, true)}>{intakeRoutinePhrase(r.status)}</span>
                            <span className="text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-700 dark:group-hover:text-zinc-400">›</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
          )
        })()}

        {/* ── Nutrición ── */}
        {sheetTab === 'nutricion' && showNutritionTab && (
          <section>
            <div className="border-b border-zinc-200/50 pb-4 dark:border-zinc-800/50">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <ClipboardList className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <h3 className="text-sm font-semibold">Planes de alimentación</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Asignados desde Plan de alimentación.{' '}
                <button
                  type="button"
                  className="font-medium text-zinc-700 underline-offset-4 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
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
              <ul className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                {mealPlans.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{p.title}</p>
                      <p className="text-[11px] text-zinc-500">Actualizado {formatDate(p.updated_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Seguimiento (peso, fuerza, pagos, ciclo) ── */}
        {sheetTab === 'seguimiento' && (
          <div className="space-y-4">
            <div className="-mx-px flex border-b border-zinc-200/60 dark:border-zinc-800/60" role="tablist" aria-label="Seguimiento">
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
                    '-mb-px flex-1 border-b-2 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide transition-colors sm:text-xs',
                    seguimientoTab === value
                      ? 'border-b-zinc-900 text-zinc-900 dark:border-b-zinc-200 dark:text-zinc-50'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200',
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
              <FuerzaTab records={rmRecords} onAdd={addRmRecord} onDelete={deleteRmRecord} />
            )}
          </div>
        )}

        {sheetTab === 'habitos' && showHabitsTab && (
          <div className="min-h-0 rounded-xl bg-zinc-50/80 p-1 dark:bg-zinc-950/25">
            <StudentHabitsPanel studentId={id!} toolbarLeading={<HabitsViewToolbar studentId={id!} />} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={`¿Eliminar ${entitySingular}?`}
        description="Esta acción no se puede deshacer."
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

function FuerzaTab({
  records,
  onAdd,
  onDelete,
}: {
  records: StudentRmRecord[]
  onAdd: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  // Latest RM per exercise
  const latestByExercise = useMemo(() => {
    const map = new Map<string, StudentRmRecord>()
    for (const r of records) {
      if (!map.has(r.exercise_id)) map.set(r.exercise_id, r)
    }
    return Array.from(map.values())
  }, [records])

  const [showAddForm,    setShowAddForm]    = useState(false)
  const [calcExerciseId, setCalcExerciseId] = useState('')
  const [calcPercent,    setCalcPercent]    = useState(80)
  const [showHistory,    setShowHistory]    = useState<string | null>(null)

  const calcRecord  = latestByExercise.find((r) => r.exercise_id === calcExerciseId)
  const calcWeight  = calcRecord ? Math.round(calcRecord.rm_kg * (calcPercent / 100) * 10) / 10 : null

  return (
    <div className="space-y-4">

      {/* ── Calculadora de % ── */}
      <section className="border-b border-zinc-200/55 pb-5 dark:border-zinc-800/60">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-zinc-400" aria-hidden />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Calculadora de porcentaje</h3>
        </div>

        {latestByExercise.length === 0 ? (
          <p className="text-xs text-ink-muted">Registrá el 1RM de al menos un ejercicio para usar la calculadora.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Ejercicio</label>
              <select
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
                value={calcExerciseId}
                onChange={(e) => setCalcExerciseId(e.target.value)}
              >
                <option value="">Seleccioná un ejercicio...</option>
                {latestByExercise.map((r) => (
                  <option key={r.exercise_id} value={r.exercise_id}>
                    {r.exercise?.name ?? r.exercise_id} — 1RM: {r.rm_kg} kg
                  </option>
                ))}
              </select>
            </div>

            {calcRecord && (
              <>
                <div>
                  <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">
                    Porcentaje: {calcPercent}%
                  </label>
                  <input
                    type="range" min={50} max={100} step={5}
                    value={calcPercent}
                    onChange={(e) => setCalcPercent(Number(e.target.value))}
                    className="w-full accent-zinc-500 dark:accent-zinc-400"
                  />
                </div>

                {/* Resultado destacado */}
                <div className="flex items-center justify-between border border-zinc-200/80 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Peso estimado</p>
                    <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{calcWeight} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-ink-muted">1RM base</p>
                    <p className="text-sm font-semibold text-ink-primary">{calcRecord.rm_kg} kg</p>
                    <p className="text-[10px] text-ink-muted mt-1">al {calcPercent}%</p>
                  </div>
                </div>

                {/* Tabla completa de porcentajes */}
                <div className="grid grid-cols-3 gap-1.5">
                  {RM_PERCENTS.map((pct) => {
                    const w = Math.round(calcRecord.rm_kg * (pct / 100) * 10) / 10
                    const isSelected = pct === calcPercent
                    return (
                      <button
                        key={pct}
                        onClick={() => setCalcPercent(pct)}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors',
                          isSelected
                            ? 'border border-zinc-400 bg-white font-semibold text-zinc-900 ring-2 ring-zinc-300/80 dark:border-zinc-500 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600/80'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/90 dark:bg-zinc-900/55 dark:text-zinc-400 dark:hover:bg-zinc-800',
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
        )}
      </section>

      {/* ── Registros de 1RM ── */}
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200/50 pb-3 dark:border-zinc-800/55">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Registros de 1RM</h3>
          <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddForm(true)}>
            Agregar
          </Button>
        </div>

        {latestByExercise.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title="Sin registros"
            description="Agregá el 1RM de cada ejercicio para calcular porcentajes."
          />
        ) : (
          <div className="space-y-2">
            {latestByExercise.map((r) => {
              const history = records.filter((x) => x.exercise_id === r.exercise_id)
              const isOpen  = showHistory === r.exercise_id
              return (
                <div key={r.exercise_id} className="overflow-hidden border-b border-zinc-200/40 last:border-0 dark:border-zinc-800/50">
                  <div className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">{r.exercise?.name ?? '—'}</p>
                      <p className="text-[10px] text-ink-muted">
                        {formatDate(r.tested_at)} · {r.source === 'epley' ? 'Estimado (Epley)' : 'Testeado'}
                      </p>
                    </div>
                    <span className="text-base font-bold shrink-0 text-zinc-900 dark:text-zinc-100">{r.rm_kg} kg</span>
                    {history.length > 1 && (
                      <button
                        onClick={() => setShowHistory(isOpen ? null : r.exercise_id)}
                        className="text-ink-muted hover:text-ink-primary transition-colors"
                      >
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    )}
                    <button onClick={() => onDelete(r.id)} className="text-ink-muted hover:text-status-expired transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && history.length > 1 && (() => {
                    const rmChartData = [...history].reverse().map((h) => ({
                      date: formatDate(h.tested_at),
                      rm: h.rm_kg,
                      source: h.source === 'epley' ? 'Epley' : 'Test',
                    }))
                    const minRm = Math.min(...rmChartData.map(d => d.rm))
                    const maxRm = Math.max(...rmChartData.map(d => d.rm))
                    return (
                      <div className="border-t border-surface-border px-3 pt-3 pb-2">
                        <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-2">Progresión 1RM</p>
                        <ResponsiveContainer width="100%" height={90}>
                          <LineChart data={rmChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
                            <YAxis domain={[Math.max(0, minRm - 5), maxRm + 5]} tick={{ fontSize: 9, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-surface-border)', borderRadius: 8, fontSize: 11 }}
                              labelStyle={{ color: 'var(--color-ink-muted)', marginBottom: 2 }}
                              formatter={(value: number, _name: string, props: { payload?: { source?: string } }) => [`${value} kg (${props.payload?.source ?? ''})`, '1RM']}
                            />
                            <Line
                              type="monotone"
                              dataKey="rm"
                              stroke="#a1a1aa"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#a1a1aa' }}
                              activeDot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-1 divide-y divide-surface-border/40">
                          {history.slice(1).map((h) => (
                            <div key={h.id} className="flex items-center justify-between py-1.5">
                              <span className="text-xs text-ink-muted">{formatDate(h.tested_at)} · {h.source === 'epley' ? 'Epley' : 'Test'}</span>
                              <span className="text-xs font-medium text-ink-secondary">{h.rm_kg} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </section>

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

type AddMode = 'test' | 'epley'

function AddRmModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
}) {
  const [exercises,   setExercises]   = useState<Pick<Exercise, 'id' | 'name'>[]>([])
  const [exerciseId,  setExerciseId]  = useState('')
  const [mode,        setMode]        = useState<AddMode>('test')
  const [rmKg,        setRmKg]        = useState('')          // mode=test
  const [epleyWeight, setEpleyWeight] = useState('')         // mode=epley
  const [epleyReps,   setEpleyReps]   = useState('')         // mode=epley
  const [testedAt,    setTestedAt]    = useState(new Date().toISOString().split('T')[0])
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    supabase.from('exercise_library').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setExercises((data as Pick<Exercise, 'id' | 'name'>[]) ?? []))
  }, [])

  const estimatedRm = mode === 'epley' && epleyWeight && epleyReps
    ? epley1RM(Number(epleyWeight), Number(epleyReps))
    : null

  async function handleSave() {
    if (!exerciseId) { toast.error('Seleccioná un ejercicio'); return }
    const finalRm = mode === 'test' ? Number(rmKg) : estimatedRm
    if (!finalRm || finalRm <= 0) { toast.error('Ingresá los datos del RM'); return }
    setSaving(true)
    await onSave({
      exercise_id: exerciseId,
      rm_kg: finalRm,
      tested_at: testedAt,
      source: mode,
      notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-lg">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Registrar 1RM</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Ejercicio */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Ejercicio *</label>
            <select
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              <option value="">Seleccioná un ejercicio...</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Modo */}
          <div className="flex gap-1 rounded-xl border border-zinc-200/90 bg-zinc-100/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
            {([
              { value: 'test',   label: 'RM real (testeado)' },
              { value: 'epley',  label: 'Estimar con Epley' },
            ] as { value: AddMode; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  mode === value
                    ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'test' ? (
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">1RM (kg) *</label>
              <input
                type="number" min={0} step={0.5} placeholder="ej: 120"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none text-center font-bold"
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
                    className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none text-center"
                    value={epleyWeight}
                    onChange={(e) => setEpleyWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Reps realizadas *</label>
                  <input
                    type="number" min={1} max={10} placeholder="ej: 5"
                    className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none text-center"
                    value={epleyReps}
                    onChange={(e) => setEpleyReps(e.target.value)}
                  />
                </div>
              </div>
              {estimatedRm && (
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/65">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">1RM estimado (Epley)</p>
                    <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{estimatedRm} kg</p>
                  </div>
                  <p className="text-xs text-ink-muted text-right">
                    Fórmula:<br />
                    <span className="font-mono">peso × (1 + reps/30)</span>
                  </p>
                </div>
              )}
              <p className="text-[10px] text-ink-muted">La fórmula de Epley es más precisa con 1-6 repeticiones.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
            <input
              type="date"
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Notas (opcional)</label>
            <input
              placeholder="ej: con cinturón, post competencia..."
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none placeholder:text-ink-muted"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button className="w-full" variant="secondary" loading={saving} onClick={handleSave}>
            Guardar registro
          </Button>
        </div>
      </div>
    </div>
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
  const [amount,  setAmount]  = useState('')
  const [method,  setMethod]  = useState('efectivo_ars')
  const [type,    setType]    = useState(INCOME_TYPES[0] ?? 'Otro')
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0])
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-lg">
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
                className="w-full bg-surface-elevated text-ink-primary text-lg font-bold rounded-xl pl-7 pr-3 py-2.5 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none text-center"
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
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
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
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
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
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none"
              value={date} onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Notas libres (ej. cuotas)</label>
            <input
              placeholder="ej: quedan 2 cuotas, mes mayo…"
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-zinc-500 dark:focus:border-zinc-400 outline-none placeholder:text-ink-muted"
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
      </div>
    </div>
  )
}
