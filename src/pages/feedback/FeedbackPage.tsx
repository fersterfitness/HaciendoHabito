import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { RoutineQuestion, Student, Routine } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionFull = RoutineQuestion & { student?: Pick<Student, 'full_name'>; routine?: Pick<Routine, 'name'> }

export function FeedbackPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [questions, setQuestions] = useState<QuestionFull[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchQuestions = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('routine_questions')
      .select('*, student:students(full_name), routine:routines(name)')
      .eq('owner_id', user.id)
      .order('received_at', { ascending: false })
    if (error) toast.error(error.message)
    else setQuestions((data as unknown as QuestionFull[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const filtered = questions.filter((q) =>
    q.student?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    q.title.toLowerCase().includes(search.toLowerCase())
  )

  const open = filtered.filter((q) => q.status !== 'cerrada')
  const closed = filtered.filter((q) => q.status === 'cerrada')

  return (
    <div>
      <Header title="Devoluciones" />

      <div className="px-4 lg:px-6 py-6 max-w-3xl space-y-5">
        <Input
          placeholder="Buscar por alumno o consulta..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="Sin consultas pendientes"
            description="Cuando los alumnos envíen consultas, aparecerán aquí."
          />
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Abiertas ({open.length})
                </h2>
                <div className="space-y-3">
                  {open.map((q) => <QuestionCard key={q.id} question={q} onClick={() => navigate(`/feedback/${q.id}`)} />)}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Cerradas ({closed.length})
                </h2>
                <div className="space-y-3">
                  {closed.map((q) => <QuestionCard key={q.id} question={q} onClick={() => navigate(`/feedback/${q.id}`)} />)}
                </div>
              </section>
            )}
          </>
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
        {question.routine && <span className="truncate">{question.routine.name}</span>}
      </div>
      {question.media_url && (
        <span className="text-xs text-brand-primary">📎 Con adjunto</span>
      )}
    </Card>
  )
}
