import { describe, expect, it } from 'vitest'
import { owedPeriods, periodFormUrl, periodLabel, recentPeriods, responsePeriod, sendDayOnOrBefore } from '@/lib/checkIn/sendPeriods'

describe('sendDayOnOrBefore', () => {
  it('lleva cualquier día al viernes anterior (o al mismo viernes)', () => {
    expect(sendDayOnOrBefore('2026-10-30')).toBe('2026-10-30') // viernes
    expect(sendDayOnOrBefore('2026-11-01')).toBe('2026-10-30') // domingo
    expect(sendDayOnOrBefore('2026-11-05')).toBe('2026-10-30') // jueves
    expect(sendDayOnOrBefore('2026-11-06')).toBe('2026-11-06') // viernes siguiente
  })

  it('respeta otro día de envío', () => {
    expect(sendDayOnOrBefore('2026-11-01', 1)).toBe('2026-10-26') // lunes
  })
})

describe('responsePeriod', () => {
  it('una respuesta del lunes cuenta para el formulario del viernes anterior', () => {
    expect(responsePeriod({ submitted_at: '2026-11-02T15:00:00Z' })).toBe('2026-10-30')
  })

  it('usa la semana guardada si existe', () => {
    expect(responsePeriod({ submitted_at: '2026-11-02T15:00:00Z', period_start: '2026-10-23' })).toBe('2026-10-23')
  })
})

describe('owedPeriods', () => {
  const periods = recentPeriods(4, 5, new Date('2026-11-01T15:00:00Z'))

  it('arma las semanas desde la actual hacia atrás', () => {
    expect(periods).toEqual(['2026-10-30', '2026-10-23', '2026-10-16', '2026-10-09'])
  })

  it('debe las semanas pasadas sin respuesta, no la actual ni las anteriores a su alta', () => {
    expect(owedPeriods({ answered: new Set(['2026-10-23']), periods })).toEqual(['2026-10-16', '2026-10-09'])
    expect(owedPeriods({ answered: new Set(), periods, since: '2026-10-20' })).toEqual(['2026-10-23'])
  })
})

describe('periodFormUrl / periodLabel', () => {
  it('agrega la semana al link', () => {
    expect(periodFormUrl('https://x.app/c/abc', '2026-10-23')).toBe('https://x.app/c/abc?semana=2026-10-23')
    expect(periodFormUrl('https://x.app/c/abc?email=a', '2026-10-23')).toBe('https://x.app/c/abc?email=a&semana=2026-10-23')
    expect(periodFormUrl('https://x.app/c/abc', null)).toBe('https://x.app/c/abc')
  })

  it('muestra el día de envío', () => {
    expect(periodLabel('2026-10-23')).toBe('vie 23/10')
  })
})
