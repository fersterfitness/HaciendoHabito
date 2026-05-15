import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Copy, Plus, Trash2, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import type { CheckInForm, Json, Student } from '@/types/database'
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
}

export function TrainerCheckInsPage() {
  const { user } = useAuthStore()
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

  const loadForms = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [fRes, sRes] = await Promise.all([
      supabase.from('check_in_forms').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('students').select('*').eq('owner_id', user.id).eq('status', 'activo').order('full_name'),
    ])
    setLoading(false)
    if (fRes.error) toast.error(fRes.error.message)
    else setForms((fRes.data as CheckInForm[]) ?? [])
    if (sRes.error) toast.error(sRes.error.message)
    else setStudents((sRes.data as Student[]) ?? [])
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
      .select('id, invite_id, submitted_at, responses, testimonial_consent')
      .in('invite_id', inviteIds)
    if (respErr) toast.error(respErr.message)
    else setResponses((respData as ResponseRow[]) ?? [])
  }, [])

  useEffect(() => {
    if (!activeFormId) {
      setInvites([])
      setResponses([])
      return
    }
    void loadInvitesAndResponses(activeFormId)
  }, [activeFormId, loadInvitesAndResponses])

  function openForm(f: CheckInForm | null) {
    if (!f) {
      setActiveFormId(null)
      setTitle('')
      setIntro('')
      setQuestions(defaultQuestions())
      setIsActive(true)
      return
    }
    setActiveFormId(f.id)
    setTitle(f.title)
    setIntro(f.intro ?? '')
    setQuestions(parseQuestions(f.questions).length ? parseQuestions(f.questions) : defaultQuestions())
    setIsActive(f.is_active)
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
    const existing = new Set(invites.map((i) => i.student_id))
    const toCreate = ids.filter((id) => !existing.has(id))
    if (!toCreate.length) {
      toast.error('Esos alumnos ya tienen link para este formulario')
      return
    }
    setInviteBusy(true)
    const rows = toCreate.map((student_id) => ({ form_id: activeFormId, student_id }))
    const { error } = await supabase.from('check_in_invites').insert(rows)
    setInviteBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Links generados')
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
                    {invites.some((i) => responseByInvite.has(i.id)) ? (
                      <Button type="button" size="sm" variant="outline" className="text-xs h-7" icon={<Download className="h-3.5 w-3.5" />} onClick={exportResponsesCsv}>
                        Exportar CSV
                      </Button>
                    ) : null}
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
                                  <div className="flex flex-wrap gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px]"
                                      aria-label={`Copiar link de check-in para ${inv.student?.full_name ?? 'alumno'}`}
                                      onClick={() => void copyLink(inv.token)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <a
                                      href={publicUrl(inv.token)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-brand-primary hover:underline text-[10px]"
                                    >
                                      Abrir
                                    </a>
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
      </div>
    </div>
  )
}
