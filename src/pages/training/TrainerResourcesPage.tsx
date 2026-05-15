import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Plus, Trash2, ExternalLink, Copy, History, AlignLeft } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import {
  buildResourceShareMessage,
  buildWhatsAppGroupPickUrl,
  buildWhatsAppUrl,
  normalizePhoneForWhatsApp,
} from '@/lib/whatsapp'
import { STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import type { Student, TrainerMessageTemplate, TrainerResource } from '@/types/database'
import toast from 'react-hot-toast'

/** Tabla aún no migrada o cache de PostgREST sin la relación. */
function isMissingRelationError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? '').toLowerCase()
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find the table')
  )
}

function looksLikeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

type SendLogRow = {
  id: string
  sent_at: string
  student_id: string
  resource_id: string
  student: { full_name: string } | null
  trainer_resources: { title: string; url: string } | null
}

/** Más nuevo primero: oculta filas si ya hay otra más reciente del mismo alumno/recurso dentro de 60 min. */
function dedupeSendLogRows(rows: SendLogRow[]): SendLogRow[] {
  const WINDOW_MS = 60 * 60 * 1000
  const kept: SendLogRow[] = []
  for (const row of rows) {
    const t = new Date(row.sent_at).getTime()
    const isDup = kept.some(
      (k) =>
        k.student_id === row.student_id &&
        k.resource_id === row.resource_id &&
        new Date(k.sent_at).getTime() - t < WINDOW_MS,
    )
    if (!isDup) kept.push(row)
  }
  return kept
}

