import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlanningWorkbookReadonlyView } from '@/components/nutrition/PlanningWorkbookReadonlyView'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import { parsePlanningData } from '@/lib/nutrition/planningWorkbookTypes'
import type { Json, TrainerStudentMealPlan } from '@/types/database'

export function StudentMealPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [wb, setWb] = useState<PlanningWorkbookStateV1 | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !planId) return
    let cancelled = false
    ;(async () => {
      const { data: st } = await supabase.from('students').select('id').eq('profile_id', user.id).maybeSingle()
      if (cancelled || !st?.id) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('trainer_student_meal_plans')
        .select('*')
        .eq('id', planId)
        .eq('student_id', st.id)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setWb(null)
        setLoading(false)
        return
      }
      const row = data as TrainerStudentMealPlan
      setTitle(row.title)
      const parsed = parsePlanningData(row.data as Json)
      setWb(parsed ?? createInitialPlanningWorkbook())
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, planId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!wb) {
    return (
      <div className="pb-24 lg:pb-10 px-4">
        <Header title="Plan" />
        <p className="text-sm text-ink-muted mt-6">No encontramos este plan o no tenés permiso para verlo.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/my/meal-plans')}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-10">
      <Header
        title={title || 'Plan de alimentación'}
        actions={
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/my/meal-plans')}>
            Lista
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 lg:px-6 pt-2">
        <PlanningWorkbookReadonlyView wb={wb} />
      </div>
    </div>
  )
}
