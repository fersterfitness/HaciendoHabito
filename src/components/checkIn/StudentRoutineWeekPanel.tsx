import { useEffect, useMemo, useState } from 'react'
import { Check, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  monthlyFeedbackInviteMessage,
  normalizePhoneForWhatsApp,
  routineMonthFinishedWhatsAppMessage,
  shareToWhatsApp,
  WHATSAPP_DIRECT_PASTE_HINT,
} from '@/lib/whatsapp'
import {
  isMonthlyTemplate,
  parseQuestions,
  weekStatusFromAnswers,
  weekStatusHasSignal,
} from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Row = {
  studentId: string
  name: string
  phone: string | null
  totalWeeks: number
  currentWeek: number | null
  finished: boolean
  lastWeek: boolean
  submittedAt: string | null
}

type FilterId = 'all' | 'open' | 'done'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (a + b).toUpperCase() || '?'
}

export function StudentRoutineWeekPanel() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyUrl, setMonthlyUrl] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [stRes, rtRes, formRes] = await Promise.all([
        supabase.from('students').select('id, full_name, phone').eq('owner_id', user!.id).eq('status', 'activo').order('full_name'),
        supabase
          .from('routines')
          .select('id, student_id, status, updated_at, routine_blocks(id, sort_order)')
          .eq('owner_id', user!.id)
          .in('status', ['activa', 'por_vencer']),
        supabase.from('check_in_forms').select('id, public_token, questions').eq('owner_id', user!.id),
      ])
      if (cancelled) return

      const students = (stRes.data ?? []) as { id: string; full_name: string; phone: string | null }[]
      type Rt = { id: string; student_id: string; status: string; updated_at: string; routine_blocks: { id: string; sort_order: number }[] | null }
      const routines = (rtRes.data ?? []) as Rt[]
      const forms = (formRes.data ?? []) as { id: string; public_token?: string; questions: Json }[]

      const monthly = forms.find((f) => isMonthlyTemplate(parseQuestions(f.questions)))
      setMonthlyUrl(
        monthly?.public_token
          ? `${window.location.origin}/form/check-in/compartido/${monthly.public_token}`
          : null,
      )

      const latestRoutine = new Map<string, Rt>()
      for (const r of routines) {
        const prev = latestRoutine.get(r.student_id)
        if (!prev || r.updated_at > prev.updated_at) latestRoutine.set(r.student_id, r)
      }

      const formIds = forms.map((f) => f.id)
      const questionsByForm = new Map(forms.map((f) => [f.id, parseQuestions(f.questions)]))

      let invites: { id: string; form_id: string; student_id: string }[] = []
      if (formIds.length) {
        const { data } = await supabase
          .from('check_in_invites')
          .select('id, form_id, student_id')
          .in('form_id', formIds)
        invites = (data ?? []) as { id: string; form_id: string; student_id: string }[]
      }
      const inviteIds = invites.map((i) => i.id)
      const inviteById = new Map(invites.map((i) => [i.id, i]))

      type Resp = { invite_id: string; submitted_at: string; responses: Json }
      let responses: Resp[] = []
      if (inviteIds.length) {
        const { data } = await supabase
          .from('check_in_responses')
          .select('invite_id, submitted_at, responses')
          .in('invite_id', inviteIds)
          .order('submitted_at', { ascending: false })
        responses = (data ?? []) as Resp[]
      }

      const latestByStudent = new Map<
        string,
        { submittedAt: string; finished: boolean; weekNumber: number | null; lastWeek: boolean }
      >()
      for (const resp of responses) {
        const inv = inviteById.get(resp.invite_id)
        if (!inv || latestByStudent.has(inv.student_id)) continue
        const qs = questionsByForm.get(inv.form_id) ?? []
        const obj =
          resp.responses && typeof resp.responses === 'object' && !Array.isArray(resp.responses)
            ? (resp.responses as Record<string, unknown>)
            : {}
        const st = weekStatusFromAnswers(qs, obj)
        if (!weekStatusHasSignal(st)) continue
        latestByStudent.set(inv.student_id, {
          submittedAt: resp.submitted_at,
          finished: st.finished,
          weekNumber: st.weekNumber,
          lastWeek: st.lastWeek,
        })
      }

      const next: Row[] = students.map((s) => {
        const rt = latestRoutine.get(s.id)
        const blocks = [...(rt?.routine_blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order)
        const check = latestByStudent.get(s.id)
        return {
          studentId: s.id,
          name: s.full_name,
          phone: s.phone,
          totalWeeks: blocks.length,
          currentWeek: check?.weekNumber ?? null,
          finished: check?.finished ?? false,
          lastWeek: check?.lastWeek ?? false,
          submittedAt: check?.submittedAt ?? null,
        }
      })
      setRows(next)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const finishedCount = useMemo(() => rows.filter((r) => r.finished).length, [rows])
  const lastWeekCount = useMemo(() => rows.filter((r) => r.lastWeek).length, [rows])
  const inWeekCount = useMemo(() => rows.filter((r) => !r.finished && r.currentWeek != null).length, [rows])
  const visible = useMemo(() => {
    if (filter === 'done') return rows.filter((r) => r.finished)
    if (filter === 'open') return rows.filter((r) => !r.finished)
    return rows
  }, [rows, filter])

  async function sendFinishedWa(row: Row) {
    const digits = normalizePhoneForWhatsApp(row.phone)
    if (!digits) {
      toast.error(`Sin teléfono válido para ${row.name}`)
      return
    }
    const res = await shareToWhatsApp({
      phoneDigits: digits,
      message: routineMonthFinishedWhatsAppMessage(row.name),
    })
    if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
  }

  async function sendMonthlyWa(row: Row) {
    if (!monthlyUrl) {
      toast.error('Creá un formulario con la plantilla de feedback mensual en Consulta semanal.')
      return
    }
    const digits = normalizePhoneForWhatsApp(row.phone)
    if (!digits) {
      toast.error(`Sin teléfono válido para ${row.name}`)
      return
    }
    const res = await shareToWhatsApp({
      phoneDigits: digits,
      message: monthlyFeedbackInviteMessage({ studentName: row.name, url: monthlyUrl }),
    })
    if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
  }

  if (!user) return null

  const filters: { id: FilterId; label: string; count?: number }[] = [
    { id: 'all', label: 'Todos', count: rows.length },
    { id: 'open', label: 'En curso', count: rows.length - finishedCount },
    { id: 'done', label: 'Cerraron mes', count: finishedCount },
  ]

  return (
    <div className="overflow-hidden rounded-3xl border border-brand-secondary/20 bg-gradient-to-br from-brand-secondary/[0.10] via-surface-card to-surface-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-secondary">Seguimiento</p>
          <h3 className="text-base font-semibold tracking-tight text-ink-primary">Semana de rutina</h3>
          <p className="mt-0.5 max-w-prose text-[11px] leading-relaxed text-ink-muted">
            Según el último check-in. {inWeekCount} en curso
            {lastWeekCount > 0 ? ` · ${lastWeekCount} en última semana` : ''}
            {finishedCount > 0 ? ` · ${finishedCount} cerró el mes` : ''}.
          </p>
        </div>
        <div className="flex rounded-full border border-surface-border/80 bg-surface-card/80 p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                filter === f.id
                  ? 'bg-ink-primary text-surface-card'
                  : 'text-ink-muted hover:text-ink-primary',
              )}
            >
              {f.label}
              {typeof f.count === 'number' ? (
                <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="space-y-2 px-4 pb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-surface-elevated/70" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="px-4 pb-5 text-center text-xs text-ink-muted">Nada para mostrar en este filtro.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto px-3 pb-4">
          {visible.map((row) => {
            const effectiveWeek = row.finished
              ? row.totalWeeks
              : row.currentWeek ?? (row.lastWeek ? row.totalWeeks : null)
            const pct = row.totalWeeks ? Math.round(((effectiveWeek ?? 0) / row.totalWeeks) * 100) : 0
            return (
              <li
                key={row.studentId}
                className={cn(
                  'rounded-2xl border px-3 py-3 shadow-sm',
                  row.lastWeek
                    ? 'border-rose-500/45 bg-rose-500/[0.07]'
                    : 'border-surface-border/60 bg-surface-card/80',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[11px] font-bold',
                      row.lastWeek
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        : 'bg-brand-secondary/15 text-brand-secondary',
                    )}
                  >
                    {initials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-primary">{row.name}</p>
                      <p
                        className={cn(
                          'text-[10px] font-medium tabular-nums',
                          row.lastWeek ? 'font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400' : 'text-ink-muted',
                        )}
                      >
                        {row.finished
                          ? 'Mes cerrado'
                          : row.lastWeek
                            ? 'Última semana'
                            : row.currentWeek
                              ? `Semana ${row.currentWeek}${row.totalWeeks ? ` / ${row.totalWeeks}` : ''}`
                              : row.totalWeeks
                                ? `${row.totalWeeks} sem. · sin check-in`
                                : 'Sin rutina'}
                      </p>
                    </div>
                    {row.lastWeek ? (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-400">
                        Renovar rutina
                      </p>
                    ) : null}
                    {row.totalWeeks > 0 ? (
                      <>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              row.finished ? 'bg-emerald-500' : row.lastWeek ? 'bg-rose-500' : 'bg-brand-primary',
                            )}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1" aria-label="Progreso de semanas">
                          {Array.from({ length: row.totalWeeks }, (_, i) => {
                            const n = i + 1
                            const done = row.finished || (effectiveWeek != null && n <= effectiveWeek)
                            const current = !row.finished && effectiveWeek === n
                            return (
                              <span
                                key={n}
                                title={`Semana ${n}`}
                                className={cn(
                                  'inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-[9px] font-bold tabular-nums',
                                  done
                                    ? row.lastWeek
                                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-surface-elevated text-ink-muted',
                                  current && (row.lastWeek ? 'ring-2 ring-rose-500/60' : 'ring-2 ring-brand-primary/50'),
                                )}
                              >
                                {done ? <Check className="h-3 w-3" strokeWidth={2.6} /> : n}
                              </span>
                            )
                          })}
                        </div>
                      </>
                    ) : null}
                    {row.finished ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full border-emerald-600/40 text-[10px] text-emerald-800 dark:text-emerald-300"
                          icon={<WhatsAppIcon className="h-3 w-3" />}
                          onClick={() => void sendFinishedWa(row)}
                        >
                          Pedir progreso
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full text-[10px]"
                          icon={<MessageCircle className="h-3 w-3" />}
                          onClick={() => void sendMonthlyWa(row)}
                        >
                          Feedback mensual
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
