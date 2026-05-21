import { FOOD_ITEMS } from '@/lib/intake/nutritionIntakeSchema'
import type { NutritionIntakeStored } from '@/types/database'

export function nutritionIntakeFormTypeLabel(formType: string | undefined): string {
  if (formType === 'full') return 'Plan integral (entrenamiento + nutrición)'
  if (formType === 'nutrition') return 'Solo nutrición'
  return 'Formulario web'
}

export function yesNoLabel(v: string | undefined): string | null {
  if (v === 'si') return 'Sí'
  if (v === 'no') return 'No'
  return null
}

const FOOD_LABEL_BY_KEY = Object.fromEntries(FOOD_ITEMS.map((f) => [f.key, f.label])) as Record<string, string>

export function formatFoodFreq(
  foodFreq: NutritionIntakeStored['food_freq'] | undefined,
): { label: string; tipo: string; frecuencia: string; cantidad: string }[] {
  if (!foodFreq || typeof foodFreq !== 'object') return []
  return Object.entries(foodFreq)
    .map(([key, row]) => {
      if (!row || typeof row !== 'object') return null
      const tipo = String(row.tipo ?? '').trim()
      const frecuencia = String(row.frecuencia ?? '').trim()
      const cantidad = String(row.cantidad ?? '').trim()
      if (!tipo && !frecuencia && !cantidad) return null
      return {
        label: FOOD_LABEL_BY_KEY[key] ?? key,
        tipo,
        frecuencia,
        cantidad,
      }
    })
    .filter(Boolean) as { label: string; tipo: string; frecuencia: string; cantidad: string }[]
}

export const NUTRITION_INTAKE_SECTIONS: {
  title: string
  fields: { key: keyof NutritionIntakeStored; label: string }[]
}[] = [
  {
    title: 'Motivo y contexto',
    fields: [
      { key: 'motivo_consulta', label: 'Motivo de consulta' },
      { key: 'profession', label: 'Profesión / actividad' },
      { key: 'work_hours', label: 'Horarios de trabajo' },
      { key: 'marital_status', label: 'Estado civil' },
      { key: 'family_composition', label: 'Composición familiar' },
      { key: 'hobbies', label: 'Hobbies / intereses' },
    ],
  },
  {
    title: 'Salud',
    fields: [
      { key: 'pathologies', label: 'Patologías / antecedentes' },
      { key: 'medications', label: 'Medicación' },
      { key: 'supplementation', label: 'Suplementación' },
      { key: 'symptoms', label: 'Síntomas' },
      { key: 'family_history', label: 'Antecedentes familiares' },
      { key: 'smoking', label: 'Fuma' },
    ],
  },
  {
    title: 'Actividad física',
    fields: [
      { key: 'has_physical_activity', label: 'Realiza actividad física' },
      { key: 'activity_type', label: 'Tipo de actividad' },
      { key: 'activity_since', label: 'Desde cuándo' },
      { key: 'activity_frequency', label: 'Frecuencia' },
      { key: 'activity_duration', label: 'Duración' },
      { key: 'activity_intensity', label: 'Intensidad' },
    ],
  },
  {
    title: 'Hábitos alimentarios',
    fields: [
      { key: 'first_meal_time', label: 'Primer alimento del día' },
      { key: 'meals_per_day', label: 'Comidas por día' },
      { key: 'skipped_meal', label: 'Comida que suele saltear' },
      { key: 'last_meal_time', label: 'Última comida del día' },
      { key: 'digestive_intolerances', label: 'Intolerancias / molestias digestivas' },
      { key: 'common_preparations', label: 'Preparaciones habituales' },
      { key: 'frequent_vegetables', label: 'Verduras frecuentes' },
      { key: 'frequent_fruits', label: 'Frutas frecuentes' },
    ],
  },
  {
    title: 'Registro de un día (24 h)',
    fields: [
      { key: 'record_breakfast', label: 'Desayuno' },
      { key: 'record_lunch', label: 'Almuerzo' },
      { key: 'record_snack', label: 'Merienda' },
      { key: 'record_dinner', label: 'Cena' },
      { key: 'record_collations', label: 'Colaciones' },
    ],
  },
  {
    title: 'Hábitos (autoevaluación)',
    fields: [
      { key: 'good_habit_1', label: 'Hábito positivo 1' },
      { key: 'good_habit_2', label: 'Hábito positivo 2' },
      { key: 'good_habit_3', label: 'Hábito positivo 3' },
      { key: 'bad_habit_1', label: 'Hábito a mejorar 1' },
      { key: 'bad_habit_2', label: 'Hábito a mejorar 2' },
      { key: 'bad_habit_3', label: 'Hábito a mejorar 3' },
      { key: 'other_notes', label: 'Otras observaciones' },
    ],
  },
]
