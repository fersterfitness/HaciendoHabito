import type { NutritionMeasurement, Student } from '@/types/database'
import {
  ANTHRO_DIAMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  bmiFromKgM,
  labelForAnthroKey,
  type AnthropometryDetail,
  type AnthropometryMedians,
  type AnthropometryVariableKey,
} from '@/lib/nutrition/anthropometryProgramModel'
import { mergedMediansForPresentation } from '@/lib/nutrition/anthropometryPresentation'
import { ageFromBirthDateIso } from '@/lib/nutrition/energyRequirements'

/**
 * Informe ilustrado «Evaluación antropométrica» de un control: los datos que hoy el
 * nutricionista arma a mano (con ChatGPT) y una lectura en texto que se puede editar.
 */

/** Cómo leer un cambio: si bajar es mejor, si subir es mejor o si solo se informa. */
export type ChangeSense = 'lower' | 'higher' | 'neutral'
export type ChangeTone = 'good' | 'bad' | 'neutral' | 'same'

export interface ReportValue {
  value: number | null
  previous: number | null
  delta: number | null
  tone: ChangeTone
}

export interface ReportRow extends ReportValue {
  key: string
  label: string
  unit: string
  decimals: number
}

export interface Somatotype {
  endo: number
  meso: number
  ecto: number
}

export interface ReportGoal {
  id: string
  label: string
}

/** Lo que el nutricionista edita y queda guardado en el control (detail.report). */
export interface SavedReportTexts {
  reading?: string
  objective?: string
  goals?: string[]
}

export interface AnthropometryReportData {
  patientName: string
  measuredAt: string
  measurementNumber: number | null
  isFirst: boolean
  previousMeasuredAt: string | null
  previousNumber: number | null
  age: number | null
  weight: ReportValue
  height: number | null
  sittingHeight: number | null
  fatKg: ReportValue
  fatPct: ReportValue
  muscleKg: ReportValue
  musclePct: ReportValue
  skinfolds: ReportRow[]
  sum6: ReportValue
  perimeters: ReportRow[]
  diameters: ReportRow[]
  bmi: ReportValue
  waistHip: ReportValue
  waistHeight: ReportValue
  somatotype: Somatotype | null
  previousSomatotype: Somatotype | null
}

/** Debajo de esto el cambio se considera «sin cambio» (ruido de medición). */
const SAME_EPS: Record<string, number> = { kg: 0.2, '%': 0.3, mm: 0.3, cm: 0.3, '': 0.01 }

function round(n: number, d: number) {
  const f = 10 ** d
  return Math.round(n * f) / f
}

function finite(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n : null
}

export function reportValue(value: number | null, previous: number | null, sense: ChangeSense, unit: string): ReportValue {
  const v = finite(value)
  const p = finite(previous)
  if (v == null || p == null) return { value: v, previous: p, delta: null, tone: 'neutral' }
  const delta = round(v - p, 3)
  const eps = SAME_EPS[unit] ?? 0.01
  let tone: ChangeTone = 'neutral'
  if (Math.abs(delta) < eps) tone = 'same'
  else if (sense === 'lower') tone = delta < 0 ? 'good' : 'bad'
  else if (sense === 'higher') tone = delta > 0 ? 'good' : 'bad'
  return { value: v, previous: p, delta, tone }
}

function weightFrom(m: NutritionMeasurement, med: AnthropometryMedians) {
  return finite(m.weight_kg) ?? finite(med.peso_bruto_kg)
}

function heightFrom(m: NutritionMeasurement, med: AnthropometryMedians, student: Student) {
  return finite(m.height_cm) ?? finite(med.talla_corporal_cm) ?? finite(student.height_cm)
}

function sumSkinfolds(med: AnthropometryMedians): number | null {
  const vals = ANTHRO_SKINFOLD_KEYS.map((k) => finite(med[k]))
  if (vals.some((v) => v == null)) return null
  return round(vals.reduce<number>((s, v) => s + (v ?? 0), 0), 2)
}

