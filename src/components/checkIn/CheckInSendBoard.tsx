import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, MoreHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Popover } from '@/components/ui/Popover'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { isWeeklyTemplate, parseQuestions } from '@/lib/checkIn/questions'
import { DEFAULT_SEND_DOW, owedPeriods, periodFormUrl, periodLabel, recentPeriods, responsePeriod } from '@/lib/checkIn/sendPeriods'
import { checkInSharedPublicUrl, openCheckInGroupWhatsApp } from '@/lib/dashboard/dashboardTrainerOps'
import {
  copyWhatsAppMessage,
  normalizePhoneForWhatsApp,
  shareToWhatsApp,
  weeklyFormMissingReminderMessage,
  weeklyFormOwedMessage,
  WHATSAPP_DIRECT_PASTE_HINT,
} from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

/** Semanas que se miran hacia atrás (la actual + 4). */
const WEEKS_BACK = 5

type WeeklyForm = { id: string; title: string; intro: string | null; public_token: string | null }
type StudentLite = { id: string; full_name: string; phone: string | null; email: string | null; created_at: string | null }
type Row = StudentLite & { answered: Set<string>; owed: string[]; currentDone: boolean }

/**
 * Consulta semanal › Enviar: el link general arriba y, por alumno, si respondió esta semana y qué
 * semanas quedó debiendo, con un WhatsApp por semana (cada respuesta queda en la suya).
 */
