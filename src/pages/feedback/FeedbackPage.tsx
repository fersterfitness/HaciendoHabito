import { useEffect, useState, useCallback } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { MessageSquare, Search, Plus } from 'lucide-react'
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
import type { RoutineQuestion, Student, Routine, QuestionStatus } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionFull = RoutineQuestion & { student?: Pick<Student, 'full_name'>; routine?: Pick<Routine, 'name'> }

type FilterTab = 'todas' | QuestionStatus

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'todas',       label: 'Todas'       },
  { value: 'recibida',    label: 'Recibidas'   },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'devuelta',    label: 'Devueltas'   },
  { value: 'cerrada',     label: 'Cerradas'    },
]

export function FeedbackPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
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
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/feedback/new')}
          >
            Nueva consulta
          </Button>
        }
      />

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
    </div>
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