function ratio(a: number | null | undefined, b: number | null | undefined, d = 2) {
  const x = finite(a)
  const y = finite(b)
  return x != null && y != null && y > 0 ? round(x / y, d) : null
}

/**
 * Somatotipo antropométrico de Heath-Carter. Pide los tres pliegues del endomorfismo,
 * diámetros humeral y femoral, brazo en tensión, pantorrilla (perímetro y pliegue), peso y talla.
 */
export function heathCarter(med: AnthropometryMedians, weightKg: number | null, heightCm: number | null): Somatotype | null {
  const tri = finite(med.triceps_mm)
  const sub = finite(med.subescapular_mm)
  const sup = finite(med.supraespinal_mm)
  const calfSkin = finite(med.pantorrilla_max_mm)
  const hum = finite(med.humeral_biepicondilar_cm)
  const fem = finite(med.femoral_biepicondilar_cm)
  const arm = finite(med.brazo_flexion_tension_cm)
  const calf = finite(med.pantorrilla_max_cm)
  const h = finite(heightCm)
  const w = finite(weightKg)
  if ([tri, sub, sup, calfSkin, hum, fem, arm, calf, h, w].some((v) => v == null) || !h || !w) return null

  const x = ((tri! + sub! + sup!) * 170.18) / h
  const endo = -0.7182 + 0.1451 * x - 0.00068 * x ** 2 + 0.0000014 * x ** 3
  const meso = 0.858 * hum! + 0.601 * fem! + 0.188 * (arm! - tri! / 10) + 0.161 * (calf! - calfSkin! / 10) - 0.131 * h + 4.5
  const hwr = h / Math.cbrt(w)
  const ecto = hwr >= 40.75 ? 0.732 * hwr - 28.58 : hwr > 38.25 ? 0.463 * hwr - 17.63 : 0.1
  return { endo: round(Math.max(endo, 0.1), 1), meso: round(Math.max(meso, 0.1), 1), ecto: round(Math.max(ecto, 0.1), 1) }
}

/** Categoría del somatotipo según Carter (componente dominante y el que le sigue). */
export function somatotypeName(s: Somatotype): string {
  const parts = [
    { v: s.endo, noun: 'Endomorfo', adj: 'endomórfico' },
    { v: s.meso, noun: 'Mesomorfo', adj: 'mesomórfico' },
    { v: s.ecto, noun: 'Ectomorfo', adj: 'ectomórfico' },
  ].sort((a, b) => b.v - a.v)
  const [a, b, c] = parts as [(typeof parts)[number], (typeof parts)[number], (typeof parts)[number]]
  if (a.v - c.v < 1) return 'Central'
  if (a.v - b.v < 0.5) return `${a.noun}-${b.noun.toLowerCase()}`
  if (b.v - c.v < 0.5) return `${a.noun} balanceado`
  return `${a.noun} ${b.adj}`
}

const SKINFOLD_LABEL: Partial<Record<AnthropometryVariableKey, string>> = {
  muslo_medial_mm: 'Muslo medial',
  pantorrilla_max_mm: 'Pantorrilla',
}

const DIAMETER_LABEL: Partial<Record<AnthropometryVariableKey, string>> = {
  torax_anteroposterior_cm: 'Tórax anteroposterior',
}

const KEY_PERIMETERS: { key: AnthropometryVariableKey; label: string; sense: ChangeSense }[] = [
  { key: 'cintura_min_cm', label: 'Cintura mínima', sense: 'lower' },
  { key: 'cadera_max_cm', label: 'Cadera máxima', sense: 'neutral' },
  { key: 'brazo_relajado_cm', label: 'Brazo relajado', sense: 'neutral' },
  { key: 'brazo_flexion_tension_cm', label: 'Brazo en tensión', sense: 'neutral' },
  { key: 'torax_mesoesternal_cm', label: 'Tórax', sense: 'neutral' },
  { key: 'muslo_max_cm', label: 'Muslo superior', sense: 'neutral' },
  { key: 'muslo_medial_cm', label: 'Muslo medial', sense: 'neutral' },
  { key: 'pantorrilla_max_cm', label: 'Pantorrilla', sense: 'neutral' },
]

