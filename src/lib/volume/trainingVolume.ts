/**
 * Contador de volumen semanal por músculo.
 *
 *   series_ponderadas = Σ (n_series × factor_implicación_muscular × factor_intensidad × factor_esfuerzo)
 *
 * - factor_implicación: 1.0 músculo objetivo, ~0.5 sinérgico (editable por ejercicio).
 * - factor_intensidad: multiplicador de la técnica (dropset, burns…). Regla de RIR: solo se aplica
 *   si la serie está cerca del fallo; con un RIR registrado alto, no se aplica.
 * - factor_esfuerzo: una serie lejos del fallo no cuenta igual que una serie dura.
 *
 * `raw` es el conteo de series con sinergias (sin técnicas ni RIR); `weighted`, la fatiga real.
 */

import { parseExerciseMeta } from '@/lib/routine/exerciseMeta'

export const VOLUME_MUSCLES = [
  { id: 'cuadriceps', label: 'Cuádriceps', short: 'Cuád.' },
  { id: 'femoral', label: 'Femoral', short: 'Fem.' },
  { id: 'gluteo', label: 'Glúteo', short: 'Glút.' },
  { id: 'aductores', label: 'Aductores', short: 'Aduc.' },
  { id: 'pecho', label: 'Pecho', short: 'Pecho' },
  { id: 'deltoides', label: 'Deltoides', short: 'Delt.' },
  { id: 'deltoide_post', label: 'Deltoide post.', short: 'R.delt' },
  { id: 'espalda', label: 'Espalda', short: 'Esp.' },
  { id: 'trapecio', label: 'Trapecio', short: 'Trap.' },
  { id: 'biceps', label: 'Bíceps', short: 'Bíc.' },
  { id: 'triceps', label: 'Tríceps', short: 'Tríc.' },
  { id: 'gemelos', label: 'Gemelos', short: 'Gem.' },
  { id: 'abdominales', label: 'Abdominales', short: 'Abd.' },
] as const

export type MuscleId = (typeof VOLUME_MUSCLES)[number]['id']
export type MuscleFactors = Partial<Record<MuscleId, number>>
export const MUSCLE_IDS = VOLUME_MUSCLES.map((m) => m.id) as MuscleId[]

/** Categorías de la biblioteca (muscle_groups.slug) → implicación por defecto. */
const GROUP_DEFAULTS: Record<string, MuscleFactors> = {
  pecho: { pecho: 1, deltoides: 0.5, triceps: 0.5 },
  espalda: { espalda: 1, biceps: 0.5, deltoide_post: 0.5 },
  hombros: { deltoides: 1 },
  biceps: { biceps: 1 },
  triceps: { triceps: 1 },
  abdomen: { abdominales: 1 },
  cuadriceps: { cuadriceps: 1 },
  aductores: { aductores: 1 },
  isquiotibiales: { femoral: 1 },
  gluteos: { gluteo: 1 },
  gemelos: { gemelos: 1 },
}

