import { describe, expect, it } from 'vitest'
import type { CheckInQuestion } from '@/lib/checkIn/questions'
import {
  matchRoutineForSubmittedAt,
  monthlyTestimonialQuote,
} from '@/lib/checkIn/monthlyFeedback'
import { monthlyFeedbackShareFilename } from '@/lib/checkIn/monthlyFeedbackShareImage'

const qs: CheckInQuestion[] = [
  { id: 'n', key: 'full_name', label: 'Nombre', type: 'text' },
  { id: 'm', key: 'monthly_mood', label: 'Ánimo', type: 'choice', options: [{ id: 'a', label: 'Bien', color: '#22c55e' }] },
  { id: 't', key: 'monthly_training', label: 'Entreno', type: 'choice', options: [{ id: 'a', label: 'Cumplí', color: '#22c55e' }] },
  { id: 'h', key: 'monthly_highlight', label: '¿Qué fue lo mejor?', type: 'text' },
  { id: 'i', key: 'monthly_improve', label: 'Mejorar', type: 'text' },
]

describe('monthlyTestimonialQuote', () => {
  it('prioriza monthly_highlight', () => {
    expect(
      monthlyTestimonialQuote(qs, {
        h: 'Me sentí más fuerte',
        i: 'Dormir más',
      }),
    ).toBe('Me sentí más fuerte')
  })

  it('usa la 4ª pregunta si Tomás la cambió a texto libre', () => {
    const custom: CheckInQuestion[] = [
      { id: 'n', key: 'full_name', label: 'Nombre', type: 'text' },
      { id: 'm', key: 'monthly_mood', label: 'Ánimo', type: 'choice' },
      { id: 't', key: 'monthly_training', label: 'Entreno', type: 'choice' },
      { id: 'q4', label: 'Realiza un FEEDBACK o comentario', type: 'text' },
    ]
    expect(monthlyTestimonialQuote(custom, { q4: 'Increíble mes con Tomás' })).toBe('Increíble mes con Tomás')
  })

  it('cae al texto más largo si no hay highlight', () => {
    const noKey: CheckInQuestion[] = [
      { id: 'n', key: 'full_name', label: 'Nombre', type: 'text' },
      { id: 'a', label: 'Corto', type: 'text' },
      { id: 'b', label: 'Largo', type: 'text' },
    ]
    expect(monthlyTestimonialQuote(noKey, { a: 'ok', b: 'Este comentario es bastante más largo' })).toBe(
      'Este comentario es bastante más largo',
    )
  })
})

describe('matchRoutineForSubmittedAt', () => {
  const r1 = { id: 'r1', name: 'Julio', start_date: '2026-07-01', end_date: '2026-07-28' }
  const r2 = { id: 'r2', name: 'Agosto', start_date: '2026-08-01', end_date: '2026-08-28' }

  it('asocia el envío a la rutina vigente ese día', () => {
    expect(matchRoutineForSubmittedAt([r1, r2], '2026-08-15T18:00:00-03:00')?.id).toBe('r2')
  })

  it('si llegó después del fin, queda en la rutina que acaba de terminar', () => {
    expect(matchRoutineForSubmittedAt([r1, r2], '2026-08-30T10:00:00-03:00')?.id).toBe('r2')
  })
})

describe('monthlyFeedbackShareFilename', () => {
  it('sluguea el nombre', () => {
    expect(monthlyFeedbackShareFilename('Ana Pérez')).toBe('feedback-ana.png')
  })
})
