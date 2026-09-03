import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { CheckInAnswerList } from '@/components/checkIn/CheckInAnswerList'
import { monthlyTestimonialQuote } from '@/lib/checkIn/monthlyFeedback'
import { downloadMonthlyFeedbackShareImage } from '@/lib/checkIn/monthlyFeedbackShareImage'
import type { CheckInQuestion } from '@/lib/checkIn/questions'

export function MonthlyFeedbackAnswers({
  studentName,
  questions,
  responses,
  routineName,
}: {
  studentName: string
  questions: CheckInQuestion[]
  responses: Record<string, unknown>
  routineName?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const quote = monthlyTestimonialQuote(questions, responses)

  async function downloadImage() {
    if (!quote) return
    setBusy(true)
    try {
      await downloadMonthlyFeedbackShareImage({ studentName, quote })
      toast.success('Imagen descargada')
    } catch {
      toast.error('No se pudo generar la imagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2.5">
      {routineName ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-secondary">
          Rutina · {routineName}
        </p>
      ) : null}
      <CheckInAnswerList questions={questions} responses={responses} />
      {quote ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={busy}
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => void downloadImage()}
        >
          Descargar para Instagram
        </Button>
      ) : null}
    </div>
  )
}