/** Por nombre de ejercicio (gana sobre la categoría). El orden importa: lo más específico primero. */
const NAME_RULES: { re: RegExp; factors: MuscleFactors }[] = [
  { re: /peso muerto rumano|rdl|stiff|buenos d[ií]as/, factors: { femoral: 1, gluteo: 0.7, espalda: 0.3 } },
  { re: /peso muerto|deadlift/, factors: { femoral: 1, gluteo: 1, cuadriceps: 0.5, espalda: 0.5, trapecio: 0.5 } },
  { re: /hip ?thrust|puente de gl[uú]teo|glute bridge/, factors: { gluteo: 1, femoral: 0.3 } },
  { re: /b[uú]lgara|zancada|estocada|lunge|split squat|step ?up/, factors: { cuadriceps: 1, gluteo: 0.8, femoral: 0.2, aductores: 0.3 } },
  { re: /sentadilla|squat|hack|prensa|leg press/, factors: { cuadriceps: 1, gluteo: 0.7, aductores: 0.3, femoral: 0.2 } },
  { re: /extensi[oó]n de cu[aá]driceps|leg extension|sill[oó]n de cu[aá]driceps/, factors: { cuadriceps: 1 } },
  { re: /curl femoral|leg curl|nordic|glute ham/, factors: { femoral: 1, gemelos: 0.3 } },
  { re: /gemel|pantorrill|calf/, factors: { gemelos: 1 } },
  { re: /press (de )?banca|bench|press inclinado|press declinado|flexi[oó]n(es)? de brazos|push ?up|fondos en paralelas|dips/, factors: { pecho: 1, deltoides: 0.5, triceps: 0.5 } },
  { re: /apertura|cruces? (de )?poleas?|crossover|peck ?deck|fly/, factors: { pecho: 1, deltoides: 0.2 } },
  { re: /press militar|press de hombros|overhead press|arnold|press (con )?mancuernas sentado/, factors: { deltoides: 1, triceps: 0.5, pecho: 0.2 } },
  { re: /elevaci(ó|o)n(es)? lateral|vuelos? lateral/, factors: { deltoides: 1, trapecio: 0.3 } },
  { re: /face ?pull|vuelos? posterior|p[aá]jaro|reverse fly|deltoide posterior/, factors: { deltoide_post: 1, trapecio: 0.5 } },
  { re: /encogimiento|shrug/, factors: { trapecio: 1 } },
  { re: /remo al ment[oó]n|upright row/, factors: { deltoides: 1, trapecio: 0.7 } },
  { re: /dominada|pull ?up|chin ?up|jal[oó]n|pulldown|lat pull/, factors: { espalda: 1, biceps: 0.5, deltoide_post: 0.3 } },
  { re: /remo|row|seal/, factors: { espalda: 1, deltoide_post: 0.5, biceps: 0.5, trapecio: 0.5 } },
  { re: /pull ?over/, factors: { espalda: 1, pecho: 0.3 } },
  { re: /curl/, factors: { biceps: 1 } },
  { re: /franc[eé]s|tr[ií]ceps|extensi[oó]n de codo|press cerrado|patada|kickback|pushdown/, factors: { triceps: 1 } },
  { re: /plancha|crunch|abdominal|rueda|ab wheel|hollow|pallof|elevaci(ó|o)n de piernas/, factors: { abdominales: 1 } },
]

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim()
}

/** Implicación por defecto: por nombre del ejercicio, si no por la categoría de la biblioteca. */
export function defaultMuscleFactors(name: string | null | undefined, groupSlug: string | null | undefined): MuscleFactors {
  const n = normalizeName(name ?? '')
  // Las reglas se escriben con tildes opcionales; comparamos contra el nombre sin tildes también.
  for (const rule of NAME_RULES) {
    if (rule.re.test(n) || rule.re.test((name ?? '').toLowerCase())) return { ...rule.factors }
  }
  const slug = (groupSlug ?? '').toLowerCase()
  return GROUP_DEFAULTS[slug] ? { ...GROUP_DEFAULTS[slug] } : {}
}

export function cleanFactors(raw: unknown): MuscleFactors {
  const out: MuscleFactors = {}
  if (!raw || typeof raw !== 'object') return out
  for (const id of MUSCLE_IDS) {
    const v = Number((raw as Record<string, unknown>)[id])
    if (Number.isFinite(v) && v > 0) out[id] = Math.min(1.5, Math.round(v * 100) / 100)
  }
  return out
}

// ─── Técnicas de intensidad ──────────────────────────────────────────────────

export const TECHNIQUES = [
  { id: 'straight', label: 'Serie recta' },
  { id: 'dropset', label: 'Dropset / stripping' },
  { id: 'rest_pause', label: 'Rest-pause / myo-reps' },
  { id: 'burns', label: 'Burns / parciales' },
  { id: 'beyond_failure', label: 'Más allá del fallo' },
] as const

export type TechniqueId = (typeof TECHNIQUES)[number]['id']

