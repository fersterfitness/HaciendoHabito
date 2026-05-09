import { z } from 'zod'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'

export const FOOD_ITEMS: { key: string; label: string }[] = [
  { key: 'leche_vaca',         label: 'Leche de vaca' },
  { key: 'yogur',              label: 'Yogur' },
  { key: 'quesos',             label: 'Quesos' },
  { key: 'infusiones',         label: 'Infusiones (café, té, mate)' },
  { key: 'azucar',             label: 'Azúcar' },
  { key: 'miel',               label: 'Miel' },
  { key: 'edulcorante',        label: 'Edulcorante' },
  { key: 'pan',                label: 'Pan y panificados' },
  { key: 'facturas',           label: 'Facturas o tortas' },
  { key: 'galletas',           label: 'Galletas' },
  { key: 'cereales',           label: 'Cereales (pastas, arroz, tartas, pizza…)' },
  { key: 'frutas',             label: 'Frutas' },
  { key: 'vegetales',          label: 'Vegetales' },
  { key: 'margarina',          label: 'Margarina' },
  { key: 'manteca',            label: 'Manteca' },
  { key: 'dulce_leche',        label: 'Dulce de leche' },
  { key: 'mermelada',          label: 'Mermelada' },
  { key: 'avena',              label: 'Avena molida' },
  { key: 'aceites',            label: 'Aceites' },
  { key: 'pollo',              label: 'Pollo' },
  { key: 'cerdo',              label: 'Cerdo' },
  { key: 'pescados',           label: 'Pescados' },
  { key: 'carne_vaca',         label: 'Carne de vaca' },
  { key: 'huevo',              label: 'Huevo' },
  { key: 'legumbres',          label: 'Legumbres' },
  { key: 'semillas',           label: 'Semillas' },
  { key: 'frutos_secos',       label: 'Frutos secos' },
  { key: 'palta',              label: 'Palta' },
  { key: 'pasta_mani',         label: 'Pasta de maní' },
  { key: 'alcohol',            label: 'Alcohol' },
  { key: 'bebidas_azucaradas', label: 'Bebidas azucaradas' },
  { key: 'golosinas',          label: 'Golosinas' },
]

export const nutritionIntakeSchema = z
  .object({
    // ── Personales ────────────────────────────────────────────────────────────
    first_name:         z.string().min(1, 'Requerido').max(60),
    last_name:          z.string().min(1, 'Requerido').max(60),
    birth_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    email:              z.string().email('Email inválido'),
    phone:              z.string().min(1, 'Teléfono requerido'),
    profession:         z.string().max(200).default(''),
    work_hours:         z.string().max(200).default(''),
    marital_status:     z.string().max(100).default(''),
    family_composition: z.string().max(500).default(''),
    hobbies:            z.string().max(500).default(''),
    motivo_consulta:    z.string().max(1000).default(''),

    // ── Antropometría y salud ─────────────────────────────────────────────────
    weight_kg:       z.coerce.number().min(25, 'Peso inválido').max(400),
    height_cm:       z.coerce.number().min(100, 'Altura inválida').max(250),
    pathologies:     z.string().max(2000).default(''),
    medications:     z.string().max(2000).default(''),
    supplementation: z.string().max(2000).default(''),
    symptoms:        z.string().max(2000).default(''),
    family_history:  z.string().max(2000).default(''),
    smoking:         z.enum(['si', 'no']).default('no'),

    // ── Actividad física ──────────────────────────────────────────────────────
    has_physical_activity: z.enum(['si', 'no']).default('no'),
    activity_type:         z.string().max(500).default(''),
    activity_since:        z.string().max(200).default(''),
    activity_frequency:    z.string().max(200).default(''),
    activity_duration:     z.string().max(200).default(''),
    activity_intensity:    z.string().max(200).default(''),

    // ── Hábitos alimentarios ──────────────────────────────────────────────────
    first_meal_time:        z.string().max(100).default(''),
    meals_per_day:          z.string().max(50).default(''),
    skipped_meal:           z.string().max(200).default(''),
    last_meal_time:         z.string().max(100).default(''),
    digestive_intolerances: z.string().max(1000).default(''),
    common_preparations:    z.string().max(1000).default(''),

    // ── Registro 24hs ─────────────────────────────────────────────────────────
    record_breakfast:  z.string().max(2000).default(''),
    record_lunch:      z.string().max(2000).default(''),
    record_snack:      z.string().max(2000).default(''),
    record_dinner:     z.string().max(2000).default(''),
    record_collations: z.string().max(2000).default(''),

    // ── Frecuencia alimentaria ────────────────────────────────────────────────
    food_freq: z.record(
      z.object({
        tipo:      z.string().default(''),
        frecuencia: z.string().default(''),
        cantidad:  z.string().default(''),
      })
    ).default({}),

    // ── Frutas, verduras y hábitos ────────────────────────────────────────────
    frequent_vegetables: z.string().max(500).default(''),
    frequent_fruits:     z.string().max(500).default(''),
    good_habit_1:        z.string().max(300).default(''),
    good_habit_2:        z.string().max(300).default(''),
    good_habit_3:        z.string().max(300).default(''),
    bad_habit_1:         z.string().max(300).default(''),
    bad_habit_2:         z.string().max(300).default(''),
    bad_habit_3:         z.string().max(300).default(''),
    other_notes:         z.string().max(2000).default(''),

    // ── Meta ──────────────────────────────────────────────────────────────────
    payment_preference: z.enum(['cash', 'mercadopago'], {
      required_error: 'Elegí una forma de pago',
    }),
    website:        z.literal(''),
    accept_privacy: z.boolean().refine((v) => v === true, { message: 'Tenés que aceptar para continuar' }),
  })
  .superRefine((data, ctx) => {
    if (!canonicalizeArgentinaStudentPhone(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formato: ${STUDENT_PHONE_FORMAT_HINT}`,
        path: ['phone'],
      })
    }
  })

export type NutritionIntakeFormValues = z.infer<typeof nutritionIntakeSchema>

function emptyFood() {
  return { tipo: '', frecuencia: '', cantidad: '' }
}

export function nutritionDefaults(): Partial<NutritionIntakeFormValues> & { website: ''; accept_privacy: false } {
  return {
    website: '',
    accept_privacy: false,
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    phone: '',
    profession: '',
    work_hours: '',
    marital_status: '',
    family_composition: '',
    hobbies: '',
    motivo_consulta: '',
    weight_kg: 65,
    height_cm: 165,
    pathologies: '',
    medications: '',
    supplementation: '',
    symptoms: '',
    family_history: '',
    smoking: 'no',
    has_physical_activity: 'no',
    activity_type: '',
    activity_since: '',
    activity_frequency: '',
    activity_duration: '',
    activity_intensity: '',
    first_meal_time: '',
    meals_per_day: '',
    skipped_meal: '',
    last_meal_time: '',
    digestive_intolerances: '',
    common_preparations: '',
    record_breakfast: '',
    record_lunch: '',
    record_snack: '',
    record_dinner: '',
    record_collations: '',
    food_freq: Object.fromEntries(FOOD_ITEMS.map((f) => [f.key, emptyFood()])) as Record<
      string,
      { tipo: string; frecuencia: string; cantidad: string }
    >,
    frequent_vegetables: '',
    frequent_fruits: '',
    good_habit_1: '',
    good_habit_2: '',
    good_habit_3: '',
    bad_habit_1: '',
    bad_habit_2: '',
    bad_habit_3: '',
    other_notes: '',
    payment_preference: 'mercadopago',
  }
}
