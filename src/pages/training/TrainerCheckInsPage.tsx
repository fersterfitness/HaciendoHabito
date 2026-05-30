import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Check, ClipboardCheck, Clock, Copy, Plus, Save, Trash2, Download, Users } from 'lucide-react'
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
import {
  buildWhatsAppGroupPickUrl,
  buildWhatsAppUrl,
  checkInGroupMessage,
  checkInInviteMessage,
  normalizePhoneForWhatsApp,
} from '@/lib/whatsapp'
import { STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import { cn } from '@/lib/utils'
import { COMMON_TIMEZONES, WEEKDAY_LABELS_ES } from '@/lib/checkInSchedule'
import type { CheckInForm, CheckInSendSchedule, Json, Student } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionDef = { id: string; label: string; type: 'text' | 'scale' }

function parseQuestions(raw: Json): QuestionDef[] {
  if (!Array.isArray(raw)) return []
  const out: QuestionDef[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    const t = o.type === 'scale' ? 'scale' : 'text'
    out.push({ id: o.id, label: o.label, type: t })
  }
  return out
}

function defaultQuestions(): QuestionDef[] {
  return [
    { id: crypto.randomUUID(), label: '¿Cómo te sentís esta semana con el entrenamiento?', type: 'text' },
    { id: crypto.randomUUID(), label: 'Del 1 al 5, ¿cómo calificarías tu descanso?', type: 'scale' },
  ]
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
  student: { full_name: string } | null
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

const checkInQuestionRowClass =
  'flex flex-col sm:flex-row gap-2 items-start rounded-xl border border-surface-border/80 bg-surface-elevated/20 p-2.5 transition-colors hover:border-brand-secondary/25'

export function TrainerCheckInsPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const formIdFromUrl = searchParams.get('formId')
  const [forms, setForms] = useState<CheckInForm[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')
  const [questions, setQuestions] = useState<QuestionDef[]>(defaultQuestions)
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
    else setForms((fRes.data as CheckInForm[]) ?? [])
    if (sRes.error) toast.error(sRes.error.message)
    else setStudents((sRes.data as Student[]) ?? [])
    if (schRes.error) toast.error(schRes.error.message)
    else setSchedules((schRes.data as unknown as ScheduleRow[]) ?? [])
  }, [user])

  useEffect(() => {
    void loadForms()
  }, [loadForms])

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
      student: { full_name: string } | null
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
      const g = map.get(row.studentId) ?? { studentName: row.studentName, rows: [] }
      g.rows.push(row)
      map.set(row.studentId, g)
    }
    return [...map.entries()].sort((a, b) => a[1].studentName.localeCompare(b[1].studentName, 'es'))
  }, [studentHistory])

  const questionLabelsByFormId = useMemo(() => {
    const out = new Map<string, Map<string, string>>()
    for (const f of forms) {
      const labels = new Map<string, string>()
      for (const q of parseQuestions(f.questions)) labels.set(q.id, q.label)
      out.set(f.id, labels)
    }
    return out
  }, [forms])

  const savedForm = useMemo(() => (activeFormId ? forms.find((f) => f.id === activeFormId) ?? null : null), [forms, activeFormId])

  const loadInvitesAndResponses = useCallback(async (formId: string) => {
    const { data: invData, error: invErr } = await supabase
      .from('check_in_invites')
      .select('id, token, student_id, student:students(full_name)')
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
      setActiveFormId(null)
      setTitle('')
      setIntro('')
      setQuestions(defaultQuestions())
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
      const { error } = await supabase.from('check_in_forms').update(payload).eq('id', activeFormId).eq('owner_id', user.id)
      setSaving(false)
      if (error) {
        toast.error(error.message)
        return
      }
      setForms((prev) => prev.map((x) => (x.id === activeFormId ? { ...x, ...payload, updated_at: new Date().toISOString() } : x)))
      toast.success('Formulario actualizado')
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

  function updateQuestion(id: string, patch: Partial<QuestionDef>) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  function removeQuestion(id: string) {
    setQuestions((q) => q.filter((x) => x.id !== id))
  }

  function toggleStudent(id: string) {
    if (invites.some((i) => i.student_id === id)) return
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

  function publicUrl(token: string) {
    return `${window.location.origin}/form/check-in/${token}`
  }

  function sharedPublicUrl(publicToken: string | undefined) {
    if (!publicToken) return ''
    return `${window.location.origin}/form/check-in/compartido/${publicToken}`
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(token))
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
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
      url: publicUrl(inv.token),
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
        ...qs.map((q) => String(obj[q.id] ?? '')),
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
          <Card padding="lg" className={cn('space-y-4', checkInPanelCardClass)}>
            <p className="text-xs text-ink-secondary max-w-prose">
              Todas las respuestas guardadas, agrupadas por alumno y ordenadas de la más reciente a la más antigua. No se borran al enviar nuevos check-ins.
            </p>
            {studentHistoryLoading ? (
              <p className="text-sm text-ink-muted py-8 text-center">Cargando historial…</p>
            ) : historyByStudent.length === 0 ? (
              <EmptyState
                title="Sin respuestas todavía"
                description="Cuando los alumnos completen un formulario, aparecerán acá agrupados por nombre."
              />
            ) : (
              <ul className="space-y-4">
                {historyByStudent.map(([studentId, group]) => {
                  const pending = group.rows.filter((r) => !r.trainer_replied_at).length
                  return (
                    <li
                      key={studentId}
                      className="rounded-xl border border-surface-border/80 bg-surface-elevated/15 overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 bg-surface-elevated/30 px-4 py-2.5">
                        <p className="font-semibold text-ink-primary">{group.studentName}</p>
                        <span className="text-[11px] text-ink-muted tabular-nums">
                          {group.rows.length} respuesta{group.rows.length !== 1 ? 's' : ''}
                          {pending > 0 ? (
                            <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                              · {pending} pendiente{pending !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <ul className="divide-y divide-surface-border/60">
                        {group.rows.map((row) => {
                          const obj =
                            row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
                              ? (row.responses as Record<string, unknown>)
                              : {}
                          const isReplied = !!row.trainer_replied_at
                          const isSaving = savingResponseIds.has(row.id)
                          return (
                            <li key={row.id} className="px-4 py-3 space-y-2">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink-primary">{row.formTitle}</p>
                                  <p className="text-[10px] text-ink-muted">
                                    {new Date(row.submitted_at).toLocaleString('es-AR')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void setResponseTrainerStatus(row, !isReplied)}
                                  disabled={isSaving}
                                  aria-pressed={isReplied}
                                  className={cn(
                                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium disabled:opacity-50',
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
                              <ul className="text-xs space-y-0.5">
                                {Object.entries(obj).map(([k, v]) => {
                                  const label = questionLabelsByFormId.get(row.formId)?.get(k) ?? k
                                  return (
                                    <li key={k}>
                                      <span className="text-ink-muted">{label}: </span>
                                      <span className="text-ink-primary">{String(v ?? '—')}</span>
                                    </li>
                                  )
                                })}
                              </ul>
                              {row.trainer_note ? (
                                <p className="text-[11px] text-ink-secondary italic border-l-2 border-brand-secondary/30 pl-2">
                                  Nota: {row.trainer_note}
                                </p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
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
                      {!f.is_active ? (
                        <span className="text-[10px] font-normal text-ink-muted">Pausado</span>
                      ) : null}
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
            <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Check semanal" />
            <Textarea
              label="Intro (opcional)"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={2}
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-label font-semibold uppercase tracking-wider text-brand-secondary/80">Preguntas</span>
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
              {questions.map((q, idx) => (
                <div key={q.id} className={checkInQuestionRowClass}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-secondary/12 text-[10px] font-semibold text-brand-secondary tabular-nums">
                    {idx + 1}
                  </span>
                  <Input
                    className="flex-1 text-sm"
                    value={q.label}
                    onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                    placeholder="Texto de la pregunta"
                  />
                  <select
                    className={checkInFieldSelectClass}
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value === 'scale' ? 'scale' : 'text' })}
                  >
                    <option value="text">Texto libre</option>
                    <option value="scale">Escala 1–5</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-status-expired/10 hover:text-status-expired"
                    onClick={() => removeQuestion(q.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
                  <p className="text-[11px] text-ink-muted">Marcá alumnos que todavía no tienen fila en la tabla de abajo y generá el link.</p>
                  <p className="text-[11px] text-ink-secondary rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2">
                    No compartas los links en grupos públicos: son como una clave. Si un formulario queda pausado, el link deja de aceptar respuestas
                    nuevas.
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-surface-border/80 bg-surface-elevated/15 p-2">
                    {students.map((s) => {
                      const has = invites.some((i) => i.student_id === s.id)
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                            has ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-secondary/8',
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={has}
                            checked={selectedStudentIds.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className={checkInCheckboxClass}
                          />
                          {s.full_name}
                          {has ? <span className="text-[10px] text-ink-muted">ya tiene link</span> : null}
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
                            return (
                              <tr key={inv.id} className="border-b border-surface-border/80">
                                <td className="py-2 pr-2 text-ink-primary">{inv.student?.full_name ?? '—'}</td>
                                <td className="py-2 pr-2">
                                  {resp ? (
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        Respondió {new Date(resp.submitted_at).toLocaleDateString('es-AR')}
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
                                  ) : (
                                    <span className="text-ink-muted">Pendiente</span>
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
                                      onClick={() => void copyLink(inv.token)}
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
                                        href={publicUrl(inv.token)}
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

                {invites.some((i) => responseByInvite.has(i.id)) ? (
                  <div className="border-t border-surface-border/80 pt-4 space-y-3">
                    <h3 className="text-label font-semibold uppercase tracking-wider text-brand-secondary/90">
                      Detalle de respuestas
                    </h3>
                    {invites.map((inv) => {
                      const resp = responseByInvite.get(inv.id)
                      if (!resp) return null
                      const obj = resp.responses && typeof resp.responses === 'object' && !Array.isArray(resp.responses) ? (resp.responses as Record<string, unknown>) : {}
                      const noteDraft = noteDraftFor(resp)
                      const noteDirty = noteDraft.trim() !== (resp.trainer_note ?? '').trim()
                      const isSaving = savingResponseIds.has(resp.id)
                      const isReplied = !!resp.trainer_replied_at
                      return (
                        <div
                          key={inv.id}
                          className={cn(
                            'rounded-xl border p-3 space-y-2 text-sm transition-colors',
                            isReplied
                              ? 'border-emerald-600/25 bg-emerald-500/[0.04]'
                              : 'border-brand-secondary/20 bg-brand-secondary/5',
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-ink-primary">{inv.student?.full_name ?? '—'}</p>
                              <p className="text-[10px] text-ink-muted">
                                Llegó {new Date(resp.submitted_at).toLocaleString('es-AR')}
                                {' · '}
                                Testimonio: {resp.testimonial_consent ? 'sí' : 'no'}
                                {' · '}
                                Correo: {resp.responder_email ?? '—'} ({resp.email_verified ? 'verificado' : 'no verif.'})
                                {isReplied ? (
                                  <>
                                    {' · '}
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      Respondido el {new Date(resp.trainer_replied_at!).toLocaleString('es-AR')}
                                    </span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void setResponseTrainerStatus(resp, !isReplied)}
                              disabled={isSaving}
                              aria-pressed={isReplied}
                              title={isReplied ? 'Marcar como pendiente' : 'Marcar como respondido'}
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                                isReplied
                                  ? 'border-emerald-600/45 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'border-amber-500/45 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300',
                              )}
                            >
                              {isReplied ? (
                                <>
                                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                  Respondido
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  Marcar respondido
                                </>
                              )}
                            </button>
                          </div>
                          <ul className="text-xs space-y-1 mt-1">
                            {questions.map((q) => (
                              <li key={q.id}>
                                <span className="text-ink-muted">{q.label}: </span>
                                <span className="text-ink-primary">{String(obj[q.id] ?? '—')}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="pt-1 space-y-1.5">
                            <label
                              htmlFor={`note-${resp.id}`}
                              className="text-[10px] font-medium uppercase tracking-wide text-ink-muted"
                            >
                              Nota privada (no la ve el alumno)
                            </label>
                            <Textarea
                              id={`note-${resp.id}`}
                              value={noteDraft}
                              onChange={(e) =>
                                setNoteDrafts((prev) => {
                                  const next = new Map(prev)
                                  next.set(resp.id, e.target.value)
                                  return next
                                })
                              }
                              rows={2}
                              placeholder="Ej. aumentar proteínas, pedir foto de comida, etc."
                              className="text-xs"
                            />
                            {noteDirty ? (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  loading={isSaving}
                                  disabled={isSaving}
                                  onClick={() => void setResponseTrainerStatus(resp, isReplied, noteDraft)}
                                  icon={<Save className="h-3 w-3" aria-hidden />}
                                  className="h-7 min-h-7 px-2 text-[10px]"
                                >
                                  Guardar nota
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
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
