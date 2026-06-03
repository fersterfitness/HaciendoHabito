/** Esquema lógico v1 — persiste JSON en nutrition_anamnesis.payload */

export const FOOD_FREQUENCY_ITEMS = [
  'Leche de vaca',
  'Yogur',
  'Quesos',
  'Infusiones como café, té o mate',
  'Azúcar',
  'Miel',
  'Edulcorante',
  'Pan y productos panificados',
  'Facturas o tortas',
  'Galletas',
  'Cereales (pastas, arroz, tartas, empanadas, pizza, polenta, etc)',
  'Frutas',
  'Vegetales',
  'Margarina',
  'Manteca',
  'Dulce de leche',
  'Mermelada',
  'Avena molida (panqueques, galletitas caseras)',
  'Aceites',
  'Pollo',
  'Cerdo',
  'Pescados',
  'Carne de vaca',
  'Huevo',
  'Legumbres',
  'Semillas',
  'Frutos secos',
  'Palta',
  'Pasta de maní',
  'Alcohol',
  'Bebidas azucaradas',
  'Golosinas',
] as const

export interface FoodFreqRow {
  food: string
  tipo: string
  frecuencia: string
  cantidad: string
  /** Marcá si no consumís este alimento. */
  noConsume: boolean
  motivo: string
}

export interface NutritionAnamnesisPayloadV1 {
  motivoConsulta: string

  profesionOcupacion: string
  horarioTrabajo: string
  estadoCivil: string
  composicionFamiliar: string
  hobbies: string

  cinturaCm: string
  caderaCm: string
  brazoCircunferencia: string

  patologias: string
  medicacion: string
  suplementacion: string
  sintomatologia: string
  antecedentesFamiliares: string
  tabaquismoSiNo: string
  otrosEstudios: string

  actividadFisicaAfirmativo: '' | 'si' | 'no'
  actividadFisicaCual: string
  actividadHaceCuanto: string
  actividadFrecuencia: string
  actividadDuracion: string
  actividadIntensidad: string

  horarioPrimeraIngesta: string
  comidasAlDia: string
  comidasQueSaltea: string
  horarioUltimaIngesta: string
  intolerancias: string
  sietePreparacionesMasComunes: string

  registro24hDesayuno: string
  registro24hAlmuerzo: string
  registro24hMerienda: string
  registro24hCena: string
  registro24hColaciones: string

  foodFrequency: FoodFreqRow[]
  frutasVerdurasPreferidas: string
  otrosAlimentosRelevantes: string

  habitosBuenos: [string, string, string]
  habitosMalos: [string, string, string]

  aclaracionesFinales: string

  /** Valor objetivo manual (ej. GET o plan en kcal/día) — opcional */
  resultadoEnergeticoMeta: string
}

export function emptyFoodFreqRows(): FoodFreqRow[] {
  return FOOD_FREQUENCY_ITEMS.map((food) => ({
    food,
    tipo: '',
    frecuencia: '',
    cantidad: '',
    noConsume: false,
    motivo: '',
  }))
}

export function createEmptyAnamnesisPayload(): NutritionAnamnesisPayloadV1 {
  return {
    motivoConsulta: '',
    profesionOcupacion: '',
    horarioTrabajo: '',
    estadoCivil: '',
    composicionFamiliar: '',
    hobbies: '',
    cinturaCm: '',
    caderaCm: '',
    brazoCircunferencia: '',
    patologias: '',
    medicacion: '',
    suplementacion: '',
    sintomatologia: '',
    antecedentesFamiliares: '',
    tabaquismoSiNo: '',
    otrosEstudios: '',
    actividadFisicaAfirmativo: '',
    actividadFisicaCual: '',
    actividadHaceCuanto: '',
    actividadFrecuencia: '',
    actividadDuracion: '',
    actividadIntensidad: '',
    horarioPrimeraIngesta: '',
    comidasAlDia: '',
    comidasQueSaltea: '',
    horarioUltimaIngesta: '',
    intolerancias: '',
    sietePreparacionesMasComunes: '',
    registro24hDesayuno: '',
    registro24hAlmuerzo: '',
    registro24hMerienda: '',
    registro24hCena: '',
    registro24hColaciones: '',
    foodFrequency: emptyFoodFreqRows(),
    frutasVerdurasPreferidas: '',
    otrosAlimentosRelevantes: '',
    habitosBuenos: ['', '', ''],
    habitosMalos: ['', '', ''],
    aclaracionesFinales: '',
    resultadoEnergeticoMeta: '',
  }
}

