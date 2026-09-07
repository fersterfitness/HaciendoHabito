// @vitest-environment node
import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { NutritionMealPlanPdfDocument } from '@/lib/pdf/NutritionMealPlanPdfDocument'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'

const LONG_SNACK =
  'Barra de cereal casera o Integra. Podés conseguirla en dietéticas. ' +
  'Si no hay, una barra de chocolate amargo con frutos secos y yogur descremado.'

function sampleGrid(): WeeklyPlanGridJson {
  return {
    mealRows: [
      {
        id: 'breakfast',
        label: 'Desayuno',
        approxTime: '08:30',
        columns: ['Tostadas', 'Avena', 'Huevos', 'Yogur', 'Fruta', '', ''],
      },
      {
        id: 'snack',
        label: 'Colación de media mañana',
        approxTime: '10:30 - 11:00 AM',
        columns: ['Fruta a elección.', 'Chocolate amargo', LONG_SNACK, 'Yogur y granola', 'Frutos secos', '', ''],
      },
      {
        id: 'lunch',
        label: 'Almuerzo',
        approxTime: '13:00',
        columns: ['Pollo', 'Pescado', 'Carne', 'Tarta', 'Ensalada', 'Pizza', 'Asado'],
      },
    ],
  }
}

function pdfLatin1(data: Uint8Array): string {
  return Buffer.from(data).toString('latin1')
}

function pageCount(data: Uint8Array): number {
  const matches = [...pdfLatin1(data).matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)]
  const last = matches.at(-1)
  return last ? Number(last[1]) : 0
}

function fiveMealGrid(): WeeklyPlanGridJson {
  const cell = LONG_SNACK + ' ' + LONG_SNACK
  const row = (id: string, label: string, approxTime: string): WeeklyPlanGridJson['mealRows'][number] => ({
    id,
    label,
    approxTime,
    columns: [cell, cell, cell, cell, cell, cell, cell],
  })
  return {
    mealRows: [
      row('breakfast', 'Desayuno', '08:00'),
      row('lunch', 'Almuerzo', '13:00'),
      row('snack', 'Merienda', '17:30'),
      row('tea', 'Colación de media tarde (OPCIONAL)', '19:30'),
      row('dinner', 'Cena', '21:00'),
    ],
  }
}

describe('NutritionMealPlanPdfDocument layout', () => {
  it('genera el tablero semanal en una sola hoja cuando hay pocas comidas', async () => {
    const element = createElement(NutritionMealPlanPdfDocument, {
      patientName: 'Federico Vazquez Crossetto',
      genderLabel: 'Masculino',
      ageText: '32 años',
      weightKgText: '84 kg',
      totalKcalLabel: 'Consensuado',
      nextConsultLabel: null,
      mergeWeekends: false,
      grid: sampleGrid(),
    })
    const blob = await pdf(element).toBlob()
    const data = new Uint8Array(await blob.arrayBuffer())

    expect(pageCount(data)).toBe(1)
  }, 30_000)

  it('pasa comidas enteras a la hoja siguiente en planes largos', async () => {
    const element = createElement(NutritionMealPlanPdfDocument, {
      patientName: 'Florencia Vega',
      genderLabel: 'Femenino',
      ageText: '27 años',
      weightKgText: '69 kg',
      totalKcalLabel: '1850 kcal/día',
      nextConsultLabel: null,
      mergeWeekends: false,
      grid: fiveMealGrid(),
    })
    const blob = await pdf(element).toBlob()
    const data = new Uint8Array(await blob.arrayBuffer())

    expect(pageCount(data)).toBeGreaterThanOrEqual(2)
  }, 30_000)
})
