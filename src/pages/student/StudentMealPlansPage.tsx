import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { TrainerStudentMealPlan } from '@/types/database'
import { formatDate } from '@/lib/utils'

export function StudentMealPlansPage() {
  const user = useAuthStore((s) => s.user)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [plans, setPlans] = useState<TrainerStudentMealPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data: st } = await supabase.from('students').select('id').eq('profile_id', user.id).maybeSingle()
      if (cancelled) return
      if (!st?.id) {
        setStudentId(null)
        setPlans([])
        setLoading(false)
        return
      }
      setStudentId(st.id)
      const { data } = await supabase
        .from('trainer_student_meal_plans')
        .select('*')
        .eq('student_id', st.id)
        .order('updated_at', { ascending: false })
      if (!cancelled) setPlans((data ?? []) as TrainerStudentMealPlan[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!studentId) {
    return (
      <div className="pb-24 lg:pb-10">
        <Header title="Mi plan de alimentación" />
        <div className="px-4 lg:px-6 max-w-lg mx-auto mt-8">
          <EmptyState
            title="Aún no está vinculada tu cuenta"
            description="Pedile a tu entrenador que asocie tu usuario de la app con tu ficha de alumno para ver los planes acá."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10">
      <Header title="Mi plan de alimentación" />
      <div className="px-4 lg:px-6 max-w-3xl mx-auto space-y-6 mt-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          Tu entrenador puede asignarte uno o más planes. Elegí uno para verlo completo.
        </p>
        {plans.length === 0 ? (
          <EmptyState title="Todavía no hay planes" description="Cuando tu entrenador te asigne un plan, vas a ver la lista acá." />
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/my/meal-plans/${p.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-card p-4 hover:border-brand-primary/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-brand-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-primary truncate">{p.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Actualizado {formatDate(p.updated_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