/** Fusiona objeto guardado parcial con defaults de esquema v1 */
export function mergeAnamnesisPayload(stored: unknown): NutritionAnamnesisPayloadV1 {
  const base = createEmptyAnamnesisPayload()
  if (!stored || typeof stored !== 'object') return base
  const s = stored as Record<string, unknown>

  const assign = <K extends keyof NutritionAnamnesisPayloadV1>(key: K, tr: (v: unknown) => NutritionAnamnesisPayloadV1[K]) => {
    if (key in s) base[key] = tr(s[key])
  }

  assign('motivoConsulta', (v) => String(v ?? ''))
  assign('profesionOcupacion', (v) => String(v ?? ''))
  assign('horarioTrabajo', (v) => String(v ?? ''))
  assign('estadoCivil', (v) => String(v ?? ''))
  assign('composicionFamiliar', (v) => String(v ?? ''))
  assign('hobbies', (v) => String(v ?? ''))
  assign('cinturaCm', (v) => String(v ?? ''))
  assign('caderaCm', (v) => String(v ?? ''))
  assign('brazoCircunferencia', (v) => String(v ?? ''))
  assign('patologias', (v) => String(v ?? ''))
  assign('medicacion', (v) => String(v ?? ''))
  assign('suplementacion', (v) => String(v ?? ''))
  assign('sintomatologia', (v) => String(v ?? ''))
  assign('antecedentesFamiliares', (v) => String(v ?? ''))
  assign('tabaquismoSiNo', (v) => String(v ?? ''))
  assign('otrosEstudios', (v) => String(v ?? ''))
  assign('actividadFisicaAfirmativo', (v) => {
    const x = String(v ?? '').toLowerCase()
    return x === 'si' || x === 'no' ? x : ''
  })
  assign('actividadFisicaCual', (v) => String(v ?? ''))
  assign('actividadHaceCuanto', (v) => String(v ?? ''))
  assign('actividadFrecuencia', (v) => String(v ?? ''))
  assign('actividadDuracion', (v) => String(v ?? ''))
  assign('actividadIntensidad', (v) => String(v ?? ''))
  assign('horarioPrimeraIngesta', (v) => String(v ?? ''))
  assign('comidasAlDia', (v) => String(v ?? ''))
  assign('comidasQueSaltea', (v) => String(v ?? ''))
  assign('horarioUltimaIngesta', (v) => String(v ?? ''))
  assign('intolerancias', (v) => String(v ?? ''))
  assign('sietePreparacionesMasComunes', (v) => String(v ?? ''))
  assign('registro24hDesayuno', (v) => String(v ?? ''))
  assign('registro24hAlmuerzo', (v) => String(v ?? ''))
  assign('registro24hMerienda', (v) => String(v ?? ''))
  assign('registro24hCena', (v) => String(v ?? ''))
  assign('registro24hColaciones', (v) => String(v ?? ''))
  assign('frutasVerdurasPreferidas', (v) => String(v ?? ''))
  assign('otrosAlimentosRelevantes', (v) => String(v ?? ''))
  assign('aclaracionesFinales', (v) => String(v ?? ''))
  assign('resultadoEnergeticoMeta', (v) => String(v ?? ''))

  if (Array.isArray(s.habitosBuenos)) {
    base.habitosBuenos = ['', '', ''] as [string, string, string]
    s.habitosBuenos.slice(0, 3).forEach((item, i) => {
      base.habitosBuenos[i] = String(item ?? '')
    })
  }
  if (Array.isArray(s.habitosMalos)) {
    base.habitosMalos = ['', '', ''] as [string, string, string]
    s.habitosMalos.slice(0, 3).forEach((item, i) => {
      base.habitosMalos[i] = String(item ?? '')
    })
  }

  if (Array.isArray(s.foodFrequency)) {
    const byFood = new Map<string, Partial<FoodFreqRow>>()
    for (const row of s.foodFrequency as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const r = row as FoodFreqRow
      if (r.food) byFood.set(r.food, r)
    }
    base.foodFrequency = FOOD_FREQUENCY_ITEMS.map((food) => {
      const merge = byFood.get(food)
      return merge
        ? {
            food,
            tipo: String(merge.tipo ?? ''),
            frecuencia: String(merge.frecuencia ?? ''),
            cantidad: String(merge.cantidad ?? ''),
            noConsume: Boolean(merge.noConsume),
            motivo: String(merge.motivo ?? ''),
          }
        : { food, tipo: '', frecuencia: '', cantidad: '', noConsume: false, motivo: '' }
    })
    const extra = (s.foodFrequency as unknown[]).filter((r) => r && typeof r === 'object' && FOOD_FREQUENCY_ITEMS.every((n) => n !== (r as FoodFreqRow).food))
    for (const row of extra) {
      const r = row as FoodFreqRow
      if ((r?.food as string)?.length)
        base.foodFrequency.push({
          food: String(r.food),
          tipo: String(r.tipo ?? ''),
          frecuencia: String(r.frecuencia ?? ''),
          cantidad: String(r.cantidad ?? ''),
          noConsume: Boolean(r.noConsume),
          motivo: String(r.motivo ?? ''),
        })
    }
  }

  return base
}
