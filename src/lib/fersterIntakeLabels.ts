/** Etiquetas legibles para valores guardados en `intake_ferster` y columnas del alumno. */

export function fersterTrainingSinceLabel(v: string): string {
  const m: Record<string, string> = {
    never: 'No entrenaba',
    less_than_1y: 'Hace menos de 1 año',
    '1_to_3y': 'Entre 1 y 3 años',
    more_than_3y: 'Más de 3 años',
  }
  return m[v] ?? v
}

export function fersterLifestyleLabel(v: string): string {
  const m: Record<string, string> = {
    sedentary: 'Sedentario',
    light: 'Poco activo',
    active: 'Activo',
    very_active: 'Muy activo',
  }
  return m[v] ?? v
}

export function fersterIntensityLabel(v: string): string {
  const m: Record<string, string> = {
    light: 'Liviano',
    moderate: 'Moderado',
    intense: 'Intenso',
    very_intense: 'Muy intenso',
  }
  return m[v] ?? v
}

export function fersterSessionLabel(v: string): string {
  const m: Record<string, string> = {
    '30': '30 minutos',
    '60': '1 hora',
    '90': '1,5 horas',
    '120_plus': '2 horas o más',
  }
  return m[v] ?? v
}

export function fersterEquipmentLabel(v: string): string {
  const m: Record<string, string> = {
    none: 'Sin equipo',
    home: 'Equipo en casa',
    gym_basic: 'Gimnasio básico',
    gym_advanced: 'Gimnasio avanzado',
  }
  return m[v] ?? v
}

export function fersterGoalLabel(v: string): string {
  const m: Record<string, string> = {
    healthy_life: 'Vida saludable',
    sport: 'Mejorar en mi deporte',
    cut_lean: 'Descenso de peso y ganancia magra',
    bulk: 'Aumento de masa muscular',
  }
  return m[v] ?? v
}

export function fersterMealsLabel(v: string): string {
  const m: Record<string, string> = { yes: 'Sí', no: 'No', rarely: 'Con poca frecuencia' }
  return m[v] ?? v
}

export function fersterSleepLabel(v: string): string {
  const m: Record<string, string> = {
    lt5: 'Menos de 5 h',
    '5_6': '5 a 6 h',
    '6_7': '6 a 7 h',
    '8_plus': '8 h o más',
  }
  return m[v] ?? v
}

export function studentGenderLabel(gender: 'M' | 'F' | 'otro' | null, genderOther?: string | null): string {
  if (!gender) return ''
  if (gender === 'M') return 'Masculino'
  if (gender === 'F') return 'Femenino'
  return genderOther?.trim() ? `Otro (${genderOther.trim()})` : 'Otro'
}
