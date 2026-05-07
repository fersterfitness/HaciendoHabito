import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ArrowLeft, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PlanningWorkbookReadonlyView } from '@/components/nutrition/PlanningWorkbookReadonlyView'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import { parsePlanningData } from '@/lib/nutrition/planningWorkbookTypes'
import type { Json, TrainerStudentMealPlan } from '@/types/database'

export function StudentMealPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useAppNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const [wb, setWb] = useState<PlanningWorkbookStateV1 | null>(null)
  const [planRow, setPlanRow] = useState<TrainerStudentMealPlan | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    if (!user?.id || !planId) return
    let cancelled = false
    ;(async () => {
      const { data: st } = await supabase.from('students').select('id').eq('profile_id', user.id).maybeSingle()
      if (cancelled || !st?.id) {
        setPlanRow(null)
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
        setPlanRow(null)
        setLoading(false)
        return
      }
      const row = data as TrainerStudentMealPlan
      setPlanRow(row)
      setTitle(row.title)
      const parsed = parsePlanningData(row.data as Json)
      setWb(parsed ?? createInitialPlanningWorkbook())
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, planId])

  async function handlePdf() {
    if (!planRow) return
    setPdfBusy(true)
    try {
      await downloadTrainerStudentMealPlanPdf(planRow, {
        studentName: profile?.full_name ?? null,
      })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

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
    <div className="pb-24 lg:pb-10 print:pb-4">
      <Header
        className="print:hidden"
        title={title || 'Plan de alimentación'}
        actions={
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <Button
              variant="outline"
              size="sm"
              loading={pdfBusy}
              icon={<FileDown className="h-4 w-4" aria-hidden />}
              onClick={() => void handlePdf()}
            >
              PDF
            </Button>
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/my/meal-plans')}>
              Lista
            </Button>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 lg:px-6 pt-2 print:max-w-none print:px-4">
        <h1 className="hidden print:block print:text-center print:text-lg print:font-semibold print:text-ink-primary print:mb-3 print:pb-2 print:border-b print:border-surface-border">
          {title || 'Plan de alimentación'}
        </h1>
        <PlanningWorkbookReadonlyView
          wb={wb}
          audience="student"
          documentUpdatedAt={planRow?.updated_at ?? null}
        />
      </div>
    </div>
  )
}
