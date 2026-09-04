import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock, Check, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Copy, Plus, Trash2, Download, Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { PageSectionTitle } from '@/components/ui/PageSectionTitle'
import { loadStudentsMissingCheckIn, type DashboardMissingCheckInStudent } from '@/lib/dashboard/dashboardTrainerOps'
import {
  buildWhatsAppGroupPickUrl,
  buildWhatsAppUrl,
  checkInGroupMessage,
  checkInInviteMessage,
  monthlyFeedbackInviteMessage,
  normalizePhoneForWhatsApp,
  routineMonthFinishedWhatsAppMessage,
  shareToWhatsApp,
  weeklyFormMissingReminderMessage,
  WHATSAPP_DIRECT_PASTE_HINT,
} from '@/lib/whatsapp'
import { groupByYearMonth, monthLabelEs } from '@/lib/checkIn/historyGroups'
import { cn } from '@/lib/utils'
import { COMMON_TIMEZONES, WEEKDAY_LABELS_ES } from '@/lib/checkInSchedule'
import {
  checkInHistoryMeta,
  formatStoredAnswer,
  isMonthlyTemplate,
  isWeeklyTemplate,
  mergeCheckInTemplate,
  monthlyFormDefaults,
  parseQuestions,
  weekStatusFromAnswers,
  weeklyFormDefaults,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'
import { CheckInAnswerList } from '@/components/checkIn/CheckInAnswerList'
import { MonthlyFeedbackAnswers } from '@/components/checkIn/MonthlyFeedbackAnswers'
import { CheckInFinishedBanner, CheckInLastWeekBanner } from '@/components/checkIn/CheckInFinishedBanner'
import { CheckInQuestionEditor } from '@/components/checkIn/CheckInQuestionEditor'
import { StudentRoutineWeekPanel } from '@/components/checkIn/StudentRoutineWeekPanel'
import { matchRoutineForSubmittedAt, type RoutineDateRange } from '@/lib/checkIn/monthlyFeedback'
import {
  defaultWeeklyPeriodStartYmd,
  formatPeriodYmd,
  isWeeklyPeriodOverdue,
  loadWeeklyPeriodStartYmd,
  saveWeeklyPeriodStartYmd,
  submittedInWeeklyPeriod,
  weeklyPeriodDueYmd,
  weeklyPeriodStartUtc,
} from '@/lib/checkIn/weeklyPeriod'
import { ensureDefaultCheckInForms, remapCheckInResponsesForForm, syncCheckInSideEffects } from '@/lib/checkIn/ensureForms'
import type { CheckInForm, CheckInSendSchedule, Json, Student } from '@/types/database'
import toast from 'react-hot-toast'

function defaultQuestions(): CheckInQuestion[] {
  return weeklyFormDefaults().questions
}

function csvEscape(value: string): string {
  const s = String(value).replace(/"/g, '""')
  if (/[",\n\r]/.test(s)) return `"${s}"`
  return s
}

type InviteRow = {
  id: string
  token: string
  student_id: string
  student: { full_name: string; email: string | null } | null
}

type ResponseRow = {
  id: string
  invite_id: string
  submitted_at: string
  responses: Json
  testimonial_consent: boolean
  responder_email: string | null
  email_verified: boolean
  /** `null` ⇒ pendiente. Timestamp ⇒ ya respondido (vía WhatsApp/manual). */
  trainer_replied_at: string | null
  /** Nota corta del trainer (no visible para el alumno). */
  trainer_note: string | null
}

type ScheduleRow = CheckInSendSchedule & { form: { title: string } | null }

/** Botones de acción en la tabla de invitaciones (misma altura y padding). */
const inviteTableActionBtnClass =
  'h-7 min-h-7 min-w-[3.25rem] px-2.5 text-[10px] font-medium gap-1 shrink-0'

const checkInPanelCardClass =
  'border-brand-secondary/20 bg-gradient-to-br from-brand-secondary/[0.08] via-surface-card to-surface-card shadow-[0_8px_28px_rgba(169,121,255,0.06)]'

const checkInFormTileActiveClass =
  'border-brand-secondary/45 bg-gradient-to-br from-brand-secondary/18 via-brand-secondary/8 to-transparent text-ink-primary font-semibold shadow-[0_4px_18px_rgba(169,121,255,0.12)]'

const checkInFormTileIdleClass =
  'border-surface-border/80 bg-surface-elevated/25 text-ink-secondary hover:border-brand-secondary/35 hover:bg-brand-secondary/10 hover:text-ink-primary'

const checkInFieldSelectClass =
  'text-xs rounded-xl border border-surface-border/80 bg-surface-input px-2.5 py-2 outline-none transition-colors focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20'

const checkInCheckboxClass = 'rounded border-surface-border accent-brand-secondary'

const checkInHighlightPanelClass =
  'rounded-xl border border-brand-secondary/25 bg-gradient-to-br from-brand-secondary/12 via-brand-secondary/5 to-transparent p-3 space-y-3'

export function TrainerCheckInsPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const formIdFromUrl = searchParams.get('formId')
  const [forms, setForms] = useState<CheckInForm[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [title, setTitle] = useState(() => weeklyFormDefaults().title)
  const [intro, setIntro] = useState(() => weeklyFormDefaults().intro)
  const [questions, setQuestions] = useState<CheckInQuestion[]>(defaultQuestions)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set())
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [inviteBusy, setInviteBusy] = useState(false)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [newScheduleDow, setNewScheduleDow] = useState(5)
  const [newScheduleTz, setNewScheduleTz] = useState('America/Argentina/Buenos_Aires')
  const [newSchedulePreferGroup, setNewSchedulePreferGroup] = useState(true)
  /** Vista principal: por formulario (edición) o historial cronológico agrupado por alumno. */
  const [checkInView, setCheckInView] = useState<'form' | 'student'>(embedded ? 'student' : 'form')
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false)
  /** Drill-down: alumno → año → mes → respuesta. */
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number | null>(null)
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<number | null>(null)
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null)
  const [missingStudents, setMissingStudents] = useState<DashboardMissingCheckInStudent[]>([])
  const [studentPanel, setStudentPanel] = useState<'seguimiento' | 'sin_respuesta' | 'feedbacks'>('seguimiento')
  const [periodStart, setPeriodStart] = useState(() => defaultWeeklyPeriodStartYmd())
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'al_dia'>('all')
  const [historyKind, setHistoryKind] = useState<'weekly' | 'monthly'>('weekly')
  const [studentRoutines, setStudentRoutines] = useState<RoutineDateRange[]>([])

  type StudentHistoryRow = ResponseRow & {
    formId: string
    formTitle: string
    studentId: string
    studentName: string
  }
  const [studentHistory, setStudentHistory] = useState<StudentHistoryRow[]>([])

  const loadForms = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [fRes, sRes, schRes] = await Promise.all([
      supabase.from('check_in_forms').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('students').select('*').eq('owner_id', user.id).eq('status', 'activo').order('full_name'),
      supabase
        .from('check_in_send_schedules')
        .select('*, form:check_in_forms(title)')
        .eq('owner_id', user.id)
        .order('day_of_week', { ascending: true }),
    ])
    setLoading(false)
    if (fRes.error) toast.error(fRes.error.message)
    else {
      const raw = (fRes.data as CheckInForm[]) ?? []
      const ensured = await ensureDefaultCheckInForms(user.id, raw)
      setForms(ensured.forms)
      if (ensured.message) toast.success(ensured.message)
    }
    if (sRes.error) toast.error(sRes.error.message)
    else setStudents((sRes.data as Student[]) ?? [])
    if (schRes.error) toast.error(schRes.error.message)
    else setSchedules((schRes.data as unknown as ScheduleRow[]) ?? [])
  }, [user])

  useEffect(() => {
    void loadForms()
  }, [loadForms])

  useEffect(() => {
    if (!user) return
    setPeriodStart(loadWeeklyPeriodStartYmd(user.id))
  }, [user])

  useEffect(() => {
    if (!user || checkInView !== 'student') return
    void loadStudentsMissingCheckIn(user.id, weeklyPeriodStartUtc(periodStart)).then(setMissingStudents)
  }, [user, checkInView, studentHistory, periodStart])

  useEffect(() => {
    if (!user) return
    void supabase
      .from('routines')
      .select('id, student_id, name, start_date, end_date')
      .eq('owner_id', user.id)
      .then(({ data }) => setStudentRoutines((data ?? []) as RoutineDateRange[]))
  }, [user])

  useEffect(() => {
    setSelectedHistoryYear(null)
    setSelectedHistoryMonth(null)
    setSelectedResponseId(null)
  }, [historyKind])

  const loadStudentHistory = useCallback(async () => {
    if (!user || forms.length === 0) {
      setStudentHistory([])
      return
    }
    setStudentHistoryLoading(true)
    const formIds = forms.map((f) => f.id)
    const { data: invData, error: invErr } = await supabase
      .from('check_in_invites')
      .select('id, form_id, student_id, student:students(full_name), form:check_in_forms(title)')
      .in('form_id', formIds)
    if (invErr) {
      toast.error(invErr.message)
      setStudentHistory([])
      setStudentHistoryLoading(false)
      return
    }
    const invites = (invData ?? []) as unknown as Array<{
      id: string
      form_id: string
      student_id: string
      student: { full_name: string; email: string | null } | null
      form: { title: string } | null
    }>
    const inviteIds = invites.map((i) => i.id)
    if (!inviteIds.length) {
      setStudentHistory([])
      setStudentHistoryLoading(false)
      return
    }
    const { data: respData, error: respErr } = await supabase
      .from('check_in_responses')
      .select(
        'id, invite_id, submitted_at, responses, testimonial_consent, responder_email, email_verified, trainer_replied_at, trainer_note',
      )
      .in('invite_id', inviteIds)
      .order('submitted_at', { ascending: false })
    if (respErr) {
      toast.error(respErr.message)
      setStudentHistory([])
      setStudentHistoryLoading(false)
      return
    }
    const inviteById = new Map(invites.map((i) => [i.id, i]))
    const rows: StudentHistoryRow[] = []
    for (const r of (respData ?? []) as ResponseRow[]) {
      const inv = inviteById.get(r.invite_id)
      if (!inv) continue
      rows.push({
        ...r,
        formId: inv.form_id,
        formTitle: inv.form?.title ?? 'Formulario',
        studentId: inv.student_id,
        studentName: inv.student?.full_name ?? '—',
      })
    }
    setStudentHistory(rows)
    setStudentHistoryLoading(false)
  }, [user, forms])

  useEffect(() => {
    if (checkInView !== 'student') return
    void loadStudentHistory()
  }, [checkInView, loadStudentHistory])

  const historyByStudent = useMemo(() => {
    const map = new Map<string, { studentName: string; rows: StudentHistoryRow[] }>()
    for (const row of studentHistory) {
      const qs = parseQuestions(forms.find((f) => f.id === row.formId)?.questions)
      const monthly = isMonthlyTemplate(qs)
      if (historyKind === 'monthly' ? !monthly : monthly) continue
      const g = map.get(row.studentId) ?? { studentName: row.studentName, rows: [] }
      g.rows.push(row)
      map.set(row.studentId, g)
    }
    for (const g of map.values()) {
      g.rows.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    }
    const entries = [...map.entries()].sort((a, b) => {
      const pendingA = a[1].rows.some((r) => !r.trainer_replied_at) ? 0 : 1
      const pendingB = b[1].rows.some((r) => !r.trainer_replied_at) ? 0 : 1
      return pendingA - pendingB || a[1].studentName.localeCompare(b[1].studentName, 'es')
    })
    return entries
  }, [studentHistory, forms, historyKind])

  const visibleHistoryByStudent = useMemo(() => {
    if (historyStatusFilter === 'all') return historyByStudent
    return historyByStudent.filter(([, group]) => {
      const pending = group.rows.some((r) => !r.trainer_replied_at)
      return historyStatusFilter === 'pending' ? pending : !pending
    })
  }, [historyByStudent, historyStatusFilter])

  const selectedStudentGroup = useMemo(() => {
    if (!selectedStudentId) return null
    return historyByStudent.find(([id]) => id === selectedStudentId)?.[1] ?? null
  }, [historyByStudent, selectedStudentId])

  const historyYears = useMemo(() => {
    if (!selectedStudentGroup) return new Map<number, Map<number, StudentHistoryRow[]>>()
    return groupByYearMonth(selectedStudentGroup.rows, (r) => r.submitted_at)
  }, [selectedStudentGroup])

  const historyYearList = useMemo(
    () => [...historyYears.keys()].sort((a, b) => b - a),
    [historyYears],
  )

  const historyMonthsOfYear = useMemo(() => {
    if (selectedHistoryYear == null) return [] as { month: number; rows: StudentHistoryRow[] }[]
    const months = historyYears.get(selectedHistoryYear)
    if (!months) return []
    return [...months.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([month, rows]) => ({ month, rows }))
  }, [historyYears, selectedHistoryYear])

  const historyRowsOfMonth = useMemo(() => {
    if (selectedHistoryYear == null || selectedHistoryMonth == null) return [] as StudentHistoryRow[]
    return historyYears.get(selectedHistoryYear)?.get(selectedHistoryMonth) ?? []
  }, [historyYears, selectedHistoryYear, selectedHistoryMonth])

  const selectedHistoryResponse = useMemo(() => {
    if (!selectedResponseId || !selectedStudentGroup) return null
    return selectedStudentGroup.rows.find((r) => r.id === selectedResponseId) ?? null
  }, [selectedStudentGroup, selectedResponseId])

  useEffect(() => {
    if (!user || !selectedHistoryResponse || !selectedStudentId) return
    const qs = parseQuestions(forms.find((f) => f.id === selectedHistoryResponse.formId)?.questions)
    const obj =
      selectedHistoryResponse.responses &&
      typeof selectedHistoryResponse.responses === 'object' &&
      !Array.isArray(selectedHistoryResponse.responses)
        ? (selectedHistoryResponse.responses as Record<string, unknown>)
        : {}
    void syncCheckInSideEffects({
      ownerId: user.id,
      studentId: selectedStudentId,
      questions: qs,
      responses: obj,
    })
  }, [forms, selectedHistoryResponse, selectedStudentId, user])

  useEffect(() => {
    if (!user || !invites.length || !responses.length) return
    const byInvite = new Map(responses.map((r) => [r.invite_id, r]))
    for (const inv of invites) {
      const resp = byInvite.get(inv.id)
      if (!resp) continue
      const obj =
        resp.responses && typeof resp.responses === 'object' && !Array.isArray(resp.responses)
          ? (resp.responses as Record<string, unknown>)
          : {}
      void syncCheckInSideEffects({
        ownerId: user.id,
        studentId: inv.student_id,
        questions,
        responses: obj,
      })
    }
  }, [user, invites, responses, questions])

  useEffect(() => {
    if (checkInView !== 'student') {
      setSelectedStudentId(null)
      setSelectedHistoryYear(null)
      setSelectedHistoryMonth(null)
      setSelectedResponseId(null)
    }
  }, [checkInView])

  const savedForm = useMemo(() => (activeFormId ? forms.find((f) => f.id === activeFormId) ?? null : null), [forms, activeFormId])

  const loadInvitesAndResponses = useCallback(async (formId: string) => {
    const { data: invData, error: invErr } = await supabase
      .from('check_in_invites')
      .select('id, token, student_id, student:students(full_name, email)')
      .eq('form_id', formId)
    if (invErr) {
      toast.error(invErr.message)
      return
    }
    const rows = (invData ?? []) as unknown as InviteRow[]
    setInvites(rows)
    const inviteIds = rows.map((r) => r.id)
    if (!inviteIds.length) {
      setResponses([])
      return
    }
    const { data: respData, error: respErr } = await supabase
      .from('check_in_responses')
      .select('id, invite_id, submitted_at, responses, testimonial_consent, responder_email, email_verified, trainer_replied_at, trainer_note')
      .in('invite_id', inviteIds)
    if (respErr) toast.error(respErr.message)
    else setResponses((respData as ResponseRow[]) ?? [])
  }, [])

  useEffect(() => {
    if (!activeFormId) {
      setInvites([])
      setResponses([])
      setSelectedStudentIds(new Set())
      return
    }
    setSelectedStudentIds(new Set())
    void loadInvitesAndResponses(activeFormId)
  }, [activeFormId, loadInvitesAndResponses])

  /** Quitar de la selección alumnos que ya tienen link (p. ej. tras generar o recargar invitaciones). */
  useEffect(() => {
    if (!invites.length) return
    const withInvite = new Set(invites.map((i) => i.student_id))
    setSelectedStudentIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (withInvite.has(id)) changed = true
        else next.add(id)
      }
      return changed ? next : prev
    })
  }, [invites])

  function openForm(f: CheckInForm | null) {
    if (!f) {
      const weekly = weeklyFormDefaults()
      setActiveFormId(null)
      setTitle(weekly.title)
      setIntro(weekly.intro)
      setQuestions(weekly.questions)
      setIsActive(true)
      setSelectedStudentIds(new Set())
      return
    }
    setSelectedStudentIds(new Set())
    setActiveFormId(f.id)
    setTitle(f.title)
    setIntro(f.intro ?? '')
    setQuestions(parseQuestions(f.questions).length ? parseQuestions(f.questions) : defaultQuestions())
    setIsActive(f.is_active)
  }

  useEffect(() => {
    if (!formIdFromUrl || loading || forms.length === 0) return
    const f = forms.find((x) => x.id === formIdFromUrl)
    if (f) {
      openForm(f)
      setSearchParams({}, { replace: true })
    }
  }, [formIdFromUrl, forms, loading, setSearchParams])

  async function addCheckInSchedule() {
    if (!user || !activeFormId) {
      toast.error('Seleccioná un formulario en la lista de la izquierda')
      return
    }
    setScheduleBusy(true)
    const { error } = await supabase.from('check_in_send_schedules').insert({
      owner_id: user.id,
      form_id: activeFormId,
      day_of_week: newScheduleDow,
      timezone: newScheduleTz.trim() || 'America/Argentina/Buenos_Aires',
      prefer_group_whatsapp: newSchedulePreferGroup,
      is_enabled: true,
    })
    setScheduleBusy(false)
    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        toast.error('Ya tenés un recordatorio para ese formulario ese día.')
      } else toast.error(error.message)
      return
    }
    toast.success('Recordatorio guardado')
    void loadForms()
  }

  async function deleteCheckInSchedule(id: string) {
    if (!user) return
    if (!window.confirm('¿Quitar este recordatorio?')) return
    setScheduleBusy(true)
    const { error } = await supabase.from('check_in_send_schedules').delete().eq('id', id).eq('owner_id', user.id)
    setScheduleBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    void loadForms()
  }

  async function toggleCheckInSchedule(row: ScheduleRow, enabled: boolean) {
    if (!user) return
    const { error } = await supabase
      .from('check_in_send_schedules')
      .update({ is_enabled: enabled })
      .eq('id', row.id)
      .eq('owner_id', user.id)
    if (error) toast.error(error.message)
    else {
      setSchedules((prev) => prev.map((s) => (s.id === row.id ? { ...s, is_enabled: enabled } : s)))
    }
  }

  async function saveForm() {
    if (!user) return
    const t = title.trim()
    if (!t) {
      toast.error('Completá el título')
      return
    }
    setSaving(true)
    const payload = {
      owner_id: user.id,
      title: t,
      intro: intro.trim() || null,
      questions: questions as unknown as Json,
      is_active: isActive,
    }
    if (activeFormId) {
      const oldQuestions = parseQuestions(forms.find((f) => f.id === activeFormId)?.questions)
      const { error } = await supabase.from('check_in_forms').update(payload).eq('id', activeFormId).eq('owner_id', user.id)
      if (error) {
        setSaving(false)
        toast.error(error.message)
        return
      }
      const remapped = await remapCheckInResponsesForForm({
        formId: activeFormId,
        oldQuestions,
        newQuestions: questions,
      })
      setSaving(false)
      setForms((prev) => prev.map((x) => (x.id === activeFormId ? { ...x, ...payload, updated_at: new Date().toISOString() } : x)))
      toast.success(remapped > 0 ? 'Formulario actualizado. Se conservaron las respuestas ya cargadas.' : 'Formulario actualizado')
      if (remapped > 0) void loadInvitesAndResponses(activeFormId)
    } else {
      const { data, error } = await supabase.from('check_in_forms').insert(payload).select('*').single()
      setSaving(false)
      if (error) {
        toast.error(error.message)
        return
      }
      const row = data as CheckInForm
      setForms((prev) => [row, ...prev])
      setActiveFormId(row.id)
      toast.success('Formulario creado')
    }
  }

  async function deleteForm(id: string, formTitle: string) {
    if (!user) return
    const label = formTitle.trim() ? `«${formTitle.trim()}»` : 'este formulario'
    if (!window.confirm(`¿Eliminar ${label} y todas sus invitaciones y respuestas?`)) return
    const { error } = await supabase.from('check_in_forms').delete().eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setForms((prev) => prev.filter((f) => f.id !== id))
    if (activeFormId === id) openForm(null)
    toast.success('Eliminado')
  }

  function addQuestion() {
    setQuestions((q) => [...q, { id: crypto.randomUUID(), label: '', type: 'text' }])
  }

  function updateQuestion(id: string, patch: Partial<CheckInQuestion>) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  function removeQuestion(id: string) {
    setQuestions((q) => q.filter((x) => x.id !== id))
  }

  function moveQuestion(id: string, dir: 'up' | 'down') {
    setQuestions((q) => {
      const i = q.findIndex((x) => x.id === id)
      if (i < 0) return q
      const j = dir === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= q.length) return q
      const next = [...q]
      const [row] = next.splice(i, 1)
      next.splice(j, 0, row)
      return next
    })
  }

  function applyWeeklyTemplate() {
    if (questions.length && !window.confirm('Esto reemplaza las preguntas actuales por la plantilla semanal de Ferster. ¿Seguimos?')) {
      return
    }
    const weekly = weeklyFormDefaults()
    setTitle((t) => t.trim() || weekly.title)
    setIntro(weekly.intro)
    setQuestions(mergeCheckInTemplate(questions, weekly.questions))
    toast.success('Plantilla semanal aplicada. Guardá el formulario.')
  }

  function applyMonthlyTemplate() {
    if (questions.length && !window.confirm('Esto reemplaza las preguntas actuales por el feedback mensual. ¿Seguimos?')) {
      return
    }
    const monthly = monthlyFormDefaults()
    setTitle(monthly.title)
    setIntro(monthly.intro)
    setQuestions(mergeCheckInTemplate(questions, monthly.questions))
    toast.success('Plantilla de feedback mensual aplicada. Guardá el formulario.')
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function createInvites() {
    if (!user || !activeFormId) return
    const ids = [...selectedStudentIds]
    if (!ids.length) {
      toast.error('Seleccioná alumnos')
      return
    }
    setInviteBusy(true)
    const { data: existingRows, error: qErr } = await supabase
      .from('check_in_invites')
      .select('student_id')
      .eq('form_id', activeFormId)
      .in('student_id', ids)
    if (qErr) {
      setInviteBusy(false)
      toast.error(qErr.message)
      return
    }
    const existing = new Set((existingRows ?? []).map((r: { student_id: string }) => r.student_id))
    const toCreate = ids.filter((id) => !existing.has(id))
    const skipped = ids.length - toCreate.length
    if (!toCreate.length) {
      setInviteBusy(false)
      toast.error('Esos alumnos ya tienen link para este formulario')
      setSelectedStudentIds(new Set())
      void loadInvitesAndResponses(activeFormId)
      return
    }
    const rows = toCreate.map((student_id) => ({ form_id: activeFormId, student_id }))
    const { error } = await supabase.from('check_in_invites').insert(rows)
    setInviteBusy(false)
    if (error) {
      if (error.message.includes('duplicate key') || error.code === '23505') {
        toast.error('Algunos alumnos ya tenían link. Actualizamos la lista.')
        void loadInvitesAndResponses(activeFormId)
        return
      }
      toast.error(error.message)
      return
    }
    if (skipped > 0) {
      toast.success(
        `Links generados para ${toCreate.length} alumno${toCreate.length === 1 ? '' : 's'}. ${skipped} ya tenía${skipped === 1 ? '' : 'n'} link.`,
      )
    } else {
      toast.success(`Links generados para ${toCreate.length} alumno${toCreate.length === 1 ? '' : 's'}`)
    }
    setSelectedStudentIds(new Set())
    void loadInvitesAndResponses(activeFormId)
  }

  function publicUrl(token: string, email?: string | null) {
    const base = `${window.location.origin}/form/check-in/${token}`
    const e = email?.trim()
    return e ? `${base}?email=${encodeURIComponent(e)}` : base
  }

  function sharedPublicUrl(publicToken: string | undefined) {
    if (!publicToken) return ''
    return `${window.location.origin}/form/check-in/compartido/${publicToken}`
  }

  function monthlyFormUrl(): string | null {
    const monthly = forms.find((f) => isMonthlyTemplate(parseQuestions(f.questions)))
    const url = monthly?.public_token ? sharedPublicUrl(monthly.public_token) : ''
    return url || null
  }

  function sendMonthlyFeedbackWa(
    studentName: string,
    phone: string | null | undefined,
    reason: 'finished' | 'last_week' = 'finished',
  ) {
    const url = monthlyFormUrl()
    if (!url) {
      toast.error('Creá un formulario con la plantilla de feedback mensual.')
      return
    }
    const digits = normalizePhoneForWhatsApp(phone)
    if (!digits) {
      toast.error('Sin teléfono válido en la ficha')
      return
    }
    void shareToWhatsApp({
      phoneDigits: digits,
      message: monthlyFeedbackInviteMessage({ studentName, url, reason }),
    }).then((res) => {
      if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
    })
  }

  async function copyLink(token: string, email?: string | null) {
    try {
      await navigator.clipboard.writeText(publicUrl(token, email))
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function inviteEmail(inv: InviteRow): string | null {
    return inv.student?.email ?? students.find((s) => s.id === inv.student_id)?.email ?? null
  }

  function openCheckInWhatsApp(inv: InviteRow) {
    const st = students.find((s) => s.id === inv.student_id)
    if (!st) {
      toast.error('Alumno no encontrado')
      return
    }
    const digits = normalizePhoneForWhatsApp(st.phone)
    if (!digits) {
      toast.error(`Sin teléfono válido para ${st.full_name} (${STUDENT_PHONE_FORMAT_HINT} en la ficha)`)
      return
    }
    const formTitle = savedForm?.title ?? 'check-in'
    const msg = checkInInviteMessage({
      studentName: st.full_name,
      formTitle,
      url: publicUrl(inv.token, inviteEmail(inv)),
      intro: savedForm?.intro,
    })
    window.open(buildWhatsAppUrl(digits, msg), '_blank', 'noopener,noreferrer')
  }

  function openCheckInWhatsAppGroup() {
    if (!savedForm) {
      toast.error('Guardá el formulario primero')
      return
    }
    if (!savedForm.public_token) {
      toast.error('El link general todavía no está disponible. Guardá el formulario y recargá la página.')
      return
    }
    const sharedUrl = sharedPublicUrl(savedForm.public_token)
    const msg = checkInGroupMessage({
      formTitle: savedForm.title,
      intro: savedForm.intro,
      sharedUrl,
      entries: [],
    })
    window.open(buildWhatsAppGroupPickUrl(msg), '_blank', 'noopener,noreferrer')
    toast.success('Elegí el grupo (o chat) en WhatsApp y enviá el mensaje')
  }

  async function copySharedLink() {
    if (!savedForm?.public_token) {
      toast.error('Guardá el formulario para obtener el link general')
      return
    }
    try {
      await navigator.clipboard.writeText(sharedPublicUrl(savedForm.public_token))
      toast.success('Link general copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const responseByInvite = useMemo(() => {
    const m = new Map<string, ResponseRow>()
    for (const r of responses) {
      const prev = m.get(r.invite_id)
      if (!prev || new Date(r.submitted_at) > new Date(prev.submitted_at)) {
        m.set(r.invite_id, r)
      }
    }
    return m
  }, [responses])

  /**
   * Borradores locales de la nota privada por respuesta. Permite que el trainer
   * escriba sin tocar el server en cada keystroke; se persisten al hacer click
   * en "Guardar nota" o al togglear el estado respondido/pendiente.
   */
  const [noteDrafts, setNoteDrafts] = useState<Map<string, string>>(new Map())
  const [savingResponseIds, setSavingResponseIds] = useState<Set<string>>(new Set())

  function noteDraftFor(resp: ResponseRow): string {
    const draft = noteDrafts.get(resp.id)
    return draft !== undefined ? draft : resp.trainer_note ?? ''
  }

  const setSavingFlag = useCallback((id: string, on: boolean) => {
    setSavingResponseIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  /**
   * Marca/desmarca la respuesta como contestada y persiste la nota privada.
   * Usa la RPC `set_check_in_response_trainer_status` que valida ownership.
   *
   * - `replied=true` → setea `trainer_replied_at` a now() (o lo conserva si ya estaba).
   * - `replied=false` → limpia `trainer_replied_at` (vuelve a pendiente).
   * - `note` → se trimea; vacío se guarda como `null`.
   */
  const setResponseTrainerStatus = useCallback(
    async (response: ResponseRow, replied: boolean, noteOverride?: string) => {
      const note = noteOverride !== undefined ? noteOverride : noteDraftFor(response)
      setSavingFlag(response.id, true)
      const { data, error } = await supabase.rpc('set_check_in_response_trainer_status', {
        p_response_id: response.id,
        p_replied: replied,
        p_note: note,
      })
      setSavingFlag(response.id, false)
      if (error) {
        toast.error(error.message)
        return
      }
      const updated = data as ResponseRow | null
      if (!updated) return
      setResponses((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      setStudentHistory((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                trainer_replied_at: updated.trainer_replied_at,
                trainer_note: updated.trainer_note,
              }
            : r,
        ),
      )
      // Sincronizar el draft con el valor persistido (por si el server trimeó).
      setNoteDrafts((prev) => {
        const next = new Map(prev)
        next.set(response.id, updated.trainer_note ?? '')
        return next
      })
      toast.success(replied ? 'Marcado como respondido' : 'Marcado como pendiente')
    },
    // noteDraftFor depende de noteDrafts + responses; ambos están cubiertos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteDrafts, responses, setSavingFlag],
  )

  function exportResponsesCsv() {
    if (!savedForm) return
    const qs = parseQuestions(savedForm.questions)
    const rows: string[][] = []
    const header = [
      'Alumno',
      'Fecha respuesta',
      'Consentimiento testimonio',
      'Email declarado',
      'Email verif. ficha',
      ...qs.map((q) => q.label.replace(/\s+/g, ' ').trim() || q.id),
    ]
    rows.push(header)
    for (const inv of invites) {
      const resp = responseByInvite.get(inv.id)
      if (!resp) continue
      const obj =
        resp.responses && typeof resp.responses === 'object' && !Array.isArray(resp.responses)
          ? (resp.responses as Record<string, unknown>)
          : {}
      const line = [
        inv.student?.full_name ?? '',
        new Date(resp.submitted_at).toISOString(),
        resp.testimonial_consent ? 'sí' : 'no',
        resp.responder_email ?? '',
        resp.email_verified ? 'sí' : 'no',
        ...qs.map((q) => formatStoredAnswer(q, obj[q.id])),
      ]
      rows.push(line)
    }
    if (rows.length <= 1) {
      toast.error('No hay respuestas para exportar')
      return
    }
    const csv = rows.map((line) => line.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `check-in-${savedForm.title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'respuestas'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV descargado')
  }

  return (
    <div>
      {!embedded ? <Header title="Check-ins" /> : null}
      <DirectoryPageShell className={cn('max-w-5xl space-y-6', embedded && 'py-0')}>
        <PageSectionTitle
          title="Formularios semanales"
          description="Armá un formulario corto y compartí un link general en el grupo (cada alumno completa con su correo). También podés generar links personales por alumno."
          action={
            checkInView === 'form' ? (
              <Button
                type="button"
                variant="gradientSecondary"
                size="md"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => openForm(null)}
              >
                Nuevo formulario
              </Button>
            ) : null
          }
        />

        <div
          className="flex w-full max-w-md gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
          role="tablist"
          aria-label="Vista de check-ins"
        >
          <button
            type="button"
            role="tab"
            aria-selected={checkInView === 'student'}
            onClick={() => setCheckInView('student')}
            className={cn(
              'flex flex-1 min-h-9 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              checkInView === 'student'
                ? 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated',
            )}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            Por alumno
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={checkInView === 'form'}
            onClick={() => setCheckInView('form')}
            className={cn(
              'flex flex-1 min-h-9 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              checkInView === 'form'
                ? 'border-surface-border bg-surface-card text-ink-primary shadow-sm'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated',
            )}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
            Por formulario
          </button>
        </div>

        {checkInView === 'student' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Vista por alumno">
              {([
                { id: 'seguimiento' as const, label: 'Seguimiento' },
                { id: 'sin_respuesta' as const, label: 'Sin respuesta' },
                { id: 'feedbacks' as const, label: 'Feedbacks general' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={studentPanel === opt.id}
                  onClick={() => setStudentPanel(opt.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    studentPanel === opt.id
                      ? 'border-brand-secondary/40 bg-brand-secondary/12 text-ink-primary'
                      : 'border-surface-border text-ink-secondary hover:bg-surface-elevated',
                  )}
                >
                  {opt.label}
                  {opt.id === 'sin_respuesta' && missingStudents.length > 0 ? (
                    <span className="ml-1 tabular-nums opacity-70">{missingStudents.length}</span>
                  ) : null}
                </button>
              ))}
            </div>

            {studentPanel === 'sin_respuesta' ? (
              <Card padding="lg" className="space-y-3 border-amber-500/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">
                      No completaron el formulario de esta semana
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      Desde el {formatPeriodYmd(periodStart)}
                      {isWeeklyPeriodOverdue(periodStart) ? ' · ya pasaron 3 días hábiles: recordales' : ' · tienen 3 días hábiles'}
                      . {missingStudents.length} sin respuesta.
                    </p>
                  </div>
                </div>
                {missingStudents.length > 0 ? (
                <ul className="divide-y divide-surface-border/60 rounded-xl border border-surface-border/80 overflow-hidden">
                  {missingStudents.map((st) => (
                    <li key={st.id} className="flex items-center gap-3 px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm font-medium text-ink-primary">{st.full_name}</p>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200"
                        onClick={() => {
                          const weekly = forms.find((f) => isWeeklyTemplate(parseQuestions(f.questions)))
                          const url = weekly?.public_token ? sharedPublicUrl(weekly.public_token) : ''
                          const digits = normalizePhoneForWhatsApp(st.phone)
                          if (!digits) {
                            toast.error('Sin teléfono válido en la ficha')
                            return
                          }
                          window.open(
                            buildWhatsAppUrl(digits, weeklyFormMissingReminderMessage(st.full_name, url)),
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }}
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                        Recordar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">Todos completaron el formulario de esta semana.</p>
              )}
              </Card>
            ) : null}

            {studentPanel === 'seguimiento' ? <StudentRoutineWeekPanel /> : null}

            {studentPanel === 'feedbacks' ? (
          <Card padding="lg" className={cn('space-y-4', checkInPanelCardClass)}>
            <p className="text-xs text-ink-secondary max-w-prose">
              Elegí un alumno, después el año y el mes, y por último la respuesta. Así el listado escala si el alumno está años con vos.
            </p>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Tipo de formulario">
              {([
                { id: 'weekly' as const, label: 'Feedback semanales' },
                { id: 'monthly' as const, label: 'Feedback mensuales' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={historyKind === opt.id}
                  onClick={() => setHistoryKind(opt.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                    historyKind === opt.id
                      ? 'border-brand-secondary/40 bg-brand-secondary/12 text-ink-primary'
                      : 'border-surface-border text-ink-secondary hover:bg-surface-elevated',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Estado de revisión">
              {([
                { id: 'all' as const, label: 'Todos' },
                { id: 'pending' as const, label: 'Pendientes' },
                { id: 'al_dia' as const, label: 'Al día' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={historyStatusFilter === opt.id}
                  onClick={() => setHistoryStatusFilter(opt.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                    historyStatusFilter === opt.id
                      ? opt.id === 'pending'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                        : opt.id === 'al_dia'
                          ? 'border-emerald-600/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                          : 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary'
                      : 'border-surface-border text-ink-secondary hover:bg-surface-elevated',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {studentHistoryLoading ? (
              <p className="text-sm text-ink-muted py-8 text-center">Cargando historial…</p>
            ) : visibleHistoryByStudent.length === 0 ? (
              <EmptyState
                title={historyKind === 'monthly' ? 'Sin feedbacks mensuales' : 'Sin check-ins semanales'}
                description={
                  historyKind === 'monthly'
                    ? 'Cuando un alumno complete el formulario mensual, aparece acá y queda asociado a la rutina de esas fechas.'
                    : 'Cuando los alumnos completen el formulario semanal, aparecerán acá agrupados por nombre.'
                }
              />
            ) : selectedHistoryResponse && selectedStudentGroup ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedResponseId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Volver a {selectedHistoryYear != null && selectedHistoryMonth != null
                    ? monthLabelEs(selectedHistoryYear, selectedHistoryMonth)
                    : `fechas de ${selectedStudentGroup.studentName}`}
                </button>
                {(() => {
                  const row = selectedHistoryResponse
                  const obj =
                    row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
                      ? (row.responses as Record<string, unknown>)
                      : {}
                  const isReplied = !!row.trainer_replied_at
                  const isSaving = savingResponseIds.has(row.id)
                  return (
                    <div className="rounded-xl border border-surface-border/80 bg-surface-elevated/15 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-primary">{selectedStudentGroup.studentName}</p>
                          <p className="text-xs text-ink-secondary">{row.formTitle}</p>
                          <p className="text-[11px] text-ink-muted">
                            {checkInHistoryMeta(
                              parseQuestions(forms.find((f) => f.id === row.formId)?.questions),
                              obj,
                              row.submitted_at,
                              selectedStudentGroup.studentName,
                            ).filingLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void setResponseTrainerStatus(row, !isReplied)}
                          disabled={isSaving}
                          aria-pressed={isReplied}
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium disabled:opacity-50',
                            isReplied
                              ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                          )}
                        >
                          {isReplied ? (
                            <>
                              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                              Respondido
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" aria-hidden />
                              Pendiente
                            </>
                          )}
                        </button>
                      </div>
                      <div className="border-t border-surface-border/60 pt-3 space-y-3">
                        {(() => {
                          const qs = parseQuestions(forms.find((f) => f.id === row.formId)?.questions)
                          const student = students.find((s) => s.id === selectedStudentId)
                          const matched = matchRoutineForSubmittedAt(
                            studentRoutines.filter((r) => r.student_id === selectedStudentId),
                            row.submitted_at,
                          )
                          if (isMonthlyTemplate(qs)) {
                            return (
                              <MonthlyFeedbackAnswers
                                studentName={selectedStudentGroup.studentName}
                                questions={qs}
                                responses={obj}
                                routineName={matched?.name}
                              />
                            )
                          }
                          const st = weekStatusFromAnswers(qs, obj)
                          return (
                            <>
                              <CheckInAnswerList questions={qs} responses={obj} />
                              {st.lastWeek ? (
                                <CheckInLastWeekBanner
                                  onAskMonthly={() =>
                                    sendMonthlyFeedbackWa(
                                      selectedStudentGroup.studentName,
                                      student?.phone,
                                      'last_week',
                                    )
                                  }
                                />
                              ) : null}
                              {st.finished ? (
                                <CheckInFinishedBanner
                                  description="Marcó «Terminé mi mes de rutina». Pedile la foto del registro de progreso y el feedback mensual."
                                  onAskProgress={() => {
                                    const digits = normalizePhoneForWhatsApp(student?.phone)
                                    if (!digits) {
                                      toast.error('Sin teléfono válido en la ficha')
                                      return
                                    }
                                    void shareToWhatsApp({
                                      phoneDigits: digits,
                                      message: routineMonthFinishedWhatsAppMessage(selectedStudentGroup.studentName),
                                    }).then((res) => {
                                      if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
                                    })
                                  }}
                                  onAskMonthly={() =>
                                    sendMonthlyFeedbackWa(selectedStudentGroup.studentName, student?.phone)
                                  }
                                />
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                      {row.trainer_note ? (
                        <p className="text-[11px] text-ink-secondary italic border-l-2 border-brand-secondary/30 pl-2">
                          Nota: {row.trainer_note}
                        </p>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
            ) : selectedStudentGroup && selectedHistoryYear != null && selectedHistoryMonth != null ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHistoryMonth(null)
                    setSelectedResponseId(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Meses de {selectedHistoryYear}
                </button>
                <div className="rounded-xl border border-surface-border/80 bg-surface-elevated/20 px-4 py-2.5">
                  <p className="font-semibold capitalize text-ink-primary">
                    {monthLabelEs(selectedHistoryYear, selectedHistoryMonth)}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {historyRowsOfMonth.length} respuesta{historyRowsOfMonth.length !== 1 ? 's' : ''} · {selectedStudentGroup.studentName}
                  </p>
                </div>
                <ul className="divide-y divide-surface-border/60 rounded-xl border border-surface-border/80 overflow-hidden">
                  {historyRowsOfMonth.map((row) => {
                    const isReplied = !!row.trainer_replied_at
                    const submitted = new Date(row.submitted_at)
                    const obj =
                      row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
                        ? (row.responses as Record<string, unknown>)
                        : {}
                    const meta = checkInHistoryMeta(
                      parseQuestions(forms.find((f) => f.id === row.formId)?.questions),
                      obj,
                      row.submitted_at,
                      selectedStudentGroup.studentName,
                    )
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedResponseId(row.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-primary tabular-nums">
                              {submitted.toLocaleDateString('es-AR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                              })}
                              <span className="ml-2 font-normal text-ink-muted">
                                {submitted.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </p>
                            <p className="truncate text-xs text-ink-secondary">{meta.weekLabel}</p>
                            <p className="truncate text-[10px] text-ink-muted">{row.formTitle}</p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              isReplied
                                ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            )}
                          >
                            {isReplied ? 'Respondido' : 'Pendiente'}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : selectedStudentGroup && selectedHistoryYear != null ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHistoryYear(null)
                    setSelectedHistoryMonth(null)
                    setSelectedResponseId(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Años de {selectedStudentGroup.studentName}
                </button>
                <div className="rounded-xl border border-surface-border/80 bg-surface-elevated/20 px-4 py-2.5">
                  <p className="font-semibold text-ink-primary">{selectedHistoryYear}</p>
                  <p className="text-[11px] text-ink-muted">{selectedStudentGroup.studentName}</p>
                </div>
                <ul className="divide-y divide-surface-border/60 rounded-xl border border-surface-border/80 overflow-hidden">
                  {historyMonthsOfYear.map(({ month, rows }) => {
                    const pending = rows.filter((r) => !r.trainer_replied_at).length
                    return (
                      <li key={month}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryMonth(month)
                            setSelectedResponseId(null)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left capitalize transition-colors hover:bg-surface-elevated/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink-primary">{monthLabelEs(selectedHistoryYear, month)}</p>
                            <p className="text-[11px] text-ink-muted">
                              {rows.length} respuesta{rows.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {pending > 0 ? (
                            <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              {pending} pend.
                            </span>
                          ) : null}
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : selectedStudentGroup ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(null)
                    setSelectedHistoryYear(null)
                    setSelectedHistoryMonth(null)
                    setSelectedResponseId(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Todos los alumnos
                </button>
                <div className="rounded-xl border border-surface-border/80 bg-surface-elevated/20 px-4 py-2.5">
                  <p className="font-semibold text-ink-primary">{selectedStudentGroup.studentName}</p>
                  <p className="text-[11px] text-ink-muted">
                    {selectedStudentGroup.rows.length} respuesta{selectedStudentGroup.rows.length !== 1 ? 's' : ''} · elegí el año
                  </p>
                </div>
                <ul className="divide-y divide-surface-border/60 rounded-xl border border-surface-border/80 overflow-hidden">
                  {historyYearList.map((year) => {
                    const months = historyYears.get(year)
                    const count = months ? [...months.values()].reduce((n, rows) => n + rows.length, 0) : 0
                    return (
                      <li key={year}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryYear(year)
                            setSelectedHistoryMonth(null)
                            setSelectedResponseId(null)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold tabular-nums text-ink-primary">{year}</p>
                            <p className="text-[11px] text-ink-muted">
                              {count} respuesta{count !== 1 ? 's' : ''} · {months?.size ?? 0} mes{(months?.size ?? 0) !== 1 ? 'es' : ''}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <ul className="divide-y divide-surface-border/60 rounded-xl border border-surface-border/80 overflow-hidden">
                {visibleHistoryByStudent.map(([studentId, group]) => {
                  const pending = group.rows.filter((r) => !r.trainer_replied_at).length
                  const latest = group.rows[0]
                  return (
                    <li key={studentId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(studentId)
                          setSelectedHistoryYear(null)
                          setSelectedHistoryMonth(null)
                          setSelectedResponseId(null)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink-primary">{group.studentName}</p>
                          <p className="text-[11px] text-ink-muted">
                            {group.rows.length} respuesta{group.rows.length !== 1 ? 's' : ''}
                            {latest ? (
                              <>
                                {' · '}
                                {(() => {
                                  const obj =
                                    latest.responses &&
                                    typeof latest.responses === 'object' &&
                                    !Array.isArray(latest.responses)
                                      ? (latest.responses as Record<string, unknown>)
                                      : {}
                                  return checkInHistoryMeta(
                                    parseQuestions(forms.find((f) => f.id === latest.formId)?.questions),
                                    obj,
                                    latest.submitted_at,
                                    group.studentName,
                                  ).filingLabel
                                })()}
                              </>
                            ) : null}
                          </p>
                        </div>
                        {pending > 0 ? (
                          <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            {pending} pend.
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                            Al día
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
            ) : null}
          </div>
        ) : null}

        {checkInView === 'form' ? (
        <div className="grid lg:grid-cols-5 gap-4 lg:gap-6">
          <Card padding="lg" className={cn('space-y-3 lg:col-span-2', checkInPanelCardClass)}>
            <CardHeader className="mb-2">
              <CardTitle className="text-label font-semibold uppercase tracking-wider text-brand-secondary/90">
                Mis formularios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-ink-muted">Cargando…</p>
            ) : forms.length === 0 ? (
              <EmptyState
                title="Sin formularios"
                description="Creá el primero para enviar check-ins por link general o personal."
                action={{ label: 'Nuevo formulario', onClick: () => openForm(null), icon: <Plus className="h-4 w-4" /> }}
              />
            ) : (
              <ul className="space-y-1.5">
                {forms.map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className={cn(
                        'flex-1 min-w-0 text-left rounded-xl border px-3 py-2.5 text-sm transition-all duration-200',
                        activeFormId === f.id ? checkInFormTileActiveClass : checkInFormTileIdleClass,
                      )}
                      onClick={() => openForm(f)}
                    >
                      <span className="block truncate">{f.title}</span>
                      <span className="text-[10px] font-normal text-ink-muted">
                        {isMonthlyTemplate(parseQuestions(f.questions))
                          ? 'Feedback mensual'
                          : isWeeklyTemplate(parseQuestions(f.questions))
                            ? 'Check-in semanal'
                            : null}
                        {!f.is_active ? `${isMonthlyTemplate(parseQuestions(f.questions)) || isWeeklyTemplate(parseQuestions(f.questions)) ? ' · ' : ''}Pausado` : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg p-2 text-ink-muted transition-colors hover:bg-status-expired/10 hover:text-status-expired"
                      title="Eliminar formulario"
                      aria-label={`Eliminar formulario ${f.title}`}
                      onClick={() => void deleteForm(f.id, f.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </CardContent>
          </Card>

          <Card padding="lg" className={cn('space-y-4 lg:col-span-3', checkInPanelCardClass)}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-secondary/25 bg-brand-secondary/10">
                <ClipboardCheck className="h-4 w-4 text-brand-secondary" strokeWidth={1.75} />
              </span>
              <h2 className="text-sm font-semibold text-ink-primary">
                {activeFormId ? 'Editar formulario' : 'Nuevo formulario'}
              </h2>
            </div>
            {isWeeklyTemplate(questions) ? (
              <div className="rounded-xl border border-brand-secondary/25 bg-brand-secondary/8 px-3 py-2.5 space-y-2">
                <p className="text-[11px] font-semibold text-ink-primary">Semana de envío</p>
                <p className="text-[10px] leading-relaxed text-ink-muted">
                  El link es el mismo todas las semanas. Iniciá una ronda con la fecha de hoy (o el viernes) para
                  marcar quién ya respondió <em>esta</em> vuelta. Tienen 3 días hábiles (hasta el {formatPeriodYmd(weeklyPeriodDueYmd(periodStart))}).
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[10px] font-medium text-ink-secondary">
                    Fecha de inicio
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="mt-1 block rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!user) return
                      const ymd = periodStart || defaultWeeklyPeriodStartYmd()
                      saveWeeklyPeriodStartYmd(user.id, ymd)
                      setPeriodStart(ymd)
                      toast.success(`Semana iniciada el ${formatPeriodYmd(ymd)}. Quienes respondieron antes pueden completar de nuevo.`)
                    }}
                  >
                    Iniciar semana
                  </Button>
                </div>
              </div>
            ) : null}
            <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Check semanal" />
            <Textarea
              label="Intro (opcional)"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={6}
              placeholder="Texto que ve el alumno arriba del formulario…"
            />
            <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer rounded-xl border border-surface-border/60 bg-surface-elevated/20 px-3 py-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className={checkInCheckboxClass}
              />
              Formulario activo (si no, el link muestra error)
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label font-semibold uppercase tracking-wider text-brand-secondary/80">Preguntas</span>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="outline" className="text-[10px] h-7" onClick={applyWeeklyTemplate}>
                    Plantilla semanal
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="text-[10px] h-7" onClick={applyMonthlyTemplate}>
                    Feedback mensual
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8 text-brand-secondary hover:text-brand-secondary hover:bg-brand-secondary/10"
                    onClick={addQuestion}
                  >
                    + Pregunta
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-ink-muted">
                Podés cambiar el orden, el texto y las opciones. Cada opción admite una aclaración opcional del alumno.
              </p>
              {questions.map((q, idx) => (
                <CheckInQuestionEditor
                  key={q.id}
                  question={q}
                  index={idx}
                  total={questions.length}
                  onChange={(patch) => updateQuestion(q.id, patch)}
                  onRemove={() => removeQuestion(q.id)}
                  onMove={(dir) => moveQuestion(q.id, dir)}
                />
              ))}
            </div>

            <Button type="button" variant="gradientSecondary" onClick={() => void saveForm()} loading={saving}>
              {activeFormId ? 'Guardar cambios' : 'Crear formulario'}
            </Button>

            {activeFormId && savedForm ? (
              <>
                <div className={cn('border-t border-surface-border/80 pt-4', checkInHighlightPanelClass)}>
                  <h3 className="text-label font-semibold uppercase tracking-wider text-brand-secondary/90">
                    Link general (recomendado)
                  </h3>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Un solo link para todos. Cada persona ingresa su correo (el mismo de la ficha) y la respuesta queda vinculada automáticamente. El
                    texto del intro (con emojis) se incluye al compartir por WhatsApp.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="gradientSecondary"
                      className="text-xs h-8"
                      onClick={() => void copySharedLink()}
                    >
                      Copiar link general
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                    >
                      <a href={sharedPublicUrl(savedForm.public_token)} target="_blank" rel="noopener noreferrer">
                        Abrir
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-emerald-600/45 text-emerald-800 dark:text-emerald-400"
                      icon={<WhatsAppIcon className="h-3 w-3" />}
                      onClick={openCheckInWhatsAppGroup}
                    >
                      Grupo WA
                    </Button>
                  </div>
                  <p className="text-[10px] text-ink-muted font-mono break-all">{sharedPublicUrl(savedForm.public_token)}</p>
                </div>

                <div className="border-t border-surface-border/80 pt-4 space-y-3">
                  <h3 className="text-label font-semibold uppercase tracking-wider text-brand-secondary/90">
                    Links por alumno (opcional)
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    El link personal se reutiliza todas las semanas. Quien respondió la semana pasada puede volver a completar.
                  </p>
                  <p className="text-[11px] text-ink-secondary rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2">
                    No compartas los links en grupos públicos: son como una clave. Si un formulario queda pausado, el link deja de aceptar respuestas
                    nuevas.
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-surface-border/80 bg-surface-elevated/15 p-2">
                    {students.map((s) => {
                      const inv = invites.find((i) => i.student_id === s.id)
                      const resp = inv ? responseByInvite.get(inv.id) : undefined
                      const thisWeek = resp ? submittedInWeeklyPeriod(resp.submitted_at, periodStart) : false
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer hover:bg-brand-secondary/8"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className={checkInCheckboxClass}
                          />
                          {s.full_name}
                          {thisWeek ? (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300">completó esta semana</span>
                          ) : inv ? (
                            <span className="text-[10px] text-ink-muted">tiene link · puede completar de nuevo</span>
                          ) : null}
                        </label>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="gradientSecondary"
                    loading={inviteBusy}
                    disabled={inviteBusy || selectedStudentIds.size === 0}
                    onClick={() => void createInvites()}
                  >
                    Generar links
                  </Button>
                </div>

                <div className="border-t border-surface-border/80 pt-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-label font-semibold uppercase tracking-wider text-brand-secondary/90">
                      Invitaciones y respuestas
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {invites.some((i) => responseByInvite.has(i.id)) ? (
                        <Button type="button" size="sm" variant="outline" className="text-xs h-7" icon={<Download className="h-3.5 w-3.5" />} onClick={exportResponsesCsv}>
                          Exportar CSV
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {invites.length === 0 ? (
                    <p className="text-sm text-ink-muted">Todavía no hay links generados.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-ink-muted border-b border-surface-border">
                            <th className="py-2 pr-2">Alumno</th>
                            <th className="py-2 pr-2">Estado</th>
                            <th className="py-2 pr-2">Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invites.map((inv) => {
                            const resp = responseByInvite.get(inv.id)
                            const thisWeek = resp ? submittedInWeeklyPeriod(resp.submitted_at, periodStart) : false
                            return (
                              <tr key={inv.id} className="border-b border-surface-border/80">
                                <td className="py-2 pr-2 text-ink-primary">{inv.student?.full_name ?? '—'}</td>
                                <td className="py-2 pr-2">
                                  {thisWeek && resp ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        Respondió esta semana · {new Date(resp.submitted_at).toLocaleDateString('es-AR')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => void setResponseTrainerStatus(resp, !resp.trainer_replied_at)}
                                        disabled={savingResponseIds.has(resp.id)}
                                        title={resp.trainer_replied_at ? 'Marcar como pendiente' : 'Marcar como respondido'}
                                        aria-pressed={!!resp.trainer_replied_at}
                                        className={cn(
                                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50',
                                          resp.trainer_replied_at
                                            ? 'border border-emerald-600/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                                            : 'border border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300',
                                        )}
                                      >
                                        {resp.trainer_replied_at ? (
                                          <>
                                            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                                            Respondido
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                                            Pendiente
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ) : resp ? (
                                    <span className="text-ink-muted">
                                      Semana anterior ({new Date(resp.submitted_at).toLocaleDateString('es-AR')}) · puede completar de nuevo
                                    </span>
                                  ) : (
                                    <span className="text-ink-muted">Pendiente esta semana</span>
                                  )}
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className={cn(inviteTableActionBtnClass, 'min-w-7 px-0')}
                                      aria-label={`Copiar link de check-in para ${inv.student?.full_name ?? 'alumno'}`}
                                      onClick={() => void copyLink(inv.token, inviteEmail(inv))}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="outline"
                                      className={inviteTableActionBtnClass}
                                    >
                                      <a
                                        href={publicUrl(inv.token, inviteEmail(inv))}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Abrir
                                      </a>
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      title="Enviar link por WhatsApp"
                                      aria-label={`Enviar link por WhatsApp a ${inv.student?.full_name ?? 'alumno'}`}
                                      className={cn(
                                        inviteTableActionBtnClass,
                                        'border-emerald-600/45 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/12 hover:border-emerald-600/55 hover:text-emerald-900 dark:hover:text-emerald-300',
                                      )}
                                      onClick={() => openCheckInWhatsApp(inv)}
                                    >
                                      <WhatsAppIcon className="h-3 w-3" />
                                      WA
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <p className="border-t border-surface-border/80 pt-3 text-[11px] text-ink-muted">
                  Las respuestas de cada alumno están en <strong className="text-ink-secondary">Por alumno → Feedbacks general</strong>.
                </p>
              </>
            ) : null}
          </Card>
        </div>
        ) : null}

        {checkInView === 'form' ? (
        <Card padding="lg" className={cn('space-y-4', checkInPanelCardClass)}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-secondary/25 bg-brand-secondary/10">
              <CalendarClock className="h-4 w-4 text-brand-secondary" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-ink-primary">Recordatorios de envío (WhatsApp)</h2>
          </div>
          <p className="text-xs text-ink-secondary max-w-prose">
            Definí un día fijo por formulario (en tu zona horaria). Ese día verás un recordatorio en{' '}
            <strong className="text-ink-primary">Inicio</strong> (panel Consulta semanal → Check-ins).
            WhatsApp no se envía solo: desde acá usá <strong className="text-ink-primary">Grupo WA</strong> para mandar todos los links juntos.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[8rem]">
              <label className="text-[10px] font-medium uppercase tracking-wide text-ink-muted" htmlFor="sched-dow">
                Día
              </label>
              <select
                id="sched-dow"
                className={cn('w-full', checkInFieldSelectClass, 'text-sm')}
                value={newScheduleDow}
                onChange={(e) => setNewScheduleDow(Number(e.target.value))}
              >
                {([0, 1, 2, 3, 4, 5, 6] as const).map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LABELS_ES[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[10rem]">
              <label className="text-[10px] font-medium uppercase tracking-wide text-ink-muted" htmlFor="sched-tz">
                Zona horaria
              </label>
              <select
                id="sched-tz"
                className={cn('w-full', checkInFieldSelectClass, 'text-sm')}
                value={newScheduleTz}
                onChange={(e) => setNewScheduleTz(e.target.value)}
              >
                {COMMON_TIMEZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={newSchedulePreferGroup}
                onChange={(e) => setNewSchedulePreferGroup(e.target.checked)}
                className={checkInCheckboxClass}
              />
              Preferir envío al grupo
            </label>
            <Button
              type="button"
              size="sm"
              variant="gradientSecondary"
              loading={scheduleBusy}
              disabled={scheduleBusy || !activeFormId || forms.length === 0}
              onClick={() => void addCheckInSchedule()}
            >
              Agregar para «{savedForm?.title ?? '…'}»
            </Button>
          </div>
          {!activeFormId ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Elegí un formulario en la columna izquierda para asociar el recordatorio.
            </p>
          ) : null}
          {schedules.length === 0 ? (
            <p className="text-sm text-ink-muted">Todavía no hay recordatorios.</p>
          ) : (
            <ul className="space-y-2">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border/80 bg-surface-elevated/20 px-3 py-2.5 text-sm transition-colors hover:border-brand-secondary/25"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-primary truncate">{s.form?.title ?? 'Formulario'}</p>
                    <p className="text-[11px] text-ink-muted">
                      Cada {WEEKDAY_LABELS_ES[s.day_of_week] ?? '—'} · {s.timezone}
                      {s.prefer_group_whatsapp ? ' · sugerido: grupo WA' : ''}
                      {!s.is_enabled ? ' · pausado' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => void toggleCheckInSchedule(s, !s.is_enabled)}
                    >
                      {s.is_enabled ? 'Pausar' : 'Activar'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-status-expired"
                      onClick={() => void deleteCheckInSchedule(s.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        ) : null}
      </DirectoryPageShell>
    </div>
  )
}
