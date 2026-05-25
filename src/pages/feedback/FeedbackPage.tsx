import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ClipboardCheck, MessageSquare, Search, Plus, Share2 } from 'lucide-react'
import { TrainerCheckInsPage } from '@/pages/training/TrainerCheckInsPage'
import { TrainerResourcesPage } from '@/pages/training/TrainerResourcesPage'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { NewFeedbackModal } from '@/components/feedback/NewFeedbackModal'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/lib/utils'
import { inboxHighlightCardClassName } from '@/lib/inboxRowClasses'
import type { RoutineQuestion, Student, Routine, QuestionStatus } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionFull = RoutineQuestion & { student?: Pick<Student, 'full_name'>; routine?: Pick<Routine, 'name'> }

type FilterTab = 'todas' | QuestionStatus

type MainSection = 'consultas' | 'checkins' | 'recursos'

function mainSectionFromParams(tab: string | null): MainSection {
  if (tab === 'checkins') return 'checkins'
  if (tab === 'recursos') return 'recursos'
  return 'consultas'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const mainSection = mainSectionFromParams(searchParams.get('tab'))
  const showNewFeedbackModal = searchParams.get('create') === '1'

  const setMainSection = (next: MainSection) => {
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev)
        if (next === 'consultas') nextParams.delete('tab')
        else nextParams.set('tab', next)
        nextParams.delete('create')
        return nextParams
      },
      { replace: true },
    )
  }

  const openNewFeedbackModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('create', '1')
        next.delete('tab')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const closeNewFeedbackModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('create')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const [questions, setQuestions] = useState<QuestionFull[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<FilterTab>('todas')

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

  return (
    <div>
      <Header
        title="Devoluciones"
        actions={
          mainSection === 'consultas' ? (
            <Button
              variant="gradientSecondary"
              size="sm"
              icon={<Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
              onClick={openNewFeedbackModal}
            >
              Nueva consulta
            </Button>
          ) : null
        }
      />

      <div className="px-4 lg:px-6 pt-4">
        <div
          className="flex w-full max-w-2xl gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
          role="tablist"
          aria-label="Sección"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'consultas'}
            onClick={() => setMainSection('consultas')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'consultas'
                ? 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary shadow-sm'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Consultas
            {openCount > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                  mainSection === 'consultas'
                    ? 'bg-brand-secondary/15 text-brand-secondary'
                    : 'bg-surface-border text-ink-muted',
                )}
              >
                {openCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'checkins'}
            onClick={() => setMainSection('checkins')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'checkins'
                ? 'border-surface-border bg-surface-card text-ink-primary shadow-sm ring-1 ring-inset ring-brand-tertiary/20'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Check-ins
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'recursos'}
            onClick={() => setMainSection('recursos')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'recursos'
                ? 'border-surface-border bg-surface-card text-ink-primary shadow-sm ring-1 ring-inset ring-brand-tertiary/20'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <Share2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Recursos
          </button>
        </div>
      </div>

      {mainSection === 'checkins' ? <TrainerCheckInsPage embedded /> : null}

      {mainSection === 'recursos' ? <TrainerResourcesPage embedded /> : null}

      {mainSection === 'consultas' ? (
      <div className="page-shell-x page-shell-y space-y-4">
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
            {TABS.map(({ value, label }, tabIndex) => {
              const count = value === 'todas' ? questions.length : counts[value] ?? 0
              const isActive = tab === value
              const useSecondaryAccent = tabIndex % 2 === 0
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? useSecondaryAccent
                        ? 'border-brand-secondary/30 bg-brand-secondary/10 text-ink-primary'
                        : 'border-surface-border bg-surface-card text-ink-primary shadow-sm ring-1 ring-inset ring-brand-tertiary/18'
                      : 'border-transparent bg-surface-elevated text-ink-secondary hover:border-surface-border hover:text-ink-primary',
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                        isActive
                          ? useSecondaryAccent
                            ? 'bg-brand-secondary/15 text-brand-secondary'
                            : 'bg-brand-tertiary/10 text-brand-tertiary'
                          : 'bg-surface-border text-ink-muted',
                      )}
                    >
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
                : 'Registrá la primera consulta desde el panel lateral.'
            }
            action={
              !search && tab === 'todas'
                ? {
                    label: 'Nueva consulta',
                    onClick: openNewFeedbackModal,
                    icon: <Plus className="h-4 w-4" />,
                  }
                : undefined
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

      <NewFeedbackModal
        open={showNewFeedbackModal}
        onClose={closeNewFeedbackModal}
        onCreated={(id) => {
          void fetchQuestions()
          navigate(`/feedback/${id}`)
        }}
      />
    </div>
  )
}

function QuestionCard({ question, onClick }: { question: QuestionFull; onClick: () => void }) {
  const needsAttention = question.status === 'recibida' || question.status === 'en_revision'
  return (
    <Card
      hover
      onClick={onClick}
      className={cn('flex flex-col gap-2', inboxHighlightCardClassName(needsAttention))}
    >
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
        <span className="text-xs text-brand-secondary">📎 Con adjunto</span>
      )}
    </Card>
  )
}
