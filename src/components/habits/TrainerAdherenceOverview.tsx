import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isWeeklyTemplate, parseQuestions } from '@/lib/checkIn/questions'
import { buildAdherenceTimeline, latestAdherenceSummary } from '@/lib/checkIn/adherence'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'

type Row = {
  studentId: string
  name: string
  score: number | null
  delta: number | null
}

export function TrainerAdherenceOverview({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - 56)
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('owner_id', user!.id)
        .eq('status', 'activo')
        .order('full_name')
      if (cancelled) return
      const people = (students ?? []) as { id: string; full_name: string }[]
      if (!people.length) {
        setRows([])
        setLoading(false)
        return
      }
      const { data: inv } = await supabase
        .from('check_in_invites')
        .select('id, student_id, form:check_in_forms(questions)')
        .in('student_id', people.map((s) => s.id))
      if (cancelled) return
      const invites = (inv ?? []) as {
        id: string
        student_id: string
        form: { questions: Json } | { questions: Json }[] | null
      }[]
      const weeklyInviteIds: string[] = []
      const questionsByInvite = new Map<string, ReturnType<typeof parseQuestions>>()
      for (const i of invites) {
        const form = Array.isArray(i.form) ? i.form[0] : i.form
        const qs = parseQuestions(form?.questions)
        if (!isWeeklyTemplate(qs)) continue
        questionsByInvite.set(i.id, qs)
        weeklyInviteIds.push(i.id)
      }
      if (!weeklyInviteIds.length) {
        setRows(people.map((s) => ({ studentId: s.id, name: s.full_name, score: null, delta: null })))
        setLoading(false)
        return
      }
      const { data: resp } = await supabase
        .from('check_in_responses')
        .select('invite_id, submitted_at, responses')
        .in('invite_id', weeklyInviteIds)
        .gte('submitted_at', since.toISOString())
        .order('submitted_at', { ascending: true })
      if (cancelled) return
      const byStudent = new Map<string, { submittedAt: string; questions: ReturnType<typeof parseQuestions>; responses: Record<string, unknown> }[]>()
      const inviteStudent = new Map(invites.map((i) => [i.id, i.student_id]))
      for (const r of resp ?? []) {
        const row = r as { invite_id: string; submitted_at: string; responses: Json }
        const studentId = inviteStudent.get(row.invite_id)
        const qs = questionsByInvite.get(row.invite_id)
        if (!studentId || !qs) continue
        const obj =
          row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
            ? (row.responses as Record<string, unknown>)
            : {}
        const list = byStudent.get(studentId) ?? []
        list.push({ submittedAt: row.submitted_at, questions: qs, responses: obj })
        byStudent.set(studentId, list)
      }
      const next = people.map((s) => {
        const summary = latestAdherenceSummary(buildAdherenceTimeline(byStudent.get(s.id) ?? []))
        return { studentId: s.id, name: s.full_name, score: summary.score, delta: summary.delta }
      })
      next.sort((a, b) => {
        if (a.score == null && b.score == null) return a.name.localeCompare(b.name)
        if (a.score == null) return 1
        if (b.score == null) return -1
        return a.score - b.score
      })
      setRows(next)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const visible = compact ? rows.slice(0, 8) : rows
  const dropping = rows.filter((r) => r.delta != null && r.delta < 0).length

  if (loading) {
    return <p className="py-4 text-center text-[11px] text-ink-muted">Cargando adherencia…</p>
  }

  if (!rows.length) return null

  return (
    <section className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Adherencia semanal · todos</p>
          <p className="text-[11px] text-ink-muted">
            Entrenamiento + comidas (0–100%). {dropping > 0 ? `${dropping} bajaron respecto a la semana anterior.` : 'Sin caídas esta ronda.'}
          </p>
        </div>
        {compact ? (
          <Link to="/habits" className="text-[11px] font-medium text-brand-primary hover:underline">
            Ver todos
          </Link>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {visible.map((row) => (
          <li key={row.studentId}>
            <Link
              to={`/habits?student=${encodeURIComponent(row.studentId)}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-surface-border/70 bg-surface-elevated/25 px-2.5 py-1.5 text-[12px] hover:bg-surface-elevated/50"
            >
              <span className="min-w-0 truncate font-medium text-ink-primary">{row.name}</span>
              <span className="shrink-0 tabular-nums text-ink-secondary">
                {row.score == null ? (
                  <span className="text-ink-muted">sin registro</span>
                ) : (
                  <>
                    {row.score}%
                    {row.delta != null ? (
                      <span
                        className={cn(
                          'ml-1.5',
                          row.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300',
                        )}
                      >
                        {row.delta >= 0 ? '+' : ''}
                        {row.delta}
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