export function CheckInSendBoard({ ownerId, onCreateForm }: { ownerId: string; /** Lleva a «Formularios» cuando todavía no hay uno. */ onCreateForm?: () => void }) {
  const [form, setForm] = useState<WeeklyForm | null>(null)
  const [sendDow, setSendDow] = useState(DEFAULT_SEND_DOW)
  const [students, setStudents] = useState<StudentLite[]>([])
  const [answeredByStudent, setAnsweredByStudent] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'faltan' | 'todos'>('faltan')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [formsRes, stuRes] = await Promise.all([
      supabase.from('check_in_forms').select('id, title, intro, public_token, questions, is_active').eq('owner_id', ownerId),
      supabase.from('students').select('id, full_name, phone, email, created_at').eq('owner_id', ownerId).eq('status', 'activo').order('full_name'),
    ])
    const weekly = ((formsRes.data ?? []) as (WeeklyForm & { questions: unknown; is_active: boolean })[]).find(
      (f) => f.is_active && isWeeklyTemplate(parseQuestions(f.questions)),
    )
    setStudents((stuRes.data ?? []) as StudentLite[])
    setForm(weekly ?? null)
    if (!weekly) {
      setLoading(false)
      return
    }
    const [schRes, invRes] = await Promise.all([
      supabase.from('check_in_send_schedules').select('day_of_week').eq('form_id', weekly.id).eq('is_enabled', true).limit(1),
      supabase.from('check_in_invites').select('id, student_id').eq('form_id', weekly.id),
    ])
    const dow = (schRes.data?.[0] as { day_of_week?: number } | undefined)?.day_of_week ?? DEFAULT_SEND_DOW
    setSendDow(dow)
    const invites = (invRes.data ?? []) as { id: string; student_id: string }[]
    const studentByInvite = new Map(invites.map((i) => [i.id, i.student_id]))
    const since = new Date(Date.now() - (WEEKS_BACK + 1) * 7 * 86_400_000).toISOString()
    const map = new Map<string, Set<string>>()
    if (invites.length) {
      const ids = invites.map((i) => i.id)
      type Resp = { invite_id: string; submitted_at: string; period_start?: string | null }
      const withPeriod = await supabase.from('check_in_responses').select('invite_id, submitted_at, period_start').in('invite_id', ids).gte('submitted_at', since)
      // Sin la migración oct6 no existe `period_start`: se deduce de la fecha.
      const list = withPeriod.error
        ? (await supabase.from('check_in_responses').select('invite_id, submitted_at').in('invite_id', ids).gte('submitted_at', since)).data
        : withPeriod.data
      for (const r of (list ?? []) as Resp[]) {
        const sid = studentByInvite.get(r.invite_id)
        if (!sid) continue
        if (!map.has(sid)) map.set(sid, new Set())
        map.get(sid)!.add(responsePeriod(r, dow))
      }
    }
    setAnsweredByStudent(map)
    setLoading(false)
  }, [ownerId])

  useEffect(() => {
    void load()
  }, [load])

  const periods = useMemo(() => recentPeriods(WEEKS_BACK, sendDow), [sendDow])
  const current = periods[0]!
  const baseUrl = form?.public_token ? checkInSharedPublicUrl(form.public_token) : ''

  const rows: Row[] = useMemo(
    () =>
      students.map((s) => {
        const answered = answeredByStudent.get(s.id) ?? new Set<string>()
        const since = s.created_at ? s.created_at.slice(0, 10) : null
        return { ...s, answered, owed: owedPeriods({ answered, periods, since }), currentDone: answered.has(current) }
      }),
    [students, answeredByStudent, periods, current],
  )
  const pending = rows.filter((r) => !r.currentDone || r.owed.length > 0)
  const visible = filter === 'faltan' ? pending : rows

  function studentUrl(s: StudentLite, period?: string | null): string {
    const withEmail = s.email ? `${baseUrl}?email=${encodeURIComponent(s.email)}` : baseUrl
    return periodFormUrl(withEmail, period)
  }

  async function send(r: Row, which: 'current' | 'owed' | 'all', period?: string) {
    const digits = normalizePhoneForWhatsApp(r.phone)
    if (!digits) {
      toast.error(`Sin teléfono válido para ${r.full_name}`)
      return
    }
    const owed = which === 'owed' && period ? [period] : which === 'all' ? r.owed : []
    const message =
      owed.length === 0
        ? weeklyFormMissingReminderMessage(r.full_name, studentUrl(r))
        : weeklyFormOwedMessage(
            r.full_name,
            owed.map((p) => ({ label: periodLabel(p), url: studentUrl(r, p) })),
            which === 'all' && !r.currentDone ? { label: periodLabel(current), url: studentUrl(r) } : null,
          )
    const res = await shareToWhatsApp({ message, phoneDigits: digits })
    if (res.mode === 'clipboard') toast.success(WHATSAPP_DIRECT_PASTE_HINT, { duration: 6000 })
  }

  async function copyGeneral() {
    if (!baseUrl) return
    if (await copyWhatsAppMessage(baseUrl)) toast.success('Link general copiado')
    else toast.error('No se pudo copiar')
  }

  if (loading) {
    return (
      <Card padding="lg">
        <ListSkeleton rows={5} />
      </Card>
    )
  }

  if (!form) {
    return (
      <Card padding="lg" className="space-y-2">
        <p className="text-sm font-semibold text-ink-primary">Falta el formulario de feedback semanal</p>
        <p className="text-2xs text-ink-muted">Crealo en «Formularios» con la plantilla semanal y guardalo para tener el link general.</p>
        {onCreateForm ? (
          <Button size="sm" className="mt-1" onClick={onCreateForm}>
            Crear el formulario
          </Button>
        ) : null}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card padding="lg" className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-primary">Link general · {form.title}</p>
          <p className="text-2xs text-ink-muted">Para el grupo: cada alumno completa con su correo. Semana actual: {periodLabel(current)}.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="hh-row-btn" onClick={() => void copyGeneral()} disabled={!baseUrl}>
            <Copy className="h-3 w-3" aria-hidden />
            Copiar link
          </button>
          {baseUrl ? (
            <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="hh-row-btn">
              <ExternalLink className="h-3 w-3" aria-hidden />
              Abrir
            </a>
          ) : null}
          <button
            type="button"
            className="hh-row-btn"
            disabled={!form.public_token}
            onClick={() => {
              openCheckInGroupWhatsApp({ scheduleId: '', formId: form.id, formTitle: form.title, intro: form.intro, publicToken: form.public_token })
              toast.success('Elegí el grupo en WhatsApp')
            }}
          >
            <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Grupo WA
          </button>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Por alumno</p>
            <p className="text-2xs text-ink-muted">
              {pending.length === 0 ? 'Todos al día.' : `${pending.length} con feedback pendiente.`} Cada semana tiene su link: completar una
              atrasada no pisa la de esta semana.
            </p>
          </div>
          <SegmentedControl
            size="sm"
            ariaLabel="Filtro de alumnos"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            items={[
              { id: 'faltan', label: 'Pendientes', count: pending.length || undefined },
              { id: 'todos', label: 'Todos' },
            ]}
          />
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">Nadie debe feedback. 🎉</p>
        ) : (
          <ul className="divide-y divide-surface-border/70">
            {visible.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <Link to={`/students/${r.id}`} className="block truncate text-sm font-medium text-ink-primary hover:underline">
                    {r.full_name}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-3xs">
                    <span className={cn('inline-flex items-center gap-1', r.currentDone ? 'text-ink-secondary' : 'text-ink-muted')}>
                      {r.currentDone ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden /> : null}
                      Esta semana ({periodLabel(current)}): {r.currentDone ? 'respondió' : 'falta'}
                    </span>
                    {r.owed.length ? (
                      <span className="font-medium text-status-expired">
                        No completó: {r.owed.map(periodLabel).join(', ')}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.owed.length + (r.currentDone ? 0 : 1) > 1 ? (
                    <button type="button" className="hh-row-btn" onClick={() => void send(r, 'all')} title="Un solo mensaje con un link por semana">
                      <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Mandar todo
                    </button>
                  ) : !r.currentDone ? (
                    <button type="button" className="hh-row-btn" onClick={() => void send(r, 'current')} title="Link de esta semana">
                      <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Esta semana
                    </button>
                  ) : r.owed.length === 1 ? (
                    <button type="button" className="hh-row-btn" onClick={() => void send(r, 'owed', r.owed[0])} title="Link solo de esa semana">
                      <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      {periodLabel(r.owed[0]!)}
                    </button>
                  ) : null}
                  <Popover
                    open={menuFor === r.id}
                    onOpenChange={(next) => setMenuFor(next ? r.id : null)}
                    align="end"
                    className="w-60 p-1"
                    trigger={(t) => (
                      <button {...t} type="button" className="hh-row-btn px-1.5" aria-label={`Más opciones para ${r.full_name}`}>
                        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  >
                    {!r.currentDone ? (
                      <MenuItem onClick={() => { setMenuFor(null); void send(r, 'current') }}>
                        <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Solo esta semana ({periodLabel(current)})
                      </MenuItem>
                    ) : null}
                    {r.owed.map((p) => (
                      <MenuItem key={p} onClick={() => { setMenuFor(null); void send(r, 'owed', p) }}>
                        <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Solo la del {periodLabel(p)}
                      </MenuItem>
                    ))}
                    <MenuItem
                      onClick={() => {
                        setMenuFor(null)
                        void copyWhatsAppMessage(studentUrl(r)).then((ok) => (ok ? toast.success('Link copiado') : toast.error('No se pudo copiar')))
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                      Copiar link de esta semana
                    </MenuItem>
                  </Popover>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-ink-primary transition-colors hover:bg-surface-elevated"
    >
      {children}
    </button>
  )
}
