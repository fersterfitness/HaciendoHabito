import { z } from 'zod'
import { canonicalizeArgentinaStudentPhone, STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'

/** Cuestionario mínimo psicología deportiva (web /form). */
export const psychologistIntakeSchema = z
  .object({
    first_name: z.string().min(1, 'Requerido').max(60),
    last_name: z.string().min(1, 'Requerido').max(60),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(1, 'Teléfono requerido'),
    residence: z.string().min(3, 'Indicá lugar de residencia').max(500),
    sport_practiced: z.string().min(2, 'Indicá el deporte que practicás').max(300),
    emergency_contact: z.string().min(5, 'Indicá nombre y teléfono de emergencia').max(500),
    payment_preference: z.enum(['cash', 'mercadopago'], {
      required_error: 'Elegí una forma de pago',
    }),
    payment_notes: z.string().max(500).optional().or(z.literal('')),
    accept_privacy: z.boolean().refine((v) => v === true, {
      message: 'Tenés que aceptar para continuar',
    }),
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
  })

export type PsychologistIntakeFormValues = z.infer<typeof psychologistIntakeSchema>

export function psychologistDefaults(): Partial<PsychologistIntakeFormValues> & {
  website: ''
  accept_privacy: false
} {
  return {
    website: '',
    accept_privacy: false,
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    phone: '',
    residence: '',
    sport_practiced: '',
    emergency_contact: '',
    payment_preference: 'mercadopago',
    payment_notes: '',
  }
}
