import { describe, expect, it } from 'vitest'
import { incomeTotals, parsePct, paymentWhatsAppMessage, shiftMonth, splitAmount } from './marketplaceIncome'

describe('reparto del marketplace', () => {
  it('80/20 por defecto y el redondeo va para el profesional', () => {
    expect(splitAmount(45000, 20)).toEqual({ admin: 9000, professional: 36000 })
    expect(splitAmount(33333, 17.5)).toEqual({ admin: 5833, professional: 27500 })
  })
  it('porcentaje fuera de rango se limita', () => {
    expect(splitAmount(1000, 150)).toEqual({ admin: 1000, professional: 0 })
    expect(splitAmount(1000, -5)).toEqual({ admin: 0, professional: 1000 })
  })
  it('totales del mes', () => {
    expect(
      incomeTotals([
        { professional_id: 'a', nombre: 'A', rol: 'entrenador', comision_pct: 20, cantidad: 2, cobrado: 90000, para_admin: 18000 },
        { professional_id: 'b', nombre: 'B', rol: 'nutricionista', comision_pct: 30, cantidad: 0, cobrado: 0, para_admin: 0 },
      ]),
    ).toEqual({ cobrado: 90000, admin: 18000, professionals: 72000, cantidad: 2 })
  })
  it('lee el porcentaje con coma y rechaza lo que no sirve', () => {
    expect(parsePct('17,5')).toBe(17.5)
    expect(parsePct('20')).toBe(20)
    expect(parsePct('')).toBeNull()
    expect(parsePct('120')).toBeNull()
    expect(parsePct('abc')).toBeNull()
  })
  it('mes anterior y siguiente', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
  })
  it('mensaje de WhatsApp al otro profesional', () => {
    const msg = paymentWhatsAppMessage(
      { professional_id: 'x', nombre: 'Lucía Gómez', rol: 'nutricionista', whatsapp: '11', cliente_nombre: 'Ana Pérez ', plan_titulo: 'Plan mensual' },
      'Tomás Ferster',
    )
    expect(msg).toBe('Hola Lucía! Soy Tomás: ya está confirmado el pago de Ana Pérez (Plan mensual). Ya podés escribirle y empezar. Lo tenés en «Mi página» de la app.')
  })
})