const TECHNIQUE_RULES: { re: RegExp; id: TechniqueId }[] = [
  { re: /drop ?set|dropset|stripping|strip set|descendente/, id: 'dropset' },
  { re: /rest ?pause|myo|cluster|\d\s*\+\s*\d/, id: 'rest_pause' },
  { re: /burns?|parcial(es)?|1 ?y ?1\/2|1½/, id: 'burns' },
  { re: /forzad|negativ|m[aá]s all[aá] del fallo|tras el fallo|post ?fallo|trampa|cheat/, id: 'beyond_failure' },
]

/** Técnica según el método aplicado, el esquema de reps y las notas (si no hay nada, serie recta). */
export function detectTechnique(...texts: (string | null | undefined)[]): TechniqueId {
  const t = normalizeName(texts.filter(Boolean).join(' · '))
  for (const r of TECHNIQUE_RULES) if (r.re.test(t)) return r.id
  return 'straight'
}

// ─── Parámetros (perfiles) ────────────────────────────────────────────────────

export type VolumeSettings = {
  /** Rango objetivo de series ponderadas por músculo y semana. */
  targetMin: number
  targetMax: number
  /** Rango propio por músculo (prioridades / mapa muscular). */
  muscleTargets: Partial<Record<MuscleId, { min: number; max: number }>>
  /** El multiplicador de técnica solo se aplica con RIR ≤ este valor. */
  rirThreshold: number
  /** Series con RIR ≥ este valor cuentan como `farFactor` (lejos del fallo). */
  farRir: number
  farFactor: number
  techniques: Record<TechniqueId, number>
}

export const DEFAULT_VOLUME_SETTINGS: VolumeSettings = {
  targetMin: 10,
  targetMax: 20,
  muscleTargets: {},
  rirThreshold: 3,
  farRir: 5,
  farFactor: 0.5,
  techniques: { straight: 1, dropset: 1.4, rest_pause: 1.3, burns: 1.25, beyond_failure: 1.3 },
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizeVolumeSettings(raw: unknown): VolumeSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_VOLUME_SETTINGS
  const tech = (o.techniques && typeof o.techniques === 'object' ? o.techniques : {}) as Record<string, unknown>
  const targetsRaw = (o.muscleTargets && typeof o.muscleTargets === 'object' ? o.muscleTargets : {}) as Record<string, unknown>
  const muscleTargets: VolumeSettings['muscleTargets'] = {}
  for (const id of MUSCLE_IDS) {
    const t = targetsRaw[id] as { min?: unknown; max?: unknown } | undefined
    if (!t) continue
    const min = num(t.min, NaN, 0, 60)
    const max = num(t.max, NaN, 0, 60)
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) muscleTargets[id] = { min, max }
  }
  const targetMin = num(o.targetMin, d.targetMin, 0, 60)
  return {
    targetMin,
    targetMax: Math.max(targetMin, num(o.targetMax, d.targetMax, 0, 60)),
    muscleTargets,
    rirThreshold: num(o.rirThreshold, d.rirThreshold, 0, 10),
    farRir: num(o.farRir, d.farRir, 0, 10),
    farFactor: num(o.farFactor, d.farFactor, 0, 1),
    techniques: Object.fromEntries(
      TECHNIQUES.map((t) => [t.id, num(tech[t.id], d.techniques[t.id], 0.5, 3)]),
    ) as Record<TechniqueId, number>,
  }
}

export function muscleTarget(settings: VolumeSettings, id: MuscleId): { min: number; max: number } {
  return settings.muscleTargets[id] ?? { min: settings.targetMin, max: settings.targetMax }
}

export type VolumeStatus = 'none' | 'low' | 'ok' | 'high'

export const VOLUME_STATUS_COLOR: Record<VolumeStatus, string> = {
  none: 'rgb(var(--ink-muted) / 0.35)',
  low: '#f59e0b',
  ok: '#10b981',
  high: '#f43f5e',
}

export function volumeStatus(value: number, target: { min: number; max: number }): VolumeStatus {
  if (value <= 0) return 'none'
  if (value < target.min) return 'low'
  if (value > target.max) return 'high'
  return 'ok'
}

// ─── RIR ─────────────────────────────────────────────────────────────────────

