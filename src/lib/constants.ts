export const APP_NAME = 'Haciéndolo Hábito'
export const APP_BRAND = 'FERSTER FITNESS'

export const FEATURE_NUTRITION = import.meta.env.VITE_FEATURE_NUTRITION === 'true'

export const STUDENT_LEVELS = [
  { value: 'inicial', label: 'Inicial' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
] as const

export const STUDENT_STATUSES = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'baja', label: 'Baja' },
] as const

export const ROUTINE_STATUSES = [
  { value: 'activa', label: 'Activa' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
] as const

export const PDF_STATUSES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'Procesando' },
  { value: 'generado', label: 'PDF listo' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'error', label: 'Error' },
] as const

export const PAYMENT_METHODS = [
  { value: 'efectivo_ars', label: 'Efectivo (ARS)' },
  { value: 'efectivo_debito', label: 'Efectivo / Débito' },
  { value: 'cuenta_dni', label: 'Cuenta DNI' },
  { value: 'mercadopago', label: 'MercadoPago' },
  { value: 'debito', label: 'Tarjeta Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
] as const

export const FINANCE_SCOPES = [
  { value: 'business', label: 'Haciéndolo hábito' },
  { value: 'personal', label: 'Vida personal' },
] as const

export const EXPENSE_TYPES = [
  { value: 'fijo', label: 'Fijo' },
  { value: 'variable', label: 'Variable' },
] as const

export const INCOME_STATUSES = [
  { value: 'cobrado', label: 'Cobrado' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'cancelado', label: 'Cancelado' },
] as const

export const EXPENSE_CATEGORIES = [
  'Marketing',
  'Equipamiento',
  'Plataformas digitales',
  'Indumentaria',
  'Transporte',
  'Alimentación',
  'Capacitación',
  'Servicios',
  'Impuestos',
  'Otros',
]

export const STUDENT_PLANS = [
  'HÁBITOS SEDENTARIO',
  'HÁBITOS AVANZADO',
  'HÁBITOS PROGRESIÓN',
  'HÁBITOS DEPORTISTA',
  'HÁBITOS PLATINO',
  'HÁBITOS PREMIUM',
] as const

export const INCOME_TYPES = [
  ...STUDENT_PLANS,
  'Consulta suelta',
  'Devolución / Corrección',
  'Otro',
]

export const INCOME_CATEGORIES = [
  'Entrenamiento',
  'Nutrición',
  'Combo',
  'Consultoría',
  'Otros',
]
