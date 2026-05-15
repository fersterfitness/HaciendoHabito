import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ClipboardCheck, MessageSquare, Search, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/lib/utils'
import type { Json, RoutineQuestion, Student, Routine, QuestionStatus } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionFull = RoutineQuestion & { student?: Pick<Student, 'full_name'>; routine?: Pick<Routine, 'name'> }

type FilterTab = 'todas' | QuestionStatus

type MainSection = 'consultas' | 'checkins'

type QuestionDef = { id: string; label: string; type: 'text' | 'scale' }

function parseFormQuestions(raw: Json): QuestionDef[] {
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

type CheckInResponseFull = {
  id: string
  submitted_at: string
  responses: Json
  testimonial_consent: boolean
  responder_email: string | null
  email_verified: boolean
  invite: {
    student: { full_name: string } | null
    check_in_forms: { title: string; questions: Json } | null
  } | null
}

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'todas',       label: 'Todas'       },
  { value: 'recibida',    label: 'Recibidas'   },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'devuelta',    label: 'Devueltas'   },
  { value: 'cerrada',     label: 'Cerradas'    },
]

export function FeedbackPage() {
  const navigate = useAppNavigate()
  const [, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const mainSection: MainSection = searchParams.get('tab') === 'checkins' ? 'checkins' : 'consultas'

  const setMainSection = (next: MainSection) => {
    if (next === 'checkins') setSearchParams({ tab: 'checkins' }, { replace: true })
    else setSearchParams({}, { replace: true })
  }

  const [questions, setQuestions] = useState<QuestionFull[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<FilterTab>('todas')

  const [checkInRows, setCheckInRows] = useState<CheckInResponseFull[]>([])
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkInSearch, setCheckInSearch] = useState('')

  const fetchQuestions = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('routine_questions')
        .select('*, student:students(full_name), routine:routines(name)')
        .eq('owner_id', user.id)
        .order('received_at', { ascending: false })
      if (error) toast.error(error.message)
      else setQuestions((data as unknown as QuestionFull[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const fetchCheckIns = useCallback(async () => {
    if (!user) return
    setCheckInLoading(true)
    try {
      const { data, error } = await supabase
        .from('check_in_responses')
        .select(
          `
          id,
          submitted_at,
          responses,
          testimonial_consent,
          responder_email,
          email_verified,
          invite:check_in_invites(
            student:students(full_name),
            check_in_forms(title, questions)
          )
        `,
        )
        .order('submitted_at', { ascending: false })
      if (error) {
        toast.error(error.message)
        setCheckInRows([])
      } else setCheckInRows((data as unknown as CheckInResponseFull[]) ?? [])
    } finally {
      setCheckInLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (mainSection !== 'checkins' || !user) return
    void fetchCheckIns()
  }, [mainSection, user, fetchCheckIns])

  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.student?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      q.title.toLowerCase().includes(search.toLowerCase())
    const matchesTab = tab === 'todas' || q.status === tab
    return matchesSearch && matchesTab
  })

  // Counts for tab badges
  const counts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1
    return acc
  }, {})
  const openCount = questions.filter((q) => q.status !== 'cerrada').length

  const checkInFiltered = checkInRows
    .filter((r) => {
      const q = checkInSearch.trim().toLowerCase()
      if (!q) return true
      const name = r.invite?.student?.full_name?.toLowerCase() ?? ''
      const formTitle = r.invite?.check_in_forms?.title?.toLowerCase() ?? ''
      return name.includes(q) || formTitle.includes(q)
    })
    .sort((a, b) => {
      const na = a.invite?.student?.full_name ?? ''
      const nb = b.invite?.student?.full_name ?? ''
      const c = na.localeCompare(nb, 'es')
      if (c !== 0) return c
      return b.submitted_at.localeCompare(a.submitted_at)
    })

  return (
    <div>
      <Header
        title="Devoluciones"
        actions={
          mainSection === 'consultas' ? (
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/feedback/new')}
            >
              Nueva consulta
            </Button>
          ) : null
        }
      />

      <div className="px-4 lg:px-6 pt-4">
        <div
          className="flex w-full max-w-md gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
          role="tablist"
          aria-label="Sección"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'consultas'}
            onClick={() => setMainSection('consultas')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'consultas'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Consultas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'checkins'}
            onClick={() => setMainSection('checkins')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'checkins'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Check-ins
            {checkInRows.length > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold',
                  mainSection === 'checkins' ? 'bg-white/20 text-white' : 'bg-surface-border text-ink-muted',
                )}
              >
                {checkInRows.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {mainSection === 'checkins' ? (
        <div className="px-4 lg:px-6 py-6 space-y-4">
          <PageToolbar>
            <div className="w-full min-w-0 lg:max-w-md">
              <Input
                placeholder="Buscar por alumno o formulario..."
                leftIcon={<Search className="h-4 w-4" />}
                value={checkInSearch}
                onChange={(e) => setCheckInSearch(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchCheckIns()}>
              Actualizar
            </Button>
          </PageToolbar>
          {checkInLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : checkInFiltered.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8" />}
              title={checkInSearch ? 'Sin resultados' : 'Sin respuestas de check-in'}
              description={
                checkInSearch
                  ? 'Probá con otro término de búsqueda.'
                  : 'Cuando los alumnos envíen el formulario (link de Check-ins), las respuestas aparecerán acá ordenadas por alumno y fecha.'
              }
            />
          ) : (
            <div className="space-y-3">
              {checkInFiltered.map((row) => (
                <CheckInResponseCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {mainSection === 'consultas' ? (
      <div className="px-4 lg:px-6 py-6 space-y-4">
        <PageToolbar>
          <div className="w-full min-w-0 lg:max-w-md">
            <Input
              placeholder="Buscar por alumno o consulta..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide w-full lg:w-auto lg:flex-1 min-w-0 pb-1">
            {TABS.map(({ value, label }) => {
              const count = value === 'todas' ? questions.length : counts[value] ?? 0
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                    tab === value
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'rounded-full px-1.5 py-px text-[10px] font-bold',
                      tab === value ? 'bg-white/20 text-white' : 'bg-surface-border text-ink-muted',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </PageToolbar>

        {/* Alerta si hay abiertas */}
        {openCount > 0 && tab === 'todas' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-status-pending/10 border border-status-pending/20">
            <span className="w-1.5 h-1.5 rounded-full bg-status-pending shrink-0" />
            <p className="text-xs text-status-pending font-medium">
              {openCount} consulta{openCount !== 1 ? 's' : ''} sin cerrar
            </p>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title={search || tab !== 'todas' ? 'Sin resultados' : 'Sin consultas'}
            description={
              search || tab !== 'todas'
                ? 'Probá con otro filtro o búsqueda.'
                : 'Registrá una consulta con el botón "Nueva consulta".'
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <QuestionCard key={q.id} question={q} onClick={() => navigate(`/feedback/${q.id}`)} />
            ))}
          </div>
        )}
      </div>
      ) : null}
    </div>
  )
}

function CheckInResponseCard({ row }: { row: CheckInResponseFull }) {
  const defs = parseFormQuestions(row.invite?.check_in_forms?.questions ?? [])
  const respObj =
    row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
      ? (row.responses as Record<string, unknown>)
      : {}
  const lines = defs.map((d) => {
    const v = respObj[d.id]
    const text = v === undefined || v === null ? '—' : typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)
    return { label: d.label, text, type: d.type }
  })
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-ink-primary truncate">{row.invite?.student?.full_name ?? '—'}</p>
          <p className="text-sm text-ink-secondary truncate">{row.invite?.check_in_forms?.title ?? 'Check-in'}</p>
        </div>
        <span className="text-xs text-ink-muted tabular-nums shrink-0">{formatDate(row.submitted_at)}</span>
      </div>
      <p className="text-[11px] text-ink-secondary">
        <span className="text-ink-muted">Correo declarado: </span>
        <span className="font-mono text-ink-primary">{row.responder_email ?? '—'}</span>
        {row.email_verified ? (
          <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">· Verificado (ficha)</span>
        ) : row.responder_email ? (
          <span className="ml-2 text-ink-muted">· No verificado con ficha</span>
        ) : null}
      </p>
      {row.testimonial_consent ? (
        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Aceptó uso de testimonio</p>
      ) : null}
      <dl className="space-y-2 border-t border-surface-border pt-3">
        {lines.length === 0 ? (
          <p className="text-xs text-ink-muted">Sin definición de preguntas en el formulario o respuestas vacías.</p>
        ) : (
          lines.map((line, i) => (
            <div key={i}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{line.label}</dt>
              <dd className="mt-0.5 text-sm text-ink-primary whitespace-pre-wrap break-words">{line.text}</dd>
            </div>
          ))
        )}
      </dl>
    </Card>
  )
}

function QuestionCard({ question, onClick }: { question: QuestionFull; onClick: () => void }) {
  return (
    <Card hover onClick={onClick} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-ink-primary truncate">{question.student?.full_name ?? '—'}</p>
          <p className="text-sm text-ink-secondary truncate">{question.title}</p>
        </div>
        <Badge status={question.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span>{formatDate(question.received_at)}</span>
        {question.routine && <span className="truncate">· {question.routine.name}</span>}
      </div>
      {question.media_url && (
        <span className="text-xs text-brand-primary">📎 Con adjunto</span>
      )}
    </Card>
  )
}
