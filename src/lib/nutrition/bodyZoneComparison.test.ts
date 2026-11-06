import { describe, expect, it } from 'vitest'
import { BODY_ZONES, compareBodyZones, compareZone } from './bodyZoneComparison'

const zone = (id: string) => BODY_ZONES.find((z) => z.id === id)!

describe('compareZone', () => {
  it('pliegue que baja es mejora', () => {
    const r = compareZone(zone('costado'), { supraespinal_mm: 16 }, { supraespinal_mm: 15 })
    expect(r.status).toBe('good')
    expect(r.rows[0]).toMatchObject({ a: 16, b: 15, delta: -1, verdict: 'good' })
  })

  it('perímetro que sube con pliegue que sube queda para revisar', () => {
    const r = compareZone(zone('muslo'), { muslo_max_cm: 55, muslo_medial_mm: 12 }, { muslo_max_cm: 56, muslo_medial_mm: 14 })
    expect(r.status).toBe('alert')
    expect(r.note).toMatch(/grasa/)
  })

  it('perímetro que sube con pliegue que baja es mejora', () => {
    const r = compareZone(zone('brazo'), { brazo_relajado_cm: 31, triceps_mm: 10 }, { brazo_relajado_cm: 32, triceps_mm: 8.5 })
    expect(r.status).toBe('good')
  })

  it('cambios menores al error de medición no cuentan', () => {
    const r = compareZone(zone('antebrazo'), { antebrazo_max_cm: 26.5 }, { antebrazo_max_cm: 26.6 })
    expect(r.status).toBe('same')
  })

  it('cadera solo informa que cambió', () => {
    expect(compareZone(zone('cadera'), { cadera_max_cm: 99 }, { cadera_max_cm: 98 }).status).toBe('neutral')
  })

  it('sin la medida en alguno de los dos controles no hay datos', () => {
    const r = compareZone(zone('pantorrilla'), { pantorrilla_max_cm: 37 }, { pantorrilla_max_mm: 8 })
    expect(r.status).toBe('nodata')
    expect(r.rows).toHaveLength(0)
  })
})

describe('compareBodyZones', () => {
  it('devuelve todas las zonas, aun sin medianas', () => {
    const all = compareBodyZones(null, null)
    expect(all).toHaveLength(BODY_ZONES.length)
    expect(all.every((z) => z.status === 'nodata')).toBe(true)
  })
})