function avgOfRange(text: string): number | null {
  const nums = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')))
  const ok = nums.filter((n) => Number.isFinite(n))
  if (!ok.length) return null
  return ok.reduce((a, b) => a + b, 0) / ok.length
}

/** RIR a partir de un texto: «RIR 2», «RIR 1-2», «RPE 8», «@8», «8/9», «6o7» (sin aclarar = RPE). */
export function effortTextToRir(text: string | null | undefined): number | null {
  const t = (text ?? '').trim().toLowerCase()
  if (!t) return null
  const v = avgOfRange(t)
  if (v == null) return /fallo|failure/.test(t) ? 0 : null
  if (/rir/.test(t)) return Math.max(0, v)
  if (v > 10) return null
  return Math.max(0, 10 - v)
}

export type VolumeExerciseInput = {
  id: string
  exercise_id: string
  sets: number | null
  reps_scheme: string | null
  rir: number | null
  rpe: number | null
  technical_notes: string | null
  training_method_id: string | null
  exercise?: { name?: string | null; muscle_group?: { slug?: string | null } | null } | null
}

/** RIR de la prescripción: columna RIR, columna RPE, texto RPE/RIR o plan por serie (promedio). */
export function exerciseRir(ex: VolumeExerciseInput): number | null {
  if (ex.rir != null && Number.isFinite(Number(ex.rir))) return Number(ex.rir)
  if (ex.rpe != null && Number.isFinite(Number(ex.rpe))) return Math.max(0, 10 - Number(ex.rpe))
  const { meta } = parseExerciseMeta(ex.technical_notes)
  const fromText = effortTextToRir(meta.rpeText)
  if (fromText != null) return fromText
  const perSeries = (meta.seriesPlan ?? []).map((s) => effortTextToRir(s.rpeRir)).filter((n): n is number => n != null)
  if (perSeries.length) return perSeries.reduce((a, b) => a + b, 0) / perSeries.length
  return null
}

