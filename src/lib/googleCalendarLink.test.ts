import { describe, expect, it } from 'vitest'
import { googleCalendarEventUrl } from '@/lib/googleCalendarLink'

describe('googleCalendarEventUrl', () => {
  it('arma el link con título, fechas en UTC y lugar', () => {
    const url = new URL(
      googleCalendarEventUrl({
        title: 'Consulta · Gustavo Cabral',
        start: new Date('2026-11-03T13:00:00Z'),
        end: new Date('2026-11-03T13:45:00Z'),
        location: 'https://meet.google.com/abc',
      }),
    )
    expect(url.host).toBe('calendar.google.com')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Consulta · Gustavo Cabral')
    expect(url.searchParams.get('dates')).toBe('20261103T130000Z/20261103T134500Z')
    expect(url.searchParams.get('location')).toBe('https://meet.google.com/abc')
    expect(url.searchParams.has('details')).toBe(false)
  })
})
