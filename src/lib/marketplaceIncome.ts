/**
 * Feedback nov24 (tanda 7): reparto de lo que paga el cliente. Por defecto 20 % para el administrador (Tomás) y
 * 80 % para el profesional; el porcentaje se pone por profesional. Necesita 20261128140000_marketplace_reparto_y_whatsapp.sql.
 */
export const INCOME_MIGRATION = '20261128140000_marketplace_reparto_y_whatsapp.sql'
export const DEFAULT_ADMIN_PCT = 20

export interface IncomeRow {
  professional_id: string
  nombre: string
  rol: string
  /** Porcentaje actual del administrador para este profesional. */
  comision_pct: number
  cantidad: number
  cobrado: number
  para_admin: number
}

export interface PaymentContact {
  professional_id: string
  nombre: string
  rol: string
  whatsapp: string
  cliente_nombre: string
  plan_titulo: string
}

/** Lo que le queda a cada uno de un monto, en pesos enteros (el redondeo va para el profesional). */
export function splitAmount(amount: number, adminPct: number): { admin: number; professional: number } {
  const pct = Math.min(100, Math.max(0, Number.isFinite(adminPct) ? adminPct : DEFAULT_ADMIN_PCT))
  const admin = Math.round((amount * pct) / 100)
  return { admin, professional: Math.round(amount) - admin }
}

/** Totales del mes. */
export function incomeTotals(rows: IncomeRow[]): { cobrado: number; admin: number; professionals: number; cantidad: number } {
  const cobrado = rows.reduce((a, r) => a + Number(r.cobrado), 0)
  const admin = Math.round(rows.reduce((a, r) => a + Number(r.para_admin), 0))
  return { cobrado: Math.round(cobrado), admin, professionals: Math.round(cobrado) - admin, cantidad: rows.reduce((a, r) => a + r.cantidad, 0) }
}

/** Valida lo que escribe el administrador: «20», «17,5». `null` si no sirve. */
export function parsePct(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  if (!raw.trim() || !Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export function pctLabel(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace('.', ',')} %`
}

/** Mensaje de WhatsApp al otro profesional cuando se confirma el pago. */
export function paymentWhatsAppMessage(c: PaymentContact, adminName: string): string {
  const first = c.nombre.trim().split(/\s+/)[0] ?? ''
  const who = adminName.trim().split(/\s+/)[0] || 'Tomás'
  return `Hola ${first}! Soy ${who}: ya está confirmado el pago de ${c.cliente_nombre.trim()} (${c.plan_titulo}). Ya podés escribirle y empezar. Lo tenés en «Mi página» de la app.`
}

/** Primer día del mes `ym` («2026-11») corrido `delta` meses. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