export function TrainerResourcesPage() {
  const { user } = useAuthStore()
  const [resources, setResources] = useState<TrainerResource[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => new Set())
  const [extraNote, setExtraNote] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendLog, setSendLog] = useState<SendLogRow[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [templates, setTemplates] = useState<TrainerMessageTemplate[]>([])
  const [tplTitle, setTplTitle] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [tplSaving, setTplSaving] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [autoLogOnWaOpen, setAutoLogOnWaOpen] = useState(true)
  const [logSendPending, setLogSendPending] = useState(false)
  const [sendLogHiddenDuplicateCount, setSendLogHiddenDuplicateCount] = useState(0)

  const loadSendLog = useCallback(async () => {
    if (!user) return
    setLogLoading(true)
    const { data, error } = await supabase
      .from('trainer_resource_sends')
      .select('id, sent_at, student_id, resource_id, student:students(full_name), trainer_resources(title, url)')
      .eq('owner_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(120)
    setLogLoading(false)
    if (error) {
      toast.error(error.message)
      setSendLog([])
      setSendLogHiddenDuplicateCount(0)
      return
    }
    const raw = (data ?? []) as unknown as SendLogRow[]
    const deduped = dedupeSendLogRows(raw)
    setSendLog(deduped)
    setSendLogHiddenDuplicateCount(Math.max(0, raw.length - deduped.length))
  }, [user])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [rRes, sRes, tRes] = await Promise.all([
      supabase.from('trainer_resources').select('*').eq('owner_id', user.id).order('sort_order', { ascending: true }),
      supabase.from('students').select('*').eq('owner_id', user.id).eq('status', 'activo').order('full_name'),
      supabase.from('trainer_message_templates').select('*').eq('owner_id', user.id).order('sort_order', { ascending: true }),
    ])
    setLoading(false)
    if (rRes.error) toast.error(rRes.error.message)
    else setResources((rRes.data as TrainerResource[]) ?? [])
    if (sRes.error) toast.error(sRes.error.message)
    else setStudents((sRes.data as Student[]) ?? [])
    if (tRes.error && !isMissingRelationError(tRes.error)) toast.error(tRes.error.message)
    else setTemplates((tRes.data as TrainerMessageTemplate[]) ?? [])
    void loadSendLog()
  }, [user, loadSendLog])

  useEffect(() => {
    void load()
  }, [load])

  const selectedResource = useMemo(
    () => resources.find((r) => r.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  )

  const waSelectionSummary = useMemo(() => {
    let withPhone = 0
    for (const id of selectedStudentIds) {
      const st = students.find((s) => s.id === id)
      if (st && normalizePhoneForWhatsApp(st.phone)) withPhone += 1
    }
    return { marked: selectedStudentIds.size, withPhone }
  }, [selectedStudentIds, students])

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllStudents() {
    setSelectedStudentIds(new Set(students.map((s) => s.id)))
  }

  function clearStudents() {
    setSelectedStudentIds(new Set())
  }

  async function addResource() {
    if (!user) return
    const title = newTitle.trim()
    const url = newUrl.trim()
    if (!title || !url) {
      toast.error('Completá título y URL')
      return
    }
    if (!looksLikeHttpUrl(url)) {
      toast.error('La URL tiene que empezar con https:// o http:// (copiá el link completo del navegador).')
      return
    }
    setSaving(true)
    const maxSort = resources.reduce((m, r) => Math.max(m, r.sort_order), 0)
    const { data, error } = await supabase
      .from('trainer_resources')
      .insert({
        owner_id: user.id,
        title,
        url,
        description: newDesc.trim() || null,
        sort_order: maxSort + 1,
      })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setResources((prev) => [...prev, data as TrainerResource])
    setNewTitle('')
    setNewUrl('')
    setNewDesc('')
    setSelectedResourceId((data as TrainerResource).id)
    toast.success('Recurso guardado')
  }

  async function deleteResource(id: string) {
    if (!user) return
    const r = resources.find((x) => x.id === id)
    const label = r?.title ? `«${r.title}»` : 'este recurso'
    if (!window.confirm(`¿Eliminar ${label}? También se borra el historial de envíos de ese recurso.`)) return
    const { error } = await supabase.from('trainer_resources').delete().eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setResources((prev) => prev.filter((r) => r.id !== id))
    if (selectedResourceId === id) setSelectedResourceId(null)
    toast.success('Eliminado')
  }

  function messageForResource(r: TrainerResource): string {
    const noteParts = [r.description?.trim(), extraNote.trim()].filter(Boolean)
    return buildResourceShareMessage(r.title, r.url, noteParts.join('\n\n') || null)
  }

  function fullOutboundMessage(r: TrainerResource): string {
    const core = messageForResource(r)
    const tpl = templates.find((t) => t.id === selectedTemplateId)
    const prefix = tpl?.body?.trim()
    return prefix ? `${prefix}\n\n${core}` : core
  }

  async function logSends(
    resourceId: string,
    studentIds: string[],
    opts?: { silent?: boolean },
  ): Promise<{ inserted: number }> {
    if (!user || studentIds.length === 0) return { inserted: 0 }
    setLogSendPending(true)
    try {
      const { data, error } = await supabase.rpc('register_trainer_resource_sends', {
        p_resource_id: resourceId,
        p_student_ids: studentIds,
      })
      if (error) {
        if (!opts?.silent) toast.error(error.message)
        return { inserted: 0 }
      }
      const res = data as { ok?: boolean; inserted?: number; skipped?: number; error?: string }
      if (!res?.ok) {
        if (!opts?.silent) {
          if (res?.error === 'resource_not_found') toast.error('Recurso no encontrado.')
          else if (res?.error === 'invalid_student') toast.error('Alumno no válido para este envío.')
          else toast.error('No se pudo registrar el historial.')
        }
        return { inserted: 0 }
      }
      const inserted = res.inserted ?? 0
      if (inserted === 0) {
        if (!opts?.silent) {
          toast('Sin nuevos registros: ya figuraba en la última hora para esos alumnos y este recurso.', { icon: 'ℹ️' })
        }
      } else if (!opts?.silent) {
        toast.success('Envíos registrados en historial')
      }
      void loadSendLog()
      return { inserted }
    } finally {
      setLogSendPending(false)
    }
  }

  async function addTemplate() {
    if (!user) return
    const title = tplTitle.trim()
    const body = tplBody.trim()
    if (!title || !body) {
      toast.error('Completá título y cuerpo de la plantilla')
      return
    }
    setTplSaving(true)
    const maxSort = templates.reduce((m, t) => Math.max(m, t.sort_order), 0)
    const { data, error } = await supabase
      .from('trainer_message_templates')
      .insert({ owner_id: user.id, title, body, sort_order: maxSort + 1 })
      .select('*')
      .single()
    setTplSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setTemplates((prev) => [...prev, data as TrainerMessageTemplate])
    setTplTitle('')
    setTplBody('')
    toast.success('Plantilla guardada')
  }

  async function deleteTemplate(id: string) {
    if (!user) return
    const t = templates.find((x) => x.id === id)
    const label = t?.title ? `«${t.title}»` : 'esta plantilla'
    if (!window.confirm(`¿Eliminar la plantilla ${label}?`)) return
    const { error } = await supabase.from('trainer_message_templates').delete().eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (selectedTemplateId === id) setSelectedTemplateId('')
    toast.success('Plantilla eliminada')
  }

  function openWaForStudent(student: Student, r: TrainerResource) {
    const digits = normalizePhoneForWhatsApp(student.phone)
    if (!digits) {
      toast.error(`Sin teléfono válido para ${student.full_name} (${STUDENT_PHONE_FORMAT_HINT} en la ficha)`)
      return
    }
    const msg = fullOutboundMessage(r)
    const url = buildWhatsAppUrl(digits, msg)
    window.open(url, '_blank', 'noopener,noreferrer')
    if (autoLogOnWaOpen) void logSends(r.id, [student.id], { silent: true })
  }

  async function copyMessageTemplate() {
    if (!selectedResource) {
      toast.error('Seleccioná un recurso')
      return
    }
    const msg = fullOutboundMessage(selectedResource)
    try {
      await navigator.clipboard.writeText(msg)
      toast.success('Mensaje copiado (pegalo en WhatsApp u otro canal)')
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  function openGroupWhatsApp() {
    if (!selectedResource) {
      toast.error('Seleccioná un recurso de la lista')
      return
    }
    const msg = fullOutboundMessage(selectedResource)
    window.open(buildWhatsAppGroupPickUrl(msg), '_blank', 'noopener,noreferrer')
    toast.success('Elegí el grupo (o chat) en WhatsApp y enviá el mensaje')
  }

  function openAllWhatsApp() {
    if (!selectedResource) {
      toast.error('Seleccioná un recurso de la lista')
      return
    }
    const ids = [...selectedStudentIds]
    if (!ids.length) {
      toast.error('Seleccioná al menos un alumno')
      return
    }
    const msg = fullOutboundMessage(selectedResource)
    const toLog: string[] = []
    let delay = 0
    let opened = 0
    for (const sid of ids) {
      const st = students.find((s) => s.id === sid)
      if (!st) continue
      const digits = normalizePhoneForWhatsApp(st.phone)
      if (!digits) continue
      const url = buildWhatsAppUrl(digits, msg)
      window.setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer')
      }, delay)
      delay += 900
      opened += 1
      toLog.push(sid)
    }
    if (autoLogOnWaOpen && toLog.length) {
      void logSends(selectedResource.id, toLog, { silent: true }).then(({ inserted }) => {
        if (inserted === 0) {
          toast('Historial: no hubo registros nuevos (mismo recurso y alumno ya estaban en la última hora).', { icon: 'ℹ️' })
        }
      })
    }
    toast.success(
      opened
        ? `Se abrirán ${opened} pestañas de WhatsApp (con pausa entre cada una).${
            autoLogOnWaOpen ? ' El historial suma filas solo si son envíos nuevos (ventana 60 min).' : ''
          }`
        : 'Ningún alumno marcado tiene teléfono válido para WhatsApp.',
    )
  }

  return (
    <div>
      <Header title="Recursos y WhatsApp" />
      <div className="px-4 lg:px-6 py-8 space-y-6 max-w-5xl">
        <p className="text-sm text-ink-secondary max-w-prose">
          Guardá links (videos, PDFs, artículos). Elegí alumnos y abrí WhatsApp con el mismo mensaje para cada uno. Podés usar plantillas de texto fijo
          arriba del mensaje y dejar que el historial se registre solo al abrir WhatsApp. El historial solo lo ves vos con la sesión iniciada; igual revisá
          que la nota extra no lleve datos sensibles si el alumno reenvía el chat.
        </p>

        <Card className="p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink-primary inline-flex items-center gap-2">
            <AlignLeft className="h-4 w-4" />
            Plantillas de texto (sin link)
          </h2>
          <p className="text-[11px] text-ink-muted">
            Texto que se antepone al mensaje del recurso (saludo, contexto, recordatorios). Opcional al enviar.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Título de la plantilla" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Ej. Aviso semanal" />
            <div className="sm:col-span-2">
              <Textarea
                label="Cuerpo"
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                rows={3}
                placeholder="Hola… acordate de…"
                className="text-sm"
              />
            </div>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => void addTemplate()} loading={tplSaving} icon={<Plus className="h-4 w-4" />}>
            Guardar plantilla
          </Button>
          {templates.length > 0 ? (
            <ul className="space-y-1 pt-2 border-t border-surface-border">
              {templates.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-primary">{t.title}</p>
                    <p className="text-ink-muted line-clamp-2 whitespace-pre-wrap">{t.body}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 p-1 text-ink-muted hover:text-status-expired"
                    title="Eliminar plantilla"
                    aria-label={`Eliminar plantilla ${t.title}`}
                    onClick={() => void deleteTemplate(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted pt-1">Todavía no hay plantillas.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink-primary">Nuevo recurso</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Título" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej. Aproximaciones" />
            <Input
              label="URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono text-xs"
              hint="Tiene que ser una URL completa (https://…). Pegá el link desde la barra del navegador."
            />
          </div>
          <Textarea
            label="Descripción (opcional, va en el mensaje)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button type="button" onClick={() => void addResource()} loading={saving} icon={<Plus className="h-4 w-4" />}>
            Guardar recurso
          </Button>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-4 sm:p-5 space-y-2">
            <h2 className="text-sm font-semibold text-ink-primary mb-2">Biblioteca</h2>
            {loading ? (
              <p className="text-sm text-ink-muted">Cargando…</p>
            ) : resources.length === 0 ? (
              <p className="text-sm text-ink-muted">Todavía no hay recursos.</p>
            ) : (
              <ul className="space-y-1">
                {resources.map((r) => (
                  <li key={r.id}>
                    <div
                      className={cn(
                        'flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                        selectedResourceId === r.id
                          ? 'border-brand-primary/50 bg-brand-primary/[0.06]'
                          : 'border-surface-border hover:bg-surface-elevated/40',
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedResourceId(r.id)}
                      >
                        <p className="text-sm font-medium text-ink-primary truncate">{r.title}</p>
                        <p className="text-[11px] text-ink-muted truncate font-mono">{r.url}</p>
                      </button>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1 text-ink-muted hover:text-brand-primary"
                        title="Abrir link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        className="shrink-0 p-1 text-ink-muted hover:text-status-expired"
                        title="Eliminar recurso"
                        aria-label={`Eliminar recurso ${r.title}`}
                        onClick={() => void deleteResource(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-ink-primary">Enviar por WhatsApp</h2>
            {!selectedResource ? (
              <p className="text-sm text-ink-muted">Elegí un recurso de la biblioteca.</p>
            ) : (
              <>
                <div className="rounded-lg border border-surface-border bg-surface-elevated/30 px-3 py-2 text-xs space-y-1">
                  <p className="font-semibold text-ink-primary">{selectedResource.title}</p>
                  <p className="text-ink-muted font-mono break-all">{selectedResource.url}</p>
                </div>
                {templates.length > 0 ? (
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink-muted">Incluir plantilla arriba del mensaje</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-xl border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
                    >
                      <option value="">Sin plantilla</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoLogOnWaOpen}
                    onChange={(e) => setAutoLogOnWaOpen(e.target.checked)}
                    className="rounded border-surface-border"
                  />
                  Registrar envío en el historial al abrir WhatsApp (recomendado)
                </label>
                <Textarea
                  label="Nota extra (opcional, solo para este envío)"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={selectAllStudents}>
                    Marcar todos
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={clearStudents}>
                    Limpiar
                  </Button>
                </div>
                {students.length === 0 ? (
                  <p className="text-xs text-ink-muted rounded-lg border border-dashed border-surface-border px-3 py-2">
                    No tenés alumnos activos.{' '}
                    <Link to="/students" className="text-brand-primary hover:underline font-medium">
                      Cargalos en Alumnos
                    </Link>{' '}
                    con teléfono para poder abrir WhatsApp desde acá.
                  </p>
                ) : null}
                <p className="text-[11px] text-ink-muted">
                  Marcados: {waSelectionSummary.marked} · Con número válido para WhatsApp: {waSelectionSummary.withPhone}
                </p>
                <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-surface-border p-2">
                  {students.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-elevated/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="rounded border-surface-border"
                      />
                      <span className="text-ink-primary">{s.full_name}</span>
                      {!s.phone?.trim() ? (
                        <span className="text-[10px] text-status-expired">sin teléfono</span>
                      ) : null}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={() => void copyMessageTemplate()}
                  >
                    Copiar mensaje
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-emerald-600/45 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/12"
                    icon={<WhatsAppIcon className="h-4 w-4" />}
                    onClick={() => openGroupWhatsApp()}
                  >
                    Compartir en grupo
                  </Button>
                  <Button
                    type="button"
                    variant="gradientPrimary"
                    size="sm"
                    icon={<MessageCircle className="h-4 w-4" />}
                    onClick={() => openAllWhatsApp()}
                  >
                    Abrir WhatsApp (todos los marcados)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={logSendPending}
                    onClick={() => void logSends(selectedResource.id, [...selectedStudentIds])}
                    disabled={selectedStudentIds.size === 0 || logSendPending}
                  >
                    Registrar envío en historial
                  </Button>
                </div>
                <p className="text-[11px] text-ink-muted">
                  El navegador puede bloquear muchas pestañas: si falla, usá los enlaces individuales abajo.
                </p>
                <div className="space-y-1 border-t border-surface-border pt-3">
                  <p className="text-xs font-medium text-ink-secondary">Un alumno a la vez</p>
                  {[...selectedStudentIds].map((sid) => {
                    const st = students.find((s) => s.id === sid)
                    if (!st) return null
                    return (
                      <div key={sid} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-ink-primary">{st.full_name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-[11px] h-7"
                          onClick={() => openWaForStudent(st, selectedResource)}
                        >
                          WhatsApp
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </div>

        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink-primary inline-flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de envíos registrados
          </h2>
          <p className="text-[11px] text-ink-muted">
            Incluye envíos al abrir WhatsApp (si está activada esa opción) y los manuales. Mismo alumno y recurso dentro de 60 minutos no duplica
            filas ni nuevos registros.
          </p>
          {sendLogHiddenDuplicateCount > 0 ? (
            <p className="text-[10px] text-ink-muted rounded-lg bg-surface-elevated/40 border border-surface-border px-2 py-1.5">
              Se ocultaron {sendLogHiddenDuplicateCount} fila{sendLogHiddenDuplicateCount === 1 ? '' : 's'} duplicada
              {sendLogHiddenDuplicateCount === 1 ? '' : 's'} en la vista (mismo alumno, mismo recurso, menos de 60 minutos entre registros).
            </p>
          ) : null}
          {logLoading ? (
            <p className="text-sm text-ink-muted">Cargando historial…</p>
          ) : sendLog.length === 0 ? (
            <p className="text-sm text-ink-muted">Todavía no hay registros.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-surface-border bg-surface-elevated/40">
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Alumno</th>
                    <th className="py-2 px-3">Recurso</th>
                  </tr>
                </thead>
                <tbody>
                  {sendLog.map((row) => (
                    <tr key={row.id} className="border-b border-surface-border/70 last:border-0">
                      <td className="py-2 px-3 text-ink-secondary whitespace-nowrap">
                        {new Date(row.sent_at).toLocaleString('es-AR')}
                      </td>
                      <td className="py-2 px-3 text-ink-primary">{row.student?.full_name ?? '—'}</td>
                      <td className="py-2 px-3">
                        <span className="font-medium text-ink-primary">{row.trainer_resources?.title ?? '—'}</span>
                        {row.trainer_resources?.url ? (
                          <a
                            href={row.trainer_resources.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[10px] text-brand-primary truncate max-w-[220px] hover:underline font-mono"
                          >
                            {row.trainer_resources.url}
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
