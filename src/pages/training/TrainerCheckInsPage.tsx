import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, ClipboardCheck, Copy, Plus, Trash2, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
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
}

type ScheduleRow = CheckInSendSchedule & { form: { title: string } | null }

/** Botones de acción en la tabla de invitaciones (misma altura y padding). */
const inviteTableActionBtnClass =
  'h-7 min-h-7 min-w-[3.25rem] px-2.5 text-[10px] font-medium gap-1 shrink-0'

export function TrainerCheckInsPage() {
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
      .select('id, invite_id, submitted_at, responses, testimonial_consent, responder_email, email_verified')
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
    })
    window.open(buildWhatsAppUrl(digits, msg), '_blank', 'noopener,noreferrer')
  }

  function openCheckInWhatsAppGroup() {
    if (!savedForm || invites.length === 0) {
      toast.error('Generá al menos un link antes de compartir en grupo')
      return
    }
    const entries = invites.map((inv) => ({
      studentName: inv.student?.full_name ?? 'Alumno',
      url: publicUrl(inv.token),
    }))
    const msg = checkInGroupMessage({
      formTitle: savedForm.title,
      intro: savedForm.intro,
      entries,
    })
    window.open(buildWhatsAppGroupPickUrl(msg), '_blank', 'noopener,noreferrer')
    toast.success('Elegí el grupo (o chat) en WhatsApp y enviá el mensaje')
  }

  const responseByInvite = useMemo(() => {
    const m = new Map<string, ResponseRow>()
    for (const r of responses) m.set(r.invite_id, r)
    return m
  }, [responses])

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
      <Header title="Check-ins" />
      <div className="px-4 lg:px-6 py-8 space-y-6 max-w-5xl">
        <p className="text-sm text-ink-secondary max-w-prose">
          Armá un formulario corto; generá un link personal por alumno. El alumno responde sin entrar a la app. Las respuestas aparecen abajo (y podés
          usar el consentimiento para testimonios). Tratá cada link como un acceso privado: quien lo tenga puede enviar respuestas a nombre de ese
          alumno.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openForm(null)}
          >
            Nuevo formulario
          </Button>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <Card className="p-4 sm:p-5 space-y-2 lg:col-span-2">
            <h2 className="text-sm font-semibold text-ink-primary mb-2">Mis formularios</h2>
            {loading ? (
              <p className="text-sm text-ink-muted">Cargando…</p>
            ) : forms.length === 0 ? (
              <p className="text-sm text-ink-muted">Todavía no hay formularios.</p>
            ) : (
              <ul className="space-y-1">
                {forms.map((f) => (
                  <li key={f.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`flex-1 text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                        activeFormId === f.id
                          ? 'border-brand-primary/50 bg-brand-primary/[0.06] font-medium'
                          : 'border-surface-border hover:bg-surface-elevated/40'
                      }`}
                      onClick={() => openForm(f)}
                    >
                      {f.title}
                      {!f.is_active ? <span className="text-[10px] text-ink-muted"> · pausado</span> : null}
                    </button>
                    <button
                      type="button"
                      className="p-2 text-ink-muted hover:text-status-expired"
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
          </Card>

          <Card className="p-4 sm:p-5 space-y-4 lg:col-span-3">
            <h2 className="text-sm font-semibold text-ink-primary inline-flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {activeFormId ? 'Editar formulario' : 'Nuevo formulario'}
            </h2>
            <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Check semanal" />
            <Textarea
              label="Intro (opcional)"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={2}
              placeholder="Texto que ve el alumno arriba del formulario…"
            />
            <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-surface-border" />
              Formulario activo (si no, el link muestra error)
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Preguntas</span>
                <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={addQuestion}>
                  + Pregunta
                </Button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="flex flex-col sm:flex-row gap-2 items-start rounded-lg border border-surface-border p-2">
                  <span className="text-[10px] text-ink-muted pt-2 w-5">{idx + 1}</span>
                  <Input
                    className="flex-1 text-sm"
                    value={q.label}
                    onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                    placeholder="Texto de la pregunta"
                  />
                  <select
                    className="text-xs rounded-lg border border-surface-border bg-surface-input px-2 py-2"
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value === 'scale' ? 'scale' : 'text' })}
                  >
                    <option value="text">Texto libre</option>
                    <option value="scale">Escala 1–5</option>
                  </select>
                  <button type="button" className="p-1 text-ink-muted hover:text-status-expired" onClick={() => removeQuestion(q.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button type="button" onClick={() => void saveForm()} loading={saving}>
              {activeFormId ? 'Guardar cambios' : 'Crear formulario'}
            </Button>

            {activeFormId ? (
              <>
                <div className="border-t border-surface-border pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wide">Links por alumno</h3>
                  <p className="text-[11px] text-ink-muted">Marcá alumnos que todavía no tienen fila en la tabla de abajo y generá el link.</p>
                  <p className="text-[11px] text-ink-secondary rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2">
                    No compartas los links en grupos públicos: son como una clave. Si un formulario queda pausado, el link deja de aceptar respuestas
                    nuevas.
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-surface-border p-2">
                    {students.map((s) => {
                      const has = invites.some((i) => i.student_id === s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${
                            has ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-elevated/50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={has}
                            checked={selectedStudentIds.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="rounded border-surface-border"
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
                    variant="secondary"
                    loading={inviteBusy}
                    disabled={inviteBusy || selectedStudentIds.size === 0}
                    onClick={() => void createInvites()}
                  >
                    Generar links
                  </Button>
                </div>

                <div className="border-t border-surface-border pt-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wide">Invitaciones y respuestas</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {invites.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            inviteTableActionBtnClass,
                            'border-emerald-600/45 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/12',
                          )}
                          icon={<WhatsAppIcon className="h-3 w-3" />}
                          onClick={openCheckInWhatsAppGroup}
                        >
                          Grupo WA
                        </Button>
                      ) : null}
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
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      Respondió {new Date(resp.submitted_at).toLocaleString('es-AR')}
                                    </span>
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
                  <div className="border-t border-surface-border pt-4 space-y-3">
                    <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wide">Detalle de respuestas</h3>
                    {invites.map((inv) => {
                      const resp = responseByInvite.get(inv.id)
                      if (!resp) return null
                      const obj = resp.responses && typeof resp.responses === 'object' && !Array.isArray(resp.responses) ? (resp.responses as Record<string, unknown>) : {}
                      return (
                        <div key={inv.id} className="rounded-xl border border-surface-border p-3 space-y-1 text-sm">
                          <p className="font-medium text-ink-primary">{inv.student?.full_name ?? '—'}</p>
                          <p className="text-[10px] text-ink-muted">
                            Testimonio OK: {resp.testimonial_consent ? 'sí' : 'no'}
                            {' · '}
                            Correo: {resp.responder_email ?? '—'} ({resp.email_verified ? 'verificado' : 'no verif.'})
                          </p>
                          <ul className="text-xs space-y-1 mt-2">
                            {questions.map((q) => (
                              <li key={q.id}>
                                <span className="text-ink-muted">{q.label}: </span>
                                <span className="text-ink-primary">{String(obj[q.id] ?? '—')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
        </div>

        <Card className="p-4 sm:p-5 space-y-4 max-w-5xl">
          <h2 className="text-sm font-semibold text-ink-primary inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4" aria-hidden />
            Recordatorios de envío (WhatsApp)
          </h2>
          <p className="text-xs text-ink-secondary max-w-prose">
            Definí un día fijo por formulario (en tu zona horaria). Ese día verás un recordatorio en <strong className="text-ink-primary">Inicio</strong>.
            WhatsApp no se envía solo: desde acá usá <strong className="text-ink-primary">Grupo WA</strong> para mandar todos los links juntos.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[8rem]">
              <label className="text-[10px] font-medium uppercase tracking-wide text-ink-muted" htmlFor="sched-dow">
                Día
              </label>
              <select
                id="sched-dow"
                className="w-full rounded-lg border border-surface-border bg-surface-input px-2 py-2 text-sm"
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
                className="w-full rounded-lg border border-surface-border bg-surface-input px-2 py-2 text-sm"
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
                className="rounded border-surface-border"
              />
              Preferir envío al grupo
            </label>
            <Button
              type="button"
              size="sm"
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm"
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
      </div>
    </div>
  )
}
