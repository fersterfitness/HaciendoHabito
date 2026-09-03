import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { MonthlyFeedbackAnswers } from '@/components/checkIn/MonthlyFeedbackAnswers'
import {
  loadMonthlyFeedbackPublicToken,
  loadMonthlyFeedbackRows,
  matchRoutineForSubmittedAt,
  type MonthlyFeedbackRow,
} from '@/lib/checkIn/monthlyFeedback'
import {
  monthlyFeedbackInviteMessage,
  normalizePhoneForWhatsApp,
  shareToWhatsApp,
  WHATSAPP_DIRECT_PASTE_HINT,
} from '@/lib/whatsapp'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import type { Routine } from '@/types/database'

export function RoutineMonthlyFeedbackSection({
  ownerId,
  studentId,
  studentName,
  studentPhone,
  routine,
  lastWeek,
}: {
  ownerId: string
  studentId: string
  studentName: string
  studentPhone: string | null | undefined
  routine: Pick<Routine, 'id' | 'name' | 'start_date' | 'end_date'>
  lastWeek: boolean
}) {
  const [rows, setRows] = useState<MonthlyFeedbackRow[]>([])
  const [monthlyUrl, setMonthlyUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [list, token] = await Promise.all([
        loadMonthlyFeedbackRows(ownerId, studentId),
        loadMonthlyFeedbackPublicToken(ownerId),
      ])
      if (cancelled) return
      setRows(list)
      setMonthlyUrl(token ? `${window.location.origin}/form/check-in/compartido/${token}` : null)
    })()
    return () => {
      cancelled = true
    }
  }, [ownerId, studentId])

  const forThisRoutine = useMemo(
    () =>
      rows.filter((row) => matchRoutineForSubmittedAt([routine], row.submittedAt)?.id === routine.id),
    [rows, routine],
  )

  async function sendMonthlyWa() {
    if (!monthlyUrl) {
      toast.error('Creá un formulario con la plantilla de feedback mensual en Consulta semanal.')
      return
    }
    const digits = normalizePhoneForWhatsApp(studentPhone)
    if (!digits) {
      toast.error('Sin teléfono válido en la ficha')
      return
    }
    const res = await shareToWhatsApp({
      phoneDigits: digits,
      message: monthlyFeedbackInviteMessage({
        studentName,
        url: monthlyUrl,
        reason: lastWeek ? 'last_week' : 'finished',
      }),
    })
    if (res.copied) toast.success(WHATSAPP_DIRECT_PASTE_HINT)
  }

  if (!lastWeek && forThisRoutine.length === 0) return null

  return (
    <div className="space-y-3 rounded-xl border border-surface-border/80 bg-surface-elevated/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-ink-primary">Feedback mensual de esta rutina</p>
        {lastWeek ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-[10px]"
            icon={<WhatsAppIcon className="h-3 w-3" />}
            onClick={() => void sendMonthlyWa()}
          >
            Enviar feedback mensual
          </Button>
        ) : null}
      </div>
      {forThisRoutine.length > 0 ? (
        <ul className="space-y-2">
          {forThisRoutine.map((row) => (
            <li key={row.id} className="rounded-xl border border-emerald-600/20 bg-emerald-500/5 px-3 py-2">
              <p className="mb-2 text-[10px] text-ink-muted">
                {new Date(row.submittedAt).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <MonthlyFeedbackAnswers
                studentName={studentName}
                questions={row.questions}
                responses={row.responses}
                routineName={routine.name}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-muted">
          Cuando el alumno complete el feedback mensual, queda atado a esta rutina (aunque la renueves).
        </p>
      )}
    </div>
  )
}