function rowsFor(
  keys: { key: AnthropometryVariableKey; label: string; sense: ChangeSense }[],
  cur: AnthropometryMedians,
  prev: AnthropometryMedians | null,
  unit: string,
): ReportRow[] {
  return keys
    .map(({ key, label, sense }) => ({
      key,
      label,
      unit,
      decimals: 2,
      ...reportValue(finite(cur[key]), prev ? finite(prev[key]) : null, sense, unit),
    }))
    .filter((r) => r.value != null)
}

export function buildAnthropometryReport(
  student: Student,
  current: NutritionMeasurement,
  previous: NutritionMeasurement | null,
): AnthropometryReportData {
  const cur = mergedMediansForPresentation(current)
  const prev = previous ? mergedMediansForPresentation(previous) : null

  const w = weightFrom(current, cur)
  const pw = previous && prev ? weightFrom(previous, prev) : null
  const h = heightFrom(current, cur, student)
  const ph = previous && prev ? heightFrom(previous, prev, student) : null

  const fatPct = finite(current.body_fat_pct)
  const pFatPct = previous ? finite(previous.body_fat_pct) : null
  const fatKg = w != null && fatPct != null ? round((w * fatPct) / 100, 2) : null
  const pFatKg = pw != null && pFatPct != null ? round((pw * pFatPct) / 100, 2) : null
  const muscleKg = finite(current.muscle_mass_kg)
  const pMuscleKg = previous ? finite(previous.muscle_mass_kg) : null
  const musclePct = muscleKg != null && w ? round((muscleKg / w) * 100, 2) : null
  const pMusclePct = pMuscleKg != null && pw ? round((pMuscleKg / pw) * 100, 2) : null

  const bmi = finite(current.bmi) ?? bmiFromKgM(w, h != null ? h / 100 : null)
  const pBmi = previous ? (finite(previous.bmi) ?? bmiFromKgM(pw, ph != null ? ph / 100 : null)) : null

  return {
    patientName: student.full_name,
    measuredAt: current.measured_at,
    measurementNumber: current.measurement_number,
    isFirst: previous == null,
    previousMeasuredAt: previous?.measured_at ?? null,
    previousNumber: previous?.measurement_number ?? null,
    age: ageFromBirthDateIso(student.birth_date, new Date(current.measured_at)),
    weight: reportValue(w, pw, 'neutral', 'kg'),
    height: h,
    sittingHeight: finite(cur.talla_sentado_cm) ?? finite(current.sitting_height_cm),
    fatKg: reportValue(fatKg, pFatKg, 'lower', 'kg'),
    fatPct: reportValue(fatPct, pFatPct, 'lower', '%'),
    muscleKg: reportValue(muscleKg, pMuscleKg, 'higher', 'kg'),
    musclePct: reportValue(musclePct, pMusclePct, 'higher', '%'),
    skinfolds: rowsFor(
      ANTHRO_SKINFOLD_KEYS.map((key) => ({ key, label: SKINFOLD_LABEL[key] ?? labelForAnthroKey(key), sense: 'lower' as const })),
      cur,
      prev,
      'mm',
    ),
    sum6: reportValue(sumSkinfolds(cur), prev ? sumSkinfolds(prev) : null, 'lower', 'mm'),
    perimeters: rowsFor(KEY_PERIMETERS, cur, prev, 'cm'),
    diameters: rowsFor(
      ANTHRO_DIAMETER_KEYS.map((key) => ({ key, label: DIAMETER_LABEL[key] ?? labelForAnthroKey(key), sense: 'neutral' as const })),
      cur,
      prev,
      'cm',
    ),
    bmi: reportValue(bmi, pBmi, 'neutral', ''),
    waistHip: reportValue(ratio(cur.cintura_min_cm, cur.cadera_max_cm), prev ? ratio(prev.cintura_min_cm, prev.cadera_max_cm) : null, 'lower', ''),
    waistHeight: reportValue(ratio(cur.cintura_min_cm, h), prev ? ratio(prev.cintura_min_cm, ph) : null, 'lower', ''),
    somatotype: heathCarter(cur, w, h),
    previousSomatotype: prev ? heathCarter(prev, pw, ph) : null,
  }
}

