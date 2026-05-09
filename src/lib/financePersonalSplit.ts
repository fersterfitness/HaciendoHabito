/**
 * Cobros HH:
 * - PREMIUM / PLATINO / ÉLITE: mitad → vida personal.
 * - Resto de planes individuales de rutina: copia íntegra también en vida personal (misma forma de cobro HH).
 */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

function normIncomeKey(incomeType: string): string {
  return stripAccents(incomeType).toUpperCase().trim().replace(/\s+/g, ' ')
}

/** Coincide aunque venga como "habitos elite", "ELITE", etc. */
export function incomeTypeSplitsToPersonalHalf(incomeType: string): boolean {
  const key = normIncomeKey(incomeType)
  const targets = ['HÁBITOS PREMIUM', 'HÁBITOS PLATINO', 'HÁBITOS ÉLITE'].map((t) =>
    stripAccents(t).toUpperCase().trim(),
  )
  return targets.includes(key)
}

/**
 * Rutinas individuales HH (no trio premium): mismo monto cargado en negocio y en vida personal.
 * Incluye variantes ortográficas («AVANZADO» / «AVANZADOS»).
 */
export function incomeTypeMirrorsFullToPersonal(incomeType: string): boolean {
  if (incomeTypeSplitsToPersonalHalf(incomeType)) return false
  const key = normIncomeKey(incomeType)

  const individualTargets = [
    'HÁBITOS SEDENTARIO',
    'HÁBITOS AVANZADO',
    'HÁBITOS AVANZADOS',
    'HÁBITOS PROGRESIÓN',
    'HÁBITOS DEPORTISTA',
    'HÁBITOS ALTO RENDIMIENTO',
    'HÁBITOS ACTION SPORT',
  ].map((t) => stripAccents(t).toUpperCase().trim())

  return individualTargets.includes(key)
}

export function personalHalfAmount(amount: number): number {
  return Math.round(amount / 2)
}

type MainIncomePayload = {
  owner_id: string
  student_id: string | null
  income_type: string
  category: string
  description: string
  income_date: string
  payment_method: string
  amount: number
  scope?: string | null
  status: string
  notes?: string | null
}

/** Segunda fila de ingreso (vida personal) o null si no aplica. */
export function buildPersonalHalfIncomeRow(main: MainIncomePayload): MainIncomePayload | null {
  if ((main.scope ?? 'business') !== 'business') return null
  if (!incomeTypeSplitsToPersonalHalf(main.income_type)) return null
  const half = personalHalfAmount(main.amount)
  if (half <= 0) return null

  const orig = `$${main.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  return {
    owner_id: main.owner_id,
    student_id: main.student_id,
    income_date: main.income_date,
    income_type: main.income_type,
    category: main.category,
    payment_method: main.payment_method,
    status: main.status,
    scope: 'personal',
    amount: half,
    description: `[HH → vida personal] ${main.description}`,
    notes: `Mitad por proyecto (${main.income_type}). Cobro HH: ${orig}.${main.notes?.trim() ? ` Notas del cobro: ${main.notes.trim()}` : ''}`,
  }
}

/** Copia el ingreso íntegro en vida personal (planes individuales de rutina). */
export function buildPersonalFullMirrorIncomeRow(main: MainIncomePayload): MainIncomePayload | null {
  if ((main.scope ?? 'business') !== 'business') return null
  if (!incomeTypeMirrorsFullToPersonal(main.income_type)) return null
  if (!(main.amount > 0)) return null

  const orig = `$${main.amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  return {
    owner_id: main.owner_id,
    student_id: main.student_id,
    income_date: main.income_date,
    income_type: main.income_type,
    category: main.category,
    payment_method: main.payment_method,
    status: main.status,
    scope: 'personal',
    amount: main.amount,
    description: `[HH → vida personal · copia íntegra] ${main.description}`,
    notes: `Mismo monto cargado en HH y en vida personal (${main.income_type}). Cobro HH: ${orig}.${main.notes?.trim() ? ` Notas del cobro: ${main.notes.trim()}` : ''}`,
  }
}