export function exerciseSets(ex: VolumeExerciseInput): number {
  if (ex.sets != null && Number(ex.sets) > 0) return Number(ex.sets)
  const plan = parseExerciseMeta(ex.technical_notes).meta.seriesPlan
  return plan?.length ?? 0
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export type VolumeRow = {
  routineExerciseId: string
  exerciseId: string
  name: string
  sets: number
  factors: MuscleFactors
  /** true = el entrenador ajustó la implicación de este ejercicio. */
  customFactors: boolean
  technique: TechniqueId
  /** true = técnica elegida a mano en la rutina (no detectada). */
  techniqueManual: boolean
  rir: number | null
  /** Multiplicador de técnica efectivamente aplicado (1 si no corresponde por RIR). */
  intensity: number
  techniqueBlockedByRir: boolean
  effort: number
  raw: MuscleFactors
  weighted: MuscleFactors
}

export type VolumeContext = {
  settings: VolumeSettings
  /** Implicación ajustada por el entrenador, por exercise_id. */
  factorOverrides: Map<string, MuscleFactors>
  /** Nombre del método aplicado, por training_method_id. */
  methodNames: Map<string, string>
}

export function computeExerciseVolume(ex: VolumeExerciseInput, ctx: VolumeContext): VolumeRow {
  const name = ex.exercise?.name ?? 'Ejercicio'
  const override = ctx.factorOverrides.get(ex.exercise_id)
  const factors = override ?? defaultMuscleFactors(name, ex.exercise?.muscle_group?.slug)
  const { meta, userNotes } = parseExerciseMeta(ex.technical_notes)
  const manual = TECHNIQUES.some((t) => t.id === meta.volumeTechnique)
  const technique = manual
    ? (meta.volumeTechnique as TechniqueId)
    : detectTechnique(ex.training_method_id ? ctx.methodNames.get(ex.training_method_id) : null, ex.reps_scheme, userNotes)
  const rir = exerciseRir(ex)
  const sets = exerciseSets(ex)
  const s = ctx.settings
  const blocked = technique !== 'straight' && rir != null && rir > s.rirThreshold
  const intensity = technique === 'straight' || blocked ? 1 : s.techniques[technique]
  const effort = rir != null && rir >= s.farRir ? s.farFactor : 1
  const raw: MuscleFactors = {}
  const weighted: MuscleFactors = {}
  for (const id of MUSCLE_IDS) {
    const f = factors[id]
    if (!f) continue
    raw[id] = sets * f
    weighted[id] = sets * f * intensity * effort
  }
  return {
    routineExerciseId: ex.id,
    exerciseId: ex.exercise_id,
    name,
    sets,
    factors,
    customFactors: !!override,
    technique,
    techniqueManual: manual,
    rir,
    intensity,
    techniqueBlockedByRir: blocked,
    effort,
    raw,
    weighted,
  }
}

export type VolumeDay = {
  id: string
  name: string
  rows: VolumeRow[]
  /** Volumen total de la sesión: suma de las series de todos sus ejercicios. */
  totalSets: number
}

export type WeekVolume = {
  days: VolumeDay[]
  raw: Record<MuscleId, number>
  weighted: Record<MuscleId, number>
  /** Ejercicios sin ningún músculo asignado (no suman). */
  unmapped: VolumeRow[]
  /** Series totales de la semana (todas las sesiones, todos los músculos). */
  totalSets: number
}

function zeroTotals(): Record<MuscleId, number> {
  return Object.fromEntries(MUSCLE_IDS.map((id) => [id, 0])) as Record<MuscleId, number>
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function computeWeekVolume(
  days: { id: string; day_name: string; exercises: VolumeExerciseInput[] }[],
  ctx: VolumeContext,
): WeekVolume {
  const raw = zeroTotals()
  const weighted = zeroTotals()
  const unmapped: VolumeRow[] = []
  const outDays: VolumeDay[] = days.map((d) => {
    const rows = d.exercises.map((ex) => computeExerciseVolume(ex, ctx))
    for (const r of rows) {
      if (!Object.keys(r.factors).length) unmapped.push(r)
      for (const id of MUSCLE_IDS) {
        raw[id] += r.raw[id] ?? 0
        weighted[id] += r.weighted[id] ?? 0
      }
    }
    return { id: d.id, name: d.day_name, rows, totalSets: rows.reduce((acc, r) => acc + r.sets, 0) }
  })
  for (const id of MUSCLE_IDS) {
    raw[id] = round1(raw[id])
    weighted[id] = round1(weighted[id])
  }
  return { days: outDays, raw, weighted, unmapped, totalSets: outDays.reduce((acc, d) => acc + d.totalSets, 0) }
}

function dayKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type SessionVolumeRow = {
  key: string
  name: string
  /** Series totales de esa sesión en cada semana (null = la sesión no existe esa semana). */
  perWeek: (number | null)[]
}

/**
 * Volumen total por sesión a lo largo del mesociclo: misma sesión (por nombre del día)
 * en cada semana, para dosificar y ver cuánto volumen total tolera el alumno.
 */
export function buildSessionVolume(weeks: WeekVolume[]): SessionVolumeRow[] {
  const order: string[] = []
  const names = new Map<string, string>()
  for (const w of weeks) {
    w.days.forEach((d, di) => {
      const key = dayKey(d.name) || `dia-${di + 1}`
      if (!names.has(key)) {
        names.set(key, d.name.trim() || `Día ${di + 1}`)
        order.push(key)
      }
    })
  }
  return order.map((key) => ({
    key,
    name: names.get(key)!,
    perWeek: weeks.map((w) => {
      const matches = w.days.filter((d, di) => (dayKey(d.name) || `dia-${di + 1}`) === key)
      return matches.length ? matches.reduce((acc, d) => acc + d.totalSets, 0) : null
    }),
  }))
}

/** Músculos de una semana fuera del rango sostenible (por encima del máximo). */
export function overloadedMuscles(week: WeekVolume, settings: VolumeSettings): MuscleId[] {
  return MUSCLE_IDS.filter((id) => volumeStatus(week.weighted[id], muscleTarget(settings, id)) === 'high')
}