/* ─────────────── Textos ─────────────── */

/** Número con coma decimal y la cantidad justa de decimales. */
export function nfReport(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function signed(n: number, decimals: number, unit: string) {
  const s = nfReport(Math.abs(n), decimals)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}${unit ? ` ${unit}` : ''}`
}

function change(label: string, v: ReportValue, decimals: number, unit: string, phrases: { down: string; up: string }) {
  if (v.delta == null || v.value == null) return null
  if (v.tone === 'same') return `${label} se mantuvo estable (**${nfReport(v.value, decimals)}${unit ? ` ${unit}` : ''}**)`
  const verb = v.delta < 0 ? phrases.down : phrases.up
  return `${label} ${verb} **${signed(v.delta, decimals, unit)}** (de ${nfReport(v.previous, decimals)} a ${nfReport(v.value, decimals)}${unit ? ` ${unit}` : ''})`
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** Lectura automática de la evaluación (marca **negrita**; un párrafo por línea). */
export function defaultReportReading(r: AnthropometryReportData): string {
  const p: string[] = []
  const kg = (v: number | null) => `**${nfReport(v)} kg**`
  if (r.isFirst) {
    const parts = [`En esta primera evaluación se registra un peso de ${kg(r.weight.value)}`]
    if (r.bmi.value != null) parts.push(`con un IMC de **${nfReport(r.bmi.value)} kg/m²**`)
    let first = parts.join(', ') + '.'
    if (r.fatPct.value != null && r.musclePct.value != null) {
      first += ` El **${nfReport(r.fatPct.value)} %** de tu peso corresponde a tejido adiposo y el **${nfReport(r.musclePct.value)} %** a masa muscular.`
    }
    p.push(first)
    const refs: string[] = []
    if (r.sum6.value != null) refs.push(`la suma de pliegues (${nfReport(r.sum6.value)} mm)`)
    if (r.waistHip.value != null) refs.push(`la relación cintura/cadera (${nfReport(r.waistHip.value)})`)
    if (refs.length) {
      p.push(
        `${capitalize(joinList(refs))} ${refs.length > 1 ? 'nos brindan' : 'nos brinda'} una referencia inicial de tu composición corporal, que utilizaremos como punto de partida para el seguimiento.`,
      )
    }
    p.push('A partir de estos resultados vamos a trabajar en un plan que se adapte a tus objetivos, priorizando tu bienestar, la salud y hábitos sostenibles en el tiempo.')
    return p.join('\n')
  }

  const intro = change('Respecto del control anterior, tu peso', r.weight, 2, 'kg', { down: 'bajó', up: 'subió' })
  if (intro) p.push(intro + '.')

  const comp = [
    change('la masa adiposa', r.fatKg, 2, 'kg', { down: 'bajó', up: 'subió' }),
    change('la masa muscular', r.muscleKg, 2, 'kg', { down: 'bajó', up: 'subió' }),
  ].filter((x): x is string => x != null)
  if (comp.length) p.push(capitalize(joinList(comp)) + '.')

  const marks = [
    change('la suma de 6 pliegues', r.sum6, 2, 'mm', { down: 'bajó', up: 'subió' }),
    change('la cintura', r.perimeters.find((x) => x.key === 'cintura_min_cm') ?? emptyValue(), 2, 'cm', { down: 'bajó', up: 'subió' }),
  ].filter((x): x is string => x != null)
  if (marks.length) p.push(capitalize(joinList(marks)) + '.')

  const tones = [r.fatKg, r.muscleKg, r.sum6, r.perimeters.find((x) => x.key === 'cintura_min_cm') ?? emptyValue()]
    .map((v) => v.tone)
    .filter((t) => t === 'good' || t === 'bad')
  const good = tones.filter((t) => t === 'good').length
  const bad = tones.length - good
  if (tones.length) {
    p.push(
      bad === 0
        ? 'Los cambios van en la dirección buscada: sigamos con el plan y sostengamos los hábitos que te están dando resultado.'
        : good === 0
          ? 'En este período los indicadores no acompañaron. Vamos a revisar juntos el plan y los hábitos para ajustar lo que haga falta.'
          : 'Hay avances y también puntos a mejorar. Vamos a reforzar lo que funciona y ajustar el plan en lo que todavía no acompaña.',
    )
  }
  return p.join('\n')
}

function emptyValue(): ReportValue {
  return { value: null, previous: null, delta: null, tone: 'neutral' }
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export const REPORT_GOALS: ReportGoal[] = [
  { id: 'muscle', label: 'Mantener y aumentar masa muscular' },
  { id: 'habits', label: 'Mejorar hábitos alimentarios' },
  { id: 'composition', label: 'Optimizar composición corporal' },
  { id: 'health', label: 'Salud y bienestar general' },
  { id: 'fat', label: 'Reducir masa grasa' },
  { id: 'performance', label: 'Rendimiento deportivo' },
  { id: 'energy', label: 'Más energía en el día' },
  { id: 'rest', label: 'Mejor descanso' },
]

export const DEFAULT_REPORT_GOALS = ['muscle', 'habits', 'composition', 'health']
export const MAX_REPORT_GOALS = 4

export const DEFAULT_REPORT_OBJECTIVE =
  'Establecer una base de trabajo para acompañarte en la mejora de tu composición corporal, potenciando la masa muscular y manteniendo un balance saludable, a través de una alimentación equilibrada, actividad física y hábitos sostenibles.'

export function savedReportTexts(m: NutritionMeasurement): SavedReportTexts {
  const d = m.detail as (AnthropometryDetail & { report?: SavedReportTexts }) | null
  const r = d && typeof d === 'object' ? d.report : undefined
  return r && typeof r === 'object' ? r : {}
}

/** Evolución de los números principales a lo largo de los controles, para la lámina. */
export interface ReportEvolutionRow {
  key: 'weight' | 'fatKg' | 'muscleKg' | 'sum6'
  label: string
  unit: string
  /** Un valor por control, del más viejo al más nuevo. */
  values: (number | null)[]
  /** Cambio desde el primer control mostrado hasta el actual. */
  total: ReportValue
}

export interface ReportEvolution {
  controls: { measuredAt: string; number: number | null }[]
  rows: ReportEvolutionRow[]
}

export const MAX_REPORT_EVOLUTION = 6

/**
 * Hasta los últimos 6 controles hasta el elegido (inclusive). null si hay menos de 3: con dos, los
 * cambios del control ya cuentan la historia.
 * `measurements` puede venir en cualquier orden.
 */
export function buildReportEvolution(
  student: Student,
  measurements: NutritionMeasurement[],
  currentId: string,
): ReportEvolution | null {
  const sorted = [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  const end = sorted.findIndex((m) => m.id === currentId)
  if (end < 0) return null
  const list = sorted.slice(Math.max(0, end - MAX_REPORT_EVOLUTION + 1), end + 1)
  if (list.length < 3) return null
  const reports = list.map((m) => buildAnthropometryReport(student, m, null))
  const total = buildAnthropometryReport(student, list[list.length - 1]!, list[0]!)
  const defs: { key: ReportEvolutionRow['key']; label: string; unit: string }[] = [
    { key: 'weight', label: 'Peso', unit: 'kg' },
    { key: 'fatKg', label: 'Masa grasa', unit: 'kg' },
    { key: 'muscleKg', label: 'Masa muscular', unit: 'kg' },
    { key: 'sum6', label: 'Suma de 6 pliegues', unit: 'mm' },
  ]
  const rows = defs
    .map((d) => ({ ...d, values: reports.map((r) => r[d.key].value), total: total[d.key] }))
    .filter((r) => r.values.filter((v) => v != null).length >= 2)
  if (!rows.length) return null
  return { controls: list.map((m) => ({ measuredAt: m.measured_at, number: m.measurement_number })), rows }
}
