import { z } from 'zod'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'

/** Valores del cuestionario Ferster (registro web /form) */
export const fersterIntakeSchema = z
  .object({
    first_name: z.string().min(1, 'Requerido').max(60),
    last_name: z.string().min(1, 'Requerido').max(60),
    document_id: z.string().min(4, 'Documento inválido').max(32),
    phone: z.string().min(1, 'Teléfono requerido'),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    gender: z.enum(['M', 'F', 'otro']),
    gender_other: z.string().max(120).optional().or(z.literal('')),
    weight_kg: z.coerce.number().min(25, 'Peso inválido').max(400),
    height_cm: z.coerce.number().min(100, 'Altura inválida').max(250),
    email: z.string().email('Email inválido'),
    address: z.string().min(8, 'Indicá una dirección más completa').max(500),
    training_since: z.enum(['never', 'less_than_1y', '1_to_3y', 'more_than_3y']),
    days_per_week: z.coerce.number().int().min(1).max(10),
    lifestyle: z.enum(['sedentary', 'light', 'active', 'very_active']),
    training_intensity: z.enum(['light', 'moderate', 'intense', 'very_intense']),
    session_duration: z.enum(['30', '60', '90', '120_plus']),
    equipment: z.enum(['none', 'home', 'gym_basic', 'gym_advanced']),
    main_goal: z.enum(['healthy_life', 'sport', 'cut_lean', 'bulk']),
    pathology: z.enum(['no', 'yes']),
    pathology_detail: z.string().max(2000).optional().or(z.literal('')),
    discomfort_exercises: z.string().min(1, 'Respondé esta pregunta').max(2000),
    four_meals: z.enum(['yes', 'no', 'rarely']),
    sleep_hours: z.enum(['lt5', '5_6', '6_7', '8_plus']),
    supplements: z.enum(['yes', 'no']),
    payment_preference: z.enum(['cash', 'mercadopago'], {
      required_error: 'Elegí una forma de pago',
    }),
    accept_privacy: z.boolean().refine((v) => v === true, { message: 'Tenés que aceptar para continuar' }),
    website: z.literal(''),
  })
  .superRefine((data, ctx) => {
    if (!canonicalizeArgentinaStudentPhone(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formato: ${STUDENT_PHONE_FORMAT_HINT}`,
        path: ['phone'],
      })
    }
    if (data.gender === 'otro' && !data.gender_other?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Completá el género', path: ['gender_other'] })
    }
    if (data.pathology === 'yes' && !data.pathology_detail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Describí la patología o medicación',
        path: ['pathology_detail'],
      })
    }
  })

export type FersterIntakeFormValues = z.infer<typeof fersterIntakeSchema>

export function fersterDefaults(): Partial<FersterIntakeFormValues> & { website: ''; accept_privacy: false } {
  return {
    website: '',
    accept_privacy: false,
    first_name: '',
    last_name: '',
    document_id: '',
    phone: '',
    birth_date: '',
    gender: 'M',
    gender_other: '',
    weight_kg: 70,
    height_cm: 170,
    email: '',
    address: '',
    training_since: 'never',
    days_per_week: 3,
    lifestyle: 'sedentary',
    training_intensity: 'moderate',
    session_duration: '60',
    equipment: 'gym_basic',
    main_goal: 'healthy_life',
    pathology: 'no',
    pathology_detail: '',
    discomfort_exercises: '',
    four_meals: 'yes',
    sleep_hours: '6_7',
    supplements: 'no',
    payment_preference: 'mercadopago',
  }
}
